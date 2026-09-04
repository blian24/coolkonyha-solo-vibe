# Module: renderers-orders.js

**Responsibility:** Table renderers for the Orders domain: Orders, Order Items, Order History, Order Workflow.
**Location:** `ui_design/js/controllers/database/renderers-orders.js`
**Depends on:** `state.js` (`customersCache`, `logoThumb`, `statusPill`, `fmtDate`, `fmtPrice`, `fmtDt`, `fmt`)
**Consumed by:** `databaseController.js` (render dispatch), `modal-order.js` is NOT among these — the order modal fetches its own detail payload and refreshes this domain's table via `loadTab('orders')` instead of calling `renderOrders` directly

## Exports

| Name | Type | Description |
|------|------|-------------|
| `renderOrders(data)` | function | Main Orders table, resolves customer name/logo via `customersCache` |
| `renderOrderItems(data)` | function | Flat line-item view across all orders (extended-view tab) |
| `renderOrderHistory(data)` | function | Flat status-history view across all orders (extended-view tab) |
| `renderWorkflow(data)` | function | Reference table of order workflow statuses (extended-view tab) |

## Key Concepts

- `renderOrders` resolves the customer for each row via `customersCache.find(...)` rather than a per-row fetch — relies on `databaseController.js`'s bootstrap having populated it first.

## What is NOT here

- Master Data / Maintenance / Email table renderers — see the sibling `renderers-*.js` files
- Order detail modal (status update, items, timeline) — see `modal-order.js`
