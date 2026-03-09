/**
 * @fileoverview Sandbox DB — Isolated in-memory SQLite database for testing.
 *
 * Creates a fresh SQLite database in memory for each test run.
 * The full schema and workflow seed data are applied automatically,
 * so tests always have a realistic but completely clean environment.
 *
 * IMPORTANT: This helper never touches coolkonyha.db (the production database).
 *
 * @see docs/tests/README.md — Test Agent overview
 * @see docs/setup_complete_db.sql — Schema source of truth
 */

import sqlite3 from 'sqlite3';

// ---------------------------------------------------------------
// RULE: Full schema, copied from docs/setup_complete_db.sql
// Kept inline so the sandbox has zero dependency on the FS path.
// If the schema changes, update this block AND the SQL file.
// ---------------------------------------------------------------
const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE customers (
  cust_id INTEGER PRIMARY KEY AUTOINCREMENT,
  cust_name TEXT NOT NULL,
  cust_contact TEXT,
  cust_email TEXT NOT NULL,
  cust_email2 TEXT,
  cust_phone TEXT,
  cust_web TEXT,
  cust_note TEXT,
  notes TEXT,
  logo_path TEXT,
  cust_reg_date DATE DEFAULT CURRENT_DATE
);

CREATE TABLE product_suppliers (
  prod_supp_id INTEGER PRIMARY KEY AUTOINCREMENT,
  prod_supp_co TEXT NOT NULL,
  prod_supp_name TEXT,
  prod_supp_email TEXT,
  prod_supp_phone TEXT,
  prod_supp_web TEXT,
  prod_supp_note TEXT,
  notes TEXT,
  logo_path TEXT,
  prod_supp_reg_date DATE DEFAULT CURRENT_DATE
);

CREATE TABLE products (
  prod_id INTEGER PRIMARY KEY AUTOINCREMENT,
  prod_name TEXT NOT NULL,
  prod_type TEXT,
  prod_size TEXT,
  prod_note TEXT,
  notes TEXT,
  image_path TEXT,
  prod_reg_date DATE DEFAULT CURRENT_DATE,
  prod_supp_id INTEGER,
  unit_price NUMERIC(10,2),
  FOREIGN KEY (prod_supp_id) REFERENCES product_suppliers(prod_supp_id)
);

CREATE TABLE orders (
  order_id INTEGER PRIMARY KEY AUTOINCREMENT,
  cust_id INTEGER NOT NULL,
  order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  total_amount NUMERIC(12,2),
  current_status TEXT,
  current_status_update DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_event TEXT,
  currency TEXT DEFAULT 'HUF',
  FOREIGN KEY (cust_id) REFERENCES customers(cust_id)
);

CREATE TABLE order_items (
  order_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  prod_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(order_id),
  FOREIGN KEY (prod_id) REFERENCES products(prod_id)
);

CREATE TABLE order_status_history (
  history_id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  update_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_event TEXT,
  performed_by TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

CREATE TABLE business_status_workflow (
  status_id INTEGER PRIMARY KEY AUTOINCREMENT,
  status_key TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  is_skippable BOOLEAN DEFAULT FALSE
);

INSERT INTO business_status_workflow (status_key, display_name, description, is_skippable) VALUES
('NEW', 'New', 'Inquiry received, no human action yet.', 0),
('OFFER_SENT', 'Offer Sent', 'Quote sent, waiting for customer.', 0),
('ORDER_CONFIRMED', 'Order Confirmed', 'Binding order accepted.', 0),
('PURCHASE', 'Purchase', 'Ordering from supplier.', 1),
('READY_FOR_DELIVERY', 'Ready for Delivery', 'Packed and waiting.', 0),
('DELIVERY', 'Delivery', 'Handed over to courier.', 0),
('DELIVERED', 'Delivered', 'Left warehouse / In transit.', 0),
('INVOICED', 'Invoiced', 'Invoice sent, awaiting payment.', 0),
('CLOSED', 'Closed', 'Transaction successful.', 0),
('CANCELLED', 'Cancelled', 'Deal failed.', 0);

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

/**
 * Wraps a raw sqlite3.Database with promise-based helpers matching the
 * DBRobot interface so tests can use the same patterns.
 */
export class SandboxDb {
    /** @param {sqlite3.Database} rawDb */
    constructor(rawDb) {
        this._db = rawDb;
    }

    /** @returns {sqlite3.Database} The raw sqlite3 connection */
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

    close() {
        return new Promise((resolve, reject) => {
            this._db.close((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
}

/**
 * Creates a fresh, isolated in-memory SQLite database with the full schema
 * and seed workflow data applied. Safe to use in parallel test suites because
 * each call returns a completely independent database instance.
 *
 * The production `coolkonyha.db` file is never opened or modified.
 *
 * @returns {Promise<SandboxDb>} A ready-to-use sandbox database instance
 */
export const createSandboxDb = () => new Promise((resolve, reject) => {
    const rawDb = new sqlite3.Database(':memory:', (connectErr) => {
        if (connectErr) {
            reject(new Error(`Sandbox DB connect failed: ${connectErr.message}`));
            return;
        }

        rawDb.exec(SCHEMA_SQL, (schemaErr) => {
            if (schemaErr) {
                reject(new Error(`Sandbox schema init failed: ${schemaErr.message}`));
                return;
            }
            resolve(new SandboxDb(rawDb));
        });
    });
});
