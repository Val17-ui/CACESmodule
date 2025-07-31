import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/index.ts',
        vite: {
          build: {
            outDir: 'dist-electron/electron',
            lib: {
              entry: 'electron/index.ts',
              formats: ['cjs'],
              fileName: () => 'index.cjs',
            },
            rollupOptions: {
              external: ['electron', 'better-sqlite3'],
            },
          },
          resolve: {
            alias: {
              '@src': path.resolve(__dirname, 'src'),
              '@electron': path.resolve(__dirname, 'electron'),
              '@types': path.resolve(__dirname, 'src/types'),
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        vite: {
          build: {
            outDir: 'dist-electron/preload',
            lib: {
              entry: 'electron/preload.ts',
              formats: ['es'],
              fileName: () => 'preload.mjs',
            },
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
    ]),
  ],
  resolve: {
    alias: {
      '@src': path.resolve(__dirname, 'src'),
      '@electron': path.resolve(__dirname, 'electron'),
    },
  },
  build: {
    outDir: 'dist/renderer',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return id.toString().split('node_modules/')[1].split('/')[0].toString();
          }
        },
      },
    },
  },
});