# Module: robot-pista-db.js
**Responsibility:** Provides persistence for P.I.S.T.A. chat history, processed email records, and sender filtering rules.
**Location:** `server/robots/robot-pista-db.js`
**Depends on:** `server/db.js`
**Consumed by:** `server/routes.js`, `server/pista.js`, `server/robots/email-robot.js`

## Exports
| Name | Type | Description |
|------|------|-------------|
| saveChatMessage() | function | Persists chat message and optional AI proposal |
| getChatHistory() | function | Fetches chronological chat history (oldest-first) |
| getProcessedEmails() | function | Returns all processed emails with linked order codes |
| getRecentEmailsByAddress() | function | Returns last 5 emails for a sender/receiver address |
| insertPendingEmail() | function | Registers pending email record idempotently |
| updateEmailStatus() | function | Updates email processing status and AI summary |
| filterUnprocessedEmailIds() | function | Filters out already processed Gmail message IDs |
| getSenderRules() | function | Returns all sender filtering rules |
| getSenderRule() | function | Finds matching sender rule by email or domain |

## Key Concepts
- Graceful degradation: returns empty arrays if `processed_emails` or `sender_rules` tables do not exist yet.
- Idempotent email registration via `INSERT OR IGNORE` on `gmail_message_id`.
- Chronological ordering: subquery fetches newest entries up to limit, outer query orders oldest-first.

## What is NOT here
- AI prompts and reasoning algorithms — see `server/pista.js`.
- Gmail API calls and email retrieval — see `server/robots/email-robot.js`.
- Customer profile lookups — see `server/robots/robot-crm.js`.
