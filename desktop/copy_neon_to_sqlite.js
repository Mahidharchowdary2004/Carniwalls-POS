const { Client } = require('pg');
const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// Connection URLs
const postgresUrl = 'postgresql://neondb_owner:npg_bl7AvIZCRB4i@ep-flat-silence-apk76nhd-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require';
const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'CarniWalls-POS', 'pos_offline.db');

console.log('🔄 Replicating data from Neon Tech to local SQLite...');
console.log('📂 Local SQLite Path:', dbPath);

async function runMigration() {
  const pgClient = new Client({
    connectionString: postgresUrl,
    ssl: { rejectUnauthorized: false }
  });

  let sqliteDb;
  try {
    // 1. Connect to both databases
    await pgClient.connect();
    console.log('✅ Connected to Neon Tech Postgres database.');

    sqliteDb = new Database(dbPath);
    sqliteDb.pragma('journal_mode = WAL');
    console.log('✅ Connected to local SQLite database.');

    // 2. Clear old data (optional, but ensures clean mirror)
    console.log('🧼 Cleaning up existing local tables for fresh sync...');
    sqliteDb.exec('DELETE FROM categories');
    sqliteDb.exec('DELETE FROM menu_items');
    sqliteDb.exec('DELETE FROM tables');
    sqliteDb.exec('DELETE FROM orders');
    sqliteDb.exec('DELETE FROM bills');
    sqliteDb.exec('DELETE FROM inventory');
    sqliteDb.exec('DELETE FROM sync_queue');
    console.log('✅ Local tables cleared.');

    // 3. Sync Categories
    console.log('📥 Copying [categories]...');
    const catRes = await pgClient.query('SELECT * FROM categories');
    console.log(`   Fetched ${catRes.rows.length} categories.`);
    const catStmt = sqliteDb.prepare(`
      INSERT INTO categories (id, name, icon, sort_order, is_active, outlet_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    sqliteDb.transaction(() => {
      for (const c of catRes.rows) {
        catStmt.run(c.id, c.name, c.icon, c.sort_order, c.is_active ? 1 : 0, c.outlet_id);
      }
    })();
    console.log('   Categories copied successfully.');

    // 4. Sync Menu Items
    console.log('📥 Copying [menu_items]...');
    const menuRes = await pgClient.query('SELECT * FROM menu_items');
    console.log(`   Fetched ${menuRes.rows.length} menu items.`);
    const menuStmt = sqliteDb.prepare(`
      INSERT INTO menu_items (
        id, name, price, cost, type, description, emoji, active, gst_percent, 
        available_dine, available_takeaway, available_delivery, category_id, stock, min_stock, outlet_id, is_favorite
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    sqliteDb.transaction(() => {
      for (const m of menuRes.rows) {
        menuStmt.run(
          m.id, m.name, parseFloat(m.price) || 0, parseFloat(m.cost) || 0, m.type, m.description, m.emoji,
          m.active ? 1 : 0, parseFloat(m.gst_percent) || 0, m.available_dine ? 1 : 0, m.available_takeaway ? 1 : 0,
          m.available_delivery ? 1 : 0, m.category_id, parseFloat(m.stock) || 0, parseFloat(m.min_stock) || 0,
          m.outlet_id, m.is_favorite ? 1 : 0
        );
      }
    })();
    console.log('   Menu items copied successfully.');

    // 5. Sync Tables
    console.log('📥 Copying [tables]...');
    const tabRes = await pgClient.query('SELECT * FROM tables');
    console.log(`   Fetched ${tabRes.rows.length} tables.`);
    const tabStmt = sqliteDb.prepare(`
      INSERT INTO tables (id, number, status, section, capacity, x, y, width, height, shape, outlet_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    sqliteDb.transaction(() => {
      for (const t of tabRes.rows) {
        tabStmt.run(t.id, t.number, t.status, t.section, t.capacity, t.x, t.y, t.width, t.height, t.shape, t.outlet_id);
      }
    })();
    console.log('   Tables copied successfully.');

    // 6. Sync Active Orders
    console.log('📥 Copying [orders]...');
    const ordRes = await pgClient.query('SELECT * FROM orders WHERE status != \'billed\'');
    console.log(`   Fetched ${ordRes.rows.length} active orders.`);
    const ordStmt = sqliteDb.prepare(`
      INSERT INTO orders (
        id, table_id, items, order_type, customer_name, subtotal, cgst, sgst, discount, total, status, kot_status, kot_printed, notes, outlet_id, token_no, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    sqliteDb.transaction(() => {
      for (const o of ordRes.rows) {
        const itemsStr = typeof o.items === 'object' && o.items !== null ? JSON.stringify(o.items) : o.items;
        const createdStr = o.created_at ? new Date(o.created_at).toISOString() : new Date().toISOString();
        ordStmt.run(
          o.id, o.table_id, itemsStr, o.order_type, o.customer_name, parseFloat(o.subtotal) || 0,
          parseFloat(o.cgst) || 0, parseFloat(o.sgst) || 0, parseFloat(o.discount) || 0, parseFloat(o.total) || 0,
          o.status, o.kot_status, o.kot_printed ? 1 : 0, o.notes, o.outlet_id, o.token_no, createdStr
        );
      }
    })();
    console.log('   Active orders copied successfully.');

    // 7. Sync Inventory
    console.log('📥 Copying [inventory]...');
    const invRes = await pgClient.query('SELECT * FROM inventory');
    console.log(`   Fetched ${invRes.rows.length} inventory items.`);
    const invStmt = sqliteDb.prepare(`
      INSERT INTO inventory (id, name, category, stock, unit, min_stock, outlet_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    sqliteDb.transaction(() => {
      for (const i of invRes.rows) {
        invStmt.run(i.id, i.name, i.category, parseFloat(i.stock) || 0, i.unit, parseFloat(i.min_stock) || 0, i.outlet_id);
      }
    })();
    console.log('   Inventory items copied successfully.');

    // 8. Sync Historical Bills (Copies EVERYTHING!)
    console.log('📥 Copying [bills]...');
    const billRes = await pgClient.query('SELECT * FROM bills ORDER BY created_at DESC');
    console.log(`   Fetched ${billRes.rows.length} historical bills from Neon Tech.`);
    const billStmt = sqliteDb.prepare(`
      INSERT INTO bills (
        id, order_id, table_id, order_type, items, subtotal, cgst, sgst, discount, total, payment_method, status, outlet_id, bill_no, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    sqliteDb.transaction(() => {
      for (const b of billRes.rows) {
        const itemsStr = typeof b.items === 'object' && b.items !== null ? JSON.stringify(b.items) : b.items;
        const pmStr = typeof b.payment_method === 'object' && b.payment_method !== null ? JSON.stringify(b.payment_method) : b.payment_method;
        const createdStr = b.created_at ? new Date(b.created_at).toISOString() : new Date().toISOString();
        billStmt.run(
          b.id, b.order_id, b.table_id, b.order_type, itemsStr, parseFloat(b.subtotal) || 0,
          parseFloat(b.cgst) || 0, parseFloat(b.sgst) || 0, parseFloat(b.discount) || 0, parseFloat(b.total) || 0,
          pmStr, b.status, b.outlet_id, b.bill_no, createdStr
        );
      }
    })();
    console.log('   Historical bills copied successfully.');

    console.log('\n🎉 ALL REMOTE DATA SUCCESSFULLY MIRRORED TO SQLite!');
  } catch (err) {
    console.error('❌ Data replication failed:', err);
  } finally {
    await pgClient.end();
    if (sqliteDb) sqliteDb.close();
  }
}

runMigration();
