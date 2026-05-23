const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_bl7AvIZCRB4i@ep-flat-silence-apk76nhd-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function run() {
  await client.connect();
  console.log('Clearing bills...');
  await client.query("DELETE FROM bills");
  console.log('Clearing kots...');
  await client.query("DELETE FROM kots");
  console.log('Clearing orders...');
  await client.query("DELETE FROM orders");
  console.log('Resetting tables...');
  await client.query("UPDATE tables SET status = 'free'");
  console.log('Done!');
  await client.end();
}

run().catch(console.error);
