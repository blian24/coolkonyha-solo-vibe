import db from './server/db.js';

const all = (sql) => new Promise((resolve, reject) => {
    db.all(sql, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

try {
    const custInfo = await all("PRAGMA table_info(customers)");
    console.log("CUSTOMERS TABLE INFO:");
    console.log(JSON.stringify(custInfo, null, 2));

    const suppInfo = await all("PRAGMA table_info(product_suppliers)");
    console.log("PRODUCT_SUPPLIERS TABLE INFO:");
    console.log(JSON.stringify(suppInfo, null, 2));

    const prodInfo = await all("PRAGMA table_info(products)");
    console.log("PRODUCTS TABLE INFO:");
    console.log(JSON.stringify(prodInfo, null, 2));
    
    process.exit(0);
} catch (err) {
    console.error(err);
    process.exit(1);
}
