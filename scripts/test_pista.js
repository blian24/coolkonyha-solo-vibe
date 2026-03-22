/**
 * @fileoverview P.I.S.T.A. Simulation Script
 *
 * Run this locally to verify the P.I.S.T.A. agent's reasoning against
 * mock data WITHOUT needing the full Express server running.
 *
 * Prerequisites:
 *   1. Copy .env.example to .env and add your GEMINI_API_KEY
 *   2. Ensure the SQLite DB at ./ck.db exists (or let this script seed a temp DB)
 *
 * Usage:
 *   node scripts/test_pista.js
 *
 * @see docs/assistant_team/pista-agent.md — Persona & architecture
 * @see server/pista.js                    — Agent implementation
 */

import 'dotenv/config';
import sqlite3 from 'sqlite3';
import PistaAgent from '../server/pista.js';

// ---------------------------------------------------------------------------
// 1. Bootstrap: create an in-memory SQLite DB with seed data
//    so this script works standalone without the production DB.
// ---------------------------------------------------------------------------

/**
 * Builds an in-memory SQLite database seeded with realistic test data.
 * Returns a DBRobot-compatible object that wraps it.
 *
 * @returns {Promise<object>} A minimal DBRobot-compatible adapter
 */
async function createSandboxDB() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(':memory:', async (err) => {
      if (err) return reject(err);

      // Helper promisifications for setup
      const run = (sql, params = []) =>
        new Promise((res, rej) =>
          db.run(sql, params, function (e) { if (e) rej(e); else res(this); })
        );
      const all = (sql, params = []) =>
        new Promise((res, rej) =>
          db.all(sql, params, (e, rows) => { if (e) rej(e); else res(rows); })
        );
      const get = (sql, params = []) =>
        new Promise((res, rej) =>
          db.get(sql, params, (e, row) => { if (e) rej(e); else res(row); })
        );

      try {
        // Schema
        await run('PRAGMA foreign_keys = ON');
        await run(`CREATE TABLE customers (
          cust_id INTEGER PRIMARY KEY AUTOINCREMENT,
          cust_name TEXT NOT NULL,
          cust_email TEXT,
          cust_email2 TEXT,
          cust_contact TEXT,
          cust_phone TEXT
        )`);
        await run(`CREATE TABLE business_status_workflow (
          status_id INTEGER PRIMARY KEY AUTOINCREMENT,
          status_key TEXT UNIQUE NOT NULL,
          status_label TEXT NOT NULL
        )`);
        await run(`CREATE TABLE orders (
          order_id INTEGER PRIMARY KEY AUTOINCREMENT,
          cust_id INTEGER NOT NULL REFERENCES customers(cust_id),
          order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          current_status TEXT NOT NULL DEFAULT 'NEW',
          current_status_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          update_event TEXT,
          total_amount REAL DEFAULT 0,
          currency TEXT DEFAULT 'HUF'
        )`);
        await run(`CREATE TABLE order_status_history (
          history_id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id INTEGER NOT NULL REFERENCES orders(order_id),
          status TEXT NOT NULL,
          update_event TEXT,
          performed_by TEXT,
          update_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        await run(`CREATE TABLE products (
          prod_id INTEGER PRIMARY KEY AUTOINCREMENT,
          prod_name TEXT NOT NULL,
          unit_price REAL NOT NULL
        )`);
        await run(`CREATE TABLE order_items (
          item_id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id INTEGER NOT NULL REFERENCES orders(order_id),
          prod_id INTEGER NOT NULL REFERENCES products(prod_id),
          quantity INTEGER NOT NULL,
          unit_price REAL NOT NULL
        )`);
        await run(`CREATE TABLE processed_emails (
          email_id INTEGER PRIMARY KEY AUTOINCREMENT,
          gmail_message_id TEXT UNIQUE,
          direction TEXT,
          email_date TIMESTAMP,
          sender_email TEXT,
          receiver_email TEXT,
          subject TEXT,
          ai_summary TEXT,
          linked_order_id INTEGER,
          status TEXT DEFAULT 'pending'
        )`);

        // Seed data
        await run('INSERT INTO business_status_workflow (status_key, status_label) VALUES (?, ?)', ['NEW', 'New Order']);
        await run('INSERT INTO business_status_workflow (status_key, status_label) VALUES (?, ?)', ['OFFER_SENT', 'Offer Sent']);
        await run('INSERT INTO business_status_workflow (status_key, status_label) VALUES (?, ?)', ['IN_PROGRESS', 'In Progress']);
        await run('INSERT INTO business_status_workflow (status_key, status_label) VALUES (?, ?)', ['CLOSED', 'Closed']);

        await run('INSERT INTO customers (cust_name, cust_email) VALUES (?, ?)', ['Kovács Kft.', 'kovacs@kovacskft.hu']);

        // Order 1: 8 days stuck in NEW — should be flagged by health check
        await run(`INSERT INTO orders (cust_id, current_status, current_status_update, update_event)
          VALUES (1, 'NEW', datetime('now', '-8 days'), 'Order created via API')`);
        await run(`INSERT INTO order_status_history (order_id, status, update_event, performed_by)
          VALUES (1, 'NEW', 'Order created via API', 'SYSTEM')`);

        // Order 2: progressing normally
        await run(`INSERT INTO orders (cust_id, current_status, current_status_update, update_event)
          VALUES (1, 'OFFER_SENT', datetime('now', '-1 days'), 'Offer emailed to client')`);
        await run(`INSERT INTO order_status_history (order_id, status, update_event, performed_by)
          VALUES (2, 'OFFER_SENT', 'Offer emailed to client', 'CK')`);

        // Build a minimal DBRobot-compatible adapter for the sandbox DB
        const sandboxDBRobot = { all, get, run };

        resolve(sandboxDBRobot);
      } catch (setupErr) {
        reject(setupErr);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// 2. Mock Email Payloads
// ---------------------------------------------------------------------------

/**
 * Scenario A: Inbound email from a known customer about an existing order.
 */
const MOCK_EMAIL_ORDER_UPDATE = {
  gmail_message_id: 'mock-gmail-id-001',
  direction: 'INBOUND',
  from: 'kovacs@kovacskft.hu',
  to: 'ck@coolkonyha.hu',
  email_date: new Date().toISOString(),
  subject: 'RE: Árajánlat – Konyhabútor megrendelés',
  attachments: [{ filename: 'alairt_szerzodes.pdf', mimeType: 'application/pdf' }],
  newest_body_block:
    'Kedves CK! Köszönjük az ajánlatot. Elfogadjuk az árat, és csatoltam az aláírt szerződést. Kérjük a gyártás megkezdését! Üdvözlettel, Kovács',
  known_sender: true,
  rule: null,
};

/**
 * Scenario B (for health check): No email — P.I.S.T.A. runs a proactive scan.
 */

// ---------------------------------------------------------------------------
// 3. Run Simulations
// ---------------------------------------------------------------------------

async function runSimulation() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    console.error(
      '\n❌  Missing GEMINI_API_KEY.\n' +
      '   Copy .env.example → .env and set your real key.\n' +
      '   Get one at: https://aistudio.google.com/app/apikey\n'
    );
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('  P.I.S.T.A. Simulation — Local Test Harness');
  console.log('='.repeat(60));

  const dbRobot = await createSandboxDB();
  const pista = new PistaAgent(dbRobot, apiKey, {
    stuckOrderDays: parseInt(process.env.PISTA_STUCK_ORDER_DAYS ?? '3', 10),
    maxTokensPerRequest: parseInt(process.env.PISTA_MAX_TOKENS_PER_REQUEST ?? '200000', 10),
  });

  // ------ SCENARIO A: Incoming Email ------
  console.log('\n🔷  SCENARIO A: Incoming email from a known customer\n');
  try {
    const emailResult = await pista.receiveEmail(MOCK_EMAIL_ORDER_UPDATE);
    console.log('\n📋  P.I.S.T.A. Proposal:\n');
    console.log(JSON.stringify(emailResult, null, 2));
  } catch (err) {
    console.error('❌  Scenario A failed:', err.message);
  }

  // ------ SCENARIO B: Workflow Health Check ------
  console.log('\n' + '='.repeat(60));
  console.log('\n🔷  SCENARIO B: Proactive Workflow Health Check\n');
  try {
    const healthResult = await pista.checkWorkflowHealth();
    console.log('\n📋  P.I.S.T.A. Health Report:\n');
    console.log(JSON.stringify(healthResult, null, 2));
  } catch (err) {
    console.error('❌  Scenario B failed:', err.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('  Simulation complete. Review the proposals above.');
  console.log('  To approve an action: pass it to the appropriate DBRobot method.');
  console.log('='.repeat(60) + '\n');
}

runSimulation();
