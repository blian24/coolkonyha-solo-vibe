/**
 * @fileoverview Test App Factory — Creates an isolated Express app for integration/E2E testing.
 *
 * The production server/index.js launches Express with the singleton DBAgent
 * (which connects to the production DB). This factory creates a fresh Express app
 * using a provided test agent instance, enabling full HTTP-level tests against
 * a sandbox database without ever touching coolkonyha.db.
 *
 * @see server/routes.js — Route definitions (production)
 * @see server/index.js — Production server entry point
 * @see docs/architecture/api-routes.md — API contract
 */

import express from 'express';
import bodyParser from 'body-parser';

/**
 * Builds the route handlers using a provided agent (instead of the singleton).
 * Mirrors all routes from server/routes.js exactly.
 *
 * @param {object} agent - A DBAgent-compatible object (e.g., from createTestAgent)
 * @returns {import('express').Router}
 */
const buildRouter = (agent) => {
    const router = express.Router();

    router.get('/customers', async (req, res) => {
        try {
            res.json(await agent.getCustomers());
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/suppliers', async (req, res) => {
        try {
            res.json(await agent.getSuppliers());
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/products', async (req, res) => {
        try {
            res.json(await agent.getProducts());
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/workflow', async (req, res) => {
        try {
            res.json(await agent.getWorkflowStatuses());
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/orders', async (req, res) => {
        try {
            res.json(await agent.getOrders());
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/orders', async (req, res) => {
        try {
            const { custId, currency } = req.body;
            res.json(await agent.createOrder(custId, currency));
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/orders/:id', async (req, res) => {
        try {
            res.json(await agent.getOrderDetails(req.params.id));
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Dual-write business rule — see docs/agent_logics/db_agent_logic_tools.md Section 2
    router.put('/orders/:id/status', async (req, res) => {
        try {
            const { status, performedBy, eventDescription } = req.body;
            res.json(
                await agent.updateOrderStatus(req.params.id, status, performedBy, eventDescription)
            );
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    // Pricing continuity rule — see docs/agent_logics/db_agent_logic_tools.md Section 1
    router.post('/orders/:id/items', async (req, res) => {
        try {
            const { prodId, quantity } = req.body;
            res.json(await agent.addOrderItem(req.params.id, prodId, quantity));
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.put('/customers/:id', async (req, res) => {
        try {
            res.json(await agent.updateCustomer(req.params.id, req.body));
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.put('/suppliers/:id', async (req, res) => {
        try {
            res.json(await agent.updateSupplier(req.params.id, req.body));
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.put('/products/:id', async (req, res) => {
        try {
            res.json(await agent.updateProduct(req.params.id, req.body));
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};

/**
 * Creates and starts an isolated Express server bound to a random port.
 * Returns the base URL and a teardown function.
 *
 * @param {object} agent - A DBAgent-compatible object
 * @returns {Promise<{baseUrl: string, teardown: () => Promise<void>}>}
 */
export const createTestServer = (agent) => new Promise((resolve) => {
    const app = express();
    app.use(bodyParser.json());
    app.use('/api', buildRouter(agent));

    // Port 0 binds to a random available port — avoids port conflicts in CI
    const server = app.listen(0, () => {
        const { port } = server.address();
        const baseUrl = `http://localhost:${port}`;
        const teardown = () => new Promise((res, rej) => {
            server.close((err) => (err ? rej(err) : res()));
        });
        resolve({ baseUrl, teardown });
    });
});
