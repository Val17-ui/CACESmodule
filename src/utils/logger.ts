import { format } from 'date-fns';
import { useLogStore } from '../stores/logStore';

export type LogLevel = 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';

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
    useLogStore.getState().fetchLogs();
    this.persistLog(entry);
  }

  private persistLog(entry: LogEntry): void {
    // In a real implementation, this would write to a file
    console.log(`${entry.timestamp} | ${entry.level} | ${entry.message}`);
  }

  public info(message: string, details?: unknown): void {
    this.addLog(this.createLogEntry('INFO', message, details));
  }

  public warning(message: string, details?: unknown): void {
    this.addLog(this.createLogEntry('WARNING', message, details));
  }

  public error(message: string, details?: unknown): void {
    this.addLog(this.createLogEntry('ERROR', message, details));
  }

  public success(message: string, details?: unknown): void {
    this.addLog(this.createLogEntry('SUCCESS', message, details));
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