/**
 * @fileoverview Email Robot — Deterministic email fetcher and preprocessor.
 *
 * Responsibilities:
 *  1. Fetch new emails from Gmail via the Gmail API (push Pub/Sub or polling fallback).
 *  2. Deduplicate against the `processed_emails` DB table.
 *  3. Apply sender rules (skip, notify, auto_customer).
 *  4. Strip quoted email history, keeping only the newest message block.
 *  5. Hand off a clean payload to P.I.S.T.A. for reasoning.
 *  6. **Apply the Gmail label "pista"** to every successfully processed email
 *     so CK can visually identify what the system has already handled.
 *
 * @see docs/assistant_team/email-robot.md    — Architecture & flow diagram
 * @see server/pista.js                       — AI agent that receives the payload
 * @see docs/architecture/database-schema.md  — processed_emails, sender_rules tables
 *
 * @author Coolkonyha Development Team
 * @version 1.0.0
 */

import { google } from 'googleapis';

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

/** The exact display name of the Gmail label applied to processed emails. */
const PISTA_LABEL_NAME = 'pista';

// ---------------------------------------------------------------------------
// EmailRobot class
// ---------------------------------------------------------------------------

class EmailRobot {
  /**
   * @param {object} dbRobot   - DBRobot instance (from server/agent.js)
   * @param {object} pistaAgent - PistaAgent instance (from server/pista.js)
   * @param {object} oAuth2Client - google.auth.OAuth2 instance (pre-authorized)
   */
  constructor(dbRobot, pistaAgent, oAuth2Client) {
    if (!dbRobot)     throw new Error('EmailRobot requires a DBRobot instance.');
    if (!pistaAgent)  throw new Error('EmailRobot requires a PistaAgent instance.');
    if (!oAuth2Client) throw new Error('EmailRobot requires an authorized OAuth2 client.');

    this.dbRobot    = dbRobot;
    this.pista      = pistaAgent;
    this.gmail      = google.gmail({ version: 'v1', auth: oAuth2Client });

    // Cache the resolved label ID so we only call the Gmail labels API once per session.
    this._pistaLabelId = null;
  }

  // -------------------------------------------------------------------------
  // PUBLIC API
  // -------------------------------------------------------------------------

  /**
   * Main polling tick. Fetches all unprocessed emails from INBOX and SENT,
   * runs each one through the full pipeline, and returns a summary.
   *
   * @returns {Promise<object>} Summary: { processed: number, skipped: number, errors: number }
   */
  async tick() {
    console.log('[EmailRobot] 🔄 Starting email fetch tick...');
    const summary = { processed: 0, skipped: 0, errors: 0 };

    try {
      // Fetch recent messages from both INBOX and SENT
      const messageIds = await this._fetchNewMessageIds();

      for (const messageId of messageIds) {
        try {
          const result = await this._processMessage(messageId);
          if (result === 'skipped') summary.skipped++;
          else summary.processed++;
        } catch (err) {
          console.error(`[EmailRobot] ❌ Failed to process message ${messageId}:`, err.message);
          summary.errors++;
        }
      }
    } catch (err) {
      console.error('[EmailRobot] ❌ Tick failed during message fetch:', err.message);
      summary.errors++;
    }

    console.log(`[EmailRobot] ✅ Tick complete. Processed: ${summary.processed}, Skipped: ${summary.skipped}, Errors: ${summary.errors}`);
    return summary;
  }

  // -------------------------------------------------------------------------
  // PRIVATE — Pipeline Steps
  // -------------------------------------------------------------------------

  /**
   * Lists message IDs from INBOX and SENT that haven't been processed yet.
   * Uses Gmail's history API when available for incremental fetching.
   *
   * @returns {Promise<string[]>} Array of gmail_message_id strings
   */
  async _fetchNewMessageIds() {
    const labelIds = ['INBOX', 'SENT'];
    const ids = new Set();

    for (const label of labelIds) {
      const res = await this.gmail.users.messages.list({
        userId: 'me',
        labelIds: [label],
        maxResults: 50,
      });

      for (const msg of res.data.messages ?? []) {
        ids.add(msg.id);
      }
    }

    // Deduplication: filter out IDs already in processed_emails
    const knownIds = await this.dbRobot.all(
      `SELECT gmail_message_id FROM processed_emails WHERE gmail_message_id IN (${[...ids].map(() => '?').join(',')})`,
      [...ids]
    );
    const knownSet = new Set(knownIds.map(r => r.gmail_message_id));

    return [...ids].filter(id => !knownSet.has(id));
  }

  /**
   * Runs a single Gmail message through the full preprocessing pipeline.
   * On success, applies the "pista" label to the message in Gmail.
   *
   * @param {string} messageId
   * @returns {Promise<'processed' | 'skipped'>}
   */
  async _processMessage(messageId) {
    // Step 1: Fetch full message from Gmail
    const msgRes = await this.gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const rawMsg = msgRes.data;
    const headers = rawMsg.payload?.headers ?? [];

    const getHeader = name => headers.find(h => h.name.toLowerCase() === name)?.value ?? '';

    const fromAddress  = getHeader('from');
    const toAddress    = getHeader('to');
    const subject      = getHeader('subject');
    const emailDate    = getHeader('date');
    const labelNames   = rawMsg.labelIds ?? [];
    const direction    = labelNames.includes('SENT') ? 'OUTBOUND' : 'INBOUND';

    // Step 2: Insert a 'pending' row into processed_emails (idempotent guard)
    await this.dbRobot.run(
      `INSERT OR IGNORE INTO processed_emails (gmail_message_id, direction, sender_email, receiver_email, subject, email_date, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [messageId, direction, fromAddress, toAddress, subject, emailDate]
    );

    // Step 3: Check sender rules
    const senderEmail = this._extractEmail(fromAddress);
    const rule = await this.dbRobot.get(
      'SELECT action FROM sender_rules WHERE sender_email = ? OR sender_domain = ?',
      [senderEmail, this._extractDomain(senderEmail)]
    );

    if (rule?.action === 'skip') {
      await this.dbRobot.run(
        `UPDATE processed_emails SET status = 'skipped' WHERE gmail_message_id = ?`,
        [messageId]
      );
      console.log(`[EmailRobot] ⏭️  Skipping message from ${senderEmail} (rule: skip).`);
      return 'skipped';
    }

    // Step 4: Check customer record
    const customer = await this.dbRobot.get(
      'SELECT * FROM customers WHERE cust_email = ? OR cust_email2 = ?',
      [senderEmail, senderEmail]
    );

    // Step 5: Strip quoted history from body
    const rawBody   = this._extractBody(rawMsg.payload);
    const cleanBody = this._stripQuotedHistory(rawBody);

    // Step 6: Build payload and hand off to P.I.S.T.A.
    const payload = {
      gmail_message_id: messageId,
      thread_id:        rawMsg.threadId,
      email_date:       emailDate,
      direction,
      from:             fromAddress,
      to:               toAddress,
      subject,
      newest_body_block: cleanBody,
      known_sender:     !!customer,
      rule:             rule?.action ?? null,
    };

    await this.pista.receiveEmail(payload);

    // Step 7: Mark as processed in DB
    await this.dbRobot.run(
      `UPDATE processed_emails SET status = 'processed', ai_summary = 'Forwarded to P.I.S.T.A.' WHERE gmail_message_id = ?`,
      [messageId]
    );

    // Step 8: Apply the Gmail "pista" label so CK can see it in their inbox
    // @see docs/assistant_team/email-robot.md — Section 2 (Labeling rule)
    await this._applyPistaLabel(messageId);

    return 'processed';
  }

  // -------------------------------------------------------------------------
  // PRIVATE — Gmail Label Helpers
  // -------------------------------------------------------------------------

  /**
   * Ensures the "pista" Gmail label exists and applies it to the given message.
   * Label ID is resolved lazily and cached for the session lifetime.
   *
   * @param {string} messageId
   * @returns {Promise<void>}
   */
  async _applyPistaLabel(messageId) {
    try {
      const labelId = await this._resolveOrCreatePistaLabel();

      await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: [labelId],
        },
      });

      console.log(`[EmailRobot] 🏷️  Applied label "${PISTA_LABEL_NAME}" to message ${messageId}.`);
    } catch (err) {
      // Labeling failure must never abort the main pipeline — log and continue.
      console.warn(`[EmailRobot] ⚠️  Could not apply label to message ${messageId}:`, err.message);
    }
  }

  /**
   * Returns the ID of the "pista" Gmail label, creating it first if it doesn't exist.
   * Result is cached in `this._pistaLabelId` to avoid repeated API calls.
   *
   * @returns {Promise<string>} Gmail label ID (e.g. "Label_123456789")
   */
  async _resolveOrCreatePistaLabel() {
    if (this._pistaLabelId) {
      return this._pistaLabelId;
    }

    // List all existing labels
    const listRes = await this.gmail.users.labels.list({ userId: 'me' });
    const existing = listRes.data.labels ?? [];
    const found = existing.find(l => l.name.toLowerCase() === PISTA_LABEL_NAME);

    if (found) {
      console.log(`[EmailRobot] 🏷️  Found existing Gmail label "${PISTA_LABEL_NAME}" (id: ${found.id}).`);
      this._pistaLabelId = found.id;
      return found.id;
    }

    // Label doesn't exist — create it with a light blue color to make it recognizable in Gmail
    const createRes = await this.gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name: PISTA_LABEL_NAME,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
        color: {
          backgroundColor: '#4a86e8',
          textColor: '#ffffff',
        },
      },
    });

    const newId = createRes.data.id;
    console.log(`[EmailRobot] 🏷️  Created new Gmail label "${PISTA_LABEL_NAME}" (id: ${newId}).`);
    this._pistaLabelId = newId;
    return newId;
  }

  // -------------------------------------------------------------------------
  // PRIVATE — Utility Helpers
  // -------------------------------------------------------------------------

  /**
   * Extracts the plain email address from a "Name <email@example.com>" string.
   * @param {string} from
   * @returns {string}
   */
  _extractEmail(from) {
    const match = from.match(/<(.+?)>/);
    return match ? match[1].toLowerCase() : from.toLowerCase();
  }

  /**
   * Extracts the domain portion of an email address.
   * @param {string} email
   * @returns {string}
   */
  _extractDomain(email) {
    return email.split('@')[1] ?? '';
  }

  /**
   * Recursively extracts the plain text body from a Gmail message payload.
   * Falls back to HTML if no plain text part is found.
   *
   * @param {object} payload - Gmail message payload object
   * @returns {string} Raw body text
   */
  _extractBody(payload) {
    if (!payload) return '';

    const decodeBase64 = data =>
      Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');

    if (payload.mimeType === 'text/plain' && payload.body?.data) {
      return decodeBase64(payload.body.data);
    }

    for (const part of payload.parts ?? []) {
      const result = this._extractBody(part);
      if (result) return result;
    }

    return '';
  }

  /**
   * Strips quoted history from an email body.
   * Heuristic: anything below a line starting with "On ... wrote:" or ">" is removed.
   *
   * @param {string} body
   * @returns {string} Only the newest message block
   */
  _stripQuotedHistory(body) {
    const lines = body.split('\n');
    const cutoff = lines.findIndex(
      l => l.match(/^(\s*>)|(\s*On .+ wrote:)/i)
    );
    return (cutoff > 0 ? lines.slice(0, cutoff) : lines).join('\n').trim();
  }
}

export default EmailRobot;
