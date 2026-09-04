# DB Robot Implementation & Code Structure

This document explains how the DBRobot rules defined in [`db_robot_logic_tools.md`](./db_robot_logic_tools.md) are implemented in the codebase.

## 1. Code Location
The DBRobot logic is split by domain across `server/robots/`:
- **`server/robots/robot-crm.js`**: Customer read/write operations.
- **`server/robots/robot-catalog.js`**: Supplier and product read/write operations.
- **`server/robots/robot-orders.js`**: Order lifecycle, order items, dual-write and pricing-continuity enforcement.
- **`server/robots/robot-maintenance.js`**: Maintenance case lifecycle and dual-write enforcement.
- **`server/robots/robot-pista-db.js`**: Chat history, processed emails, sender rules.
- **`server/db.js`**: Database connection management.
- **`server/routes.js`**: API layer exposing the robots' capabilities.

The pre-split monolith this logic used to live in (formerly at the top level of `server/`) is confirmed dead (nothing in `server/index.js` or `server/routes.js` imported it) and was retired to [`.trash/server/agent.js`](../../.trash/server/agent.js) on 2026-09-03. See [database-robot.md](./database-robot.md) for details.

## 2. Rule Implementation Mapping

### Rule 1: Relationship & Integrity
- **Enforcement**: `server/db.js` enables Foreign Keys via `PRAGMA foreign_keys = ON;` immediately upon connection.
- **Pricing Continuity**: Implemented in `DBRobot.addOrderItem`.
  - **Code**: It queries `products.unit_price` first, then inserts that specific value into `order_items`. It never uses a subquery to live product data for historical price recording.
- **Order Totals**: Implemented in `DBRobot.addOrderItem`.
  - **Code**: After every item insertion, it triggers an `UPDATE orders SET total_amount = ...` to enforce consistency.

### Rule 2: Workflow Transition (Dual-Write)
- **Enforcement**: `DBRobot.updateOrderStatus`.
- **Code**: This method performs a transaction containing two operations:
  1.  `UPDATE orders ...` (sets current status, time, and event).
  2.  `INSERT INTO order_status_history ...` (logs the audit trail).
- **Guarantee**: Both writes succeed or both are rolled back — no partial state is ever committed.

### Rule 3: Workflow Validation
- **Status Source**: `DBRobot.updateOrderStatus` checks against `business_status_workflow` before proceeding.
- **Code**: `const statusDef = await this.get("SELECT * FROM business_status_workflow WHERE status_key = ?", [newStatus]);`

### Rule 4: AI Summary
- **Handling**: The `updateOrderStatus` method accepts `eventDescription`.
- **Logic**: It writes this description to both `orders.update_event` (concise view) and `order_status_history.update_event` (audit view).

### Rule 5: Transaction Standard for All Write Methods

**Any DBRobot method that performs more than one DB write MUST use an explicit transaction.**

Pattern to follow for every new write method:

```javascript
async exampleMultiWriteMethod(params) {
    try {
        await this.run('BEGIN TRANSACTION');

        // Write 1
        await this.run('INSERT INTO ...', [...]);
        // Write 2
        await this.run('UPDATE ...', [...]);

        await this.run('COMMIT');
        return { success: true };
    } catch (error) {
        await this.run('ROLLBACK');
        throw error;
    }
}
```

**Single-write methods** (e.g., `updateCustomer`, `updatePlayer`) issue one SQL statement — SQLite guarantees their atomicity natively, no explicit transaction is needed.

**Resolved 2026-09-04:** unit, integration, and E2E tests all now call the real functions in `server/robots/` directly against `server/db.js` switched to `:memory:` (see `tests/helpers/sandbox-db.js` and `tests/run-tests.js`), instead of a hand-maintained mirror. See `docs/tests/README.md` for the current test architecture.

## 3. Usage
- **Start Server**: `node server/index.js`
- **API Endpoint**: `PUT /api/orders/:id/status`
  - **Body**: `{ "status": "OFFER_SENT", "performedBy": "AI_AGENT", "eventDescription": "Sent offer email to client." }`

## Cross References
- **Business Rules:** [`db_robot_logic_tools.md`](./db_robot_logic_tools.md)
- **Implementation:** [`server/robots/`](../../server/robots/)
- **Tests:** [`docs/tests/README.md`](../tests/README.md)
