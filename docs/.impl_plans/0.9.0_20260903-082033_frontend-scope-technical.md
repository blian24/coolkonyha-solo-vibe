# Frontend Scoping: `index-db.html` Technical Analysis & Migration Recommendation

**Date:** September 3, 2026  
**Document Type:** Technical Architecture & Scoping Report  
**Target File:** `index-db.html` (52,148 bytes, 1,451 lines)  
**Project:** Coolkonyha Solo Vibe (`d:\dev\coolkonyha-solo-vibe`)

---

## 1. Inventory Table

The following table itemizes every distinct UI section, container, and visual component present in `index-db.html`.

| Component / Section | HTML Lines | CSS Lines | Render Logic (JS Lines) | Total Lines | Description |
|---|---|---|---|---|---|
| **Global Header & Branding** | 572–575 | 40–61 (~22 lines) | Static HTML | ~26 lines | Gradient background banner, icon emoji, `h1` title, and subtitle text. |
| **Tab Navigation Bar** | 577–583 | 63–97 (~35 lines) | 656–663 (`showSection`) | ~43 lines | Flexbox container with 5 navigation buttons (`Customers`, `Suppliers`, `Products`, `Orders`, `Workflow`) with active indicator highlighting. |
| **Search & Filter Controls** | 587–591, 597–601, 607–611, 619–633 | 506–567 (~62 lines) | 696–800 (`filter*`) | ~180 lines | Reusable search inputs with real-time text matching on all tables; 8-button status filter pill group on Orders. |
| **Customers Table & Detail View** | 585–594 | 120–242 (~123 lines) | 944–1059 (`loadCustomers`) | ~240 lines | Table listing Company, Contact, Email, Phone. Row click expands 2-column detail view (info/notes on left, logo on right, Edit button). |
| **Customer Inline Edit Form** | Dynamic | 243–329 (~87 lines) | 977–1014, 820–859 | ~165 lines | Inline form replacing read-only view with 8 input fields (`cust_name`, `cust_contact`, `cust_email`, `cust_email2`, `cust_phone`, `cust_web`, `notes`, `logo_path`) + Save/Cancel buttons. |
| **Suppliers Table & Detail View** | 595–604 | 120–242 (Shared) | 1062–1171 (`loadSuppliers`) | ~230 lines | Table listing Company, Contact, Email, Phone. Row click expands 2-column detail view with contact info, notes, and logo container. |
| **Supplier Inline Edit Form** | Dynamic | 243–329 (Shared) | 1096–1127, 862–900 | ~150 lines | Inline form with 7 input fields (`supp_co`, `supp_name`, `supp_email`, `supp_phone`, `supp_web`, `notes`, `logo_path`) + Save/Cancel buttons. |
| **Products Table & Detail View** | 605–614 | 120–242 (Shared) | 1174–1283 (`loadProducts`) | ~230 lines | Table listing Product Name, Type, Size, Unit Price. Row click expands 2-column detail view with supplier ID, registration date, specs, and image container. |
| **Product Inline Edit Form** | Dynamic | 243–329 (Shared) | 1206–1239, 903–941 | ~150 lines | Inline form with 7 input fields (`prod_name`, `prod_type`, `prod_size`, `prod_price`, `prod_supp`, `notes`, `prod_image`) + Save/Cancel buttons. |
| **Orders View & Nested Details** | 615–635 | 457–467, 407–451 | 1286–1381 (`loadOrders`) | ~200 lines | Master order table displaying Order Name (`Customer - Date`), status badge, and total HUF. Row click expands: (1) Order metadata, (2) Notes, (3) Nested items table, and (4) Status history vertical timeline. |
| **Workflow Reference Sidebar** | 636–640 | 469–504 (~36 lines) | 1416–1434 | ~60 lines | Sticky sidebar embedded inside Orders view showing compact reference table of workflow statuses and descriptions. |
| **Master Workflow Table View** | 643–646 | 120–143 (Shared) | 1384–1415 (`loadWorkflow`) | ~60 lines | Full standalone section showing comprehensive table of Status Key, Display Name, Description, and Skippable flag. |
| **Theme & Style System** | - | 8–390, 401–456 (~438 lines) | - | ~438 lines | CSS Custom Properties (dark blue/coral palette), base resets, typography, table hover effects, 10 status badge color variants, timeline markers, and utility classes. |

---

## 2. Inline Logic Inventory

Every distinct JavaScript function and state block inside lines 648–1448 of `index-db.html`:

| Function / Block | Lines | Description |
|---|---|---|
| **Configuration & State** | 649–653 | Declares `API_BASE` (`http://localhost:3001/api`), `expandedRows` (`Set`), `editMode` (`Map`), `customersCache` (`null`), and `currentOrderStatusFilter` (`'ALL'`). |
| `showSection(sectionId)` | 656–663 | Toggles `.active` classes across `<section>` and `.nav-btn` elements while purging `expandedRows` and `editMode`. |
| `formatCurrency(amount, currency)` | 666–668 | Formats numbers with localized thousands delimiters and appends the currency symbol (defaults to `HUF`). |
| `formatDate(dateStr)` | 671–674 | Converts ISO timestamp strings to Hungarian locale format (`hu-HU`) or returns `'-'`. |
| `formatOrderDate(dateStr)` | 677–681 | Converts ISO date strings to Hungarian short date format (`hu-HU`) for synthesized order headers. |
| `getStatusClass(status)` | 684–686 | Maps status strings to CSS class names (e.g. `READY_FOR_DELIVERY` → `status-ready-for-delivery`). |
| `getCustomerName(custId)` | 689–693 | Looks up customer name from in-memory `customersCache` by ID; falls back to `Customer #<id>`. |
| `filterCustomers()` | 696–715 | Real-time case-insensitive table filter hiding/showing customer parent and detail rows based on search input. |
| `filterSuppliers()` | 718–737 | Real-time case-insensitive table filter hiding/showing supplier parent and detail rows based on search input. |
| `filterProducts()` | 740–759 | Real-time case-insensitive table filter hiding/showing product parent and detail rows based on search input. |
| `filterOrders()` | 762–787 | Real-time multi-criteria filter for orders combining text search with the active `currentOrderStatusFilter`. |
| `filterOrdersByStatus(status)` | 790–799 | Updates `currentOrderStatusFilter`, updates active button styling, and triggers `filterOrders()`. |
| `toggleRow(rowId)` | 802–817 | Toggles `.expanded` on parent row and `.visible` on detail row, updates `expandedRows` Set, and scrolls into view. |
| `editCustomer(custId)` | 820–823 | Sets `c<id>` key in `editMode` Map and triggers `loadCustomers()` to re-render row as an edit form. |
| `saveCustomer(custId)` | 825–854 | Reads 8 form input values from DOM, sends `PUT /api/customers/:id`, deletes edit mode key, and reloads data. |
| `cancelEditCustomer(custId)` | 856–859 | Clears `c<id>` from `editMode` Map and reloads customer table in read-only mode. |
| `editSupplier(suppId)` | 862–865 | Sets `s<id>` key in `editMode` Map and triggers `loadSuppliers()` to re-render row as an edit form. |
| `saveSupplier(suppId)` | 867–895 | Reads 7 form input values from DOM, sends `PUT /api/suppliers/:id`, deletes edit mode key, and reloads data. |
| `cancelEditSupplier(suppId)` | 897–900 | Clears `s<id>` from `editMode` Map and reloads supplier table in read-only mode. |
| `editProduct(prodId)` | 903–906 | Sets `p<id>` key in `editMode` Map and triggers `loadProducts()` to re-render row as an edit form. |
| `saveProduct(prodId)` | 908–936 | Reads 7 form input values from DOM, sends `PUT /api/products/:id`, deletes edit mode key, and reloads data. |
| `cancelEditProduct(prodId)` | 938–941 | Clears `p<id>` from `editMode` Map and reloads product table in read-only mode. |
| `loadCustomers()` | 944–1059 | Fetches `/api/customers`, updates `customersCache`, and constructs customer table HTML via string concatenation. |
| `loadSuppliers()` | 1062–1171 | Fetches `/api/suppliers` and constructs supplier table HTML via string concatenation. |
| `loadProducts()` | 1174–1283 | Fetches `/api/products` and constructs product table HTML via string concatenation. |
| `loadOrders()` | 1286–1381 | Fetches `/api/orders`, loops sequentially to fetch `/api/orders/:id` for each order, and builds master/detail order HTML. |
| `loadWorkflow()` | 1384–1438 | Fetches `/api/workflow` and injects HTML into both `#workflowTable` and `#workflowSidebar`. |
| `DOMContentLoaded` listener | 1441–1447 | Initializes application by triggering `loadCustomers()`, `loadSuppliers()`, `loadProducts()`, `loadOrders()`, and `loadWorkflow()`. |

---

## 3. Dependency Inventory

### External Libraries
- **None:** 0 third-party JavaScript dependencies. Relies entirely on native browser APIs (`fetch`, `Set`, `Map`, `document.getElementById`, `document.querySelectorAll`).

### Stylesheets & Fonts
- **Fonts:** References `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` in CSS rules. Has no external font stylesheet link; uses system font fallbacks if Inter is not locally installed.
- **Styles:** No external CSS frameworks (no Tailwind CDN, no Bootstrap). 100% native embedded CSS (560 lines).

### Backend REST API Endpoints
All endpoints are queried against `http://localhost:3001/api`:

| Method | Endpoint | Payload | Used In |
|---|---|---|---|
| `GET` | `/api/customers` | - | `loadCustomers()` |
| `PUT` | `/api/customers/:id` | JSON (8 fields) | `saveCustomer(custId)` |
| `GET` | `/api/suppliers` | - | `loadSuppliers()` |
| `PUT` | `/api/suppliers/:id` | JSON (7 fields) | `saveSupplier(suppId)` |
| `GET` | `/api/products` | - | `loadProducts()` |
| `PUT` | `/api/products/:id` | JSON (7 fields) | `saveProduct(prodId)` |
| `GET` | `/api/orders` | - | `loadOrders()` |
| `GET` | `/api/orders/:id` | - | `loadOrders()` (child items & history) |
| `GET` | `/api/workflow` | - | `loadWorkflow()` |

---

## 4. Option A Assessment: React Migration

Migrating `index-db.html` into the project's existing React + Vite setup (`src/App.jsx`, `package.json` with React 19, `vite.config.js`).

### Component Mapping Architecture

```
src/components/database-viewer/
├── DatabaseViewer.jsx              # Root container: Tab navigation & active view state
├── common/
│   ├── Navigation.jsx              # Tab navigation bar with active state
│   ├── SearchBar.jsx               # Controlled search input with debouncing
│   ├── StatusBadge.jsx             # Reusable status badge with color mapping
│   ├── EntityTable.jsx             # Reusable table with expandable row drawers
│   └── InlineEditForm.jsx          # Reusable entity edit form (inputs, Save/Cancel)
├── views/
│   ├── CustomersView.jsx           # Customer state, search, table & edit handling
│   ├── SuppliersView.jsx           # Supplier state, search, table & edit handling
│   ├── ProductsView.jsx            # Product state, search, table & edit handling
│   ├── OrdersView.jsx              # Split-layout container: Order table + Sidebar
│   └── WorkflowView.jsx            # Full workflow reference table
└── orders/
    ├── OrderRow.jsx                # Order summary row
    ├── OrderDetailsDrawer.jsx      # Order expanded drawer container
    ├── OrderItemsSubTable.jsx      # Line items table (Qty, Unit Price, Total)
    ├── OrderStatusTimeline.jsx     # Vertical history timeline
    └── WorkflowSidebar.jsx         # Sticky workflow reference table
```

- **Estimated Component Count:** **14–16 components**.
- **Complex Sections:**
  1. **Orders View & Nested Timeline:** In the current code, `loadOrders()` runs an imperative sequential N+1 fetch waterfall (`for...of` loop awaiting each order ID). In React, this should be refactored into lazy data fetching (fetching `/api/orders/:id` only when an order row is expanded) or batched, drastically improving load times.
  2. **Multi-Entity Inline Edit Form:** Managing controlled form state for 8 fields in Customers, 7 fields in Suppliers, and 7 fields in Products. React's `useState` makes form handling clean and prevents re-rendering from wiping unsubmitted text.
  3. **Multi-Criteria Order Filtering:** Combining text search with 8 status buttons requires a clean `useMemo` filter pipeline.

### Risks & Mitigations
- **Risk: Hardcoded API Base:** The current file hardcodes `http://localhost:3001/api`.  
  *Mitigation:* Configure Vite proxy in `vite.config.js` (`/api` → `http://localhost:3001`) and use relative API paths or environment variables (`VITE_API_BASE`).
- **Risk: Styling Regression:** Translating 560 lines of custom CSS into React.  
  *Mitigation:* Extract the existing CSS rules directly into a scoped CSS Module (`DatabaseViewer.module.css`) or standard stylesheet, preserving exact class names and visual appearance without rewriting to Tailwind initially.

---

## 5. Option B Assessment: HTML Partials

Splitting `index-db.html` into modular static HTML fragments loaded via asynchronous JavaScript.

### Proposed File Structure
```
ui_design/views/viewer/
├── viewer-shell.html               # Main page layout: Header, Nav, and #content-container
├── partials/
│   ├── customers-partial.html      # Search box and Customers table markup
│   ├── suppliers-partial.html      # Search box and Suppliers table markup
│   ├── products-partial.html       # Search box and Products table markup
│   ├── orders-partial.html         # Split-layout orders container & filter bar
│   ├── workflow-partial.html       # Standalone workflow status table
│   └── workflow-sidebar.html       # Sticky sidebar partial for orders
├── css/
│   ├── viewer-theme.css            # Root variables, dark blue/coral color tokens
│   ├── viewer-layout.css           # Header, navigation, and split-column layout
│   └── viewer-components.css       # Tables, expandable drawers, badges, timeline
└── js/
    ├── apiService.js               # Centralized fetch wrapper for backend endpoints
    ├── router.js                   # Client-side script fetching HTML partials into DOM
    ├── controllers/
    │   ├── customerController.js   # Customer rendering, search, and inline edit handlers
    │   ├── supplierController.js   # Supplier rendering, search, and inline edit handlers
    │   ├── productController.js    # Product rendering, search, and inline edit handlers
    │   ├── orderController.js      # Order rendering, filters, items, and timeline
    │   └── workflowController.js   # Workflow table and sidebar renderer
    └── utils/
        └── formatters.js           # Currency, date, and status class helpers
```

### Linking Mechanism
The shell page captures tab clicks, issues a `fetch('/partials/<view>-partial.html')`, inserts the returned markup via `container.innerHTML = html`, and dynamically executes the corresponding controller function to bind event listeners and populate data.

### Risks & Limitations
- **Destructive DOM Wiping:** Injecting HTML via `innerHTML` destroys active input focus, resets scroll positions, and requires tearing down and re-binding DOM event listeners on every tab switch or edit cycle.
- **No Component Abstraction:** Expandable rows, two-column detail grids, and inline edit forms must be redundantly coded across `customerController.js`, `supplierController.js`, and `productController.js`.
- **Architectural Debt:** Leaves the project's installed React 19 and Vite infrastructure completely unused, maintaining a legacy imperative DOM scripting paradigm that is hard to test and maintain.

---

## 6. Recommendation with Rationale

### Explicit Recommendation: **Option A (React Migration)**

We categorically recommend **Option A (React Migration)**.

### Technical Justification
1. **Architectural Coherence & Pre-existing Setup:** The repository already has React 19 (`react: ^19.2.0`, `react-dom: ^19.2.0`), `@vitejs/plugin-react: ^5.1.1`, and Vite 7 fully configured in `package.json` and `vite.config.js`. Furthermore, the master architectural blueprint (`SOLUTION_DESIGN.md`) explicitly defines the frontend stack as `React + Vite`. `index-db.html` was originally built as a quick standalone prototype; migrating it to React aligns the actual code with the system architecture.
2. **Elimination of Fragile String Templating:** Over 800 lines of `index-db.html` consist of imperative template literals (`${data.map(...).join('')}`) shoved into `.innerHTML`. This pattern has zero XSS protection, is prone to memory leaks, loses input state on every save/cancel, and makes code navigation difficult. React replaces this with safe, declarative JSX and component state.
3. **Component Reusability:** The Customer, Supplier, and Product sections share identical UI mechanics (search box, expandable table rows, two-column detail grid, and 7–8 field inline edit forms). In React, these can be abstracted into clean, reusable components (`<EntityTable>`, `<SearchBar>`, `<InlineEditForm>`). Under Option B, this logic remains duplicated across multiple controllers.
4. **Performance Optimization (Eliminating N+1 Waterfall):** In `index-db.html`, `loadOrders()` executes an unoptimized sequential loop fetching `/api/orders/:id` for every single order before rendering. In React, order details can be lazy-loaded on row expansion, reducing initial page load requests from 10+ down to a single lightweight request.
5. **Modern Development Workflow:** Vite provides instantaneous Hot Module Replacement (HMR), ESLint hook verification, and testability through Vitest/React Testing Library, making long-term maintenance drastically cheaper.

---

## 7. Estimated Complexity

**Complexity:** **Medium**

**Justification:**  
The migration is of Medium complexity because while the underlying REST APIs and CRUD workflows are straightforward, cleanly decoupling 1,451 lines of intertwined DOM templates, nested timelines, and inline edit state into 14–16 modular React components with preserved styling requires methodical state design.
