// src/utils/newLogger.ts
import { format } from 'date-fns';

export type LogLevel = 'info' | 'warn' | 'error' | 'success';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  details?: unknown;
}

class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private maxSize = 5 * 1024 * 1024; // 5MB
  private currentSize = 0;

  private constructor() {}

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatTimestamp(): string {
    return format(new Date(), 'yyyy-MM-dd HH:mm:ss');
  }

  private createLogEntry(level: LogLevel, message: string, details?: unknown): LogEntry {
    return {
      timestamp: this.formatTimestamp(),
      level,
      message,
      details,
    };
  }

  private addLog(entry: LogEntry): void {
    const logString = JSON.stringify(entry);
    this.currentSize += logString.length;

    if (this.currentSize > this.maxSize) {
      // Remove oldest logs until under max size
      while (this.currentSize > this.maxSize && this.logs.length > 0) {
        const removed = this.logs.shift();
        if (removed) {
          this.currentSize -= JSON.stringify(removed).length;
        }
      }
    }

    this.logs.push(entry);
    // This will be handled by the store
    // useLogStore.getState().fetchLogs();
    this.persistLog(entry);
  }

  private persistLog(entry: LogEntry): void {
    // In a real implementation, this would write to a file
    switch (entry.level) {
      case 'info':
        window.electronAPI.info(`${entry.message} ${entry.details ? JSON.stringify(entry.details) : ''}`);
        break;
      case 'warn':
        window.electronAPI.warn(`${entry.message} ${entry.details ? JSON.stringify(entry.details) : ''}`);
        break;
      case 'error':
        window.electronAPI.error(`${entry.message} ${entry.details ? JSON.stringify(entry.details) : ''}`);
        break;
      case 'success':
        // For SUCCESS, we can log as INFO or create a specific handler if needed
        window.electronAPI.info(`${entry.message} ${entry.details ? JSON.stringify(entry.details) : ''}`);
        break;
      default:
        window.electronAPI.info(`${entry.level}: ${entry.message} ${entry.details ? JSON.stringify(entry.details) : ''}`);
    }
  }

  public info(message: string, details?: unknown): void {
    this.addLog(this.createLogEntry('info', message, details));
  }

  public warning(message: string, details?: unknown): void {
    this.addLog(this.createLogEntry('warn', message, details));
  }

  public error(message: string, details?: unknown): void {
    this.addLog(this.createLogEntry('error', message, details));
  }

  public success(message: string, details?: unknown): void {
    this.addLog(this.createLogEntry('success', message, details));
  }

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  public exportLogs(): string {
    return this.logs
      .map(log => `${log.timestamp} | ${log.level} | ${log.message}`)
      .join('\n');
  }

  public clearLogs(): void {
    this.logs = [];
    this.currentSize = 0;
  }
}

export const logger = Logger.getInstance();
