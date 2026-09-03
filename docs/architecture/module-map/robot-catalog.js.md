# Module: robot-catalog.js
**Responsibility:** Provides deterministic data access and CRUD operations for `product_suppliers` and `products` tables.
**Location:** `server/robots/robot-catalog.js`
**Depends on:** `server/db.js`
**Consumed by:** `server/routes.js`

## Exports
| Name | Type | Description |
|------|------|-------------|
| getSuppliers() | function | Returns all suppliers ordered by company name |
| createSupplier() | function | Validates and inserts a new supplier record |
| updateSupplier() | function | Dynamically updates provided supplier fields |
| getProducts() | function | Returns all products ordered by product name |
| createProduct() | function | Validates and inserts a new product record |
| updateProduct() | function | Dynamically updates provided product fields |

## Key Concepts
- Manages both supplier records and product catalog entries in a unified catalog domain module.
- Enforces required fields (`prod_supp_co` for suppliers; `prod_name`, `prod_supp_id`, `unit_price` for products).
- Dynamic UPDATE SQL builder only touches fields explicitly provided in the payload.

## What is NOT here
- Order items or order price freezing — see `server/robots/robot-orders.js`.
- Maintenance item associations — see `server/robots/robot-maintenance.js`.
- Customer CRM data — see `server/robots/robot-crm.js`.
