import { contextBridge, ipcRenderer } from 'electron';
import type { Session, Referential, Trainer, Theme, Bloc, QuestionWithId } from '../src/types'; // Chemin corrigé pour pointer vers src/

// Exposer un objet global `window.dbAPI` au processus de rendu
// avec les fonctions que nous voulons rendre disponibles.
contextBridge.exposeInMainWorld('dbAPI', {
  // Pour les sessions
  getAllSessions: (): Promise<Session[]> => ipcRenderer.invoke('db-get-all-sessions'),
  getSessionById: (id: number): Promise<Session | undefined> => ipcRenderer.invoke('db-get-session-by-id', id),

  // Pour les référentiels (basé sur les exemples dans ipcHandlers.ts)
  addReferential: (data: Omit<Referential, 'id'>): Promise<number | undefined> => ipcRenderer.invoke('db-add-referential', data),
  getAllReferentiels: (): Promise<Referential[]> => ipcRenderer.invoke('db-get-all-referentiels'),

  // Pour les trainers (basé sur les exemples dans ipcHandlers.ts)
  getAllTrainers: (): Promise<Trainer[]> => ipcRenderer.invoke('db-get-all-trainers'),

  // Referentiels
  getReferentialByCode: (code: string): Promise<Referential | undefined> => ipcRenderer.invoke('db-get-referential-by-code', code),
  getReferentialById: (id: number): Promise<Referential | undefined> => ipcRenderer.invoke('db-get-referential-by-id', id),
  // addReferential et getAllReferentiels sont déjà là

  // Themes
  addTheme: (data: Omit<Theme, 'id'>): Promise<number | undefined> => ipcRenderer.invoke('db-add-theme', data),
  getThemeByCodeAndReferentialId: (code: string, refId: number): Promise<Theme | undefined> => ipcRenderer.invoke('db-get-theme-by-code-and-referential-id', code, refId),
  getThemesByReferentialId: (refId: number): Promise<Theme[]> => ipcRenderer.invoke('db-get-themes-by-referential-id', refId),
  getThemeById: (id: number): Promise<Theme | undefined> => ipcRenderer.invoke('db-get-theme-by-id', id),
  getAllThemes: (): Promise<Theme[]> => ipcRenderer.invoke('db-get-all-themes'),

  // Blocs
  addBloc: (data: Omit<Bloc, 'id'>): Promise<number | undefined> => ipcRenderer.invoke('db-add-bloc', data),
  getBlocByCodeAndThemeId: (code: string, themeId: number): Promise<Bloc | undefined> => ipcRenderer.invoke('db-get-bloc-by-code-and-theme-id', code, themeId),
  getBlocsByThemeId: (themeId: number): Promise<Bloc[]> => ipcRenderer.invoke('db-get-blocs-by-theme-id', themeId),
  getBlocById: (id: number): Promise<Bloc | undefined> => ipcRenderer.invoke('db-get-bloc-by-id', id),
  getAllBlocs: (): Promise<Bloc[]> => ipcRenderer.invoke('db-get-all-blocs'),

  // Questions
  addQuestion: (data: Omit<QuestionWithId, 'id'>): Promise<number | undefined> => ipcRenderer.invoke('db-add-question', data),
  getQuestionById: (id: number): Promise<QuestionWithId | undefined> => ipcRenderer.invoke('db-get-question-by-id', id),
  getQuestionsByBlocId: (blocId: number): Promise<QuestionWithId[]> => ipcRenderer.invoke('db-get-questions-by-bloc-id', blocId),
  updateQuestion: (id: number, updates: Partial<Omit<QuestionWithId, 'id'>>): Promise<number | undefined> => ipcRenderer.invoke('db-update-question', id, updates),
  deleteQuestion: (id: number): Promise<void> => ipcRenderer.invoke('db-delete-question', id),
  getAllQuestions: (): Promise<QuestionWithId[]> => ipcRenderer.invoke('db-get-all-questions'),
  getQuestionsByIds: (ids: number[]): Promise<QuestionWithId[]> => ipcRenderer.invoke('db-get-questions-by-ids', ids),
  getQuestionsForSessionBlocks: (blocIds?: number[]): Promise<QuestionWithId[]> => ipcRenderer.invoke('db-get-questions-for-session-blocks', blocIds),

  // AdminSettings
  getAdminSetting: (key: string): Promise<any> => ipcRenderer.invoke('db-get-admin-setting', key),
  setAdminSetting: (key: string, value: any): Promise<void> => ipcRenderer.invoke('db-set-admin-setting', key, value),
  getAllAdminSettings: (): Promise<{ key: string; value: any }[]> => ipcRenderer.invoke('db-get-all-admin-settings'),

  // N'oubliez pas d'ajouter les autres fonctions CRUD pour les autres entités au fur et à mesure
  // (SessionResults, VotingDevices, sessionQuestions, sessionBoitiers,
  // deviceKits, deviceKitAssignments, etc.)
  // Et mettre à jour le fichier de déclaration de types (renderer.d.ts) en conséquence.
});

console.log('[Preload Script] Context bridge for dbAPI initialized.');

// Il est aussi courant de définir des types pour l'API exposée
// pour une meilleure autocomplétion dans le code du renderer.
// Par exemple, dans un fichier `renderer.d.ts` ou similaire :
//
// declare global {
//   interface Window {
//     dbAPI: {
//       getAllSessions: () => Promise<Session[]>;
//       getSessionById: (id: number) => Promise<Session | undefined>;
//       addReferential: (data: Omit<Referential, 'id'>) => Promise<number | undefined>;
//       getAllReferentiels: () => Promise<Referential[]>;
//       getAllTrainers: () => Promise<Trainer[]>;
//       // ... autres types de fonctions
//     };
//   }
// }
// export {}; // Nécessaire si le fichier ne contient que des déclarations globales
//
// Assurez-vous que ce fichier de déclaration de types est inclus dans votre tsconfig.json (généralement via "include").
