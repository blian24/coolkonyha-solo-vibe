# Module: state.js (Database view shared state)

**Responsibility:** Shared state, constants, and formatting helpers for the Database view. Deliberately a leaf module — imports nothing from any other file under `controllers/database/` — so every renderer and modal file can depend on it without creating circular imports.
**Location:** `ui_design/js/controllers/database/state.js`
**Depends on:** nothing under `controllers/database/`
**Consumed by:** `databaseController.js`, every `renderers-*.js` and `modal-*.js` file in this folder

## Exports

| Name | Type | Description |
|------|------|-------------|
| `API_BASE` | const | Base URL for all Database view API calls |
| `currentData` / `setCurrentData(data)` | live binding / setter | The active tab's row array. Reassigned only via the setter — ES modules only let the *declaring* module reassign a `let` export, so `loadTab` (in `databaseController.js`) calls the setter rather than assigning directly. |
| `orderCountMap` / `setOrderCountMap(map)` | live binding / setter | Customer ID → order count, for the badge shown on Customers rows and the customer modal |
| `customersCache` / `setCustomersCache(cache)` | live binding / setter | All customers, used to resolve names/logos on the Orders tab and Order modal without a second fetch |
| `expandedRows` | `Set` (mutated, never reassigned) | Which drawer rows are open — safe as a plain export since it's mutated via `.add()`/`.delete()`, not reassignment |
| `resolveLogoUrl`, `logoThumb` | functions | Logo path → absolute URL / thumbnail HTML |
| `fmt`, `statusPill`, `fmtDt`, `fmtDate`, `fmtPrice`, `fieldHtml` | functions | Shared formatting helpers used across renderers and modals |

## Key Concepts

- **Setter pattern for reassigned state:** only `currentData`, `orderCountMap`, and `customersCache` need setters — they're wholesale reassigned elsewhere (in `databaseController.js`). `expandedRows` doesn't need one since it's never reassigned, only mutated in place.
- Part of the 2026-09-04 split of the former monolithic `databaseController.js` — see `docs/.notes/future-ideas.md` i-8 (resolved).

## What is NOT here

- Table rendering — see `renderers-*.js`
- Tab switching / data loading — see `databaseController.js`
- Domain-specific formatters used by only one renderer (e.g. `directionBadge`, `actionBadge`, `emailStatusPill`) — those live in `renderers-email.js` instead, since nothing else needs them
