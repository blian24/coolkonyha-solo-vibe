# Module: renderers-master-data.js

**Responsibility:** Table renderers for the Master Data domain: Customers, Suppliers, Products.
**Location:** `ui_design/js/controllers/database/renderers-master-data.js`
**Depends on:** `state.js` (`orderCountMap`, `logoThumb`, `fmtPrice`)
**Consumed by:** `databaseController.js` (render dispatch), `modal-supplier.js`, `modal-product.js`, `modal-customer.js` (to re-render the underlying table after a save)

## Exports

| Name | Type | Description |
|------|------|-------------|
| `renderCustomers(data)` | function | Renders the Customers table, including the order-count badge |
| `renderSuppliers(data)` | function | Renders the Suppliers table |
| `renderProducts(data)` | function | Renders the Products table |

## Key Concepts

- Each renderer writes directly to `#table-area` via `innerHTML` — no diffing, full re-render per call.
- `onclick="open<Entity>Modal(id)"` attributes in the generated HTML resolve to `window.*` functions registered by the corresponding `modal-*.js` file at runtime — there's no compile-time import between renderers and modals for this reason.

## What is NOT here

- Orders/Maintenance/Email table renderers — see `renderers-orders.js`, `renderers-maintenance.js`, `renderers-email.js`
- Modal open/close/edit/save logic — see `modal-supplier.js`, `modal-product.js`, `modal-customer.js`
