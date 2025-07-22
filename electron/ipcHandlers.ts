import { IpcMainInvokeEvent, ipcMain, dialog } from 'electron';
import {
    Participant, QuestionWithId, Session, SessionResult, SessionQuestion, SessionBoitier, VotingDevice, DeviceKit, Trainer, Referential, Theme, Bloc, Question
} from '../src/types/index';
import { AdminPPTXSettings } from './utils';
import { generatePresentation } from './utils/pptxOrchestrator'; // <--- Ajoutez cette ligne ici

import fs from 'fs/promises';
import path from 'path';

import {
    initializeDatabase, getDb, addQuestion, getAllQuestions, getQuestionById, getQuestionsByIds, updateQuestion, deleteQuestion, getQuestionsByBlocId, getQuestionsForSessionBlocks,
    getAdminSetting, setAdminSetting, getAllAdminSettings, getGlobalPptxTemplate, addSession, getAllSessions, getSessionById, updateSession, deleteSession, addSessionResult,
    addBulkSessionResults, getAllResults, getResultsForSession, getResultBySessionAndQuestion, updateSessionResult, deleteResultsForSession, addVotingDevice, getAllVotingDevices,
    updateVotingDevice, deleteVotingDevice, bulkAddVotingDevices, addTrainer, getAllTrainers, getTrainerById, updateTrainer, deleteTrainer, setDefaultTrainer, getDefaultTrainer,
    addSessionQuestion, addBulkSessionQuestions, getSessionQuestionsBySessionId, deleteSessionQuestionsBySessionId, addSessionBoitier, addBulkSessionBoitiers,
    getSessionBoitiersBySessionId, deleteSessionBoitiersBySessionId, addReferential, getAllReferentiels, getReferentialByCode, getReferentialById, addTheme, getAllThemes,
    getThemesByReferentialId, getThemeByCodeAndReferentialId, getThemeById, addBloc, getAllBlocs, getBlocsByThemeId, getBlocByCodeAndThemeId, getBlocById, addDeviceKit,
    getAllDeviceKits, getDeviceKitById, updateDeviceKit, deleteDeviceKit, getDefaultDeviceKit, setDefaultDeviceKit, assignDeviceToKit, removeDeviceFromKit, getVotingDevicesForKit,
    getKitsForVotingDevice, removeAssignmentsByKitId, removeAssignmentsByVotingDeviceId, calculateBlockUsage, exportAllData, importAllData
} from './db';

import { log } from './utils/logger';

let handlerInitialized = false;

export function initializeIpcHandlers() {
  if (handlerInitialized) {
    log('[IPC Handlers] Already initialized. Skipping.');
    return;
  }
  log('[IPC Handlers] Initializing IPC handlers...');
  handlerInitialized = true;

  // Sessions
  ipcMain.handle('db-get-all-sessions', async () => {
    log('[IPC] db-get-all-sessions');
    return getAllSessions();
  });
  ipcMain.handle('db-get-session-by-id', async (event: IpcMainInvokeEvent, sessionId: number) => {
    log(`[IPC] db-get-session-by-id: ${sessionId}`);
    return getSessionById(sessionId);
  });
  ipcMain.handle('db-add-session', async (event: IpcMainInvokeEvent, data: Session) => {
    log('[IPC] db-add-session');
    return addSession(data);
  });
  ipcMain.handle('db-update-session', async (event: IpcMainInvokeEvent, id: number, updates: Partial<Session>) => {
    log(`[IPC] db-update-session: ${id}`);
    return updateSession(id, updates);
  });

  // SessionResults
  ipcMain.handle('db-add-bulk-session-results', async (event: IpcMainInvokeEvent, results: SessionResult[]) => {
    log(`[IPC] db-add-bulk-session-results: adding ${results.length} results`);
    return addBulkSessionResults(results);
  });
  ipcMain.handle('db-get-results-for-session', async (event: IpcMainInvokeEvent, sessionId: number) => {
    log(`[IPC] db-get-results-for-session: ${sessionId}`);
    return getResultsForSession(sessionId);
  });

  // VotingDevices
  ipcMain.handle('db-get-all-voting-devices', async () => {
    log('[IPC] db-get-all-voting-devices');
    return getAllVotingDevices();
  });
  ipcMain.handle('db-add-voting-device', async (event: IpcMainInvokeEvent, device: VotingDevice) => {
    log('[IPC] db-add-voting-device');
    return addVotingDevice(device);
  });
  ipcMain.handle('db-update-voting-device', async (event: IpcMainInvokeEvent, id: number, updates: Partial<VotingDevice>) => {
    log(`[IPC] db-update-voting-device: ${id}`);
    return updateVotingDevice(id, updates);
  });
  ipcMain.handle('db-delete-voting-device', async (event: IpcMainInvokeEvent, id: number) => {
    log(`[IPC] db-delete-voting-device: ${id}`);
    return deleteVotingDevice(id);
  });
  ipcMain.handle('db-bulk-add-voting-devices', async (event: IpcMainInvokeEvent, devices: VotingDevice[]) => {
    log(`[IPC] db-bulk-add-voting-devices: adding ${devices.length} devices`);
    return bulkAddVotingDevices(devices);
  });

  // SessionQuestions
  ipcMain.handle('db-add-bulk-session-questions', async (event: IpcMainInvokeEvent, questions: SessionQuestion[]) => {
    log(`[IPC] db-add-bulk-session-questions: adding ${questions.length} questions`);
    return addBulkSessionQuestions(questions);
  });
  ipcMain.handle('db-delete-session-questions-by-session-id', async (event: IpcMainInvokeEvent, sessionId: number) => {
    log(`[IPC] db-delete-session-questions-by-session-id: ${sessionId}`);
    return deleteSessionQuestionsBySessionId(sessionId);
  });
  ipcMain.handle('db-get-session-questions-by-session-id', async (event: IpcMainInvokeEvent, sessionId: number) => {
    log(`[IPC] db-get-session-questions-by-session-id: ${sessionId}`);
    return getSessionQuestionsBySessionId(sessionId);
  });

  // SessionBoitiers
  ipcMain.handle('db-add-bulk-session-boitiers', async (event: IpcMainInvokeEvent, boitiers: SessionBoitier[]) => {
    log(`[IPC] db-add-bulk-session-boitiers: adding ${boitiers.length} boitiers`);
    return addBulkSessionBoitiers(boitiers);
  });
  ipcMain.handle('db-delete-session-boitiers-by-session-id', async (event: IpcMainInvokeEvent, sessionId: number) => {
    log(`[IPC] db-delete-session-boitiers-by-session-id: ${sessionId}`);
    return deleteSessionBoitiersBySessionId(sessionId);
  });
  ipcMain.handle('db-get-session-boitiers-by-session-id', async (event: IpcMainInvokeEvent, sessionId: number) => {
    log(`[IPC] db-get-session-boitiers-by-session-id: ${sessionId}`);
    return getSessionBoitiersBySessionId(sessionId);
  });

  // DeviceKits
  ipcMain.handle('db-get-voting-devices-for-kit', async (event: IpcMainInvokeEvent, kitId: number) => {
    log(`[IPC] db-get-voting-devices-for-kit: ${kitId}`);
    return getVotingDevicesForKit(kitId);
  });
  ipcMain.handle('db-get-all-device-kits', async () => {
    log('[IPC] db-get-all-device-kits');
    return getAllDeviceKits();
  });
  ipcMain.handle('db-get-default-device-kit', async () => {
    log('[IPC] db-get-default-device-kit');
    return getDefaultDeviceKit();
  });
  ipcMain.handle('db-add-device-kit', async (event: IpcMainInvokeEvent, data: DeviceKit) => {
    log('[IPC] db-add-device-kit');
    return addDeviceKit(data);
  });
  ipcMain.handle('db-update-device-kit', async (event: IpcMainInvokeEvent, id: number, updates: Partial<DeviceKit>) => {
    log(`[IPC] db-update-device-kit: ${id}`);
    return updateDeviceKit(id, updates);
  });
  ipcMain.handle('db-delete-device-kit', async (event: IpcMainInvokeEvent, id: number) => {
    log(`[IPC] db-delete-device-kit: ${id}`);
    return deleteDeviceKit(id);
  });
  ipcMain.handle('db-set-default-device-kit', async (event: IpcMainInvokeEvent, id: number) => {
    log(`[IPC] db-set-default-device-kit: ${id}`);
    return setDefaultDeviceKit(id);
  });
  ipcMain.handle('db-assign-device-to-kit', async (event: IpcMainInvokeEvent, kitId: number, votingDeviceId: number) => {
    log(`[IPC] db-assign-device-to-kit: kitId=${kitId}, deviceId=${votingDeviceId}`);
    return assignDeviceToKit(kitId, votingDeviceId);
  });
  ipcMain.handle('db-remove-device-from-kit', async (event: IpcMainInvokeEvent, kitId: number, votingDeviceId: number) => {
    log(`[IPC] db-remove-device-from-kit: kitId=${kitId}, deviceId=${votingDeviceId}`);
    return removeDeviceFromKit(kitId, votingDeviceId);
  });
  
  ipcMain.handle('db-get-kits-for-voting-device', async (event: IpcMainInvokeEvent, votingDeviceId: number) => {
    log(`[IPC] db-get-kits-for-voting-device: ${votingDeviceId}`);
    return getKitsForVotingDevice(votingDeviceId);
  });
  ipcMain.handle('db-remove-assignments-by-voting-device-id', async (event: IpcMainInvokeEvent, votingDeviceId: number) => {
    log(`[IPC] db-remove-assignments-by-voting-device-id: ${votingDeviceId}`);
    return removeAssignmentsByVotingDeviceId(votingDeviceId);
  });

  // Referentiels
  ipcMain.handle('db-add-referential', async (event: IpcMainInvokeEvent, data: Referential) => {
    log('[IPC] db-add-referential');
    return addReferential(data);
  });
  ipcMain.handle('db-get-all-referentiels', async () => {
    log('[IPC] db-get-all-referentiels');
    return getAllReferentiels();
  });
  ipcMain.handle('db-get-referential-by-code', async (event: IpcMainInvokeEvent, code: string) => {
    log(`[IPC] db-get-referential-by-code: ${code}`);
    return getReferentialByCode(code);
  });
  ipcMain.handle('db-get-referential-by-id', async (event: IpcMainInvokeEvent, id: number) => {
    log(`[IPC] db-get-referential-by-id: ${id}`);
    return getReferentialById(id);
  });

  // Trainers
  ipcMain.handle('db-get-all-trainers', async () => {
    log('[IPC] db-get-all-trainers');
    return getAllTrainers();
  });
  ipcMain.handle('db-add-trainer', async (event: IpcMainInvokeEvent, data: Trainer) => {
    log('[IPC] db-add-trainer');
    return addTrainer(data);
  });
  ipcMain.handle('db-delete-trainer', async (event: IpcMainInvokeEvent, id: number) => {
    log(`[IPC] db-delete-trainer: ${id}`);
    return deleteTrainer(id);
  });
  ipcMain.handle('db-set-default-trainer', async (event: IpcMainInvokeEvent, id: number) => {
    log(`[IPC] db-set-default-trainer: ${id}`);
    return setDefaultTrainer(id);
  });
  ipcMain.handle('db-update-trainer', async (event: IpcMainInvokeEvent, id: number, updates: Partial<Trainer>) => {
    log(`[IPC] db-update-trainer: ${id}`);
    return updateTrainer(id, updates);
  });

  // Themes
  ipcMain.handle('db-add-theme', async (event: IpcMainInvokeEvent, data: Theme) => {
    log('[IPC] db-add-theme');
    return addTheme(data);
  });
  ipcMain.handle('db-get-theme-by-code-and-referential-id', async (event: IpcMainInvokeEvent, code: string, refId: number) => {
    log(`[IPC] db-get-theme-by-code-and-referential-id: code=${code}, refId=${refId}`);
    return getThemeByCodeAndReferentialId(code, refId);
  });
  ipcMain.handle('db-get-themes-by-referential-id', async (event: IpcMainInvokeEvent, refId: number) => {
    log(`[IPC] db-get-themes-by-referential-id: ${refId}`);
    return getThemesByReferentialId(refId);
  });
  ipcMain.handle('db-get-theme-by-id', async (event: IpcMainInvokeEvent, id: number) => {
    log(`[IPC] db-get-theme-by-id: ${id}`);
    return getThemeById(id);
  });
  ipcMain.handle('db-get-all-themes', async () => {
    log('[IPC] db-get-all-themes');
    return getAllThemes();
  });

  // Blocs
  ipcMain.handle('db-add-bloc', async (event: IpcMainInvokeEvent, data: Bloc) => {
    log('[IPC] db-add-bloc');
    return addBloc(data);
  });
  ipcMain.handle('db-get-bloc-by-code-and-theme-id', async (event: IpcMainInvokeEvent, code: string, themeId: number) => {
    log(`[IPC] db-get-bloc-by-code-and-theme-id: code=${code}, themeId=${themeId}`);
    return getBlocByCodeAndThemeId(code, themeId);
  });
  ipcMain.handle('db-get-blocs-by-theme-id', async (event: IpcMainInvokeEvent, themeId: number) => {
    log(`[IPC] db-get-blocs-by-theme-id: ${themeId}`);
    return getBlocsByThemeId(themeId);
  });
  ipcMain.handle('db-get-bloc-by-id', async (event: IpcMainInvokeEvent, id: number) => {
    log(`[IPC] db-get-bloc-by-id: ${id}`);
    return getBlocById(id);
  });
  ipcMain.handle('db-get-all-blocs', async () => {
    log('[IPC] db-get-all-blocs');
    return getAllBlocs();
  });

  // Questions
  ipcMain.handle('db-add-question', async (event: IpcMainInvokeEvent, data: Question) => {
    log('[IPC] db-add-question');
    const questionToAdd = {
      ...data,
      blocId: data.blocId === undefined ? null : data.blocId // Assure que blocId est number ou null
    };
    return addQuestion(questionToAdd as Omit<QuestionWithId, 'id'>);
  });
  ipcMain.handle('db-get-question-by-id', async (event: IpcMainInvokeEvent, id: number) => {
    log(`[IPC] db-get-question-by-id: ${id}`);
    return getQuestionById(id);
  });
  ipcMain.handle('db-get-questions-by-bloc-id', async (event: IpcMainInvokeEvent, blocId: number) => {
    log(`[IPC] db-get-questions-by-bloc-id: ${blocId}`);
    return getQuestionsByBlocId(blocId);
  });
  ipcMain.handle('db-update-question', async (event: IpcMainInvokeEvent, id: number, updates: Partial<Question>) => {
    log(`[IPC] db-update-question: ${id}`);
    return updateQuestion(id, updates);
  });
  ipcMain.handle('db-delete-question', async (event: IpcMainInvokeEvent, id: number) => {
    log(`[IPC] db-delete-question: ${id}`);
    return deleteQuestion(id);
  });
  ipcMain.handle('db-get-all-questions', async () => {
    log('[IPC] db-get-all-questions');
    return getAllQuestions();
  });
  ipcMain.handle('db-get-questions-by-ids', async (event: IpcMainInvokeEvent, ids: number[]) => {
    log(`[IPC] db-get-questions-by-ids: ${ids.length} ids`);
    return getQuestionsByIds(ids);
  });
  ipcMain.handle('db-get-questions-for-session-blocks', async (event: IpcMainInvokeEvent, blocIds?: number[]) => {
    log(`[IPC] db-get-questions-for-session-blocks: ${blocIds?.length || 0} blocIds`);
    return getQuestionsForSessionBlocks(blocIds);
  });

  // AdminSettings
  ipcMain.handle('db-get-admin-setting', async (event: IpcMainInvokeEvent, key: string) => {
    log(`[IPC] db-get-admin-setting: ${key}`);
    return getAdminSetting(key);
  });
  ipcMain.handle('db-set-admin-setting', async (event: IpcMainInvokeEvent, key: string, value: any) => {
    log(`[IPC] db-set-admin-setting: ${key}`);
    return setAdminSetting(key, value);
  });
  ipcMain.handle('db-get-all-admin-settings', async () => {
    log('[IPC] db-get-all-admin-settings');
    return getAllAdminSettings();
  });

  // Backup/Restore
  ipcMain.handle('db-export-all-data', async () => {
    log('[IPC] db-export-all-data');
    return exportAllData();
  });
  ipcMain.handle('db-import-all-data', async (event: IpcMainInvokeEvent, data: any) => {
    log('[IPC] db-import-all-data');
    return importAllData(data);
  });

  // PPTX Generation
  ipcMain.handle('pptx-generate', async (event: IpcMainInvokeEvent, sessionInfo: { name: string; date: string; referential: string }, participants: Participant[], questions: QuestionWithId[], template: any, adminSettings: AdminPPTXSettings) => {
    log(`[IPC] pptx-generate: Generating presentation for session ${sessionInfo.name}`);
    let templateArrayBuffer: ArrayBuffer;

    if (template === 'tool_default_template') {
      const templatePath = path.join(__dirname, '../../public/templates/default.pptx');
      try {
        templateArrayBuffer = await fs.readFile(templatePath);
      } catch (error) {
        log(`Failed to read default PPTX template within pptx-generate: ${error}`);
        throw new Error('Could not load default PPTX template.');
      }
    } else if (template && template.type === 'Buffer' && Array.isArray(template.data)) {
      templateArrayBuffer = Buffer.from(template.data);
    } else if (template instanceof ArrayBuffer) {
      templateArrayBuffer = template;
    } else if (template && typeof template.arrayBuffer === 'function') {
      templateArrayBuffer = await template.arrayBuffer();
    } else {
      throw new Error("Invalid template format provided to pptx-generate IPC handler.");
    }

    return generatePresentation(sessionInfo, participants, questions, templateArrayBuffer, adminSettings);
  });

  ipcMain.handle('get-default-pptx-template', async () => {
    log('[IPC] get-default-pptx-template');
    const templatePath = path.join(__dirname, '../../public/templates/default.pptx');
    log(`[get-default-pptx-template] Calculated template path: ${templatePath}`);
    try {
      const fileBuffer = await fs.readFile(templatePath);
      log(`[get-default-pptx-template] Successfully read file, buffer length: ${fileBuffer.length}`);
      return fileBuffer;
    } catch (error) {
      log(`[get-default-pptx-template] Failed to read default PPTX template: ${error}`);
      throw new Error('Could not load default PPTX template.');
    }
  });

  ipcMain.handle('save-pptx-file', async (event: IpcMainInvokeEvent, fileBuffer: ArrayBuffer, fileName: string) => {
    log(`[IPC] save-pptx-file: ${fileName}`);
    try {
      const orsSavePath = await getAdminSetting('orsSavePath');
      if (!orsSavePath) {
        throw new Error("Le chemin de sauvegarde des ORS n'est pas configuré dans les paramètres techniques.");
      }

      const filePath = path.join(orsSavePath, fileName);
      await fs.writeFile(filePath, Buffer.from(fileBuffer));
      return { success: true, filePath };
    } catch (error: any) {
      log(`Failed to save PPTX file: ${error}`);
      return { success: false, error: error.message };
    }
  });

  // File Operations
  ipcMain.handle('open-excel-file-dialog', async (event: IpcMainInvokeEvent) => {
    log('[IPC] open-excel-file-dialog');
    const { canceled, filePaths } = await dialog.showOpenDialog({
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
      const fileBuffer = await fs.readFile(filePath);
      return {
        canceled: false,
        fileName: filePath.split(/[\\/]/).pop(), // Get base name
        fileBuffer: fileBuffer.toString('base64') // Send as base64 string
      };
    } catch (error: any) {
      log(`Failed to read file: ${error}`);
      return { canceled: false, error: error.message };
    }
  });

  ipcMain.handle('open-directory-dialog', async (event: IpcMainInvokeEvent, filePath?: string) => {
    log(`[IPC] open-directory-dialog: ${filePath || ''}`);
    if (filePath) {
      const { shell } = require('electron');
      shell.showItemInFolder(filePath);
      return { canceled: false, path: require('path').dirname(filePath) };
    }
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });

    if (canceled || filePaths.length === 0) {
      return { canceled: true };
    }

    return { canceled: false, path: filePaths[0] };
  });

  ipcMain.handle('open-results-file', async (event: IpcMainInvokeEvent) => {
    log('[IPC] open-results-file');
    const { canceled, filePaths } = await dialog.showOpenDialog({
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
      const fileBuffer = await fs.readFile(filePath);
      return {
        canceled: false,
        fileName: filePath.split(/[\\/]/).pop(),
        fileBuffer: fileBuffer.toString('base64')
      };
    } catch (error: any) {
      log(`Failed to read file: ${error}`);
      return { canceled: false, error: error.message };
    }
  });

  ipcMain.handle('read-image-file', async (event: IpcMainInvokeEvent, filePath: string) => {
    log(`[IPC] read-image-file: ${filePath}`);
    try {
      const fileBuffer = await fs.readFile(filePath);
      return fileBuffer.toString('base64');
    } catch (error: any) {
      log(`Failed to read image file: ${error}`);
      throw new Error(`Could not read image file: ${error.message}`);
    }
  });

  log('[IPC Handlers] IPC handlers registration attempt finished.');
}