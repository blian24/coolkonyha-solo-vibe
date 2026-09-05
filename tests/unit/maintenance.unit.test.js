/**
 * @fileoverview Unit Tests — Maintenance Robot Business Logic
 *
 * Tests real server/robots/robot-maintenance.js functions directly against
 * an in-memory sandbox SQLite DB (server/db.js switched to ':memory:' — see
 * tests/run-tests.js). The production coolkonyha.db is never opened.
 *
 * Fully isolated from the Orders domain — no shared tables, no shared
 * fixtures beyond the base customer/product seed.
 *
 * Covered business rules:
 *   - Dual-Write: updateMaintenanceStatus writes to both maintenance_cases
 *     and maintenance_status_history
 *   - Status Validation: invalid status keys are rejected before DB write
 *   - Case Code Generation: MAINT-##### format assigned on creation
 *
 * @see docs/assistant_team/db_robot_logic_tools.md — Business rules (Dual-Write)
 * @see docs/architecture/database-schema.md — maintenance domain schema
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { learn, formatLearnReport } from '../helpers/learner.js';
import { createSandboxDb } from '../helpers/sandbox-db.js';
import { seedBaseData } from '../helpers/fixtures.js';
import * as maintenanceRobot from '../../server/robots/robot-maintenance.js';

const PROJECT_ROOT = resolve(fileURLToPath(import.meta.url), '../../../..');

before(async () => {
    const context = await learn('unit', PROJECT_ROOT);
    console.log('\n' + formatLearnReport(context) + '\n');
});

// ---------------------------------------------------------------
// SUITE: createMaintenanceCase
// ---------------------------------------------------------------
describe('robot-maintenance.createMaintenanceCase()', () => {
    let db;
    let seeded;

    before(async () => {
        db = await createSandboxDb();
        await db.reset();
        seeded = await seedBaseData(db);
    });

    it('inserts a row in maintenance_cases with NEW status and an SZ<YY><NN> code', async () => {
        const { caseId, caseCode } = await maintenanceRobot.createMaintenanceCase(
            seeded.customerId,
            'Espresso machine not heating up'
        );
        assert.ok(caseId > 0, 'caseId should be a positive integer');
        // CK's own Excel-based numbering format — see docs/.notes/differences-from-excel.md
        assert.match(caseCode, /^SZ\d{2}\d{2,}$/);

        const row = await db.get('SELECT * FROM maintenance_cases WHERE case_id = ?', [caseId]);
        assert.equal(row.current_status, 'NEW');
        assert.equal(row.cust_id, seeded.customerId);
        assert.equal(row.case_code, caseCode);
    });

    it('resets the case code sequence per calendar year, incrementing within it', async () => {
        const first = await maintenanceRobot.createMaintenanceCase(seeded.customerId);
        const second = await maintenanceRobot.createMaintenanceCase(seeded.customerId);
        const yy = String(new Date().getFullYear()).slice(-2);
        const firstSeq = parseInt(first.caseCode.slice(4), 10);
        const secondSeq = parseInt(second.caseCode.slice(4), 10);
        assert.ok(first.caseCode.startsWith(`SZ${yy}`));
        assert.ok(second.caseCode.startsWith(`SZ${yy}`));
        assert.equal(secondSeq, firstSeq + 1, 'sequence must increment by 1 within the same year');
    });

    it('accepts an assignedTo value', async () => {
        const { caseId } = await maintenanceRobot.createMaintenanceCase(
            seeded.customerId, 'Test issue', 'Gábor'
        );
        const row = await db.get('SELECT assigned_to FROM maintenance_cases WHERE case_id = ?', [caseId]);
        assert.equal(row.assigned_to, 'Gábor');
    });

    it('creates an initial NEW entry in maintenance_status_history (dual-write on creation)', async () => {
        const { caseId } = await maintenanceRobot.createMaintenanceCase(seeded.customerId);
        const historyRow = await db.get(
            "SELECT * FROM maintenance_status_history WHERE case_id = ? AND status = 'NEW'",
            [caseId]
        );
        assert.ok(historyRow, 'Initial NEW history entry must exist');
        assert.equal(historyRow.performed_by, 'SYSTEM');
    });

    it('accepts a null description', async () => {
        const { caseId } = await maintenanceRobot.createMaintenanceCase(seeded.customerId);
        const row = await db.get('SELECT description FROM maintenance_cases WHERE case_id = ?', [caseId]);
        assert.equal(row.description, null);
    });
});

// ---------------------------------------------------------------
// SUITE: updateMaintenanceStatus — Dual-Write Rule
// ---------------------------------------------------------------
describe('robot-maintenance.updateMaintenanceStatus() — Dual-Write Rule', () => {
    let db;
    let caseId;

    before(async () => {
        db = await createSandboxDb();
        await db.reset();
        const seeded = await seedBaseData(db);
        const result = await maintenanceRobot.createMaintenanceCase(seeded.customerId);
        caseId = result.caseId;
    });

    it('updates maintenance_cases.current_status to the new status', async () => {
        await maintenanceRobot.updateMaintenanceStatus(caseId, 'SCHEDULED', 'tech', 'Repair scheduled');
        const row = await db.get('SELECT current_status FROM maintenance_cases WHERE case_id = ?', [caseId]);
        assert.equal(row.current_status, 'SCHEDULED');
    });

    it('inserts a matching row in maintenance_status_history (dual-write)', async () => {
        await maintenanceRobot.updateMaintenanceStatus(caseId, 'IN_REPAIR', 'tech', 'Repair started');
        const histRow = await db.get(
            "SELECT * FROM maintenance_status_history WHERE case_id = ? AND status = 'IN_REPAIR'",
            [caseId]
        );
        assert.ok(histRow, 'History row must exist for dual-write');
        assert.equal(histRow.performed_by, 'tech');
    });

    it('throws an error for an invalid status key (before any DB write)', async () => {
        await assert.rejects(
            () => maintenanceRobot.updateMaintenanceStatus(caseId, 'INVALID_XYZ', 'tech', 'Bad status'),
            /Invalid maintenance status/
        );
    });

    it('leaves maintenance_cases.current_status unchanged after an invalid status attempt', async () => {
        const before = await db.get('SELECT current_status FROM maintenance_cases WHERE case_id = ?', [caseId]);
        try {
            await maintenanceRobot.updateMaintenanceStatus(caseId, 'BOGUS', 'tech', 'Should fail');
        } catch { /* expected */ }
        const after = await db.get('SELECT current_status FROM maintenance_cases WHERE case_id = ?', [caseId]);
        assert.equal(before.current_status, after.current_status);
    });
});

// ---------------------------------------------------------------
// SUITE: addMaintenanceItem
// ---------------------------------------------------------------
describe('robot-maintenance.addMaintenanceItem()', () => {
    let db;
    let seeded;
    let caseId;

    before(async () => {
        db = await createSandboxDb();
        await db.reset();
        seeded = await seedBaseData(db);
        const result = await maintenanceRobot.createMaintenanceCase(seeded.customerId);
        caseId = result.caseId;
    });

    it('inserts a row in maintenance_items with the given quantity and issue note', async () => {
        const { id } = await maintenanceRobot.addMaintenanceItem(
            caseId, seeded.productId, 2, 'Rust on handle'
        );
        assert.ok(id > 0);

        const row = await db.get('SELECT * FROM maintenance_items WHERE item_id = ?', [id]);
        assert.equal(row.case_id, caseId);
        assert.equal(row.prod_id, seeded.productId);
        assert.equal(row.quantity, 2);
        assert.equal(row.issue_note, 'Rust on handle');
    });

    it('respects the foreign key constraint for a nonexistent product', async () => {
        await assert.rejects(
            () => maintenanceRobot.addMaintenanceItem(caseId, 999999, 1, 'test')
        );
    });
});

// ---------------------------------------------------------------
// SUITE: updateMaintenanceCase (field edits, not status transitions)
// ---------------------------------------------------------------
describe('robot-maintenance.updateMaintenanceCase()', () => {
    let db;
    let caseId;

    before(async () => {
        db = await createSandboxDb();
        await db.reset();
        const seeded = await seedBaseData(db);
        const result = await maintenanceRobot.createMaintenanceCase(seeded.customerId);
        caseId = result.caseId;
    });

    it('updates assigned_to and pricing_note together', async () => {
        await maintenanceRobot.updateMaintenanceCase(caseId, {
            assigned_to: 'Judit',
            pricing_note: '69.44 EUR + VAT, sent via SMS',
        });
        const row = await db.get(
            'SELECT assigned_to, pricing_note FROM maintenance_cases WHERE case_id = ?', [caseId]
        );
        assert.equal(row.assigned_to, 'Judit');
        assert.equal(row.pricing_note, '69.44 EUR + VAT, sent via SMS');
    });

    it('only updates the field(s) explicitly provided', async () => {
        await maintenanceRobot.updateMaintenanceCase(caseId, { assigned_to: 'Gábor' });
        const row = await db.get(
            'SELECT assigned_to, pricing_note FROM maintenance_cases WHERE case_id = ?', [caseId]
        );
        assert.equal(row.assigned_to, 'Gábor');
        assert.equal(row.pricing_note, '69.44 EUR + VAT, sent via SMS', 'untouched field must be unchanged');
    });

    it('throws when no fields are provided', async () => {
        await assert.rejects(() => maintenanceRobot.updateMaintenanceCase(caseId, {}), /No fields/);
    });
});

// ---------------------------------------------------------------
// SUITE: getMaintenanceWorkflowStatuses / getMaintenanceDetails
// ---------------------------------------------------------------
describe('robot-maintenance.getMaintenanceWorkflowStatuses()', () => {
    let db;

    before(async () => {
        db = await createSandboxDb();
        await db.reset();
    });

    it('returns all 9 seeded maintenance workflow statuses', async () => {
        const statuses = await maintenanceRobot.getMaintenanceWorkflowStatuses();
        assert.equal(statuses.length, 9);
    });
});

describe('robot-maintenance.getMaintenanceDetails()', () => {
    let db;
    let seeded;
    let caseId;

    before(async () => {
        db = await createSandboxDb();
        await db.reset();
        seeded = await seedBaseData(db);
        const result = await maintenanceRobot.createMaintenanceCase(seeded.customerId, 'Test issue');
        caseId = result.caseId;
        await maintenanceRobot.addMaintenanceItem(caseId, seeded.productId, 1, 'Test note');
    });

    it('returns the case, its items, and its history together', async () => {
        const details = await maintenanceRobot.getMaintenanceDetails(caseId);
        assert.equal(details.case.case_id, caseId);
        assert.equal(details.items.length, 1);
        assert.equal(details.items[0].issue_note, 'Test note');
        assert.ok(details.history.length >= 1);
    });
});
