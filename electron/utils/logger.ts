// electron/utils/logger.ts
import fs from 'fs';
import path from 'path';
import { app, ipcMain } from 'electron';

let logFile: string;

export function initializeLogging() {
  const logDirectory = path.join(app.getPath('userData'), 'logs');
  if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
  }

  logFile = path.join(logDirectory, `log-${new Date().toISOString().replace(/:/g, '-')}.txt`);

  ipcMain.on('log', (event, message) => {
    log(message);
  });
}

export function log(message: string) {
  if (!logFile) {
    return;
  }
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] ${message}\n`;

  console.log(formattedMessage); // Continue d'afficher dans la console pour le débogage en direct

  fs.appendFile(logFile, formattedMessage, (err) => {
    if (err) {
      console.error('Failed to write to log file:', err);
    }
  });
}
