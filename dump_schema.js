import db from './server/db.js';

const all = (sql) => new Promise((resolve, reject) => {
    db.all(sql, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

try {
    const tables = await all("SELECT name, sql FROM sqlite_master WHERE type='table'");
    console.log(JSON.stringify(tables, null, 2));
    process.exit(0);
} catch (err) {
    console.error(err);
    process.exit(1);
}
