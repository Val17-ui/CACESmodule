import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        // Point d'entrée pour le processus principal d'Electron
        entry: 'electron/index.ts',
        vite: {
          define: {
            'VITE_DEV_SERVER_URL': JSON.stringify(process.env.VITE_DEV_SERVER_URL)
          },
          build: {
            // Indiquer à Vite de ne pas bundler `better-sqlite3`
            // et de le traiter comme une dépendance externe.
            // C'est crucial pour les modules natifs.
            rollupOptions: {
              external: ['better-sqlite3'],
            },
          },
        },
      },
      preload: {
        // Point d'entrée pour le script de préchargement
        input: path.join(__dirname, 'electron/preload.ts'),
      },
    }),
    renderer(),
  ],
  optimizeDeps: {
    // Exclure également `better-sqlite3` de l'optimisation des dépendances de Vite.
    exclude: ['lucide-react', 'better-sqlite3'],
  },
  build: {
    sourcemap: false
  }
});