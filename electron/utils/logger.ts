import fs from 'fs';
import path from 'path';
import { app, ipcMain, IpcMainEvent } from 'electron';

export interface ILogger {
  info(message: string): void;
  debug(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

let _loggerInstance: Logger | null = null;
let _logFilePath: string | undefined;
let _logStream: fs.WriteStream | null = null; // Use a persistent write stream

class Logger implements ILogger {
  public info(message: string) { this.writeToLogFile('INFO', message); }
  public debug(message: string) { this.writeToLogFile('DEBUG', message); }
  public warn(message: string) { this.writeToLogFile('WARN', message); }
  public error(message: string) { this.writeToLogFile('ERROR', message); }

  private writeToLogFile(level: string, message: string) {
    if (!_logStream) {
      console.error('Logger not initialized. Log stream is not available. Message:', message);
      return;
    }
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level}] ${message}\n`;

    console.log(formattedMessage); // Always log to console for live debugging

    // Write to the persistent stream
    _logStream.write(formattedMessage, (err) => {
      if (err) {
        // Avoid using the logger here to prevent a potential infinite loop
        console.error(`Failed to write to log file ${_logFilePath}:`, err);
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
      // If we can't create the directory, we can't create the log file, so we stop.
      return;
    }
  }

  _logFilePath = path.join(logDirectory, `log-${new Date().toISOString().replace(/:/g, '-')}.txt`);
  console.log(`[Logger Init] Log file path: ${_logFilePath}`);

  // Create a writable stream in append mode
  _logStream = fs.createWriteStream(_logFilePath, { flags: 'a' });

  _logStream.on('error', (err) => {
    console.error(`[Logger] Log stream error:`, err);
  });

  // Ensure the stream is closed when the application quits
  app.on('will-quit', () => {
    if (_logStream) {
      console.log('[Logger] Closing log stream.');
      _logStream.end();
      _logStream = null;
    }
  });

  // Set up IPC handlers for renderer process logs
  ipcMain.on('log:info', (event: IpcMainEvent, message: string) => { _loggerInstance?.info(message); });
  ipcMain.on('log:debug', (event: IpcMainEvent, message: string) => { _loggerInstance?.debug(message); });
  ipcMain.on('log:warn', (event: IpcMainEvent, message: string) => { _loggerInstance?.warn(message); });
  ipcMain.on('log:error', (event: IpcMainEvent, message: string) => { _loggerInstance?.error(message); });
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