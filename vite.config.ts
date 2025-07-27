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
        entry: 'electron/index.ts', // Changement ici: fichier source
        vite: {
          build: {
            outDir: 'dist-electron/electron', // Répertoire de sortie pour le processus principal
            lib: {
              entry: 'electron/index.ts', // Fichier source pour le processus principal
              formats: ['cjs'], // Sortie en CommonJS
              fileName: () => 'index.js', // Nom du fichier de sortie
            },
            rollupOptions: {
              // Externaliser les modules Node.js et autres dépendances
              external: ['electron', 'better-sqlite3', 'path', 'fs', 'jszip', 'image-size'],
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
    ]),
  ],
  build: {
    // Configuration pour le processus de rendu (votre application React)
    outDir: 'dist',
    assetsDir: 'assets',
  },
});