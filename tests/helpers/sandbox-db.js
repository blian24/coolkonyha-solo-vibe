/**
 * @fileoverview Sandbox DB — promise wrapper + reset helper around the real
 * server/db.js connection running in in-memory test mode.
 *
 * Previously this file created its own independent :memory: SQLite database
 * with a hand-copied schema, separate from server/db.js. That copy drifted
 * from production (wrong workflow table name, missing the whole Maintenance
 * domain) - see docs/.notes/future-ideas.md i-2. Tests now import the real
 * server/robots/*.js modules directly, so they must share the *same*
 * connection those modules use: server/db.js itself, switched to ':memory:'
 * and seeded from docs/setup_complete_db.sql (the accurate, production-
 * introspected schema).
 *
 * IMPORTANT — production safety: this module defensively sets
 * `process.env.DB_PATH = ':memory:'` before importing server/db.js, so a
 * test file is never able to accidentally open coolkonyha.db even if run
 * directly instead of via tests/run-tests.js (which also sets this env var,
 * as the primary mechanism — this is a belt-and-suspenders backup).
 *
 * Because the connection is now a shared singleton (one per test-file
 * process, not one per describe block), full isolation between suites is
 * achieved via `reset()` (clears all mutable tables) instead of creating a
 * brand-new connection each time.
 *
 * @see docs/tests/README.md — Test Agent overview
 * @see docs/setup_complete_db.sql — Schema source of truth
 */

process.env.DB_PATH = ':memory:';

// Dynamic import (not a static one) so the env var above is guaranteed to be
// set before server/db.js evaluates its module body and opens the connection.
const dbPromise = import('../../server/db.js').then((m) => m.default);

// Mutable tables cleared between describe blocks. The two workflow tables
// are seed/reference data the app never writes to, so they're left alone.
const MUTABLE_TABLES = [
    'order_items', 'order_status_history', 'orders',
    'maintenance_items', 'maintenance_status_history', 'maintenance_cases',
    'processed_emails', 'products', 'product_suppliers', 'customers',
];

/**
 * Wraps the raw sqlite3.Database connection with promise-based helpers
 * matching the shape robot modules and test bodies both rely on.
 */
export class SandboxDb {
    /** @param {import('sqlite3').Database} rawDb */
    constructor(rawDb) {
        this._db = rawDb;
    }

    /** @returns {import('sqlite3').Database} The raw sqlite3 connection */
    get raw() {
        return this._db;
    }

    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this._db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this._db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this._db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    }

    exec(sql) {
        return new Promise((resolve, reject) => {
            this._db.exec(sql, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    /**
     * Clears every mutable table and resets autoincrement counters, giving
     * the next describe block a clean slate without needing a new
     * connection (the connection is shared across the whole test-file
     * process). Reference/workflow tables are left untouched.
     */
    async reset() {
        await this.run('PRAGMA foreign_keys = OFF;');
        for (const table of MUTABLE_TABLES) {
            await this.run(`DELETE FROM ${table};`);
        }
        await this.run(
            `DELETE FROM sqlite_sequence WHERE name IN (${MUTABLE_TABLES.map((t) => `'${t}'`).join(',')});`
        );
        await this.run('PRAGMA foreign_keys = ON;');
    }

    /**
     * No-op by design: the connection is a shared singleton for the whole
     * test-file process (matching server/db.js's real singleton pattern).
     * Closing it here would break every describe block that runs after.
     * The connection is reclaimed naturally when the test-file's child
     * process exits.
     */
    async close() { /* intentionally empty — see docstring */ }
}

/**
 * Returns a SandboxDb wrapping the shared in-memory server/db.js
 * connection. Safe to call multiple times per test file — always resolves
 * to the same underlying connection.
 *
 * @returns {Promise<SandboxDb>}
 */
export const createSandboxDb = async () => {
    const rawDb = await dbPromise;
    return new SandboxDb(rawDb);
};
