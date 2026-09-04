# Living Module Map

Welcome to the Coolkonyha Solo Vibe module map. This directory contains lightweight summaries of core backend, automation, and (incrementally, as touched) frontend modules in the project.

## Single Source of Truth: `status.json`

[`status.json`](./status.json) declares, for every file under `server/`, whether it is:
- **`live`** — reachable by import from `server/index.js`, i.e. actually running in the app.
- **`not-wired`** — implemented, but nothing currently imports it (e.g. `pista.js`, `email-robot.js` today).
- **`legacy-unused`** — superseded by other code, not imported by anything live, and moved out of `server/` into `.trash/` (e.g. the pre-split DBRobot monolith, retired to `.trash/server/agent.js` on 2026-09-03).

Any narrative doc (`docs/assistant_team/*.md`, `docs/architecture/*.md`, `SOLUTION_DESIGN.md`) that states a file's location or wiring status should agree with `status.json`. This is not just a convention — `npm run check-docs` (which also runs automatically before `npm test`) statically re-derives reachability from the real import graph and fails the build if any manifest entry disagrees with reality, or if any doc references a `server/`/`tests/` path that doesn't exist. See `scripts/check-docs.js` for what it checks.

**When you add, move, or delete a file under `server/`:** update `status.json` in the same change. The checker will fail if you don't (undeclared files and stale statuses are both hard errors).

## Module Index

- [index.js](index.js.md) — Express application entry point that initializes middleware, static routes, and starts the HTTP server.
- [db.js](db.js.md) — Singleton SQLite database connection provider enforcing foreign key constraints.
- [routes.js](routes.js.md) — Express router mapping REST API endpoints to domain robot operations.
- [pista.js](pista.js.md) — P.I.S.T.A. AI business manager reasoning on emails and chat to propose actions for CK.
- [robot-crm.js](robot-crm.js.md) — Data access robot for customer records and email-based lookups.
- [robot-catalog.js](robot-catalog.js.md) — Data access robot managing suppliers and product catalogue items.
- [robot-orders.js](robot-orders.js.md) — Orders domain robot enforcing pricing continuity and dual-write status updates.
- [robot-maintenance.js](robot-maintenance.js.md) — Maintenance domain robot managing repair cases, items, and dual-write audit logs.
- [robot-pista-db.js](robot-pista-db.js.md) — Persistence robot for P.I.S.T.A. chat history, processed email logs, and sender rules.
- [email-robot.js](email-robot.js.md) — Deterministic Gmail polling worker for deduplicating, stripping, and forwarding emails.

### Frontend

- [index.html](index.html.md) — SPA shell: sidebar, modals, theme toggle logic, and `#app-content` container for dynamic view injection.
- [database/databaseController.js](databaseController.js.md) — Database view entry point: tab switching, render dispatch, search, bootstrap.
- [database/state.js](state.js.md) — Shared state, constants, and formatters for the Database view (leaf module, no internal dependencies).
- [database/renderers-master-data.js](renderers-master-data.js.md) — Customers, Suppliers, Products table renderers.
- [database/renderers-orders.js](renderers-orders.js.md) — Orders, Order Items, Order History, Order Workflow table renderers.
- [database/renderers-maintenance.js](renderers-maintenance.js.md) — Maintenance Cases, Items, History, Workflow table renderers.
- [database/renderers-email.js](renderers-email.js.md) — Processed Emails, Sender Rules table renderers.
- [database/modal-supplier.js](modal-supplier.js.md) — Supplier detail/edit modal.
- [database/modal-product.js](modal-product.js.md) — Product detail/edit modal.
- [database/modal-customer.js](modal-customer.js.md) — Customer detail/edit modal.
- [database/modal-order.js](modal-order.js.md) — Order detail/edit modal, status updates, items, history timeline.

> **Note:** The rest of the `ui_design/` layer (router, other view controllers, CSS) is not yet mapped. The Database view controller above was split from a 1,185-line monolith and mapped on 2026-09-04 — see `docs/.notes/future-ideas.md` i-8 (resolved). Further frontend module-map entries will be added incrementally as those files are touched, not gated behind any planned migration.

## Dependency Graph

```mermaid
graph TD
    subgraph AppEntry[Entry & Routing]
        IDX[index.js] --> RT[routes.js]
    end

    subgraph AIRobot[AI & Automation]
        ER[email-robot.js] -. dispatches payload .-> PS[pista.js]
        ER --> RCRM[robot-crm.js]
        ER --> RPDB[robot-pista-db.js]
        PS --> RCRM
        PS --> RORD[robot-orders.js]
        PS --> RPDB
    end

    subgraph DataRobots[Domain Robots]
        RT --> RCRM
        RT --> RCAT[robot-catalog.js]
        RT --> RORD
        RT --> RMAIN[robot-maintenance.js]
        RT --> RPDB
    end

    subgraph Storage[Database]
        RCRM --> DB[db.js]
        RCAT --> DB
        RORD --> DB
        RMAIN --> DB
        RPDB --> DB
        DB --> SQLITE[(SQLite: coolkonyha.db)]
    end

    subgraph DbView[Frontend: Database View]
        DBC[databaseController.js] --> DBS[state.js]
        DBC --> RMD[renderers-master-data.js]
        DBC --> RO[renderers-orders.js]
        DBC --> RM2[renderers-maintenance.js]
        DBC --> RE[renderers-email.js]
        DBC -.->|side-effect import| MS[modal-supplier.js]
        DBC -.->|side-effect import| MP[modal-product.js]
        DBC -.->|side-effect import| MC[modal-customer.js]
        DBC -.->|side-effect import| MO[modal-order.js]
        RMD --> DBS
        RO --> DBS
        RM2 --> DBS
        RE --> DBS
        MS --> DBS
        MP --> DBS
        MC --> DBS
        MO --> DBS
        MS --> RMD
        MP --> RMD
        MC --> RMD
        MO -.->|circular, safe: deferred to event-handler call time| DBC
        DBC -.->|/api| RT
    end
```

## Start Here Guide

- **If you are working on REST API endpoints or adding new HTTP routes:**
  Read [routes.js](routes.js.md) first to understand existing routes and response codes, then read the matching domain robot ([robot-orders.js](robot-orders.js.md), [robot-crm.js](robot-crm.js.md), [robot-catalog.js](robot-catalog.js.md), or [robot-maintenance.js](robot-maintenance.js.md)).
- **If you are working on Order processing or status transitions:**
  Read [robot-orders.js](robot-orders.js.md) first to understand Pricing Continuity and Dual-Write rules, then [routes.js](routes.js.md).
- **If you are working on Maintenance cases or repairs:**
  Read [robot-maintenance.js](robot-maintenance.js.md) first to understand case workflows and status history logging, then [routes.js](routes.js.md).
- **If you are working on Customer, Supplier, or Product catalogs:**
  Read [robot-crm.js](robot-crm.js.md) or [robot-catalog.js](robot-catalog.js.md) for data access rules, and [routes.js](routes.js.md) for exposed routes.
- **If you are working on P.I.S.T.A. AI behavior or prompt engineering:**
  Read [pista.js](pista.js.md) to inspect system prompts, token safeguards, and proposal structures, then read [robot-pista-db.js](robot-pista-db.js.md) for conversation persistence.
- **If you are working on Gmail integration, email filtering, or deduplication:**
  Read [email-robot.js](email-robot.js.md) to follow the 8-step pipeline, [robot-pista-db.js](robot-pista-db.js.md) for deduplication queries and sender rules, and [pista.js](pista.js.md) for AI handoff.
- **If you are working on Database connections, transactions, or schema:**
  Read [db.js](db.js.md) for connection and foreign key setup, followed by the relevant domain robot in `server/robots/`.
- **If you are working on the SPA shell, sidebar, theme, or modals:**
  Read [index.html](index.html.md) first. For view content see `ui_design/views/`. For routing see `ui_design/js/router.js`.
- **If you are working on the Database view (any tab or entity modal):**
  Read [database/databaseController.js](databaseController.js.md) first for tab switching and render dispatch, then [database/state.js](state.js.md) for shared state/formatters. For a specific domain's tables see the matching `database/renderers-*.js`; for a specific entity's modal see the matching `database/modal-*.js`.
