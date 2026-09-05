# Differences: App vs. CK's Real-World Process

General log of places where the app deliberately diverges from how CK actually runs the business today (data integrity, security, or otherwise) — not every difference, just the ones worth explaining to CK. Organized by section as new categories of difference are identified; today there's only one section, from the first Excel sample CK provided.

## Data handling differences based on provided excel sheet example

Source: `docs/.notes/data-samples/Szerviz - Coolkonyha.xlsx` (maintenance case history, 2022–2026).

1. **Every machine must exist in the product catalog before it can be used in a maintenance case.** In the Excel sheets, "Géptípus" (machine type) is free text typed directly into the case row, so the same physical machine model often gets described slightly differently across different rows/years. Requiring a catalog entry keeps machine data structured and reusable — one clean record per machine, not N slightly-different free-text descriptions of the same thing.
