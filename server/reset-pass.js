const bcrypt = require('bcryptjs');
const db = require('./db.js');

async function run() {
  const hash = bcrypt.hashSync('cash123', 10);
  await db.query('UPDATE users SET password = $1 WHERE email = $2', [hash, 'cashier@restauraq.com']);
  console.log('Password reset successfully to cash123');
  process.exit(0);
}
run();
