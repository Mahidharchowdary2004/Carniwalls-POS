require('dotenv').config({path: './.env'});
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({connectionString: process.env.DATABASE_URL});

const run = async () => {
  try {
    const hash = bcrypt.hashSync('121212', 10);
    await pool.query("UPDATE users SET phone = '9440388942', password = $1 WHERE role = 'admin'", [hash]);
    console.log('Admin updated successfully in DB!');
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
};

run();
