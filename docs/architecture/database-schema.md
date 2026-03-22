# Database Schema Architecture

**Component:** `Database Schema`
**Location:** [`coolkonyha.db`](../../coolkonyha.db)

## 1. Purpose
The Coolkonyha database uses a **hybrid relational model** designed for an AI-driven order management system. It balances two competing needs:
1.  **High-Performance Current State:** The `orders` table provides instant access to the latest status of every transaction.
2.  **Complete Audit Traceability:** The `order_status_history` table maintains an immutable log of every workflow transition, crucial for AI context and debugging.

## 2. Architecture/Flow

### Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    customers ||--o{ orders : places
    product_suppliers ||--o{ products : supplies
    products ||--o{ order_items : "definitions copied to"
    orders ||--|{ order_items : contains
    orders ||--|{ order_status_history : "logs changes to"
    orders ||--o{ processed_emails : "linked to"
    business_status_workflow ||--o{ orders : "defines status of"
    business_status_workflow ||--o{ order_status_history : "defines status of"

    customers {
        int cust_id PK
        string cust_name
        string cust_email
    }

    products {
        int prod_id PK
        string prod_name
        decimal unit_price "Current Base Price"
        int prod_supp_id FK
    }

    product_suppliers {
        int prod_supp_id PK
        string prod_supp_co
    }

    orders {
        int order_id PK
        string order_code UNIQUE
        int cust_id FK
        string current_status "Current Workflow Step"
        decimal total_amount
    }

    order_items {
        int order_item_id PK
        int order_id FK
        int prod_id FK
        decimal unit_price "Frozen Historical Price"
        int quantity
    }

    order_status_history {
        int history_id PK
        int order_id FK
        string status
        string performed_by
        datetime update_date
    }

    business_status_workflow {
        int status_id PK
        string status_key
        string display_name
    }

    processed_emails {
        int email_id PK
        string gmail_message_id "UNIQUE dedup key"
        string thread_id
        datetime email_date
        string direction "received | sent"
        string from_address
        string to_address
        string subject
        string ai_summary "AI interpretation of newest block only"
        int linked_order_id FK
        string status "pending|processed|failed|skipped"
        datetime processed_at
    }

    sender_rules {
        int rule_id PK
        string email_address "UNIQUE"
        string action "skip|notify|auto_customer"
        string reason
        string created_by "CK or PISTA"
        string approved_by "Always CK"
        datetime created_at
    }
```

## 3. Input/Output Specifications (Schema Definitions)

### Master Data Tables

#### `customers`
Stores client CRM and contact information.
-   `cust_id` (PK): Unique identifier.
-   `cust_name`: Official name.
-   `cust_contact`: Primary contact person.
-   `cust_email`: Primary email.
-   `cust_note`: Internal notes.

#### `products`
Master list of products.
-   `prod_id` (PK): Unique identifier.
-   `prod_name`: Official name.
-   `unit_price`: **Current** base price (see `order_items` for historical).
-   `prod_supp_id` (FK): Link to `product_suppliers`.

#### `product_suppliers`
Stores supplier details.
-   `prod_supp_id` (PK): Unique identifier.
-   `prod_supp_co`: Company name.

### Transactional Tables

#### `orders`
The "Head" of a transaction.
-   `order_id` (PK): Unique identifier.
-   `order_code` (UNIQUE): Human-readable unique code (e.g., HILT-00001).
-   `cust_id` (FK): Customer reference.
-   `current_status`: The active state from `business_status_workflow`.
-   `update_event`: AI-generated summary of the last action.

#### `order_items`
Line items for orders.
-   `order_item_id` (PK): Unique identifier.
-   `order_id` (FK): Parent order.
-   `prod_id` (FK): Product reference.
-   `unit_price`: **Frozen** price at moment of purchase (Pricing Continuity Rule).
-   `quantity`: Amount purchased.

### Workflow Logic Tables

#### `order_status_history`
Immutable audit log.
-   `history_id` (PK): Log entry ID.
-   `order_id` (FK): Order reference.
-   `status`: Status at that point in time.
-   `performed_by`: Agent/User ID.

#### `business_status_workflow`
Configuration for the workflow state machine.
-   `status_key`: Programmatic key (e.g., `OFFER_SENT`).
-   `is_skippable`: Logic flag for AI automation.

### Email Processing Table

#### `processed_emails`
Ledger of every email processed by the Email Robot. The single source of truth for deduplication.
-   `email_id` (PK): Unique identifier.
-   `gmail_message_id` (UNIQUE): Gmail's immutable message ID — the dedup key.
-   `thread_id`: Groups emails in the same conversation thread.
-   `email_date`: When the email was sent/received.
-   `direction`: `received` or `sent` — determines which Gmail folder was monitored.
-   `ai_summary`: The Manager Agent's interpretation of the **newest message block only** (quoted history is stripped before AI processing).
-   `linked_order_id` (FK, nullable): The order this email relates to. Null if unmatched or spam.
-   `status`: Processing state — `pending`, `processed`, `failed`, or `skipped`.
-   `processed_at`: Timestamp when the agent finished processing.

#### `sender_rules`
Stores CK's learned preferences for non-customer email senders. Rules are proposed by P.I.S.T.A. and approved by CK.
-   `rule_id` (PK): Unique identifier.
-   `email_address` (UNIQUE): The sender email address the rule applies to.
-   `action`: Disposition — `skip` (ignore silently), `notify` (always show to CK), or `auto_customer` (treat as customer lead).
-   `reason`: Human-readable explanation of why the rule was created.
-   `created_by`: Who proposed the rule (`CK` or `PISTA`).
-   `approved_by`: Who approved the rule — always `CK`.
-   `created_at`: When the rule was created.

## 4. Security Considerations

-   **Foreign Key Integrity:** `PRAGMA foreign_keys = ON` is enforced by the [`Database Connection`](./database-connection.md) to prevent orphaned records.
-   **Data Consistency:** The `orders` table and `order_status_history` table MUST be updated in the same transaction (Dual-Write Policy) to ensure the current state always matches the latest history entry.
-   **Price Freezing:** `order_items.unit_price` MUST be populated at insertion time to protect financial records from future price changes in the `products` table.

## Cross References
- **Business Rules:** See [`docs/assistant_team/db_robot_logic_tools.md`](../assistant_team/db_robot_logic_tools.md)
- **Data Access:** See [`server/agent.js`](../../server/agent.js)
- **P.I.S.T.A. (sender_rules consumer):** See [`docs/assistant_team/pista-agent.md`](./pista-agent.md)
- **Email Robot (sender_rules consumer):** See [`docs/assistant_team/email-robot.md`](./email-robot.md)
