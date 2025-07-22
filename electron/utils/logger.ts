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
    logger.info(message);
  });
}

function writeToLogFile(level: string, message: string) {
  if (!logFile) {
    return;
  }
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] [${level}] ${message}\n`;

  console.log(formattedMessage); // Always log to console for live debugging

  fs.appendFile(logFile, formattedMessage, (err) => {
    if (err) {
      console.error('Failed to write to log file:', err);
    }
  });
}

export const logger = {
  info: (message: string) => writeToLogFile('INFO', message),
  debug: (message: string) => writeToLogFile('DEBUG', message),
  error: (message: string) => writeToLogFile('ERROR', message),
};
