# Single Page Application (SPA) Architecture & Full English UI Migration

## Goal Description
The objective is to refactor the application so that `index.html` serves as the universal layout shell for all pages (Dashboard, Database, Reports, Settings). This eliminates the need to duplicate the sidebar and layout across multiple HTML files. Additionally, the plan outlines the final steps to achieve a 100% English UI (excluding user-generated business data).

## Proposed Changes

### Phase 1: SPA Architecture (Centralizing around `index.html`)

To avoid duplicating the sidebar across files like `design-03-database-v1.html`, we need to implement a basic Vanilla JS routing system.

#### 1. Convert `index.html` to a Shell
- **[MODIFY]** `index.html`: 
  - Retain the `<aside>` (Sidebar) and global modals.
  - Empty the contents of the `<main>` tag. Add an ID like `<main id="app-content">`.
  - Remove dashboard-specific JavaScript from the bottom of the file.

#### 2. Create View Partials
- **[NEW]** `ui_design/views/dashboard.html`: Extract the top (What's New) and bottom (Active Orders) sections from the current `index.html` into this new file.
- **[NEW]** `ui_design/views/database.html`: Extract the `<main>` content (tabs, search bar, table area) from `design-03-database-v1.html` into this file.
- **[DELETE]** `ui_design/designs/design-03-database-v1.html`: This standalone file will no longer be needed.

#### 3. Implement Frontend Router
- **[NEW]** `ui_design/js/router.js`: 
  - Create a script that intercepts clicks on sidebar navigation links.
  - Use `fetch()` to load the corresponding HTML partial from the `/views/` folder and inject it into `<main id="app-content">`.
  - Handle script execution for the newly loaded views.

#### 4. Decouple View Controllers
- **[NEW]** `ui_design/js/controllers/dashboardController.js`: Move the dashboard data-fetching and rendering logic here.
- **[NEW]** `ui_design/js/controllers/databaseController.js`: Move the database tab-switching and table-rendering logic here.

---

### Phase 2: 100% English UI Migration

The following hardcoded Hungarian strings must be translated across the UI.

#### [MODIFY] `index.html` (Global Sidebar & Modals)
- **Sidebar Chat Bubbles:**
  - *"Üdv CK! Minden rendszerelem stabil. Készen állok a műveletekre."* ➔ "Welcome CK! All system elements are stable. Ready for operations."
  - *"Mikor érkeznek a Brema egységek a Hiltonhoz?"* ➔ "When will the Brema units arrive at the Hilton?"
  - *"A Hilton szállítmánya (HILT-00001) holnap reggel 10:00-ra van ütemezve. Vámkezelés kész."* ➔ "The Hilton shipment (HILT-00001) is scheduled for 10:00 AM tomorrow. Customs clearance is complete."
- **Modals:**
  - *"Ma (2026. Március 23.)"* ➔ "Today (March 23, 2026)"
  - *"Tegnap (2026. Március 22.)"* ➔ "Yesterday (March 22, 2026)"

#### [MODIFY] `ui_design/views/database.html` (Extracted Database View)
- **Section Headers & Search:**
  - *"Adatbázis"* ➔ "Database"
  - *"Szűrés..."* ➔ "Filter..."
  - *"Sötét Mód"* ➔ "Dark Mode"
  - *"Téma váltása"* ➔ "Toggle Theme"
- **Navigation Tabs:**
  - *"Ügyfelek"* ➔ "Customers"
  - *"Szállítók"* ➔ "Suppliers"
  - *"Termékek"* ➔ "Products"
  - *"Rendelések"* ➔ "Orders"
- **Placeholders & Loading States:**
  - *"Betöltés..."* ➔ "Loading..."
- **Database Specific PISTA Chat:**
  - *"Üdv CK! Az adatbázis modul betöltve."* ➔ "Welcome CK! Database module loaded."
  - *"Kérdezz PISTA-tól..."* ➔ "Ask PISTA..."
- **Modal Controls (Tooltips):**
  - *"Szerkesztés"* ➔ "Edit"
  - *"Státusz frissítés"* ➔ "Update Status"
  - *"Történet"* ➔ "History"

## Verification Plan
1. **Manual Verification**: Click through the sidebar links in the browser to verify that `router.js` dynamically loads the correct views into `index.html` without triggering a full page reload.
2. **Visual Verification**: Inspect all loaded views and modals to ensure no Hungarian strings remain in the UI scaffolding. Database data (client names, order statuses) will intentionally remain Hungarian.
