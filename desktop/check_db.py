import sqlite3
import os
import json

# Resolve SQLite path
db_path = os.path.join(os.path.expanduser('~'), 'AppData', 'Roaming', 'CarniWalls-POS', 'pos_offline.db')

print(f"🔍 SQLite database path: {db_path}")

if not os.path.exists(db_path):
    print("❌ SQLite database file does not exist yet. Please launch the desktop app first so it can create the file!")
    exit(1)

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    print("✅ Connected to SQLite database successfully!\n")
    
    tables = ['categories', 'menu_items', 'tables', 'orders', 'bills', 'inventory', 'sync_queue']
    
    for t in tables:
        try:
            # Check if table exists
            cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{t}'")
            if not cursor.fetchone():
                print(f"❓ Table [{t}]: Does not exist in database yet")
                print("----------------------------------------------------")
                continue
                
            cursor.execute(f"SELECT count(*) FROM {t}")
            count = cursor.fetchone()[0]
            print(f"📊 Table [{t}]: {count} rows")
            
            if count > 0:
                cursor.execute(f"SELECT * FROM {t} LIMIT 1")
                row = cursor.fetchone()
                
                # Fetch column names
                col_names = [description[0] for description in cursor.description]
                record = dict(zip(col_names, row))
                print(f"   Sample record:")
                print(json.dumps(record, indent=2))
            print("----------------------------------------------------")
        except Exception as e:
            print(f"❌ Table [{t}] query error: {str(e)}")
            print("----------------------------------------------------")
            
    conn.close()
except Exception as err:
    print(f"❌ Failed to read SQLite database: {str(err)}")
