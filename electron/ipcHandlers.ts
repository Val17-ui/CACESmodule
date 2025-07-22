import { IpcMainInvokeEvent, ipcMain, dialog } from 'electron';
import { Participant, QuestionWithId, Session, SessionResult, SessionQuestion, SessionBoitier, VotingDevice, DeviceKit, Trainer, Referential, Theme, Bloc, Question } from
     '../src/types/index';
import { AdminPPTXSettings } from './utils';
import { generatePresentation } from './utils/pptxOrchestrator'; // <--- Ajoutez cette ligne ici

import fs from 'fs/promises';
import path from 'path';

import * as db from './db';

export function initializeIpcHandlers() {
  console.log('[IPC Handlers] Initializing IPC handlers...');

  // Sessions
  ipcMain.handle('db-get-all-sessions', async () => db.getAllSessions());
  ipcMain.handle('db-get-session-by-id', async (event: IpcMainInvokeEvent, sessionId: number) => db.getSessionById(sessionId));
  ipcMain.handle('db-add-session', async (event: IpcMainInvokeEvent, data: Session) => db.addSession(data));
  ipcMain.handle('db-update-session', async (event: IpcMainInvokeEvent, id: number, updates: Partial<Session>) => db.updateSession(id, updates));

  // SessionResults
  ipcMain.handle('db-add-bulk-session-results', async (event: IpcMainInvokeEvent, results: SessionResult[]) => db.addBulkSessionResults(results));
  ipcMain.handle('db-get-results-for-session', async (event: IpcMainInvokeEvent, sessionId: number) => db.getResultsForSession(sessionId));

  // VotingDevices
  ipcMain.handle('db-get-all-voting-devices', async () => db.getAllVotingDevices());
  ipcMain.handle('db-add-voting-device', async (event: IpcMainInvokeEvent, device: VotingDevice) => db.addVotingDevice(device));
  ipcMain.handle('db-update-voting-device', async (event: IpcMainInvokeEvent, id: number, updates: Partial<VotingDevice>) => db.updateVotingDevice(id, updates));
  ipcMain.handle('db-delete-voting-device', async (event: IpcMainInvokeEvent, id: number) => db.deleteVotingDevice(id));
  ipcMain.handle('db-bulk-add-voting-devices', async (event: IpcMainInvokeEvent, devices: VotingDevice[]) => db.bulkAddVotingDevices(devices));

  // SessionQuestions
    ipcMain.handle('db-add-bulk-session-questions', async (event: IpcMainInvokeEvent, questions: SessionQuestion[]) => db.addBulkSessionQuestions(questions));
  ipcMain.handle('db-delete-session-questions-by-session-id', async (event: IpcMainInvokeEvent, sessionId: number) => db.deleteSessionQuestionsBySessionId(sessionId));
  ipcMain.handle('db-get-session-questions-by-session-id', async (event: IpcMainInvokeEvent, sessionId: number) => db.getSessionQuestionsBySessionId(sessionId));

  // SessionBoitiers
  ipcMain.handle('db-add-bulk-session-boitiers', async (event: IpcMainInvokeEvent, boitiers: SessionBoitier[]) => db.addBulkSessionBoitiers(boitiers));
  ipcMain.handle('db-delete-session-boitiers-by-session-id', async (event: IpcMainInvokeEvent, sessionId: number) => db.deleteSessionBoitiersBySessionId(sessionId));
  ipcMain.handle('db-get-session-boitiers-by-session-id', async (event: IpcMainInvokeEvent, sessionId: number) => db.getSessionBoitiersBySessionId(sessionId));

  // DeviceKits
    ipcMain.handle('db-get-voting-devices-for-kit', async (event: IpcMainInvokeEvent, kitId: number) => db.getVotingDevicesForKit(kitId));
  ipcMain.handle('db-get-all-device-kits', async () => db.getAllDeviceKits());
  ipcMain.handle('db-get-default-device-kit', async () => db.getDefaultDeviceKit());
  ipcMain.handle('db-add-device-kit', async (event: IpcMainInvokeEvent, data: DeviceKit) => db.addDeviceKit(data));
  ipcMain.handle('db-update-device-kit', async (event: IpcMainInvokeEvent, id: number, updates: Partial<DeviceKit>) => db.updateDeviceKit(id, updates));
  ipcMain.handle('db-delete-device-kit', async (event: IpcMainInvokeEvent, id: number) => db.deleteDeviceKit(id));
  ipcMain.handle('db-set-default-device-kit', async (event: IpcMainInvokeEvent, id: number) => db.setDefaultDeviceKit(id));
    ipcMain.handle('db-assign-device-to-kit', async (event: IpcMainInvokeEvent, kitId: number, votingDeviceId: number) => db.assignDeviceToKit(kitId, votingDeviceId));
  ipcMain.handle('db-remove-device-from-kit', async (event: IpcMainInvokeEvent, kitId: number, votingDeviceId: number) => db.removeDeviceFromKit(kitId, votingDeviceId));
  
  ipcMain.handle('db-get-kits-for-voting-device', async (event: IpcMainInvokeEvent, votingDeviceId: number) => db.getKitsForVotingDevice(votingDeviceId));
  ipcMain.handle('db-remove-assignments-by-voting-device-id', async (event: IpcMainInvokeEvent, votingDeviceId: number) => db.removeAssignmentsByVotingDeviceId(votingDeviceId));

  // Referentiels
  ipcMain.handle('db-add-referential', async (event: IpcMainInvokeEvent, data: Referential) => db.addReferential(data));
  ipcMain.handle('db-get-all-referentiels', async () => db.getAllReferentiels());
  ipcMain.handle('db-get-referential-by-code', async (event: IpcMainInvokeEvent, code: string) => db.getReferentialByCode(code));
  ipcMain.handle('db-get-referential-by-id', async (event: IpcMainInvokeEvent, id: number) => db.getReferentialById(id));

  // Trainers
  ipcMain.handle('db-get-all-trainers', async () => db.getAllTrainers());
  ipcMain.handle('db-add-trainer', async (event: IpcMainInvokeEvent, data: Trainer) => db.addTrainer(data));
  ipcMain.handle('db-delete-trainer', async (event: IpcMainInvokeEvent, id: number) => db.deleteTrainer(id));
  ipcMain.handle('db-set-default-trainer', async (event: IpcMainInvokeEvent, id: number) => db.setDefaultTrainer(id));
  ipcMain.handle('db-update-trainer', async (event: IpcMainInvokeEvent, id: number, updates: Partial<Trainer>) => db.updateTrainer(id, updates));

  // Themes
  ipcMain.handle('db-add-theme', async (event: IpcMainInvokeEvent, data: Theme) => db.addTheme(data));
  ipcMain.handle('db-get-theme-by-code-and-referential-id', async (event: IpcMainInvokeEvent, code: string, refId: number) => db.getThemeByCodeAndReferentialId(code, refId));
  ipcMain.handle('db-get-themes-by-referential-id', async (event: IpcMainInvokeEvent, refId: number) => db.getThemesByReferentialId(refId));
  ipcMain.handle('db-get-theme-by-id', async (event: IpcMainInvokeEvent, id: number) => db.getThemeById(id));
  ipcMain.handle('db-get-all-themes', async () => db.getAllThemes());

  // Blocs
  ipcMain.handle('db-add-bloc', async (event: IpcMainInvokeEvent, data: Bloc) => db.addBloc(data));
  ipcMain.handle('db-get-bloc-by-code-and-theme-id', async (event: IpcMainInvokeEvent, code: string, themeId: number) => db.getBlocByCodeAndThemeId(code, themeId));
  ipcMain.handle('db-get-blocs-by-theme-id', async (event: IpcMainInvokeEvent, themeId: number) => db.getBlocsByThemeId(themeId));
  ipcMain.handle('db-get-bloc-by-id', async (event: IpcMainInvokeEvent, id: number) => db.getBlocById(id));
  ipcMain.handle('db-get-all-blocs', async () => db.getAllBlocs());

  // Questions
 ipcMain.handle('db-add-question', async (event: IpcMainInvokeEvent, data: Question) => {
  const questionToAdd = {
    ...data,
    blocId: data.blocId === undefined ? null : data.blocId // Assure que blocId est number ou null
    };
  return db.addQuestion(questionToAdd as Omit<QuestionWithId, 'id'>);
   });
  ipcMain.handle('db-get-question-by-id', async (event: IpcMainInvokeEvent, id: number) => db.getQuestionById(id));
  ipcMain.handle('db-get-questions-by-bloc-id', async (event: IpcMainInvokeEvent, blocId: number) => db.getQuestionsByBlocId(blocId));
  ipcMain.handle('db-update-question', async (event: IpcMainInvokeEvent, id: number, updates: Partial<Question>) => db.updateQuestion(id, updates));
  ipcMain.handle('db-delete-question', async (event: IpcMainInvokeEvent, id: number) => db.deleteQuestion(id));
  ipcMain.handle('db-get-all-questions', async () => db.getAllQuestions());
  ipcMain.handle('db-get-questions-by-ids', async (event: IpcMainInvokeEvent, ids: number[]) => db.getQuestionsByIds(ids));
  ipcMain.handle('db-get-questions-for-session-blocks', async (event: IpcMainInvokeEvent, blocIds?: number[]) => db.getQuestionsForSessionBlocks(blocIds));

  // AdminSettings
  ipcMain.handle('db-get-admin-setting', async (event: IpcMainInvokeEvent, key: string) => db.getAdminSetting(key));
  ipcMain.handle('db-set-admin-setting', async (event: IpcMainInvokeEvent, key: string, value: any) => db.setAdminSetting(key, value));
  ipcMain.handle('db-get-all-admin-settings', async (event: IpcMainInvokeEvent) => db.getAllAdminSettings());

  // Backup/Restore
  ipcMain.handle('db-export-all-data', async (event: IpcMainInvokeEvent) => db.exportAllData());
  ipcMain.handle('db-import-all-data', async (event: IpcMainInvokeEvent, data: any) => db.importAllData(data));

  // PPTX Generation

  ipcMain.handle('db-get-question-by-id', async (event: IpcMainInvokeEvent, id: number) => db.getQuestionById(id));
  ipcMain.handle('db-get-questions-by-bloc-id', async (event: IpcMainInvokeEvent, blocId: number) => db.getQuestionsByBlocId(blocId));
  ipcMain.handle('db-update-question', async (event: IpcMainInvokeEvent, id: number, updates: Partial<Question>) => db.updateQuestion(id, updates));
  ipcMain.handle('db-delete-question', async (event: IpcMainInvokeEvent, id: number) => db.deleteQuestion(id));
  ipcMain.handle('db-get-all-questions', async () => db.getAllQuestions());
  ipcMain.handle('db-get-questions-by-ids', async (event: IpcMainInvokeEvent, ids: number[]) => db.getQuestionsByIds(ids));
  ipcMain.handle('db-get-questions-for-session-blocks', async (event: IpcMainInvokeEvent, blocIds?: number[]) => db.getQuestionsForSessionBlocks(blocIds));

  // AdminSettings
  ipcMain.handle('db-get-admin-setting', async (event: IpcMainInvokeEvent, key: string) => db.getAdminSetting(key));
  ipcMain.handle('db-set-admin-setting', async (event: IpcMainInvokeEvent, key: string, value: any) => db.setAdminSetting(key, value));
  ipcMain.handle('db-get-all-admin-settings', async (event: IpcMainInvokeEvent) => db.getAllAdminSettings());

  // Backup/Restore
  ipcMain.handle('db-export-all-data', async (event: IpcMainInvokeEvent) => db.exportAllData());
  ipcMain.handle('db-import-all-data', async (event: IpcMainInvokeEvent, data: any) => db.importAllData(data));

  // PPTX Generation
  ipcMain.handle('pptx-generate', async (event: IpcMainInvokeEvent, sessionInfo: { name: string; date: string; referential: string }, participants: Participant[], questions: QuestionWithId[], template: any, adminSettings: AdminPPTXSettings) => {
    let templateArrayBuffer: ArrayBuffer;

    if (template === 'tool_default_template') {
      const templatePath = path.join(__dirname, '..', 'public', 'templates', 'default.pptx');
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
    const templatePath = path.join(__dirname, '..', 'public', 'templates', 'default.pptx');
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

  ipcMain.handle('save-pptx-file', async (event: IpcMainInvokeEvent, fileBuffer: string, fileName: string) => {
    try {
      const orsSavePath = await db.getAdminSetting('orsSavePath');
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