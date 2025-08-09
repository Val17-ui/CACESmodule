import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import path from 'path';
import analyze from 'rollup-plugin-analyzer';
import alias from '@rollup/plugin-alias';

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/index.ts',
        vite: {
          build: {
            outDir: 'dist-electron/electron',
            rollupOptions: {
              external: [
                'electron',
                'better-sqlite3',
                'node-cron',
                'serialport',
                'jszip',
                'fast-xml-parser',
                'image-size',
              ],
              output: {
                format: 'cjs',
                entryFileNames: '[name].js',
                chunkFileNames: 'chunks/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash][extname]',
                preserveModules: true,
                preserveModulesRoot: 'electron',
              },
              plugins: [
                alias({
                  entries: {
                    '@electron': path.resolve(__dirname, 'electron'),
                    '@common': path.resolve(__dirname, 'common'),
                    '@types': path.resolve(__dirname, 'common/types'),
                  },
                }),
                analyze({ summaryOnly: false, limit: 20 }),
              ],
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        vite: {
          build: {
            outDir: 'dist-electron/electron',
            rollupOptions: {
              output: {
                format: 'cjs',
                entryFileNames: '[name].js',
                chunkFileNames: 'chunks/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash][extname]',
                preserveModules: true,
                preserveModulesRoot: 'electron',
              },
              plugins: [
                alias({
                  entries: {
                    '@electron': path.resolve(__dirname, 'electron'),
                    '@common': path.resolve(__dirname, 'common'),
                    '@types': path.resolve(__dirname, 'common/types'),
                  },
                }),
                analyze({ summaryOnly: false, limit: 20 }),
              ],
            },
          },
        },
      },
    ]),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@electron': path.resolve(__dirname, 'electron'),
      '@common': path.resolve(__dirname, 'common'),
      '@types': path.resolve(__dirname, 'common/types'),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
  },
});