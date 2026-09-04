# Future Ideas

Informal, running backlog of things worth doing eventually — not authoritative, not tracked/committed work. Filled in automatically as ideas come up during sessions (not what's decided/done in the moment — see session walkthroughs for that). When one is ready to actually be worked on, promote it to a ClickUp ticket (per the usual workflow) and remove it from here.

**Next ID:** 9

## From the 2026-09-03 documentation consistency pass

- **i-3 — Wire P.I.S.T.A. and the Email Robot into the live server.** Both are fully implemented (`server/pista.js`, `server/robots/email-robot.js`) but nothing currently instantiates or schedules either — no route, no cron/poller. This is presumably the next real feature milestone once the architecture housekeeping settles.

## From resolving i-2 (2026-09-04)

- **i-6 — No direct unit coverage for `robot-maintenance.js` or `robot-pista-db.js`.** The unit suite only ever tested orders/CRM/catalog logic (`robot-orders.js`, `robot-crm.js`, `robot-catalog.js`) — that was true before i-2's retargeting too, so it's a pre-existing gap, not something the retargeting made worse. Integration/E2E tests don't cover the maintenance domain or PISTA persistence at all either. Worth adding a maintenance-domain unit suite (dual-write + pricing continuity, mirroring the orders one) if that domain sees active development.

## From the file-size/modularity rule discussion (2026-09-04)

- **i-7 — Split `ui_design/css/oceanic-plus.css` (2,071 lines) once a second visual theme is planned.** Deliberately deferred — v1 ships with one theme only, so there's nothing to split yet. When a second theme is actually planned: split along two axes — structure (tokens/variables, layout, components, page-specific — the file already covers all of these in one place) and theme (isolate theme-varying values, i.e. colors, into their own per-theme token file, e.g. `themes/oceanic-plus.css`, separate from theme-agnostic layout/component CSS). To avoid a flash of the wrong theme on load, extend `index.html`'s existing pre-paint inline `<script>` (which already applies the dark/light `.dark` class synchronously before first paint, reading a saved `ck-theme` preference from `localStorage`) to also set a `data-theme` attribute from a saved theme preference the same way — prefer CSS-custom-property/attribute switching over swapping `<link>` stylesheet files unless the project ends up with many themes or individually large theme files. See `~/.claude/CLAUDE.md` §2 File Size & Modularity for the general rule this follows.
- **i-8 — `ui_design/js/controllers/databaseController.js` (1,185 lines) is the one real monolith left in the live codebase**, found while auditing file sizes against the new ceilings — not yet scoped or split. Worth a dedicated pass (it wasn't touched by the earlier `server/agent.js` → `server/robots/*.js` split, which only addressed the backend).
