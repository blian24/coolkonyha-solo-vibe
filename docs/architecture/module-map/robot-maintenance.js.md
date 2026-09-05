# Module: robot-maintenance.js
**Responsibility:** Manages maintenance cases, reported issue items, status workflows, and audit history.
**Location:** `server/robots/robot-maintenance.js`
**Depends on:** `server/db.js`
**Consumed by:** `server/routes.js`

## Exports
| Name | Type | Description |
|------|------|-------------|
| getMaintenanceWorkflowStatuses() | function | Returns all valid maintenance workflow statuses |
| getMaintenanceCases() | function | Returns all maintenance cases with customer details |
| getMaintenanceDetails() | function | Returns case record, related product items, and history |
| createMaintenanceCase() | function | Initializes case, assigns case code, logs initial status |
| updateMaintenanceCase() | function | Dynamic field update (description, assigned_to, pricing_note, notes) — not for status transitions |
| addMaintenanceItem() | function | Attaches a product item and issue note to a case |
| updateMaintenanceStatus() | function | Dual-write status update and audit history log |
| getAllMaintenanceItems() | function | Returns all maintenance items with product and case codes |
| getAllMaintenanceHistory() | function | Returns full maintenance history with case codes |

## Key Concepts
- Isolated domain: completely decoupled from the Orders domain logic.
- Dual-Write Pattern: atomically updates case status and logs an entry in `maintenance_status_history`.
- **Case code format (revised 2026-09-05):** `SZ<YY><NN>`, matching CK's own Excel-based numbering exactly — the sequence resets every calendar year (based on how many `maintenance_cases` rows already exist with a `case_date` in the current year), not a flat global counter like the old `MAINT-00001` format. See `docs/.notes/differences-for-CK.md` and `docs/.notes/future-ideas.md` i-10.
- `assigned_to` and `pricing_note` (added 2026-09-05) are freetext fields matching CK's real "Ki intézi?" and "mikor_mi_összeg" Excel columns — set at creation via `createMaintenanceCase`, editable via `updateMaintenanceCase`.

## What is NOT here
- Sales orders or customer invoices — see `server/robots/robot-orders.js`.
- Customer contact records — see `server/robots/robot-crm.js`.
- AI reasoning or automated email dispatch — see `server/pista.js` and `server/robots/email-robot.js`.
