/**
 * @file migrate_maintenance.js
 * @description One-off migration script for Group 1: Database Foundation.
 *              - Renames `business_status_workflow` to `order_status_workflow`.
 *              - Creates the four maintenance domain tables.
 *              - Seeds dummy maintenance cases using existing products and customers.
 *
 * @see docs/.impl_plans/Maintenance_Domain_v0.6.0_20260526-095200.md
 * @see docs/architecture/database-schema.md
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, '../coolkonyha.db');

// --- Helpers ---

const runAsync = (db, sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) {
    if (err) reject(err);
    else resolve(this);
  });
});

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

// --- Main migration ---

async function migrate() {
  console.log('🚀 Starting maintenance domain migration (v0.6.0)...\n');
  const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) { console.error('❌ Cannot open database:', err.message); process.exit(1); }
    console.log('✅ Connected to coolkonyha.db\n');
  });

  try {
    // RULE: Run all DDL statements inside a transaction for atomicity.
    await runAsync(db, 'PRAGMA foreign_keys = ON;');
    await runAsync(db, 'BEGIN TRANSACTION;');

    // -----------------------------------------------------------------------
    // STEP 1: Rename business_status_workflow → order_status_workflow
    // -----------------------------------------------------------------------
    console.log('📋 Step 1: Renaming business_status_workflow → order_status_workflow...');
    const existing = await getAsync(
      db,
      "SELECT name FROM sqlite_master WHERE type='table' AND name='order_status_workflow'"
    );
    if (existing) {
      console.log('   ⚠️  order_status_workflow already exists, skipping rename.');
    } else {
      await runAsync(db, 'ALTER TABLE business_status_workflow RENAME TO order_status_workflow;');
      console.log('   ✅ Renamed successfully.');
    }

    // -----------------------------------------------------------------------
    // STEP 2: Create maintenance_cases
    // -----------------------------------------------------------------------
    console.log('\n📋 Step 2: Creating maintenance_cases table...');
    await runAsync(db, `
      CREATE TABLE IF NOT EXISTS maintenance_cases (
        case_id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        case_code                TEXT UNIQUE,
        cust_id                  INTEGER NOT NULL,
        case_date                DATETIME DEFAULT CURRENT_TIMESTAMP,
        description              TEXT,
        current_status           TEXT NOT NULL DEFAULT 'NEW',
        current_status_update    DATETIME DEFAULT CURRENT_TIMESTAMP,
        update_event             TEXT,
        notes                    TEXT,
        FOREIGN KEY (cust_id) REFERENCES customers(cust_id)
      );
    `);
    console.log('   ✅ maintenance_cases created.');

    // -----------------------------------------------------------------------
    // STEP 3: Create maintenance_items
    // -----------------------------------------------------------------------
    console.log('\n📋 Step 3: Creating maintenance_items table...');
    await runAsync(db, `
      CREATE TABLE IF NOT EXISTS maintenance_items (
        item_id     INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id     INTEGER NOT NULL,
        prod_id     INTEGER NOT NULL,
        quantity    INTEGER NOT NULL DEFAULT 1,
        issue_note  TEXT,
        FOREIGN KEY (case_id) REFERENCES maintenance_cases(case_id),
        FOREIGN KEY (prod_id) REFERENCES products(prod_id)
      );
    `);
    console.log('   ✅ maintenance_items created.');

    // -----------------------------------------------------------------------
    // STEP 4: Create maintenance_status_history
    // -----------------------------------------------------------------------
    console.log('\n📋 Step 4: Creating maintenance_status_history table...');
    await runAsync(db, `
      CREATE TABLE IF NOT EXISTS maintenance_status_history (
        history_id   INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id      INTEGER NOT NULL,
        status       TEXT NOT NULL,
        update_date  DATETIME DEFAULT CURRENT_TIMESTAMP,
        update_event TEXT,
        performed_by TEXT,
        FOREIGN KEY (case_id) REFERENCES maintenance_cases(case_id)
      );
    `);
    console.log('   ✅ maintenance_status_history created.');

    // -----------------------------------------------------------------------
    // STEP 5: Create maintenance_status_workflow (independent from orders)
    // -----------------------------------------------------------------------
    console.log('\n📋 Step 5: Creating maintenance_status_workflow table...');
    await runAsync(db, `
      CREATE TABLE IF NOT EXISTS maintenance_status_workflow (
        status_id    INTEGER PRIMARY KEY AUTOINCREMENT,
        status_key   TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        description  TEXT,
        is_skippable BOOLEAN DEFAULT FALSE,
        status_color TEXT
      );
    `);

    // Seed workflow statuses only if the table is freshly created (empty)
    const workflowCount = await getAsync(db, 'SELECT COUNT(*) as cnt FROM maintenance_status_workflow');
    if (workflowCount.cnt === 0) {
      const maintenanceStatuses = [
        { key: 'NEW',           name: 'New',            desc: 'Maintenance request received',          skip: 0, color: '#F1F3F4' },
        { key: 'DIAGNOSED',     name: 'Diagnosed',      desc: 'Issue has been assessed',               skip: 0, color: '#FFF9C4' },
        { key: 'PARTS_ORDERED', name: 'Parts Ordered',  desc: 'Replacement parts have been ordered',   skip: 1, color: '#FFD54F' },
        { key: 'IN_REPAIR',     name: 'In Repair',      desc: 'Active repair work in progress',        skip: 0, color: '#FB8C00' },
        { key: 'TESTING',       name: 'Testing',        desc: 'Repaired unit under quality testing',   skip: 1, color: '#E1F5FE' },
        { key: 'READY',         name: 'Ready',          desc: 'Repair complete, awaiting handover',    skip: 0, color: '#90CAF9' },
        { key: 'INVOICED',      name: 'Invoiced',       desc: 'Service invoice sent to customer',      skip: 0, color: '#A5D6A7' },
        { key: 'CLOSED',        name: 'Closed',         desc: 'Maintenance case fully completed',      skip: 0, color: '#2E7D32' },
        { key: 'CANCELLED',     name: 'Cancelled',      desc: 'Case was cancelled',                    skip: 0, color: '#C62828' },
      ];
      for (const s of maintenanceStatuses) {
        await runAsync(db,
          `INSERT INTO maintenance_status_workflow (status_key, display_name, description, is_skippable, status_color)
           VALUES (?, ?, ?, ?, ?)`,
          [s.key, s.name, s.desc, s.skip, s.color]
        );
      }
      console.log(`   ✅ maintenance_status_workflow created and seeded with ${maintenanceStatuses.length} statuses.`);
    } else {
      console.log('   ⚠️  maintenance_status_workflow already has data, skipping status seed.');
    }

    // -----------------------------------------------------------------------
    // STEP 6: Seed dummy maintenance cases
    // RULE: Uses existing products and customers from the live DB.
    // -----------------------------------------------------------------------
    console.log('\n📋 Step 6: Seeding dummy maintenance cases...');

    const caseCount = await getAsync(db, 'SELECT COUNT(*) as cnt FROM maintenance_cases');
    if (caseCount.cnt > 0) {
      console.log('   ⚠️  maintenance_cases already contains data, skipping seed.');
    } else {
      // Case 1: Green Leaf Restaurant (cust_id=2) — Italian Espresso Machine (prod_id=5) — CLOSED
      const case1 = await runAsync(db,
        `INSERT INTO maintenance_cases (case_code, cust_id, description, current_status, update_event)
         VALUES ('MAINT-00001', 2, 'Espresso machine not heating up correctly after 2 years of use.', 'CLOSED', 'Maintenance completed and paid')`,
        []
      );
      await runAsync(db,
        `INSERT INTO maintenance_items (case_id, prod_id, quantity, issue_note) VALUES (?, 5, 1, 'Heating element failure, thermostat replaced.')`,
        [case1.lastID]
      );
      const case1Statuses = [
        { status: 'NEW',           event: 'Maintenance case opened',              by: 'SYSTEM' },
        { status: 'DIAGNOSED',     event: 'Heating element failure identified',   by: 'technician.bela' },
        { status: 'PARTS_ORDERED', event: 'Thermostat unit ordered from supplier', by: 'technician.bela' },
        { status: 'IN_REPAIR',     event: 'Thermostat replaced, reassembly done', by: 'technician.bela' },
        { status: 'TESTING',       event: 'Machine running 48-hour heat test',    by: 'qa.team' },
        { status: 'READY',         event: 'Test passed, ready for customer',      by: 'qa.team' },
        { status: 'INVOICED',      event: 'Service invoice #SRV-2025-001 sent',   by: 'billing.team' },
        { status: 'CLOSED',        event: 'Maintenance completed and paid',       by: 'billing.team' },
      ];
      for (const s of case1Statuses) {
        await runAsync(db,
          `INSERT INTO maintenance_status_history (case_id, status, update_event, performed_by) VALUES (?, ?, ?, ?)`,
          [case1.lastID, s.status, s.event, s.by]
        );
      }

      // Case 2: Café Vienna (cust_id=4) — Cast Iron Skillet (prod_id=9) — IN_REPAIR
      const case2 = await runAsync(db,
        `INSERT INTO maintenance_cases (case_code, cust_id, description, current_status, update_event)
         VALUES ('MAINT-00002', 4, 'Cast iron skillet developed rust patches and handle is loose.', 'IN_REPAIR', 'Reseasoning and handle repair in progress')`,
        []
      );
      await runAsync(db,
        `INSERT INTO maintenance_items (case_id, prod_id, quantity, issue_note) VALUES (?, 9, 1, 'Rust removal, re-seasoning, and handle bolt replacement needed.')`,
        [case2.lastID]
      );
      const case2Statuses = [
        { status: 'NEW',       event: 'Maintenance case opened',                    by: 'SYSTEM' },
        { status: 'DIAGNOSED', event: 'Rust and loose handle confirmed on-site',    by: 'technician.mark' },
        { status: 'IN_REPAIR', event: 'Reseasoning and handle repair in progress',  by: 'technician.mark' },
      ];
      for (const s of case2Statuses) {
        await runAsync(db,
          `INSERT INTO maintenance_status_history (case_id, status, update_event, performed_by) VALUES (?, ?, ?, ?)`,
          [case2.lastID, s.status, s.event, s.by]
        );
      }

      // Case 3: Hotel Royal Kitchen (cust_id=5) — Professional Blender (prod_id=10) — DIAGNOSED
      const case3 = await runAsync(db,
        `INSERT INTO maintenance_cases (case_code, cust_id, description, current_status, update_event)
         VALUES ('MAINT-00003', 5, 'Industrial blender motor making grinding noise during operation.', 'DIAGNOSED', 'Bearing wear confirmed, awaiting parts decision')`,
        []
      );
      await runAsync(db,
        `INSERT INTO maintenance_items (case_id, prod_id, quantity, issue_note) VALUES (?, 10, 1, 'Motor bearing wear diagnosed.')`,
        [case3.lastID]
      );
      const case3Statuses = [
        { status: 'NEW',       event: 'Maintenance case opened',                            by: 'SYSTEM' },
        { status: 'DIAGNOSED', event: 'Bearing wear confirmed, awaiting parts decision',    by: 'technician.bela' },
      ];
      for (const s of case3Statuses) {
        await runAsync(db,
          `INSERT INTO maintenance_status_history (case_id, status, update_event, performed_by) VALUES (?, ?, ?, ?)`,
          [case3.lastID, s.status, s.event, s.by]
        );
      }

      console.log('   ✅ 3 dummy maintenance cases seeded.');
    }

    await runAsync(db, 'COMMIT;');
    console.log('\n🎉 Migration completed successfully!\n');

  } catch (err) {
    await runAsync(db, 'ROLLBACK;').catch(() => {});
    console.error('\n❌ Migration failed, rolled back:', err.message);
    db.close();
    process.exit(1);
  }

  db.close(() => {
    console.log('🔒 Database connection closed.');
    process.exit(0);
  });
}

migrate();
