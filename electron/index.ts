const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const { initializeIpcHandlers } = require('./ipcHandlers');
const { initializeDatabase, getDb } = require('./db');

function createWindow() {
  console.log('createWindow() called');
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.webContents.on('did-finish-load', () => {
    win.webContents.send('main-process-message', new Date().toLocaleString());
  });

  // Charge l'URL du serveur de dev ou le fichier HTML local
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  if (!app.isPackaged) {
    win.webContents.openDevTools();
  }
}

app.whenReady().then(async () => {
  // Set a Content Security Policy
  session.defaultSession.webRequest.onHeadersReceived((details: any, callback: any) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' data:; script-src 'self' 'unsafe-eval' 'unsafe-inline' data:"
        ]
      }
    });
  });
  try {
    initializeDatabase();
    initializeIpcHandlers();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    console.error('[Main] Failed to initialize application:', error);
    app.quit(); // Quit on critical error
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    getDb().close();
    app.quit();
  }
});