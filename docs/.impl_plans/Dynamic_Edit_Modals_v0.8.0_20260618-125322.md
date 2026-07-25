# Implement Dynamic Edit Pop-up Modal for Database Viewer Tables
**Ticket:** [86caam46t](https://app.clickup.com/t/86caam46t)
**App Version:** v0.7.0 → v0.8.0 (new Minor — new user-facing feature)

## Background

The Customer tab already has a fully working pattern:
- Row click → modal opens in **read-only view** with a pencil icon in the header
- Pencil click → toggles to **edit form** (same modal, no size change)
- Save → PUT to backend → modal refreshes → table row refreshes in place

The task is to apply this exact same pattern to **Suppliers** and **Products** (the two remaining editable Master Data tables). The Order/Maintenance tables are read-only in this ticket (their edit modals are status-based workflows, not record edits).

---

## Proposed Changes

### Component: `server/agent.js`
> All three update methods (`updateCustomer`, `updateSupplier`, `updateProduct`) **already exist**. No backend changes needed.

### Component: `server/routes.js`
> All three PUT routes (`/customers/:id`, `/suppliers/:id`, `/products/:id`) **already exist**. No backend changes needed.

---

### Component: `ui_design/views/database.html`

#### [MODIFY] [database.html](file:///d:/dev/coolkonyha-solo-vibe/ui_design/views/database.html)
Add two new modal HTML blocks after the existing `order-modal`:

- **Supplier Modal** (`supplier-modal`) — same structure as customer-modal: hero (logo, name, ID), pencil edit btn, close btn, left body, right PISTA chat panel.
- **Product Modal** (`product-modal`) — same structure, with product-specific fields.

---

### Component: `ui_design/js/controllers/databaseController.js`

#### [MODIFY] [databaseController.js](file:///d:/dev/coolkonyha-solo-vibe/ui_design/js/controllers/databaseController.js)

**1. Supplier Modal functions** (mirrors the customer modal pattern):
- `openSupplierModal(suppId)` — finds record in `currentData`, populates modal hero, calls `renderSupplierModal()`
- `closeSupplierModal()` — removes `.open` class
- `toggleSupplierEdit()` — toggles `supplierEditMode`, re-renders modal body
- `renderSupplierModal()` — renders read-only detail grid OR edit form based on mode
- `saveSupplierModal()` — PUTs to `/api/suppliers/:id`, refreshes table on success

**2. Product Modal functions** (mirrors the customer modal pattern):
- `openProductModal(prodId)` — finds record in `currentData`, populates modal, calls `renderProductModal()`
- `closeProductModal()` — removes `.open` class
- `toggleProductEdit()` — toggles `productEditMode`, re-renders modal body
- `renderProductModal()` — renders read-only grid OR edit form (includes supplier ID, price, type, size, notes, image_path)
- `saveProductModal()` — PUTs to `/api/products/:id`, refreshes table on success

**3. Update table row renderers:**
- `renderSuppliers()` — change `onclick="toggleRow(..."` to `onclick="openSupplierModal(${s.prod_supp_id})"` (remove expand-drawer rows)
- `renderProducts()` — change `onclick="toggleRow(..."` to `onclick="openProductModal(${p.prod_id})"` (remove expand-drawer rows)

**4. Update Escape key handler:**
- Add `closeSupplierModal()` and `closeProductModal()` to the keydown listener.

---

## Scope Boundaries (What is NOT changed)
- Order, Order Items, Order History, Workflow, Maintenance, Email tabs — all remain read-only in this ticket. They already use collapsible drawers or have their own status-workflow modals.
- No new backend routes or agent methods are needed.
- CSS changes: none required. All needed classes (`modal-overlay`, `modal-card`, `modal-hero`, `modal-edit-btn`, `edit-field`, `modal-save-btn`, etc.) already exist in `oceanic-plus.css`.

---

## Version Bump
- `VERSION` file: `0.7.0` → `0.8.0`

---

## Verification Plan

### Manual Testing
1. Navigate to **Suppliers** tab → click any row → modal pops up with supplier details in read-only view, pencil icon visible in header.
2. Click pencil icon → form switches to editable fields, pencil icon turns cyan/active, modal size stays the same.
3. Edit a field → click Save → row updates in the table behind, modal shows new values.
4. Click × → modal closes. Escape key also closes.
5. Repeat steps 1–4 for **Products** tab.
6. Verify **Customers** tab continues to work unchanged.
