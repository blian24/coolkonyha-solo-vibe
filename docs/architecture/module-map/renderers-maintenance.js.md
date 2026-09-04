# Module: renderers-maintenance.js

**Responsibility:** Table renderers for the Maintenance domain: Cases, Items, History, Workflow. Fully isolated from the Orders domain, matching the backend's `robot-maintenance.js` separation.
**Location:** `ui_design/js/controllers/database/renderers-maintenance.js`
**Depends on:** `state.js` (`expandedRows`, `statusPill`, `fmtDate`, `fmtDt`, `fieldHtml`)
**Consumed by:** `databaseController.js` (render dispatch)

## Exports

| Name | Type | Description |
|------|------|-------------|
| `renderMaintenanceCases(data)` | function | Expandable-drawer table of maintenance cases |
| `renderMaintenanceItems(data)` | function | Flat item view across all cases (extended-view tab) |
| `renderMaintenanceHistory(data)` | function | Flat status-history view across all cases (extended-view tab) |
| `renderMaintenanceWorkflow(data)` | function | Reference table of maintenance workflow statuses, including skippable flag and status color (extended-view tab) |

## Key Concepts

- `renderMaintenanceCases` is the only renderer in this file with expandable drawer rows — uses `window.toggleRow` (defined in `databaseController.js`) and the shared `expandedRows` set from `state.js` to track open/closed state across re-renders.

## What is NOT here

- Master Data / Orders / Email table renderers — see the sibling `renderers-*.js` files
- Maintenance case creation or item-add forms — not yet implemented in the Database view (read/update only)
