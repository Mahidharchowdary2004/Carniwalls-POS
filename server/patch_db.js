require('dotenv').config();
const { Pool } = require('pg');

const db = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  try {
    console.log("Adding missing columns to bills table...");
    await db.query(`ALTER TABLE bills ADD COLUMN IF NOT EXISTS table_id VARCHAR(50)`);
    await db.query(`ALTER TABLE bills ADD COLUMN IF NOT EXISTS order_type VARCHAR(20)`);
    await db.query(`ALTER TABLE bills ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'`);
    await db.query(`ALTER TABLE bills ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'paid'`);
    console.log("Done.");
  } catch(e) {
    console.error(e);
  } finally {
    db.end();
  }
}
run();
