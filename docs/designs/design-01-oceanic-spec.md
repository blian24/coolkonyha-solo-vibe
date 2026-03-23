# Design System & Specification: 01 Oceanic (v1)

**Status:** Deployed (v1.0.0)  
**Theme:** "Oceanic" — A deep, professional, glassmorphic dark theme with a clean, high-contrast light mode counterpart, tailored for a pro-grade B2B project management dashboard.

---

## 1. Global Tokens

### Typography
- **Core Font Family:** `'Inter', sans-serif`
- **Font Weights:** `400` (Regular), `600` (Semibold), `700` (Bold), `800` (ExtraBold).
- **Section Headers:** Uppercase, tracking (letter-spacing) at `0.15em`, font-weight `800`.
- **Base Font Size:** `md` (`1rem`) in Tailwind terms. Small labels use `0.65rem` to `0.75rem`.

### Color Palette: Dark Mode (Default)
- **Background (`.bg-ck-bg`):** `#050d18` (Deep midnight blue)
- **Surface / Cards (`.card-inner`):** `#0b1a2e` (Slightly elevated marine blue)
- **Primary Text (`.text-ck-text`):** `#e2e8f0` (Slate-200, off-white for reduced eye strain)
- **Accent Primary (`.text-ck-cyan`):** `#0077B6` (vibrant ocean blue/cyan) 
- **Borders / Dividers:** `rgba(220, 234, 247, 0.1)` (Subtle, slightly cyan-tinted low-opacity white)
- **Glass / Input Background:** `rgba(255, 255, 255, 0.03)` with `rgba(255, 255, 255, 0.08)` border.

### Color Palette: Light Mode
- **Background:** `#f8fafc` (Slate-50, soft white)
- **Surface / Cards:** `#ffffff` (Pure white)
- **Primary Text:** `#0f172a` (Slate-900, near-black)
- **Accent Primary (`.text-ck-ocean`):** `#0077B6` (same primary blueprint)
- **Borders / Dividers:** `#e2e8f0` (Solid slate-200)
- **Input Background:** `#f1f5f9` (Slate-100)

---

## 2. Layout Architecture
The dashboard uses a full-viewport, non-scrolling `h-screen` structure, relying entirely on internal flex-box scrolling vectors.

### 2.1 Macro Grid
- **Root Element (`body`):** `flex flex-row p-8 gap-8` (2rem padding, 2rem gap).
- **Left Sidebar:**
  - Initial width: `18vw` (min-width `200px`).
  - Contains an absolute-positioned vertical drag handle (`.sidebar-resizer`) on its right edge.
  - Dynamically resizable between `10%` and `30%` of viewport width.
- **Main Content Area:**
  - Standard `flex-1 flex col gap-8`.
  - Splits vertically into two major structural blocks: **Top** and **Bottom**.

### 2.2 Micro Grid (Right Side Panels)
- **Top Block ("Mi Újság?"):** 
  - Restricted via inline style `max-height: 35%`. Shrinks to fit contents, but never exceeds 35% to protect the active orders below.
- **Bottom Block (Merged active orders & details):**
  - Flexes to fill the remaining vertical space (`flex-1 min-h-[0]`).
  - Arranged as a unified card containing two columns separated by a vertical border (`.divider-line`).
  - Left column ("Aktív rendelések"): Exact `65%` width.
  - Right column ("Részletek"): Exact `35%` width.

---

## 3. Core Components

### 3.1 Glassmorphic Cards (`.card-shadow`)
- **Structure:** A wrapper `div.card-shadow` containing an inner `div.card-inner`.
- **Dark Shadow:** `0 8px 32px rgba(0,0,0,0.5)`, inner border `1px solid rgba(255, 255, 255, 0.05)`.
- **Light Shadow:** `0 4px 6px -1px rgba(0,0,0,0.1)`, inner border `1px solid #e2e8f0`.
- **Corner Radius:** `1.5rem` (`rounded-3xl`).

### 3.2 Chat Interface (P.I.S.T.A.)
- Custom scrolling area (`.chat-scroll-area`) with hidden/minimal scrollbars.
- **AI Bubbles:** Align left. Implicit backgrounds, slightly dimmed opacity (`0.9`). AI Name Label sits directly above the text (`.chat-label`).
- **User Bubbles:** Align right. Bright solid background (`#0077B6`), white text, `rounded-2xl` with a sharp bottom-right corner (`border-bottom-right-radius: 4px`).

### 3.3 Inputs & Controls
- **`.carved-input-wrap`:** A pill-shaped container housing icons and a transparent text input.
  - Dark mode: `rgba(255,255,255,0.03)` background.
  - Light mode: `#f1f5f9` background.
- **Action Buttons (`.btn-action`):** Small icon-only squares (`32x32px`), rounded.
  - Approve button: Green hover (`#10b981`).
  - Edit button: Blue hover (`#3b82f6`).

### 3.4 Data Tables
- Header logic (`.section-header`): Minimalist layout utilizing space-between flex arrangement. Title heavily capitalized, badge counters sitting adjacent.
- Table rows transition background on hover (`rgba(255,255,255,0.02)` / `#f8fafc`).
- Fixed layout properties to ensure text truncation (`.truncate`) functions correctly inside flex children.

### 3.5 Status Indicators
- **"Processed" Badge:** Gray/slate colored text `italic` style inside a pill container (`.processed-badge`).
- **Workflow Pills:** High contrast background chips (e.g., `Számlázva` = Green `#10b981`, `Új` = Orange/Amber).

---

## 4. Modals and Overlays

- **Overlay Background (`.modal-overlay`):** Deep black with `0.6` opacity, layered with `backdrop-blur-sm` (4px). Z-index `1000`.
- **Animation Strategy:** `opacity-0 scale-95` transitioning to `opacity-100 scale-100` over `300ms cubic-bezier(0.4, 0, 0.2, 1)`.
- **Container Sizing:**
  - Standard modals (All Updates): `max-w-4xl`.
  - Split-view modals (Entry Details): `max-w-6xl` (`90vw`), rendering complex 2-column layouts internally.
- **Click-Out Behavior:** The darkened backdrop catches `mousedown` events strictly on itself to trigger a safe close without disrupting inner forms.
