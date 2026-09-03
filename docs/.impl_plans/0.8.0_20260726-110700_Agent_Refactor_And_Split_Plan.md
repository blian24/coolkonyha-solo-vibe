# Task 1 — Refactor Analysis & Split Plan
# Part A (Technical Split Plan) + Part B (Owner Summary)

**File:** `Agent_Refactor_And_Split_Plan_v0.8.0_20260726-110700.md`
**Target Version:** v0.8.0
**Scope:** `server/agent.js`, `server/routes.js`, `server/pista.js`, `server/email-robot.js`

---

## ⚠️ index-db.html — Flag Note (Context Only, Out of Scope)

`index-db.html` is a 52 KB, 1,451-line monolithic frontend file containing the entire database viewer UI, including approximately 570 lines of inline CSS, the full HTML structure, and approximately 850 lines of inline JavaScript. Because it mixes structure, styling, and business logic in a single file, and because the project already has a React/Vite setup (`src/App.jsx`), this file is a strong candidate for future modularisation. Its analysis and migration recommendation are the dedicated scope of **Task 6** and are explicitly excluded from this split plan.

---

# Part A — Technical Split Plan

## 1. server/agent.js — Current Responsibility Inventory (927 lines)

This file is a monolithic God Object called `DBRobot`. It mixes the following distinct concerns:

- **Database connection management** — opens the SQLite database file, configures pragmas (WAL mode, foreign keys), wraps `better-sqlite3` in async-compatible helper methods (`run`, `get`, `all`)
- **Database schema initialisation** — `_initDb()` method contains all `CREATE TABLE IF NOT EXISTS` statements for every table in the system (~200 lines)
- **Transaction helper** — `_safeRun()` wraps multiple DB statements in a SQLite transaction with rollback on failure
- **CRM domain** — `getCustomers()`, `createCustomer()`, `updateCustomer()`
- **Catalog domain** — `getSuppliers()`, `createSupplier()`, `updateSupplier()`, `getProducts()`, `createProduct()`, `updateProduct()`
- **Order domain** — `getOrders()`, `getOrderDetails()`, `createOrder()`, `addOrderItem()`, `updateOrderStatus()`, `getWorkflowStatuses()`
- **Maintenance domain** — `getMaintenanceCases()`, `getMaintenanceDetails()`, `createMaintenanceCase()`, `addMaintenanceItem()`, `updateMaintenanceStatus()`, `getMaintenanceWorkflowStatuses()`
- **P.I.S.T.A. support** — `saveChatMessage()`, `getChatHistory()`, `getProcessedEmails()`, `getSenderRules()`
- **Database viewer getters** — `getAllOrderItems()`, `getOrderStatusHistory()`, `getAllMaintenanceItems()`, `getAllMaintenanceHistory()`
- **Business rules enforcement** — dual-write pattern (current status field + history table), pricing continuity rule (price locked at time of order item creation)

## 2. server/routes.js — Current Responsibility Inventory (360 lines)

This file is already well-scoped as an HTTP routing layer. It does NOT need to be split (under 400 lines). Changes required: update import statements only.

- **HTTP route definitions** — GET, POST, PUT endpoints for customers, suppliers, products, orders, workflow, maintenance, and DB viewer
- **Request parsing** — extracts body fields and route params
- **Response handling** — wraps all logic in try/catch, returns JSON
- **Delegation** — every route delegates 100% of logic to `dbRobot` (imported from `agent.js`)

## 3. server/pista.js — Current Responsibility Inventory (394 lines)

This file is a single-class AI agent module. It is just below the 400-line threshold and is internally cohesive. It does NOT need to be split. Changes required: update constructor dependency injection.

- **PistaAgent class** — the sole AI-powered actor in the system
- **Gemini API integration** — initialises `GoogleGenerativeAI`, stores model reference
- **System prompt definition** — the `PISTA_SYSTEM_PROMPT` constant (PISTA's persona and output rules)
- **Email processing** — `receiveEmail()` gathers context, builds prompt, calls Gemini, saves result
- **Workflow health check** — `checkWorkflowHealth()`, `_findStuckOrders()`
- **Chat processing** — `receiveChat()` loads history, builds prompt, calls Gemini, saves response
- **Context gathering** — `_gatherEmailContext()` reads customers, orders, and email history from DB
- **Prompt building** — `_buildEmailPrompt()`, `_buildHealthCheckPrompt()`
- **LLM call with cost protection** — `_callGemini()` pre-flight token count check before API call
- **DB interaction** — via injected `dbRobot` constructor param (reads and writes chat, reads orders, customers, emails)

## 4. server/email-robot.js — Current Responsibility Inventory (352 lines)

This file is a single-class deterministic robot module. Under threshold, internally cohesive. Does NOT need to be split. Changes required: update constructor dependency injection.

- **EmailRobot class** — deterministic email fetcher and preprocessor
- **Gmail API integration** — initialises `google.gmail` client from injected `oAuth2Client`
- **Email polling** — `tick()` orchestrates the full fetch cycle; `_fetchNewMessageIds()` fetches from INBOX and SENT
- **Message processing pipeline** — `_processMessage()` runs 8 sequential steps per email
- **Gmail label management** — `_applyPistaLabel()`, `_resolveOrCreatePistaLabel()` (lazy-cached label ID)
- **Deduplication** — checks `processed_emails` table before processing any message
- **Sender rule application** — queries `sender_rules`, skips or continues based on action
- **Body extraction** — `_extractBody()` recursively traverses Gmail payload parts
- **Quote stripping** — `_stripQuotedHistory()` heuristic cutoff at `On ... wrote:` or `>` lines
- **PISTA handoff** — passes cleaned payload to `pistaAgent.receiveEmail()`
- **DB interaction** — via injected `dbRobot` constructor param (reads sender rules, writes processed_emails)

---

## 5. Proposed Split for agent.js

### New File Structure

| New File | Location | Single Responsibility | Est. Lines |
|---|---|---|---|
| `db-connection.js` | `server/db/` | SQLite connection, schema init, base helpers (`run`, `get`, `all`, `_safeRun`) | ~250 |
| `agent-crm.js` | `server/agents/` | Customer read and write operations | ~80 |
| `agent-catalog.js` | `server/agents/` | Supplier and product read and write operations | ~150 |
| `agent-orders.js` | `server/agents/` | Order lifecycle, order items, workflow statuses, order viewer getters | ~250 |
| `agent-maintenance.js` | `server/agents/` | Maintenance case lifecycle, maintenance items, maintenance workflow, maintenance viewer getters | ~250 |
| `agent-pista-db.js` | `server/agents/` | Chat history, processed emails, sender rules (all DB methods used by PISTA and Email Robot) | ~100 |

> **Note on naming:** `agent-pista-db.js` is named with the `-db` suffix to distinguish it as the *database layer* for PISTA, not the PISTA AI agent itself (`pista.js`). This avoids naming confusion.

### All methods accounted for

| Method | Origin (agent.js) | Destination |
|---|---|---|
| `run()`, `get()`, `all()`, `_safeRun()`, `_initDb()` | Connection layer | `db-connection.js` |
| `getCustomers()`, `createCustomer()`, `updateCustomer()` | CRM | `agent-crm.js` |
| `getSuppliers()`, `createSupplier()`, `updateSupplier()` | Catalog | `agent-catalog.js` |
| `getProducts()`, `createProduct()`, `updateProduct()` | Catalog | `agent-catalog.js` |
| `getWorkflowStatuses()` | Orders domain | `agent-orders.js` |
| `getOrders()`, `getOrderDetails()`, `createOrder()` | Orders | `agent-orders.js` |
| `addOrderItem()`, `updateOrderStatus()` | Orders | `agent-orders.js` |
| `getAllOrderItems()`, `getOrderStatusHistory()` | Orders (viewer) | `agent-orders.js` |
| `getMaintenanceWorkflowStatuses()` | Maintenance | `agent-maintenance.js` |
| `getMaintenanceCases()`, `getMaintenanceDetails()`, `createMaintenanceCase()` | Maintenance | `agent-maintenance.js` |
| `addMaintenanceItem()`, `updateMaintenanceStatus()` | Maintenance | `agent-maintenance.js` |
| `getAllMaintenanceItems()`, `getAllMaintenanceHistory()` | Maintenance (viewer) | `agent-maintenance.js` |
| `saveChatMessage()`, `getChatHistory()` | PISTA support | `agent-pista-db.js` |
| `getProcessedEmails()`, `getSenderRules()` | PISTA support | `agent-pista-db.js` |

---

## 6. Dependency Map

### Import relationships (after split)

```
server/db/db-connection.js          ← no internal imports (only: better-sqlite3, path, url)
        ↑
        ├── server/agents/agent-crm.js
        ├── server/agents/agent-catalog.js
        ├── server/agents/agent-orders.js
        ├── server/agents/agent-maintenance.js
        └── server/agents/agent-pista-db.js

server/agents/agent-crm.js          → consumed by: routes.js, email-robot.js
server/agents/agent-catalog.js      → consumed by: routes.js
server/agents/agent-orders.js       → consumed by: routes.js, pista.js (active orders context in receiveChat)
server/agents/agent-maintenance.js  → consumed by: routes.js
server/agents/agent-pista-db.js     → consumed by: routes.js, pista.js, email-robot.js

server/routes.js                    ← imports: agent-crm, agent-catalog, agent-orders, agent-maintenance, agent-pista-db
server/pista.js                     ← imports: @google/generative-ai, agent-orders, agent-pista-db (direct imports; removes constructor injection dependency)
server/email-robot.js               ← imports: googleapis, agent-crm, agent-pista-db (direct imports; removes constructor injection dependency)
```

> **Important architectural decision:** `pista.js` and `email-robot.js` currently receive `dbRobot` as a **constructor parameter** (dependency injection). After the split, the cleanest approach is to have them **import domain agents directly** at the top of the file. This eliminates the need for an aggregator object and makes dependencies explicit. The server entry point (`server/index.js`) would no longer need to pass `dbRobot` to either class.

### No circular dependencies exist in this graph.
All imports flow in a single direction: `db-connection → domain agents → route/AI layers`.

---

## 7. Risk Assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| SQLite connection shared across modules causes locking or dual-init | Low | `db-connection.js` exports a single singleton (created once, imported by reference in all domain agents). Node.js module system caches imports — the DB file is opened exactly once per process. |
| `pista.js` and `email-robot.js` constructor signatures break (currently accept `dbRobot` as param) | Medium | Switch from constructor injection to direct imports. Update `server/index.js` instantiation accordingly. Both classes only need 3–5 methods each — explicit imports are cleaner than a god-object param. |
| Symbol missing after file split (a method not ported to any new file) | Medium | Task 2 mandates a pre-deletion symbol audit: every exported method in `agent.js` must be verified present in exactly one new file before `agent.js` is deleted. Any unaccounted method blocks deletion. |
| Circular import introduced accidentally during Task 2 | Low | The dependency graph above is strictly one-directional. Domain agents must never import each other. Any shared logic that might tempt a cross-import (e.g., order ID lookup inside a maintenance method) must instead be passed as a parameter. |
| `routes.js` import section grows significantly | Low | Each route group already maps exactly to one domain agent. The import block will have 5 named imports at the top — this is a net clarity improvement, not a burden. |
| `_safeRun` transaction helper referenced from domain agents but defined in `db-connection.js` | Low | `db-connection.js` exports `_safeRun` explicitly. Domain agents import and use it. Because it only wraps `db.transaction()` with no cross-domain logic, there is no coupling risk. |

---

# Part B — Plain Language Owner Summary

## What is the problem?

The application's brain — the file that talks to the database — has grown into a single 927-line file that handles everything: connecting to the database, creating tables, managing customer records, processing orders, tracking maintenance cases, handling emails, and storing AI chat history. Imagine a kitchen where the chef is also the waiter, the dishwasher, the delivery driver, and the accountant. It works — until something goes wrong and you can't figure out who is responsible for what.

The problem in practice: when the AI assistant (or a developer) needs to make a change to how orders work, it has to load, read, and reason about the entire 927-line file — including all the maintenance logic, all the chat history logic, and all the customer logic — even though none of that is relevant to the change. This wastes time and increases the chance of accidental mistakes.

## What will change?

We will reorganise the code exactly like separating a large shared office into dedicated rooms — same staff, same work, just organised so that the orders team is in the orders room, the maintenance team is in the maintenance room, and the AI assistant's tools are in their own cabinet.

Specifically, one large 927-line file (`agent.js`) will be replaced by 6 smaller files, each with a single, clear job:

- **The connection room** (`db-connection.js`) — the only file that talks to the database directly. All other files go through this one.
- **The customer desk** (`agent-crm.js`) — handles everything about customers.
- **The catalogue desk** (`agent-catalog.js`) — handles products and suppliers.
- **The orders desk** (`agent-orders.js`) — handles orders from creation to closure.
- **The maintenance desk** (`agent-maintenance.js`) — handles all repair and maintenance cases.
- **The AI support desk** (`agent-pista-db.js`) — handles the data that the AI assistant (P.I.S.T.A.) and the email robot need.

The three other files (`routes.js`, `pista.js`, `email-robot.js`) stay as they are — they just get updated to knock on the right desk instead of calling the single big one.

## What will NOT change?

**Nothing visible to you will change.** Every screen, every button, every data field, every email processing behaviour, and every AI response will work identically. No features are being added or removed. This is purely an internal reorganisation — like moving files from a single overflowing folder into labelled subfolders.

## What could go wrong, and how will it be handled?

There are three realistic risks, and each has a concrete safety net built into Task 2 and Task 3:

1. **A connection between files could break** — e.g., a method gets moved to the wrong new file. Before the old file is deleted, Task 2 runs a mandatory "symbol audit" that checks every single method one by one. If even one is unaccounted for, the file will not be deleted until it is found and placed correctly. Task 3 then double-checks by tracing every import from the server's entry point to confirm nothing is missing.

2. **The AI assistant's connections could break** — P.I.S.T.A. (`pista.js`) and the email robot (`email-robot.js`) currently receive the database as a single bundled object. After the split, they will import only the specific data operations they actually need. This is actually simpler and cleaner, but Task 3 will explicitly verify that both still receive their data correctly.

3. **The database could be opened twice by accident** — SQLite only allows one connection at a time without special configuration. This is prevented by design: the connection file is a singleton (opened once, shared everywhere). Task 3 verifies this by checking that no other file opens its own connection.

## What do you need to decide?

Just one thing: **Do you approve this general direction?**

Specifically:
- The large `agent.js` file will be replaced by the 6 smaller files described above.
- `pista.js` and `email-robot.js` will import their database tools directly (no longer receive them as bundled parameters — this is cleaner, but it is a change to how those files are wired up internally).
- `routes.js` will be updated to import from the new desk files instead of the single big file.

You do **not** need to approve the technical details — Part A covers those for the developer/AI that will execute the split. You only need to confirm that the general plan makes sense to you and that you are comfortable proceeding.
