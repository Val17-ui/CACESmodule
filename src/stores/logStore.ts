import { create } from 'zustand';
import { logger, LogEntry } from '../utils/logger';

interface LogStore {
  logs: LogEntry[];
  isLogViewerOpen: boolean;
  fetchLogs: () => void;
  openLogViewer: () => void;
  closeLogViewer: () => void;
  exportLogs: () => string;
  clearLogs: () => void;
}

export const useLogStore = create<LogStore>((set) => ({
  logs: [],
  isLogViewerOpen: false,
  fetchLogs: () => set({ logs: logger.getLogs() }),
  openLogViewer: () => set({ isLogViewerOpen: true }),
  closeLogViewer: () => set({ isLogViewerOpen: false }),
  exportLogs: () => logger.exportLogs(),
  clearLogs: () => {
    logger.clearLogs();
    set({ logs: [] });
  },
}));