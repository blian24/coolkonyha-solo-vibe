/**
 * @fileoverview DBRobot Factory — Test-injectable version of the database robot.
 *
 * The retired `.trash/server/agent.js` (moved out of server/ 2026-09-03, no longer
 * live — see docs/assistant_team/db_robot_code_structure.md) imported a hardcoded
 * singleton DB connection. This factory re-implements the same DBRobot class but
 * accepts any db-compatible object (e.g., SandboxDb) via constructor injection,
 * enabling full sandbox isolation in tests without modifying production code.
 *
 * This still mirrors the retired agent.js implementation, not the live
 * server/robots/robot-orders.js / robot-maintenance.js — see
 * docs/.notes/future-ideas.md i-2 for the open decision to retarget it.
 *
 * @see .trash/server/agent.js — retired reference implementation
 * @see docs/assistant_team/db_robot_logic_tools.md — Business rules
 * @see docs/tests/unit-tests.md — Unit test documentation
 */

/**
 * Creates a new DBRobot instance backed by the provided database connection.
 * Mirrors the full public API of the production DBRobot singleton.
 *
 * @param {import('./sandbox-db.js').SandboxDb} db - A sandbox or real DB connection
 * @returns {object} A DBRobot-compatible instance
 */
export const createTestAgent = (db) => ({

    all(sql, params = []) {
        return db.all(sql, params);
    },

    get(sql, params = []) {
        return db.get(sql, params);
    },

    run(sql, params = []) {
        return db.run(sql, params);
    },

    // ---------------------------------------------------------
    // RULE: Dual-Write for Order Status
    // See docs/assistant_team/db_robot_logic_tools.md Section 2
    // ---------------------------------------------------------
    async updateOrderStatus(orderId, newStatus, performedBy, eventDescription) {
        const statusDef = await db.get(
            'SELECT * FROM business_status_workflow WHERE status_key = ?',
            [newStatus]
        );
        if (!statusDef) throw new Error(`Invalid Status: ${newStatus}`);

        try {
            await db.run('BEGIN TRANSACTION');
            await db.run(
                `UPDATE orders
         SET current_status = ?,
             current_status_update = CURRENT_TIMESTAMP,
             update_event = ?
         WHERE order_id = ?`,
                [newStatus, eventDescription, orderId]
            );
            await db.run(
                `INSERT INTO order_status_history (order_id, status, update_event, performed_by)
         VALUES (?, ?, ?, ?)`,
                [orderId, newStatus, eventDescription, performedBy]
            );
            await db.run('COMMIT');
            return { success: true, newStatus };
        } catch (error) {
            await db.run('ROLLBACK');
            throw error;
        }
    },

    // ---------------------------------------------------------
    // RULE: Pricing Continuity
    // See docs/assistant_team/db_robot_logic_tools.md Section 1
    // ---------------------------------------------------------
    async addOrderItem(orderId, prodId, quantity) {
        const product = await db.get(
            'SELECT unit_price FROM products WHERE prod_id = ?',
            [prodId]
        );
        if (!product) throw new Error('Product not found');

        try {
            await db.run('BEGIN TRANSACTION');

            const result = await db.run(
                `INSERT INTO order_items (order_id, prod_id, quantity, unit_price)
       VALUES (?, ?, ?, ?)`,
                [orderId, prodId, quantity, product.unit_price]
            );

            await db.run(
                `UPDATE orders
       SET total_amount = (
         SELECT SUM(quantity * unit_price)
         FROM order_items
         WHERE order_id = ?
       )
       WHERE order_id = ?`,
                [orderId, orderId]
            );

            await db.run('COMMIT');
            return { id: result.lastID };
        } catch (error) {
            await db.run('ROLLBACK');
            throw error;
        }
    },

    async createOrder(custId, currency = 'HUF') {
        try {
            await db.run('BEGIN TRANSACTION');

            const result = await db.run(
                `INSERT INTO orders (cust_id, current_status, update_event, currency)
       VALUES (?, 'NEW', 'Order created via API', ?)`,
                [custId, currency]
            );
            await db.run(
                `INSERT INTO order_status_history (order_id, status, update_event, performed_by)
       VALUES (?, 'NEW', 'Order Initialized', 'SYSTEM')`,
                [result.lastID]
            );

            await db.run('COMMIT');
            return { orderId: result.lastID };
        } catch (error) {
            await db.run('ROLLBACK');
            throw error;
        }
    },

    async getOrders() {
        return db.all('SELECT * FROM orders ORDER BY order_date DESC');
    },

    async getOrderDetails(orderId) {
        const order = await db.get('SELECT * FROM orders WHERE order_id = ?', [orderId]);
        const items = await db.all(
            `SELECT oi.*, p.prod_name
       FROM order_items oi
       JOIN products p ON oi.prod_id = p.prod_id
       WHERE oi.order_id = ?`,
            [orderId]
        );
        const history = await db.all(
            'SELECT * FROM order_status_history WHERE order_id = ? ORDER BY update_date DESC',
            [orderId]
        );
        return { order, items, history };
    },

    async getCustomers() {
        return db.all('SELECT * FROM customers ORDER BY cust_name');
    },

    async getSuppliers() {
        return db.all('SELECT * FROM product_suppliers ORDER BY prod_supp_co');
    },

    async getProducts() {
        return db.all('SELECT * FROM products ORDER BY prod_name');
    },

    async getWorkflowStatuses() {
        return db.all('SELECT * FROM business_status_workflow ORDER BY status_id');
    },

    async updateCustomer(custId, data) {
        const fields = [];
        const values = [];
        const ALLOWED_FIELDS = [
            'cust_name', 'cust_contact', 'cust_email', 'cust_email2',
            'cust_phone', 'cust_web', 'notes', 'logo_path',
        ];
        for (const field of ALLOWED_FIELDS) {
            if (data[field] !== undefined) {
                fields.push(`${field} = ?`);
                values.push(data[field]);
            }
        }
        if (fields.length === 0) throw new Error('No fields to update');
        values.push(custId);
        await db.run(`UPDATE customers SET ${fields.join(', ')} WHERE cust_id = ?`, values);
        return { success: true };
    },

    async updateSupplier(suppId, data) {
        const fields = [];
        const values = [];
        const ALLOWED_FIELDS = [
            'prod_supp_co', 'prod_supp_name', 'prod_supp_email',
            'prod_supp_phone', 'prod_supp_web', 'notes', 'logo_path',
        ];
        for (const field of ALLOWED_FIELDS) {
            if (data[field] !== undefined) {
                fields.push(`${field} = ?`);
                values.push(data[field]);
            }
        }
        if (fields.length === 0) throw new Error('No fields to update');
        values.push(suppId);
        await db.run(
            `UPDATE product_suppliers SET ${fields.join(', ')} WHERE prod_supp_id = ?`,
            values
        );
        return { success: true };
    },

    async updateProduct(prodId, data) {
        const fields = [];
        const values = [];
        const ALLOWED_FIELDS = [
            'prod_name', 'prod_type', 'prod_size', 'unit_price',
            'prod_supp_id', 'notes', 'image_path',
        ];
        for (const field of ALLOWED_FIELDS) {
            if (data[field] !== undefined) {
                fields.push(`${field} = ?`);
                values.push(data[field]);
            }
        }
        if (fields.length === 0) throw new Error('No fields to update');
        values.push(prodId);
        await db.run(`UPDATE products SET ${fields.join(', ')} WHERE prod_id = ?`, values);
        return { success: true };
    },
});
