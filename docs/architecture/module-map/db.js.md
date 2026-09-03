# Module: db.js
**Responsibility:** Manages the singleton SQLite connection to `coolkonyha.db` with enforced foreign keys.
**Location:** `server/db.js`
**Depends on:** `sqlite3`, `path`, `url`
**Consumed by:** `server/robots/robot-crm.js`, `server/robots/robot-catalog.js`, `server/robots/robot-orders.js`, `server/robots/robot-maintenance.js`, `server/robots/robot-pista-db.js`

## Exports
| Name | Type | Description |
|------|------|-------------|
| default | `sqlite3.Database` | Active SQLite database connection instance |

## Key Concepts
- Singleton connection opened upon module load and reused globally across all robot modules.
- Enforces relational data integrity on startup via `PRAGMA foreign_keys = ON;`.
- Throws fatal error on failure to open the database file.

## What is NOT here
- Domain queries, transactions, or CRUD operations — see domain modules in `server/robots/`.
- Schema definitions and migration scripts — see `docs/architecture/database-schema.md`.
