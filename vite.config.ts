import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // Point d'entre pour le processus principal d'Electron
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
        // Point d'entre pour le script de preload
        entry: path.join(__dirname, 'electron/preload.ts'),
        vite: {
          build: {
            outDir: 'dist-electron',
          },
        },
      },
      {
        // Point d'entre pour le module de base de donnes
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
        // Point d'entre pour le module de gestion des IPC
        entry: 'electron/ipcHandlers.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['better-sqlite3'],
            },
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