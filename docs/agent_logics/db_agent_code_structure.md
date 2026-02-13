# DB Agent Implementation & Code Structure

This document explains how the "DB Agent" rules defined in `docs/agent_logics/db_agent_logic_tools.md` are implemented in the codebase.

## 1. Code Location
The DB Agent logic is encapsulated entirely within:
- **`server/agent.js`**: Main logic class (`DBAgent`).
- **`server/db.js`**: Database connection management.
- **`server/routes.js`**: API layer exposing the Agent's capabilities.

## 2. Rule Implementation Mapping

### Rule 1: Relationship & Integrity
- **Enforcement**: `server/db.js` enables Foreign Keys via `PRAGMA foreign_keys = ON;` immediately upon connection.
- **Pricing Continuity**: Implemented in `DBAgent.addOrderItem`.
  - **Code**: It queries `products.unit_price` first, then inserts that specific value into `order_items`. It never uses a subquery to live product data for historical price recording.
- **Order Totals**: Implemented in `DBAgent.addOrderItem`.
  - **Code**: After every item insertion, it triggers an `UPDATE orders SET total_amount = ...` to enforce consistency.

### Rule 2: Workflow Transition (Dual-Write)
- **Enforcement**: `DBAgent.updateOrderStatus`.
- **Code**: This method performs a transaction containing two operations:
  1.  `UPDATE orders ...` (sets current status, time, and event).
  2.  `INSERT INTO order_status_history ...` (logs the audit trail).
- **Guarantee**: Because these are in a transaction (simulated or real depending on driver support/mode), the operations succeed or fail together.

### Rule 3: Workflow Validation
- **Status Source**: `DBAgent.updateOrderStatus` checks against `business_status_workflow` before proceeding.
- **Code**: `const statusDef = await this.get("SELECT * FROM business_status_workflow WHERE status_key = ?", [newStatus]);`

### Rule 4: AI Summary
- **Handling**: The `updateOrderStatus` method accepts `eventDescription`.
- **Logic**: It writes this description to both `orders.update_event` (concise view) and `order_status_history.update_event` (audit view).

## 3. Usage
- **Start Server**: `node server/index.js`
- **API Endpoint**: `PUT /api/orders/:id/status`
  - **Body**: `{ "status": "OFFER_SENT", "performedBy": "AI_AGENT", "eventDescription": "Sent offer email to client." }`
