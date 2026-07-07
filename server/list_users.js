const db = require('./db');

async function listUsers() {
  try {
    const { rows } = await db.query('SELECT id, name, email, phone, role, password FROM users');
    console.log("Users:", rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

listUsers();
