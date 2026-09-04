# Module: renderers-email.js

**Responsibility:** Table renderers for the Email & AI domain: Processed Emails, Sender Rules (extended-view tabs).
**Location:** `ui_design/js/controllers/database/renderers-email.js`
**Depends on:** `state.js` (`expandedRows`, `fieldHtml`, `fmtDate`, `fmtDt`)
**Consumed by:** `databaseController.js` (render dispatch)

## Exports

| Name | Type | Description |
|------|------|-------------|
| `renderProcessedEmails(data)` | function | Expandable-drawer table of emails P.I.S.T.A.'s Email Robot has processed |
| `renderSenderRules(data)` | function | Expandable-drawer table of learned sender filtering rules |

## Key Concepts

- `directionBadge`, `actionBadge`, and `emailStatusPill` are private to this file (not exported from `state.js`) since nothing else in the Database view needs them — kept local rather than added to the shared formatter surface.
- Both tables are currently empty in practice: `processed_emails` and `sender_rules` are populated only once the Email Robot / P.I.S.T.A. are wired into the live server (`docs/.notes/future-ideas.md` i-3, not yet done).

## What is NOT here

- Master Data / Orders / Maintenance table renderers — see the sibling `renderers-*.js` files
