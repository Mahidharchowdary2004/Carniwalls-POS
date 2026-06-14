const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'CarniWalls-POS', 'pos_offline.db');

try {
  const db = new Database(dbPath, { fileMustExist: true });
  console.log('✅ Connected to SQLite.');

  const stateObj = db.prepare('SELECT value FROM kv_store WHERE key = ?').get('pos-store');
  if (stateObj) {
    const data = JSON.parse(stateObj.value);
    console.log(JSON.stringify(data.state.user, null, 2));
  }

  db.close();
} catch (err) {
  console.error(err);
}
