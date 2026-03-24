import dbRobot from '../server/agent.js';

async function populate() {
    console.log('--- Starting Database Population ---');

    // 1. Create Suppliers
    const s1 = await dbRobot.createSupplier({
        prod_supp_co: 'Gastro Line Kft.',
        prod_supp_name: 'Kovács János',
        prod_supp_email: 'office@gastroline.hu',
        notes: 'Main supplier for high-end kitchenware.'
    });
    const s2 = await dbRobot.createSupplier({
        prod_supp_co: 'Premium Ingredients Ltd.',
        prod_supp_name: 'John Miller',
        prod_supp_email: 'sales@premiumingredients.com',
        notes: 'Specializes in organic spices and specialized oils.'
    });
    const s3 = await dbRobot.createSupplier({
        prod_supp_co: 'Chef Assist Zrt.',
        prod_supp_name: 'Nagy Piroska',
        prod_supp_email: 'p.nagy@chefassist.hu',
        notes: 'Logistics and heavy machinery partner.'
    });

    console.log(`Created 3 suppliers (IDs: ${s1.id}, ${s2.id}, ${s3.id})`);

    // 2. Create Products
    const products = [
        { name: 'Chef Knife 20cm', supp: s1.id, price: 15400, type: 'EQUIPMENT' },
        { name: 'Saffron (High Grade) 10g', supp: s2.id, price: 8900, type: 'INGREDIENT' },
        { name: 'Industrial Mixer Pro', supp: s3.id, price: 245000, type: 'MACHINERY' },
        { name: 'Copper Pan Set', supp: s1.id, price: 42000, type: 'EQUIPMENT' },
        { name: 'Truffle Oil 250ml', supp: s2.id, price: 12500, type: 'INGREDIENT' },
        { name: 'Sous-vide Stick XL', supp: s3.id, price: 68000, type: 'MACHINERY' },
        { name: 'Steel Meat Grinder', supp: s1.id, price: 31000, type: 'EQUIPMENT' },
        { name: 'Organic Vanilla Pods (5pcs)', supp: s2.id, price: 5400, type: 'INGREDIENT' },
        { name: 'Steam Oven Compact', supp: s3.id, price: 412000, type: 'MACHINERY' },
        { name: 'Bread Proofer Box', supp: s1.id, price: 22000, type: 'EQUIPMENT' }
    ];

    const prodIds = [];
    for (const p of products) {
        const result = await dbRobot.createProduct({
            prod_name: p.name,
            prod_supp_id: p.supp,
            unit_price: p.price,
            prod_type: p.type
        });
        prodIds.push(result.id);
    }
    console.log(`Created 10 products.`);

    // 3. Create Customers with Logos
    const customers = [
        { name: 'Ace Boutique Hotel', contact: 'Alice Ace', email: 'alice@acehotel.com', logo: '/logos/ace_hotel.svg' },
        { name: 'AC Urban Resorts', contact: 'Alex City', email: 'contact@achotels.com', logo: '/logos/ac_hotels.svg' },
        { name: 'Adagio City Stay', contact: 'Adrian Adagio', email: 'booking@adagio.hu', logo: '/logos/adagio.svg' },
        { name: 'Big Boy Diner', contact: 'Bobby Boy', email: 'bobby@bigboy.com', logo: '/logos/big_boy.svg' },
        { name: 'Big Smoke Burger Bar', contact: 'Sam Smoke', email: 'sam@bigsmoke.com', logo: '/logos/big_smoke_burger.svg' },
        { name: 'Bread Street Kitchen', contact: 'Ben Bread', email: 'ben@breadstreet.hu', logo: '/logos/bread_street_kitchen.svg' }
    ];

    const custIds = [];
    for (const c of customers) {
        const result = await dbRobot.createCustomer({
            cust_name: c.name,
            cust_contact: c.contact,
            cust_email: c.email,
            logo_path: c.logo
        });
        custIds.push(result.id);
    }
    console.log(`Created 6 customers with logos.`);

    // 4. Create Orders with Workflows
    // Order 1: NEW
    const o1 = await dbRobot.createOrder(custIds[0]);
    await dbRobot.addOrderItem(o1.orderId, prodIds[0], 2);
    await dbRobot.addOrderItem(o1.orderId, prodIds[1], 1);

    // Order 2: OFFER_SENT
    const o2 = await dbRobot.createOrder(custIds[1]);
    await dbRobot.addOrderItem(o2.orderId, prodIds[2], 1);
    await dbRobot.updateOrderStatus(o2.orderId, 'OFFER_SENT', 'SYSTEM', 'Quote generated and sent to customer.');

    // Order 3: ORDER_CONFIRMED
    const o3 = await dbRobot.createOrder(custIds[2]);
    await dbRobot.addOrderItem(o3.orderId, prodIds[3], 3);
    await dbRobot.updateOrderStatus(o3.orderId, 'OFFER_SENT', 'SYSTEM', 'Initial quote sent.');
    await dbRobot.updateOrderStatus(o3.orderId, 'ORDER_CONFIRMED', 'SYSTEM', 'Customer accepted the offer.');

    // Order 4: PURCHASE
    const o4 = await dbRobot.createOrder(custIds[3]);
    await dbRobot.addOrderItem(o4.orderId, prodIds[4], 5);
    await dbRobot.updateOrderStatus(o4.orderId, 'OFFER_SENT', 'SYSTEM', 'Quote sent.');
    await dbRobot.updateOrderStatus(o4.orderId, 'ORDER_CONFIRMED', 'SYSTEM', 'Order accepted.');
    await dbRobot.updateOrderStatus(o4.orderId, 'PURCHASE', 'PISTA', 'Automatic supplier order triggered for missing stock.');

    // Order 5: DELIVERY
    const o5 = await dbRobot.createOrder(custIds[4]);
    await dbRobot.addOrderItem(o5.orderId, prodIds[5], 2);
    await dbRobot.updateOrderStatus(o5.orderId, 'OFFER_SENT', 'SYSTEM', 'Quote sent.');
    await dbRobot.updateOrderStatus(o5.orderId, 'ORDER_CONFIRMED', 'SYSTEM', 'Order accepted.');
    await dbRobot.updateOrderStatus(o5.orderId, 'READY_FOR_DELIVERY', 'SYSTEM', 'Items packed.');
    await dbRobot.updateOrderStatus(o5.orderId, 'DELIVERY', 'SYSTEM', 'Handed over to courier.');

    // Order 6: CLOSED
    const o6 = await dbRobot.createOrder(custIds[5]);
    await dbRobot.addOrderItem(o6.orderId, prodIds[6], 1);
    await dbRobot.addOrderItem(o6.orderId, prodIds[7], 1);
    await dbRobot.updateOrderStatus(o6.orderId, 'OFFER_SENT', 'SYSTEM', 'Quote sent.');
    await dbRobot.updateOrderStatus(o6.orderId, 'ORDER_CONFIRMED', 'SYSTEM', 'Order accepted.');
    await dbRobot.updateOrderStatus(o6.orderId, 'DELIVERED', 'SYSTEM', 'Customer confirmed receipt.');
    await dbRobot.updateOrderStatus(o6.orderId, 'INVOICED', 'SYSTEM', 'Invoice generated.');
    await dbRobot.updateOrderStatus(o6.orderId, 'CLOSED', 'SYSTEM', 'Payment received.');

    // Order 7: CANCELLED
    const o7 = await dbRobot.createOrder(custIds[0]);
    await dbRobot.addOrderItem(o7.orderId, prodIds[8], 1);
    await dbRobot.updateOrderStatus(o7.orderId, 'OFFER_SENT', 'SYSTEM', 'Quote sent.');
    await dbRobot.updateOrderStatus(o7.orderId, 'CANCELLED', 'admin', 'Budget rejected by customer CFO.');

    console.log('Created 7 workflow-compliant orders.');
    console.log('--- Database Population Complete ---');
    process.exit(0);
}

populate().catch(err => {
    console.error('Population Failed:', err);
    process.exit(1);
});
