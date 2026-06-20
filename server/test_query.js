const db = require('./db');

async function run() {
  try {
    const q1 = await db.query(`
      SELECT items FROM bills LIMIT 1
    `);
    console.log("Items:", q1.rows[0]);
  } catch (err) {
    console.error("Query error:", err.message);
  }
  process.exit();
}

run();
