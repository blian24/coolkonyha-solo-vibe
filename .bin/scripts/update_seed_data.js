import db from '../server/db.js';

// Promisify database operations
const runAsync = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
    });
});

const updateSeedData = async () => {
    console.log('🌱 Updating seed data with notes and images...\n');

    try {
        // Update Customers with notes and logos
        console.log('👥 Updating customers...');
        await runAsync(`
      UPDATE customers SET 
        notes = 'Premium restaurant client. Prefers eco-friendly products. Regular orders monthly. VIP customer with 15% discount on bulk orders.',
        logo_path = '/assets/logos/greenleaf-logo.png'
      WHERE cust_id = 1
    `);

        await runAsync(`
      UPDATE customers SET 
        notes = 'Traditional Hungarian bistro. Focuses on authentic cookware. Payment terms: Net 30. Contact via phone preferred.',
        logo_path = '/assets/logos/budapestbistro-logo.png'
      WHERE cust_id = 2
    `);

        await runAsync(`
      UPDATE customers SET 
        notes = 'Coffee and pastry specialist. Looking for Italian espresso equipment. New client - require prepayment for first 3 orders.',
        logo_path = '/assets/logos/cafevienna-logo.png'
      WHERE cust_id = 3
    `);

        await runAsync(`
      UPDATE customers SET 
        notes = 'Large hotel chain procurement. High-volume orders. Requires detailed invoicing with VAT breakdown. Delivery to loading dock only.',
        logo_path = '/assets/logos/hotelroyal-logo.png'
      WHERE cust_id = 4
    `);

        await runAsync(`
      UPDATE customers SET 
        notes = 'Catering business for events. Seasonal demand spikes. Flexible payment arrangements. Often requests rush deliveries.',
        logo_path = '/assets/logos/familykitchen-logo.png'
      WHERE cust_id = 5
    `);

        // Update Suppliers with notes and logos
        console.log('📦 Updating suppliers...');
        await runAsync(`
      UPDATE product_suppliers SET 
        notes = 'Reliable local supplier. Fast delivery within 48 hours. Good pricing on bulk orders. Contact János for technical specifications.',
        logo_path = '/assets/logos/budapestkitchen-logo.png'
      WHERE prod_supp_id = 1
    `);

        await runAsync(`
      UPDATE product_suppliers SET 
        notes = 'Premium European supplier. Ships from Munich warehouse. Minimum order €500. 7-10 business days delivery. Excellent warranty support.',
        logo_path = '/assets/logos/eurocookware-logo.png'
      WHERE prod_supp_id = 2
    `);

        await runAsync(`
      UPDATE product_suppliers SET 
        notes = 'Specialty Italian imports. Best for espresso machines and premium cookware. Monthly special offers. Import duties included in pricing.',
        logo_path = '/assets/logos/italiankitchen-logo.png'
      WHERE prod_supp_id = 3
    `);

        // Update Products with notes and images
        console.log('🍳 Updating products...');
        await runAsync(`
      UPDATE products SET 
        notes = 'Professional-grade German steel. Includes 5 essential knives. Lifetime warranty. Ergonomic handles. Comes with wooden storage block.',
        image_path = '/assets/products/chef-knife-set.jpg'
      WHERE prod_id = 1
    `);

        await runAsync(`
      UPDATE products SET 
        notes = 'PFOA-free non-stick coating. Induction compatible. Dishwasher safe. 2-year warranty. Even heat distribution.',
        image_path = '/assets/products/frying-pan.jpg'
      WHERE prod_id = 2
    `);

        await runAsync(`
      UPDATE products SET 
        notes = '18/10 stainless steel construction. Includes 16cm, 20cm, and 24cm pots with lids. Oven safe up to 260°C. Made in Germany.',
        image_path = '/assets/products/pot-set.jpg'
      WHERE prod_id = 3
    `);

        await runAsync(`
      UPDATE products SET 
        notes = 'Authentic Italian design. 15-bar pressure pump. Dual heating system. Professional steam wand. Built-in grinder. Energy Star certified.',
        image_path = '/assets/products/espresso-machine.jpg'
      WHERE prod_id = 4
    `);

        await runAsync(`
      UPDATE products SET 
        notes = 'Sustainable bamboo material. Natural antibacterial properties. Deep juice groove. Non-slip rubber feet. Hand wash recommended.',
        image_path = '/assets/products/cutting-board.jpg'
      WHERE prod_id = 5
    `);

        await runAsync(`
      UPDATE products SET 
        notes = 'LCD display with backlight. Tare function. Measures in grams, ounces, and pounds. Battery included. Auto shut-off feature.',
        image_path = '/assets/products/kitchen-scale.jpg'
      WHERE prod_id = 6
    `);

        await runAsync(`
      UPDATE products SET 
        notes = 'Food-grade silicone. Temperature resistant -40°C to 230°C. Non-stick surface. Reusable and eco-friendly. Dishwasher safe.',
        image_path = '/assets/products/baking-mat.jpg'
      WHERE prod_id = 7
    `);

        await runAsync(`
      UPDATE products SET 
        notes = 'Pre-seasoned cast iron. Superior heat retention. Oven and campfire safe. Improves with use. Will last generations with proper care.',
        image_path = '/assets/products/cast-iron-skillet.jpg'
      WHERE prod_id = 8
    `);

        await runAsync(`
      UPDATE products SET 
        notes = 'Hand-painted Italian ceramic. Nesting design saves space. Microwave and dishwasher safe. Includes 1L, 2L, 3L, and 4L bowls.',
        image_path = '/assets/products/mixing-bowls.jpg'
      WHERE prod_id = 9
    `);

        await runAsync(`
      UPDATE products SET 
        notes = 'Commercial-grade 1200W motor. Crushes ice effortlessly. 2L BPA-free container. Variable speed control. Pulse function. 5-year warranty.',
        image_path = '/assets/products/blender.jpg'
      WHERE prod_id = 10
    `);

        // Update Orders with notes
        console.log('📋 Updating orders...');
        await runAsync(`
      UPDATE orders SET 
        notes = 'Customer requested gift wrapping for knife set. Delivery completed on schedule. Customer very satisfied, expects repeat order next month.'
      WHERE order_id = 1
    `);

        await runAsync(`
      UPDATE orders SET 
        notes = 'Rush delivery requested. Extra handling fee applied. Customer installing new café section. Follow up for additional equipment needs.'
      WHERE order_id = 2
    `);

        await runAsync(`
      UPDATE orders SET 
        notes = 'Waiting for budget approval from owner. Customer interested but needs to compare with competitors. Send reminder on Friday.'
      WHERE order_id = 3
    `);

        await runAsync(`
      UPDATE orders SET 
        notes = 'Large order for hotel renovation project. Delivery must be before weekend. Loading dock hours 8am-4pm. Contact warehouse manager before dispatch.'
      WHERE order_id = 4
    `);

        await runAsync(`
      UPDATE orders SET 
        notes = 'Customer cancelled due to budget constraints. Keep in contact for future opportunities. They mentioned possible Q2 expansion plans.'
      WHERE order_id = 5
    `);

        console.log('\n✅ Seed data updated successfully!');
        console.log('\n📊 Summary:');
        console.log('   - Updated 5 customers with notes and logo paths');
        console.log('   - Updated 3 suppliers with notes and logo paths');
        console.log('   - Updated 10 products with notes and image paths');
        console.log('   - Updated 5 orders with notes');

        process.exit(0);
    } catch (err) {
        console.error('\n❌ Update failed:', err.message);
        process.exit(1);
    }
};

// Give DB a moment to connect
setTimeout(updateSeedData, 500);
