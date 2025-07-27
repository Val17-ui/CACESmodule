import { app, BrowserWindow, session } from 'electron';
import path from 'path';
const { initializeIpcHandlers } = require('./ipcHandlers.js');
import { initializeDatabase, getDb } from './db.js';
import { initializeLogger, getLogger, ILogger } from './utils/logger.js';





function createWindow(logger: ILogger) {
  logger.info('Creating main application window');
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
  initializeLogger(); // Initialize the logger here
  const logger = getLogger(); // Get the initialized logger instance
  
  logger.info('App is ready, initializing...');
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
    logger.info('Initializing database...');
    initializeDatabase(logger);
    logger.info('Initializing IPC handlers...');
    initializeIpcHandlers(logger);
    createWindow(logger);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow(logger);
      }
    });
  } catch (error) {
    logger.error(`[Main] Failed to initialize application: ${error}`);
    app.quit(); // Quit on critical error
  }
});

app.on('window-all-closed', () => {
  const logger = getLogger();
  logger.info('All windows closed, quitting application...');
  if (process.platform !== 'darwin') {
    getDb().close();
    app.quit();
  }
});