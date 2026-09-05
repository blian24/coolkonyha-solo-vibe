# Bugs

Informal, running backlog of suspected/confirmed defects — not authoritative, not tracked/committed work. Filled in automatically as issues surface during sessions. Format: `b-<number>-<priority>`. When one is ready to actually be worked on, promote it to a ClickUp ticket (per the usual workflow) and remove it from here.

**Next ID:** 9

**Priority levels** (lowest → highest): Maintenance, Relevant, Critical, Nuclear — full definitions in `~/.claude/CLAUDE.md` §8.6.

## Found while scoping i-6 (2026-09-05)

- **b-8-relevant — `saveChatMessage()`/`getChatHistory()` in `server/robots/robot-pista-db.js` reference a `pista_chat_logs` table that doesn't exist in production.** Confirmed via direct schema introspection (`PRAGMA`/`sqlite_master` against `coolkonyha.db`) — not a guess. Unlike the sibling `getProcessedEmails()`/`getSenderRules()`, neither function has a graceful-degradation try/catch, so calling either would throw an uncaught "no such table" error. Zero live impact today since P.I.S.T.A. isn't wired into the server yet (i-3) — nothing has ever actually called these. Deliberately not fixed as part of i-6: creating the table is a feature decision (should chat persistence exist before PISTA itself is wired up?) that belongs with i-3, not a test-writing task.
