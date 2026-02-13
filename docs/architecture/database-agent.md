# Database Agent Architecture

**Component:** `DBAgent`
**Location:** [`server/agent.js`](file:///d:/dev/coolkonyha-solo-vibe/server/agent.js)

## 1. Purpose
The **Database Agent** acts as the centralized data access layer (DAL) for the Coolkonyha application. It abstracts all raw SQL operations and enforces critical business rules before data reaches the persistence layer.

Key responsibilities:
- **Centralized Data Access:** All database interactions flow through this class.
- **Business Rule Enforcement:** Implements rules like "Pricing Continuity" and "Dual-Write Status".
- **Promisification:** Wraps callback-based `sqlite3` driver methods into Promise-based methods for `async/await` usage.

## 2. Architecture/Flow

### Class Structure
```mermaid
classDiagram
    class DBAgent {
        +all(sql, params)
        +get(sql, params)
        +run(sql, params)
        +updateOrderStatus(orderId, newStatus, performedBy, description)
        +addOrderItem(orderId, prodId, quantity)
        +createOrder(custId, currency)
        +getOrderDetails(orderId)
        +updateCustomer(custId, data)
        +updateSupplier(suppId, data)
        +updateProduct(prodId, data)
    }
    class Database {
        +sqlite3.Database db
    }
    DBAgent --> Database : uses
```

### Dual-Write Pattern (Order Status)
This pattern ensures auditability by determining that every status change is recorded in both the current state (`orders` table) and the history log (`order_status_history`).

```mermaid
sequenceDiagram
    participant Route as API Route
    participant Agent as DBAgent
    participant DB as SQLite DB

    Route->>Agent: updateOrderStatus(123, 'PROCESSING', ...)
    
    rect rgb(240, 248, 255)
        note right of Agent: Transaction Scope
        Agent->>DB: BEGIN TRANSACTION
        
        Agent->>DB: UPDATE orders SET current_status = 'PROCESSING'...
        
        Agent->>DB: INSERT INTO order_status_history (order_id, status, ...)
        
        alt Success
            Agent->>DB: COMMIT
            Agent-->>Route: { success: true }
        else Error
            Agent->>DB: ROLLBACK
            Agent-->>Route: Throw Error
        end
    end
```

### Pricing Continuity Pattern
Ensures that the price of an item is frozen at the moment of ordering, so future product price changes do not affect historical orders.

```mermaid
sequenceDiagram
    participant Route as API Route
    participant Agent as DBAgent
    participant DB as SQLite DB

    Route->>Agent: addOrderItem(orderId, prodId, qty)
    
    Agent->>DB: SELECT unit_price FROM products WHERE id = prodId
    DB-->>Agent: Returns current price (e.g., 5000)
    
    Agent->>DB: INSERT INTO order_items (..., unit_price=5000)
    note right of Agent: Inserts COPIED price, not reference
    
    Agent-->>Route: { id: newItemId }
```

## 3. Input/Output Specifications

| Method | Parameters | Returns | Throws |
|--------|------------|---------|--------|
| `updateOrderStatus` | `orderId` (int), `newStatus` (str), `performedBy` (str), `eventDescription` (str) | `{ success: boolean, newStatus: string }` | Invalid status, Transaction failure |
| `addOrderItem` | `orderId` (int), `prodId` (int), `quantity` (int) | `{ id: number }` (new item ID) | Product not found |
| `createOrder` | `custId` (int), `currency` (str, default 'HUF') | `{ orderId: number }` | Database error |
| `getOrderDetails` | `orderId` (int) | `{ order: Obj, items: Arr, history: Arr }` | Order not found |
| `updateCustomer` | `custId` (int), `data` (Obj) | `{ success: boolean }` | No fields to update |
| `updateSupplier` | `suppId` (int), `data` (Obj) | `{ success: boolean }` | No fields to update |
| `updateProduct` | `prodId` (int), `data` (Obj) | `{ success: boolean }` | No fields to update |

## 4. Security Considerations

- **SQL Injection Prevention:** All methods use parameterized queries (`?` placeholders) inherited from the base `sqlite3` driver.
- **Transaction Integrity:** Critical updates (like status changes) use explicit `BEGIN TRANSACTION` / `COMMIT` / `ROLLBACK` to ensure data consistency (ACID).
- **Foreign Key Enforcement:** The underlying database connection enables foreign keys via `PRAGMA foreign_keys = ON`, ensuring that invalid references (e.g., creating an order for a non-existent customer) are rejected by the database.
