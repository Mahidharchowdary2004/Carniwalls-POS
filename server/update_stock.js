const db = require('./db');

async function updateStock() {
  try {
    console.log('🔌 Initializing Database Connection...');
    
    // Fetch all menu items
    const { rows: items } = await db.query('SELECT id, name FROM menu_items WHERE outlet_id = $1', ['out_main']);
    console.log(`Found ${items.length} items. Updating stock...`);
    
    let updatedCount = 0;
    
    for (const item of items) {
      // Generate a random stock quantity between 10 and 100
      const randomQty = Math.floor(Math.random() * 91) + 10;
      
      await db.query(
        'UPDATE menu_items SET stock = $1 WHERE id = $2 AND outlet_id = $3',
        [randomQty, item.id, 'out_main']
      );
      
      updatedCount++;
    }
    
    console.log(`✅ Successfully updated stock for ${updatedCount} items!`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error updating stock:', err);
    process.exit(1);
  }
}

updateStock();
