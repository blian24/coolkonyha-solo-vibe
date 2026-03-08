/**
 * @fileoverview Integration Tests — Express REST API Routes
 *
 * Spins up a real Express server on a random port backed by a sandbox in-memory
 * SQLite database. All tests use fetch() to verify HTTP contract behaviour.
 * The production server and coolkonyha.db are never touched.
 *
 * RE-LEARN: Before tests run, the learner reads server/routes.js, server/agent.js,
 * and docs/architecture/api-routes.md to validate the HTTP contract against the
 * current implementation.
 *
 * @see docs/architecture/api-routes.md — API contract
 * @see docs/tests/integration-tests.md — Test documentation
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { learn, formatLearnReport } from '../helpers/learner.js';
import { createSandboxDb } from '../helpers/sandbox-db.js';
import { seedBaseData } from '../helpers/fixtures.js';
import { createTestAgent } from '../helpers/agent-factory.js';
import { createTestServer } from '../helpers/test-app-factory.js';

const PROJECT_ROOT = resolve(fileURLToPath(import.meta.url), '../../../..');

// ---------------------------------------------------------------
// RE-LEARN PHASE — runs once before all integration tests
// ---------------------------------------------------------------
let learnContext;

before(async () => {
    learnContext = await learn('integration', PROJECT_ROOT);
    console.log('\n' + formatLearnReport(learnContext) + '\n');
});

// ---------------------------------------------------------------
// Shared server setup for the suite
// ---------------------------------------------------------------
let baseUrl;
let serverTeardown;
let db;
let seeded;

before(async () => {
    db = await createSandboxDb();
    seeded = await seedBaseData(db);
    const agent = createTestAgent(db);
    const server = await createTestServer(agent);
    baseUrl = server.baseUrl;
    serverTeardown = server.teardown;
});

after(async () => {
    await serverTeardown();
    await db.close();
});

// ---------------------------------------------------------------
// SUITE: Read endpoints (GET)
// ---------------------------------------------------------------
describe('GET /api/customers', () => {
    it('returns 200 with an array', async () => {
        const res = await fetch(`${baseUrl}/api/customers`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.ok(Array.isArray(body));
        assert.ok(body.length > 0, 'Should return at least the seeded customer');
    });
});

describe('GET /api/suppliers', () => {
    it('returns 200 with an array', async () => {
        const res = await fetch(`${baseUrl}/api/suppliers`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.ok(Array.isArray(body));
        assert.ok(body.length > 0);
    });
});

describe('GET /api/products', () => {
    it('returns 200 with an array', async () => {
        const res = await fetch(`${baseUrl}/api/products`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.ok(Array.isArray(body));
        assert.ok(body.length > 0);
    });
});

describe('GET /api/workflow', () => {
    it('returns 200 with 10 workflow statuses', async () => {
        const res = await fetch(`${baseUrl}/api/workflow`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.ok(Array.isArray(body));
        assert.equal(body.length, 10, 'Workflow should have all 10 statuses from seed');
    });
});

// ---------------------------------------------------------------
// SUITE: Order creation
// ---------------------------------------------------------------
describe('POST /api/orders', () => {
    it('creates an order and returns orderId', async () => {
        const res = await fetch(`${baseUrl}/api/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ custId: seeded.customerId }),
        });
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.ok(body.orderId > 0, 'orderId must be a positive integer');
    });
});

// ---------------------------------------------------------------
// SUITE: Order details
// ---------------------------------------------------------------
describe('GET /api/orders/:id', () => {
    let orderId;

    before(async () => {
        const res = await fetch(`${baseUrl}/api/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ custId: seeded.customerId }),
        });
        const body = await res.json();
        orderId = body.orderId;
    });

    it('returns order, items and history arrays', async () => {
        const res = await fetch(`${baseUrl}/api/orders/${orderId}`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.ok(body.order, 'order object must exist');
        assert.ok(Array.isArray(body.items), 'items must be array');
        assert.ok(Array.isArray(body.history), 'history must be array');
    });

    it('order has NEW status initially', async () => {
        const res = await fetch(`${baseUrl}/api/orders/${orderId}`);
        const body = await res.json();
        assert.equal(body.order.current_status, 'NEW');
    });
});

// ---------------------------------------------------------------
// SUITE: Status update — dual-write via HTTP
// ---------------------------------------------------------------
describe('PUT /api/orders/:id/status', () => {
    let orderId;

    before(async () => {
        const res = await fetch(`${baseUrl}/api/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ custId: seeded.customerId }),
        });
        const body = await res.json();
        orderId = body.orderId;
    });

    it('returns 200 and success:true for a valid status', async () => {
        const res = await fetch(`${baseUrl}/api/orders/${orderId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'OFFER_SENT',
                performedBy: 'integration-test',
                eventDescription: 'Offer sent to client',
            }),
        });
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.success, true);
    });

    it('returns 400 for an invalid status key', async () => {
        const res = await fetch(`${baseUrl}/api/orders/${orderId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'TOTALLY_FAKE',
                performedBy: 'integration-test',
                eventDescription: 'Should fail',
            }),
        });
        assert.equal(res.status, 400);
        const body = await res.json();
        assert.ok(body.error, 'Error message must be present');
    });
});

// ---------------------------------------------------------------
// SUITE: Add order items — pricing continuity via HTTP
// ---------------------------------------------------------------
describe('POST /api/orders/:id/items', () => {
    let orderId;

    before(async () => {
        const res = await fetch(`${baseUrl}/api/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ custId: seeded.customerId }),
        });
        const body = await res.json();
        orderId = body.orderId;
    });

    it('returns 200 with the created item id', async () => {
        const res = await fetch(`${baseUrl}/api/orders/${orderId}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prodId: seeded.productId, quantity: 2 }),
        });
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.ok(body.id > 0, 'Item ID must be a positive integer');
    });
});

// ---------------------------------------------------------------
// SUITE: Customer update via HTTP
// ---------------------------------------------------------------
describe('PUT /api/customers/:id', () => {
    it('updates customer and returns success:true', async () => {
        const res = await fetch(`${baseUrl}/api/customers/${seeded.customerId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cust_name: 'HTTP Updated Kft.' }),
        });
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.success, true);
    });
});
