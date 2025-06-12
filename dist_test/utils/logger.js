import { format } from 'date-fns';
import { useLogStore } from '../stores/logStore';
class Logger {
    constructor() {
        Object.defineProperty(this, "logs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "maxSize", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 5 * 1024 * 1024
        }); // 5MB
        Object.defineProperty(this, "currentSize", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
    }
    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }
    formatTimestamp() {
        return format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    }
    createLogEntry(level, message, details) {
        return {
            timestamp: this.formatTimestamp(),
            level,
            message,
            details,
        };
    }
    addLog(entry) {
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
    persistLog(entry) {
        // In a real implementation, this would write to a file
        console.log(`${entry.timestamp} | ${entry.level} | ${entry.message}`);
    }
    info(message, details) {
        this.addLog(this.createLogEntry('INFO', message, details));
    }
    warning(message, details) {
        this.addLog(this.createLogEntry('WARNING', message, details));
    }
    error(message, details) {
        this.addLog(this.createLogEntry('ERROR', message, details));
    }
    success(message, details) {
        this.addLog(this.createLogEntry('SUCCESS', message, details));
    }
    getLogs() {
        return [...this.logs];
    }
    exportLogs() {
        return this.logs
            .map(log => `${log.timestamp} | ${log.level} | ${log.message}`)
            .join('\n');
    }
    clearLogs() {
        this.logs = [];
        this.currentSize = 0;
    }
}
export const logger = Logger.getInstance();
