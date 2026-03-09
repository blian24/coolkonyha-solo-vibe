/**
 * @fileoverview Database Robot - Centralized data access layer for Coolkonyha.
 *
 * This is a deterministic Robot (no AI). It enforces business rules mechanically:
 * - **Pricing Continuity:** Order items freeze product prices at order time
 * - **Dual-Write Status:** Order status updates write to both orders table and history
 * - **Transaction Safety:** Critical operations use SQLite transactions
 *
 * All database operations are promisified for async/await usage.
 *
 * @see docs/agent_logics/db_robot_logic_tools.md - Business rules documentation
 * @see docs/architecture/database-schema.md - Database schema
 * @author Coolkonyha Development Team
 * @version 1.1.0
 */
import db from './db.js';

class DBRobot {
    /**
     * Promisified wrapper for db.all() to fetch multiple rows.
     * 
     * @param {string} sql - SQL query string
     * @param {Array} [params=[]] - Query parameters
     * @returns {Promise<Array>} Array of result rows
     */
    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    /**
     * Promisified wrapper for db.get() to fetch a single row.
     * 
     * @param {string} sql - SQL query string
     * @param {Array} [params=[]] - Query parameters
     * @returns {Promise<Object|undefined>} Single result row or undefined
     */
    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    /**
     * Promisified wrapper for db.run() for INSERT/UPDATE/DELETE operations.
     * 
     * @param {string} sql - SQL query string
     * @param {Array} [params=[]] - Query parameters
     * @returns {Promise<Object>} Result with lastID and changes properties
     */
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    }

    // ---------------------------------------------------------
    // RULE: Dual-Write for Order Status
    // See docs/agent_logics/db_robot_logic_tools.md Section 2
    // ---------------------------------------------------------
    /**
     * Updates an order's status with dual-write pattern for data consistency.
     * 
     * Implements the dual-write pattern by updating both the orders table
     * (current state) and order_status_history table (audit log) within a transaction.
     * 
     * @param {number} orderId - Order ID to update
     * @param {string} newStatus - Status key from business_status_workflow table
     * @param {string} performedBy - Username or system identifier (e.g., 'SYSTEM', 'admin')
     * @param {string} eventDescription - Human-readable event description
     * @returns {Promise<{success: boolean, newStatus: string}>}
     * @throws {Error} When status is invalid or transaction fails
     * 
     * @see docs/agent_logics/db_robot_logic_tools.md Section 2
     * 
     * @example
     * await dbAgent.updateOrderStatus(123, 'PROCESSING', 'admin', 'Payment confirmed');
     */
    async updateOrderStatus(orderId, newStatus, performedBy, eventDescription) {
        // Enforce Transaction (rudimentary via serial execution logic closer to DB if needed,
        // but for SQLite single-writer, sequential calls are acceptable for this prototype)

        // 1. Validate Status (Section 3 rule)
        const statusDef = await this.get(
            'SELECT * FROM business_status_workflow WHERE status_key = ?',
            [newStatus]
        );
        if (!statusDef) {
            throw new Error(`Invalid Status: ${newStatus}`);
        }

        try {
            await this.run('BEGIN TRANSACTION');

            // 2. Update orders table
            // "The update_event in the orders table should be a single, clear sentence"
            await this.run(`
        UPDATE orders
        SET current_status = ?,
            current_status_update = CURRENT_TIMESTAMP,
            update_event = ?
        WHERE order_id = ?
      `, [newStatus, eventDescription, orderId]);

            // 3. Insert into order_status_history
            // "Depth: include technical or contextual details if available"
            // Using same description, but allows for divergence if API provides more detail
            await this.run(`
        INSERT INTO order_status_history (order_id, status, update_event, performed_by)
        VALUES (?, ?, ?, ?)
      `, [orderId, newStatus, eventDescription, performedBy]);

            await this.run('COMMIT');
            return { success: true, newStatus };
        } catch (error) {
            await this.run('ROLLBACK');
            throw error;
        }
    }

    // ---------------------------------------------------------
    // RULE: Pricing Continuity
    // See docs/agent_logics/db_robot_logic_tools.md Section 1
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
     * @see docs/agent_logics/db_robot_logic_tools.md Section 1
     */
    async addOrderItem(orderId, prodId, quantity) {
        // 1. Fetch current product price (outside transaction — read-only)
        const product = await this.get(
            'SELECT unit_price FROM products WHERE prod_id = ?',
            [prodId]
        );
        if (!product) throw new Error('Product not found');

        try {
            await this.run('BEGIN TRANSACTION');

            // 2. Insert with FROZEN price
            const result = await this.run(`
      INSERT INTO order_items (order_id, prod_id, quantity, unit_price)
      VALUES (?, ?, ?, ?)
    `, [orderId, prodId, quantity, product.unit_price]);

            // 3. Update Order Total (Section 1 rule)
            // Recalculate full total to ensure consistency
            await this.run(`
      UPDATE orders
      SET total_amount = (
        SELECT SUM(quantity * unit_price)
        FROM order_items
        WHERE order_id = ?
      )
      WHERE order_id = ?
    `, [orderId, orderId]);

            await this.run('COMMIT');
            return { id: result.lastID };
        } catch (error) {
            await this.run('ROLLBACK');
            throw error;
        }
    }

    /**
     * Creates a new order with initial NEW status.
     * 
     * @param {number} custId - Customer ID from customers table
     * @param {string} [currency='HUF'] - Currency code (default: HUF)
     * @returns {Promise<{orderId: number}>} Created order ID
     */
    async createOrder(custId, currency = 'HUF') {
        try {
            await this.run('BEGIN TRANSACTION');

            const result = await this.run(`
      INSERT INTO orders (cust_id, current_status, update_event, currency)
      VALUES (?, 'NEW', 'Order created via API', ?)
    `, [custId, currency]);

            // Initial history log — must succeed together with the order row
            await this.run(`
      INSERT INTO order_status_history (order_id, status, update_event, performed_by)
      VALUES (?, 'NEW', 'Order Initialized', 'SYSTEM')
    `, [result.lastID]);

            await this.run('COMMIT');
            return { orderId: result.lastID };
        } catch (error) {
            await this.run('ROLLBACK');
            throw error;
        }
    }

    async getOrders() {
        return await this.all('SELECT * FROM orders ORDER BY order_date DESC');
    }

    /**
     * Retrieves complete order details including items and status history.
     * 
     * @param {number} orderId - Order ID to fetch
     * @returns {Promise<{order: Object, items: Array, history: Array}>}
     */
    async getOrderDetails(orderId) {
        const order = await this.get(
            'SELECT * FROM orders WHERE order_id = ?',
            [orderId]
        );
        const items = await this.all(`
      SELECT oi.*, p.prod_name
      FROM order_items oi
      JOIN products p ON oi.prod_id = p.prod_id
      WHERE oi.order_id = ?
    `, [orderId]);
        const history = await this.all(
            'SELECT * FROM order_status_history WHERE order_id = ? ORDER BY update_date DESC',
            [orderId]
        );

        return { order, items, history };
    }

    async getCustomers() {
        return await this.all('SELECT * FROM customers ORDER BY cust_name');
    }

    async getSuppliers() {
        return await this.all('SELECT * FROM product_suppliers ORDER BY prod_supp_co');
    }

    async getProducts() {
        return await this.all('SELECT * FROM products ORDER BY prod_name');
    }

    async getWorkflowStatuses() {
        return await this.all('SELECT * FROM business_status_workflow ORDER BY status_id');
    }

    /**
     * Updates customer record with provided fields.
     * 
     * @param {number} custId - Customer ID (cust_id in database)
     * @param {Object} data - Fields to update
     * @param {string} [data.cust_name] - Customer name
     * @param {string} [data.cust_contact] - Contact person
     * @param {string} [data.cust_email] - Primary email
     * @param {string} [data.cust_email2] - Secondary email
     * @param {string} [data.cust_phone] - Phone number
     * @param {string} [data.cust_web] - Website URL
     * @param {string} [data.notes] - Freetext notes (added 2026-02-07)
     * @param {string} [data.logo_path] - Path to customer logo (added 2026-02-07)
     * @returns {Promise<{success: boolean}>}
     * @throws {Error} When no fields provided to update
     * 
     * @see docs/antigravity_db_schema.md - customers table
     */
    async updateCustomer(custId, data) {
        const fields = [];
        const values = [];

        if (data.cust_name !== undefined) {
            fields.push('cust_name = ?');
            values.push(data.cust_name);
        }
        if (data.cust_contact !== undefined) {
            fields.push('cust_contact = ?');
            values.push(data.cust_contact);
        }
        if (data.cust_email !== undefined) {
            fields.push('cust_email = ?');
            values.push(data.cust_email);
        }
        if (data.cust_email2 !== undefined) {
            fields.push('cust_email2 = ?');
            values.push(data.cust_email2);
        }
        if (data.cust_phone !== undefined) {
            fields.push('cust_phone = ?');
            values.push(data.cust_phone);
        }
        if (data.cust_web !== undefined) {
            fields.push('cust_web = ?');
            values.push(data.cust_web);
        }
        if (data.notes !== undefined) {
            fields.push('notes = ?');
            values.push(data.notes);
        }
        if (data.logo_path !== undefined) {
            fields.push('logo_path = ?');
            values.push(data.logo_path);
        }

        if (fields.length === 0) {
            throw new Error('No fields to update');
        }

        values.push(custId);
        await this.run(`UPDATE customers SET ${fields.join(', ')} WHERE cust_id = ?`, values);
        return { success: true };
    }

    /**
     * Updates supplier record with provided fields.
     * 
     * @param {number} suppId - Supplier ID (prod_supp_id in database)
     * @param {Object} data - Fields to update
     * @param {string} [data.prod_supp_co] - Supplier company name
     * @param {string} [data.prod_supp_name] - Contact person
     * @param {string} [data.prod_supp_email] - Primary email
     * @param {string} [data.prod_supp_phone] - Phone number
     * @param {string} [data.prod_supp_web] - Website URL
     * @param {string} [data.notes] - Freetext notes (added 2026-02-07)
     * @param {string} [data.logo_path] - Path to supplier logo (added 2026-02-07)
     * @returns {Promise<{success: boolean}>}
     * @throws {Error} When no fields provided to update
     * 
     * @see docs/antigravity_db_schema.md - product_suppliers table
     */
    async updateSupplier(suppId, data) {
        const fields = [];
        const values = [];

        if (data.prod_supp_co !== undefined) {
            fields.push('prod_supp_co = ?');
            values.push(data.prod_supp_co);
        }
        if (data.prod_supp_name !== undefined) {
            fields.push('prod_supp_name = ?');
            values.push(data.prod_supp_name);
        }
        if (data.prod_supp_email !== undefined) {
            fields.push('prod_supp_email = ?');
            values.push(data.prod_supp_email);
        }
        if (data.prod_supp_phone !== undefined) {
            fields.push('prod_supp_phone = ?');
            values.push(data.prod_supp_phone);
        }
        if (data.prod_supp_web !== undefined) {
            fields.push('prod_supp_web = ?');
            values.push(data.prod_supp_web);
        }
        if (data.notes !== undefined) {
            fields.push('notes = ?');
            values.push(data.notes);
        }
        if (data.logo_path !== undefined) {
            fields.push('logo_path = ?');
            values.push(data.logo_path);
        }

        if (fields.length === 0) {
            throw new Error('No fields to update');
        }

        values.push(suppId);
        await this.run(
            `UPDATE product_suppliers SET ${fields.join(', ')} WHERE prod_supp_id = ?`,
            values
        );
        return { success: true };
    }

    /**
     * Updates product record with provided fields.
     * 
     * @param {number} prodId - Product ID (prod_id in database)
     * @param {Object} data - Fields to update
     * @param {string} [data.prod_name] - Product name
     * @param {string} [data.prod_type] - Product type/category
     * @param {string} [data.prod_size] - Product size/dimensions
     * @param {number} [data.unit_price] - Unit price
     * @param {number} [data.prod_supp_id] - Supplier ID
     * @param {string} [data.notes] - Freetext notes (added 2026-02-07)
     * @param {string} [data.image_path] - Path to product image (added 2026-02-07)
     * @returns {Promise<{success: boolean}>}
     * @throws {Error} When no fields provided to update
     * 
     * @see docs/antigravity_db_schema.md - products table
     */
    async updateProduct(prodId, data) {
        const fields = [];
        const values = [];

        if (data.prod_name !== undefined) {
            fields.push('prod_name = ?');
            values.push(data.prod_name);
        }
        if (data.prod_type !== undefined) {
            fields.push('prod_type = ?');
            values.push(data.prod_type);
        }
        if (data.prod_size !== undefined) {
            fields.push('prod_size = ?');
            values.push(data.prod_size);
        }
        if (data.unit_price !== undefined) {
            fields.push('unit_price = ?');
            values.push(data.unit_price);
        }
        if (data.prod_supp_id !== undefined) {
            fields.push('prod_supp_id = ?');
            values.push(data.prod_supp_id);
        }
        if (data.notes !== undefined) {
            fields.push('notes = ?');
            values.push(data.notes);
        }
        if (data.image_path !== undefined) {
            fields.push('image_path = ?');
            values.push(data.image_path);
        }

        if (fields.length === 0) {
            throw new Error('No fields to update');
        }

        values.push(prodId);
        await this.run(`UPDATE products SET ${fields.join(', ')} WHERE prod_id = ?`, values);
        return { success: true };
    }
}

export default new DBRobot();
