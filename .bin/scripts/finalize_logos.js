import dbRobot from '../server/agent.js';

async function finalize() {
    console.log('--- Finalizing Logos ---');
    
    // Explicitly fix ALL new ones
    const fixes = [
        { id: 2, logo: '/assets/logos/greenleaf-logo.png' },
        { id: 7, logo: '/logos/ace_hotel.png' },
        { id: 8, logo: '/logos/ac_hotels.png' },
        { id: 9, logo: '/logos/adagio.png' },
        { id: 10, logo: '/logos/big_boy.png' },
        { id: 11, logo: '/logos/big_smoke_burger.png' },
        { id: 12, logo: '/logos/bread_street_kitchen.png' }
    ];

    for (const fix of fixes) {
        await dbRobot.run("UPDATE customers SET logo_path = ? WHERE cust_id = ?", [fix.logo, fix.id]);
    }

    const customers = await dbRobot.all('SELECT cust_id, cust_name, logo_path FROM customers');
    console.log('Final Customer Mappings:', JSON.stringify(customers, null, 2));
    console.log('Updated Customers:', JSON.stringify(customers, null, 2));
    
    console.log('--- Finalization Complete ---');
    process.exit(0);
}

finalize().catch(err => {
    console.error(err);
    process.exit(1);
});
