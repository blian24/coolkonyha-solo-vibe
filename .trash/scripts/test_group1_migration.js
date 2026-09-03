/**
 * @file test_group1_migration.js
 * @description Verification test for Group 1: Database Foundation.
 *              Confirms the migration completed with the correct schema and data.
 *
 * @see docs/.impl_plans/Maintenance_Domain_v0.6.0_20260526-095200.md
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, '../coolkonyha.db');

const allAsync = (db, sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows);
  });
});

const getAsync = (db, sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});

let passed = 0;
let failed = 0;

const assert = (label, condition, detail = '') => {
  if (condition) {
    console.log(`   ✅ PASS: ${label}`);
    passed++;
  } else {
    console.error(`   ❌ FAIL: ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
};

async function runTests() {
  console.log('🧪 Running Group 1 verification tests...\n');
  const db = new sqlite3.Database(DB_PATH);
  await new Promise(resolve => db.once('open', resolve));

  const tables = await allAsync(db, "SELECT name FROM sqlite_master WHERE type='table'");
  const tableNames = tables.map(t => t.name);

  // ── TEST SUITE 1: Schema Presence ─────────────────────────────────────────
  console.log('── Suite 1: Schema Presence ──');

  assert(
    'order_status_workflow table exists (renamed from business_status_workflow)',
    tableNames.includes('order_status_workflow')
  );
  assert(
    'business_status_workflow table NO LONGER exists',
    !tableNames.includes('business_status_workflow')
  );
  assert('maintenance_cases table exists',          tableNames.includes('maintenance_cases'));
  assert('maintenance_items table exists',          tableNames.includes('maintenance_items'));
  assert('maintenance_status_history table exists', tableNames.includes('maintenance_status_history'));
  assert('maintenance_status_workflow table exists',tableNames.includes('maintenance_status_workflow'));

  // ── TEST SUITE 2: Schema Integrity (Foreign Keys) ─────────────────────────
  console.log('\n── Suite 2: Schema Integrity ──');

  const casesSql = await getAsync(db, "SELECT sql FROM sqlite_master WHERE name='maintenance_cases'");
  assert(
    'maintenance_cases references customers(cust_id)',
    casesSql?.sql?.includes('REFERENCES customers(cust_id)')
  );

  const itemsSql = await getAsync(db, "SELECT sql FROM sqlite_master WHERE name='maintenance_items'");
  assert(
    'maintenance_items references maintenance_cases(case_id)',
    itemsSql?.sql?.includes('REFERENCES maintenance_cases(case_id)')
  );
  assert(
    'maintenance_items references products(prod_id)',
    itemsSql?.sql?.includes('REFERENCES products(prod_id)')
  );

  const historySql = await getAsync(db, "SELECT sql FROM sqlite_master WHERE name='maintenance_status_history'");
  assert(
    'maintenance_status_history references maintenance_cases(case_id)',
    historySql?.sql?.includes('REFERENCES maintenance_cases(case_id)')
  );

  // ── TEST SUITE 3: Data Integrity ──────────────────────────────────────────
  console.log('\n── Suite 3: Data Integrity ──');

  const workflowCount = await getAsync(db, 'SELECT COUNT(*) as cnt FROM maintenance_status_workflow');
  assert('maintenance_status_workflow has 9 status entries', workflowCount.cnt === 9, `found ${workflowCount.cnt}`);

  const caseCount = await getAsync(db, 'SELECT COUNT(*) as cnt FROM maintenance_cases');
  assert('maintenance_cases has 3 dummy entries', caseCount.cnt === 3, `found ${caseCount.cnt}`);

  const itemCount = await getAsync(db, 'SELECT COUNT(*) as cnt FROM maintenance_items');
  assert('maintenance_items has 3 entries (one per case)', itemCount.cnt === 3, `found ${itemCount.cnt}`);

  const historyCount = await getAsync(db, 'SELECT COUNT(*) as cnt FROM maintenance_status_history');
  assert('maintenance_status_history has 13 history entries (8+3+2)', historyCount.cnt === 13, `found ${historyCount.cnt}`);

  // Confirm dummy cases use existing products (FK integrity)
  const fkCheck = await getAsync(db, `
    SELECT COUNT(*) as cnt
    FROM maintenance_items mi
    JOIN products p ON mi.prod_id = p.prod_id
  `);
  assert(
    'All maintenance_items reference valid existing products',
    fkCheck.cnt === 3,
    `joined rows: ${fkCheck.cnt}`
  );

  // Confirm dummy cases use existing customers (FK integrity)
  const fkCustCheck = await getAsync(db, `
    SELECT COUNT(*) as cnt
    FROM maintenance_cases mc
    JOIN customers c ON mc.cust_id = c.cust_id
  `);
  assert(
    'All maintenance_cases reference valid existing customers',
    fkCustCheck.cnt === 3,
    `joined rows: ${fkCustCheck.cnt}`
  );

  // ── TEST SUITE 4: Order Regression ────────────────────────────────────────
  console.log('\n── Suite 4: Order Regression (renamed table did not break order data) ──');

  const orderWorkflowCount = await getAsync(db, 'SELECT COUNT(*) as cnt FROM order_status_workflow');
  assert(
    'order_status_workflow retains all 10 original statuses',
    orderWorkflowCount.cnt === 10,
    `found ${orderWorkflowCount.cnt}`
  );

  const orderCount = await getAsync(db, 'SELECT COUNT(*) as cnt FROM orders');
  assert('orders table still has data', orderCount.cnt > 0, `found ${orderCount.cnt}`);

  const orderHistoryCount = await getAsync(db, 'SELECT COUNT(*) as cnt FROM order_status_history');
  assert('order_status_history still has data', orderHistoryCount.cnt > 0, `found ${orderHistoryCount.cnt}`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`🏁 Tests complete: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error('❌ Some tests FAILED — review the output above.');
  } else {
    console.log('🎉 All tests passed — Group 1 is verified!');
  }

  db.close();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Unhandled error in test runner:', err);
  process.exit(1);
});
