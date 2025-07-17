"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("dbAPI", {
  // Sessions
  getAllSessions: () => electron.ipcRenderer.invoke("db-get-all-sessions"),
  getSessionById: (id) => electron.ipcRenderer.invoke("db-get-session-by-id", id),
  addSession: (data) => electron.ipcRenderer.invoke("db-add-session", data),
  updateSession: (id, updates) => electron.ipcRenderer.invoke("db-update-session", id, updates),
  // SessionResults
  addBulkSessionResults: (results) => electron.ipcRenderer.invoke("db-add-bulk-session-results", results),
  getResultsForSession: (sessionId) => electron.ipcRenderer.invoke("db-get-results-for-session", sessionId),
  // VotingDevices
  getAllVotingDevices: () => electron.ipcRenderer.invoke("db-get-all-voting-devices"),
  addVotingDevice: (device) => electron.ipcRenderer.invoke("db-add-voting-device", device),
  updateVotingDevice: (id, updates) => electron.ipcRenderer.invoke("db-update-voting-device", id, updates),
  deleteVotingDevice: (id) => electron.ipcRenderer.invoke("db-delete-voting-device", id),
  bulkAddVotingDevices: (devices) => electron.ipcRenderer.invoke("db-bulk-add-voting-devices", devices),
  getVotingDevicesForKit: (kitId) => electron.ipcRenderer.invoke("db-get-voting-devices-for-kit", kitId),
  addBulkSessionBoitiers: (boitiers) => electron.ipcRenderer.invoke("db-add-bulk-session-boitiers", boitiers),
  deleteSessionBoitiersBySessionId: (sessionId) => electron.ipcRenderer.invoke("db-delete-session-boitiers-by-session-id", sessionId),
  getSessionBoitiersBySessionId: (sessionId) => electron.ipcRenderer.invoke("db-get-session-boitiers-by-session-id", sessionId),
  // DeviceKits
  getAllDeviceKits: () => electron.ipcRenderer.invoke("db-get-all-device-kits"),
  getDefaultDeviceKit: () => electron.ipcRenderer.invoke("db-get-default-device-kit"),
  addDeviceKit: (data) => electron.ipcRenderer.invoke("db-add-device-kit", data),
  updateDeviceKit: (id, updates) => electron.ipcRenderer.invoke("db-update-device-kit", id, updates),
  deleteDeviceKit: (id) => electron.ipcRenderer.invoke("db-delete-device-kit", id),
  setDefaultDeviceKit: (id) => electron.ipcRenderer.invoke("db-set-default-device-kit", id),
  assignDeviceToKit: (kitId, votingDeviceId) => electron.ipcRenderer.invoke("db-assign-device-to-kit", kitId, votingDeviceId),
  removeDeviceFromKit: (kitId, votingDeviceId) => electron.ipcRenderer.invoke("db-remove-device-from-kit", kitId, votingDeviceId),
  removeAssignmentsByKitId: (kitId) => electron.ipcRenderer.invoke("db-remove-assignments-by-kit-id", kitId),
  removeAssignmentsByVotingDeviceId: (votingDeviceId) => electron.ipcRenderer.invoke("db-remove-assignments-by-voting-device-id", votingDeviceId),
  // Referentiels
  addReferential: (data) => electron.ipcRenderer.invoke("db-add-referential", data),
  getAllReferentiels: () => electron.ipcRenderer.invoke("db-get-all-referentiels"),
  getReferentialByCode: (code) => electron.ipcRenderer.invoke("db-get-referential-by-code", code),
  getReferentialById: (id) => electron.ipcRenderer.invoke("db-get-referential-by-id", id),
  // Trainers
  getAllTrainers: () => electron.ipcRenderer.invoke("db-get-all-trainers"),
  addTrainer: (data) => electron.ipcRenderer.invoke("db-add-trainer", data),
  deleteTrainer: (id) => electron.ipcRenderer.invoke("db-delete-trainer", id),
  setDefaultTrainer: (id) => electron.ipcRenderer.invoke("db-set-default-trainer", id),
  updateTrainer: (id, updates) => electron.ipcRenderer.invoke("db-update-trainer", id, updates),
  // Themes
  addTheme: (data) => electron.ipcRenderer.invoke("db-add-theme", data),
  getThemeByCodeAndReferentialId: (code, refId) => electron.ipcRenderer.invoke("db-get-theme-by-code-and-referential-id", code, refId),
  getThemesByReferentialId: (refId) => electron.ipcRenderer.invoke("db-get-themes-by-referential-id", refId),
  getThemeById: (id) => electron.ipcRenderer.invoke("db-get-theme-by-id", id),
  getAllThemes: () => electron.ipcRenderer.invoke("db-get-all-themes"),
  // Blocs
  addBloc: (data) => electron.ipcRenderer.invoke("db-add-bloc", data),
  getBlocByCodeAndThemeId: (code, themeId) => electron.ipcRenderer.invoke("db-get-bloc-by-code-and-theme-id", code, themeId),
  getBlocsByThemeId: (themeId) => electron.ipcRenderer.invoke("db-get-blocs-by-theme-id", themeId),
  getBlocById: (id) => electron.ipcRenderer.invoke("db-get-bloc-by-id", id),
  getAllBlocs: () => electron.ipcRenderer.invoke("db-get-all-blocs"),
  // Questions
  addQuestion: (data) => electron.ipcRenderer.invoke("db-add-question", data),
  getQuestionById: (id) => electron.ipcRenderer.invoke("db-get-question-by-id", id),
  getQuestionsByBlocId: (blocId) => electron.ipcRenderer.invoke("db-get-questions-by-bloc-id", blocId),
  updateQuestion: (id, updates) => electron.ipcRenderer.invoke("db-update-question", id, updates),
  deleteQuestion: (id) => electron.ipcRenderer.invoke("db-delete-question", id),
  getAllQuestions: () => electron.ipcRenderer.invoke("db-get-all-questions"),
  getQuestionsByIds: (ids) => electron.ipcRenderer.invoke("db-get-questions-by-ids", ids),
  getQuestionsForSessionBlocks: (blocIds) => electron.ipcRenderer.invoke("db-get-questions-for-session-blocks", blocIds),
  // AdminSettings
  getAdminSetting: (key) => electron.ipcRenderer.invoke("db-get-admin-setting", key),
  setAdminSetting: (key, value) => electron.ipcRenderer.invoke("db-set-admin-setting", key, value),
  getAllAdminSettings: () => electron.ipcRenderer.invoke("db-get-all-admin-settings"),
  // Backup/Restore
  exportAllData: () => electron.ipcRenderer.invoke("db-export-all-data"),
  importAllData: (data) => electron.ipcRenderer.invoke("db-import-all-data", data),
  // PPTX Generation
  generatePresentation: (sessionInfo, participants, questions, template, adminSettings) => electron.ipcRenderer.invoke("pptx-generate", sessionInfo, participants, questions, template, adminSettings),
  savePptxFile: (fileBuffer, fileName) => electron.ipcRenderer.invoke("save-pptx-file", fileBuffer, fileName),
  // File Operations
  openExcelFileDialog: () => electron.ipcRenderer.invoke("open-excel-file-dialog"),
  openDirectoryDialog: (filePath) => electron.ipcRenderer.invoke("open-directory-dialog", filePath),
  openResultsFile: () => electron.ipcRenderer.invoke("open-results-file")
});
electron.contextBridge.exposeInMainWorld("electronAPI", {
  Buffer_from: Buffer.from
  // Expose Buffer.from directly
});
