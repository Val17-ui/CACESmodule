import { contextBridge, ipcRenderer } from 'electron';

// Exposer des API sûres au processus de rendu
contextBridge.exposeInMainWorld('electronAPI', {
  // Exemple d'une fonction que le renderer peut appeler
  // Elle enverra un message au processus principal et attendra une réponse
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),

  // Vous pouvez également exposer des fonctions spécifiques ici pour plus de clarté
  // Par exemple:
  // insertParticipant: (nom: string) => ipcRenderer.invoke('insert-participant', nom),
  // getVersion: () => ipcRenderer.invoke('get-app-version')

  // Si vous avez besoin d'écouter des événements envoyés par le processus principal (main-to-renderer)
  // on: (channel: string, func: (...args: any[]) => void) => {
  //   // Supprimer les écouteurs potentiels pour éviter les fuites de mémoire et les appels multiples
  //   ipcRenderer.removeAllListeners(channel);
  //   ipcRenderer.on(channel, (event, ...args) => func(...args));
  // }
});

console.log('Preload script chargé.');
