import { app, BrowserWindow } from 'electron';
import path from 'path';
import { initializeIpcHandlers } from './ipcHandlers';
import { fileURLToPath } from 'url';

// Correction pour __dirname en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// La variable `VITE_DEV_SERVER_URL` est injectée par `vite-plugin-electron`.
// Voir https://vite-plugin-electron.vercel.app/guide/troubleshooting.html#vite-is-not-defined
declare const VITE_DEV_SERVER_URL: string;
declare const VITE_NAME: string;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
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
    // Le chemin doit pointer vers la sortie du build du renderer (dans le répertoire `dist`)
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // Ouvrir les DevTools en mode développement
  if (!app.isPackaged) {
    win.webContents.openDevTools();
  }
}

app.whenReady().then(async () => {
  // Il est crucial d'attendre que l'application soit prête avant d'initialiser la DB.
  // Utilisation d'un import dynamique pour s'assurer que le code de la DB n'est
  // exécuté qu'à ce moment précis.
  try {
    const { initializeDatabase } = await import('../src/db.js');
    initializeDatabase();
  } catch (error) {
    console.error("Failed to initialize database on app ready:", error);
    // On peut choisir de quitter l'application si la DB est critique
    // app.quit();
    // return;
  }

  createWindow();
  initializeIpcHandlers(); // Initialiser nos gestionnaires IPC

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
