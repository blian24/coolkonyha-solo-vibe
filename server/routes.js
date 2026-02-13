/**
 * @fileoverview API Routes - Express REST API endpoints for Coolkonyha.
 * 
 * Provides RESTful endpoints for:
 * - Customer management (GET, PUT)
 * - Supplier management (GET, PUT)
 * - Product management (GET, PUT)
 * - Order management (GET, POST, PUT)
 * - Workflow status definitions (GET)
 * 
 * All routes delegate business logic to the DBAgent layer.
 * 
 * @see server/agent.js - Business logic implementation
 * @author Coolkonyha Development Team
 * @version 1.0.0
 */
import express from 'express';
import dbAgent from './agent.js';

const router = express.Router();

router.get('/customers', async (req, res) => {
    try {
        const customers = await dbAgent.getCustomers();
        res.json(customers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/suppliers', async (req, res) => {
    try {
        const suppliers = await dbAgent.getSuppliers();
        res.json(suppliers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/products', async (req, res) => {
    try {
        const products = await dbAgent.getProducts();
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/workflow', async (req, res) => {
    try {
        const statuses = await dbAgent.getWorkflowStatuses();
        res.json(statuses);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/orders', async (req, res) => {
    try {
        const orders = await dbAgent.getOrders();
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/orders', async (req, res) => {
    try {
        const { custId, currency } = req.body;
        const result = await dbAgent.createOrder(custId, currency);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/orders/:id', async (req, res) => {
    try {
        const result = await dbAgent.getOrderDetails(req.params.id);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Implements dual-write business rule pattern
// See docs/agent_logics/db_agent_logic_tools.md Section 2
router.put('/orders/:id/status', async (req, res) => {
    try {
        const { status, performedBy, eventDescription } = req.body;
        const result = await dbAgent.updateOrderStatus(
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
// See docs/agent_logics/db_agent_logic_tools.md Section 1
router.post('/orders/:id/items', async (req, res) => {
    try {
        const { prodId, quantity } = req.body;
        const result = await dbAgent.addOrderItem(req.params.id, prodId, quantity);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/customers/:id', async (req, res) => {
    try {
        const result = await dbAgent.updateCustomer(req.params.id, req.body);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/suppliers/:id', async (req, res) => {
    try {
        const result = await dbAgent.updateSupplier(req.params.id, req.body);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/products/:id', async (req, res) => {
    try {
        const result = await dbAgent.updateProduct(req.params.id, req.body);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
