# Role & Objective
You are an expert Frontend Architect and CSS specialist. Your task is to refactor the CSS architecture of the CoolKonyha UI to eliminate styling redundancy and optimize the use of Tailwind CSS versus Custom CSS. You must apply this refactoring to all three current designs:
- `design-01-oceanic.html`
- `design-02-oceanic-v1.1.html`
- `design-03-oceanic-plus-v1.html`

# The Problem
Currently, there is severe CSS bloat. Many custom classes (e.g., `.btn-act`, `.carved-btn`, `.date-nav-btn`) redundantly define generic layout rules like `display: flex; align-items: center; justify-content: center; transition: all...` over and over again. This violates the DRY (Don't Repeat Yourself) principle.

# The Philosophy (The "Hybrid" Approach)
We need to implement a strict "Hybrid" strategy replacing the redundant CSS:

1. **Tailwind for Layout & Scaffolding (Utility-First):** 
   - Move all structural, spacing, typography, and generic utility rules (flex, padding, margins, gaps, centering, simple hover states) out of the `<style>` block.
   - Apply these directly onto the HTML elements using Tailwind utility classes (e.g., `flex items-center justify-center p-4 text-sm`).
   - *Goal:* The HTML should describe the layout, eliminating the need to name wrapper `div`s in CSS.

2. **Custom CSS for Global Identity & Complexity:**
   - Reserve the CSS `<style>` block (or external CSS files) *strictly* for global brand identity tokens (CSS variables mapped to Tailwind themes) and complex, unique visual effects that cannot be easily created with utilities.
   - Example valid custom CSS: `.ice-card` (for complex glassmorphism, noise overlays, multi-layered shadows) or `.ai-pulse` (for complex keyframe animations).

3. **Smart Component Classes (If needed for DRY):**
   - If a specific combination of styles is used across dozens of different files (like a primary button identity), define it cleanly, but rely on generic composition rather than repeating structural CSS.

# Execution Steps
1. Analyze the custom `<style>` blocks across all three design files (`design-01`, `design-02`, and `design-03`).
2. Strip out redundant layout CSS and replace it with semantic Tailwind classes on the respective HTML elements (or templates).
3. Consolidate the remaining CSS into minimal, semantic classes representing the "Oceanic Plus" brand identity.
4. **Documentation Update:** Create or update a CSS/Styling guideline document in the `/docs/` folder explaining this strict hybrid approach (Tailwind for scaffolding, Custom CSS for brand complex identity). 
5. **Connectivity:** Ensure this styling document is linked correctly from the root `SOLUTION_DESIGN.md` Master Index.

# Code Quality Constraints
Produce extremely clean, minimal CSS. The resulting HTML should be highly readable and immediately self-documenting regarding its layout structure thanks to standard Tailwind utilities.
