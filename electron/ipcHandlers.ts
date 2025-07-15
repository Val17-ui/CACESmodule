const { ipcMain } = require('electron');
const {
    getAllSessions, getSessionById, addSession, updateSession, addBulkSessionResults,
    getResultsForSession, getAllVotingDevices, getVotingDevicesForKit, addBulkSessionQuestions,
    deleteSessionQuestionsBySessionId, getSessionQuestionsBySessionId, addBulkSessionBoitiers,
    deleteSessionBoitiersBySessionId, getSessionBoitiersBySessionId, getAllDeviceKits,
    getDefaultDeviceKit, addReferential, getAllReferentiels, getReferentialByCode,
    getReferentialById, getAllTrainers, addTheme, getThemeByCodeAndReferentialId,
    getThemesByReferentialId, getThemeById, getAllThemes, addBloc, getBlocByCodeAndThemeId,
    getBlocsByThemeId, getBlocById, getAllBlocs, addQuestion, getQuestionById,
    getQuestionsByBlocId, updateQuestion, deleteQuestion, getAllQuestions, getQuestionsByIds,
    getQuestionsForSessionBlocks, getAdminSetting, setAdminSetting, getAllAdminSettings
} = require('./db');

exports.initializeIpcHandlers = function() {
  console.log('[IPC Handlers] Initializing IPC handlers...');

  // Sessions
  ipcMain.handle('db-get-all-sessions', async () => getAllSessions());
  ipcMain.handle('db-get-session-by-id', async (event: any, sessionId: number) => getSessionById(sessionId));
  ipcMain.handle('db-add-session', async (event: any, data: any) => addSession(data));
  ipcMain.handle('db-update-session', async (event: any, id: number, updates: any) => updateSession(id, updates));

  // SessionResults
  ipcMain.handle('db-add-bulk-session-results', async (event: any, results: any) => addBulkSessionResults(results));
  ipcMain.handle('db-get-results-for-session', async (event: any, sessionId: number) => getResultsForSession(sessionId));

  // VotingDevices
  ipcMain.handle('db-get-all-voting-devices', async () => getAllVotingDevices());
  ipcMain.handle('db-get-voting-devices-for-kit', async (event: any, kitId: number) => getVotingDevicesForKit(kitId));

  // SessionQuestions
  ipcMain.handle('db-add-bulk-session-questions', async (event: any, questions: any) => addBulkSessionQuestions(questions));
  ipcMain.handle('db-delete-session-questions-by-session-id', async (event: any, sessionId: number) => deleteSessionQuestionsBySessionId(sessionId));
  ipcMain.handle('db-get-session-questions-by-session-id', async (event: any, sessionId: number) => getSessionQuestionsBySessionId(sessionId));

  // SessionBoitiers
  ipcMain.handle('db-add-bulk-session-boitiers', async (event: any, boitiers: any) => addBulkSessionBoitiers(boitiers));
  ipcMain.handle('db-delete-session-boitiers-by-session-id', async (event: any, sessionId: number) => deleteSessionBoitiersBySessionId(sessionId));
  ipcMain.handle('db-get-session-boitiers-by-session-id', async (event: any, sessionId: number) => getSessionBoitiersBySessionId(sessionId));

  // DeviceKits
  ipcMain.handle('db-get-all-device-kits', async () => getAllDeviceKits());
  ipcMain.handle('db-get-default-device-kit', async () => getDefaultDeviceKit());

  // Referentiels
  ipcMain.handle('db-add-referential', async (event: any, data: any) => addReferential(data));
  ipcMain.handle('db-get-all-referentiels', async () => getAllReferentiels());
  ipcMain.handle('db-get-referential-by-code', async (event: any, code: string) => getReferentialByCode(code));
  ipcMain.handle('db-get-referential-by-id', async (event: any, id: number) => getReferentialById(id));

  // Trainers
  ipcMain.handle('db-get-all-trainers', async () => getAllTrainers());

  // Themes
  ipcMain.handle('db-add-theme', async (event: any, data: any) => addTheme(data));
  ipcMain.handle('db-get-theme-by-code-and-referential-id', async (event: any, code: string, refId: number) => getThemeByCodeAndReferentialId(code, refId));
  ipcMain.handle('db-get-themes-by-referential-id', async (event: any, refId: number) => getThemesByReferentialId(refId));
  ipcMain.handle('db-get-theme-by-id', async (event: any, id: number) => getThemeById(id));
  ipcMain.handle('db-get-all-themes', async () => getAllThemes());

  // Blocs
  ipcMain.handle('db-add-bloc', async (event: any, data: any) => addBloc(data));
  ipcMain.handle('db-get-bloc-by-code-and-theme-id', async (event: any, code: string, themeId: number) => getBlocByCodeAndThemeId(code, themeId));
  ipcMain.handle('db-get-blocs-by-theme-id', async (event: any, themeId: number) => getBlocsByThemeId(themeId));
  ipcMain.handle('db-get-bloc-by-id', async (event: any, id: number) => getBlocById(id));
  ipcMain.handle('db-get-all-blocs', async () => getAllBlocs());

  // Questions
  ipcMain.handle('db-add-question', async (event: any, data: any) => addQuestion(data));
  ipcMain.handle('db-get-question-by-id', async (event: any, id: number) => getQuestionById(id));
  ipcMain.handle('db-get-questions-by-bloc-id', async (event: any, blocId: number) => getQuestionsByBlocId(blocId));
  ipcMain.handle('db-update-question', async (event: any, id: number, updates: any) => updateQuestion(id, updates));
  ipcMain.handle('db-delete-question', async (event: any, id: number) => deleteQuestion(id));
  ipcMain.handle('db-get-all-questions', async () => getAllQuestions());
  ipcMain.handle('db-get-questions-by-ids', async (event: any, ids: number[]) => getQuestionsByIds(ids));
  ipcMain.handle('db-get-questions-for-session-blocks', async (event: any, blocIds?: number[]) => getQuestionsForSessionBlocks(blocIds));

  // AdminSettings
  ipcMain.handle('db-get-admin-setting', async (event: any, key: string) => getAdminSetting(key));
  ipcMain.handle('db-set-admin-setting', async (event: any, key: string, value: any) => setAdminSetting(key, value));
  ipcMain.handle('db-get-all-admin-settings', async () => getAllAdminSettings());

  console.log('[IPC Handlers] IPC handlers registration attempt finished.');
}
