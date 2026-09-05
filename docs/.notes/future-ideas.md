# Future Ideas

Informal, running backlog of things worth doing eventually — not authoritative, not tracked/committed work. Filled in automatically as ideas come up during sessions (not what's decided/done in the moment — see session walkthroughs for that). When one is ready to actually be worked on, promote it to a ClickUp ticket (per the usual workflow) and remove it from here.

**Next ID:** 10

## From the 2026-09-03 documentation consistency pass

- **i-3 — Wire P.I.S.T.A. and the Email Robot into the live server.** Both are fully implemented (`server/pista.js`, `server/robots/email-robot.js`) but nothing currently instantiates or schedules either — no route, no cron/poller. This is presumably the next real feature milestone once the architecture housekeeping settles.

## From the file-size/modularity rule discussion (2026-09-04)

- **i-7 — Split `ui_design/css/oceanic-plus.css` (2,071 lines) once a second visual theme is planned.** Deliberately deferred — v1 ships with one theme only, so there's nothing to split yet. When a second theme is actually planned: split along two axes — structure (tokens/variables, layout, components, page-specific — the file already covers all of these in one place) and theme (isolate theme-varying values, i.e. colors, into their own per-theme token file, e.g. `themes/oceanic-plus.css`, separate from theme-agnostic layout/component CSS). To avoid a flash of the wrong theme on load, extend `index.html`'s existing pre-paint inline `<script>` (which already applies the dark/light `.dark` class synchronously before first paint, reading a saved `ck-theme` preference from `localStorage`) to also set a `data-theme` attribute from a saved theme preference the same way — prefer CSS-custom-property/attribute switching over swapping `<link>` stylesheet files unless the project ends up with many themes or individually large theme files. See `~/.claude/CLAUDE.md` §2 File Size & Modularity for the general rule this follows.
- **i-9 — No frontend test coverage exists at all.** `tests/` only exercises the backend (`server/**`) via `node:test` + an in-memory SQLite DB (see i-2). None of `ui_design/js/**` — controllers, services, router — has any automated coverage; verification there is entirely manual/live-browser today. Surfaced while splitting the former `databaseController.js` monolith (see the "Resolving i-8" section below) with zero safety net. Setting this up properly is its own scoping decision (jsdom-based fast DOM-shape tests vs. real browser automation like Playwright), comparable in size to i-2 — deserves the same kind of dedicated discussion before implementation, not a quick add-on to another task.

## From resolving i-8 (2026-09-04)

Split the former 1,185-line `ui_design/js/controllers/databaseController.js` monolith into `ui_design/js/controllers/database/` (10 files: entry point, leaf state module, 4 domain renderers, 4 entity modals), each comfortably under the 300-line ceiling. Verified live in the browser across every tab and modal — see the module map (`docs/architecture/module-map/index.md`, "Frontend: Database View" section) for the new structure. No new ideas surfaced beyond i-9 above.

## From resolving i-6 (2026-09-05)

Added `tests/unit/maintenance.unit.test.js` (mirrors the orders suite — dual-write, case creation, item add) and `tests/unit/pista-db.unit.test.js` (processed-emails + sender-rules graceful degradation; deliberately excludes the chat-log functions, see `docs/.notes/bugs.md` b-8). Found and fixed two real column-name bugs in `robot-pista-db.js` while writing tests for it (`sender_email`/`receiver_email` → `from_address`/`to_address`), and added the missing graceful-degradation guard to `getSenderRule()` to match its sibling. 57/57 tests passing. No new ideas surfaced beyond b-8 (logged separately).
