import db from '../server/db.js';

// Promisify database operations
const runAsync = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
    });
});

const seedDatabase = async () => {
    console.log('🌱 Starting database seeding...\n');

    try {
        // 1. Seed Product Suppliers
        console.log('📦 Seeding product suppliers...');
        const suppliers = [
            {
                name: 'Budapest Kitchen Supplies Kft.',
                contact: 'János Kovács',
                email: 'janos.kovacs@bkskft.hu',
                phone: '+36 1 234 5678',
                web: 'www.budapestkitchen.hu'
            },
            {
                name: 'European Cookware GmbH',
                contact: 'Hans Mueller',
                email: 'h.mueller@eurocookware.de',
                phone: '+49 89 123456',
                web: 'www.eurocookware.de'
            },
            {
                name: 'Italian Kitchen Import',
                contact: 'Marco Rossi',
                email: 'marco@italiankitchen.it',
                phone: '+39 02 987654',
                web: 'www.italiankitchen.it'
            }
        ];

        for (const supplier of suppliers) {
            await runAsync(`
        INSERT INTO product_suppliers 
        (prod_supp_co, prod_supp_name, prod_supp_email, prod_supp_phone, prod_supp_web)
        VALUES (?, ?, ?, ?, ?)
      `, [supplier.name, supplier.contact, supplier.email, supplier.phone, supplier.web]);
        }

        // 2. Seed Products
        console.log('🍳 Seeding products...');
        const products = [
            { name: 'Professional Chef Knife Set', type: 'Cutlery', size: '5-piece', suppId: 1, price: 45000 },
            { name: 'Non-Stick Frying Pan', type: 'Cookware', size: '28cm', suppId: 2, price: 12500 },
            { name: 'Stainless Steel Pot Set', type: 'Cookware', size: '6-piece', suppId: 2, price: 38000 },
            { name: 'Italian Espresso Machine', type: 'Appliance', size: 'Compact', suppId: 3, price: 89000 },
            { name: 'Bamboo Cutting Board', type: 'Accessories', size: '40x30cm', suppId: 1, price: 6500 },
            { name: 'Digital Kitchen Scale', type: 'Appliance', size: '5kg capacity', suppId: 1, price: 8900 },
            { name: 'Silicone Baking Mat Set', type: 'Bakeware', size: '2-piece', suppId: 2, price: 4200 },
            { name: 'Cast Iron Skillet', type: 'Cookware', size: '30cm', suppId: 2, price: 18500 },
            { name: 'Ceramic Mixing Bowl Set', type: 'Accessories', size: '4-piece', suppId: 3, price: 15000 },
            { name: 'Professional Blender', type: 'Appliance', size: '1200W', suppId: 1, price: 52000 }
        ];

        for (const product of products) {
            await runAsync(`
        INSERT INTO products 
        (prod_name, prod_type, prod_size, prod_supp_id, unit_price)
        VALUES (?, ?, ?, ?, ?)
      `, [product.name, product.type, product.size, product.suppId, product.price]);
        }

        // 3. Seed Customers
        console.log('👥 Seeding customers...');
        const customers = [
            {
                name: 'Green Leaf Restaurant',
                contact: 'Anna Szabó',
                email: 'anna@greenleaf.hu',
                email2: 'info@greenleaf.hu',
                phone: '+36 30 123 4567',
                web: 'www.greenleaf.hu'
            },
            {
                name: 'Budapest Bistro',
                contact: 'Péter Nagy',
                email: 'peter.nagy@budapestbistro.hu',
                email2: null,
                phone: '+36 20 987 6543',
                web: 'www.budapestbistro.hu'
            },
            {
                name: 'Café Vienna',
                contact: 'Katalin Kiss',
                email: 'katalin@cafevienna.hu',
                email2: 'orders@cafevienna.hu',
                phone: '+36 70 555 1234',
                web: null
            },
            {
                name: 'Hotel Royal Kitchen',
                contact: 'Gábor Tóth',
                email: 'procurement@hotelroyal.hu',
                email2: null,
                phone: '+36 1 456 7890',
                web: 'www.hotelroyal.hu'
            },
            {
                name: 'Family Kitchen Catering',
                contact: 'Éva Molnár',
                email: 'eva.molnar@familykitchen.hu',
                email2: null,
                phone: '+36 30 222 3333',
                web: 'www.familykitchen.hu'
            }
        ];

        for (const customer of customers) {
            await runAsync(`
        INSERT INTO customers 
        (cust_name, cust_contact, cust_email, cust_email2, cust_phone, cust_web)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [customer.name, customer.contact, customer.email, customer.email2, customer.phone, customer.web]);
        }

        // 4. Seed Orders with realistic workflow progression
        console.log('📋 Seeding orders...');

        // Order 1: Green Leaf Restaurant - COMPLETED
        const order1 = await runAsync(`
      INSERT INTO orders (cust_id, current_status, update_event, currency)
      VALUES (1, 'CLOSED', 'Payment received, order completed', 'HUF')
    `);
        await runAsync(`
      INSERT INTO order_items (order_id, prod_id, quantity, unit_price)
      VALUES (?, ?, ?, ?)
    `, [order1.lastID, 1, 2, 45000]);
        await runAsync(`
      INSERT INTO order_items (order_id, prod_id, quantity, unit_price)
      VALUES (?, ?, ?, ?)
    `, [order1.lastID, 2, 3, 12500]);
        await runAsync(`
      UPDATE orders SET total_amount = (
        SELECT SUM(quantity * unit_price) FROM order_items WHERE order_id = ?
      ) WHERE order_id = ?
    `, [order1.lastID, order1.lastID]);

        // Order history
        const order1Statuses = [
            { status: 'NEW', event: 'Order Initialized', user: 'SYSTEM' },
            { status: 'OFFER_SENT', event: 'Quote sent via email', user: 'anna.sales' },
            { status: 'ORDER_CONFIRMED', event: 'Customer confirmed order', user: 'anna.sales' },
            { status: 'PURCHASE', event: 'Ordered from suppliers', user: 'procurement.team' },
            { status: 'READY_FOR_DELIVERY', event: 'Items packed and ready', user: 'warehouse.team' },
            { status: 'DELIVERY', event: 'Handed to courier GLS', user: 'warehouse.team' },
            { status: 'DELIVERED', event: 'Delivered successfully', user: 'SYSTEM' },
            { status: 'INVOICED', event: 'Invoice #2024-001 sent', user: 'billing.team' },
            { status: 'CLOSED', event: 'Payment received, order completed', user: 'billing.team' }
        ];
        for (const s of order1Statuses) {
            await runAsync(`
        INSERT INTO order_status_history (order_id, status, update_event, performed_by)
        VALUES (?, ?, ?, ?)
      `, [order1.lastID, s.status, s.event, s.user]);
        }

        // Order 2: Budapest Bistro - IN DELIVERY
        const order2 = await runAsync(`
      INSERT INTO orders (cust_id, current_status, update_event, currency)
      VALUES (2, 'DELIVERY', 'Handed to courier DHL', 'HUF')
    `);
        await runAsync(`
      INSERT INTO order_items (order_id, prod_id, quantity, unit_price)
      VALUES (?, ?, ?, ?)
    `, [order2.lastID, 4, 1, 89000]);
        await runAsync(`
      INSERT INTO order_items (order_id, prod_id, quantity, unit_price)
      VALUES (?, ?, ?, ?)
    `, [order2.lastID, 9, 2, 15000]);
        await runAsync(`
      UPDATE orders SET total_amount = (
        SELECT SUM(quantity * unit_price) FROM order_items WHERE order_id = ?
      ) WHERE order_id = ?
    `, [order2.lastID, order2.lastID]);

        const order2Statuses = [
            { status: 'NEW', event: 'Order Initialized', user: 'SYSTEM' },
            { status: 'OFFER_SENT', event: 'Quote sent to customer', user: 'peter.sales' },
            { status: 'ORDER_CONFIRMED', event: 'Order confirmed by phone', user: 'peter.sales' },
            { status: 'PURCHASE', event: 'Supplier order placed', user: 'procurement.team' },
            { status: 'READY_FOR_DELIVERY', event: 'Package prepared', user: 'warehouse.team' },
            { status: 'DELIVERY', event: 'Handed to courier DHL', user: 'warehouse.team' }
        ];
        for (const s of order2Statuses) {
            await runAsync(`
        INSERT INTO order_status_history (order_id, status, update_event, performed_by)
        VALUES (?, ?, ?, ?)
      `, [order2.lastID, s.status, s.event, s.user]);
        }

        // Order 3: Café Vienna - PENDING OFFER
        const order3 = await runAsync(`
      INSERT INTO orders (cust_id, current_status, update_event, currency)
      VALUES (3, 'OFFER_SENT', 'Waiting for customer approval', 'HUF')
    `);
        await runAsync(`
      INSERT INTO order_items (order_id, prod_id, quantity, unit_price)
      VALUES (?, ?, ?, ?)
    `, [order3.lastID, 5, 5, 6500]);
        await runAsync(`
      INSERT INTO order_items (order_id, prod_id, quantity, unit_price)
      VALUES (?, ?, ?, ?)
    `, [order3.lastID, 6, 3, 8900]);
        await runAsync(`
      INSERT INTO order_items (order_id, prod_id, quantity, unit_price)
      VALUES (?, ?, ?, ?)
    `, [order3.lastID, 7, 4, 4200]);
        await runAsync(`
      UPDATE orders SET total_amount = (
        SELECT SUM(quantity * unit_price) FROM order_items WHERE order_id = ?
      ) WHERE order_id = ?
    `, [order3.lastID, order3.lastID]);

        const order3Statuses = [
            { status: 'NEW', event: 'Order Initialized', user: 'SYSTEM' },
            { status: 'OFFER_SENT', event: 'Waiting for customer approval', user: 'katalin.sales' }
        ];
        for (const s of order3Statuses) {
            await runAsync(`
        INSERT INTO order_status_history (order_id, status, update_event, performed_by)
        VALUES (?, ?, ?, ?)
      `, [order3.lastID, s.status, s.event, s.user]);
        }

        // Order 4: Hotel Royal - READY FOR DELIVERY
        const order4 = await runAsync(`
      INSERT INTO orders (cust_id, current_status, update_event, currency)
      VALUES (4, 'READY_FOR_DELIVERY', 'Packed and awaiting courier pickup', 'HUF')
    `);
        await runAsync(`
      INSERT INTO order_items (order_id, prod_id, quantity, unit_price)
      VALUES (?, ?, ?, ?)
    `, [order4.lastID, 3, 3, 38000]);
        await runAsync(`
      INSERT INTO order_items (order_id, prod_id, quantity, unit_price)
      VALUES (?, ?, ?, ?)
    `, [order4.lastID, 8, 4, 18500]);
        await runAsync(`
      INSERT INTO order_items (order_id, prod_id, quantity, unit_price)
      VALUES (?, ?, ?, ?)
    `, [order4.lastID, 10, 2, 52000]);
        await runAsync(`
      UPDATE orders SET total_amount = (
        SELECT SUM(quantity * unit_price) FROM order_items WHERE order_id = ?
      ) WHERE order_id = ?
    `, [order4.lastID, order4.lastID]);

        const order4Statuses = [
            { status: 'NEW', event: 'Order Initialized', user: 'SYSTEM' },
            { status: 'OFFER_SENT', event: 'Quote sent to procurement', user: 'gabor.sales' },
            { status: 'ORDER_CONFIRMED', event: 'Purchase order received', user: 'gabor.sales' },
            { status: 'PURCHASE', event: 'All items ordered', user: 'procurement.team' },
            { status: 'READY_FOR_DELIVERY', event: 'Packed and awaiting courier pickup', user: 'warehouse.team' }
        ];
        for (const s of order4Statuses) {
            await runAsync(`
        INSERT INTO order_status_history (order_id, status, update_event, performed_by)
        VALUES (?, ?, ?, ?)
      `, [order4.lastID, s.status, s.event, s.user]);
        }

        // Order 5: Family Kitchen - CANCELLED
        const order5 = await runAsync(`
      INSERT INTO orders (cust_id, current_status, update_event, currency)
      VALUES (5, 'CANCELLED', 'Customer cancelled due to budget constraints', 'HUF')
    `);
        await runAsync(`
      INSERT INTO order_items (order_id, prod_id, quantity, unit_price)
      VALUES (?, ?, ?, ?)
    `, [order5.lastID, 1, 1, 45000]);
        await runAsync(`
      UPDATE orders SET total_amount = (
        SELECT SUM(quantity * unit_price) FROM order_items WHERE order_id = ?
      ) WHERE order_id = ?
    `, [order5.lastID, order5.lastID]);

        const order5Statuses = [
            { status: 'NEW', event: 'Order Initialized', user: 'SYSTEM' },
            { status: 'OFFER_SENT', event: 'Quote sent', user: 'eva.sales' },
            { status: 'CANCELLED', event: 'Customer cancelled due to budget constraints', user: 'eva.sales' }
        ];
        for (const s of order5Statuses) {
            await runAsync(`
        INSERT INTO order_status_history (order_id, status, update_event, performed_by)
        VALUES (?, ?, ?, ?)
      `, [order5.lastID, s.status, s.event, s.user]);
        }

        console.log('\n✅ Database seeding completed successfully!');
        console.log('\n📊 Summary:');
        console.log(`   - ${suppliers.length} suppliers added`);
        console.log(`   - ${products.length} products added`);
        console.log(`   - ${customers.length} customers added`);
        console.log(`   - 5 orders created with complete workflow history`);

        process.exit(0);
    } catch (err) {
        console.error('\n❌ Seeding failed:', err.message);
        process.exit(1);
    }
};

// Give DB a moment to connect
setTimeout(seedDatabase, 500);
