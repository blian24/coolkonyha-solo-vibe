# Email Robot Architecture

**Component:** `Email Robot`
**Type:** 🤖 Robot (deterministic, no AI)
**Status:** Implemented — [`server/robots/email-robot.js`](../../server/robots/email-robot.js) (moved into `server/robots/` during the v0.8.0 split; previously sat directly under `server/`). **Not yet wired into the live server**: nothing currently instantiates or schedules it, so the Gmail polling pipeline described below does not run in production yet.

## 1. Purpose

The **Email Robot** is a mechanical connector with a single job: fetch emails from Gmail, apply learned sender rules, and hand relevant emails to P.I.S.T.A. for processing. It contains **no AI reasoning** — it only retrieves, deduplicates, filters, and delivers raw data.

Key responsibilities:
- **Fetch:** Monitor both `INBOX` and `SENT` folders in Gmail via the Gmail API
- **Deduplicate:** Check each email's `gmail_message_id` against the `processed_emails` table — skip any already seen
- **Filter:** Check sender against `customers` and `sender_rules` tables — apply learned rules automatically
- **Strip:** Remove quoted email history from the body, keeping only the newest message block
- **Deliver:** Pass the clean payload to P.I.S.T.A. for interpretation, with metadata flags

## 2. Architecture/Flow

```mermaid
graph TD
    Gmail[Gmail API] -->|push or poll| Robot[Email Robot]
    Robot -->|check gmail_message_id| DB["processed_emails"]
    DB -->|already exists| Skip[Skip - already processed]
    DB -->|new email| CustCheck{from_address in customers?}
    CustCheck -->|yes| Strip[Strip quoted history]
    CustCheck -->|no| RuleCheck{from_address in sender_rules?}
    RuleCheck -->|action = skip| AutoSkip[Auto-skip & log]
    RuleCheck -->|action = notify / auto_customer| Strip
    RuleCheck -->|no rule| Strip
    Strip -->|payload + metadata flags| PISTA["P.I.S.T.A."]
    PISTA -->|proposal stored| Done[Mark 'processed' in DB]
    Done -->|applyPistaLabel| Label[Apply Gmail label \"pista\"]
```

### Trigger Methods

| Method | Description |
|---|---|
| **Push (preferred)** | Gmail `watch()` API sends a Pub/Sub notification on any mailbox event — near real-time |
| **Polling (fallback)** | `setInterval` checking Gmail API every N minutes — simpler but adds latency |

### Processing Pipeline

1. **Incremental fetch:** Request only messages that arrived since the last check — never scan the full mailbox.
   - **Push mode:** Gmail `watch()` delivers only new events — inherently incremental.
   - **Polling mode:** Use Gmail's `historyId` (stored after each successful run) to request only changes since the last poll. On first-ever run, use a date-based query (`after:YYYY/MM/DD`) seeded from configuration.
2. **Deduplication (safety net):** For each `gmail_message_id` → query `processed_emails`. If found → skip entirely. This catches edge cases (e.g., restart with stale `historyId`), but on normal runs step 1 already excludes old messages.
3. If not found → insert a `pending` row into `processed_emails`
4. **Customer lookup:** Check `from_address` against `customers` table
   - Known customer → set `known_sender: true`
5. **Sender rules lookup** (only if unknown sender): Check `from_address` against `sender_rules` table
   - Rule with `action = skip` → set `processed_emails.status = 'skipped'`, done (no handoff)
   - Rule with `action = notify` or `auto_customer` → include the `rule` in the payload
   - No rule found → set `known_sender: false`
6. Strip quoted email history, deliver payload to P.I.S.T.A.
7. Mark the `processed_emails` row as `'processed'`.
8. **Apply Gmail label "pista"** to the original Gmail message via the Gmail API label modify endpoint.
   - On the first run the robot checks if the label exists using `gmail.users.labels.list`; if not, it creates it with a light-blue color (`#4a86e8`) using `gmail.users.labels.create`.
   - The resolved label ID is cached in memory for the session to avoid repeated API calls.
   - A labeling failure is **non-fatal** and only logs a warning — it never aborts the main pipeline.

## 3. Input/Output Specifications

### Inputs
- Gmail API: list of message IDs from INBOX and SENT since last check
- `processed_emails` table: existing message IDs

### Outputs (payload to P.I.S.T.A.)

```json
{
  "gmail_message_id": "18e3f...",
  "thread_id": "18e3f...",
  "email_date": "2026-03-09T18:00:00Z",
  "direction": "received",
  "from_address": "client@example.com",
  "to_address": "ck@coolkonyha.com",
  "subject": "Re: Offer for 100 units",
  "newest_body_block": "Thanks, we accept the offer. Please confirm delivery.",
  "known_sender": true,
  "rule": null
}
```

## 4. Security Considerations

- **OAuth2 only:** Gmail API access must use OAuth2 tokens stored as environment variables — never hardcoded credentials.
- **`gmail.modify` scope required:** The robot needs `gmail.modify` (not just `gmail.readonly`) in order to add the "pista" label to processed emails. All other operations remain read-access only.
- **Minimal data:** Only the newest message block is forwarded — full email bodies are never stored in the DB.
- **Dedup is the safety net:** The `gmail_message_id UNIQUE` constraint in `processed_emails` provides a second layer of protection against duplicate processing even if the robot's in-memory state is lost.
- **Label failure is non-fatal:** If the Gmail labels API is unreachable, the email is still processed and handed to P.I.S.T.A. — the label step is best-effort.

## Cross References
- **P.I.S.T.A.:** [`docs/assistant_team/pista-agent.md`](./pista-agent.md)
- **DB Schema (processed_emails, sender_rules):** [`docs/architecture/database-schema.md`](./database-schema.md)
- **Solution Design:** [`SOLUTION_DESIGN.md`](../../SOLUTION_DESIGN.md)
