# CoolKonyha - Industrial Ice Systems
## Software Product Design Specification
**Version:** 1.0.1
**Date:** 2026-03-23

---

## 1. Project Overview
A business management tool for industrial kitchen appliance import/export, specializing in industrial ice machines. The dashboard provides a live overview of orders, statuses, and AI-driven insights via the **P.I.S.T.A. Assistant**.

## 2. Visual Identity & Branding
* **Theme:** Industrial Cooling / High-End SaaS.
* **Keywords:** Minimalist, Geometric, Sharp, Frozen, Metallic.
* **Logo Style:** Geometric "K" merged with ice crystals/metallic cooling fins.

## 3. Design System (Tokens)

### A. Color Palette
| Token | Dark Mode (HEX) | Light Mode (HEX) | Usage |
| :--- | :--- | :--- | :--- |
| **Primary** | `#0F172A` | `#F8FAFC` | Main Background |
| **Secondary** | `#1E293B` | `#E2E8F0` | Sidebar / Card Background |
| **Accent (Frost Cyan)** | `#22D3EE` | `#0891B2` | CTA, AI Glow, Active States |
| **Ice White** | `#F1F5F9` | `#FFFFFF` | Primary Text |
| **Industrial Silver** | `#94A3B8` | `#64748B` | Secondary Text / Borders |
| **Success** | `#4ADE80` | `#16A34A` | Completed Stated |
| **Warning** | `#FBBF24` | `#D97706` | Delayed Orders |

### B. Typography
* **Headings:** Montserrat (Semi-Bold/700) - For a heavy, industrial feel.
* **Body:** Inter (Regular/400) - Optimized for data density.
* **Tech Data:** JetBrains Mono - For Order IDs and technical specifications.

## 4. Layout & Surfaces

### A. Dimensions
* **Sidebar Width:** 280px (Standard) / 80px (Collapsed).
* **Details Panel (Drawer):** 420px (Slide-over from right).
* **Global Padding:** 32px.
* **Border Radius:** 12px (Cards/Containers), 8px (Interactive elements).

### B. Glassmorphism CSS (Ice-Card)
```css
/* Apply to .ice-card */
.ice-card {
  background: rgba(30, 41, 59, 0.7); /* Dark Mode value */
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
  position: relative;
  overflow: hidden;
}

/* Subtle texture overlay */
.ice-card::before {
  content: "";
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background-image: url('noise.png'); /* 2% opacity grain */
  opacity: 0.03;
  pointer-events: none;
}
```

## 5. Component Deep-Dive

### 1. KPI Header ("The Chiller")
* Two cards on the right of the "Mi újság?" section (Active Orders, Ready).
* **Background:** Linear Gradient (Secondary to Accent at 5% opacity).
* **Feature:** Mini sparkline graph in Frost Cyan.

### 2. Order Pipeline (Visual Stepper)
* **Location:** Inside Table Rows (Status column).
* **Structure:** 4-stage linear progress bar (Factory -> Logistics -> Customs -> Delivered).
* **Visuals:** 4px height bar. Completed stages = Solid Frost Cyan with a `0 0 8px #22D3EE` glow. Active stage = Pulsing dot.

### 3. P.I.S.T.A. AI Integration
* **Contextual Glow:** If an order has an AI insight, the row gets a `left-border: 4px solid #22D3EE`.
* **Pulse Animation:**
```css
@keyframes ai-pulse {
  0% { box-shadow: 0 0 0 0 rgba(34, 211, 238, 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(34, 211, 238, 0); }
  100% { box-shadow: 0 0 0 0 rgba(34, 211, 238, 0); }
}
```
* **Insight Tooltip:** Glassmorphic popup appearing near the AI Icon with specific recommendations.

## 6. Interactions
* **Row Hover:** `transform: translateY(-2px)` + increased border opacity.
* **Theme Switch:** "Frost Transition" - a white/cyan flash overlay (0.3s) that fades out during the toggle.
* **Sidebar Navigation:** Horizontal cyan glow sliding in from the left on hover.

---
**Author:** Gemini AI Collaboration (Professional Software Product Designer)
CoolKonyha_Design_System_v1_0_1.md
A(z) CoolKonyha_Design_System_v1_0_1.md megjelenítése.