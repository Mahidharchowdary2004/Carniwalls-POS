require('dotenv').config();
const { Pool } = require('pg');
const db = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const order_id = 'some_order_id';
    const billId = `bill_${Date.now()}`;
    const payment_method = { method: 'cash', amount: 100 };
    const discount = 0;
    
    await db.query(`
      INSERT INTO bills (id, order_id, table_id, order_type, items, subtotal, cgst, sgst, discount, total, payment_method, status, outlet_id, bill_no, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'paid', $12, $13, $14) RETURNING *
    `, [billId, order_id, 'tbl1', 'dine-in', '[]', 100, 0, 0, discount, 100, payment_method, 'out_main', 1, new Date().toISOString()]);
    console.log("Success with object!");
  } catch(e) {
    console.error("DB ERROR:", e.message);
  } finally {
    db.end();
  }
}
run();
