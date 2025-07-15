const { ipcMain } = require('electron');
const {
    getAllSessions, getSessionById, addReferential, getAllReferentiels, getAllTrainers,
    getReferentialByCode, getReferentialById, addTheme, getThemeByCodeAndReferentialId,
    getThemesByReferentialId, getThemeById, getAllThemes, addBloc, getBlocByCodeAndThemeId,
    getBlocsByThemeId, getBlocById, getAllBlocs, addQuestion, getQuestionById,
    getQuestionsByBlocId, updateQuestion, deleteQuestion, getAllQuestions, getQuestionsByIds,
    getQuestionsForSessionBlocks, getAdminSetting, setAdminSetting, getAllAdminSettings
} = require('./db');

exports.initializeIpcHandlers = function() {
  console.log('[IPC Handlers] Initializing IPC handlers...');

  // Handler pour getAllSessions
  ipcMain.handle('db-get-all-sessions', async () => {
    console.log('[IPC Main] Received db-get-all-sessions');
    try {
      const sessions = await getAllSessions();
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
      const session = await getSessionById(sessionId);
      return session;
    } catch (error) {
      console.error(`[IPC Main] Error in db-get-session-by-id for id ${sessionId}:`, error);
      throw error;
    }
  });

  // ----- Ajoutez d'autres gestionnaires IPC ici au fur et à mesure -----
  // Exemple pour addReferential (à adapter pour toutes les fonctions CRUD)
  ipcMain.handle('db-add-referential', async (event, referentialData: any) => {
    console.log('[IPC Main] Received db-add-referential with data:', referentialData);
    try {
      const newId = await addReferential(referentialData);
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
      return await getAllReferentiels();
    } catch (error) {
      console.error('[IPC Main] Error in db-get-all-referentiels:', error);
      throw error;
    }
  });

  // getAllTrainers
  ipcMain.handle('db-get-all-trainers', async () => {
    console.log('[IPC Main] Received db-get-all-trainers');
    try {
      return await getAllTrainers();
    } catch (error) {
      console.error('[IPC Main] Error in db-get-all-trainers:', error);
      throw error;
    }
  });

  // Referentiels (addReferential, getAllReferentiels sont déjà là en exemple)
  ipcMain.handle('db-get-referential-by-code', async (event, code: string) => {
    try { return await getReferentialByCode(code); } catch (e) { console.error(e); throw e; }
  });
  ipcMain.handle('db-get-referential-by-id', async (event, id: number) => {
    try { return await getReferentialById(id); } catch (e) { console.error(e); throw e; }
  });

  // Themes
  ipcMain.handle('db-add-theme', async (event, data: any) => {
    try { return await addTheme(data); } catch (e) { console.error(e); throw e; }
  });
  ipcMain.handle('db-get-theme-by-code-and-referential-id', async (event, code: string, refId: number) => {
    try { return await getThemeByCodeAndReferentialId(code, refId); } catch (e) { console.error(e); throw e; }
  });
  ipcMain.handle('db-get-themes-by-referential-id', async (event, refId: number) => {
    try { return await getThemesByReferentialId(refId); } catch (e) { console.error(e); throw e; }
  });
  ipcMain.handle('db-get-theme-by-id', async (event, id: number) => {
    try { return await getThemeById(id); } catch (e) { console.error(e); throw e; }
  });
   ipcMain.handle('db-get-all-themes', async () => {
    try { return await getAllThemes(); } catch (e) { console.error(e); throw e; }
  });


  // Blocs
  ipcMain.handle('db-add-bloc', async (event, data: any) => {
    try { return await addBloc(data); } catch (e) { console.error(e); throw e; }
  });
  ipcMain.handle('db-get-bloc-by-code-and-theme-id', async (event, code: string, themeId: number) => {
    try { return await getBlocByCodeAndThemeId(code, themeId); } catch (e) { console.error(e); throw e; }
  });
  ipcMain.handle('db-get-blocs-by-theme-id', async (event, themeId: number) => {
    try { return await getBlocsByThemeId(themeId); } catch (e) { console.error(e); throw e; }
  });
  ipcMain.handle('db-get-bloc-by-id', async (event, id: number) => {
    try { return await getBlocById(id); } catch (e) { console.error(e); throw e; }
  });
  ipcMain.handle('db-get-all-blocs', async () => {
    try { return await getAllBlocs(); } catch (e) { console.error(e); throw e; }
  });

  // Questions
  ipcMain.handle('db-add-question', async (event, data: any) => {
    try { return await addQuestion(data); } catch (e) { console.error(e); throw e; }
  });
  ipcMain.handle('db-get-question-by-id', async (event, id: number) => {
    try { return await getQuestionById(id); } catch (e) { console.error(e); throw e; }
  });
  ipcMain.handle('db-get-questions-by-bloc-id', async (event, blocId: number) => {
    try { return await getQuestionsByBlocId(blocId); } catch (e) { console.error(e); throw e; }
  });
  ipcMain.handle('db-update-question', async (event, id: number, updates: any) => {
    try { return await updateQuestion(id, updates); } catch (e) { console.error(e); throw e; }
  });
  ipcMain.handle('db-delete-question', async (event, id: number) => {
    try { await deleteQuestion(id); return; } catch (e) { console.error(e); throw e; }
  });
  ipcMain.handle('db-get-all-questions', async () => {
    try { return await getAllQuestions(); } catch (e) { console.error(e); throw e; }
  });
  ipcMain.handle('db-get-questions-by-ids', async (event, ids: number[]) => {
    try { return await getQuestionsByIds(ids); } catch (e) { console.error(e); throw e; }
  });
  // getQuestionsForSessionBlocks
  ipcMain.handle('db-get-questions-for-session-blocks', async (event, blocIds?: number[]) => {
    try { return await getQuestionsForSessionBlocks(blocIds); } catch (e) { console.error(e); throw e; }
  });

  // AdminSettings
  ipcMain.handle('db-get-admin-setting', async (event, key: string) => {
    try { return await getAdminSetting(key); } catch (e) { console.error(e); throw e; }
  });
  ipcMain.handle('db-set-admin-setting', async (event, key: string, value: any) => {
    try { await setAdminSetting(key, value); return; } catch (e) { console.error(e); throw e; }
  });
  ipcMain.handle('db-get-all-admin-settings', async () => {
    try { return await getAllAdminSettings(); } catch (e) { console.error(e); throw e; }
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
