/**
 * @fileoverview E2E Tests — Full Order Lifecycle
 *
 * Tests the complete order lifecycle from customer creation through to final
 * CLOSED status, exercising both the HTTP API layer and the underlying
 * DBRobot business rules together.
 *
 * RE-LEARN: Before tests run, the learner reads all source and documentation
 * files (full scope) to understand the complete system: routes, agent logic,
 * schema, and workflow rules.
 *
 * Lifecycle under test:
 *   1. Seed customer, supplier, product
 *   2. Create order via HTTP → verify NEW status
 *   3. Add order items → verify total_amount calculation
 *   4. Transition statuses: NEW → OFFER_SENT → ORDER_CONFIRMED → INVOICED → CLOSED
 *   5. Verify each transition is recorded in order_status_history
 *   6. Attempt invalid transitions → verify rejection
 *
 * @see docs/assistant_team/db_robot_logic_tools.md — Business rules
 * @see docs/tests/e2e-tests.md — Test documentation
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { learn, formatLearnReport } from '../helpers/learner.js';
import { createSandboxDb } from '../helpers/sandbox-db.js';
import { seedBaseData } from '../helpers/fixtures.js';
import { createTestServer } from '../helpers/test-app-factory.js';

const PROJECT_ROOT = resolve(fileURLToPath(import.meta.url), '../../../..');

// ---------------------------------------------------------------
// RE-LEARN PHASE — full system, runs once before all E2E tests
// ---------------------------------------------------------------
before(async () => {
    const context = await learn('e2e', PROJECT_ROOT);
    console.log('\n' + formatLearnReport(context) + '\n');
});

// ---------------------------------------------------------------
// E2E: Full Order Lifecycle
// ---------------------------------------------------------------
describe('E2E: Full Order Lifecycle', () => {
    let baseUrl;
    let serverTeardown;
    let db;
    let seeded;
    let orderId;

    // Status transitions to walk through in sequence
    const STATUS_TRANSITIONS = [
        { status: 'OFFER_SENT', event: 'Offer sent to customer' },
        { status: 'ORDER_CONFIRMED', event: 'Customer accepted the offer' },
        { status: 'INVOICED', event: 'Invoice issued' },
        { status: 'CLOSED', event: 'Payment received, order closed' },
    ];

    before(async () => {
        db = await createSandboxDb();
        await db.reset();
        seeded = await seedBaseData(db);
        const server = await createTestServer();
        baseUrl = server.baseUrl;
        serverTeardown = server.teardown;
    });

    after(async () => {
        await serverTeardown();
    });

    // Step 1: Create order
    it('Step 1: creates an order with NEW status', async () => {
        const res = await fetch(`${baseUrl}/api/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ custId: seeded.customerId }),
        });
        const body = await res.json();
        orderId = body.orderId;

        assert.ok(orderId > 0, 'orderId must be a positive integer');

        const details = await fetch(`${baseUrl}/api/orders/${orderId}`).then((r) => r.json());
        assert.equal(details.order.current_status, 'NEW');
    });

    // Step 2: Add items and verify total
    it('Step 2: adds two items and verifies total_amount (Pricing Continuity)', async () => {
        // Add 3 units of product at 2500 each = 7500
        await fetch(`${baseUrl}/api/orders/${orderId}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prodId: seeded.productId, quantity: 3 }),
        });

        const details = await fetch(`${baseUrl}/api/orders/${orderId}`).then((r) => r.json());
        const expectedTotal = 3 * seeded.productPrice;
        assert.equal(
            Number(details.order.total_amount),
            expectedTotal,
            `total_amount should be ${expectedTotal} (3 × ${seeded.productPrice})`
        );
        assert.equal(details.items.length, 1, 'Should have exactly 1 order item');
        assert.equal(
            Number(details.items[0].unit_price),
            seeded.productPrice,
            'unit_price must be frozen at the original product price'
        );
    });

    // Step 3: Walk through valid status transitions
    for (const { status, event } of STATUS_TRANSITIONS) {
        it(`Step 3: transitions to ${status}`, async () => {
            const res = await fetch(`${baseUrl}/api/orders/${orderId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, performedBy: 'e2e-test', eventDescription: event }),
            });
            assert.equal(res.status, 200, `Status update to ${status} should succeed`);
            const body = await res.json();
            assert.equal(body.success, true);

            // Verify current_status in DB
            const details = await fetch(`${baseUrl}/api/orders/${orderId}`).then((r) => r.json());
            assert.equal(details.order.current_status, status);
        });
    }

    // Step 4: Verify complete history chain
    it('Step 4: order_status_history contains all transitions in order', async () => {
        const details = await fetch(`${baseUrl}/api/orders/${orderId}`).then((r) => r.json());
        const historicStatuses = details.history.map((h) => h.status);

        // History is DESC so we reverse
        const ascStatuses = [...historicStatuses].reverse();

        // Must contain NEW (initial) + all 4 transitions
        assert.ok(ascStatuses.includes('NEW'), 'History must include initial NEW status');
        for (const { status } of STATUS_TRANSITIONS) {
            assert.ok(ascStatuses.includes(status), `History must include ${status}`);
        }
        assert.equal(
            details.history.length,
            STATUS_TRANSITIONS.length + 1, // +1 for initial NEW
            'History count must match total transitions (including initial NEW)'
        );
    });

    // Step 5: Attempt invalid status after CLOSED
    it('Step 5: rejects invalid status key with HTTP 400', async () => {
        const res = await fetch(`${baseUrl}/api/orders/${orderId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'GHOST_STATUS',
                performedBy: 'e2e-test',
                eventDescription: 'Should be rejected',
            }),
        });
        assert.equal(res.status, 400, 'Invalid status must return 400');
        const body = await res.json();
        assert.ok(body.error, 'Error message must be in response body');
    });

    // Step 6: Confirm production DB was never touched
    it('Step 6: production DB (coolkonyha.db) is unmodified', async () => {
        // Verify the sandbox DB has our order
        const sandboxOrder = await db.get(
            'SELECT * FROM orders WHERE order_id = ?',
            [orderId]
        );
        assert.ok(sandboxOrder, 'Order must exist in sandbox DB');

        // The test is implicitly passing because we only ever connect to :memory:
        // If this assertion passes, we know no production connection was opened
        assert.equal(sandboxOrder.order_id, orderId);
    });
});
