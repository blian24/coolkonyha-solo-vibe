# Module: robot-crm.js
**Responsibility:** Provides deterministic data access and CRUD operations for the `customers` database table.
**Location:** `server/robots/robot-crm.js`
**Depends on:** `server/db.js`
**Consumed by:** `server/routes.js`, `server/pista.js`, `server/robots/email-robot.js`

## Exports
| Name | Type | Description |
|------|------|-------------|
| getCustomers() | function | Returns all customers ordered alphabetically by name |
| getCustomerByEmail() | function | Finds customer by primary or secondary email |
| createCustomer() | function | Validates and inserts a new customer record |
| updateCustomer() | function | Dynamically updates provided customer fields |

## Key Concepts
- Wraps SQLite callback methods with promisified helper functions (`all`, `get`, `run`).
- Dual-email matching checks both `cust_email` and `cust_email2` for incoming sender identification.
- Dynamic UPDATE SQL builder only updates fields explicitly provided in the request payload.

## What is NOT here
- Product catalog or supplier records — see `server/robots/robot-catalog.js`.
- Customer order or transaction history — see `server/robots/robot-orders.js`.
- Email fetching or sending operations — see `server/robots/email-robot.js`.
