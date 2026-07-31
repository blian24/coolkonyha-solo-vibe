/**
 * @fileoverview CRM Robot — Customer data access layer for Coolkonyha.
 *
 * Single responsibility: all read and write operations on the `customers` table.
 * Deterministic robot — no AI logic.
 *
 * Depends on: server/db.js (shared SQLite connection singleton)
 * Consumed by: server/routes.js, server/robots/robot-pista-db.js (via email-robot context)
 *
 * @see docs/assistant_team/db_robot_logic_tools.md — Business rules documentation
 * @see docs/architecture/database-schema.md — customers table schema
 * @author Coolkonyha Development Team
 * @version 0.9.0
 */

import db from '../db.js';

// ---------------------------------------------------------------------------
// Helpers — promisified wrappers around the sqlite3 callback API
// ---------------------------------------------------------------------------

/**
 * Fetches multiple rows.
 * @param {string} sql
 * @param {Array} [params=[]]
 * @returns {Promise<Array>}
 */
const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

/**
 * Fetches a single row.
 * @param {string} sql
 * @param {Array} [params=[]]
 * @returns {Promise<Object|undefined>}
 */
const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

/**
 * Executes an INSERT / UPDATE / DELETE.
 * @param {string} sql
 * @param {Array} [params=[]]
 * @returns {Promise<Object>} Result with lastID and changes
 */
const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });

// ---------------------------------------------------------------------------
// CRM — Read operations
// ---------------------------------------------------------------------------

/**
 * Returns all customers ordered alphabetically by name.
 * @returns {Promise<Array>}
 */
export const getCustomers = () =>
  all('SELECT * FROM customers ORDER BY cust_name');

/**
 * Finds a single customer by their primary or secondary email address.
 * Used by pista.js and email-robot.js to match incoming emails to CRM records.
 *
 * @param {string} email - Email address to search for
 * @returns {Promise<Object|undefined>}
 */
export const getCustomerByEmail = (email) =>
  get(
    'SELECT * FROM customers WHERE cust_email = ? OR cust_email2 = ?',
    [email, email]
  );

// ---------------------------------------------------------------------------
// CRM — Write operations
// ---------------------------------------------------------------------------

/**
 * Creates a new customer record.
 *
 * @param {Object} data - Customer data
 * @param {string} data.cust_name - Customer name (required)
 * @param {string} data.cust_email - Primary email (required)
 * @param {string} [data.cust_contact] - Contact person
 * @param {string} [data.cust_phone] - Phone number
 * @param {string} [data.cust_web] - Website URL
 * @param {string} [data.notes] - Internal notes
 * @param {string} [data.logo_path] - Path to logo asset
 * @returns {Promise<{id: number}>} Created customer ID
 * @throws {Error} When name or email are missing
 */
export const createCustomer = async (data) => {
  if (!data.cust_name || !data.cust_email) {
    throw new Error('Name and email are required');
  }
  const result = await run(
    `INSERT INTO customers (cust_name, cust_contact, cust_email, cust_phone, cust_web, notes, logo_path)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.cust_name,
      data.cust_contact || null,
      data.cust_email,
      data.cust_phone || null,
      data.cust_web || null,
      data.notes || null,
      data.logo_path || null,
    ]
  );
  return { id: result.lastID };
};

/**
 * Updates a customer record with the provided fields.
 * Only fields explicitly passed in `data` are updated — undefined fields are skipped.
 *
 * @param {number} custId - Customer ID (cust_id in database)
 * @param {Object} data - Fields to update
 * @param {string} [data.cust_name]
 * @param {string} [data.cust_contact]
 * @param {string} [data.cust_email]
 * @param {string} [data.cust_email2]
 * @param {string} [data.cust_phone]
 * @param {string} [data.cust_web]
 * @param {string} [data.notes]
 * @param {string} [data.logo_path]
 * @returns {Promise<{success: boolean}>}
 * @throws {Error} When no fields are provided
 *
 * @see docs/antigravity_db_schema.md — customers table
 */
export const updateCustomer = async (custId, data) => {
  const fields = [];
  const values = [];

  if (data.cust_name !== undefined) { fields.push('cust_name = ?'); values.push(data.cust_name); }
  if (data.cust_contact !== undefined) { fields.push('cust_contact = ?'); values.push(data.cust_contact); }
  if (data.cust_email !== undefined) { fields.push('cust_email = ?'); values.push(data.cust_email); }
  if (data.cust_email2 !== undefined) { fields.push('cust_email2 = ?'); values.push(data.cust_email2); }
  if (data.cust_phone !== undefined) { fields.push('cust_phone = ?'); values.push(data.cust_phone); }
  if (data.cust_web !== undefined) { fields.push('cust_web = ?'); values.push(data.cust_web); }
  if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes); }
  if (data.logo_path !== undefined) { fields.push('logo_path = ?'); values.push(data.logo_path); }

  if (fields.length === 0) throw new Error('No fields to update');

  values.push(custId);
  await run(`UPDATE customers SET ${fields.join(', ')} WHERE cust_id = ?`, values);
  return { success: true };
};
