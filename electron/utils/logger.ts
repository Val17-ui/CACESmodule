import fs from 'fs';
import path from 'path';
import { app, ipcMain } from 'electron';

export interface ILogger {
  info(message: string): void;
  debug(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

let _loggerInstance: Logger | null = null;
let _logFilePath: string | undefined;

class Logger implements ILogger {
  public info(message: string) { this.writeToLogFile('INFO', message); }
  public debug(message: string) { this.writeToLogFile('DEBUG', message); }
  public warn(message: string) { this.writeToLogFile('WARN', message); }
  public error(message: string) { this.writeToLogFile('ERROR', message); }

  private writeToLogFile(level: string, message: string) {
    if (!_logFilePath) {
      console.error('Logger not initialized. Log file path is not set. Message:', message);
      return;
    }
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level}] ${message}\n`;

    console.log(formattedMessage); // Always log to console for live debugging
    console.log(`Attempting to write to log file: ${_logFilePath}`); // Add this line

    fs.appendFile(_logFilePath, formattedMessage, (err) => {
      if (err) {
        console.error(`Failed to write to log file ${_logFilePath}:`, err);
        console.error('Error object details:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
      } else {
        console.log(`Successfully wrote to log file: ${_logFilePath}`);
      }
    });
  }
}

export function initializeLogger() {
  if (_loggerInstance) {
    console.warn('Logger already initialized.');
    return;
  }
  _loggerInstance = new Logger();
  const logDirectory = path.join(app.getPath('userData'), 'logs');
  console.log(`[Logger Init] Log directory: ${logDirectory}`);
  if (!fs.existsSync(logDirectory)) {
    try {
      fs.mkdirSync(logDirectory, { recursive: true });
      console.log(`[Logger Init] Log directory created: ${logDirectory}`);
    } catch (err) {
      console.error(`[Logger Init] Failed to create log directory ${logDirectory}:`, err);
    }
  }
  _logFilePath = path.join(logDirectory, `log-${new Date().toISOString().replace(/:/g, '-')}.txt`);
  console.log(`[Logger Init] Log file path: ${_logFilePath}`);

  // Set up IPC handlers for renderer process logs
  ipcMain.on('log:info', (event, message) => { _loggerInstance?.info(message); });
  ipcMain.on('log:debug', (event, message) => { _loggerInstance?.debug(message); });
  ipcMain.on('log:warn', (event, message) => { _loggerInstance?.warn(message); });
  ipcMain.on('log:error', (event, message) => { _loggerInstance?.error(message); });
}

export function getLogger(): ILogger {
  if (!_loggerInstance) {
    // This should ideally not happen if initializeLogger is called early enough
    console.error('Logger not initialized. Returning a dummy logger.');
    return {
      info: (msg: string) => console.log(`[DUMMY INFO] ${msg}`),
      debug: (msg: string) => console.log(`[DUMMY DEBUG] ${msg}`),
      warn: (msg: string) => console.warn(`[DUMMY WARN] ${msg}`),
      error: (msg: string) => console.error(`[DUMMY ERROR] ${msg}`),
    };
  }
  return _loggerInstance;
}