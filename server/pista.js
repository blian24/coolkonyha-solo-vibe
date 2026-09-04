/**
 * @fileoverview P.I.S.T.A. — Proactive Intelligent System for Task Automation
 *
 * The sole AI-powered actor in the Coolkonyha system. Acts as a Senior Business
 * Project Manager: interprets incoming emails and chat, proactively monitors the
 * health of the order workflow (e.g. stuck orders), and always proposes next-step
 * actions to CK for explicit approval BEFORE writing anything to the database.
 *
 * Constraints:
 *  - NEVER writes to the database directly. All mutations go through the DB agents.
 *  - NEVER executes an action without CK’s approval (Human-in-the-Loop).
 *  - Only external dependency: Google Gemini API (via @google/generative-ai).
 *
 * @see docs/assistant_team/pista-agent.md        — Architecture & persona definition
 * @see server/robots/robot-pista-db.js            — DB layer for chat & email persistence
 * @see server/robots/robot-crm.js                — Customer lookups
 * @see server/robots/robot-orders.js             — Order queries
 * @see SOLUTION_DESIGN.md                        — Full system overview
 *
 * @author Coolkonyha Development Team
 * @version 0.3.0 (Direct imports replacing constructor injection)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getCustomerByEmail } from './robots/robot-crm.js';
import { getOrdersByCustomer, getActiveOrders } from './robots/robot-orders.js';
import { saveChatMessage, getChatHistory, getRecentEmailsByAddress } from './robots/robot-pista-db.js';

// ---------------------------------------------------------------------------
// PERSONA: Senior Business Project Manager
// This system prompt is injected into EVERY Gemini call to enforce P.I.S.T.A.'s
// role. It must never be softened or overridden by user input.
// ---------------------------------------------------------------------------
const PISTA_SYSTEM_PROMPT = `
You are P.I.S.T.A. (Proactive Intelligent System for Task Automation), the AI
business manager for Coolkonyha, a custom kitchen furniture workshop.

Your persona:
- You are a highly experienced, professional Senior Business Project Manager.
- You are proactive, detail-oriented, and always focused on business health.
- You communicate concisely and clearly, in the same language the user addresses you in.

Your strict rules:
1. You NEVER execute actions on your own. You always PROPOSE and wait for "CK" to approve.
2. You NEVER write to the database directly — all DB mutations go through the DBRobot.
3. Before any proposal, you always read the full business context (orders, history, emails) provided to you.
4. You flag stuck orders (no status change for several days), pending replies, and process violations proactively.
5. You protect business rules: no product can be ordered that does not exist in the catalogue, and no customer can order that does not exist in the customers table.
6. ATTACHMENT HANDLING: If an incoming email has attachments, DO NOT attempt to process them automatically. Instead, explicitly warn CK:
   - Provide the Gmail link to the email.
   - Warn CK about potential security risks (viruses/malware).
   - Ask CK to review the file safely in the browser.
   - Instruct CK to either copy-paste the relevant text back to you, summarize it, or explicitly UPLOAD the safe file to you via the chat interface so you can link it to the order's history.

Your output format:
Always structure your response as JSON with the following shape:
{
  "summary": "A 1-2 sentence plain-language summary of the situation.",
  "proposed_actions": [
    {
      "action_id": "unique_key",
      "description": "What you propose to do, and why.",
      "db_method": "DBRobot method name (e.g. updateOrderStatus) or null if read-only",
      "db_params": { "key": "value" }
    }
  ],
  "requires_approval": true,
  "confidence": "HIGH | MEDIUM | LOW",
  "notes": "Optional: context, caveats, or questions for CK."
}
If no action is needed (e.g. purely informational), return an empty proposed_actions array.
`;

// ---------------------------------------------------------------------------
// PistaAgent class
// ---------------------------------------------------------------------------

class PistaAgent {
  /**
   * @param {string} geminiApiKey - Gemini API key (from process.env.GEMINI_API_KEY)
   * @param {object} [options]
   * @param {number} [options.stuckOrderDays=3] - Days of inactivity before an order is flagged
   * @param {number} [options.maxTokensPerRequest=20000] - Hard limit on input tokens to
   *   prevent cost spikes
   */
  constructor(geminiApiKey, options = {}) {
    if (!geminiApiKey) throw new Error('PistaAgent requires a GEMINI_API_KEY.');

    this.stuckOrderDays = options.stuckOrderDays ?? 3;
    this.maxTokensPerRequest = options.maxTokensPerRequest ?? 20000;

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    this.model = genAI.getGenerativeModel({
      model: 'gemini-2.5-pro-preview-03-25',
      systemInstruction: PISTA_SYSTEM_PROMPT,
    });
  }

  // -------------------------------------------------------------------------
  // PUBLIC API — Entry Points
  // -------------------------------------------------------------------------

  /**
   * Process an incoming email payload (real or mocked).
   * Gathers DB context, reasons with Gemini, and returns a proposal for CK.
   *
   * @param {object} emailPayload - Email data from the Email Robot
   * @param {string} emailPayload.gmail_message_id
   * @param {string} emailPayload.from
   * @param {string} emailPayload.to
   * @param {string} emailPayload.subject
   * @param {string} emailPayload.newest_body_block - Stripped email body (no quoted history)
   * @param {string} emailPayload.direction          - 'INBOUND' | 'OUTBOUND'
   * @param {boolean} emailPayload.known_sender
   * @param {string|null} emailPayload.rule          - sender_rules action if known_sender is true
   * @returns {Promise<object>} Structured proposal for CK
   */
  async receiveEmail(emailPayload, orderId = null) {
    console.log(`\n[P.I.S.T.A.] 📧 Processing email from: ${emailPayload.from}`);

    const context = await this._gatherEmailContext(emailPayload.from);
    const prompt = this._buildEmailPrompt(emailPayload, context);
    const analysis = await this._callGemini(prompt);

    // Auto-save the P.I.S.T.A. proposal to the persistent chat log.
    // Links to the order if one is identifiable, otherwise goes to the Dashboard thread.
    const resolvedOrderId = orderId ?? context.orders?.[0]?.order_id ?? null;
    await saveChatMessage({
      orderId: resolvedOrderId,
      role: 'pista',
      message: analysis.summary,
      proposal: analysis,
    });

    console.log('[P.I.S.T.A.] 💡 Proposal generated and saved. Awaiting CK approval...');
    return analysis;
  }

  /**
   * Proactive Workflow Health Check.
   * Finds orders that have been stuck in a status for longer than `stuckOrderDays`
   * and returns a prioritised list of suggested follow-ups for CK.
   *
   * @returns {Promise<object>} Structured proposal for CK with at-risk orders
   */
  async checkWorkflowHealth() {
    console.log(`\n[P.I.S.T.A.] 🔍 Running workflow health check (threshold: ${this.stuckOrderDays} days)...`);

    const stuckOrders = await this._findStuckOrders();

    if (stuckOrders.length === 0) {
      console.log('[P.I.S.T.A.] ✅ All orders are progressing normally.');
      return {
        summary: 'All active orders are progressing normally. No immediate action required.',
        proposed_actions: [],
        requires_approval: false,
        confidence: 'HIGH',
        notes: null,
      };
    }

    const prompt = this._buildHealthCheckPrompt(stuckOrders);
    const analysis = await this._callGemini(prompt);

    console.log(`[P.I.S.T.A.] ⚠️  Found ${stuckOrders.length} order(s) that may need attention.`);
    return analysis;
  }

  /**
   * Process a natural language message from CK via the chat interface.
   * Loads conversation history from DB for context, then saves both the
   * CK message and P.I.S.T.A.'s response back to the persistent log.
   *
   * @param {string} message - CK's message
   * @param {number|null} [orderId=null] - Linked order context (null = Dashboard)
   * @returns {Promise<object>} Structured proposal or informational response
   */
  async receiveChat(message, orderId = null) {
    console.log(`\n[P.I.S.T.A.] 💬 Chat message received from CK.`);

    // 1. Persist CK's message immediately (so history is complete even on failure)
    await saveChatMessage({ orderId, role: 'ck', message });

    // 2. Load prior conversation history for context continuity
    const history = await getChatHistory(orderId, 20);
    const historyText = history.length > 0
      ? history
          .map(h => `[${h.role.toUpperCase()} @ ${h.created_at}]: ${h.message}`)
          .join('\n')
      : 'No prior conversation in this context.';

    // 3. Load active orders as broad business context
    const activeOrders = await getActiveOrders();

    const prompt = `
Conversation history in this context (oldest first):
${historyText}

CK's latest message: "${message}"

Current active orders for context:
${JSON.stringify(activeOrders, null, 2)}

Respond to CK's message based on your role as Senior Business Project Manager.
If the request requires a DB change, include it in proposed_actions.
If it is purely informational, set proposed_actions to [] and requires_approval to false.
    `.trim();

    const analysis = await this._callGemini(prompt);

    // 4. Persist P.I.S.T.A.'s response
    await saveChatMessage({
      orderId,
      role: 'pista',
      message: analysis.summary,
      proposal: analysis,
    });

    return analysis;
  }

  // -------------------------------------------------------------------------
  // PRIVATE — Context Gathering
  // -------------------------------------------------------------------------

  /**
   * Retrieves all relevant DB context for a given sender email address.
   * This is what P.I.S.T.A. "reads" before it reasons.
   *
   * @param {string} fromEmail
   * @returns {Promise<object>} context object with customer, orders, and recent emails
   */
  async _gatherEmailContext(fromEmail) {
    // Step 1: Find customer by email
    const customer = await getCustomerByEmail(fromEmail);

    if (!customer) {
      return { customer: null, orders: [], recentEmails: [] };
    }

    // Step 2: Get active orders for this customer
    const orders = await getOrdersByCustomer(customer.cust_id);

    // Step 3: Get recent processed emails from/to this sender
    const recentEmails = await getRecentEmailsByAddress(fromEmail);

    return { customer, orders, recentEmails };
  }

  /**
   * Finds all non-closed orders that have not had a status change
   * within the configured `stuckOrderDays` threshold.
   *
   * @returns {Promise<Array>}
   */
  async _findStuckOrders() {
    return await getActiveOrders().then(orders =>
      orders.filter(o =>
        (new Date() - new Date(o.current_status_update)) / 86400000 >= this.stuckOrderDays
      ).map(o => ({
        ...o,
        days_stuck: Math.floor((new Date() - new Date(o.current_status_update)) / 86400000),
      }))
    );
  }

  // -------------------------------------------------------------------------
  // PRIVATE — Prompt Building
  // -------------------------------------------------------------------------

  /**
   * Builds the Gemini prompt for an incoming email event.
   *
   * @param {object} email
   * @param {object} context
   * @returns {string}
   */
  _buildEmailPrompt(email, context) {
    return `
A new email has arrived. Here is the full situation:

--- EMAIL ---
Direction: ${email.direction}
From: ${email.from}
Received: ${email.email_date ?? 'unknown'}
Subject: ${email.subject}
Attachments: ${email.attachments ? JSON.stringify(email.attachments) : 'None'}
Body (newest block only, quoted history stripped):
${email.newest_body_block}

--- CUSTOMER RECORD ---
${context.customer ? JSON.stringify(context.customer, null, 2) : 'No customer found for this email address.'}

--- ACTIVE ORDERS ---
${context.orders.length > 0 ? JSON.stringify(context.orders, null, 2) : 'No orders found for this customer.'}

--- RECENT EMAIL HISTORY ---
${context.recentEmails.length > 0 ? JSON.stringify(context.recentEmails, null, 2) : 'No previous email history on record.'}

Based on this information, determine what should happen next.
If this email is clearly spam or irrelevant to Coolkonyha business, say so and propose no action.
Otherwise, propose the concrete next business step(s) for CK to approve.
    `.trim();
  }

  /**
   * Builds the Gemini prompt for a workflow health check.
   *
   * @param {Array} stuckOrders
   * @returns {string}
   */
  _buildHealthCheckPrompt(stuckOrders) {
    return `
You are running a proactive workflow health check. The following orders have had
NO status change for at least ${this.stuckOrderDays} days. Review each and propose
a prioritised list of follow-up actions for CK to approve.

--- STUCK ORDERS ---
${JSON.stringify(stuckOrders, null, 2)}

For each order that truly needs attention, include a proposed_action entry.
Prioritise by urgency (days_stuck DESC) and business impact.
    `.trim();
  }

  // -------------------------------------------------------------------------
  // PRIVATE — LLM Call
  // -------------------------------------------------------------------------

  /**
   * Sends a prompt to Gemini and parses the JSON response.
   * Includes a pre-flight cost protection check.
   *
   * @param {string} userPrompt
   * @returns {Promise<object>} Parsed JSON proposal
   */
  async _callGemini(userPrompt) {
    try {
      // 1. Cost Protection / Pre-flight check
      const { totalTokens } = await this.model.countTokens(userPrompt);
      console.log(`[P.I.S.T.A.] ℹ️  Pre-flight check: Prompt size is ${totalTokens} tokens.`);

      if (totalTokens > this.maxTokensPerRequest) {
        console.warn(`[P.I.S.T.A.] 🚨 COST WARNING: Request exceeds limit (${totalTokens} > ${this.maxTokensPerRequest}). Aborting API call.`);
        return {
          summary: `🚨 COST PROTECTION: The incoming request context is too large (${totalTokens} tokens), which would be unnecessarily expensive. Pista blocked the LLM call for your safety.`,
          proposed_actions: [],
          requires_approval: true,
          confidence: 'HIGH',
          notes: 'ABORTED_DUE_TO_COST_PROTECTION - Check the incoming payload for excessive data or logs.'
        };
      }

      // 2. Perform the actual paid LLM generation
      const result = await this.model.generateContent(userPrompt);
      const rawText = result.response.text().trim();

      // Strip Markdown code fences if Gemini wraps the JSON in them
      const jsonText = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      return JSON.parse(jsonText);
    } catch (error) {
      console.error('[P.I.S.T.A.] ❌ Gemini call failed:', error.message);
      throw new Error(`LLM call failed: ${error.message}`);
    }
  }
}

export default PistaAgent;
