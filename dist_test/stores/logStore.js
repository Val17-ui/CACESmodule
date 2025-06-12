import { create } from 'zustand';
import { logger } from '../utils/logger';
export const useLogStore = create((set) => ({
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
