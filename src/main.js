// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const {
  addQuestion,
  getGlobalPptxTemplate,
  getAllQuestions,
  addDeviceKit,
  getAllDeviceKits,
  getDeviceKitById,
  updateDeviceKit,
  deleteDeviceKit,
  getDefaultDeviceKit,
  setDefaultDeviceKit,
  assignDeviceToKit,
  removeDeviceFromKit,
  getVotingDevicesForKit,
  getKitsForVotingDevice,
  removeAssignmentsByKitId,
  removeAssignmentsByVotingDeviceId,
  addReferential,
  getAllReferentiels,
  getReferentialById,
  getReferentialByCode,
  addTheme,
  getAllThemes,
  getThemesByReferentialId,
  getThemeByCodeAndReferentialId,
  addBloc,
  getAllBlocs,
  getBlocsByThemeId,
  getBlocById,
  getBlocByCodeAndThemeId,
  getQuestionsByBlocId,
  getQuestionById,
  getQuestionsByIds,
  calculateBlockUsage,
  updateQuestion,
  deleteQuestion,
  addSession,
  getAllSessions,
  getSessionById,
  updateSession,
  deleteSession,
  addSessionResult,
  addBulkSessionResults,
  getAllResults,
  getResultsForSession,
  getResultBySessionAndQuestion,
  updateSessionResult,
  deleteResultsForSession,
  getQuestionsForSessionBlocks,
  getAdminSetting,
  setAdminSetting,
  getAllAdminSettings,
  addVotingDevice,
  getAllVotingDevices,
  updateVotingDevice,
  deleteVotingDevice,
  bulkAddVotingDevices,
  addTrainer,
  getAllTrainers,
  getTrainerById,
  updateTrainer,
  deleteTrainer,
  setDefaultTrainer,
  getDefaultTrainer,
  addSessionQuestion,
  addBulkSessionQuestions,
  getSessionQuestionsBySessionId,
  deleteSessionQuestionsBySessionId,
  addSessionBoitier,
  addBulkSessionBoitiers,
  getSessionBoitiersBySessionId,
  deleteSessionBoitiersBySessionId
} = require('./src/db');

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Load Vite dev server in development, or built index.html in production
  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, 'dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handlers
ipcMain.handle('db:addQuestion', async (event, question) => await addQuestion(question));
ipcMain.handle('db:getGlobalPptxTemplate', async () => await getGlobalPptxTemplate());
ipcMain.handle('db:getAllQuestions', async () => await getAllQuestions());
ipcMain.handle('db:addDeviceKit', async (event, kit) => await addDeviceKit(kit));
ipcMain.handle('db:getAllDeviceKits', async () => await getAllDeviceKits());
ipcMain.handle('db:getDeviceKitById', async (event, id) => await getDeviceKitById(id));
ipcMain.handle('db:updateDeviceKit', async (event, id, updates) => await updateDeviceKit(id, updates));
ipcMain.handle('db:deleteDeviceKit', async (event, id) => await deleteDeviceKit(id));
ipcMain.handle('db:getDefaultDeviceKit', async () => await getDefaultDeviceKit());
ipcMain.handle('db:setDefaultDeviceKit', async (event, kitId) => await setDefaultDeviceKit(kitId));
ipcMain.handle('db:assignDeviceToKit', async (event, kitId, votingDeviceId) => await assignDeviceToKit(kitId, votingDeviceId));
ipcMain.handle('db:removeDeviceFromKit', async (event, kitId, votingDeviceId) => await removeDeviceFromKit(kitId, votingDeviceId));
ipcMain.handle('db:getVotingDevicesForKit', async (event, kitId) => await getVotingDevicesForKit(kitId));
ipcMain.handle('db:getKitsForVotingDevice', async (event, votingDeviceId) => await getKitsForVotingDevice(votingDeviceId));
ipcMain.handle('db:removeAssignmentsByKitId', async (event, kitId) => await removeAssignmentsByKitId(kitId));
ipcMain.handle('db:removeAssignmentsByVotingDeviceId', async (event, votingDeviceId) => await removeAssignmentsByVotingDeviceId(votingDeviceId));
ipcMain.handle('db:addReferential', async (event, referential) => await addReferential(referential));
ipcMain.handle('db:getAllReferentiels', async () => await getAllReferentiels());
ipcMain.handle('db:getReferentialById', async (event, id) => await getReferentialById(id));
ipcMain.handle('db:getReferentialByCode', async (event, code) => await getReferentialByCode(code));
ipcMain.handle('db:addTheme', async (event, theme) => await addTheme(theme));
ipcMain.handle('db:getAllThemes', async () => await getAllThemes());
ipcMain.handle('db:getThemesByReferentialId', async (event, referentielId) => await getThemesByReferentialId(referentielId));
ipcMain.handle('db:getThemeByCodeAndReferentialId', async (event, code_theme, referentiel_id) => await getThemeByCodeAndReferentialId(code_theme, referentiel_id));
ipcMain.handle('db:addBloc', async (event, bloc) => await addBloc(bloc));
ipcMain.handle('db:getAllBlocs', async () => await getAllBlocs());
ipcMain.handle('db:getBlocsByThemeId', async (event, themeId) => await getBlocsByThemeId(themeId));
ipcMain.handle('db:getBlocById', async (event, id) => await getBlocById(id));
ipcMain.handle('db:getBlocByCodeAndThemeId', async (event, code_bloc, theme_id) => await getBlocByCodeAndThemeId(code_bloc, theme_id));
ipcMain.handle('db:getQuestionsByBlocId', async (event, blocId) => await getQuestionsByBlocId(blocId));
ipcMain.handle('db:getQuestionById', async (event, id) => await getQuestionById(id));
ipcMain.handle('db:getQuestionsByIds', async (event, ids) => await getQuestionsByIds(ids));
ipcMain.handle('db:calculateBlockUsage', async (event, startDate, endDate) => await calculateBlockUsage(startDate, endDate));
ipcMain.handle('db:updateQuestion', async (event, id, updates) => await updateQuestion(id, updates));
ipcMain.handle('db:deleteQuestion', async (event, id) => await deleteQuestion(id));
ipcMain.handle('db:addSession', async (event, session) => await addSession(session));
ipcMain.handle('db:getAllSessions', async () => await getAllSessions());
ipcMain.handle('db:getSessionById', async (event, id) => await getSessionById(id));
ipcMain.handle('db:updateSession', async (event, id, updates) => await updateSession(id, updates));
ipcMain.handle('db:deleteSession', async (event, id) => await deleteSession(id));
ipcMain.handle('db:addSessionResult', async (event, result) => await addSessionResult(result));
ipcMain.handle('db:addBulkSessionResults', async (event, results) => await addBulkSessionResults(results));
ipcMain.handle('db:getAllResults', async () => await getAllResults());
ipcMain.handle('db:getResultsForSession', async (event, sessionId) => await getResultsForSession(sessionId));
ipcMain.handle('db:getResultBySessionAndQuestion', async (event, sessionId, questionId, participantIdBoitier) => await getResultBySessionAndQuestion(sessionId, questionId, participantIdBoitier));
ipcMain.handle('db:updateSessionResult', async (event, id, updates) => await updateSessionResult(id, updates));
ipcMain.handle('db:deleteResultsForSession', async (event, sessionId) => await deleteResultsForSession(sessionId));
ipcMain.handle('db:getQuestionsForSessionBlocks', async (event, selectedBlocIds) => await getQuestionsForSessionBlocks(selectedBlocIds));
ipcMain.handle('db:getAdminSetting', async (event, key) => await getAdminSetting(key));
ipcMain.handle('db:setAdminSetting', async (event, key, value) => await setAdminSetting(key, value));
ipcMain.handle('db:getAllAdminSettings', async () => await getAllAdminSettings());
ipcMain.handle('db:addVotingDevice', async (event, device) => await addVotingDevice(device));
ipcMain.handle('db:getAllVotingDevices', async () => await getAllVotingDevices());
ipcMain.handle('db:updateVotingDevice', async (event, id, updates) => await updateVotingDevice(id, updates));
ipcMain.handle('db:deleteVotingDevice', async (event, id) => await deleteVotingDevice(id));
ipcMain.handle('db:bulkAddVotingDevices', async (event, devices) => await bulkAddVotingDevices(devices));
ipcMain.handle('db:addTrainer', async (event, trainer) => await addTrainer(trainer));
ipcMain.handle('db:getAllTrainers', async () => await getAllTrainers());
ipcMain.handle('db:getTrainerById', async (event, id) => await getTrainerById(id));
ipcMain.handle('db:updateTrainer', async (event, id, updates) => await updateTrainer(id, updates));
ipcMain.handle('db:deleteTrainer', async (event, id) => await deleteTrainer(id));
ipcMain.handle('db:setDefaultTrainer', async (event, id) => await setDefaultTrainer(id));
ipcMain.handle('db:getDefaultTrainer', async () => await getDefaultTrainer());
ipcMain.handle('db:addSessionQuestion', async (event, sq) => await addSessionQuestion(sq));
ipcMain.handle('db:addBulkSessionQuestions', async (event, questions) => await addBulkSessionQuestions(questions));
ipcMain.handle('db:getSessionQuestionsBySessionId', async (event, sessionId) => await getSessionQuestionsBySessionId(sessionId));
ipcMain.handle('db:deleteSessionQuestionsBySessionId', async (event, sessionId) => await deleteSessionQuestionsBySessionId(sessionId));
ipcMain.handle('db:addSessionBoitier', async (event, sb) => await addSessionBoitier(sb));
ipcMain.handle('db:addBulkSessionBoitiers', async (event, boitiers) => await addBulkSessionBoitiers(boitiers));
ipcMain.handle('db:getSessionBoitiersBySessionId', async (event, sessionId) => await getSessionBoitiersBySessionId(sessionId));
ipcMain.handle('db:deleteSessionBoitiersBySessionId', async (event, sessionId) => await deleteSessionBoitiersBySessionId(sessionId));