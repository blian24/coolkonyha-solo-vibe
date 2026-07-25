# Introduction of Maintenance Domain

This plan details the technical approach to expanding the CoolKonyha platform with a new "Maintenance" domain. The goal is to provide a separate tracking mechanism for maintenance cases that shares the `products` catalog but remains isolated from `orders`.

## User Review Required

> [!IMPORTANT]
> This is the finalized plan. Please review the proposed changes below. Once you approve, I will update the ClickUp ticket or proceed with execution based on your instruction.

## Proposed Changes

---

### Database Architecture

#### [NEW] [migrate_maintenance.js](file:///d:/dev/coolkonyha-solo-vibe/scripts/migrate_maintenance.js)
A one-off Node.js script that will execute SQLite DDL statements to:
* **RENAME** the existing `business_status_workflow` table to `order_status_workflow`.
* **CREATE** `maintenance_cases`: Mirrors `orders` with `case_id`, `case_code`, `cust_id`, etc.
* **CREATE** `maintenance_items`: Mirrors `order_items` linked to `products`.
* **CREATE** `maintenance_status_history`: Mirrors `order_status_history`.
* **CREATE** `maintenance_status_workflow`: A dedicated workflow configuration table mirroring `order_status_workflow` to allow independent state definitions.
* Insert dummy data for maintenance cases utilizing existing products in the DB (e.g., 'Brema CB 249', 'Unox Anna XF023').

---

### Backend Logic

#### [MODIFY] [agent.js](file:///d:/dev/coolkonyha-solo-vibe/server/agent.js)
* Update `updateOrderStatus` and `getWorkflowStatuses` to query `order_status_workflow` instead of `business_status_workflow`.
* Duplicate core business logic to create independent maintenance functions: `createMaintenanceCase`, `addMaintenanceItem`, `updateMaintenanceStatus`, `getMaintenanceCases`, `getMaintenanceDetails`, and `getMaintenanceWorkflowStatuses`.
* Enforce "Dual-Write" and "Pricing Continuity" rules identically for the new tables.

#### [MODIFY] [routes.js](file:///d:/dev/coolkonyha-solo-vibe/server/routes.js)
* Keep existing endpoints working as they are (zero disruption), but they will now utilize the renamed backend table.
* Add `/api/maintenance` endpoints (GET list, POST create, GET detail, PUT status, POST items, GET workflow).

---

### Frontend & UI/UX

#### [MODIFY] [dataService.js](file:///d:/dev/coolkonyha-solo-vibe/ui_design/js/services/dataService.js)
* Implement `getMaintenanceCases()` to fetch from the new API.
* Implement a unified `getAllDashboardCases()` function to fetch both orders and maintenance, append a `caseType` property, and sort by date for the unified Dashboard view.

#### [MODIFY] [index.html](file:///d:/dev/coolkonyha-solo-vibe/index.html)
* Add a "Maintenance" menu item to the left sidebar using a wrench icon (`fa-wrench`).

#### [MODIFY] [router.js](file:///d:/dev/coolkonyha-solo-vibe/ui_design/js/router.js)
* Map the new sidebar item to a `maintenance` route.

#### [MODIFY] [dashboardController.js](file:///d:/dev/coolkonyha-solo-vibe/ui_design/js/controllers/dashboardController.js) (or equivalent renderer)
* Update rendering logic to display distinct icons (`fa-box` vs. `fa-wrench`) based on the `caseType`.
* Add UI controls for Global/Page-level filtering by "Case Type".

---

### Documentation

#### [MODIFY] [database-schema.md](file:///d:/dev/coolkonyha-solo-vibe/docs/architecture/database-schema.md)
* Rename `business_status_workflow` to `order_status_workflow` throughout the document.
* Add the new maintenance tables (`maintenance_cases`, `maintenance_items`, `maintenance_status_history`, `maintenance_status_workflow`) to the ERD diagram and table definitions.
* Update document version to `v0.6.0`.

#### [MODIFY] [api-routes.md](file:///d:/dev/coolkonyha-solo-vibe/docs/architecture/api-routes.md)
* Document the new `GET/POST/PUT` endpoints for maintenance.

#### [MODIFY] [SOLUTION_DESIGN.md](file:///d:/dev/coolkonyha-solo-vibe/SOLUTION_DESIGN.md)
* Update versioning references to `v0.6.0` to reflect the new feature addition.

## Verification Plan

### Manual Verification
1. **Database:** Run the migration script and inspect `coolkonyha.db` with SQLite to confirm the new tables, the renamed table, and dummy data exist.
2. **Dashboard Rendering:** Reload the UI and verify that the dashboard aggregates both Orders and Maintenance cases chronologically.
3. **Iconography & Filtering:** Confirm Maintenance cases use a distinct icon (e.g., wrench) and the Case Type filter properly hides/shows rows.
4. **Sidebar Navigation:** Click the new "Maintenance" menu item to ensure it navigates to an isolated view.
5. **Regression Testing:** Verify that creating a new order and updating an order status still works perfectly with the renamed `order_status_workflow` table.

## Phased Implementation & Verification Groups

### Group 1: Database Foundation
* **Tasks:**
  * Create and run `scripts/migrate_maintenance.js` to rename `business_status_workflow` to `order_status_workflow`.
  * Create the four new maintenance tables (`maintenance_cases`, `maintenance_items`, `maintenance_status_history`, `maintenance_status_workflow`).
  * Seed dummy maintenance case data.
* **Verification Test:** 
  * Query the SQLite database to confirm the new tables and renamed table exist with the correct schema and dummy data.
  * Run a quick test on the existing order functions to ensure renaming the workflow table didn't break them.

### Group 2: Backend API Integration
* **Tasks:**
  * Update `server/agent.js` to point order functions to the renamed table, and implement the new isolated maintenance functions.
  * Update `server/routes.js` to expose the new `/api/maintenance` endpoints.
* **Verification Test:** 
  * Start the backend server and make HTTP/API calls (via `curl` or a test script) to the new `/api/maintenance` endpoints to ensure they successfully return the dummy data and accept new status updates.

### Group 3: Frontend & UI/UX Rollout
* **Tasks:**
  * Update `dataService.js` to consume the new maintenance endpoints and merge them with orders in `getAllDashboardCases()`.
  * Update `index.html` and `router.js` to add the "Maintenance" sidebar menu item and route.
  * Update `dashboardController.js` (or the equivalent renderer) to render distinct icons (box vs. wrench) and implement the Case Type filters.
* **Verification Test:** 
  * Open the UI to manually verify that the Dashboard correctly aggregates and sorts both domains chronologically.
  * Test the sidebar navigation and verify that the UI filtering by "Case Type" functions flawlessly.

### Group 4: Documentation & Versioning
* **Tasks:**
  * Update `database-schema.md`, `api-routes.md`, and `SOLUTION_DESIGN.md`.
  * Ensure all references reflect the renamed tables, new endpoints, and the `v0.6.0` version bump.
* **Verification Test:** 
  * Perform a full-text search across the repository to guarantee no orphaned references to `business_status_workflow` or outdated logic remain.

