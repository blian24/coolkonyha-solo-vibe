# Task 1 — Technical Developer Summary
# Part C — Executor Reference (separate from owner-facing plan)

**Companion file:** `Agent_Refactor_And_Split_Plan_v0.8.0_20260726-110700.md`
**Target Version:** v0.8.0
**Audience:** Developer or AI executor who will implement Task 2. Assumes code literacy but was not present during the analysis.

---

## 1. Why This Split Is Being Done

`server/agent.js` violates the Single Responsibility Principle at scale. At 927 lines it is the largest file in the server codebase and contains 6 distinct business domains plus the infrastructure layer (DB connection and schema). The file has grown incrementally with each new feature (maintenance in v0.6.0, DB viewer in v0.7.0, PISTA chat in the current version).

**Practical consequences of the current structure:**
- Any AI-assisted task that touches orders, maintenance, or customer data must load the full 927-line context, regardless of which domain is actually being changed.
- Bug isolation is difficult: a maintenance method and an order method are separated only by a comment block, with no file boundary enforcing the separation.
- The dual-write business rule (status + history table update in a transaction) is implemented twice in the same class — once for orders, once for maintenance — and the implementations are coupled by proximity rather than by an explicit shared pattern.

---

## 2. New File Structure

| Old File | New File | Location | Responsibility |
|---|---|---|---|
| `server/agent.js` (whole file) | `server/db/db-connection.js` | `server/db/` | SQLite connection, WAL pragma, schema init (`_initDb`), base helpers: `run()`, `get()`, `all()`, `_safeRun()` |
| `server/agent.js` (CRM methods) | `server/agents/agent-crm.js` | `server/agents/` | `getCustomers()`, `createCustomer()`, `updateCustomer()` |
| `server/agent.js` (catalog methods) | `server/agents/agent-catalog.js` | `server/agents/` | `getSuppliers()`, `createSupplier()`, `updateSupplier()`, `getProducts()`, `createProduct()`, `updateProduct()` |
| `server/agent.js` (order methods) | `server/agents/agent-orders.js` | `server/agents/` | `getOrders()`, `getOrderDetails()`, `createOrder()`, `addOrderItem()`, `updateOrderStatus()`, `getWorkflowStatuses()`, `getAllOrderItems()`, `getOrderStatusHistory()` |
| `server/agent.js` (maintenance methods) | `server/agents/agent-maintenance.js` | `server/agents/` | `getMaintenanceCases()`, `getMaintenanceDetails()`, `createMaintenanceCase()`, `addMaintenanceItem()`, `updateMaintenanceStatus()`, `getMaintenanceWorkflowStatuses()`, `getAllMaintenanceItems()`, `getAllMaintenanceHistory()` |
| `server/agent.js` (PISTA/email support methods) | `server/agents/agent-pista-db.js` | `server/agents/` | `saveChatMessage()`, `getChatHistory()`, `getProcessedEmails()`, `getSenderRules()` |
| `server/routes.js` | `server/routes.js` (updated, not split) | `server/` | Import update only: replace single `dbRobot` import with 5 domain agent imports |
| `server/pista.js` | `server/pista.js` (updated, not split) | `server/` | Replace constructor `dbRobot` param with direct imports of `agent-orders.js` and `agent-pista-db.js` |
| `server/email-robot.js` | `server/email-robot.js` (updated, not split) | `server/` | Replace constructor `dbRobot` param with direct imports of `agent-crm.js` and `agent-pista-db.js` |

---

## 3. Complexity Hotspots — What Must Not Be Oversimplified

### 3.1 The `_safeRun` Transaction Pattern (High Complexity)
`_safeRun(fn)` is defined in the current `DBRobot` class and wraps `db.transaction(fn)()`. After the split, it moves to `db-connection.js`. Every domain agent that uses transactions (`updateOrderStatus`, `updateMaintenanceStatus`, `addOrderItem`, `addMaintenanceItem`) must import and use it from `db-connection.js`. This is the most critical function to trace — if it is not imported correctly, all transactional operations will silently fall back to non-atomic behaviour.

Verify in Task 3 by checking that every method calling `_safeRun` has `db-connection.js` in its import chain.

### 3.2 Constructor Injection Removal in pista.js and email-robot.js (Medium Complexity)
Both classes currently receive `dbRobot` as a constructor parameter and call methods on it (e.g., `this.dbRobot.saveChatMessage(...)`, `this.dbRobot.get(...)`). After the split:

**`pista.js` currently calls:**
- `this.dbRobot.saveChatMessage()` → move to direct import from `agent-pista-db.js`
- `this.dbRobot.getChatHistory()` → direct import from `agent-pista-db.js`
- `this.dbRobot.all(...)` (raw SQL in `receiveChat` for active orders) → move to a dedicated function in `agent-orders.js`, e.g., `getActiveOrders()`
- `this.dbRobot.get(...)` (raw SQL in `_gatherEmailContext` for customer lookup) → move to `agent-crm.js`, e.g., `getCustomerByEmail(email)`
- `this.dbRobot.all(...)` (raw SQL in `_gatherEmailContext` for orders by customer) → move to `agent-orders.js`, e.g., `getOrdersByCustomer(custId)`
- `this.dbRobot.all(...)` (raw SQL in `_gatherEmailContext` for recent emails) → move to `agent-pista-db.js`, e.g., `getRecentEmailsByAddress(email)`

> ⚠️ **Important:** `pista.js` currently calls `this.dbRobot.get()` and `this.dbRobot.all()` with raw SQL strings directly. These raw calls must be wrapped in named functions in the appropriate domain agent. Do NOT expose `db.get()` or `db.all()` as public APIs — all raw SQL must live inside the domain agents.

**`email-robot.js` currently calls:**
- `this.dbRobot.all(...)` for deduplication check (raw SQL against `processed_emails`) → move to `agent-pista-db.js`
- `this.dbRobot.run(...)` for INSERT into `processed_emails` → move to `agent-pista-db.js`
- `this.dbRobot.run(...)` for UPDATE of `processed_emails` status → move to `agent-pista-db.js`
- `this.dbRobot.get(...)` for sender rule lookup → move to `agent-pista-db.js`
- `this.dbRobot.get(...)` for customer lookup by email → move to `agent-crm.js`

### 3.3 The Dual-Write Pattern (Low Risk, High Importance)
`updateOrderStatus` and `updateMaintenanceStatus` both use `_safeRun` to atomically write to the current status field AND append a row to the history table. This is a core business rule. The implementation must be moved verbatim — no logic simplification. Comment `// RULE: Dual-Write Pattern` must be preserved in each new file.

---

## 4. Exports That Must Not Change

The following function names are referenced by `routes.js` (as method calls on `dbRobot`). They become named exports in their respective domain files. The names must remain identical.

| Function Name | Referenced In | New Owner |
|---|---|---|
| `getCustomers` | routes.js | agent-crm.js |
| `createCustomer` | routes.js | agent-crm.js |
| `updateCustomer` | routes.js | agent-crm.js |
| `getSuppliers` | routes.js | agent-catalog.js |
| `createSupplier` | routes.js | agent-catalog.js |
| `updateSupplier` | routes.js | agent-catalog.js |
| `getProducts` | routes.js | agent-catalog.js |
| `createProduct` | routes.js | agent-catalog.js |
| `updateProduct` | routes.js | agent-catalog.js |
| `getWorkflowStatuses` | routes.js | agent-orders.js |
| `getOrders` | routes.js | agent-orders.js |
| `getOrderDetails` | routes.js | agent-orders.js |
| `createOrder` | routes.js | agent-orders.js |
| `addOrderItem` | routes.js | agent-orders.js |
| `updateOrderStatus` | routes.js | agent-orders.js |
| `getAllOrderItems` | routes.js | agent-orders.js |
| `getOrderStatusHistory` | routes.js | agent-orders.js |
| `getMaintenanceWorkflowStatuses` | routes.js | agent-maintenance.js |
| `getMaintenanceCases` | routes.js | agent-maintenance.js |
| `createMaintenanceCase` | routes.js | agent-maintenance.js |
| `getMaintenanceDetails` | routes.js | agent-maintenance.js |
| `updateMaintenanceStatus` | routes.js | agent-maintenance.js |
| `addMaintenanceItem` | routes.js | agent-maintenance.js |
| `getAllMaintenanceItems` | routes.js | agent-maintenance.js |
| `getAllMaintenanceHistory` | routes.js | agent-maintenance.js |
| `getProcessedEmails` | routes.js | agent-pista-db.js |
| `getSenderRules` | routes.js | agent-pista-db.js |
| `saveChatMessage` | pista.js | agent-pista-db.js |
| `getChatHistory` | pista.js | agent-pista-db.js |

**New functions required** (raw SQL calls in pista.js and email-robot.js that need named wrappers):

| New Function | File | Wraps |
|---|---|---|
| `getActiveOrders()` | agent-orders.js | Raw SQL in `pista.js:receiveChat` (active orders for chat context) |
| `getCustomerByEmail(email)` | agent-crm.js | Raw SQL in `pista.js:_gatherEmailContext` |
| `getOrdersByCustomer(custId)` | agent-orders.js | Raw SQL in `pista.js:_gatherEmailContext` |
| `getRecentEmailsByAddress(email)` | agent-pista-db.js | Raw SQL in `pista.js:_gatherEmailContext` |
| `getUnprocessedEmailIds(ids)` | agent-pista-db.js | Raw SQL deduplication in `email-robot.js:_fetchNewMessageIds` |
| `insertPendingEmail(data)` | agent-pista-db.js | Raw SQL INSERT in `email-robot.js:_processMessage` |
| `updateEmailStatus(id, status, summary)` | agent-pista-db.js | Raw SQL UPDATE in `email-robot.js:_processMessage` |
| `getSenderRule(email, domain)` | agent-pista-db.js | Raw SQL lookup in `email-robot.js:_processMessage` |

---

## 5. Risk Table (copied verbatim from Part A)

| Risk | Likelihood | Mitigation |
|---|---|---|
| SQLite connection shared across modules causes locking or dual-init | Low | `db-connection.js` exports a single singleton (created once, imported by reference in all domain agents). Node.js module system caches imports — the DB file is opened exactly once per process. |
| `pista.js` and `email-robot.js` constructor signatures break (currently accept `dbRobot` as param) | Medium | Switch from constructor injection to direct imports. Update `server/index.js` instantiation accordingly. Both classes only need 3–5 methods each — explicit imports are cleaner than a god-object param. |
| Symbol missing after file split (a method not ported to any new file) | Medium | Task 2 mandates a pre-deletion symbol audit: every exported method in `agent.js` must be verified present in exactly one new file before `agent.js` is deleted. Any unaccounted method blocks deletion. |
| Circular import introduced accidentally during Task 2 | Low | The dependency graph is strictly one-directional. Domain agents must never import each other. Any shared logic must be passed as a parameter or extracted to a shared utility. |
| `routes.js` import section grows significantly | Low | Each route group maps exactly to one domain agent. The import block will have 5 named imports — a clarity improvement. |
| `_safeRun` transaction helper referenced from domain agents but defined in `db-connection.js` | Low | `db-connection.js` exports `_safeRun` explicitly. Domain agents import and use it. No cross-domain logic involved. |

---

## 6. Files That Must Be Updated After the Split

| File | What to Update |
|---|---|
| `server/index.js` | Remove `dbRobot` construction and injection into `PistaAgent` and `EmailRobot` constructors (they now import directly) |
| `server/routes.js` | Replace `import dbRobot from './agent.js'` with 5 named imports from domain agents |
| `server/pista.js` | Remove `dbRobot` constructor param; add direct imports from `agent-orders.js` and `agent-pista-db.js`; replace all `this.dbRobot.*` calls |
| `server/email-robot.js` | Remove `dbRobot` constructor param; add direct imports from `agent-crm.js` and `agent-pista-db.js`; replace all `this.dbRobot.*` calls |
| `SOLUTION_DESIGN.md` | Update the Component Responsibility Matrix to reflect new file names |
| `docs/architecture/module-map/` | Created in Task 4 — not applicable yet |
