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

let handlerInitialized = false;

export function initializeIpcHandlers() {
  if (handlerInitialized) {
    console.log('[IPC Handlers] Already initialized. Skipping.');
    return;
  }
  console.log('[IPC Handlers] Initializing IPC handlers...');
  handlerInitialized = true;

  // Sessions
  ipcMain.handle('db-get-all-sessions', getAllSessions);
  ipcMain.handle('db-get-session-by-id', (event: IpcMainInvokeEvent, sessionId: number) => getSessionById(sessionId));
  ipcMain.handle('db-add-session', (event: IpcMainInvokeEvent, data: Session) => addSession(data));
  ipcMain.handle('db-update-session', (event: IpcMainInvokeEvent, id: number, updates: Partial<Session>) => updateSession(id, updates));

  // SessionResults
  ipcMain.handle('db-add-bulk-session-results', (event: IpcMainInvokeEvent, results: SessionResult[]) => addBulkSessionResults(results));
  ipcMain.handle('db-get-results-for-session', (event: IpcMainInvokeEvent, sessionId: number) => getResultsForSession(sessionId));

  // VotingDevices
  ipcMain.handle('db-get-all-voting-devices', getAllVotingDevices);
  ipcMain.handle('db-add-voting-device', (event: IpcMainInvokeEvent, device: VotingDevice) => addVotingDevice(device));
  ipcMain.handle('db-update-voting-device', (event: IpcMainInvokeEvent, id: number, updates: Partial<VotingDevice>) => updateVotingDevice(id, updates));
  ipcMain.handle('db-delete-voting-device', (event: IpcMainInvokeEvent, id: number) => deleteVotingDevice(id));
  ipcMain.handle('db-bulk-add-voting-devices', (event: IpcMainInvokeEvent, devices: VotingDevice[]) => bulkAddVotingDevices(devices));

  // SessionQuestions
    ipcMain.handle('db-add-bulk-session-questions', (event: IpcMainInvokeEvent, questions: SessionQuestion[]) => addBulkSessionQuestions(questions));
  ipcMain.handle('db-delete-session-questions-by-session-id', (event: IpcMainInvokeEvent, sessionId: number) => deleteSessionQuestionsBySessionId(sessionId));
  ipcMain.handle('db-get-session-questions-by-session-id', (event: IpcMainInvokeEvent, sessionId: number) => getSessionQuestionsBySessionId(sessionId));

  // SessionBoitiers
  ipcMain.handle('db-add-bulk-session-boitiers', (event: IpcMainInvokeEvent, boitiers: SessionBoitier[]) => addBulkSessionBoitiers(boitiers));
  ipcMain.handle('db-delete-session-boitiers-by-session-id', (event: IpcMainInvokeEvent, sessionId: number) => deleteSessionBoitiersBySessionId(sessionId));
  ipcMain.handle('db-get-session-boitiers-by-session-id', (event: IpcMainInvokeEvent, sessionId: number) => getSessionBoitiersBySessionId(sessionId));

  // DeviceKits
    ipcMain.handle('db-get-voting-devices-for-kit', (event: IpcMainInvokeEvent, kitId: number) => getVotingDevicesForKit(kitId));
  ipcMain.handle('db-get-all-device-kits', getAllDeviceKits);
  ipcMain.handle('db-get-default-device-kit', getDefaultDeviceKit);
  ipcMain.handle('db-add-device-kit', (event: IpcMainInvokeEvent, data: DeviceKit) => addDeviceKit(data));
  ipcMain.handle('db-update-device-kit', (event: IpcMainInvokeEvent, id: number, updates: Partial<DeviceKit>) => updateDeviceKit(id, updates));
  ipcMain.handle('db-delete-device-kit', (event: IpcMainInvokeEvent, id: number) => deleteDeviceKit(id));
  ipcMain.handle('db-set-default-device-kit', (event: IpcMainInvokeEvent, id: number) => setDefaultDeviceKit(id));
    ipcMain.handle('db-assign-device-to-kit', (event: IpcMainInvokeEvent, kitId: number, votingDeviceId: number) => assignDeviceToKit(kitId, votingDeviceId));
  ipcMain.handle('db-remove-device-from-kit', (event: IpcMainInvokeEvent, kitId: number, votingDeviceId: number) => removeDeviceFromKit(kitId, votingDeviceId));
  
  ipcMain.handle('db-get-kits-for-voting-device', (event: IpcMainInvokeEvent, votingDeviceId: number) => getKitsForVotingDevice(votingDeviceId));
  ipcMain.handle('db-remove-assignments-by-voting-device-id', (event: IpcMainInvokeEvent, votingDeviceId: number) => removeAssignmentsByVotingDeviceId(votingDeviceId));

  // Referentiels
  ipcMain.handle('db-add-referential', (event: IpcMainInvokeEvent, data: Referential) => addReferential(data));
  ipcMain.handle('db-get-all-referentiels', getAllReferentiels);
  ipcMain.handle('db-get-referential-by-code', (event: IpcMainInvokeEvent, code: string) => getReferentialByCode(code));
  ipcMain.handle('db-get-referential-by-id', (event: IpcMainInvokeEvent, id: number) => getReferentialById(id));

  // Trainers
  ipcMain.handle('db-get-all-trainers', getAllTrainers);
  ipcMain.handle('db-add-trainer', (event: IpcMainInvokeEvent, data: Trainer) => addTrainer(data));
  ipcMain.handle('db-delete-trainer', (event: IpcMainInvokeEvent, id: number) => deleteTrainer(id));
  ipcMain.handle('db-set-default-trainer', (event: IpcMainInvokeEvent, id: number) => setDefaultTrainer(id));
  ipcMain.handle('db-update-trainer', (event: IpcMainInvokeEvent, id: number, updates: Partial<Trainer>) => updateTrainer(id, updates));

  // Themes
  ipcMain.handle('db-add-theme', (event: IpcMainInvokeEvent, data: Theme) => addTheme(data));
  ipcMain.handle('db-get-theme-by-code-and-referential-id', (event: IpcMainInvokeEvent, code: string, refId: number) => getThemeByCodeAndReferentialId(code, refId));
  ipcMain.handle('db-get-themes-by-referential-id', (event: IpcMainInvokeEvent, refId: number) => getThemesByReferentialId(refId));
  ipcMain.handle('db-get-theme-by-id', (event: IpcMainInvokeEvent, id: number) => getThemeById(id));
  ipcMain.handle('db-get-all-themes', getAllThemes);

  // Blocs
  ipcMain.handle('db-add-bloc', (event: IpcMainInvokeEvent, data: Bloc) => addBloc(data));
  ipcMain.handle('db-get-bloc-by-code-and-theme-id', (event: IpcMainInvokeEvent, code: string, themeId: number) => getBlocByCodeAndThemeId(code, themeId));
  ipcMain.handle('db-get-blocs-by-theme-id', (event: IpcMainInvokeEvent, themeId: number) => getBlocsByThemeId(themeId));
  ipcMain.handle('db-get-bloc-by-id', (event: IpcMainInvokeEvent, id: number) => getBlocById(id));
  ipcMain.handle('db-get-all-blocs', getAllBlocs);

  // Questions
 ipcMain.handle('db-add-question', (event: IpcMainInvokeEvent, data: Question) => {
  const questionToAdd = {
    ...data,
    blocId: data.blocId === undefined ? null : data.blocId // Assure que blocId est number ou null
    };
  return addQuestion(questionToAdd as Omit<QuestionWithId, 'id'>);
   });
  ipcMain.handle('db-get-question-by-id', (event: IpcMainInvokeEvent, id: number) => getQuestionById(id));
  ipcMain.handle('db-get-questions-by-bloc-id', (event: IpcMainInvokeEvent, blocId: number) => getQuestionsByBlocId(blocId));
  ipcMain.handle('db-update-question', (event: IpcMainInvokeEvent, id: number, updates: Partial<Question>) => updateQuestion(id, updates));
  ipcMain.handle('db-delete-question', (event: IpcMainInvokeEvent, id: number) => deleteQuestion(id));
  ipcMain.handle('db-get-all-questions', getAllQuestions);
  ipcMain.handle('db-get-questions-by-ids', (event: IpcMainInvokeEvent, ids: number[]) => getQuestionsByIds(ids));
  ipcMain.handle('db-get-questions-for-session-blocks', (event: IpcMainInvokeEvent, blocIds?: number[]) => getQuestionsForSessionBlocks(blocIds));

  // AdminSettings
  ipcMain.handle('db-get-admin-setting', (event: IpcMainInvokeEvent, key: string) => getAdminSetting(key));
  ipcMain.handle('db-set-admin-setting', (event: IpcMainInvokeEvent, key: string, value: any) => setAdminSetting(key, value));
  ipcMain.handle('db-get-all-admin-settings', getAllAdminSettings);

  // Backup/Restore
  ipcMain.handle('db-export-all-data', exportAllData);
  ipcMain.handle('db-import-all-data', (event: IpcMainInvokeEvent, data: any) => importAllData(data));

  // PPTX Generation
  ipcMain.handle('pptx-generate', async (event: IpcMainInvokeEvent, sessionInfo: { name: string; date: string; referential: string }, participants: Participant[], questions: QuestionWithId[], template: any, adminSettings: AdminPPTXSettings) => {
    let templateArrayBuffer: ArrayBuffer;

    if (template === 'tool_default_template') {
      const templatePath = path.join(__dirname, '../../public/templates/default.pptx');
      try {
        templateArrayBuffer = await fs.readFile(templatePath);
      } catch (error) {
        console.error('Failed to read default PPTX template within pptx-generate:', error);
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
    const templatePath = path.join(__dirname, '../../public/templates/default.pptx');
    console.log('[get-default-pptx-template] Calculated template path:', templatePath);
    try {
      const fileBuffer = await fs.readFile(templatePath);
      console.log('[get-default-pptx-template] Successfully read file, buffer length:', fileBuffer.length);
      return fileBuffer;
    } catch (error) {
      console.error('[get-default-pptx-template] Failed to read default PPTX template:', error);
      throw new Error('Could not load default PPTX template.');
    }
  });

  ipcMain.handle('save-pptx-file', async (event: IpcMainInvokeEvent, fileBuffer: ArrayBuffer, fileName: string) => {
    try {
      const orsSavePath = await getAdminSetting('orsSavePath');
      if (!orsSavePath) {
        throw new Error("Le chemin de sauvegarde des ORS n'est pas configuré dans les paramètres techniques.");
      }

      const filePath = path.join(orsSavePath, fileName);
      await fs.writeFile(filePath, Buffer.from(fileBuffer, 'base64'));
      return { success: true, filePath };
    } catch (error: any) {
      console.error('Failed to save PPTX file:', error);
      return { success: false, error: error.message };
    }
  });

  // File Operations
  ipcMain.handle('open-excel-file-dialog', async (event: IpcMainInvokeEvent) => {
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
      console.error('Failed to read file:', error);
      return { canceled: false, error: error.message };
    }
  });

  ipcMain.handle('open-directory-dialog', async (event: IpcMainInvokeEvent, filePath?: string) => {
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
      console.error('Failed to read file:', error);
      return { canceled: false, error: error.message };
    }
  });

  ipcMain.handle('read-image-file', async (event: IpcMainInvokeEvent, filePath: string) => {
    try {
      const fileBuffer = await fs.readFile(filePath);
      return fileBuffer.toString('base64');
    } catch (error: any) {
      console.error('Failed to read image file:', error);
      throw new Error(`Could not read image file: ${error.message}`);
    }
  });

  console.log('[IPC Handlers] IPC handlers registration attempt finished.');
}