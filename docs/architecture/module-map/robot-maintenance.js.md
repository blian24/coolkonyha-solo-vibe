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
| addMaintenanceItem() | function | Attaches a product item and issue note to a case |
| updateMaintenanceStatus() | function | Dual-write status update and audit history log |
| getAllMaintenanceItems() | function | Returns all maintenance items with product and case codes |
| getAllMaintenanceHistory() | function | Returns full maintenance history with case codes |

## Key Concepts
- Isolated domain: completely decoupled from the Orders domain logic.
- Dual-Write Pattern: atomically updates case status and logs an entry in `maintenance_status_history`.
- Generates structured case codes formatted as `MAINT-00001`.

## What is NOT here
- Sales orders or customer invoices — see `server/robots/robot-orders.js`.
- Customer contact records — see `server/robots/robot-crm.js`.
- AI reasoning or automated email dispatch — see `server/pista.js` and `server/robots/email-robot.js`.
