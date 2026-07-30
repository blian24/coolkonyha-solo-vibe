/**
 * @fileoverview Catalog Agent — Supplier and product data access layer for Coolkonyha.
 *
 * Single responsibility: all read and write operations on the `product_suppliers`
 * and `products` tables.
 * No AI logic, no business domain other than the product catalogue.
 *
 * Depends on: server/db.js (shared SQLite connection singleton)
 * Consumed by: server/routes.js
 *
 * @see docs/antigravity_db_schema.md — product_suppliers and products table schemas
 * @author Coolkonyha Development Team
 * @version 0.8.0
 */

import db from '../db.js';

// ---------------------------------------------------------------------------
// Helpers — promisified wrappers around the sqlite3 callback API
// ---------------------------------------------------------------------------

const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });

// ---------------------------------------------------------------------------
// Suppliers — Read operations
// ---------------------------------------------------------------------------

/**
 * Returns all suppliers ordered alphabetically by company name.
 * @returns {Promise<Array>}
 */
export const getSuppliers = () =>
  all('SELECT * FROM product_suppliers ORDER BY prod_supp_co');

// ---------------------------------------------------------------------------
// Suppliers — Write operations
// ---------------------------------------------------------------------------

/**
 * Creates a new product supplier.
 *
 * @param {Object} data - Supplier data
 * @param {string} data.prod_supp_co - Company name (required)
 * @param {string} [data.prod_supp_name] - Contact person
 * @param {string} [data.prod_supp_email] - Primary email
 * @param {string} [data.prod_supp_phone] - Phone number
 * @param {string} [data.prod_supp_web] - Website URL
 * @param {string} [data.notes] - Internal notes
 * @param {string} [data.logo_path] - Path to logo asset
 * @returns {Promise<{id: number}>} Created supplier ID
 * @throws {Error} When company name is missing
 */
export const createSupplier = async (data) => {
  if (!data.prod_supp_co) throw new Error('Company name is required');
  const result = await run(
    `INSERT INTO product_suppliers
       (prod_supp_co, prod_supp_name, prod_supp_email, prod_supp_phone, prod_supp_web, notes, logo_path)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.prod_supp_co,
      data.prod_supp_name || null,
      data.prod_supp_email || null,
      data.prod_supp_phone || null,
      data.prod_supp_web || null,
      data.notes || null,
      data.logo_path || null,
    ]
  );
  return { id: result.lastID };
};

/**
 * Updates a supplier record with the provided fields.
 * Only fields explicitly passed in `data` are updated — undefined fields are skipped.
 *
 * @param {number} suppId - Supplier ID (prod_supp_id in database)
 * @param {Object} data - Fields to update
 * @param {string} [data.prod_supp_co]
 * @param {string} [data.prod_supp_name]
 * @param {string} [data.prod_supp_email]
 * @param {string} [data.prod_supp_phone]
 * @param {string} [data.prod_supp_web]
 * @param {string} [data.notes]
 * @param {string} [data.logo_path]
 * @returns {Promise<{success: boolean}>}
 * @throws {Error} When no fields are provided
 *
 * @see docs/antigravity_db_schema.md — product_suppliers table
 */
export const updateSupplier = async (suppId, data) => {
  const fields = [];
  const values = [];

  if (data.prod_supp_co !== undefined) { fields.push('prod_supp_co = ?'); values.push(data.prod_supp_co); }
  if (data.prod_supp_name !== undefined) { fields.push('prod_supp_name = ?'); values.push(data.prod_supp_name); }
  if (data.prod_supp_email !== undefined) { fields.push('prod_supp_email = ?'); values.push(data.prod_supp_email); }
  if (data.prod_supp_phone !== undefined) { fields.push('prod_supp_phone = ?'); values.push(data.prod_supp_phone); }
  if (data.prod_supp_web !== undefined) { fields.push('prod_supp_web = ?'); values.push(data.prod_supp_web); }
  if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes); }
  if (data.logo_path !== undefined) { fields.push('logo_path = ?'); values.push(data.logo_path); }

  if (fields.length === 0) throw new Error('No fields to update');

  values.push(suppId);
  await run(
    `UPDATE product_suppliers SET ${fields.join(', ')} WHERE prod_supp_id = ?`,
    values
  );
  return { success: true };
};

// ---------------------------------------------------------------------------
// Products — Read operations
// ---------------------------------------------------------------------------

/**
 * Returns all products ordered alphabetically by name.
 * @returns {Promise<Array>}
 */
export const getProducts = () =>
  all('SELECT * FROM products ORDER BY prod_name');

// ---------------------------------------------------------------------------
// Products — Write operations
// ---------------------------------------------------------------------------

/**
 * Creates a new product.
 *
 * @param {Object} data - Product data
 * @param {string} data.prod_name - Product name (required)
 * @param {number} data.prod_supp_id - Supplier ID (required)
 * @param {number} data.unit_price - Base price (required)
 * @param {string} [data.prod_type] - Category/type
 * @param {string} [data.prod_size] - Size/dimensions
 * @param {string} [data.notes] - Internal notes
 * @param {string} [data.image_path] - Path to product image
 * @returns {Promise<{id: number}>} Created product ID
 * @throws {Error} When name, supplier ID, or unit price are missing
 */
export const createProduct = async (data) => {
  if (!data.prod_name || !data.prod_supp_id || data.unit_price === undefined) {
    throw new Error('Name, supplier ID, and unit price are required');
  }
  const result = await run(
    `INSERT INTO products (prod_name, prod_supp_id, unit_price, prod_type, prod_size, notes, image_path)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.prod_name,
      data.prod_supp_id,
      data.unit_price,
      data.prod_type || null,
      data.prod_size || null,
      data.notes || null,
      data.image_path || null,
    ]
  );
  return { id: result.lastID };
};

/**
 * Updates a product record with the provided fields.
 * Only fields explicitly passed in `data` are updated — undefined fields are skipped.
 *
 * @param {number} prodId - Product ID (prod_id in database)
 * @param {Object} data - Fields to update
 * @param {string} [data.prod_name]
 * @param {string} [data.prod_type]
 * @param {string} [data.prod_size]
 * @param {number} [data.unit_price]
 * @param {number} [data.prod_supp_id]
 * @param {string} [data.notes]
 * @param {string} [data.image_path]
 * @returns {Promise<{success: boolean}>}
 * @throws {Error} When no fields are provided
 *
 * @see docs/antigravity_db_schema.md — products table
 */
export const updateProduct = async (prodId, data) => {
  const fields = [];
  const values = [];

  if (data.prod_name !== undefined) { fields.push('prod_name = ?'); values.push(data.prod_name); }
  if (data.prod_type !== undefined) { fields.push('prod_type = ?'); values.push(data.prod_type); }
  if (data.prod_size !== undefined) { fields.push('prod_size = ?'); values.push(data.prod_size); }
  if (data.unit_price !== undefined) { fields.push('unit_price = ?'); values.push(data.unit_price); }
  if (data.prod_supp_id !== undefined) { fields.push('prod_supp_id = ?'); values.push(data.prod_supp_id); }
  if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes); }
  if (data.image_path !== undefined) { fields.push('image_path = ?'); values.push(data.image_path); }

  if (fields.length === 0) throw new Error('No fields to update');

  values.push(prodId);
  await run(`UPDATE products SET ${fields.join(', ')} WHERE prod_id = ?`, values);
  return { success: true };
};
