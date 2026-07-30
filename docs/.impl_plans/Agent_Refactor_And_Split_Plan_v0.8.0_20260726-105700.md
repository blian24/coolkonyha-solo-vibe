# Agent & Frontend Refactoring Split Plan

**Target Version**: v0.8.0

## Goal Description
The purpose of this plan is to outline the structural decomposition of the central `server/agent.js` file (currently over 900 lines) into highly cohesive, domain-specific modules. This refactoring will isolate business logic by context (Orders, Maintenance, CRM, etc.), making the system more maintainable while preserving the centralized SQLite database connection.

Additionally, this plan addresses the frontend monolithic structure by outlining how `index-db.html` will be split into modular templates and controllers, and transitioned to a standard `index.html` entry point.

## User Review Required
> [!WARNING]
> This refactor involves modifying the core database access layer of the application. It is critical to ensure that all imports in dependent files (`routes.js`, `pista.js`, `email-robot.js`) are updated correctly.

> [!IMPORTANT]
> The database connection itself will remain singular to avoid SQLite locking issues, but the domain methods will be injected or composed into a main export, or exposed individually.

## Open Questions
> [!NOTE]
> 1. Should we keep `agent.js` as an aggregator (re-exporting all methods from sub-modules so `routes.js` doesn't need huge import changes), or should we update `routes.js` to import specifically from `agent-orders.js`, `agent-maintenance.js`, etc.? (Recommended: Update `routes.js` for clearer dependency mapping).
> 2. For the frontend split, the user requested it to be accessible via `index.html`. Do you prefer a simple Single Page App (SPA) structure using Vanilla JS imports (e.g., separating HTML templates into a `views/` folder and dynamically loading them), or a simpler build-less component approach?

## Proposed Changes: Backend (agent.js Split)

### 1. Database Connection & Core Layer
- **`server/db-connection.js`**: Will handle the SQLite database initialization, table creation (the `_initDb` logic), and export the raw database instance wrapper.

### 2. Domain-Specific Modules
- **`server/agents/agent-orders.js`**: `createOrder`, `updateOrderStatus`, `addOrderItem`, `getOrders`, `getOrderDetails`, `getAllOrderItems`, `getOrderStatusHistory`.
- **`server/agents/agent-maintenance.js`**: `createMaintenanceCase`, `updateMaintenanceStatus`, `addMaintenanceItem`, `getMaintenanceCases`, `getMaintenanceDetails`, `getAllMaintenanceItems`, `getAllMaintenanceHistory`, `getMaintenanceWorkflowStatuses`.
- **`server/agents/agent-crm.js`**: `getCustomers`, `createCustomer`, `updateCustomer`.
- **`server/agents/agent-catalog.js`**: `getSuppliers`, `createSupplier`, `updateSupplier`, `getProducts`, `createProduct`, `updateProduct`.
- **`server/agents/agent-pista.js`**: `getProcessedEmails`, `getSenderRules`, `saveChatMessage`, `getChatHistory`.
- **`server/agents/agent-system.js`**: `getWorkflowStatuses`, `_safeRun` (transaction helper).

### 3. API Routes Update
- **`server/routes.js`**: Update to import the domain-specific agents instead of the monolithic `dbRobot`.
- **`server/pista.js` & `server/email-robot.js`**: Update to use `agent-pista.js` and `agent-orders.js` where necessary.

---

## Proposed Changes: Frontend (index-db.html Split)

### 1. New Entry Point
- Rename the main entry point to `index.html` as requested.

### 2. Static Assets Extraction
- **CSS**: Extract the inline `<style>` block from `index-db.html` into `public/css/main.css` (or `styles.css`).
- **JS Core**: Extract the inline `<script>` into `public/js/app.js` (for navigation, formatting, and state management).

### 3. Modularizing Views
We will split the HTML sections (Orders, Products, Maintenance, etc.) into separate template files or JS components to avoid a 1500+ line HTML file.
- **`public/views/orders.html`**
- **`public/views/customers.html`**
- **`public/views/products.html`**
- **`public/js/controllers/`**: Dedicated controller scripts for each view (e.g., `ordersController.js`, `customersController.js`) following the Vanilla MVC pattern described in the coding standards.

## Verification Plan

### Automated Tests
- While there are no explicit unit tests mentioned, we will verify the backend by starting the node server (`npm run dev` or `node server/index.js`) and ensuring no syntax or import errors occur.

### Manual Verification
- Test all database viewer tabs in the new `index.html`.
- Use a REST client (or the frontend UI) to verify that creating orders, updating statuses, and processing emails still interact with the database correctly.
