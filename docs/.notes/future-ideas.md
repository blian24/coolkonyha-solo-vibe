# Future Ideas

Informal, running backlog of things worth doing eventually — not authoritative, not tracked/committed work. Filled in automatically as ideas come up during sessions (not what's decided/done in the moment — see session walkthroughs for that). When one is ready to actually be worked on, promote it to a ClickUp ticket (per the usual workflow) and remove it from here.

**Next ID:** 6

## From the 2026-09-03 documentation consistency pass

- **i-2 — Retarget `tests/helpers/agent-factory.js`.** Unit tests currently validate a hand-mirror of the old `agent.js` logic, not the live `server/robots/robot-orders.js` / `robot-maintenance.js`. Integration/E2E tests do exercise the real files via HTTP, so this isn't a coverage gap in practice, but it's a stale test-architecture decision worth revisiting.
- **i-3 — Wire P.I.S.T.A. and the Email Robot into the live server.** Both are fully implemented (`server/pista.js`, `server/robots/email-robot.js`) but nothing currently instantiates or schedules either — no route, no cron/poller. This is presumably the next real feature milestone once the architecture housekeeping settles.
