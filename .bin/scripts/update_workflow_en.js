import sqlite3 from 'sqlite3';

const dbPath = 'coolkonyha.db';
const db = new sqlite3.Database(dbPath);

const mapping = [
  { key: 'NEW', name: 'New', desc: 'New inquiry received' },
  { key: 'OFFER_SENT', name: 'Offer Sent', desc: 'Price offer sent to customer' },
  { key: 'ORDER_CONFIRMED', name: 'Order Confirmed', desc: 'Customer signed the order' },
  { key: 'PURCHASE', name: 'Purchase', desc: 'Ordering materials from suppliers' },
  { key: 'READY_FOR_DELIVERY', name: 'Ready for Delivery', desc: 'Production finished, ready to ship' },
  { key: 'DELIVERY', name: 'Delivery', desc: 'In transit to customer site' },
  { key: 'DELIVERED', name: 'Delivered', desc: 'Installation finished and accepted' },
  { key: 'INVOICED', name: 'Invoiced', desc: 'Final invoice sent' },
  { key: 'CLOSED', name: 'Closed', desc: 'Order cycle completed' },
  { key: 'CANCELLED', name: 'Cancelled', desc: 'Order was canceled' }
];

db.serialize(() => {
  const stmt = db.prepare("UPDATE business_status_workflow SET display_name = ?, description = ? WHERE status_key = ?");
  for (const item of mapping) {
    stmt.run(item.name, item.desc, item.key);
  }
  stmt.finalize();
  
  // Verification fetch
  db.all("SELECT * FROM business_status_workflow", [], (err, rows) => {
    if (err) {
      console.error(err);
    } else {
      console.log("Updated workflow table:");
      console.log(JSON.stringify(rows, null, 2));
    }
    db.close();
  });
});
