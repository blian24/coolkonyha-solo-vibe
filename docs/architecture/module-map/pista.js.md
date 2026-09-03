# Module: pista.js
**Responsibility:** Implements P.I.S.T.A. AI agent to analyze business events and generate structured proposals for CK.
**Location:** `server/pista.js`
**Depends on:** `@google/generative-ai`, `robot-crm.js`, `robot-orders.js`, `robot-pista-db.js`
**Consumed by:** `server/robots/email-robot.js`, test/CLI scripts

## Exports
| Name | Type | Description |
|------|------|-------------|
| default (`PistaAgent`) | class | AI Business Manager agent interfacing with Gemini LLM |
| PistaAgent.receiveEmail() | method | Analyzes incoming email and generates proposal for CK |
| PistaAgent.checkWorkflowHealth() | method | Detects stuck orders and proposes follow-up actions |
| PistaAgent.receiveChat() | method | Processes natural language chat from CK with history |

## Key Concepts
- Human-in-the-Loop: strictly proposes actions and NEVER executes direct database writes.
- Enforces Senior Business PM persona and strict JSON output schema via immutable system prompt.
- Pre-flight token check blocks oversized requests to prevent runaway LLM costs.
- Automatically saves proposals and chat interactions to DB via `robot-pista-db.js`.

## What is NOT here
- Direct database writes — all mutations must go through robot modules upon approval.
- Gmail fetching and raw email parsing — see `server/robots/email-robot.js`.
- HTTP route definitions — see `server/routes.js`.
