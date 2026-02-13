/**
 * @fileoverview Database Connection - SQLite connection management for Coolkonyha.
 * 
 * Implements singleton pattern for database connection with foreign key enforcement.
 * The connection is established at module load and shared across the application.
 * 
 * @see docs/antigravity_db_schema.md - Database schema
 * @author Coolkonyha Development Team
 * @version 1.0.0
 */
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.resolve(__dirname, '../coolkonyha.db');

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
                console.log('Connected to the coolkonyha.db SQLite database.');
                this.db.run('PRAGMA foreign_keys = ON;', (err) => {
                    if (err) {
                        console.error('Failed to enable foreign keys:', err.message);
                    }
                });
            }
        });
    }

    get() {
        return this.db;
    }
}

const dbInstance = new Database();
export default dbInstance.get();
