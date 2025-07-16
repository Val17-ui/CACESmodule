import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // Point d'entrée pour le processus principal d'Electron
        entry: 'electron/index.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['better-sqlite3'],
            },
          },
        },
      },
      {
        // Point d'entrée pour le script de preload
        entry: path.join(__dirname, 'electron/preload.ts'),
        vite: {
          build: {
            outDir: 'dist-electron',
          },
        },
      },
      {
        // Point d'entrée pour le module de base de données
        entry: 'electron/db.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['better-sqlite3'],
            },
          },
        },
      },
      {
        // Point d'entrée pour les gestionnaires IPC
        entry: 'electron/ipcHandlers.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
          },
        },
      },
    ]),
  ],
  build: {
    // Configuration pour le processus de rendu (votre application React)
    outDir: 'dist',
    assetsDir: 'assets',
  },
});