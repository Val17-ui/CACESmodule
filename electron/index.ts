import { app, BrowserWindow } from 'electron';
import path from 'path';
import { initializeIpcHandlers } from './ipcHandlers';
import { initializeDatabase } from '../src/db'; // Import statique
import { fileURLToPath } from 'url';

// Définition manuelle et correcte de __dirname pour les modules ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// La variable `VITE_DEV_SERVER_URL` est injectée par `vite-plugin-electron`.
declare const VITE_DEV_SERVER_URL: string;
declare const VITE_NAME: string;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // Utilisation de notre __dirname corrigé
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Test de l'API de notification
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('main-process-message', (new Date).toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // Ouvrir les DevTools en mode développement
  if (!app.isPackaged) {
    win.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  // Initialiser la DB une fois que l'app est prête
  initializeDatabase();

  // Initialiser les gestionnaires IPC
  initializeIpcHandlers();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
