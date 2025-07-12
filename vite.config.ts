import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // Point d'entrée pour le processus principal d'Electron
        entry: 'electron/index.ts',
      },
      {
        // Point d'entrée pour le script de préchargement
        entry: 'electron/preload.ts',
        onstart(options) {
          // Ce script de préchargement sera injecté dans le processus de rendu
          // et s'exécutera avant le chargement de la page web.
          options.reload();
        },
      },
    ]),
    renderer(),
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    sourcemap: false
  }
});