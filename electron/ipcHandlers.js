"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeIpcHandlers = initializeIpcHandlers;
const electron_1 = require("electron");
const fs = require('fs').promises;
const { getAllSessions, getSessionById, addSession, updateSession, addBulkSessionResults, getResultsForSession, getAllVotingDevices, addVotingDevice, updateVotingDevice, deleteVotingDevice, bulkAddVotingDevices, addBulkSessionQuestions, deleteSessionQuestionsBySessionId, getSessionQuestionsBySessionId, addBulkSessionBoitiers, deleteSessionBoitiersBySessionId, getSessionBoitiersBySessionId, getAllDeviceKits, getDefaultDeviceKit, addDeviceKit, updateDeviceKit, deleteDeviceKit, setDefaultDeviceKit, assignDeviceToKit, removeDeviceFromKit, getKitsForVotingDevice, removeAssignmentsByKitId, removeAssignmentsByVotingDeviceId, addReferential, getAllReferentiels, getReferentialByCode, exportAllData, importAllData, getReferentialById, getAllTrainers, addTrainer, deleteTrainer, setDefaultTrainer, updateTrainer, addTheme, getThemeByCodeAndReferentialId, getThemesByReferentialId, getThemeById, getAllThemes, addBloc, getBlocByCodeAndThemeId, getBlocsByThemeId, getBlocById, getAllBlocs, addQuestion, getQuestionById, getQuestionsByBlocId, updateQuestion, deleteQuestion, getAllQuestions, getQuestionsByIds, getQuestionsForSessionBlocks, getAdminSetting, setAdminSetting, getAllAdminSettings, getVotingDevicesForKit // Add this line
 } = require('./db');
function initializeIpcHandlers() {
    console.log('[IPC Handlers] Initializing IPC handlers...');
    // Sessions
    electron_1.ipcMain.handle('db-get-all-sessions', () => __awaiter(this, void 0, void 0, function* () { return getAllSessions(); }));
    electron_1.ipcMain.handle('db-get-session-by-id', (event, sessionId) => __awaiter(this, void 0, void 0, function* () { return getSessionById(sessionId); }));
    electron_1.ipcMain.handle('db-add-session', (event, data) => __awaiter(this, void 0, void 0, function* () { return addSession(data); }));
    electron_1.ipcMain.handle('db-update-session', (event, id, updates) => __awaiter(this, void 0, void 0, function* () { return updateSession(id, updates); }));
    // SessionResults
    electron_1.ipcMain.handle('db-add-bulk-session-results', (event, results) => __awaiter(this, void 0, void 0, function* () { return addBulkSessionResults(results); }));
    electron_1.ipcMain.handle('db-get-results-for-session', (event, sessionId) => __awaiter(this, void 0, void 0, function* () { return getResultsForSession(sessionId); }));
    // VotingDevices
    electron_1.ipcMain.handle('db-get-all-voting-devices', () => __awaiter(this, void 0, void 0, function* () { return getAllVotingDevices(); }));
    electron_1.ipcMain.handle('db-add-voting-device', (event, device) => __awaiter(this, void 0, void 0, function* () { return addVotingDevice(device); }));
    electron_1.ipcMain.handle('db-update-voting-device', (event, id, updates) => __awaiter(this, void 0, void 0, function* () { return updateVotingDevice(id, updates); }));
    electron_1.ipcMain.handle('db-delete-voting-device', (event, id) => __awaiter(this, void 0, void 0, function* () { return deleteVotingDevice(id); }));
    electron_1.ipcMain.handle('db-bulk-add-voting-devices', (event, devices) => __awaiter(this, void 0, void 0, function* () { return bulkAddVotingDevices(devices); }));
    // SessionQuestions
    electron_1.ipcMain.handle('db-add-bulk-session-questions', (event, questions) => __awaiter(this, void 0, void 0, function* () { return addBulkSessionQuestions(questions); }));
    electron_1.ipcMain.handle('db-delete-session-questions-by-session-id', (event, sessionId) => __awaiter(this, void 0, void 0, function* () { return deleteSessionQuestionsBySessionId(sessionId); }));
    electron_1.ipcMain.handle('db-get-session-questions-by-session-id', (event, sessionId) => __awaiter(this, void 0, void 0, function* () { return getSessionQuestionsBySessionId(sessionId); }));
    // SessionBoitiers
    electron_1.ipcMain.handle('db-add-bulk-session-boitiers', (event, boitiers) => __awaiter(this, void 0, void 0, function* () { return addBulkSessionBoitiers(boitiers); }));
    electron_1.ipcMain.handle('db-delete-session-boitiers-by-session-id', (event, sessionId) => __awaiter(this, void 0, void 0, function* () { return deleteSessionBoitiersBySessionId(sessionId); }));
    electron_1.ipcMain.handle('db-get-session-boitiers-by-session-id', (event, sessionId) => __awaiter(this, void 0, void 0, function* () { return getSessionBoitiersBySessionId(sessionId); }));
    // DeviceKits
    electron_1.ipcMain.handle('db-get-voting-devices-for-kit', (event, kitId) => __awaiter(this, void 0, void 0, function* () { return require('./db').getVotingDevicesForKit(kitId); }));
    electron_1.ipcMain.handle('db-get-all-device-kits', () => __awaiter(this, void 0, void 0, function* () { return getAllDeviceKits(); }));
    electron_1.ipcMain.handle('db-get-default-device-kit', () => __awaiter(this, void 0, void 0, function* () { return getDefaultDeviceKit(); }));
    electron_1.ipcMain.handle('db-add-device-kit', (event, data) => __awaiter(this, void 0, void 0, function* () { return addDeviceKit(data); }));
    electron_1.ipcMain.handle('db-update-device-kit', (event, id, updates) => __awaiter(this, void 0, void 0, function* () { return updateDeviceKit(id, updates); }));
    electron_1.ipcMain.handle('db-delete-device-kit', (event, id) => __awaiter(this, void 0, void 0, function* () { return deleteDeviceKit(id); }));
    electron_1.ipcMain.handle('db-set-default-device-kit', (event, id) => __awaiter(this, void 0, void 0, function* () { return setDefaultDeviceKit(id); }));
    electron_1.ipcMain.handle('db-assign-device-to-kit', (event, kitId, votingDeviceId) => __awaiter(this, void 0, void 0, function* () { return assignDeviceToKit(kitId, votingDeviceId); }));
    electron_1.ipcMain.handle('db-remove-device-from-kit', (event, kitId, votingDeviceId) => __awaiter(this, void 0, void 0, function* () { return removeDeviceFromKit(kitId, votingDeviceId); }));
    electron_1.ipcMain.handle('db-get-kits-for-voting-device', (event, votingDeviceId) => __awaiter(this, void 0, void 0, function* () { return getKitsForVotingDevice(votingDeviceId); }));
    electron_1.ipcMain.handle('db-remove-assignments-by-voting-device-id', (event, votingDeviceId) => __awaiter(this, void 0, void 0, function* () { return removeAssignmentsByVotingDeviceId(votingDeviceId); }));
    // Referentiels
    electron_1.ipcMain.handle('db-add-referential', (event, data) => __awaiter(this, void 0, void 0, function* () { return addReferential(data); }));
    electron_1.ipcMain.handle('db-get-all-referentiels', () => __awaiter(this, void 0, void 0, function* () { return getAllReferentiels(); }));
    electron_1.ipcMain.handle('db-get-referential-by-code', (event, code) => __awaiter(this, void 0, void 0, function* () { return getReferentialByCode(code); }));
    electron_1.ipcMain.handle('db-get-referential-by-id', (event, id) => __awaiter(this, void 0, void 0, function* () { return getReferentialById(id); }));
    // Trainers
    electron_1.ipcMain.handle('db-get-all-trainers', () => __awaiter(this, void 0, void 0, function* () { return getAllTrainers(); }));
    electron_1.ipcMain.handle('db-add-trainer', (event, data) => __awaiter(this, void 0, void 0, function* () { return addTrainer(data); }));
    electron_1.ipcMain.handle('db-delete-trainer', (event, id) => __awaiter(this, void 0, void 0, function* () { return deleteTrainer(id); }));
    electron_1.ipcMain.handle('db-set-default-trainer', (event, id) => __awaiter(this, void 0, void 0, function* () { return setDefaultTrainer(id); }));
    electron_1.ipcMain.handle('db-update-trainer', (event, id, updates) => __awaiter(this, void 0, void 0, function* () { return updateTrainer(id, updates); }));
    // Themes
    electron_1.ipcMain.handle('db-add-theme', (event, data) => __awaiter(this, void 0, void 0, function* () { return addTheme(data); }));
    electron_1.ipcMain.handle('db-get-theme-by-code-and-referential-id', (event, code, refId) => __awaiter(this, void 0, void 0, function* () { return getThemeByCodeAndReferentialId(code, refId); }));
    electron_1.ipcMain.handle('db-get-themes-by-referential-id', (event, refId) => __awaiter(this, void 0, void 0, function* () { return getThemesByReferentialId(refId); }));
    electron_1.ipcMain.handle('db-get-theme-by-id', (event, id) => __awaiter(this, void 0, void 0, function* () { return getThemeById(id); }));
    electron_1.ipcMain.handle('db-get-all-themes', () => __awaiter(this, void 0, void 0, function* () { return getAllThemes(); }));
    // Blocs
    electron_1.ipcMain.handle('db-add-bloc', (event, data) => __awaiter(this, void 0, void 0, function* () { return addBloc(data); }));
    electron_1.ipcMain.handle('db-get-bloc-by-code-and-theme-id', (event, code, themeId) => __awaiter(this, void 0, void 0, function* () { return getBlocByCodeAndThemeId(code, themeId); }));
    electron_1.ipcMain.handle('db-get-blocs-by-theme-id', (event, themeId) => __awaiter(this, void 0, void 0, function* () { return getBlocsByThemeId(themeId); }));
    electron_1.ipcMain.handle('db-get-bloc-by-id', (event, id) => __awaiter(this, void 0, void 0, function* () { return getBlocById(id); }));
    electron_1.ipcMain.handle('db-get-all-blocs', () => __awaiter(this, void 0, void 0, function* () { return getAllBlocs(); }));
    // Questions
    electron_1.ipcMain.handle('db-add-question', (event, data) => __awaiter(this, void 0, void 0, function* () { return addQuestion(data); }));
    electron_1.ipcMain.handle('db-get-question-by-id', (event, id) => __awaiter(this, void 0, void 0, function* () { return getQuestionById(id); }));
    electron_1.ipcMain.handle('db-get-questions-by-bloc-id', (event, blocId) => __awaiter(this, void 0, void 0, function* () { return getQuestionsByBlocId(blocId); }));
    electron_1.ipcMain.handle('db-update-question', (event, id, updates) => __awaiter(this, void 0, void 0, function* () { return updateQuestion(id, updates); }));
    electron_1.ipcMain.handle('db-delete-question', (event, id) => __awaiter(this, void 0, void 0, function* () { return deleteQuestion(id); }));
    electron_1.ipcMain.handle('db-get-all-questions', () => __awaiter(this, void 0, void 0, function* () { return getAllQuestions(); }));
    electron_1.ipcMain.handle('db-get-questions-by-ids', (event, ids) => __awaiter(this, void 0, void 0, function* () { return getQuestionsByIds(ids); }));
    electron_1.ipcMain.handle('db-get-questions-for-session-blocks', (event, blocIds) => __awaiter(this, void 0, void 0, function* () { return getQuestionsForSessionBlocks(blocIds); }));
    // AdminSettings
    electron_1.ipcMain.handle('db-get-admin-setting', (event, key) => __awaiter(this, void 0, void 0, function* () { return getAdminSetting(key); }));
    electron_1.ipcMain.handle('db-set-admin-setting', (event, key, value) => __awaiter(this, void 0, void 0, function* () { return setAdminSetting(key, value); }));
    electron_1.ipcMain.handle('db-get-all-admin-settings', (event) => __awaiter(this, void 0, void 0, function* () { return getAllAdminSettings(); }));
    // Backup/Restore
    electron_1.ipcMain.handle('db-export-all-data', (event) => __awaiter(this, void 0, void 0, function* () { return exportAllData(); }));
    electron_1.ipcMain.handle('db-import-all-data', (event, data) => __awaiter(this, void 0, void 0, function* () { return importAllData(data); }));
    // PPTX Generation
    electron_1.ipcMain.handle('pptx-generate', (event, sessionInfo, participants, questions, template, adminSettings) => __awaiter(this, void 0, void 0, function* () {
        const { generatePresentation } = require('./pptxOrchestrator');
        let templateArrayBuffer;
        console.log("Type of template received in pptx-generate IPC handler:", typeof template, template instanceof ArrayBuffer, template && typeof template.arrayBuffer === 'function');
        if (template instanceof ArrayBuffer) {
            templateArrayBuffer = template;
        }
        else if (template && typeof template.arrayBuffer === 'function') {
            templateArrayBuffer = yield template.arrayBuffer();
        }
        else {
            throw new Error("Invalid template format provided to pptx-generate IPC handler.");
        }
        return generatePresentation(sessionInfo, participants, questions, templateArrayBuffer, adminSettings);
    }));
    electron_1.ipcMain.handle('save-pptx-file', (event, fileBuffer, fileName) => __awaiter(this, void 0, void 0, function* () {
        try {
            const orsSavePath = yield getAdminSetting('orsSavePath');
            if (!orsSavePath) {
                throw new Error("Le chemin de sauvegarde des ORS n'est pas configuré dans les paramètres techniques.");
            }
            const filePath = path.join(orsSavePath, fileName);
            yield fs.writeFile(filePath, Buffer.from(fileBuffer, 'base64'));
            return { success: true, filePath };
        }
        catch (error) {
            console.error('Failed to save PPTX file:', error);
            return { success: false, error: error.message };
        }
    }));
    // File Operations
    electron_1.ipcMain.handle('open-excel-file-dialog', (event) => __awaiter(this, void 0, void 0, function* () {
        const { canceled, filePaths } = yield electron_1.dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [
                { name: 'Fichiers Excel', extensions: ['xlsx', 'xls'] },
                { name: 'Tous les fichiers', extensions: ['*'] }
            ]
        });
        if (canceled || filePaths.length === 0) {
            return { canceled: true };
        }
        const filePath = filePaths[0];
        try {
            const fileBuffer = yield fs.readFile(filePath);
            return {
                canceled: false,
                fileName: filePath.split(/[\\/]/).pop(), // Get base name
                fileBuffer: fileBuffer.toString('base64') // Send as base64 string
            };
        }
        catch (error) {
            console.error('Failed to read file:', error);
            return { canceled: false, error: error.message };
        }
    }));
    electron_1.ipcMain.handle('open-directory-dialog', (event, filePath) => __awaiter(this, void 0, void 0, function* () {
        if (filePath) {
            const { shell } = require('electron');
            shell.showItemInFolder(filePath);
            return { canceled: false, path: require('path').dirname(filePath) };
        }
        const { canceled, filePaths } = yield electron_1.dialog.showOpenDialog({
            properties: ['openDirectory']
        });
        if (canceled || filePaths.length === 0) {
            return { canceled: true };
        }
        return { canceled: false, path: filePaths[0] };
    }));
    electron_1.ipcMain.handle('open-results-file', (event) => __awaiter(this, void 0, void 0, function* () {
        const { canceled, filePaths } = yield electron_1.dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [
                { name: 'Fichiers ORS', extensions: ['ors'] },
                { name: 'Tous les fichiers', extensions: ['*'] }
            ]
        });
        if (canceled || filePaths.length === 0) {
            return { canceled: true };
        }
        const filePath = filePaths[0];
        try {
            const fileBuffer = yield fs.readFile(filePath);
            return {
                canceled: false,
                fileName: filePath.split(/[\\/]/).pop(),
                fileBuffer: fileBuffer.toString('base64')
            };
        }
        catch (error) {
            console.error('Failed to read file:', error);
            return { canceled: false, error: error.message };
        }
    }));
    console.log('[IPC Handlers] IPC handlers registration attempt finished.');
}
