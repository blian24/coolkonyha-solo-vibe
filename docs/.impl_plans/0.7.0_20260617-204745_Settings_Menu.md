# Create Settings Menu with General and Admin Sections
**Task:** [86caakwtp](https://app.clickup.com/t/86caakwtp)
**Target version:** v0.7.0 (new feature → MINOR increment)

## Context

The Settings route already exists in the router (`settings → /ui_design/views/settings.html`) but the view is a stub placeholder. The task is to replace it with a fully functional, styled Settings page matching the Oceanic Plus design system.

## Proposed Changes

### View Layer

#### [MODIFY] ui_design/views/settings.html
Replace stub with a two-section layout:
- Header bar (section-header style) with gear icon + "SETTINGS" title + version badge
- Tab bar: General | Admin tabs
- **General:** Theme toggle, Language selector (placeholder), Sidebar reset button
- **Admin:** Clear Logs button (toast feedback), System info card (version from /VERSION), Feature flags table (visual-only)

### Controller Layer

#### [NEW] ui_design/js/controllers/settingsController.js
- `initSettingsController()` — entry point
- Tab switching logic
- Theme toggle state reflection
- Toast notification for Clear Logs
- Version fetch from /VERSION

### Router Update

#### [MODIFY] ui_design/js/router.js
- Import `initSettingsController`
- Add `settings` route branch

### CSS

#### [MODIFY] ui_design/css/oceanic-plus.css
New classes: `.settings-tab-bar`, `.settings-tab-btn`, `.settings-section`, `.settings-row`, `.settings-label`, `.settings-desc`, `.settings-divider`, `.feature-flag-table`, `.toast-notification`

### Documentation & Versioning

- VERSION: 0.6.0 → 0.7.0
- docs/.versions/v0.7.0.md (new release notes)
- SOLUTION_DESIGN.md (version + matrix update)
- docs/architecture/settings-view.md (new 4-part doc)

## Open Questions

1. Admin section always visible (no auth) — confirm?
2. Feature flags: purely visual placeholder, or wire real ones?

## Verification Plan

1. Click "Settings" sidebar → view loads correctly
2. Tab switching works
3. Dark/Light toggle fires toggleTheme()
4. Admin section shows version from /VERSION
5. Clear Logs button shows toast
6. Styling matches Oceanic Plus design system
