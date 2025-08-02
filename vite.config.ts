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
              output: {
                entryFileNames: 'index.cjs',
                chunkFileNames: '[name].cjs',
                assetFileNames: '[name].[ext]',
              },
            },
          },
          resolve: {
            alias: {
              '@src': path.resolve(__dirname, 'src'),
              '@electron': path.resolve(__dirname, 'electron'),
              '@types': path.resolve(__dirname, 'src/types'),
              '@electron/utils': path.resolve(__dirname, 'electron/utils'),
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        vite: {
          build: {
            outDir: 'dist-electron/electron',
            lib: {
              entry: 'electron/preload.ts',
              formats: ['cjs'],
              fileName: () => 'preload.cjs',
            },
            rollupOptions: {
              external: ['electron'],
              output: {
                entryFileNames: 'preload.cjs',
                chunkFileNames: '[name].cjs',
                assetFileNames: '[name].[ext]',
              },
            },
          },
          resolve: {
            alias: {
              '@electron': path.resolve(__dirname, 'electron'),
              '@electron/utils': path.resolve(__dirname, 'electron/utils'),
            },
          },
        },
      },
      {
        entry: 'electron/ipcHandlers.ts',
        vite: {
          build: {
            outDir: 'dist-electron/electron',
            lib: {
              entry: 'electron/ipcHandlers.ts',
              formats: ['cjs'],
              fileName: () => 'ipcHandlers.cjs',
            },
            rollupOptions: {
              external: ['electron', 'better-sqlite3'],
              output: {
                entryFileNames: 'ipcHandlers.cjs',
                chunkFileNames: '[name].cjs',
                assetFileNames: '[name].[ext]',
              },
            },
          },
          resolve: {
            alias: {
              '@electron': path.resolve(__dirname, 'electron'),
              '@electron/utils': path.resolve(__dirname, 'electron/utils'),
            },
          },
        },
      },
      {
        entry: 'electron/utils/pptxOrchestrator.ts',
        vite: {
          build: {
            outDir: 'dist-electron/electron/utils',
            lib: {
              entry: 'electron/utils/pptxOrchestrator.ts',
              formats: ['cjs'],
              fileName: () => 'pptxOrchestrator.cjs',
            },
            rollupOptions: {
              external: ['electron', 'better-sqlite3', 'jszip', 'fast-xml-parser', 'image-size'],
              output: {
                entryFileNames: 'pptxOrchestrator.cjs',
                chunkFileNames: '[name].cjs',
                assetFileNames: '[name].[ext]',
              },
            },
          },
          resolve: {
            alias: {
              '@electron': path.resolve(__dirname, 'electron'),
              '@electron/utils': path.resolve(__dirname, 'electron/utils'),
            },
          },
        },
      },
      {
        entry: 'electron/utils/val17PptxGenerator.ts',
        vite: {
          build: {
            outDir: 'dist-electron/electron/utils',
            lib: {
              entry: 'electron/utils/val17PptxGenerator.ts',
              formats: ['cjs'],
              fileName: () => 'val17PptxGenerator.cjs',
            },
            rollupOptions: {
              external: ['electron', 'better-sqlite3', 'jszip', 'fast-xml-parser', 'image-size'],
              output: {
                entryFileNames: 'val17PptxGenerator.cjs',
                chunkFileNames: '[name].cjs',
                assetFileNames: '[name].[ext]',
              },
            },
          },
          resolve: {
            alias: {
              '@electron': path.resolve(__dirname, 'electron'),
              '@electron/utils': path.resolve(__dirname, 'electron/utils'),
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
      '@types': path.resolve(__dirname, 'src/types'),
      '@electron/utils': path.resolve(__dirname, 'electron/utils'),
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