-- 1. Master Data
CREATE TABLE customers (
    cust_id INTEGER PRIMARY KEY AUTOINCREMENT,
    cust_name TEXT NOT NULL,
    cust_contact TEXT,
    cust_email TEXT NOT NULL,
    cust_email2 TEXT,
    cust_phone TEXT,
    cust_web TEXT,
    cust_note TEXT,
    cust_reg_date DATE DEFAULT CURRENT_DATE
);

CREATE TABLE product_suppliers (
    prod_supp_id INTEGER PRIMARY KEY AUTOINCREMENT,
    prod_supp_co TEXT NOT NULL,
    prod_supp_name TEXT,
    prod_supp_email TEXT,
    prod_supp_phone TEXT,
    prod_supp_web TEXT,
    prod_supp_note TEXT,
    prod_supp_reg_date DATE DEFAULT CURRENT_DATE
);

CREATE TABLE products (
    prod_id INTEGER PRIMARY KEY AUTOINCREMENT,
    prod_name TEXT NOT NULL,
    prod_type TEXT,
    prod_size TEXT,
    prod_note TEXT,
    prod_reg_date DATE DEFAULT CURRENT_DATE,
    prod_supp_id INTEGER,
    unit_price NUMERIC(10,2),
    FOREIGN KEY (prod_supp_id) REFERENCES product_suppliers(prod_supp_id)
);

-- 2. Transactions
CREATE TABLE orders (
    order_id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_code TEXT UNIQUE,
    cust_id INTEGER NOT NULL,
    order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_amount NUMERIC(12,2),
    current_status TEXT,
    current_status_update DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_event TEXT,
    currency TEXT DEFAULT 'HUF',
    FOREIGN KEY (cust_id) REFERENCES customers(cust_id)
);

CREATE TABLE order_items (
    order_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    prod_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(10,2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(order_id),
    FOREIGN KEY (prod_id) REFERENCES products(prod_id)
);

-- 3. Workflow & History
CREATE TABLE order_status_history (
    history_id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    update_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_event TEXT,
    performed_by TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

CREATE TABLE business_status_workflow (
    status_id INTEGER PRIMARY KEY AUTOINCREMENT,
    status_key TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    is_skippable BOOLEAN DEFAULT FALSE
);

-- Initial Workflow Data
INSERT INTO business_status_workflow (status_key, display_name, description, is_skippable) VALUES
('NEW', 'New', 'Inquiry received, no human action yet.', 0),
('OFFER_SENT', 'Offer Sent', 'Quote sent, waiting for customer.', 0),
('ORDER_CONFIRMED', 'Order Confirmed', 'Binding order accepted.', 0),
('PURCHASE', 'Purchase', 'Ordering from supplier.', 1),
('READY_FOR_DELIVERY', 'Ready for Delivery', 'Packed and waiting.', 0),
('DELIVERY', 'Delivery', 'Handed over to courier.', 0),
('DELIVERED', 'Delivered', 'Left warehouse / In transit.', 0),
('INVOICED', 'Invoiced', 'Invoice sent, awaiting payment.', 0),
('CLOSED', 'Closed', 'Transaction successful.', 0),
('CANCELLED', 'Cancelled', 'Deal failed.', 0);

-- 4. Email Processing Ledger
-- Tracks every email seen by the Email Robot.
-- gmail_message_id is the deduplication key — never processed twice.
-- ai_summary contains only the AI interpretation of the NEWEST message block
-- (quoted history is stripped before AI processing).
CREATE TABLE processed_emails (
    email_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    gmail_message_id  TEXT UNIQUE NOT NULL,
    thread_id         TEXT,
    email_date        DATETIME,
    direction         TEXT NOT NULL CHECK(direction IN ('received', 'sent')),
    from_address      TEXT,
    to_address        TEXT,
    subject           TEXT,
    ai_summary        TEXT,
    linked_order_id   INTEGER,
    status            TEXT NOT NULL DEFAULT 'pending'
                          CHECK(status IN ('pending', 'processed', 'failed', 'skipped')),
    processed_at      DATETIME,
    FOREIGN KEY (linked_order_id) REFERENCES orders(order_id)
);