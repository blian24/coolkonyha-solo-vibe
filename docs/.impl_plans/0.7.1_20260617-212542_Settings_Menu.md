# Create Settings Menu with General and Admin Sections
**Task:** [86caakwtp](https://app.clickup.com/t/86caakwtp)  
**Target version:** v0.7.1 (0.7.0 is claimed by a parallel task; this is the next slot)

> [!IMPORTANT]
> VERSION file will only be bumped **after** the parallel 0.7.0 task is committed to avoid write conflicts.

## Context

The Settings route already exists in the router (`settings → /ui_design/views/settings.html`) but the view is a stub placeholder. The task is to replace it with a fully functional, styled Settings page that matches the Oceanic Plus design system.

## Proposed Changes

---

### View Layer

#### [MODIFY] [settings.html](file:///d:/dev/coolkonyha-solo-vibe/ui_design/views/settings.html)

Replace the stub with a full two-section layout:

- **Header:** `section-header` bar with gear icon + "SETTINGS" title + version badge.
- **Tab bar:** Two tab buttons — `General` and `Admin` — styled like the sub-header pattern. Switching tabs shows/hides the appropriate section panel.
- **General Settings section:**
  - Theme toggle (Dark/Light Mode) — wired to `toggleTheme()` that already exists in `index.html`
  - UI Language selector (placeholder, non-functional for now — just a `<select>` with two options)
  - Sidebar width reset button
- **Admin Settings section:**
  - Shown/hidden based on selected tab
  - Database maintenance action: "Clear Logs" button (placeholder action with toast feedback)
  - **NEW:** "Extend the database view" toggle. When off, the Database view only shows essential tables (Customers, Suppliers, Products, Orders, Order Items, Maintenance Cases, Maintenance Items). When on, all tables and system logs (History, Workflow, Emails, etc.) are shown.
  - System info card: shows app version, build info
  - Feature flags table: a static, read-only table with 2-3 toggle rows (visual only for now)

> [!NOTE]
> All controls are either wired to existing global functions or are visual-only placeholders. No backend calls in this phase.

---

### Controller Layer

#### [NEW] [settingsController.js](file:///d:/dev/coolkonyha-solo-vibe/ui_design/js/controllers/settingsController.js)

Responsibilities:
- `initSettingsController()` — entry point called by the router
- Tab switching logic (General ↔ Admin)
- Reads current theme state and reflects it in the toggle
- **NEW:** Reads "Extend the database view" state from `localStorage` and syncs the toggle. Saves state on change.
- Wires the "Clear Logs" button to a toast notification
- Populates version from a `fetch('/VERSION')` call to display in the Admin section

#### [MODIFY] [database.html](file:///d:/dev/coolkonyha-solo-vibe/ui_design/views/database.html) (or `databaseController.js`)
- On load (or via controller), read the `localStorage` key for the "Extend database view" setting.
- If false (default/off), add a CSS class or inline styles to hide the advanced database tabs (History, Workflow, Emails, Sender Rules) and their group headers if empty.

---

### Router Update

#### [MODIFY] [router.js](file:///d:/dev/coolkonyha-solo-vibe/ui_design/js/router.js)

- Add import for `initSettingsController`
- Add `else if (route === 'settings')` branch to call `initSettingsController()`

---

### CSS

#### [MODIFY] [oceanic-plus.css](file:///d:/dev/coolkonyha-solo-vibe/ui_design/css/oceanic-plus.css)

Add reusable classes needed for the Settings layout (none of the existing classes cover these patterns):
- `.settings-tab-bar` — horizontal tab button row
- `.settings-tab-btn` / `.settings-tab-btn.active` — pill-style tab buttons
- `.settings-section` — content panel with padding
- `.settings-row` — a single setting row (label + description + control, flex justified)
- `.settings-label` + `.settings-desc` — typography for setting names and hints
- `.settings-divider` — section divider line
- `.feature-flag-table` — lightweight table for admin feature flags
- `.toast-notification` — small bottom-right toast for feedback (reusable across the app)

---

### Documentation & Versioning

#### [MODIFY] [VERSION](file:///d:/dev/coolkonyha-solo-vibe/- VERSION: → 0.7.1 (written **last**, after parallel 0.7.0 task is merged)

#### [NEW]- docs/.versions/v0.7.1.md (new release notes) for this feature

#### [MODIFY] [SOLUTION_DESIGN.md](file:///d:/dev/coolkonyha-solo-vibe/SOLUTION_DESIGN.md)
- Update "Current Version" reference
- Add Settings UI entry to the Component Responsibility Matrix

#### [NEW] docs/architecture/settings-view.md
- 4-part documentation for the Settings view

---

## Open Questions

> [!IMPORTANT]
> **Admin section visibility:** Should the Admin tab always be visible to all users, or should it only appear based on a role/flag? Since there is no auth system yet, I'm defaulting to **always visible** — but I want your confirmation.

> [!NOTE]
> **Feature flags:** In the Admin section I plan to include a static (visual-only) feature flags table. Are there any real flags or toggles you'd like to wire up now, or should it be purely placeholder?

## Verification Plan

### Manual Verification
1. Click "Settings" in the sidebar → view loads (no error, no placeholder text)
2. Tab switching between General and Admin works smoothly
3. Dark/Light mode toggle in General settings fires `toggleTheme()` correctly
4. Admin section shows version number fetched from `/VERSION`
5. "Clear Logs" button shows a toast notification
6. All styling matches the Oceanic Plus design system
