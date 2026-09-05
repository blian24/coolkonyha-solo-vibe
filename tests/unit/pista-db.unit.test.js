/**
 * @fileoverview Unit Tests — PISTA DB Robot Business Logic
 *
 * Tests real server/robots/robot-pista-db.js functions directly against an
 * in-memory sandbox SQLite DB (server/db.js switched to ':memory:' — see
 * tests/run-tests.js). The production coolkonyha.db is never opened.
 *
 * INTENTIONALLY NOT COVERED: saveChatMessage() and getChatHistory(). Both
 * reference a `pista_chat_logs` table that does not exist in production —
 * confirmed via direct schema introspection while scoping this suite, see
 * docs/.notes/bugs.md b-8. Adding that table to the sandbox schema would
 * make docs/setup_complete_db.sql diverge from real production, defeating
 * the whole point of testing against an accurate schema (see i-2). Creating
 * the table for real is a feature decision tied to wiring P.I.S.T.A. into
 * the live server (i-3), not a test-writing task — left alone here.
 *
 * Two real bugs were found and fixed while writing this suite:
 * getRecentEmailsByAddress() and insertPendingEmail() queried columns
 * (sender_email/receiver_email) that don't exist on processed_emails (the
 * real columns are from_address/to_address) — fixed as part of this change.
 * getSenderRule() also gained the same graceful-degradation try/catch its
 * sibling getSenderRules() already had, since sender_rules doesn't exist in
 * production yet either.
 *
 * @see docs/architecture/database-schema.md — processed_emails, sender_rules schema
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { learn, formatLearnReport } from '../helpers/learner.js';
import { createSandboxDb } from '../helpers/sandbox-db.js';
import * as pistaDbRobot from '../../server/robots/robot-pista-db.js';

const PROJECT_ROOT = resolve(fileURLToPath(import.meta.url), '../../../..');

before(async () => {
    const context = await learn('unit', PROJECT_ROOT);
    console.log('\n' + formatLearnReport(context) + '\n');
});

// ---------------------------------------------------------------
// SUITE: Processed Emails — insert, dedupe, status update
// ---------------------------------------------------------------
describe('robot-pista-db processed_emails operations', () => {
    let db;

    before(async () => {
        db = await createSandboxDb();
        await db.reset();
    });

    it('insertPendingEmail() inserts a row with status pending', async () => {
        await pistaDbRobot.insertPendingEmail({
            messageId: 'msg-1',
            direction: 'received',
            fromAddress: 'client@example.com',
            toAddress: 'ck@coolkonyha.com',
            subject: 'Order inquiry',
            emailDate: '2026-01-01T10:00:00Z',
        });
        const row = await db.get(
            'SELECT * FROM processed_emails WHERE gmail_message_id = ?', ['msg-1']
        );
        assert.ok(row, 'Row must exist after insert');
        assert.equal(row.status, 'pending');
        assert.equal(row.from_address, 'client@example.com');
        assert.equal(row.to_address, 'ck@coolkonyha.com');
    });

    it('insertPendingEmail() is idempotent (INSERT OR IGNORE on duplicate message ID)', async () => {
        await pistaDbRobot.insertPendingEmail({
            messageId: 'msg-1',
            direction: 'received',
            fromAddress: 'someone-else@example.com',
            toAddress: 'ck@coolkonyha.com',
            subject: 'Should be ignored',
            emailDate: '2026-01-02T10:00:00Z',
        });
        const rows = await db.all(
            'SELECT * FROM processed_emails WHERE gmail_message_id = ?', ['msg-1']
        );
        assert.equal(rows.length, 1, 'Duplicate insert must not create a second row');
        assert.equal(rows[0].from_address, 'client@example.com', 'Original row must be unchanged');
    });

    it('updateEmailStatus() updates status and ai_summary', async () => {
        await pistaDbRobot.updateEmailStatus('msg-1', 'processed', 'Customer confirmed the order.');
        const row = await db.get(
            'SELECT status, ai_summary FROM processed_emails WHERE gmail_message_id = ?', ['msg-1']
        );
        assert.equal(row.status, 'processed');
        assert.equal(row.ai_summary, 'Customer confirmed the order.');
    });

    it('getRecentEmailsByAddress() finds emails by from_address or to_address', async () => {
        const results = await pistaDbRobot.getRecentEmailsByAddress('client@example.com');
        assert.equal(results.length, 1);
        assert.equal(results[0].gmail_message_id, 'msg-1');
    });

    it('getRecentEmailsByAddress() returns empty array for an unknown address', async () => {
        const results = await pistaDbRobot.getRecentEmailsByAddress('nobody@example.com');
        assert.deepEqual(results, []);
    });

    it('filterUnprocessedEmailIds() excludes already-known message IDs', async () => {
        const result = await pistaDbRobot.filterUnprocessedEmailIds(['msg-1', 'msg-2', 'msg-3']);
        assert.deepEqual(result, ['msg-2', 'msg-3']);
    });

    it('filterUnprocessedEmailIds() returns an empty array for an empty input', async () => {
        const result = await pistaDbRobot.filterUnprocessedEmailIds([]);
        assert.deepEqual(result, []);
    });

    it('getProcessedEmails() returns the row joined with linked_order_code (null when unlinked)', async () => {
        const rows = await pistaDbRobot.getProcessedEmails();
        assert.equal(rows.length, 1);
        assert.equal(rows[0].linked_order_code, null);
    });
});

// ---------------------------------------------------------------
// SUITE: Sender Rules — graceful degradation (table doesn't exist yet)
// ---------------------------------------------------------------
describe('robot-pista-db sender_rules graceful degradation', () => {
    before(async () => {
        const db = await createSandboxDb();
        await db.reset();
    });

    it('getSenderRules() returns an empty array instead of throwing', async () => {
        const rules = await pistaDbRobot.getSenderRules();
        assert.deepEqual(rules, []);
    });

    it('getSenderRule() returns undefined instead of throwing', async () => {
        const rule = await pistaDbRobot.getSenderRule('someone@example.com', 'example.com');
        assert.equal(rule, undefined);
    });
});
