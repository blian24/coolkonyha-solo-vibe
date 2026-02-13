import dbAgent from '../server/agent.js';
import db from '../server/db.js';

const runTest = async () => {
    console.log('=== Starting DB Agent Verification ===');

    try {
        // 1. Create a Dummy Customer (if needed) or use ID 1
        // For this test, we assume ID 1 might not exist, so insert one just in case
        // We'll use raw DB run for this setup part
        await new Promise((resolve) => {
            db.run(
                "INSERT INTO customers (cust_name, cust_email) VALUES ('Test Client', 'test@example.com')",
                () => {
                    resolve();
                }
            );
        });

        // 2. Create Order
        console.log('\n[TEST] Creating Order...');
        const { orderId } = await dbAgent.createOrder(1);
        console.log(` -> Order Created: ID ${orderId}`);

        // 3. Test Status Update (Dual Write)
        console.log('\n[TEST] Updating Status to OFFER_SENT...');
        await dbAgent.updateOrderStatus(
            orderId,
            'OFFER_SENT',
            'TEST_SCRIPT',
            'Sending initial offer'
        );

        const order = await dbAgent.getOrderDetails(orderId);
        console.log(
            ` -> Current Status in Orders Table: ${order.order.current_status} (Expected: OFFER_SENT)`
        );

        const historyEntry = order.history.find((h) => h.status === 'OFFER_SENT');
        if (historyEntry) {
            console.log(
                ` -> History Log Found: [${historyEntry.update_date}] ${historyEntry.status} - ${historyEntry.update_event}`
            );
        } else {
            console.error(' -> [FAIL] History log MISSING!');
        }

        // 4. Test Pricing (requires a product)
        console.log('\n[TEST] Testing Pricing Logic...');
        // Setup dummy product with price 1000
        const prodId = await new Promise((resolve) => {
            db.run(
                "INSERT INTO products (prod_name, unit_price) VALUES ('Test Widget', 1000)",
                () => {
                    resolve(1);
                }
            );
        });

        // Add item
        await dbAgent.addOrderItem(orderId, prodId, 2); // 2 * 1000 = 2000

        // Verify Total
        const updatedOrder = await dbAgent.getOrderDetails(orderId);
        console.log(
            ` -> Order Total Amount: ${updatedOrder.order.total_amount} (Expected: 2000)`
        );

        if (updatedOrder.order.total_amount === 2000) {
            console.log(' -> [PASS] Pricing Logic Correct');
        } else {
            console.error(' -> [FAIL] Pricing Logic Incorrect');
        }
    } catch (err) {
        console.error('Test Failed with Error:', err.message);
    }
};

// Give DB a moment to connect
setTimeout(runTest, 1000);
