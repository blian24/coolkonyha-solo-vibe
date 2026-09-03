# Frontend Scoping: Database Viewer (`index-db.html`) — Owner Summary

**Date:** September 3, 2026  
**Document Type:** Strategic Assessment & Architecture Recommendation  
**Audience:** Product Owner / Business Stakeholders (3-minute plain language read)

---

## 1. What is this file?

`index-db.html` is the internal **Database Viewer** for Coolkonyha. It is a working management dashboard where you can view, search, and update the core data running your kitchen supply operations.

From a user perspective, it currently contains **five main screens**:
1. **Customers:** A searchable company directory displaying contact persons, emails, and phone numbers. Clicking any customer row smoothly expands a detailed drawer showing extra emails, websites, registration dates, notes, and company logos. You can edit any customer's details directly on screen and save changes straight to the database.
2. **Suppliers:** A supplier directory with the exact same click-to-expand details and instant inline editing for partner contact information and notes.
3. **Products:** A catalog showing product types, dimensions, and unit prices in HUF. Expanding a product shows supplier associations, technical specifications, and product images, with live inline price and detail editing.
4. **Orders:** A split-screen order center. The left side lists orders with live search and quick-filter buttons for order status (*New, Offer Sent, Confirmed, Ready, Delivery, Closed, Cancelled*). Clicking an order reveals a full breakdown of ordered items, quantities, and prices, alongside a chronological status history timeline showing who updated the order and when. The right side contains a sticky reference cheat-sheet of all workflow statuses.
5. **Workflow:** A master reference table defining every business status in your kitchen pipeline, explaining what each step means and whether it can be skipped.

---

## 2. Why is splitting it a good idea?

Right now, this entire application—the visual styling, the page layouts, and over 800 lines of computer code—is stuffed into a **single giant 52 KB file** (1,451 lines long). 

Here is why splitting it up is critical for your business:
- **Safety (No accidental breakage):** When everything lives in one big file, tweaking something small (like adding a field to Suppliers) risks accidentally breaking Orders or crashing the search bar. Splitting it isolates each piece so changes to one screen cannot harm another.
- **Faster Improvements:** Finding and updating a feature in a 1,400-line monolith takes hours of careful scanning. When split into clear folders, changes that used to take days can be done in minutes.
- **Bug Prevention:** Right now, saving edits or refreshing lists requires the computer to wipe and redraw whole chunks of the page by stringing text together. Splitting the logic prevents data glitches, lost text inputs, and visual stuttering.

---

## 3. What are the two options?

### The Analogy
Imagine you are furnishing a high-volume professional commercial kitchen:
- **Option A (React Migration — The Modern Modular Kitchen):** You install standard, precision-engineered modular stainless steel prep stations and equipment bays. Every station (drawer, sink, burner) snaps together predictably. If you want to upgrade the burner or repair a drawer, you service that specific module without touching the rest of the kitchen.
- **Option B (HTML Partials — The Custom Hand-Built Cabinetry):** A carpenter cuts individual wooden panels and slides them into pre-existing wall slots using manual latches. It avoids buying specialized tools upfront, but every panel must be manually aligned, latched, and repainted by hand every single time you move something.

### Plain Trade-Offs

| Consideration | Option A: React Migration | Option B: HTML Partials |
|---|---|---|
| **What it means** | Rebuild the screens into modern reusable components using React, the industry-standard frontend engine already installed in your project. | Slice the 1,451-line file into separate smaller HTML and JavaScript files connected by manual web links. |
| **Long-Term Stability** | **Very High.** React automatically manages what is displayed on screen, preventing data conflicts and screen flicker. | **Moderate.** Developers still have to write manual code to fetch, stitch, and update every table element. |
| **Reusability** | **Excellent.** A table, search box, or edit form built once can be dropped anywhere in the Coolkonyha system. | **Low.** Every screen needs its own custom display and editing instructions repeated. |
| **Initial Setup Effort** | Slightly higher initial focus to set up the component structure. | Faster to split initially, but significantly more expensive and fragile to maintain over time. |

---

## 4. What is the recommendation?

### Recommendation: **Option A (React Migration)**

We strongly recommend **Option A**. Your project repository already has modern React installed and waiting in its configuration (`package.json`), and your master system blueprint (`SOLUTION_DESIGN.md`) already lists React as the official target frontend. Slicing the file into old-fashioned HTML partials (Option B) is a temporary patch that leaves you with fragile, manual code that will need to be rewritten later anyway. Migrating `index-db.html` into modern React components gives you rock-solid stability, eliminates visual glitches during edits, and provides a clean, professional foundation that can scale effortlessly as Coolkonyha grows.

---

## 5. What will NOT change?

Your daily user experience will remain completely uninterrupted:
- **Visual Design:** The colors (deep navy blues and coral accents), typography, status badges, and two-column layouts will look identical.
- **Features:** Expandable rows, real-time search, status filter buttons, itemized order tables, and the order history timeline will work exactly as they do today.
- **Data & Back-End:** All data continues to be read from and saved to your existing database via the exact same secure server routes.

---

## 6. What do you need to decide?

> **Owner Decision:**  
> *"Do you approve proceeding with **Option A** (migrating the Database Viewer into clean React components using our existing Vite setup), ensuring all screens, buttons, and editing workflows remain visually and functionally identical?"*
