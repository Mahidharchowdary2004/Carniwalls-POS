const { app, BrowserWindow, shell, ipcMain } = require('electron')
const { join } = require('node:path')
const { autoUpdater } = require('electron-updater')

// Ensure app is a single instance
if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let win = null

const preload = join(__dirname, 'preload.js')
const indexHtml = join(__dirname, 'dist/index.html')

function createWindow() {
  win = new BrowserWindow({
    title: 'CarniWalls-POS',
    width: 1200,
    height: 800,
    icon: join(__dirname, 'dist/logo.png'),
    webPreferences: {
      preload,
      // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
      // Consider using contextBridge.exposeInMainWorld
      // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) { // vite-plugin-electron sets this
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    // Open devTools, see https://github.com/electron/electron/issues/12438 for why we wait for dom-ready
    win.webContents.on('did-finish-load', () => {
      win?.webContents.send('main-process-message', new Date().toLocaleString())
    })
  } else {
    win.loadFile(indexHtml)
  }

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })

  // Allow opening DevTools with Ctrl+Shift+I in production
  win.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      win.webContents.toggleDevTools()
      event.preventDefault()
    }
  })
}

app.whenReady().then(() => {
  createWindow()
  
  // Silently check for updates on startup
  autoUpdater.checkForUpdatesAndNotify()
})

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})

// --- IPC Handlers for Auto Updater and Printing ---
ipcMain.handle('get-version', () => app.getVersion())

ipcMain.handle('get-printers', async (event) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      return await win.webContents.getPrintersAsync()
    }
    return []
  } catch (err) {
    console.error('Failed to get printers:', err)
    return []
  }
})

ipcMain.on('print-silent', (event, options = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win) {
    win.webContents.print({
      silent: true,
      printBackground: true,
      deviceName: options.printerName || '', // Uses default if empty
      margins: { marginType: 'none' }, // Best practice for thermal printers
      scaleFactor: options.scaleFactor ? parseFloat(options.scaleFactor) : 100
    }, (success, failureReason) => {
      event.sender.send('print-reply', { success, failureReason })
      if (!success) console.error('Silent Print Failed:', failureReason)
    })
  }
})

ipcMain.handle('print-silent', async (event, options = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win) {
    return new Promise((resolve) => {
      win.webContents.print({
        silent: true,
        printBackground: true,
        deviceName: options.printerName || '',
        margins: { marginType: 'none' },
        scaleFactor: options.scaleFactor ? parseFloat(options.scaleFactor) : 100
      }, (success, failureReason) => {
        event.sender.send('print-reply', { success, failureReason })
        if (!success) console.error('Silent Print Failed:', failureReason)
        resolve({ success, failureReason })
      })
    })
  }
  return { success: false, failureReason: 'No window found' }
})


ipcMain.on('check-for-updates', () => {
  autoUpdater.checkForUpdates()
})

ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall()
})

autoUpdater.on('checking-for-update', () => {
  win?.webContents.send('updater-status', { status: 'checking' })
})
autoUpdater.on('update-available', () => {
  win?.webContents.send('updater-status', { status: 'available' })
})
autoUpdater.on('update-not-available', () => {
  win?.webContents.send('updater-status', { status: 'not-available' })
})
autoUpdater.on('error', (err) => {
  win?.webContents.send('updater-status', { status: 'error', message: err.message })
})
autoUpdater.on('download-progress', (progressObj) => {
  win?.webContents.send('updater-progress', progressObj.percent)
})
autoUpdater.on('update-downloaded', () => {
  win?.webContents.send('updater-status', { status: 'downloaded' })
})

// --- SQLite Database Setup ---
const Database = require('better-sqlite3');
const fs = require('fs');

let db;
try {
  const dbPath = join(app.getPath('userData'), 'pos_offline.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  
  // Create Key-Value store table
  db.exec('CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT)');

  // Create Relational POS tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT,
      icon TEXT,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      outlet_id TEXT
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      name TEXT,
      price REAL DEFAULT 0,
      cost REAL DEFAULT 0,
      type TEXT,
      description TEXT,
      emoji TEXT,
      active INTEGER DEFAULT 1,
      gst_percent REAL DEFAULT 0,
      available_dine INTEGER DEFAULT 1,
      available_takeaway INTEGER DEFAULT 1,
      available_delivery INTEGER DEFAULT 1,
      category_id TEXT,
      stock REAL DEFAULT 0,
      min_stock REAL DEFAULT 0,
      outlet_id TEXT,
      is_favorite INTEGER DEFAULT 0,
      stock_required INTEGER DEFAULT 0
    );
    
    -- Attempt to add columns if they don't exist (for existing DBs)
    try { db.exec('ALTER TABLE menu_items ADD COLUMN stock_required INTEGER DEFAULT 0'); } catch(e) {}

    CREATE TABLE IF NOT EXISTS tables (
      id TEXT PRIMARY KEY,
      number TEXT,
      status TEXT DEFAULT 'free',
      section TEXT,
      capacity INTEGER,
      x REAL DEFAULT 0,
      y REAL DEFAULT 0,
      width REAL DEFAULT 100,
      height REAL DEFAULT 100,
      shape TEXT DEFAULT 'rectangle',
      outlet_id TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      table_id TEXT,
      items TEXT, -- JSON string
      order_type TEXT DEFAULT 'dine-in',
      customer_name TEXT,
      subtotal REAL DEFAULT 0,
      cgst REAL DEFAULT 0,
      sgst REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      total REAL DEFAULT 0,
      status TEXT DEFAULT 'open',
      kot_status TEXT DEFAULT 'preparing',
      kot_printed INTEGER DEFAULT 0,
      notes TEXT,
      outlet_id TEXT,
      token_no INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bills (
      id TEXT PRIMARY KEY,
      order_id TEXT,
      table_id TEXT,
      order_type TEXT DEFAULT 'dine-in',
      items TEXT, -- JSON string
      subtotal REAL DEFAULT 0,
      cgst REAL DEFAULT 0,
      sgst REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      total REAL DEFAULT 0,
      payment_method TEXT,
      status TEXT DEFAULT 'paid',
      outlet_id TEXT,
      bill_no INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      name TEXT,
      category TEXT,
      stock REAL DEFAULT 0,
      unit TEXT,
      min_stock REAL DEFAULT 0,
      outlet_id TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT,
      table_name TEXT,
      record_id TEXT,
      data TEXT, -- JSON string
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
} catch (err) {
  console.error('Failed to initialize SQLite database:', err);
}

ipcMain.handle('sqlite-get', (event, key) => {
  if (!db) return null;
  try {
    const stmt = db.prepare('SELECT value FROM kv_store WHERE key = ?');
    const row = stmt.get(key);
    return row ? row.value : null;
  } catch (err) {
    console.error('SQLite get error:', err);
    return null;
  }
});

ipcMain.handle('sqlite-set', (event, key, value) => {
  if (!db) return;
  try {
    const stmt = db.prepare('INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)');
    stmt.run(key, value);
  } catch (err) {
    console.error('SQLite set error:', err);
  }
});

ipcMain.handle('sqlite-del', (event, key) => {
  if (!db) return;
  try {
    const stmt = db.prepare('DELETE FROM kv_store WHERE key = ?');
    stmt.run(key);
  } catch (err) {
    console.error('SQLite delete error:', err);
  }
});

// Relational DB generic handlers
const mapParams = (params) => {
  const arr = Array.isArray(params) ? params : [params];
  return arr.map(p => typeof p === 'boolean' ? (p ? 1 : 0) : p);
};

ipcMain.handle('sqlite-run', (event, sql, params = []) => {
  if (!db) return null;
  try {
    const stmt = db.prepare(sql);
    const info = stmt.run(...mapParams(params));
    return { changes: info.changes, lastInsertRowid: info.lastInsertRowid };
  } catch (err) {
    console.error('sqlite-run error:', sql, params, err);
    throw err;
  }
});

ipcMain.handle('sqlite-all', (event, sql, params = []) => {
  if (!db) return [];
  try {
    const stmt = db.prepare(sql);
    return stmt.all(...mapParams(params));
  } catch (err) {
    console.error('sqlite-all error:', sql, params, err);
    throw err;
  }
});

ipcMain.handle('sqlite-row', (event, sql, params = []) => {
  if (!db) return null;
  try {
    const stmt = db.prepare(sql);
    return stmt.get(...mapParams(params)) || null;
  } catch (err) {
    console.error('sqlite-row error:', sql, params, err);
    throw err;
  }
});

ipcMain.handle('sqlite-transaction', (event, queries) => {
  if (!db) return null;
  try {
    const runTx = db.transaction((queries) => {
      const results = [];
      for (const q of queries) {
        const stmt = db.prepare(q.sql);
        const info = stmt.run(...mapParams(q.params));
        results.push({ changes: info.changes, lastInsertRowid: info.lastInsertRowid });
      }
      return results;
    });
    return runTx(queries);
  } catch (err) {
    console.error('sqlite-transaction error:', err);
    throw err;
  }
});
