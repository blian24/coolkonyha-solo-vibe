/**
 * @fileoverview Database Connection - SQLite connection management for Coolkonyha.
 * 
 * Implements singleton pattern for database connection with foreign key enforcement.
 * The connection is established at module load and shared across the application.
 * 
 * @see docs/architecture/database-schema.md - Database schema
 * @see docs/setup_complete_db.sql - Canonical schema, used to seed :memory: in tests
 * @author Coolkonyha Development Team
 * @version 1.0.0
 */
import sqlite3 from 'sqlite3';
import path from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DB_PATH env var lets tests point this singleton at an isolated in-memory
// database instead of the real coolkonyha.db. Unset in production - default
// behavior is unchanged. See docs/.notes/future-ideas.md i-2.
const DB_PATH = process.env.DB_PATH === ':memory:'
    ? ':memory:'
    : path.resolve(__dirname, '../coolkonyha.db');
const IS_MEMORY = DB_PATH === ':memory:';

/**
 * Database connection wrapper class.
 * Ensures foreign key constraints are enabled for data integrity.
 */
class Database {
    constructor() {
        this.db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                console.error('Error opening database:', err.message);
                throw new Error(`Database connection failed: ${err.message}`);
            } else {
                console.log(IS_MEMORY
                    ? 'Connected to an in-memory SQLite database (test mode).'
                    : 'Connected to the coolkonyha.db SQLite database.');
                this.db.run('PRAGMA foreign_keys = ON;', (err) => {
                    if (err) {
                        console.error('Failed to enable foreign keys:', err.message);
                    }
                });
                // A fresh :memory: database starts empty - seed it with the
                // canonical schema (see docs/setup_complete_db.sql for how
                // it's kept accurate to production).
                if (IS_MEMORY) {
                    const schemaPath = path.resolve(__dirname, '../docs/setup_complete_db.sql');
                    const schemaSql = readFileSync(schemaPath, 'utf-8');
                    this.db.exec(schemaSql, (err) => {
                        if (err) {
                            console.error('Failed to initialize in-memory schema:', err.message);
                        }
                    });
                }
            }
        });
    }

    get() {
        return this.db;
    }
}

const dbInstance = new Database();
export default dbInstance.get();
