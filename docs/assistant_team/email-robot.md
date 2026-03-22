# Email Robot Architecture

**Component:** `Email Robot`
**Type:** 🤖 Robot (deterministic, no AI)
**Status:** Planned — not yet implemented

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
- **Read-only Gmail scope:** The robot only needs `gmail.readonly` — it must not request write permissions.
- **Minimal data:** Only the newest message block is forwarded — full email bodies are never stored in the DB.
- **Dedup is the safety net:** The `gmail_message_id UNIQUE` constraint in `processed_emails` provides a second layer of protection against duplicate processing even if the robot's in-memory state is lost.

## Cross References
- **P.I.S.T.A.:** [`docs/assistant_team/pista-agent.md`](./pista-agent.md)
- **DB Schema (processed_emails, sender_rules):** [`docs/architecture/database-schema.md`](./database-schema.md)
- **Solution Design:** [`SOLUTION_DESIGN.md`](../../SOLUTION_DESIGN.md)
