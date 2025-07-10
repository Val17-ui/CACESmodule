// Ce fichier permet à TypeScript de connaître la forme de l'API exposée par le preload script.
export {}; // Assurez-vous que c'est un module

declare global {
  interface Window {
    electronAPI: {
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      // Si vous avez exposé des fonctions spécifiques dans preload.ts, déclarez-les aussi:
      // insertParticipant: (nom: string) => Promise<number | undefined>;
      // getVersion: () => Promise<string>;
      // on: (channel: string, func: (...args: any[]) => void) => void;
    };
  }
}
