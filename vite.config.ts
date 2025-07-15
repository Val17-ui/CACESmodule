import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/index.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['better-sqlite3'],
              input: {
                main: 'electron/index.ts',
                ipcHandlers: 'electron/ipcHandlers.ts', // <-- Ajoute cette ligne
              },
              output: {
                entryFileNames: '[name].js', // Génère index.js et ipcHandlers.js
                format: 'cjs',
              },
            },
            commonjsOptions: {
              ignoreDynamicRequires: true,
            },
          },
          esbuild: {
            format: 'cjs',
          },
        },
      },
      {
        entry: path.join(__dirname, 'electron/preload.ts'),
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['better-sqlite3'],
              output: {
                format: 'cjs',
              },
            },
          },
        },
      }
    ]),
    renderer(),
  ],
  optimizeDeps: {},
  build: {
    sourcemap: false,
    rollupOptions: {
      input: 'index.html',
    },
    outDir: 'dist',
    assetsDir: 'assets',
  },
});