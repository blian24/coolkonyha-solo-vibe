/**
 * @fileoverview One-off migration: align the Maintenance domain with CK's
 * real Excel-based workflow (docs/.notes/data-samples/Szerviz - Coolkonyha.xlsx).
 *
 * - Adds maintenance_cases.assigned_to and .pricing_note columns.
 * - Remaps existing current_status / history values away from the four
 *   dropped workflow keys (DIAGNOSED, PARTS_ORDERED, TESTING, INVOICED —
 *   none of which appeared in 5 years of CK's real usage) to their closest
 *   real-vocabulary replacement.
 * - Replaces the maintenance_status_workflow seed data with the revised
 *   9-state list (see docs/architecture/database-schema.md).
 * - Regenerates every existing case_code in CK's own SZ<YY><NN> format
 *   (yearly-reset sequence), ordered by case_date within each year.
 *
 * Run once against the real coolkonyha.db: `node scripts/migrate_maintenance_v2.js`
 * @see docs/.notes/future-ideas.md i-10
 */
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, '../coolkonyha.db');

const db = new sqlite3.Database(DB_PATH);

const run = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
    });
});

const all = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

const STATUS_REMAP = {
    DIAGNOSED: 'SCHEDULED',
    PARTS_ORDERED: 'WAITING',
    TESTING: 'IN_REPAIR',
    INVOICED: 'CLOSED',
};

const NEW_WORKFLOW = [
    ['NEW', 'New', 'Maintenance request received', 0, '#F1F3F4'],
    ['QUOTE_SENT', 'Quote Sent', 'Price quote sent to customer', 0, '#FFF9C4'],
    ['SCHEDULED', 'Scheduled', 'Repair work has been scheduled', 1, '#FFD54F'],
    ['WAITING', 'Waiting', 'Waiting on parts, customer, or a third party', 1, '#FB8C00'],
    ['IN_REPAIR', 'In Repair', 'Active repair work in progress', 0, '#E64A19'],
    ['ON_HOLD', 'On Hold', 'Work paused, may resume later', 0, '#9E9E9E'],
    ['READY', 'Ready', 'Repair complete, awaiting handover', 0, '#90CAF9'],
    ['CLOSED', 'Closed', 'Maintenance case fully completed', 0, '#2E7D32'],
    ['CANCELLED', 'Cancelled', 'Case was cancelled', 0, '#C62828'],
];

const migrate = async () => {
    console.log('Step 1: adding assigned_to and pricing_note columns...');
    await run('ALTER TABLE maintenance_cases ADD COLUMN assigned_to TEXT');
    await run('ALTER TABLE maintenance_cases ADD COLUMN pricing_note TEXT');

    console.log('Step 2: remapping dropped status keys on existing rows...');
    for (const [oldStatus, newStatus] of Object.entries(STATUS_REMAP)) {
        const c1 = await run(
            'UPDATE maintenance_cases SET current_status = ? WHERE current_status = ?',
            [newStatus, oldStatus]
        );
        const c2 = await run(
            'UPDATE maintenance_status_history SET status = ? WHERE status = ?',
            [newStatus, oldStatus]
        );
        console.log(`  ${oldStatus} -> ${newStatus}: ${c1.changes} case(s), ${c2.changes} history row(s)`);
    }

    console.log('Step 3: replacing maintenance_status_workflow seed data...');
    await run('DELETE FROM maintenance_status_workflow');
    await run(`DELETE FROM sqlite_sequence WHERE name = 'maintenance_status_workflow'`);
    for (const row of NEW_WORKFLOW) {
        await run(
            `INSERT INTO maintenance_status_workflow
                (status_key, display_name, description, is_skippable, status_color)
             VALUES (?, ?, ?, ?, ?)`,
            row
        );
    }

    console.log('Step 4: regenerating case codes in SZ<YY><NN> format...');
    const cases = await all('SELECT case_id, case_date FROM maintenance_cases ORDER BY case_date ASC');
    const yearCounters = {};
    for (const c of cases) {
        const year = new Date(c.case_date).getFullYear();
        yearCounters[year] = (yearCounters[year] || 0) + 1;
        const yy = String(year).slice(-2);
        const seq = String(yearCounters[year]).padStart(2, '0');
        const newCode = `SZ${yy}${seq}`;
        await run('UPDATE maintenance_cases SET case_code = ? WHERE case_id = ?', [newCode, c.case_id]);
    }
    console.log(`  Regenerated ${cases.length} case code(s).`);

    console.log('Migration complete.');
};

migrate()
    .then(() => db.close())
    .catch((err) => {
        console.error('Migration failed:', err);
        db.close();
        process.exit(1);
    });
