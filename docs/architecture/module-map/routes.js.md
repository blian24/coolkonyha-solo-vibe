# Module: routes.js
**Responsibility:** Defines Express REST API endpoints and delegates requests to deterministic domain robots.
**Location:** `server/routes.js`
**Depends on:** `express`, `robot-crm.js`, `robot-catalog.js`, `robot-orders.js`, `robot-maintenance.js`, `robot-pista-db.js`
**Consumed by:** `server/index.js`

## Exports
| Name | Type | Description |
|------|------|-------------|
| default | `express.Router` | Router instance mounting all REST API endpoints |

## Key Concepts
- Thin delegating controller layer: performs zero SQL queries directly.
- Handles HTTP protocol concerns (status codes 200, 201, 400, 500, JSON error responses).
- Isolates orders, maintenance, CRM, catalog, and DB viewer endpoints.

## What is NOT here
- Business rule enforcement (Pricing Continuity, Dual-Write) — see `robot-orders.js` and `robot-maintenance.js`.
- Database access or SQL queries — see `server/robots/`.
- P.I.S.T.A. chat or AI reasoning endpoints — see `server/pista.js`.
