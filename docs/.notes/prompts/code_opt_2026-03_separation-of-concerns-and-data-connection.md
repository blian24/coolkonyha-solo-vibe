# Role & Objective
You are an expert Frontend Architect. Your task is to refactor the CoolKonyha UI codebase to enforce the **Separation of Concerns** principle regarding Data and Visualisation. You must apply this refactoring to all three current designs:
- `design-01-oceanic.html`
- `design-02-oceanic-v1.1.html`
- `design-03-oceanic-plus-v1.html`

# Current State
Currently, HTML files contain hardcoded mock data directly within JavaScript arrays (`ORDERS`, `WHATS_NEW`), and the DOM rendering logic relies on injecting raw HTML strings via JS template literals. This tightly couples the data logic with the view/UI logic, making cosmetic and styling changes dangerous, hard to maintain, and bloated.

# Architecture Rules to Implement
1. **Template-Based Vanilla MVC Pattern:** 
   - Define all HTML markup for dynamic lists (e.g., table rows, update logs) inside native `<template>` tags within the `.html` file.
   - The UI developer must be able to change utility classes, HTML tags, and CSS structure directly within the `.html` file *without* ever touching the JavaScript rendering loops.
2. **Data Module (`dataService.js`):**
   - Extract all data fetching and mock-data logic into a standalone service module (e.g., `js/services/dataService.js`).
   - This service must handle fetching the data (currently mocking the future Firebase database integration) and return clean JSON structures. 
   - **Crucial:** This service must know absolutely *nothing* about the DOM, HTML, or styling.
3. **View/Renderer Logic:**
   - The renderer acts as the Controller. It fetches data from the Data Module, selects the relevant `<template>` from the DOM, clones it, populates the text/image fields, and appends it to the container.

# Execution Steps
1. Create external JavaScript file(s) to abstract data operations and mock the database connection.
2. Refactor all three design files (`design-01`, `design-02`, and `design-03`) to use `<template id="...">` tags instead of generating HTML strings in JavaScript.
3. Update the rendering JavaScript to clone these templates and inject data textually.
4. **Documentation Update:** Immediately update or create necessary atomic documentation (e.g., `/docs/architecture/ui-data-flow.md`) detailing this new Template-Based Vanilla MVC pattern. 
5. **Connectivity:** Ensure this new or updated document is linked correctly within the root `SOLUTION_DESIGN.md` following the project's strict Documentation Connectivity Rule.

# Code Quality Constraints
Ensure the JavaScript code is extremely readable, well-commented, and follows the project's "Explicit over Implicit" global rule. Use clean ES6+ features and keep functions atomic.
