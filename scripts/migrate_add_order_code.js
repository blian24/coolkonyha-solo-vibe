import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, '../coolkonyha.db');

// Promisify
const runAsync = (db, sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
    });
});
const allAsync = (db, sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

async function migrate() {
    console.log('Starting migration: Adding order_code to orders...');
    const db = new sqlite3.Database(DB_PATH);

    try {
        // 1. Add column (If it exists, this will throw, which is fine, we catch it)
        console.log('Adding order_code column...');
        try {
            await runAsync(db, `ALTER TABLE orders ADD COLUMN order_code TEXT;`);
            console.log('✅ Column order_code added.');
        } catch (e) {
            if (e.message.includes('duplicate column name')) {
                console.log('⚠️ Column order_code already exists, continuing to population step.');
            } else {
                throw e;
            }
        }

        // 2. Populate existing rows with order_codes
        console.log('Populating existing orders with generated codes...');
        const orders = await allAsync(db, `
            SELECT o.order_id, c.cust_name 
            FROM orders o 
            JOIN customers c ON o.cust_id = c.cust_id 
            WHERE o.order_code IS NULL
        `);

        if (orders.length === 0) {
            console.log('ℹ️ No orders need order_code update.');
        } else {
            console.log(`Found ${orders.length} orders lacking an order_code.`);
            for (const order of orders) {
                // Generate 4-letter prefix from customer name
                const cleanName = order.cust_name.replace(/[^a-zA-Z]/g, '').toUpperCase();
                const prefix = (cleanName + 'XXXX').substring(0, 4);
                
                // 5-digit zero-padded number from order_id
                const idStr = String(order.order_id).padStart(5, '0');
                const orderCode = `${prefix}-${idStr}`;

                await runAsync(db, `UPDATE orders SET order_code = ? WHERE order_id = ?`, [orderCode, order.order_id]);
                console.log(`  -> Updated order_id ${order.order_id} to ${orderCode}`);
            }
            console.log('✅ Population complete.');
            
            // 3. Create Unique Index
            console.log('Creating unique index on order_code...');
            try {
                await runAsync(db, `CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_code ON orders(order_code);`);
                console.log('✅ Unique index created.');
            } catch (e) {
                console.error('❌ Failed to create unique index:', e);
            }
        }
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        db.close();
        console.log('Migration script finished.');
    }
}

migrate();
