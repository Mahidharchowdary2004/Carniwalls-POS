const db = require('./db');

async function main() {
  try {
    const res = await db.query("SELECT id, bill_no, created_at, total FROM bills ORDER BY created_at DESC LIMIT 10");
    console.log('--- BILLS ---');
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

main();
