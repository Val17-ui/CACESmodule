import { create } from 'zustand';

type SessionStore = {
  isCreating: boolean;
  sessionToImport: File | null;
  startCreating: () => void;
  startImporting: (file: File) => void;
  reset: () => void;
};

export const useSessionStore = create<SessionStore>((set) => ({
  isCreating: false,
  sessionToImport: null,
  startCreating: () => set({ isCreating: true, sessionToImport: null }),
  startImporting: (file) => set({ isCreating: true, sessionToImport: file }),
  reset: () => set({ isCreating: false, sessionToImport: null }),
}));
