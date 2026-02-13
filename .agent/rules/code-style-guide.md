---
trigger: always_on
---

# Coding Standards and Best Practices
**Project:** Task Management System (HTML/Tailwind/Firebase)  
**Standard Version:** 1.2.0 (2026)

## 1. General Principles
* **Language:** All source code, including variable names, function names, and comments, must be written in **English**.
* **Indentation:** Use **2 spaces** for indentation. Do not use hard tabs.
* **Formatting:** Every file must end with a single newline. Lines should be limited to **100 characters** to ensure readability.

## 2. Module and Library Management
* **Hoisting to Top:** All library imports (`import` or `require`) **must** be placed at the very top of the file.
* **Import Order:**
    1. Third-party libraries (e.g., `firebase/app`, `crypto-js`).
    2. Local project modules (e.g., `./utils/encryption`).
    3. Style assets (e.g., `./styles/main.css`).
* **No Dynamic Imports:** Conditional imports inside functions are prohibited unless explicitly required for code-splitting performance.

## 3. JavaScript / TypeScript Standards (Airbnb-based)
* **Variable Declarations:** Use `const` for all references; use `let` only if the variable must be reassigned. Use of `var` is strictly prohibited.
* **Naming Conventions:** * `camelCase` for variables and functions.
    * `PascalCase` for classes and components.
    * `UPPERCASE_SNAKE_CASE` for global constants.
* **Functions:** Prefer **Arrow Functions** for consistency. Functions must follow the **Single Responsibility Principle** (perform one task).
* **Data Handling:** Use object destructuring to extract values from tasks (e.g., `const { uid, summary } = task;`).

## 4. Security and Encryption (Mandatory)
* **At-Rest Encryption:** All sensitive customer data, email content, and workflow descriptions must be encrypted using **AES-256** before being committed to the database (Firebase/SQLite).
* **Volatile Memory Rule:** Raw, unencrypted data must only exist in RAM during runtime.
* **Key Management:** The user’s password serves as the encryption key. Documentation must warn that password loss results in irreversible data loss.
* **Storage Security:** Files in `/data/attachments/` must use **UUID** filenames and have encrypted contents.

## 5. HTML and TailwindCSS
* **Semantic HTML:** Use semantic tags (`<nav>`, `<main>`, `<footer>`) instead of generic `<div>` containers where possible.
* **Tailwind Class Order:** Class lists must be organized by:
    1. Layout (Positioning/Display)
    2. Box Model (Sizing/Margin/Padding)
    3. Typography
    4. Visuals (Colors/Borders/Shadows)
* **Inline Styles:** Inline `style` attributes are prohibited; use Tailwind utility classes or dedicated CSS files.

## 6. Error Handling and Logging
* **Async Operations:** All Firebase or API calls must be wrapped in `try-catch` blocks.
* **Log Privacy:** Logs in `/logs/` must be unencrypted for debugging but **must not** contain personal identifiable information (PII) or business secrets.

## 7. Documentation & Knowledge Management
* **Atomic Documentation:** Each module, API endpoint, or major component must have its own documentation file (Markdown preferred) in a dedicated `/docs` folder.
* **Solution Design Integration:** Every individual documentation file must follow a consistent structure: 
    1. Purpose
    2. Architecture/Flow
    3. Input/Output specifications
    4. Security considerations.
* **The "Master Index" Rule:** A central `SOLUTION_DESIGN.md` (or `README.md`) must be maintained at the root, acting as a table of contents that links all individual documentation files.
* **Traceability:** Any change in the core logic must be immediately reflected in the corresponding documentation file.
* **Standardized Diagrams:** Where visual representation is needed, use Mermaid.js or similar text-based diagramming tools within the Markdown to ensure version-control compatibility.