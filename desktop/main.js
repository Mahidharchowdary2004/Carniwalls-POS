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

  // Test actively push message to the Electron-Renderer
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

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


