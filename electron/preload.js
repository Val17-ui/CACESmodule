"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('dbAPI', {
    // Sessions
    getAllSessions: () => electron_1.ipcRenderer.invoke('db-get-all-sessions'),
    getSessionById: (id) => electron_1.ipcRenderer.invoke('db-get-session-by-id', id),
    addSession: (data) => electron_1.ipcRenderer.invoke('db-add-session', data),
    updateSession: (id, updates) => electron_1.ipcRenderer.invoke('db-update-session', id, updates),
    // SessionResults
    addBulkSessionResults: (results) => electron_1.ipcRenderer.invoke('db-add-bulk-session-results', results),
    getResultsForSession: (sessionId) => electron_1.ipcRenderer.invoke('db-get-results-for-session', sessionId),
    // VotingDevices
    getAllVotingDevices: () => electron_1.ipcRenderer.invoke('db-get-all-voting-devices'),
    addVotingDevice: (device) => electron_1.ipcRenderer.invoke('db-add-voting-device', device),
    updateVotingDevice: (id, updates) => electron_1.ipcRenderer.invoke('db-update-voting-device', id, updates),
    deleteVotingDevice: (id) => electron_1.ipcRenderer.invoke('db-delete-voting-device', id),
    bulkAddVotingDevices: (devices) => electron_1.ipcRenderer.invoke('db-bulk-add-voting-devices', devices),
    getVotingDevicesForKit: (kitId) => electron_1.ipcRenderer.invoke('db-get-voting-devices-for-kit', kitId),
    addBulkSessionBoitiers: (boitiers) => electron_1.ipcRenderer.invoke('db-add-bulk-session-boitiers', boitiers),
    deleteSessionBoitiersBySessionId: (sessionId) => electron_1.ipcRenderer.invoke('db-delete-session-boitiers-by-session-id', sessionId),
    getSessionBoitiersBySessionId: (sessionId) => electron_1.ipcRenderer.invoke('db-get-session-boitiers-by-session-id', sessionId),
    // DeviceKits
    getAllDeviceKits: () => electron_1.ipcRenderer.invoke('db-get-all-device-kits'),
    getDefaultDeviceKit: () => electron_1.ipcRenderer.invoke('db-get-default-device-kit'),
    addDeviceKit: (data) => electron_1.ipcRenderer.invoke('db-add-device-kit', data),
    updateDeviceKit: (id, updates) => electron_1.ipcRenderer.invoke('db-update-device-kit', id, updates),
    deleteDeviceKit: (id) => electron_1.ipcRenderer.invoke('db-delete-device-kit', id),
    setDefaultDeviceKit: (id) => electron_1.ipcRenderer.invoke('db-set-default-device-kit', id),
    assignDeviceToKit: (kitId, votingDeviceId) => electron_1.ipcRenderer.invoke('db-assign-device-to-kit', kitId, votingDeviceId),
    removeDeviceFromKit: (kitId, votingDeviceId) => electron_1.ipcRenderer.invoke('db-remove-device-from-kit', kitId, votingDeviceId),
    removeAssignmentsByKitId: (kitId) => electron_1.ipcRenderer.invoke('db-remove-assignments-by-kit-id', kitId),
    removeAssignmentsByVotingDeviceId: (votingDeviceId) => electron_1.ipcRenderer.invoke('db-remove-assignments-by-voting-device-id', votingDeviceId),
    // Referentiels
    addReferential: (data) => electron_1.ipcRenderer.invoke('db-add-referential', data),
    getAllReferentiels: () => electron_1.ipcRenderer.invoke('db-get-all-referentiels'),
    getReferentialByCode: (code) => electron_1.ipcRenderer.invoke('db-get-referential-by-code', code),
    getReferentialById: (id) => electron_1.ipcRenderer.invoke('db-get-referential-by-id', id),
    // Trainers
    getAllTrainers: () => electron_1.ipcRenderer.invoke('db-get-all-trainers'),
    addTrainer: (data) => electron_1.ipcRenderer.invoke('db-add-trainer', data),
    deleteTrainer: (id) => electron_1.ipcRenderer.invoke('db-delete-trainer', id),
    setDefaultTrainer: (id) => electron_1.ipcRenderer.invoke('db-set-default-trainer', id),
    updateTrainer: (id, updates) => electron_1.ipcRenderer.invoke('db-update-trainer', id, updates),
    // Themes
    addTheme: (data) => electron_1.ipcRenderer.invoke('db-add-theme', data),
    getThemeByCodeAndReferentialId: (code, refId) => electron_1.ipcRenderer.invoke('db-get-theme-by-code-and-referential-id', code, refId),
    getThemesByReferentialId: (refId) => electron_1.ipcRenderer.invoke('db-get-themes-by-referential-id', refId),
    getThemeById: (id) => electron_1.ipcRenderer.invoke('db-get-theme-by-id', id),
    getAllThemes: () => electron_1.ipcRenderer.invoke('db-get-all-themes'),
    // Blocs
    addBloc: (data) => electron_1.ipcRenderer.invoke('db-add-bloc', data),
    getBlocByCodeAndThemeId: (code, themeId) => electron_1.ipcRenderer.invoke('db-get-bloc-by-code-and-theme-id', code, themeId),
    getBlocsByThemeId: (themeId) => electron_1.ipcRenderer.invoke('db-get-blocs-by-theme-id', themeId),
    getBlocById: (id) => electron_1.ipcRenderer.invoke('db-get-bloc-by-id', id),
    getAllBlocs: () => electron_1.ipcRenderer.invoke('db-get-all-blocs'),
    // Questions
    addQuestion: (data) => electron_1.ipcRenderer.invoke('db-add-question', data),
    getQuestionById: (id) => electron_1.ipcRenderer.invoke('db-get-question-by-id', id),
    getQuestionsByBlocId: (blocId) => electron_1.ipcRenderer.invoke('db-get-questions-by-bloc-id', blocId),
    updateQuestion: (id, updates) => electron_1.ipcRenderer.invoke('db-update-question', id, updates),
    deleteQuestion: (id) => electron_1.ipcRenderer.invoke('db-delete-question', id),
    getAllQuestions: () => electron_1.ipcRenderer.invoke('db-get-all-questions'),
    getQuestionsByIds: (ids) => electron_1.ipcRenderer.invoke('db-get-questions-by-ids', ids),
    getQuestionsForSessionBlocks: (blocIds) => electron_1.ipcRenderer.invoke('db-get-questions-for-session-blocks', blocIds),
    // AdminSettings
    getAdminSetting: (key) => electron_1.ipcRenderer.invoke('db-get-admin-setting', key),
    setAdminSetting: (key, value) => electron_1.ipcRenderer.invoke('db-set-admin-setting', key, value),
    getAllAdminSettings: () => electron_1.ipcRenderer.invoke('db-get-all-admin-settings'),
    // Backup/Restore
    exportAllData: () => electron_1.ipcRenderer.invoke('db-export-all-data'),
    importAllData: (data) => electron_1.ipcRenderer.invoke('db-import-all-data', data),
    // PPTX Generation
    generatePresentation: (sessionInfo, participants, questions, template, adminSettings) => electron_1.ipcRenderer.invoke('pptx-generate', sessionInfo, participants, questions, template, adminSettings),
    savePptxFile: (fileBuffer, fileName) => electron_1.ipcRenderer.invoke('save-pptx-file', fileBuffer, fileName),
    // File Operations
    openExcelFileDialog: () => electron_1.ipcRenderer.invoke('open-excel-file-dialog'),
    openDirectoryDialog: (filePath) => electron_1.ipcRenderer.invoke('open-directory-dialog', filePath),
    openResultsFile: () => electron_1.ipcRenderer.invoke('open-results-file'),
});
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    Buffer_from: Buffer.from // Expose Buffer.from directly
});
