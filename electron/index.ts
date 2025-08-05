import { app, BrowserWindow, session } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeIpcHandlers } from '@electron/ipcHandlers';
import { initializeDatabase, getDb, setAdminSetting } from '@electron/db';
import { initializeLogger, getLogger } from '@electron/utils/logger';
import { generatePPTXVal17 } from '@electron/utils/val17PptxGenerator';
import fs from 'fs';
import { generatePresentation } from '@electron/utils/pptxOrchestrator';

import { ILogger } from '@electron/utils/logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
function createWindow(logger: ILogger) {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
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
    const indexPath = path.resolve(__dirname, '..', '..', 'dist', 'index.html')
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

    // Load and save the logo to settings after DB is ready
    try {
      const logoPath = path.resolve(__dirname, '..', '..', 'src', 'assets', 'images', 'logo.png');
      logger.info(`[Main] Loading logo from path: ${logoPath}`);
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        const logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
        await setAdminSetting('reportLogoBase64', logoBase64);
        logger.info('[Main] Successfully loaded and saved logo to admin settings.');
      } else {
        logger.warn('[Main] Logo file not found at expected path. Skipping logo setup.');
      }
    } catch (error) {
      logger.error(`[Main] Error loading or saving logo: ${error}`);
    }

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
export { generatePresentation, generatePPTXVal17 };