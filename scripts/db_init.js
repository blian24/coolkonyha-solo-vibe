import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.resolve(__dirname, '../coolkonyha.db');
const SQL_FILE_PATH = path.resolve(__dirname, '../docs/setup_complete_db.sql');

// Promisify database operations
const runAsync = (db, sql) => new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
    });
});

const allAsync = (db, sql) => new Promise((resolve, reject) => {
    db.all(sql, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

const getAsync = (db, sql) => new Promise((resolve, reject) => {
    db.get(sql, [], (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

const initializeDatabase = async () => {
    try {
        // Check if SQL file exists
        if (!fs.existsSync(SQL_FILE_PATH)) {
            console.error(`Error: SQL setup file not found at ${SQL_FILE_PATH}`);
            process.exit(1);
        }

        // Read SQL file
        const sql = fs.readFileSync(SQL_FILE_PATH, 'utf8');

        // Connect to database
        const db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                console.error('Error opening database:', err.message);
                process.exit(1);
            }
            console.log('Connected to the SQLite database.');
        });

        // Execute SQL script
        await runAsync(db, sql);
        console.log('Database initialized successfully from setup_complete_db.sql');

        // Verify table creation
        const tables = await allAsync(db, "SELECT name FROM sqlite_master WHERE type='table';");
        console.log('Tables created:', tables.map((t) => t.name).join(', '));

        // Verify initial data
        const row = await getAsync(db, 'SELECT count(*) as count FROM business_status_workflow;');
        console.log(`Initial workflow statuses inserted: ${row.count}`);

        // Close database
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err.message);
            } else {
                console.log('Database connection closed.');
            }
        });
    } catch (err) {
        console.error('Database initialization failed:', err.message);
        process.exit(1);
    }
};

initializeDatabase();
