/**
 * @fileoverview Database Robot - Centralized data access layer for Coolkonyha.
 *
 * This is a deterministic Robot (no AI). It enforces business rules mechanically:
 * - **Pricing Continuity:** Order items freeze product prices at order time
 * - **Dual-Write Status:** Order status updates write to both orders table and history
 * - **Dual-Write Status (Maintenance):** Maintenance status updates mirror the same pattern
 * - **Transaction Safety:** Critical operations use SQLite transactions
 *
 * Domains:
 * - Orders: uses order_status_workflow (renamed from business_status_workflow in v0.6.0)
 * - Maintenance: uses maintenance_status_workflow (fully independent state machine)
 *
 * All database operations are promisified for async/await usage.
 *
 * @see docs/assistant_team/db_robot_logic_tools.md - Business rules documentation
 * @see docs/architecture/database-schema.md - Database schema
 * @author Coolkonyha Development Team
 * @version 1.2.0
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
    // See docs/assistant_team/db_robot_logic_tools.md Section 2
    // ---------------------------------------------------------
    /**
     * Updates an order's status with dual-write pattern for data consistency.
     * 
     * Implements the dual-write pattern by updating both the orders table
     * (current state) and order_status_history table (audit log) within a transaction.
     * 
     * @param {number} orderId - Order ID to update
     * @param {string} newStatus - Status key from order_status_workflow table
     * @param {string} performedBy - Username or system identifier (e.g., 'SYSTEM', 'admin')
     * @param {string} eventDescription - Human-readable event description
     * @returns {Promise<{success: boolean, newStatus: string}>}
     * @throws {Error} When status is invalid or transaction fails
     * 
     * @see docs/assistant_team/db_robot_logic_tools.md Section 2
     * 
     * @example
     * await dbAgent.updateOrderStatus(123, 'PROCESSING', 'admin', 'Payment confirmed');
     */
    async updateOrderStatus(orderId, newStatus, performedBy, eventDescription) {
        // Enforce Transaction (rudimentary via serial execution logic closer to DB if needed,
        // but for SQLite single-writer, sequential calls are acceptable for this prototype)

        // 1. Validate Status (Section 3 rule)
        const statusDef = await this.get(
            'SELECT * FROM order_status_workflow WHERE status_key = ?',
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

            // Generate order_code (4 letters + 5 digits)
            const customer = await this.get('SELECT cust_name FROM customers WHERE cust_id = ?', [custId]);
            const cleanName = customer ? customer.cust_name.replace(/[^a-zA-Z]/g, '').toUpperCase() : 'UNKN';
            const prefix = (cleanName + 'XXXX').substring(0, 4);
            const idStr = String(result.lastID).padStart(5, '0');
            const orderCode = `${prefix}-${idStr}`;

            await this.run('UPDATE orders SET order_code = ? WHERE order_id = ?', [orderCode, result.lastID]);

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
     */
    async createCustomer(data) {
        if (!data.cust_name || !data.cust_email) {
            throw new Error('Name and email are required');
        }
        const result = await this.run(`
            INSERT INTO customers (cust_name, cust_contact, cust_email, cust_phone, cust_web, notes, logo_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            data.cust_name,
            data.cust_contact || null,
            data.cust_email,
            data.cust_phone || null,
            data.cust_web || null,
            data.notes || null,
            data.logo_path || null
        ]);
        return { id: result.lastID };
    }

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
     */
    async createSupplier(data) {
        if (!data.prod_supp_co) {
            throw new Error('Company name is required');
        }
        const result = await this.run(`
            INSERT INTO product_suppliers (prod_supp_co, prod_supp_name, prod_supp_email, prod_supp_phone, prod_supp_web, notes, logo_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            data.prod_supp_co,
            data.prod_supp_name || null,
            data.prod_supp_email || null,
            data.prod_supp_phone || null,
            data.prod_supp_web || null,
            data.notes || null,
            data.logo_path || null
        ]);
        return { id: result.lastID };
    }

    /**
     * Creates a new product.
     * 
     * @param {Object} data - Product data
     * @param {string} data.prod_name - Product name (required)
     * @param {number} data.prod_supp_id - Supplier ID (required)
     * @param {number} data.unit_price - Base price (required)
     * @param {string} [data.prod_type] - Category/Type
     * @param {string} [data.prod_size] - Size/Dimensions
     * @param {string} [data.notes] - Internal notes
     * @param {string} [data.image_path] - Path to product image
     * @returns {Promise<{id: number}>} Created product ID
     */
    async createProduct(data) {
        if (!data.prod_name || !data.prod_supp_id || data.unit_price === undefined) {
            throw new Error('Name, supplier ID, and unit price are required');
        }
        const result = await this.run(`
            INSERT INTO products (prod_name, prod_supp_id, unit_price, prod_type, prod_size, notes, image_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            data.prod_name,
            data.prod_supp_id,
            data.unit_price,
            data.prod_type || null,
            data.prod_size || null,
            data.notes || null,
            data.image_path || null
        ]);
        return { id: result.lastID };
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
        const order = await this.get(`
      SELECT o.*, c.cust_name, c.logo_path
      FROM orders o
      JOIN customers c ON o.cust_id = c.cust_id
      WHERE o.order_id = ?
    `, [orderId]);

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
        return await this.all('SELECT * FROM order_status_workflow ORDER BY status_id');
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
    // ---------------------------------------------------------
    // P.I.S.T.A. CHAT HISTORY
    // All chat log reads and writes go through DBRobot to enforce
    // the single data-access layer rule.
    // @see docs/assistant_team/pista-agent.md — Chat history architecture
    // ---------------------------------------------------------

    /**
     * Saves a single chat message to the persistent conversation log.
     *
     * @param {object} entry - Chat log entry
     * @param {number|null} entry.orderId - Linked order ID, or null for dashboard context
     * @param {'ck'|'pista'} entry.role - Who sent the message
     * @param {string} entry.message - Plain text message content
     * @param {string|null} [entry.proposal] - JSON-stringified P.I.S.T.A. proposal object (pista role only)
     * @returns {Promise<{logId: number}>} ID of the created log entry
     *
     * @see docs/assistant_team/pista-agent.md — Chat history architecture
     */
    async saveChatMessage({ orderId = null, role, message, proposal = null }) {
        const result = await this.run(
            `INSERT INTO pista_chat_logs (order_id, role, message, proposal)
             VALUES (?, ?, ?, ?)`,
            [orderId, role, message, proposal ? JSON.stringify(proposal) : null]
        );
        return { logId: result.lastID };
    }

    /**
     * Retrieves the conversation history for a given context.
     *
     * Pass orderId to get the thread for a specific order.
     * Pass null to get the global Dashboard thread.
     *
     * @param {number|null} orderId - Order context, or null for dashboard
     * @param {number} [limit=50] - Maximum number of messages to return (newest first)
     * @returns {Promise<Array>} Array of chat log entries ordered oldest-first for display
     *
     * @see docs/assistant_team/pista-agent.md — Chat history architecture
     */
    async getChatHistory(orderId = null, limit = 50) {
        // Subquery reverses the newest-first fetch to return oldest-first for rendering
        return await this.all(
            `SELECT * FROM (
                SELECT log_id, order_id, role, message, proposal, created_at
                FROM pista_chat_logs
                WHERE order_id IS ?
                ORDER BY created_at DESC
                LIMIT ?
             ) ORDER BY created_at ASC`,
            [orderId, limit]
        );
    }

    // ---------------------------------------------------------
    // MAINTENANCE DOMAIN
    // Fully isolated from Orders. Shares products catalog only.
    // Implements identical Dual-Write and Transaction Safety rules.
    // @see docs/architecture/database-schema.md — maintenance tables
    // ---------------------------------------------------------

    /**
     * Retrieves all maintenance workflow statuses.
     *
     * @returns {Promise<Array>} Array of maintenance_status_workflow rows
     */
    async getMaintenanceWorkflowStatuses() {
        return await this.all('SELECT * FROM maintenance_status_workflow ORDER BY status_id');
    }

    /**
     * Retrieves all maintenance cases with customer name for list views.
     *
     * @returns {Promise<Array>} Array of maintenance case rows joined with customer name
     */
    async getMaintenanceCases() {
        return await this.all(`
            SELECT mc.*, c.cust_name, c.logo_path
            FROM maintenance_cases mc
            JOIN customers c ON mc.cust_id = c.cust_id
            ORDER BY mc.case_date DESC
        `);
    }

    /**
     * Retrieves full details of a single maintenance case including items and history.
     *
     * @param {number} caseId - Maintenance case ID
     * @returns {Promise<{case: Object, items: Array, history: Array}>}
     */
    async getMaintenanceDetails(caseId) {
        const maintenanceCase = await this.get(`
            SELECT mc.*, c.cust_name, c.logo_path
            FROM maintenance_cases mc
            JOIN customers c ON mc.cust_id = c.cust_id
            WHERE mc.case_id = ?
        `, [caseId]);

        const items = await this.all(`
            SELECT mi.*, p.prod_name, p.prod_type
            FROM maintenance_items mi
            JOIN products p ON mi.prod_id = p.prod_id
            WHERE mi.case_id = ?
        `, [caseId]);

        const history = await this.all(
            'SELECT * FROM maintenance_status_history WHERE case_id = ? ORDER BY update_date DESC',
            [caseId]
        );

        return { case: maintenanceCase, items, history };
    }

    /**
     * Creates a new maintenance case with initial NEW status.
     *
     * Implements the Dual-Write pattern: inserts a row into maintenance_cases
     * and immediately logs the initial status to maintenance_status_history.
     *
     * @param {number} custId - Customer ID (from customers table)
     * @param {string} [description] - Freetext description of the reported issue
     * @returns {Promise<{caseId: number, caseCode: string}>}
     * @throws {Error} When customer not found or transaction fails
     *
     * @see docs/assistant_team/db_robot_logic_tools.md — Dual-Write rule
     */
    async createMaintenanceCase(custId, description = null) {
        try {
            await this.run('BEGIN TRANSACTION');

            const result = await this.run(`
                INSERT INTO maintenance_cases (cust_id, current_status, description, update_event)
                VALUES (?, 'NEW', ?, 'Maintenance case created via API')
            `, [custId, description]);

            // Generate case_code (MAINT + 5-digit ID)
            const caseCode = `MAINT-${String(result.lastID).padStart(5, '0')}`;
            await this.run(
                'UPDATE maintenance_cases SET case_code = ? WHERE case_id = ?',
                [caseCode, result.lastID]
            );

            // Initial status history — Dual-Write rule
            await this.run(`
                INSERT INTO maintenance_status_history (case_id, status, update_event, performed_by)
                VALUES (?, 'NEW', 'Case Initialized', 'SYSTEM')
            `, [result.lastID]);

            await this.run('COMMIT');
            return { caseId: result.lastID, caseCode };
        } catch (error) {
            await this.run('ROLLBACK');
            throw error;
        }
    }

    /**
     * Adds a product item to a maintenance case.
     *
     * Records the product reference and quantity. Note: the maintenance_items
     * table uses issue_note for freetext annotations (not unit_price, which
     * is a labour-cost concern tracked at the case level).
     *
     * @param {number} caseId - Maintenance case ID
     * @param {number} prodId - Product ID (from products table)
     * @param {number} quantity - Number of units
     * @param {string} [issueNote] - Optional freetext note describing the issue with this item
     * @returns {Promise<{id: number}>} Created item ID
     * @throws {Error} When product not found or transaction fails
     */
    async addMaintenanceItem(caseId, prodId, quantity, issueNote = null) {
        const product = await this.get(
            'SELECT prod_id FROM products WHERE prod_id = ?',
            [prodId]
        );
        if (!product) throw new Error('Product not found');

        try {
            await this.run('BEGIN TRANSACTION');

            const result = await this.run(`
                INSERT INTO maintenance_items (case_id, prod_id, quantity, issue_note)
                VALUES (?, ?, ?, ?)
            `, [caseId, prodId, quantity, issueNote]);

            await this.run('COMMIT');
            return { id: result.lastID };
        } catch (error) {
            await this.run('ROLLBACK');
            throw error;
        }
    }

    /**
     * Updates the status of a maintenance case with Dual-Write pattern.
     *
     * Validates the new status against maintenance_status_workflow, then atomically
     * updates maintenance_cases.current_status and appends to maintenance_status_history.
     *
     * @param {number} caseId - Maintenance case ID
     * @param {string} newStatus - Status key from maintenance_status_workflow table
     * @param {string} performedBy - Actor identifier (e.g., 'admin', 'SYSTEM')
     * @param {string} eventDescription - Human-readable event description
     * @returns {Promise<{success: boolean, newStatus: string}>}
     * @throws {Error} When status is invalid or transaction fails
     *
     * @see docs/assistant_team/db_robot_logic_tools.md — Dual-Write rule
     */
    async updateMaintenanceStatus(caseId, newStatus, performedBy, eventDescription) {
        // Validate status against the maintenance-specific workflow table
        const statusDef = await this.get(
            'SELECT * FROM maintenance_status_workflow WHERE status_key = ?',
            [newStatus]
        );
        if (!statusDef) {
            throw new Error(`Invalid maintenance status: ${newStatus}`);
        }

        try {
            await this.run('BEGIN TRANSACTION');

            // Update current state on the case row
            await this.run(`
                UPDATE maintenance_cases
                SET current_status = ?,
                    current_status_update = CURRENT_TIMESTAMP,
                    update_event = ?
                WHERE case_id = ?
            `, [newStatus, eventDescription, caseId]);

            // Append to audit history — Dual-Write rule
            await this.run(`
                INSERT INTO maintenance_status_history (case_id, status, update_event, performed_by)
                VALUES (?, ?, ?, ?)
            `, [caseId, newStatus, eventDescription, performedBy]);

            await this.run('COMMIT');
            return { success: true, newStatus };
        } catch (error) {
            await this.run('ROLLBACK');
            throw error;
        }
    }
    // ---------------------------------------------------------
    // DATABASE VIEWER GETTERS — added v0.7.0
    // Full-list read methods for tables that previously had no
    // standalone list endpoint. Used exclusively by the DB viewer.
    // @see ui_design/js/controllers/databaseController.js
    // ---------------------------------------------------------

    /**
     * Returns all order items joined with product name and order code.
     * Enables the Order Items tab in the database viewer.
     *
     * @returns {Promise<Array>} All order_items rows enriched with prod_name and order_code
     */
    async getAllOrderItems() {
        return await this.all(`
            SELECT oi.*,
                   p.prod_name,
                   o.order_code
            FROM order_items oi
            JOIN products p ON oi.prod_id = p.prod_id
            JOIN orders o ON oi.order_id = o.order_id
            ORDER BY o.order_code, oi.order_item_id
        `);
    }

    /**
     * Returns the full order status history joined with order codes.
     * Enables the Order History tab in the database viewer.
     *
     * @returns {Promise<Array>} All order_status_history rows enriched with order_code
     */
    async getOrderStatusHistory() {
        return await this.all(`
            SELECT osh.*,
                   o.order_code
            FROM order_status_history osh
            JOIN orders o ON osh.order_id = o.order_id
            ORDER BY osh.update_date DESC
        `);
    }

    /**
     * Returns all maintenance items joined with product name and case code.
     * Enables the Maintenance Items tab in the database viewer.
     *
     * @returns {Promise<Array>} All maintenance_items rows enriched with prod_name and case_code
     */
    async getAllMaintenanceItems() {
        return await this.all(`
            SELECT mi.*,
                   p.prod_name,
                   mc.case_code
            FROM maintenance_items mi
            JOIN products p ON mi.prod_id = p.prod_id
            JOIN maintenance_cases mc ON mi.case_id = mc.case_id
            ORDER BY mc.case_code, mi.item_id
        `);
    }

    /**
     * Returns the full maintenance status history joined with case codes.
     * Enables the Maintenance History tab in the database viewer.
     *
     * @returns {Promise<Array>} All maintenance_status_history rows enriched with case_code
     */
    async getAllMaintenanceHistory() {
        return await this.all(`
            SELECT msh.*,
                   mc.case_code
            FROM maintenance_status_history msh
            JOIN maintenance_cases mc ON msh.case_id = mc.case_id
            ORDER BY msh.update_date DESC
        `);
    }

    /**
     * Returns all processed email records.
     * Enables the Processed Emails tab in the database viewer.
     * Note: linked_order_id may be null for unmatched or spam emails.
     * Returns empty array if the table does not exist yet (pre-Gmail Robot migration).
     *
     * @returns {Promise<Array>} All processed_emails rows, or [] if table is absent
     */
    async getProcessedEmails() {
        try {
            return await this.all(`
                SELECT pe.*,
                       o.order_code AS linked_order_code
                FROM processed_emails pe
                LEFT JOIN orders o ON pe.linked_order_id = o.order_id
                ORDER BY pe.email_date DESC
            `);
        } catch (err) {
            // RULE: Graceful degradation — processed_emails is created by Gmail Robot migration.
            if (err.message && err.message.includes('no such table')) return [];
            throw err;
        }
    }

    /**
     * Returns all sender rules.
     * Enables the Sender Rules tab in the database viewer.
     * Returns empty array if the table does not exist yet (pre-Gmail Robot migration).
     *
     * @returns {Promise<Array>} All sender_rules rows, or [] if table is absent
     */
    async getSenderRules() {
        try {
            return await this.all(`
                SELECT * FROM sender_rules ORDER BY created_at DESC
            `);
        } catch (err) {
            // RULE: Graceful degradation — sender_rules is created by Gmail Robot migration.
            // Return empty array so the DB viewer tab renders cleanly before that migration runs.
            if (err.message && err.message.includes('no such table')) return [];
            throw err;
        }
    }

}

export default new DBRobot();


