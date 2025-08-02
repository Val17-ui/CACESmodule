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
            target: 'node18',
            outDir: 'dist-electron/electron',
            lib: {
              entry: 'electron/index.ts',
              formats: ['cjs'],
              fileName: () => 'index.cjs',
            },
            rollupOptions: {
              external: ['electron', 'better-sqlite3', 'node-cron', 'serialport'],
            },
          },
          resolve: {
            alias: {
              '@electron': path.resolve(__dirname, 'electron'),
              '@common': path.resolve(__dirname, 'common'),
              '@types': path.resolve(__dirname, 'common/types'),
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        vite: {
          build: {
            target: 'node18',
            outDir: 'dist-electron/electron',
            lib: {
              entry: 'electron/preload.ts',
              formats: ['cjs'],
              fileName: () => 'preload.cjs',
            },
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
      {
        entry: 'electron/utils/val17PptxGenerator.ts',
        vite: {
          build: {
            target: 'node18',
            outDir: 'dist-electron/electron/utils',
            lib: {
              entry: 'electron/utils/val17PptxGenerator.ts',
              formats: ['cjs'],
              fileName: () => 'val17PptxGenerator.cjs',
            },
            rollupOptions: {
              external: ['electron', 'better-sqlite3', 'jszip', 'fast-xml-parser', 'image-size'],
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
      '@common': path.resolve(__dirname, 'common'),
      '@types': path.resolve(__dirname, 'common/types'),
    },
  },
  build: {
    outDir: 'dist/renderer',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
});