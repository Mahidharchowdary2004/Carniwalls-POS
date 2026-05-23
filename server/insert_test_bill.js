const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_bl7AvIZCRB4i@ep-flat-silence-apk76nhd-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function run() {
  await client.connect();

  const bRes = await client.query("SELECT COALESCE(MAX(bill_no), 0) as max_bill FROM bills WHERE outlet_id = 'out_main'");
  const bill_no = parseInt(bRes.rows[0].max_bill) + 1;

  const billId = 'bill_test_' + Date.now();
  const ordId = 'ord_test_' + Date.now();

  await client.query(
    "INSERT INTO orders (id, subtotal, total, status, outlet_id) VALUES ($1, 250, 250, 'billed', 'out_main')",
    [ordId]
  );

  // NOW() at the DB level is UTC — which right now is 2026-05-23T19:38 UTC = 2026-05-24 01:08 IST (TODAY!)
  const { rows } = await client.query(
    "INSERT INTO bills (id, order_id, order_type, items, subtotal, cgst, sgst, discount, total, payment_method, status, outlet_id, bill_no, created_at) VALUES ($1, $2, 'takeaway', '[]', 250, 0, 0, 0, 250, '{}', 'paid', 'out_main', $3, NOW()) RETURNING id, bill_no, created_at, total",
    [billId, ordId, bill_no]
  );

  console.log('Created bill:');
  console.table(rows);
  await client.end();
}

run().catch(console.error);
