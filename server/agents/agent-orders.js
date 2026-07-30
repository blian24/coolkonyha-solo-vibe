/**
 * @fileoverview Orders Agent — Order lifecycle data access layer for Coolkonyha.
 *
 * Single responsibility: all read and write operations on the orders domain:
 * `orders`, `order_items`, `order_status_history`, and `order_status_workflow`.
 *
 * Business rules enforced:
 * - **Pricing Continuity:** Order items freeze the product price at order creation time.
 * - **Dual-Write Status:** Order status updates atomically write to both `orders`
 *   (current state) and `order_status_history` (audit log).
 *
 * Depends on: server/db.js (shared SQLite connection singleton)
 * Consumed by: server/routes.js, server/pista.js
 *
 * @see docs/assistant_team/db_robot_logic_tools.md — Business rules (Sections 1 & 2)
 * @see docs/architecture/database-schema.md — orders domain schema
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

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
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
// Orders — Workflow
// ---------------------------------------------------------------------------

/**
 * Returns all valid order workflow statuses.
 * @returns {Promise<Array>}
 */
export const getWorkflowStatuses = () =>
  all('SELECT * FROM order_status_workflow ORDER BY status_id');

// ---------------------------------------------------------------------------
// Orders — Read operations
// ---------------------------------------------------------------------------

/**
 * Returns all orders sorted by date descending.
 * @returns {Promise<Array>}
 */
export const getOrders = () =>
  all('SELECT * FROM orders ORDER BY order_date DESC');

/**
 * Retrieves complete order details including items and status history.
 *
 * @param {number} orderId - Order ID to fetch
 * @returns {Promise<{order: Object, items: Array, history: Array}>}
 */
export const getOrderDetails = async (orderId) => {
  const order = await get(
    `SELECT o.*, c.cust_name, c.logo_path
     FROM orders o
     JOIN customers c ON o.cust_id = c.cust_id
     WHERE o.order_id = ?`,
    [orderId]
  );

  const items = await all(
    `SELECT oi.*, p.prod_name
     FROM order_items oi
     JOIN products p ON oi.prod_id = p.prod_id
     WHERE oi.order_id = ?`,
    [orderId]
  );

  const history = await all(
    'SELECT * FROM order_status_history WHERE order_id = ? ORDER BY update_date DESC',
    [orderId]
  );

  return { order, items, history };
};

/**
 * Returns all active (non-closed, non-cancelled) orders joined with customer name.
 * Used by pista.js as broad business context for chat interactions.
 *
 * @returns {Promise<Array>}
 */
export const getActiveOrders = () =>
  all(
    `SELECT o.*, c.cust_name FROM orders o
     JOIN customers c ON o.cust_id = c.cust_id
     WHERE o.current_status NOT IN ('CLOSED', 'CANCELLED')
     ORDER BY o.current_status_update ASC`
  );

/**
 * Returns orders belonging to a specific customer.
 * Used by pista.js to build email context for a known sender.
 *
 * @param {number} custId - Customer ID
 * @returns {Promise<Array>}
 */
export const getOrdersByCustomer = (custId) =>
  all(
    `SELECT o.*,
      (SELECT json_group_array(json_object(
         'prod_name', p.prod_name, 'quantity', oi.quantity, 'unit_price', oi.unit_price))
       FROM order_items oi JOIN products p ON oi.prod_id = p.prod_id
       WHERE oi.order_id = o.order_id) AS items,
      (SELECT json_group_array(json_object(
         'status', h.status, 'update_event', h.update_event, 'update_date', h.update_date))
       FROM order_status_history h
       WHERE h.order_id = o.order_id ORDER BY h.update_date DESC LIMIT 5) AS recent_history
     FROM orders o
     WHERE o.cust_id = ?
     ORDER BY o.current_status_update DESC`,
    [custId]
  );

// ---------------------------------------------------------------------------
// Orders — Write operations
// ---------------------------------------------------------------------------

/**
 * Creates a new order with initial NEW status.
 *
 * Implements the Dual-Write pattern: inserts into `orders` and logs the initial
 * status to `order_status_history` within a single transaction.
 *
 * @param {number} custId - Customer ID from customers table
 * @param {string} [currency='HUF'] - Currency code
 * @returns {Promise<{orderId: number}>} Created order ID
 * @throws {Error} When transaction fails
 */
export const createOrder = async (custId, currency = 'HUF') => {
  try {
    await run('BEGIN TRANSACTION');

    const result = await run(
      `INSERT INTO orders (cust_id, current_status, update_event, currency)
       VALUES (?, 'NEW', 'Order created via API', ?)`,
      [custId, currency]
    );

    // Generate order_code (4 letters + 5 digits)
    const customer = await get('SELECT cust_name FROM customers WHERE cust_id = ?', [custId]);
    const cleanName = customer ? customer.cust_name.replace(/[^a-zA-Z]/g, '').toUpperCase() : 'UNKN';
    const prefix = (cleanName + 'XXXX').substring(0, 4);
    const idStr = String(result.lastID).padStart(5, '0');
    const orderCode = `${prefix}-${idStr}`;

    await run('UPDATE orders SET order_code = ? WHERE order_id = ?', [orderCode, result.lastID]);

    // Initial history log — must succeed together with the order row
    await run(
      `INSERT INTO order_status_history (order_id, status, update_event, performed_by)
       VALUES (?, 'NEW', 'Order Initialized', 'SYSTEM')`,
      [result.lastID]
    );

    await run('COMMIT');
    return { orderId: result.lastID };
  } catch (error) {
    await run('ROLLBACK');
    throw error;
  }
};

// ---------------------------------------------------------
// RULE: Pricing Continuity
// See docs/assistant_team/db_robot_logic_tools.md Section 1
// ---------------------------------------------------------
/**
 * Adds an item to an order with frozen pricing.
 *
 * Implements the Pricing Continuity rule by copying the current product price
 * into order_items.unit_price, preventing retroactive price changes from
 * affecting historical orders.
 *
 * @param {number} orderId - Order ID to add item to
 * @param {number} prodId - Product ID from products table
 * @param {number} quantity - Quantity to order
 * @returns {Promise<{id: number}>} Created order item ID
 * @throws {Error} When product not found
 *
 * @see docs/assistant_team/db_robot_logic_tools.md Section 1
 */
export const addOrderItem = async (orderId, prodId, quantity) => {
  // 1. Fetch current product price (outside transaction — read-only)
  const product = await get('SELECT unit_price FROM products WHERE prod_id = ?', [prodId]);
  if (!product) throw new Error('Product not found');

  try {
    await run('BEGIN TRANSACTION');

    // 2. Insert with FROZEN price
    const result = await run(
      `INSERT INTO order_items (order_id, prod_id, quantity, unit_price) VALUES (?, ?, ?, ?)`,
      [orderId, prodId, quantity, product.unit_price]
    );

    // 3. Recalculate order total to ensure consistency
    await run(
      `UPDATE orders
       SET total_amount = (SELECT SUM(quantity * unit_price) FROM order_items WHERE order_id = ?)
       WHERE order_id = ?`,
      [orderId, orderId]
    );

    await run('COMMIT');
    return { id: result.lastID };
  } catch (error) {
    await run('ROLLBACK');
    throw error;
  }
};

// ---------------------------------------------------------
// RULE: Dual-Write for Order Status
// See docs/assistant_team/db_robot_logic_tools.md Section 2
// ---------------------------------------------------------
/**
 * Updates an order's status with dual-write pattern for data consistency.
 *
 * Atomically updates both the orders table (current state) and
 * order_status_history table (audit log) within a transaction.
 *
 * @param {number} orderId - Order ID to update
 * @param {string} newStatus - Status key from order_status_workflow table
 * @param {string} performedBy - Username or system identifier (e.g., 'SYSTEM', 'admin')
 * @param {string} eventDescription - Human-readable event description
 * @returns {Promise<{success: boolean, newStatus: string}>}
 * @throws {Error} When status is invalid or transaction fails
 *
 * @see docs/assistant_team/db_robot_logic_tools.md Section 2
 */
export const updateOrderStatus = async (orderId, newStatus, performedBy, eventDescription) => {
  // 1. Validate Status
  const statusDef = await get(
    'SELECT * FROM order_status_workflow WHERE status_key = ?',
    [newStatus]
  );
  if (!statusDef) throw new Error(`Invalid Status: ${newStatus}`);

  try {
    await run('BEGIN TRANSACTION');

    // 2. Update orders table
    await run(
      `UPDATE orders
       SET current_status = ?,
           current_status_update = CURRENT_TIMESTAMP,
           update_event = ?
       WHERE order_id = ?`,
      [newStatus, eventDescription, orderId]
    );

    // 3. Insert into order_status_history
    await run(
      `INSERT INTO order_status_history (order_id, status, update_event, performed_by)
       VALUES (?, ?, ?, ?)`,
      [orderId, newStatus, eventDescription, performedBy]
    );

    await run('COMMIT');
    return { success: true, newStatus };
  } catch (error) {
    await run('ROLLBACK');
    throw error;
  }
};

// ---------------------------------------------------------------------------
// Orders — Database viewer getters (added v0.7.0)
// ---------------------------------------------------------------------------

/**
 * Returns all order items joined with product name and order code.
 * Used by the database viewer UI.
 *
 * @returns {Promise<Array>}
 */
export const getAllOrderItems = () =>
  all(
    `SELECT oi.*, p.prod_name, o.order_code
     FROM order_items oi
     JOIN products p ON oi.prod_id = p.prod_id
     JOIN orders o ON oi.order_id = o.order_id
     ORDER BY o.order_code, oi.order_item_id`
  );

/**
 * Returns the full order status history joined with order codes.
 * Used by the database viewer UI.
 *
 * @returns {Promise<Array>}
 */
export const getOrderStatusHistory = () =>
  all(
    `SELECT osh.*, o.order_code
     FROM order_status_history osh
     JOIN orders o ON osh.order_id = o.order_id
     ORDER BY osh.update_date DESC`
  );
