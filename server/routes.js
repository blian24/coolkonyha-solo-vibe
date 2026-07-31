/**
 * @fileoverview API Routes - Express REST API endpoints for Coolkonyha.
 *
 * Provides RESTful endpoints for:
 * - Customer management (GET, PUT)
 * - Supplier management (GET, PUT)
 * - Product management (GET, PUT)
 * - Order management (GET, POST, PUT)
 * - Workflow status definitions (GET)
 * - Maintenance case management (GET, POST, PUT) — added v0.6.0
 *
 * All routes delegate business logic to the domain agent layer.
 *
 * @see server/robots/robot-crm.js        — Customer operations
 * @see server/robots/robot-catalog.js    — Supplier & product operations
 * @see server/robots/robot-orders.js     — Order operations
 * @see server/robots/robot-maintenance.js — Maintenance operations
 * @see server/robots/robot-pista-db.js   — Email & sender rule operations
 * @author Coolkonyha Development Team
 * @version 1.2.0
 */
import express from 'express';
import { getCustomers, createCustomer, updateCustomer } from './robots/robot-crm.js';
import { getSuppliers, createSupplier, updateSupplier, getProducts, createProduct, updateProduct } from './robots/robot-catalog.js';
import { getWorkflowStatuses, getOrders, getOrderDetails, createOrder, addOrderItem, updateOrderStatus, getAllOrderItems, getOrderStatusHistory } from './robots/robot-orders.js';
import { getMaintenanceWorkflowStatuses, getMaintenanceCases, createMaintenanceCase, getMaintenanceDetails, updateMaintenanceStatus, addMaintenanceItem, getAllMaintenanceItems, getAllMaintenanceHistory } from './robots/robot-maintenance.js';
import { getProcessedEmails, getSenderRules } from './robots/robot-pista-db.js';

const router = express.Router();

router.get('/customers', async (req, res) => {
    try {
        const customers = await getCustomers();
        res.json(customers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/customers', async (req, res) => {
    try {
        const result = await createCustomer(req.body);
        res.status(201).json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.get('/suppliers', async (req, res) => {
    try {
        const suppliers = await getSuppliers();
        res.json(suppliers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/suppliers', async (req, res) => {
    try {
        const result = await createSupplier(req.body);
        res.status(201).json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.get('/products', async (req, res) => {
    try {
        const products = await getProducts();
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/products', async (req, res) => {
    try {
        const result = await createProduct(req.body);
        res.status(201).json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.get('/workflow', async (req, res) => {
    try {
        const statuses = await getWorkflowStatuses();
        res.json(statuses);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/orders', async (req, res) => {
    try {
        const orders = await getOrders();
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/orders', async (req, res) => {
    try {
        const { custId, currency } = req.body;
        const result = await createOrder(custId, currency);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/orders/:id', async (req, res) => {
    try {
        const result = await getOrderDetails(req.params.id);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Implements dual-write business rule pattern
// See docs/assistant_team/db_robot_logic_tools.md Section 2
router.put('/orders/:id/status', async (req, res) => {
    try {
        const { status, performedBy, eventDescription } = req.body;
        const result = await updateOrderStatus(
            req.params.id,
            status,
            performedBy,
            eventDescription
        );
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Implements pricing continuity business rule
// See docs/assistant_team/db_robot_logic_tools.md Section 1
router.post('/orders/:id/items', async (req, res) => {
    try {
        const { prodId, quantity } = req.body;
        const result = await addOrderItem(req.params.id, prodId, quantity);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/customers/:id', async (req, res) => {
    try {
        const result = await updateCustomer(req.params.id, req.body);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/suppliers/:id', async (req, res) => {
    try {
        const result = await updateSupplier(req.params.id, req.body);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/products/:id', async (req, res) => {
    try {
        const result = await updateProduct(req.params.id, req.body);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------------------------------------------------------
// MAINTENANCE DOMAIN ENDPOINTS
// Fully isolated from Orders. See docs/architecture/api-routes.md
// ---------------------------------------------------------

/**
 * GET /api/maintenance/workflow
 * Returns all valid maintenance workflow statuses.
 */
router.get('/maintenance/workflow', async (req, res) => {
    try {
        const statuses = await getMaintenanceWorkflowStatuses();
        res.json(statuses);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/maintenance
 * Returns all maintenance cases with customer info.
 */
router.get('/maintenance', async (req, res) => {
    try {
        const cases = await getMaintenanceCases();
        res.json(cases);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/maintenance
 * Creates a new maintenance case. Body: { custId, description?, priority? }
 */
router.post('/maintenance', async (req, res) => {
    try {
        const { custId, description } = req.body;
        const result = await createMaintenanceCase(custId, description);
        res.status(201).json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * GET /api/maintenance/:id
 * Returns full details for a single maintenance case (case, items, history).
 */
router.get('/maintenance/:id', async (req, res) => {
    try {
        const result = await getMaintenanceDetails(req.params.id);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * PUT /api/maintenance/:id/status
 * Updates case status. Implements Dual-Write pattern.
 * Body: { status, performedBy, eventDescription }
 */
// Implements dual-write business rule pattern for maintenance domain
// See docs/assistant_team/db_robot_logic_tools.md Section 2
router.put('/maintenance/:id/status', async (req, res) => {
    try {
        const { status, performedBy, eventDescription } = req.body;
        const result = await updateMaintenanceStatus(
            req.params.id,
            status,
            performedBy,
            eventDescription
        );
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * POST /api/maintenance/:id/items
 * Adds a product item to a case. Implements Pricing Continuity rule.
 * Body: { prodId, quantity, description? }
 */
// Implements pricing continuity business rule for maintenance domain
// See docs/assistant_team/db_robot_logic_tools.md Section 1
router.post('/maintenance/:id/items', async (req, res) => {
    try {
        const { prodId, quantity, issueNote } = req.body;
        const result = await addMaintenanceItem(
            req.params.id,
            prodId,
            quantity,
            issueNote
        );
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------------------------------------------------------
// DATABASE VIEWER ENDPOINTS — added v0.7.0
// Read-only list endpoints for tables that had no standalone route.
// Used exclusively by the database viewer UI.
// @see ui_design/js/controllers/databaseController.js
// ---------------------------------------------------------

/**
 * GET /api/order-items
 * Returns all order items joined with product name and order code.
 */
router.get('/order-items', async (req, res) => {
    try {
        const items = await getAllOrderItems();
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/order-history
 * Returns full order status history joined with order codes.
 */
router.get('/order-history', async (req, res) => {
    try {
        const history = await getOrderStatusHistory();
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/maintenance-items
 * Returns all maintenance items joined with product name and case code.
 */
router.get('/maintenance-items', async (req, res) => {
    try {
        const items = await getAllMaintenanceItems();
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/maintenance-history
 * Returns full maintenance status history joined with case codes.
 */
router.get('/maintenance-history', async (req, res) => {
    try {
        const history = await getAllMaintenanceHistory();
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/processed-emails
 * Returns all processed email records with optional linked order code.
 */
router.get('/processed-emails', async (req, res) => {
    try {
        const emails = await getProcessedEmails();
        res.json(emails);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/sender-rules
 * Returns all sender rules managed by P.I.S.T.A. and approved by CK.
 */
router.get('/sender-rules', async (req, res) => {
    try {
        const rules = await getSenderRules();
        res.json(rules);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;


