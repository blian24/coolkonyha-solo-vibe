# Module: robot-orders.js
**Responsibility:** Manages order lifecycle, items, status history, and workflow enforcement for the orders domain.
**Location:** `server/robots/robot-orders.js`
**Depends on:** `server/db.js`
**Consumed by:** `server/routes.js`, `server/pista.js`

## Exports
| Name | Type | Description |
|------|------|-------------|
| getWorkflowStatuses() | function | Returns all valid order workflow statuses |
| getOrders() | function | Returns all orders ordered by date descending |
| getOrderDetails() | function | Returns order record with items and status history |
| getActiveOrders() | function | Returns non-closed orders joined with customer info |
| getOrdersByCustomer() | function | Returns customer orders with JSON items and history |
| createOrder() | function | Creates order, generates order code, logs initial status |
| addOrderItem() | function | Adds item freezing unit price and recalculates order total |
| updateOrderStatus() | function | Executes dual-write status update with history log |
| getAllOrderItems() | function | Returns all order items joined with product & order code |
| getOrderStatusHistory() | function | Returns full order status history with order codes |

## Key Concepts
- Pricing Continuity: freezes product unit price at insertion time into `order_items`.
- Dual-Write Pattern: atomically writes status to `orders` and logs to `order_status_history`.
- Generates structured order codes with customer prefix and 5-digit ID (e.g. `CUST-00001`).

## What is NOT here
- Maintenance case tracking — see `server/robots/robot-maintenance.js`.
- Base product catalogue prices — see `server/robots/robot-catalog.js`.
- AI analysis of stuck orders — see `server/pista.js`.
