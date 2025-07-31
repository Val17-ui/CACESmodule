import { app, BrowserWindow, session } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeIpcHandlers } from './ipcHandlers';
import { initializeDatabase, getDb } from './db';
import { initializeLogger, getLogger } from './utils/logger';

initializeLogger();
const logger = getLogger();
logger.debug('[Electron Main] Starting Electron main process.');






// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  logger.debug('[Electron Main] All windows closed. Quitting app.');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  logger.debug('[Electron Main] App activated. Checking for open windows.');
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow(logger);
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.


import { ILogger } from './utils/logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow(logger: ILogger) {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(app.getAppPath(), 'dist-electron', 'preload', 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(async () => {
  
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
    
  } catch (error) {
    logger.error(`[Main] Failed to initialize application: ${error}`);
    app.quit();
  }
});

app.on('window-all-closed', () => {

  logger.info('All windows closed, quitting application...');
  if (process.platform !== 'darwin') {
    getDb().close();
    app.quit();
  }
});