# Future Ideas

Informal, running backlog of things worth doing eventually — not authoritative, not tracked/committed work. Filled in automatically as ideas come up during sessions (not what's decided/done in the moment — see session walkthroughs for that). When one is ready to actually be worked on, promote it to a ClickUp ticket (per the usual workflow) and remove it from here.

**Next ID:** 7

## From the 2026-09-03 documentation consistency pass

- **i-3 — Wire P.I.S.T.A. and the Email Robot into the live server.** Both are fully implemented (`server/pista.js`, `server/robots/email-robot.js`) but nothing currently instantiates or schedules either — no route, no cron/poller. This is presumably the next real feature milestone once the architecture housekeeping settles.

## From resolving i-2 (2026-09-04)

- **i-6 — No direct unit coverage for `robot-maintenance.js` or `robot-pista-db.js`.** The unit suite only ever tested orders/CRM/catalog logic (`robot-orders.js`, `robot-crm.js`, `robot-catalog.js`) — that was true before i-2's retargeting too, so it's a pre-existing gap, not something the retargeting made worse. Integration/E2E tests don't cover the maintenance domain or PISTA persistence at all either. Worth adding a maintenance-domain unit suite (dual-write + pricing continuity, mirroring the orders one) if that domain sees active development.
