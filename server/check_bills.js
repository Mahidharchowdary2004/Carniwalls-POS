const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_bl7AvIZCRB4i@ep-flat-silence-apk76nhd-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function run() {
  await client.connect();
  const res = await client.query('SELECT id, bill_no, created_at, total FROM bills ORDER BY created_at DESC LIMIT 5');
  console.log("Latest 5 bills:");
  console.table(res.rows);
  await client.end();
}

run().catch(console.error);
