// electron/utils/logger.ts
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

const logDirectory = path.join(app.getPath('userData'), 'logs');
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory, { recursive: true });
}

const logFile = path.join(logDirectory, `log-${new Date().toISOString().replace(/:/g, '-')}.txt`);

export function log(message: string) {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] ${message}\n`;

  console.log(formattedMessage); // Continue d'afficher dans la console pour le débogage en direct

  fs.appendFile(logFile, formattedMessage, (err) => {
    if (err) {
      console.error('Failed to write to log file:', err);
    }
  });
}
