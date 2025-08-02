import { app, BrowserWindow, session } from 'electron';
import path from 'path';
import { initializeIpcHandlers } from './ipcHandlers';
import { initializeDatabase, getDb } from './db';
import { initializeLogger, getLogger } from './utils/logger';

import { ILogger } from './utils/logger';

function createWindow(logger: ILogger) {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    logger.debug('[Main] Loading dev server URL: ' + process.env.VITE_DEV_SERVER_URL);
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    // Chemin corrigé pour pointer vers dist/renderer/index.html
    const indexPath = path.join(__dirname, '../../dist/renderer/index.html');
    logger.debug(`[Main] Loading index.html from: ${indexPath}`);
    win.loadFile(indexPath);
  }
}

app.whenReady().then(async () => {
  initializeLogger();
  const logger = getLogger();
  logger.info('App is ready, initializing...');
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
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
    await initializeDatabase(logger);
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
    app.quit();
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