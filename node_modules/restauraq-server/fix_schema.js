const db = require('./db');

async function fixSchema() {
  console.log('🔍 Verifying schema...');
  try {
    // Check menu_items columns
    const { rows: cols } = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'menu_items'
    `);
    
    const colNames = cols.map(c => c.column_name);
    console.log('Current menu_items columns:', colNames.join(', '));

    // Full sync for menu_items based on index.js line 743
    const expectedMenuCols = [
      'id', 'name', 'price', 'cost', 'type', 'description', 'emoji', 
      'active', 'gst_percent', 'available_dine', 'available_takeaway', 
      'available_delivery', 'category_id', 'outlet_id', 'created_at',
      'stock', 'min_stock'
    ];
    
    for (const col of expectedMenuCols) {
      if (!colNames.includes(col)) {
        console.log(`➕ Adding missing column ${col} to menu_items...`);
        let type = 'VARCHAR(50)';
        if (col === 'price' || col === 'cost' || col === 'gst_percent' || col === 'stock' || col === 'min_stock') type = 'DECIMAL(10,2) DEFAULT 0';
        if (col.startsWith('available') || col === 'active') type = 'BOOLEAN DEFAULT TRUE';
        if (col === 'description') type = 'TEXT';
        if (col === 'created_at') type = 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP';
        
        await db.query(`ALTER TABLE menu_items ADD COLUMN ${col} ${type}`);
      }
    }

    // Check categories columns
    const { rows: catCols } = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'categories'
    `);
    const catColNames = catCols.map(c => c.column_name);
    console.log('Current categories columns:', catColNames.join(', '));

    // Check orders columns
    const { rows: orderCols } = await db.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'orders'
    `);
    const orderColNames = orderCols.map(c => c.column_name);
    if (!orderColNames.includes('outlet_id')) {
      console.log('➕ Adding outlet_id to orders...');
      await db.query('ALTER TABLE orders ADD COLUMN outlet_id VARCHAR(50) REFERENCES outlets(id)');
    }

    // Check bills columns
    const { rows: billCols } = await db.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'bills'
    `);
    const billColNames = billCols.map(c => c.column_name);
    if (!billColNames.includes('outlet_id')) {
      console.log('➕ Adding outlet_id to bills...');
      await db.query('ALTER TABLE bills ADD COLUMN outlet_id VARCHAR(50) REFERENCES outlets(id)');
    }

    console.log('✅ Schema fix complete.');
  } catch (err) {
    console.error('❌ Schema fix failed:', err);
  } finally {
    process.exit();
  }
}

fixSchema();
