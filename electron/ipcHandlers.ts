import { ipcMain } from 'electron';
import * as db from '../src/db'; // Chemin corrigé pour pointer vers src/

export function initializeIpcHandlers() {
  console.log('[IPC Handlers] Initializing IPC handlers...');

  // Handler pour getAllSessions
  ipcMain.handle('db-get-all-sessions', async () => {
    console.log('[IPC Main] Received db-get-all-sessions');
    try {
      const sessions = await db.getAllSessions();
      return sessions;
    } catch (error) {
      console.error('[IPC Main] Error in db-get-all-sessions:', error);
      throw error; // Renvoie l'erreur au processus de rendu
    }
  });

  // Handler pour getSessionById
  ipcMain.handle('db-get-session-by-id', async (event, sessionId: number) => {
    console.log(`[IPC Main] Received db-get-session-by-id for id: ${sessionId}`);
    if (typeof sessionId !== 'number') {
        console.error('[IPC Main] Invalid sessionId received for db-get-session-by-id:', sessionId);
        throw new Error('Invalid sessionId provided.');
    }
    try {
      const session = await db.getSessionById(sessionId);
      return session;
    } catch (error) {
      console.error(`[IPC Main] Error in db-get-session-by-id for id ${sessionId}:`, error);
      throw error;
    }
  });

  // ----- Ajoutez d'autres gestionnaires IPC ici au fur et à mesure -----
  // Exemple pour addReferential (à adapter pour toutes les fonctions CRUD)
  ipcMain.handle('db-add-referential', async (event, referentialData: Omit<db.Referential, 'id'>) => {
    console.log('[IPC Main] Received db-add-referential with data:', referentialData);
    try {
      const newId = await db.addReferential(referentialData);
      return newId;
    } catch (error) {
      console.error('[IPC Main] Error in db-add-referential:', error);
      throw error;
    }
  });

  // getAllReferentiels
  ipcMain.handle('db-get-all-referentiels', async () => {
    console.log('[IPC Main] Received db-get-all-referentiels');
    try {
      return await db.getAllReferentiels();
    } catch (error) {
      console.error('[IPC Main] Error in db-get-all-referentiels:', error);
      throw error;
    }
  });

  // getAllTrainers
  ipcMain.handle('db-get-all-trainers', async () => {
    console.log('[IPC Main] Received db-get-all-trainers');
    try {
      return await db.getAllTrainers();
    } catch (error) {
      console.error('[IPC Main] Error in db-get-all-trainers:', error);
      throw error;
    }
  });

  // Referentiels (addReferential, getAllReferentiels sont déjà là en exemple)
  ipcMain.handle('db-get-referential-by-code', async (event, code: string) => {
    try { return await db.getReferentialByCode(code); } catch (e) { console.error(e); throw e; }
  });
  ipcMain.handle('db-get-referential-by-id', async (event, id: number) => {
    try { return await db.getReferentialById(id); } catch (e) { console.error(e); throw e; }
  });

  // Themes
  ipcMain.handle('db-add-theme', async (event, data: Omit<db.Theme, 'id'>) => {
    try { return await db.addTheme(data); } catch (e) { console.error(e); throw e; }
  });
  ipcMain.handle('db-get-theme-by-code-and-referential-id', async (event, code: string, refId: number) => {
    try { return await db.getThemeByCodeAndReferentialId(code, refId); } catch (e) { console.error(e); throw e; }
  });
  ipcMain.handle('db-get-themes-by-referential-id', async (event, refId: number) => {
    try { return await db.getThemesByReferentialId(refId); } catch (e) { console.error(e); throw e; }
  });
  ipcMain.handle('db-get-theme-by-id', async (event, id: number) => {
    try { return await db.getThemeById(id); } catch (e) { console.error(e); throw e; }
  });
   ipcMain.handle('db-get-all-themes', async () => {
    try { return await db.getAllThemes(); } catch (e) { console.error(e); throw e; }
  });


  // Blocs
  ipcMain.handle('db-add-bloc', async (event, data: Omit<db.Bloc, 'id'>) => {
    try { return await db.addBloc(data); } catch (e) { console.error(e); throw e; }
  });
  ipcMain.handle('db-get-bloc-by-code-and-theme-id', async (event, code: string, themeId: number) => {
    try { return await db.getBlocByCodeAndThemeId(code, themeId); } catch (e) { console.error(e); throw e; }
  });
  ipcMain.handle('db-get-blocs-by-theme-id', async (event, themeId: number) => {
    try { return await db.getBlocsByThemeId(themeId); } catch (e) { console.error(e); throw e; }
  });
  ipcMain.handle('db-get-bloc-by-id', async (event, id: number) => {
    try { return await db.getBlocById(id); } catch (e) { console.error(e); throw e; }
  });
  ipcMain.handle('db-get-all-blocs', async () => {
    try { return await db.getAllBlocs(); } catch (e) { console.error(e); throw e; }
  });

  // Questions
  ipcMain.handle('db-add-question', async (event, data: Omit<db.QuestionWithId, 'id'>) => {
    try { return await db.addQuestion(data); } catch (e) { console.error(e); throw e; }
  });
  ipcMain.handle('db-get-question-by-id', async (event, id: number) => {
    try { return await db.getQuestionById(id); } catch (e) { console.error(e); throw e; }
  });
  ipcMain.handle('db-get-questions-by-bloc-id', async (event, blocId: number) => {
    try { return await db.getQuestionsByBlocId(blocId); } catch (e) { console.error(e); throw e; }
  });
  ipcMain.handle('db-update-question', async (event, id: number, updates: Partial<Omit<db.QuestionWithId, 'id'>>) => {
    try { return await db.updateQuestion(id, updates); } catch (e) { console.error(e); throw e; }
  });
  ipcMain.handle('db-delete-question', async (event, id: number) => {
    try { await db.deleteQuestion(id); return; } catch (e) { console.error(e); throw e; }
  });
  ipcMain.handle('db-get-all-questions', async () => {
    try { return await db.getAllQuestions(); } catch (e) { console.error(e); throw e; }
  });
  ipcMain.handle('db-get-questions-by-ids', async (event, ids: number[]) => {
    try { return await db.getQuestionsByIds(ids); } catch (e) { console.error(e); throw e; }
  });
  // getQuestionsForSessionBlocks
  ipcMain.handle('db-get-questions-for-session-blocks', async (event, blocIds?: number[]) => {
    try { return await db.getQuestionsForSessionBlocks(blocIds); } catch (e) { console.error(e); throw e; }
  });

  // AdminSettings
  ipcMain.handle('db-get-admin-setting', async (event, key: string) => {
    try { return await db.getAdminSetting(key); } catch (e) { console.error(e); throw e; }
  });
  ipcMain.handle('db-set-admin-setting', async (event, key: string, value: any) => {
    try { await db.setAdminSetting(key, value); return; } catch (e) { console.error(e); throw e; }
  });
  ipcMain.handle('db-get-all-admin-settings', async () => {
    try { return await db.getAllAdminSettings(); } catch (e) { console.error(e); throw e; }
  });
  // getGlobalPptxTemplate est un cas spécial, il ne retourne pas directement de la DB simple.
  // Si on a besoin de l'exposer via IPC, il faudra peut-être une logique spécifique.
  // Pour l'instant, on se concentre sur les CRUD directs.

  // TODO: Ajouter les gestionnaires pour les autres entités :
  // sessionResults, votingDevices, sessionQuestions (déjà fait ? vérifier), sessionBoitiers (déjà fait ? vérifier),
  // deviceKits, deviceKitAssignments

  console.log('[IPC Handlers] IPC handlers registration attempt finished.');
}

// Note: Assurez-vous que ce fichier est bien importé et que `initializeIpcHandlers()`
// est appelée dans votre fichier principal Electron (par exemple, main.ts ou index.ts dans le répertoire du processus principal).
// Exemple:
// import { initializeIpcHandlers } from './ipcHandlers';
// app.whenReady().then(() => {
//   createWindow();
//   initializeIpcHandlers();
// });
