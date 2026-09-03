# Module: email-robot.js
**Responsibility:** Deterministic worker that fetches, deduplicates, strips, and labels Gmail messages before forwarding to P.I.S.T.A.
**Location:** `server/robots/email-robot.js`
**Depends on:** `googleapis`, `robot-pista-db.js`, `robot-crm.js`
**Consumed by:** Scheduled background runners and email polling scripts

## Exports
| Name | Type | Description |
|------|------|-------------|
| default (`EmailRobot`) | class | Polling robot handling Gmail ingestion and message preprocessing |
| EmailRobot.tick() | method | Executes polling cycle across INBOX/SENT and runs preprocessing pipeline |

## Key Concepts
- Runs an 8-step pipeline: fetch, deduplicate, filter via rules, match customer, strip quotes, dispatch, update DB, label.
- Quote stripping: removes quoted threads/replies via regex heuristics to preserve LLM token context.
- Gmail visual labeling: automatically creates/applies the `pista` label so humans see what was handled.
- Non-blocking labeling: failure to apply a label does not abort the message processing flow.

## What is NOT here
- AI reasoning and decision making — delegated to `server/pista.js`.
- Direct database persistence — delegated to `robot-pista-db.js`.
- HTTP endpoints — see `server/routes.js`.
