const bcrypt = require('bcryptjs');
const db = require('./db');

async function updatePasswords() {
  try {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('admin123', salt);

    await db.query('UPDATE users SET password = $1 WHERE email = $2', [hash, 'admin@restauraq.com']);
    await db.query('UPDATE users SET password = $1 WHERE email = $2', [hash, 'cashier@restauraq.com']);

    console.log("Passwords updated to 'admin123'");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

updatePasswords();
