"use strict";
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("dbAPI", {
  // Sessions
  getAllSessions: () => ipcRenderer.invoke("db-get-all-sessions"),
  getSessionById: (id) => ipcRenderer.invoke("db-get-session-by-id", id),
  addSession: (data) => ipcRenderer.invoke("db-add-session", data),
  updateSession: (id, updates) => ipcRenderer.invoke("db-update-session", id, updates),
  // SessionResults
  addBulkSessionResults: (results) => ipcRenderer.invoke("db-add-bulk-session-results", results),
  getResultsForSession: (sessionId) => ipcRenderer.invoke("db-get-results-for-session", sessionId),
  // VotingDevices
  getAllVotingDevices: () => ipcRenderer.invoke("db-get-all-voting-devices"),
  getVotingDevicesForKit: (kitId) => ipcRenderer.invoke("db-get-voting-devices-for-kit", kitId),
  // SessionQuestions
  addBulkSessionQuestions: (questions) => ipcRenderer.invoke("db-add-bulk-session-questions", questions),
  deleteSessionQuestionsBySessionId: (sessionId) => ipcRenderer.invoke("db-delete-session-questions-by-session-id", sessionId),
  getSessionQuestionsBySessionId: (sessionId) => ipcRenderer.invoke("db-get-session-questions-by-session-id", sessionId),
  // SessionBoitiers
  addBulkSessionBoitiers: (boitiers) => ipcRenderer.invoke("db-add-bulk-session-boitiers", boitiers),
  deleteSessionBoitiersBySessionId: (sessionId) => ipcRenderer.invoke("db-delete-session-boitiers-by-session-id", sessionId),
  getSessionBoitiersBySessionId: (sessionId) => ipcRenderer.invoke("db-get-session-boitiers-by-session-id", sessionId),
  // DeviceKits
  getAllDeviceKits: () => ipcRenderer.invoke("db-get-all-device-kits"),
  getDefaultDeviceKit: () => ipcRenderer.invoke("db-get-default-device-kit"),
  // Referentiels
  addReferential: (data) => ipcRenderer.invoke("db-add-referential", data),
  getAllReferentiels: () => ipcRenderer.invoke("db-get-all-referentiels"),
  getReferentialByCode: (code) => ipcRenderer.invoke("db-get-referential-by-code", code),
  getReferentialById: (id) => ipcRenderer.invoke("db-get-referential-by-id", id),
  // Trainers
  getAllTrainers: () => ipcRenderer.invoke("db-get-all-trainers"),
  // Themes
  addTheme: (data) => ipcRenderer.invoke("db-add-theme", data),
  getThemeByCodeAndReferentialId: (code, refId) => ipcRenderer.invoke("db-get-theme-by-code-and-referential-id", code, refId),
  getThemesByReferentialId: (refId) => ipcRenderer.invoke("db-get-themes-by-referential-id", refId),
  getThemeById: (id) => ipcRenderer.invoke("db-get-theme-by-id", id),
  getAllThemes: () => ipcRenderer.invoke("db-get-all-themes"),
  // Blocs
  addBloc: (data) => ipcRenderer.invoke("db-add-bloc", data),
  getBlocByCodeAndThemeId: (code, themeId) => ipcRenderer.invoke("db-get-bloc-by-code-and-theme-id", code, themeId),
  getBlocsByThemeId: (themeId) => ipcRenderer.invoke("db-get-blocs-by-theme-id", themeId),
  getBlocById: (id) => ipcRenderer.invoke("db-get-bloc-by-id", id),
  getAllBlocs: () => ipcRenderer.invoke("db-get-all-blocs"),
  // Questions
  addQuestion: (data) => ipcRenderer.invoke("db-add-question", data),
  getQuestionById: (id) => ipcRenderer.invoke("db-get-question-by-id", id),
  getQuestionsByBlocId: (blocId) => ipcRenderer.invoke("db-get-questions-by-bloc-id", blocId),
  updateQuestion: (id, updates) => ipcRenderer.invoke("db-update-question", id, updates),
  deleteQuestion: (id) => ipcRenderer.invoke("db-delete-question", id),
  getAllQuestions: () => ipcRenderer.invoke("db-get-all-questions"),
  getQuestionsByIds: (ids) => ipcRenderer.invoke("db-get-questions-by-ids", ids),
  getQuestionsForSessionBlocks: (blocIds) => ipcRenderer.invoke("db-get-questions-for-session-blocks", blocIds),
  // AdminSettings
  getAdminSetting: (key) => ipcRenderer.invoke("db-get-admin-setting", key),
  setAdminSetting: (key, value) => ipcRenderer.invoke("db-set-admin-setting", key, value),
  getAllAdminSettings: () => ipcRenderer.invoke("db-get-all-admin-settings"),
  // PPTX Generation
  generatePresentation: (sessionInfo, participants, questions, template, adminSettings) => ipcRenderer.invoke("pptx-generate", sessionInfo, participants, questions, template, adminSettings)
});
