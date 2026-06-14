const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// Path to SQLite db in AppData/Roaming/CarniWalls-POS
const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'CarniWalls-POS', 'pos_offline.db');

console.log('🔍 Database path:', dbPath);

try {
  const db = new Database(dbPath, { fileMustExist: true });
  console.log('✅ Connected to SQLite database successfully!\n');

  const tables = ['categories', 'menu_items', 'tables', 'orders', 'bills', 'inventory', 'sync_queue'];
  
  for (const t of tables) {
    try {
      const countRow = db.prepare(`SELECT count(*) as count FROM ${t}`).get();
      console.log(`📊 Table [${t}]: ${countRow.count} rows`);
      
      if (countRow.count > 0) {
        const sample = db.prepare(`SELECT * FROM ${t} LIMIT 1`).get();
        console.log(`   Sample record:`, JSON.stringify(sample, null, 2));
      }
      console.log('----------------------------------------------------');
    } catch (tableErr) {
      console.log(`❌ Table [${t}] error:`, tableErr.message);
      console.log('----------------------------------------------------');
    }
  }

  db.close();
} catch (err) {
  console.error('❌ Failed to open database:', err.message);
  console.log('\n💡 Tip: If the file does not exist, it means the application has not been launched or has not created the database yet.');
}
