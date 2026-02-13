import db from '../server/db.js';

// Promisify database operations
const runAsync = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
    });
});

const migrateDatabase = async () => {
    console.log('🔧 Starting database migration...\n');

    try {
        // Add notes and logo_path to customers
        console.log('📝 Adding columns to customers table...');
        await runAsync('ALTER TABLE customers ADD COLUMN notes TEXT');
        await runAsync('ALTER TABLE customers ADD COLUMN logo_path TEXT');

        // Add notes and logo_path to product_suppliers
        console.log('📝 Adding columns to product_suppliers table...');
        await runAsync('ALTER TABLE product_suppliers ADD COLUMN notes TEXT');
        await runAsync('ALTER TABLE product_suppliers ADD COLUMN logo_path TEXT');

        // Add notes and image_path to products
        console.log('📝 Adding columns to products table...');
        await runAsync('ALTER TABLE products ADD COLUMN notes TEXT');
        await runAsync('ALTER TABLE products ADD COLUMN image_path TEXT');

        // Add notes to orders
        console.log('📝 Adding notes column to orders table...');
        await runAsync('ALTER TABLE orders ADD COLUMN notes TEXT');

        console.log('\n✅ Database migration completed successfully!');
        console.log('\n📊 Summary:');
        console.log('   - customers: added notes, logo_path');
        console.log('   - product_suppliers: added notes, logo_path');
        console.log('   - products: added notes, image_path');
        console.log('   - orders: added notes');

        process.exit(0);
    } catch (err) {
        console.error('\n❌ Migration failed:', err.message);
        process.exit(1);
    }
};

// Give DB a moment to connect
setTimeout(migrateDatabase, 500);
