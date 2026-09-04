/**
 * @fileoverview Unit Tests — Orders/CRM/Catalog Robot Business Logic
 *
 * Tests real server/robots/*.js functions directly against an in-memory
 * sandbox SQLite DB (server/db.js switched to ':memory:' — see
 * tests/run-tests.js). The production coolkonyha.db is never opened.
 *
 * Previously these tests ran against tests/helpers/agent-factory.js, a
 * hand-maintained mirror of the retired .trash/server/agent.js that had
 * drifted from production (wrong workflow table name, missing the whole
 * Maintenance domain). See docs/.notes/future-ideas.md i-2 (now resolved)
 * for the full history.
 *
 * RE-LEARN: Before tests run, the learner reads the real robot files and the
 * associated business-rule documentation to ensure test assertions match
 * the current implementation.
 *
 * Covered business rules:
 *   - Pricing Continuity: unit_price frozen at order-item creation time
 *   - Dual-Write: updateOrderStatus writes to both orders + order_status_history
 *   - Status Validation: invalid status keys are rejected before DB write
 *   - Order Total: recalculated as SUM(quantity * unit_price) after item add
 *
 * @see docs/assistant_team/db_robot_logic_tools.md — Business rules
 * @see docs/tests/unit-tests.md — Test documentation
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { learn, formatLearnReport } from '../helpers/learner.js';
import { createSandboxDb } from '../helpers/sandbox-db.js';
import { seedBaseData } from '../helpers/fixtures.js';
import * as ordersRobot from '../../server/robots/robot-orders.js';
import { updateCustomer } from '../../server/robots/robot-crm.js';
import { updateProduct } from '../../server/robots/robot-catalog.js';

const PROJECT_ROOT = resolve(fileURLToPath(import.meta.url), '../../../..');

// ---------------------------------------------------------------
// RE-LEARN PHASE — runs once before all unit tests
// ---------------------------------------------------------------
let learnContext;

before(async () => {
    learnContext = await learn('unit', PROJECT_ROOT);
    console.log('\n' + formatLearnReport(learnContext) + '\n');
});

// ---------------------------------------------------------------
// SUITE: createOrder
// ---------------------------------------------------------------
describe('robot-orders.createOrder()', () => {
    let db;
    let seeded;

    before(async () => {
        db = await createSandboxDb();
        await db.reset();
        seeded = await seedBaseData(db);
    });

    it('inserts a row in the orders table with NEW status', async () => {
        const { orderId } = await ordersRobot.createOrder(seeded.customerId);
        assert.ok(orderId > 0, 'orderId should be a positive integer');

        const order = await db.get('SELECT * FROM orders WHERE order_id = ?', [orderId]);
        assert.equal(order.current_status, 'NEW');
        assert.equal(order.cust_id, seeded.customerId);
    });

    it('creates an initial NEW entry in order_status_history', async () => {
        const { orderId } = await ordersRobot.createOrder(seeded.customerId);

        const historyRow = await db.get(
            "SELECT * FROM order_status_history WHERE order_id = ? AND status = 'NEW'",
            [orderId]
        );
        assert.ok(historyRow, 'Initial NEW history entry must exist');
        assert.equal(historyRow.performed_by, 'SYSTEM');
    });

    it('defaults currency to HUF when not provided', async () => {
        const { orderId } = await ordersRobot.createOrder(seeded.customerId);
        const order = await db.get('SELECT currency FROM orders WHERE order_id = ?', [orderId]);
        assert.equal(order.currency, 'HUF');
    });

    it('respects a custom currency when provided', async () => {
        const { orderId } = await ordersRobot.createOrder(seeded.customerId, 'EUR');
        const order = await db.get('SELECT currency FROM orders WHERE order_id = ?', [orderId]);
        assert.equal(order.currency, 'EUR');
    });
});

// ---------------------------------------------------------------
// SUITE: updateOrderStatus — Dual-Write Rule
// ---------------------------------------------------------------
describe('robot-orders.updateOrderStatus() — Dual-Write Rule', () => {
    let db;
    let orderId;

    before(async () => {
        db = await createSandboxDb();
        await db.reset();
        const seeded = await seedBaseData(db);
        const result = await ordersRobot.createOrder(seeded.customerId);
        orderId = result.orderId;
    });

    it('updates orders.current_status to the new status', async () => {
        await ordersRobot.updateOrderStatus(orderId, 'OFFER_SENT', 'test', 'Offer sent to client');
        const order = await db.get('SELECT current_status FROM orders WHERE order_id = ?', [orderId]);
        assert.equal(order.current_status, 'OFFER_SENT');
    });

    it('inserts a matching row in order_status_history (dual-write)', async () => {
        await ordersRobot.updateOrderStatus(orderId, 'ORDER_CONFIRMED', 'test', 'Client confirmed');
        const histRow = await db.get(
            "SELECT * FROM order_status_history WHERE order_id = ? AND status = 'ORDER_CONFIRMED'",
            [orderId]
        );
        assert.ok(histRow, 'History row must exist for dual-write');
        assert.equal(histRow.performed_by, 'test');
    });

    it('throws an error for an invalid status key (before any DB write)', async () => {
        await assert.rejects(
            () => ordersRobot.updateOrderStatus(orderId, 'INVALID_XYZ', 'test', 'Bad status'),
            /Invalid Status/
        );
    });

    it('leaves orders.current_status unchanged after an invalid status attempt', async () => {
        const before = await db.get(
            'SELECT current_status FROM orders WHERE order_id = ?',
            [orderId]
        );
        try {
            await ordersRobot.updateOrderStatus(orderId, 'BOGUS', 'test', 'Should fail');
        } catch { /* expected */ }
        const after = await db.get(
            'SELECT current_status FROM orders WHERE order_id = ?',
            [orderId]
        );
        assert.equal(before.current_status, after.current_status);
    });
});

// ---------------------------------------------------------------
// SUITE: addOrderItem — Pricing Continuity Rule
// ---------------------------------------------------------------
describe('robot-orders.addOrderItem() — Pricing Continuity Rule', () => {
    let db;
    let seeded;
    let orderId;

    before(async () => {
        db = await createSandboxDb();
        await db.reset();
        seeded = await seedBaseData(db);
        const result = await ordersRobot.createOrder(seeded.customerId);
        orderId = result.orderId;
    });

    it('freezes the product price at the time of order (Pricing Continuity)', async () => {
        // Confirm base product price is 2500
        const product = await db.get(
            'SELECT unit_price FROM products WHERE prod_id = ?',
            [seeded.productId]
        );
        assert.equal(product.unit_price, seeded.productPrice);

        await ordersRobot.addOrderItem(orderId, seeded.productId, 3);

        const item = await db.get(
            'SELECT unit_price FROM order_items WHERE order_id = ?',
            [orderId]
        );
        // The item price should match the product price AT TIME OF INSERT
        assert.equal(item.unit_price, seeded.productPrice);
    });

    it('recalculates orders.total_amount correctly after adding an item', async () => {
        const quantity = 3;
        const expected = quantity * seeded.productPrice;

        const details = await ordersRobot.getOrderDetails(orderId);
        assert.equal(
            Number(details.order.total_amount),
            expected,
            `Order total should be ${expected}`
        );
    });

    it('reflects the frozen price even after the product price changes', async () => {
        // Change product price AFTER item was already added
        await db.run(
            'UPDATE products SET unit_price = ? WHERE prod_id = ?',
            [9999, seeded.productId]
        );
        const item = await db.get(
            'SELECT unit_price FROM order_items WHERE order_id = ?',
            [orderId]
        );
        // Must still be the original price, not 9999
        assert.equal(item.unit_price, seeded.productPrice);
    });

    it('throws an error when the product does not exist', async () => {
        await assert.rejects(
            () => ordersRobot.addOrderItem(orderId, 99999, 1),
            /Product not found/
        );
    });
});

// ---------------------------------------------------------------
// SUITE: updateCustomer / updateProduct
// ---------------------------------------------------------------
describe('robot-crm.updateCustomer()', () => {
    let db;
    let seeded;

    before(async () => {
        db = await createSandboxDb();
        await db.reset();
        seeded = await seedBaseData(db);
    });

    it('updates allowed fields correctly', async () => {
        await updateCustomer(seeded.customerId, { cust_name: 'Updated Kft.' });
        const row = await db.get(
            'SELECT cust_name FROM customers WHERE cust_id = ?',
            [seeded.customerId]
        );
        assert.equal(row.cust_name, 'Updated Kft.');
    });

    it('throws when no fields are provided', async () => {
        await assert.rejects(() => updateCustomer(seeded.customerId, {}), /No fields/);
    });
});

describe('robot-catalog.updateProduct()', () => {
    let db;
    let seeded;

    before(async () => {
        db = await createSandboxDb();
        await db.reset();
        seeded = await seedBaseData(db);
    });

    it('updates product unit_price', async () => {
        await updateProduct(seeded.productId, { unit_price: 500 });
        const row = await db.get(
            'SELECT unit_price FROM products WHERE prod_id = ?',
            [seeded.productId]
        );
        assert.equal(Number(row.unit_price), 500);
    });

    it('throws when no fields are provided', async () => {
        await assert.rejects(() => updateProduct(seeded.productId, {}), /No fields/);
    });
});
