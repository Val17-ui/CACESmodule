// Ce fichier sera utilisé pour la logique du frontend de votre application.
// Il s'exécute dans le processus de rendu (la fenêtre du navigateur).

console.log('Renderer process script loaded.');

// Exemple : Interagir avec le DOM et l'API Electron après le chargement de la page
window.addEventListener('DOMContentLoaded', async () => {
  const titleElement = document.getElementById('app-title');
  if (titleElement) {
    titleElement.textContent = 'EasyCertif - Bureau (IPC Ready)';
  }

  // Exemple d'appel IPC pour insérer un participant
  try {
    const participantName = `Utilisateur Test ${Date.now()}`;
    console.log(`Renderer: Tentative d'insertion du participant: "${participantName}"`);
    // Note: window.electronAPI est défini par src/preload.ts
    const newParticipantId = await window.electronAPI.invoke('insert-participant', participantName);
    console.log(`Renderer: Participant inséré avec succès. ID: ${newParticipantId}`);

    const statusElement = document.createElement('p');
    statusElement.textContent = `Participant "${participantName}" (ID: ${newParticipantId}) ajouté via IPC.`;
    document.body.appendChild(statusElement);

  } catch (error) {
    console.error('Renderer: Erreur lors de l\'appel IPC insert-participant:', error);
    const errorElement = document.createElement('p');
    errorElement.textContent = `Erreur IPC: ${error instanceof Error ? error.message : String(error)}`;
    errorElement.style.color = 'red';
    document.body.appendChild(errorElement);
  }
});
