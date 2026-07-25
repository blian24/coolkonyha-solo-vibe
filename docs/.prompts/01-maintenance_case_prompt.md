# Context
We are expanding our platform's capabilities by introducing a new business domain. Currently, our core entity and workflow center around "Orders" (when a customer purchases a product). We are introducing a second domain called "Maintenance" (servicing and maintaining products). 

Scope boundaries:
* We do not yet know if we will maintain products not sold by us. Do not build or assume any strict relational coupling between sales history and maintenance capability.
* However, maintenance cases must utilize the exact same underlying Product data/table as orders do.

# System Architecture Goal
* **Database Architecture:** Create a completely separate data table for Maintenance cases. This new table must reference products from the existing `Products` table using the same relation/Foreign Key logic as the current `Orders` table does.
* **Two Distinct Types:** The application must clearly distinguish between "Order" and "Maintenance" cases on the UI, even though they sit in different backend tables.
* **Workflows:** For Phase 1, the Maintenance workflow will functionally mirror the existing Order workflow. However, developers must explicitly duplicate and isolate the workflow logic in the code now. Do not reuse the exact same backend service/logic; create a separate, independent track for Maintenance so it can be modified independently in the future without breaking Orders.
* **Data Retention:** We need to store, track, and handle all maintenance case information to the exact same level of detail as we currently do for orders.
* **UI/UX & Navigation:** 
  * Where cases are listed together (e.g., on the Dashboard), every individual row/record must display a specific, distinct icon next to it, making it instantly clear at a glance whether that specific entry is an Order or a Maintenance case.
  * Global or page-level filtering by Case Type must be available wherever mixed type of cases are displayed together.
  * The main Dashboard must feature a unified view, aggregating data from both tables to list current Orders and Maintenance cases together in the same window/list.
  * A new, dedicated "Maintenance" menu item must be added to the left sidebar, navigating to a page that displays Maintenance cases exclusively.

# Input data
As we do not have existing maintenance cases, you need to create realistic dummy data in the newly established Maintenance data table for testing and preview purposes.

# Task 
Create a comprehensive technical analysis and implementation plan detailing the required database schema, backend, and frontend changes. 

Guidelines:
1. **Backward Compatibility:** Ensure zero disruption to the existing Order workflow and data.
2. **Database Cleanliness:** Propose a clean schema migration for the new separate table, adhering to modern data-handling best practices.
3. **Feature Parity:** Assume all current features, screens, and actions available for Orders must be replicated for Maintenance cases unless specified otherwise.
4. **No Assumptions:** Do not invent new features or sub-statuses. If any ambiguity arises regarding existing order features translating to maintenance, flag it and ask for clarification.