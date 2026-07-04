require('dotenv').config();
const { Pool } = require('pg');
const db = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const res = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'bills';
    `);
    console.log("Bills table columns:", res.rows);
  } catch(e) {
    console.error(e);
  } finally {
    db.end();
  }
}
run();
