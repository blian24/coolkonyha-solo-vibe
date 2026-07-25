# CoolKonyha — Stability Analysis & Model Comparison
**Analyzed by:** Claude Sonnet 4.6 (Thinking) vs. Gemini Flash (Medium)
**Date:** 2026-05-25

---

## 1. Codebase State Overview

The application is a **Vite-served SPA** with:
- A plain HTML shell (`index.html`) — not React-driven
- A client-side `router.js` loading HTML view fragments dynamically
- Two controllers: `dashboardController.js`, `databaseController.js`
- A global data service loaded as a classic `<script>` tag (not an ES module)
- A backend Express server on `:3001` with a fully functional SQLite layer (36/36 tests passing)

The last major commit (`054ed4c`) merged: SPA refactor + English UI migration + router + both controllers — all in one large commit. This is the unstable point.

---

## 2. Confirmed Bugs

### BUG-01 — Database tab permanently stuck on "Loading..." *(Critical)*
**File:** `databaseController.js:9` + `databaseController.js:44-46`

```js
let currentTab = 'customers'; // initialized as 'customers'

window.switchTab = async (tab) => {
  if (currentTab === tab) return; // ← early-return fires immediately on boot!
```

On startup, `initDatabaseController()` calls `switchTab('customers')`, but `currentTab` is already
`'customers'`, so the guard triggers immediately and no data is ever fetched or rendered.

> **Gemini Flash identified this** ✅ — described correctly as the root cause of the loading freeze.
> **Claude confirms** ✅ — verified directly in source + confirmed no data fetch occurs.

---

### BUG-02 — Two crossed wires in error-fallback logic *(New — not found by Gemini Flash)*
**File:** `databaseController.js:586-614`

```js
// In prefetchOrders() — supposed to build orderCountMap from orders:
} catch (_) { customersCache = await window.dataService.getMockDataForTab('customers'); }
//                 ↑ Wrong! On orders-fetch failure, it overwrites customersCache with customers,
//                   and orderCountMap is never built. Order count badges all show 0.

// In initDatabaseController() — supposed to populate customersCache:
} catch (_) { allOrders = await window.dataService.getOrders(); orderCountMap = {}; ... }
//                 ↑ Wrong! On customers-fetch failure, it builds allOrders/orderCountMap
//                   but customersCache stays null. Customer names/logos are blank in Orders tab.
```

The two catch blocks are **swapped**. Each error handler does what the *other* block was supposed to do.
This is a copy-paste logic inversion introduced during the "mock fallback" session.

> **Gemini Flash missed this entirely** ❌
> **Claude identifies it** ✅ as a distinct, silent data corruption bug

---

### BUG-03 — `dataService` referenced inconsistently across controllers *(New — not found by Gemini Flash)*
**File:** `dashboardController.js` (ES module) vs. `index.html` (classic script)

`dataService.js` is loaded as a **classic `<script>`** tag in `index.html` (line 10), which correctly
exposes `window.dataService`. However, `dashboardController.js` — loaded as an **ES module** via
`router.js` — references `dataService` (bare, not `window.dataService`) throughout.

In ES module scope, bare `dataService` is **not** the same as `window.dataService`. The dashboard
controller relies on this implicitly working because browsers do not throw if a bare name resolves
to a global in non-strict module contexts, but this is architecturally fragile and breaks if
`dataService.js` is ever converted to a proper ES module (which it should be).

`databaseController.js` correctly uses `window.dataService` throughout (lines 66, 595, 610).
`dashboardController.js` uses bare `dataService` throughout (lines 20, 65, 88, 101, 105...).

> **Gemini Flash missed this** ❌
> **Claude identifies it** ✅ as a latent architecture violation

---

### BUG-04 — Reports & Settings navigation silently does nothing *(Both models identified)*
**File:** `router.js:52-59`

```js
if (text.includes('dashboard')) loadRoute('dashboard');
else if (text.includes('database')) loadRoute('database');
// Reports and Settings: no handler, no placeholder, no error
```

The nav items are rendered but produce zero visual feedback when clicked.

> **Gemini Flash identified this** ✅
> **Claude confirms** ✅ — additionally notes this is a UX failure (no disabled state, no "coming soon" message)

---

### BUG-05 — Stat boxes show hardcoded numbers, not real data *(New — not found by Gemini Flash)*
**File:** `dashboard.html:53,68`

```html
<span ...>124</span>   <!-- Active Orders: hardcoded -->
<span ...>210</span>   <!-- Closed in 30 days: hardcoded -->
```

The dashboard stat boxes were never wired to `dataService.getOrders()`. They display static placeholder
numbers from the design prototype.

> **Gemini Flash missed this** ❌
> **Claude identifies it** ✅

---

### BUG-06 — Language inconsistency in "What's New" feed *(Both models identified partially)*

Mock data in `dataService.js` (WHATS_NEW array, lines 11-48) contains Hungarian strings used
as fallback when the API is unavailable. The API-fetched `getUpdates()` method also produces
Hungarian strings (`title: 'Rendelés Frissítés: ...'`, line 209).

> **Gemini Flash identified this** ✅ — but described it only as a localization cleanup task
> **Claude notes** ✅ — this is actually a **data contract violation**: the Language Policy
> (v0.5.2 release notes) specifies "UI scaffolding: English; Business data: Hungarian".
> `title` and `suggestion` are UI-generated strings, not user data, so they must be English.

---

## 3. Side-by-Side Comparison

| Finding | Gemini Flash | Claude Sonnet 4.6 |
|---|---|---|
| BUG-01: Database tab freeze (early-return in `switchTab`) | ✅ Found | ✅ Confirmed |
| BUG-02: Swapped catch blocks (crossed wires in fallbacks) | ❌ Missed | ✅ Found |
| BUG-03: `dataService` vs `window.dataService` inconsistency | ❌ Missed | ✅ Found |
| BUG-04: Reports/Settings nav does nothing | ✅ Found | ✅ Confirmed |
| BUG-05: Stat boxes are hardcoded | ❌ Missed | ✅ Found |
| BUG-06: Language policy violation in mock/API strings | Partial | ✅ Clarified |
| Backend / test suite stability | ✅ Correct (36/36 pass) | ✅ Confirmed |
| Recommendation: Fix vs. Revert | Fix (Path A) | Fix (Path A) |

**Total bugs found:** Gemini Flash: 3 | Claude Sonnet 4.6: **6**

---

## 4. Architecture Risk Assessment

> [!IMPORTANT]
> The single-commit SPA migration (`054ed4c`) bundled too many concerns:
> SPA shell + router + two new controllers + English translation + mock fallbacks.
> This is why regressions are scattered across multiple files and were harder to spot.

The backend is **100% stable** — do not touch it.

All 6 bugs are strictly in the frontend SPA layer and are all fixable with small, targeted edits:

| Bug | Fix complexity | Lines affected |
|---|---|---|
| BUG-01 | Trivial | 1 line (`null` init) |
| BUG-02 | Simple | 2 catch blocks swapped |
| BUG-03 | Architecture | Replace bare `dataService` with `window.dataService` in dashboardController |
| BUG-04 | UX polish | Add placeholder route views |
| BUG-05 | Medium | Wire stat boxes to live API call in `initDashboardController` |
| BUG-06 | Cleanup | Translate mock `title`/`suggestion` strings |

---

## 5. Recommendation

**Fix the current code (Path A)** — same conclusion as Gemini Flash, but with a more complete
bug register. There are now **6 confirmed issues** to address, not 3.

Reverting would lose all SPA architecture progress and the English migration. The bugs are
localized, not structural.

> [!TIP]
> Before implementing fixes, we should also track these as ClickUp tickets given we now have
> a clearer picture of what broke and why.
