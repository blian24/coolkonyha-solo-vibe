/**
 * @fileoverview Migration — Add processed_emails table.
 *
 * Adds the email processing ledger table to an existing coolkonyha.db.
 * Safe to run on a DB that was initialized before this table existed.
 *
 * @see docs/architecture/database-schema.md - processed_emails section
 * @see docs/setup_complete_db.sql - Full schema reference
 */
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.resolve(__dirname, '../coolkonyha.db');

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS processed_emails (
    email_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    gmail_message_id  TEXT UNIQUE NOT NULL,
    thread_id         TEXT,
    email_date        DATETIME,
    direction         TEXT NOT NULL CHECK(direction IN ('received', 'sent')),
    from_address      TEXT,
    to_address        TEXT,
    subject           TEXT,
    ai_summary        TEXT,
    linked_order_id   INTEGER,
    status            TEXT NOT NULL DEFAULT 'pending'
                          CHECK(status IN ('pending', 'processed', 'failed', 'skipped')),
    processed_at      DATETIME,
    FOREIGN KEY (linked_order_id) REFERENCES orders(order_id)
);
`;

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    }
    console.log('Connected to coolkonyha.db');
});

db.serialize(() => {
    db.run('PRAGMA foreign_keys = ON;');

    db.run(CREATE_TABLE_SQL, (err) => {
        if (err) {
            console.error('Migration failed:', err.message);
            process.exit(1);
        }
        console.log('✅ Migration complete: processed_emails table created (or already existed).');
    });

    db.close((err) => {
        if (err) console.error('Error closing database:', err.message);
        else console.log('Database connection closed.');
    });
});
