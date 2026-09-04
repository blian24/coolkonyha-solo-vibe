/**
 * @fileoverview PISTA DB Robot — Data persistence layer for P.I.S.T.A. and the Email Robot.
 *
 * Single responsibility: all database operations required by the AI agent (pista.js)
 * and the deterministic email processor (robots/email-robot.js). This covers:
 * - Chat history persistence (pista_chat_logs table)
 * - Processed email records (processed_emails table)
 * - Sender rules (sender_rules table)
 * Deterministic robot — no AI logic.
 *
 * Depends on: server/db.js (shared SQLite connection singleton)
 * Consumed by: server/routes.js, server/pista.js, server/robots/email-robot.js
 *
 * @see docs/assistant_team/pista-agent.md — Chat history architecture
 * @see docs/architecture/database-schema.md — pista_chat_logs, processed_emails, sender_rules
 * @author Coolkonyha Development Team
 * @version 0.9.0
 */

import db from '../db.js';

// ---------------------------------------------------------------------------
// Helpers — promisified wrappers around the sqlite3 callback API
// ---------------------------------------------------------------------------

const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });

// ---------------------------------------------------------------------------
// Chat History
// @see docs/assistant_team/pista-agent.md — Chat history architecture
// ---------------------------------------------------------------------------

/**
 * Saves a single chat message to the persistent conversation log.
 *
 * @param {object} entry - Chat log entry
 * @param {number|null} entry.orderId - Linked order ID, or null for dashboard context
 * @param {'ck'|'pista'} entry.role - Who sent the message
 * @param {string} entry.message - Plain text message content
 * @param {string|null} [entry.proposal] - JSON-stringified P.I.S.T.A. proposal (pista role only)
 * @returns {Promise<{logId: number}>} ID of the created log entry
 */
export const saveChatMessage = async ({ orderId = null, role, message, proposal = null }) => {
  const result = await run(
    `INSERT INTO pista_chat_logs (order_id, role, message, proposal)
     VALUES (?, ?, ?, ?)`,
    [orderId, role, message, proposal ? JSON.stringify(proposal) : null]
  );
  return { logId: result.lastID };
};

/**
 * Retrieves the conversation history for a given context.
 *
 * @param {number|null} orderId - Order context, or null for dashboard
 * @param {number} [limit=50] - Maximum messages to return
 * @returns {Promise<Array>} Chat log entries ordered oldest-first
 */
export const getChatHistory = (orderId = null, limit = 50) =>
  // Subquery reverses the newest-first fetch to return oldest-first for rendering
  all(
    `SELECT * FROM (
       SELECT log_id, order_id, role, message, proposal, created_at
       FROM pista_chat_logs
       WHERE order_id IS ?
       ORDER BY created_at DESC
       LIMIT ?
     ) ORDER BY created_at ASC`,
    [orderId, limit]
  );

// ---------------------------------------------------------------------------
// Processed Emails
// ---------------------------------------------------------------------------

/**
 * Returns all processed email records joined with linked order code.
 * Returns empty array gracefully if the table does not yet exist.
 *
 * @returns {Promise<Array>}
 */
export const getProcessedEmails = async () => {
  try {
    return await all(
      `SELECT pe.*, o.order_code AS linked_order_code
       FROM processed_emails pe
       LEFT JOIN orders o ON pe.linked_order_id = o.order_id
       ORDER BY pe.email_date DESC`
    );
  } catch (err) {
    // RULE: Graceful degradation — processed_emails is created by Gmail Robot migration.
    if (err.message && err.message.includes('no such table')) return [];
    throw err;
  }
};

/**
 * Returns recent processed emails from or to a specific email address.
 * Used by pista.js._gatherEmailContext to provide email history to the AI.
 *
 * @param {string} email - Email address to search for (sender or receiver)
 * @returns {Promise<Array>}
 */
export const getRecentEmailsByAddress = (email) =>
  all(
    `SELECT gmail_message_id, direction, email_date, subject, ai_summary, status
     FROM processed_emails
     WHERE sender_email = ? OR receiver_email = ?
     ORDER BY email_date DESC LIMIT 5`,
    [email, email]
  );

/**
 * Inserts a 'pending' record for a Gmail message (idempotent — INSERT OR IGNORE).
 *
 * @param {object} data
 * @param {string} data.messageId
 * @param {string} data.direction - 'INBOUND' | 'OUTBOUND'
 * @param {string} data.fromAddress
 * @param {string} data.toAddress
 * @param {string} data.subject
 * @param {string} data.emailDate
 * @returns {Promise<void>}
 */
export const insertPendingEmail = (
  { messageId, direction, fromAddress, toAddress, subject, emailDate }
) =>
  run(
    `INSERT OR IGNORE INTO processed_emails
       (gmail_message_id, direction, sender_email, receiver_email, subject, email_date, status)
     VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
    [messageId, direction, fromAddress, toAddress, subject, emailDate]
  );

/**
 * Updates the status and AI summary of a processed email record.
 *
 * @param {string} messageId - Gmail message ID
 * @param {string} status - New status ('processed' | 'skipped' | 'error')
 * @param {string|null} [aiSummary] - Summary text from P.I.S.T.A.
 * @returns {Promise<void>}
 */
export const updateEmailStatus = (messageId, status, aiSummary = null) =>
  run(
    `UPDATE processed_emails SET status = ?, ai_summary = ? WHERE gmail_message_id = ?`,
    [status, aiSummary, messageId]
  );

/**
 * Filters a list of Gmail message IDs down to only those not yet in processed_emails.
 * Used by email-robot.js for deduplication.
 *
 * @param {string[]} ids - Array of Gmail message IDs to check
 * @returns {Promise<string[]>} IDs not yet present in the table
 */
export const filterUnprocessedEmailIds = async (ids) => {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  const knownRows = await all(
    `SELECT gmail_message_id FROM processed_emails WHERE gmail_message_id IN (${placeholders})`,
    ids
  );
  const knownSet = new Set(knownRows.map(r => r.gmail_message_id));
  return ids.filter(id => !knownSet.has(id));
};

// ---------------------------------------------------------------------------
// Sender Rules
// ---------------------------------------------------------------------------

/**
 * Returns all sender rules.
 * Returns empty array gracefully if the table does not yet exist.
 *
 * @returns {Promise<Array>}
 */
export const getSenderRules = async () => {
  try {
    return await all('SELECT * FROM sender_rules ORDER BY created_at DESC');
  } catch (err) {
    // RULE: Graceful degradation — sender_rules is created by Gmail Robot migration.
    if (err.message && err.message.includes('no such table')) return [];
    throw err;
  }
};

/**
 * Finds a sender rule matching an email address or domain.
 *
 * @param {string} email - Exact sender email address
 * @param {string} domain - Sender domain (e.g., 'example.com')
 * @returns {Promise<Object|undefined>} Matching rule row, or undefined
 */
export const getSenderRule = (email, domain) =>
  get(
    'SELECT action FROM sender_rules WHERE sender_email = ? OR sender_domain = ?',
    [email, domain]
  );
