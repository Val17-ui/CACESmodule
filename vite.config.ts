import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    electron({
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
    }),
  ],
  build: {
    // Configuration pour le processus de rendu (votre application React)
    outDir: 'dist',
    assetsDir: 'assets',
  },
});