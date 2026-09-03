# Module: index.html (SPA Shell)

**Responsibility:** Root HTML shell for the CoolKonyha SPA — defines the persistent sidebar, modal templates, theme logic, and the `<main>` content container into which all views are dynamically injected by the router.
**Location:** `index.html`
**Depends on:** `ui_design/css/oceanic-plus.css`, `ui_design/js/router.js`, `ui_design/js/services/dataService.js`, Tailwind CDN, Font Awesome CDN, Google Fonts
**Consumed by:** `server/index.js` (served at `/`), browser directly

## Exports

| Name | Type | Description |
|------|------|-------------|
| `toggleTheme()` | global function | Toggles `.dark` class on `<html>`, persists to `localStorage`, syncs sidebar label and settings checkbox |
| `openModal(id)` | global function | Opens a modal overlay by adding the `.open` class |
| `closeModal(id)` | global function | Closes a modal overlay |
| `closeBg(e, id)` | global function | Closes modal when clicking the backdrop |
| `#app-content` | DOM element | `<main>` container where router injects view HTML |
| `#frost-flash` | DOM element | Full-screen overlay used for the theme-switch animation |
| `#theme-toggle` | DOM element | Theme toggle button in the sidebar (calls `toggleTheme()`) |
| `#theme-label` | DOM element | Sidebar label showing current mode ("Dark Mode" / "Light Mode") |
| `#tpl-wn-row` | `<template>` | Row template for "What's New" dashboard table |
| `#tpl-order-row` | `<template>` | Row template for Orders table |

## Key Concepts

- **Shell-only pattern:** `index.html` contains no view content itself. All page content is fetched and injected by `router.js` into `#app-content` on navigation.
- **Theme initialization:** A IIFE in `<head>` applies the stored theme from `localStorage` before first paint, preventing a flash of the wrong color scheme. Default is dark.
- **Global function scope:** `toggleTheme()`, `openModal()`, `closeModal()`, `closeBg()` are defined in a regular (non-module) `<script>` block so they are accessible from `onclick` attributes in dynamically loaded views.
- **Single source of truth for theme:** `toggleTheme()` here is the only definition. `databaseController.js` previously had a duplicate that has been removed.
- **Sidebar resizer:** Drag logic clamps the sidebar between 13vw and 23vw.

## What is NOT here

- View content (dashboard, maintenance, orders, etc.) — see `ui_design/views/`
- CSS styling — see `ui_design/css/oceanic-plus.css`
- Navigation event handling — see `ui_design/js/router.js`
- API data fetching — see `ui_design/js/services/dataService.js`
- Controller logic per view — see `ui_design/js/controllers/`
