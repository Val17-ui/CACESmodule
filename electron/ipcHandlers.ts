import { IpcMainInvokeEvent, ipcMain, dialog } from 'electron';
import {
    Participant, QuestionWithId, Session, SessionResult, SessionQuestion, SessionBoitier, VotingDevice, DeviceKit, Trainer, Referential, Theme, Bloc, Question
} from '../src/types/index';
import { AdminPPTXSettings } from './utils';
import { generatePresentation } from './utils/pptxOrchestrator'; // <--- Ajoutez cette ligne ici

import fs from 'fs/promises';
import path from 'path';

import * as dbModule from './db.js';

import { getLogger, ILogger } from './utils/logger';

let handlerInitialized = false;

module.exports.initializeIpcHandlers = function initializeIpcHandlers(loggerInstance: ILogger) {
  const logger = loggerInstance;
  if (handlerInitialized) {
    logger.debug('[IPC Handlers] Already initialized. Skipping.');
    return;
  }
  logger.debug('[IPC Handlers] Initializing IPC handlers...');
  handlerInitialized = true;

  // Sessions
  ipcMain.handle('db-get-all-sessions', async () => {
    logger.debug('[IPC] db-get-all-sessions');
    return dbModule.getAllSessions();
  });
  ipcMain.handle('db-get-session-by-id', async (event: IpcMainInvokeEvent, sessionId: number) => {
    logger.debug(`[IPC] db-get-session-by-id: ${sessionId}`);
    return dbModule.getSessionById(sessionId);
  });
  ipcMain.handle('db-add-session', async (event: IpcMainInvokeEvent, data: Session) => {
    logger.debug('[IPC] db-add-session');
    return dbModule.addSession(data);
  });
  ipcMain.handle('db-update-session', async (event: IpcMainInvokeEvent, id: number, updates: Partial<Session>) => {
    logger.debug(`[IPC] db-update-session: ${id}`);
    return dbModule.updateSession(id, updates);
  });

  // SessionIterations
  ipcMain.handle('db-add-or-update-session-iteration', async (event: IpcMainInvokeEvent, iteration: any) => {
    logger.debug(`[IPC] db-add-or-update-session-iteration: iteration for session ${iteration.session_id}`);
    return dbModule.addOrUpdateSessionIteration(iteration);
  });

  ipcMain.handle('db-get-session-iterations', async (event: IpcMainInvokeEvent, sessionId: number) => {
    logger.debug(`[IPC] db-get-session-iterations: for session ${sessionId}`);
    return dbModule.getSessionIterationsBySessionId(sessionId);
  });

  // SessionResults
  ipcMain.handle('db-add-bulk-session-results', async (event: IpcMainInvokeEvent, results: SessionResult[]) => {
    logger.debug(`[IPC] db-add-bulk-session-results: adding ${results.length} results`);
    return dbModule.addBulkSessionResults(results);
  });
  ipcMain.handle('db-get-results-for-session', async (event: IpcMainInvokeEvent, sessionId: number) => {
    logger.debug(`[IPC] db-get-results-for-session: ${sessionId}`);
    return dbModule.getResultsForSession(sessionId);
  });

  ipcMain.handle('session-finalize-import', async (event: IpcMainInvokeEvent, sessionId: number, results: SessionResult[]) => {
    logger.debug(`[IPC] session-finalize-import: ${sessionId}`);
    try {
      // 1. Save the results
      await dbModule.addBulkSessionResults(results);

      // 2. Get all necessary data for calculations
      const session = await dbModule.getSessionById(sessionId);
      if (!session) throw new Error(`Session with id ${sessionId} not found`);

      const sessionQuestions = await dbModule.getSessionQuestionsBySessionId(sessionId);
      if (!sessionQuestions || sessionQuestions.length === 0) throw new Error(`No questions found for session ${sessionId}`);

      const questionIds = sessionQuestions.map(q => q.dbQuestionId);
      const questions = await dbModule.getQuestionsByIds(questionIds);

      // 3. Calculate scores and success for each participant
      const updatedParticipants = session.participants.map(participant => {
        const participantResults = results.filter(r => r.participantIdBoitier === participant.identificationCode);
        const score = 0; // Replace with actual score calculation
        const success = false; // Replace with actual success calculation
        return { ...participant, score, reussite: success };
      });

      // 4. Update the session
      await dbModule.updateSession(sessionId, { participants: updatedParticipants, status: 'completed' });

      // 5. Return the updated session
      return dbModule.getSessionById(sessionId);
    } catch (error) {
      logger.error(`[IPC] session-finalize-import failed for session ${sessionId}: ${error}`);
      throw error;
    }
  });

  // VotingDevices
  ipcMain.handle('db-get-all-voting-devices', async () => {
    logger.debug('[IPC] db-get-all-voting-devices');
    return dbModule.getAllVotingDevices();
  });
  ipcMain.handle('db-add-voting-device', async (event: IpcMainInvokeEvent, device: VotingDevice) => {
    logger.debug('[IPC] db-add-voting-device');
    return dbModule.addVotingDevice(device);
  });
  ipcMain.handle('db-update-voting-device', async (event: IpcMainInvokeEvent, id: number, updates: Partial<VotingDevice>) => {
    logger.debug(`[IPC] db-update-voting-device: ${id}`);
    return dbModule.updateVotingDevice(id, updates);
  });
  ipcMain.handle('db-delete-voting-device', async (event: IpcMainInvokeEvent, id: number) => {
    logger.debug(`[IPC] db-delete-voting-device: ${id}`);
    return dbModule.deleteVotingDevice(id);
  });
  ipcMain.handle('db-bulk-add-voting-devices', async (event: IpcMainInvokeEvent, devices: VotingDevice[]) => {
    logger.debug(`[IPC] db-bulk-add-voting-devices: adding ${devices.length} devices`);
    return dbModule.bulkAddVotingDevices(devices);
  });

  // SessionQuestions
  ipcMain.handle('db-add-bulk-session-questions', async (event: IpcMainInvokeEvent, questions: SessionQuestion[]) => {
    logger.debug(`[IPC] db-add-bulk-session-questions: adding ${questions.length} questions`);
    return dbModule.addBulkSessionQuestions(questions);
  });
  ipcMain.handle('db-delete-session-questions-by-session-id', async (event: IpcMainInvokeEvent, sessionId: number) => {
    logger.debug(`[IPC] db-delete-session-questions-by-session-id: ${sessionId}`);
    return dbModule.deleteSessionQuestionsBySessionId(sessionId);
  });
  ipcMain.handle('db-get-session-questions-by-session-id', async (event: IpcMainInvokeEvent, sessionId: number) => {
    logger.debug(`[IPC] db-get-session-questions-by-session-id: ${sessionId}`);
    return dbModule.getSessionQuestionsBySessionId(sessionId);
  });

  // SessionBoitiers
  ipcMain.handle('db-add-bulk-session-boitiers', async (event: IpcMainInvokeEvent, boitiers: SessionBoitier[]) => {
    logger.debug(`[IPC] db-add-bulk-session-boitiers: adding ${boitiers.length} boitiers`);
    return dbModule.addBulkSessionBoitiers(boitiers);
  });
  ipcMain.handle('db-delete-session-boitiers-by-session-id', async (event: IpcMainInvokeEvent, sessionId: number) => {
    logger.debug(`[IPC] db-delete-session-boitiers-by-session-id: ${sessionId}`);
    return dbModule.deleteSessionBoitiersBySessionId(sessionId);
  });
  ipcMain.handle('db-get-session-boitiers-by-session-id', async (event: IpcMainInvokeEvent, sessionId: number) => {
    logger.debug(`[IPC] db-get-session-boitiers-by-session-id: ${sessionId}`);
    return dbModule.getSessionBoitiersBySessionId(sessionId);
  });

  // DeviceKits
  ipcMain.handle('db-get-voting-devices-for-kit', async (event: IpcMainInvokeEvent, kitId: number) => {
    logger.debug(`[IPC] db-get-voting-devices-for-kit: ${kitId}`);
    return dbModule.getVotingDevicesForKit(kitId);
  });
  ipcMain.handle('db-get-all-device-kits', async () => {
    logger.debug('[IPC] db-get-all-device-kits');
    return dbModule.getAllDeviceKits();
  });
  ipcMain.handle('db-get-default-device-kit', async () => {
    logger.debug('[IPC] db-get-default-device-kit');
    return dbModule.getDefaultDeviceKit();
  });
  ipcMain.handle('db-add-device-kit', async (event: IpcMainInvokeEvent, data: DeviceKit) => {
    logger.debug('[IPC] db-add-device-kit');
    return dbModule.addDeviceKit(data);
  });
  ipcMain.handle('db-update-device-kit', async (event: IpcMainInvokeEvent, id: number, updates: Partial<DeviceKit>) => {
    logger.debug(`[IPC] db-update-device-kit: ${id}`);
    return dbModule.updateDeviceKit(id, updates);
  });
  ipcMain.handle('db-delete-device-kit', async (event: IpcMainInvokeEvent, id: number) => {
    logger.debug(`[IPC] db-delete-device-kit: ${id}`);
    return dbModule.deleteDeviceKit(id);
  });
  ipcMain.handle('db-set-default-device-kit', async (event: IpcMainInvokeEvent, id: number) => {
    logger.debug(`[IPC] db-set-default-device-kit: ${id}`);
    return dbModule.setDefaultDeviceKit(id);
  });
  ipcMain.handle('db-assign-device-to-kit', async (event: IpcMainInvokeEvent, kitId: number, votingDeviceId: number) => {
    logger.debug(`[IPC] db-assign-device-to-kit: kitId=${kitId}, deviceId=${votingDeviceId}`);
    return dbModule.assignDeviceToKit(kitId, votingDeviceId);
  });
  ipcMain.handle('db-remove-device-from-kit', async (event: IpcMainInvokeEvent, kitId: number, votingDeviceId: number) => {
    logger.debug(`[IPC] db-remove-device-from-kit: kitId=${kitId}, deviceId=${votingDeviceId}`);
    return dbModule.removeDeviceFromKit(kitId, votingDeviceId);
  });
  
  ipcMain.handle('db-get-kits-for-voting-device', async (event: IpcMainInvokeEvent, votingDeviceId: number) => {
    logger.debug(`[IPC] db-get-kits-for-voting-device: ${votingDeviceId}`);
    return dbModule.getKitsForVotingDevice(votingDeviceId);
  });
  ipcMain.handle('db-remove-assignments-by-voting-device-id', async (event: IpcMainInvokeEvent, votingDeviceId: number) => {
    logger.debug(`[IPC] db-remove-assignments-by-voting-device-id: ${votingDeviceId}`);
    return dbModule.removeAssignmentsByVotingDeviceId(votingDeviceId);
  });

  // Referentiels
  ipcMain.handle('db-add-referential', async (event: IpcMainInvokeEvent, data: Referential) => {
    logger.debug('[IPC] db-add-referential');
    return dbModule.addReferential(data);
  });
  ipcMain.handle('db-get-all-referentiels', async () => {
    logger.debug('[IPC] db-get-all-referentiels');
    return dbModule.getAllReferentiels();
  });
  ipcMain.handle('db-get-referential-by-code', async (event: IpcMainInvokeEvent, code: string) => {
    logger.debug(`[IPC] db-get-referential-by-code: ${code}`);
    return dbModule.getReferentialByCode(code);
  });
  ipcMain.handle('db-get-referential-by-id', async (event: IpcMainInvokeEvent, id: number) => {
    logger.debug(`[IPC] db-get-referential-by-id: ${id}`);
    return dbModule.getReferentialById(id);
  });

  // Trainers
  ipcMain.handle('db-get-all-trainers', async () => {
    logger.debug('[IPC] db-get-all-trainers');
    return dbModule.getAllTrainers();
  });
  ipcMain.handle('db-add-trainer', async (event: IpcMainInvokeEvent, data: Trainer) => {
    logger.debug('[IPC] db-add-trainer');
    return dbModule.addTrainer(data);
  });
  ipcMain.handle('db-delete-trainer', async (event: IpcMainInvokeEvent, id: number) => {
    logger.debug(`[IPC] db-delete-trainer: ${id}`);
    return dbModule.deleteTrainer(id);
  });
  ipcMain.handle('db-set-default-trainer', async (event: IpcMainInvokeEvent, id: number) => {
    logger.debug(`[IPC] db-set-default-trainer: ${id}`);
    return dbModule.setDefaultTrainer(id);
  });
  ipcMain.handle('db-update-trainer', async (event: IpcMainInvokeEvent, id: number, updates: Partial<Trainer>) => {
    logger.debug(`[IPC] db-update-trainer: ${id}`);
    return dbModule.updateTrainer(id, updates);
  });

  // Themes
  ipcMain.handle('db-add-theme', async (event: IpcMainInvokeEvent, data: Theme) => {
    logger.debug('[IPC] db-add-theme');
    return dbModule.addTheme(data);
  });
  ipcMain.handle('db-get-theme-by-code-and-referential-id', async (event: IpcMainInvokeEvent, code: string, refId: number) => {
    logger.debug(`[IPC] db-get-theme-by-code-and-referential-id: code=${code}, refId=${refId}`);
    return dbModule.getThemeByCodeAndReferentialId(code, refId);
  });
  ipcMain.handle('db-get-themes-by-referential-id', async (event: IpcMainInvokeEvent, refId: number) => {
    logger.debug(`[IPC] db-get-themes-by-referential-id: ${refId}`);
    return dbModule.getThemesByReferentialId(refId);
  });
  ipcMain.handle('db-get-theme-by-id', async (event: IpcMainInvokeEvent, id: number) => {
    logger.debug(`[IPC] db-get-theme-by-id: ${id}`);
    return dbModule.getThemeById(id);
  });
  ipcMain.handle('db-get-all-themes', async () => {
    logger.debug('[IPC] db-get-all-themes');
    return dbModule.getAllThemes();
  });

  // Blocs
  ipcMain.handle('db-add-bloc', async (event: IpcMainInvokeEvent, data: Bloc) => {
    logger.debug('[IPC] db-add-bloc');
    return dbModule.addBloc(data);
  });
  ipcMain.handle('db-get-bloc-by-code-and-theme-id', async (event: IpcMainInvokeEvent, code: string, themeId: number) => {
    logger.debug(`[IPC] db-get-bloc-by-code-and-theme-id: code=${code}, themeId=${themeId}`);
    return dbModule.getBlocByCodeAndThemeId(code, themeId);
  });
  ipcMain.handle('db-get-blocs-by-theme-id', async (event: IpcMainInvokeEvent, themeId: number) => {
    logger.debug(`[IPC] db-get-blocs-by-theme-id: ${themeId}`);
    return dbModule.getBlocsByThemeId(themeId);
  });
  ipcMain.handle('db-get-bloc-by-id', async (event: IpcMainInvokeEvent, id: number) => {
    logger.debug(`[IPC] db-get-bloc-by-id: ${id}`);
    return dbModule.getBlocById(id);
  });
  ipcMain.handle('db-get-all-blocs', async () => {
    logger.debug('[IPC] db-get-all-blocs');
    return dbModule.getAllBlocs();
  });

  // Questions
  ipcMain.handle('db-add-question', async (event: IpcMainInvokeEvent, data: Question) => {
    logger.debug('[IPC] db-add-question');
    const questionToAdd = {
      ...data,
      blocId: data.blocId === undefined ? null : data.blocId // Assure que blocId est number ou null
    };
    return dbModule.addQuestion(questionToAdd as Omit<QuestionWithId, 'id'>);
  });
  ipcMain.handle('db-get-question-by-id', async (event: IpcMainInvokeEvent, id: number) => {
    logger.debug(`[IPC] db-get-question-by-id: ${id}`);
    return dbModule.getQuestionById(id);
  });
  ipcMain.handle('db-get-questions-by-bloc-id', async (event: IpcMainInvokeEvent, blocId: number) => {
    logger.debug(`[IPC] db-get-questions-by-bloc-id: ${blocId}`);
    return dbModule.getQuestionsByBlocId(blocId);
  });
  ipcMain.handle('db-update-question', async (event: IpcMainInvokeEvent, id: number, updates: Partial<Question>) => {
    logger.debug(`[IPC] db-update-question: ${id}`);
    return dbModule.updateQuestion(id, updates);
  });
  ipcMain.handle('db-delete-question', async (event: IpcMainInvokeEvent, id: number) => {
    logger.debug(`[IPC] db-delete-question: ${id}`);
    return dbModule.deleteQuestion(id);
  });
  ipcMain.handle('db-get-all-questions', async () => {
    logger.debug('[IPC] db-get-all-questions');
    return dbModule.getAllQuestions();
  });
  ipcMain.handle('db-get-questions-by-ids', async (event: IpcMainInvokeEvent, ids: number[]) => {
    logger.debug(`[IPC] db-get-questions-by-ids: ${ids.length} ids`);
    return dbModule.getQuestionsByIds(ids);
  });
  ipcMain.handle('db-get-questions-for-session-blocks', async (event: IpcMainInvokeEvent, blocIds?: number[]) => {
    logger.debug(`[IPC] db-get-questions-for-session-blocks: ${blocIds?.length || 0} blocIds`);
    return dbModule.getQuestionsForSessionBlocks(blocIds);
  });

  // AdminSettings
  ipcMain.handle('db-get-admin-setting', async (event: IpcMainInvokeEvent, key: string) => {
    logger.debug(`[IPC] db-get-admin-setting: ${key}`);
    return dbModule.getAdminSetting(key);
  });
  ipcMain.handle('db-set-admin-setting', async (event: IpcMainInvokeEvent, key: string, value: any) => {
    logger.debug(`[IPC] db-set-admin-setting: ${key}`);
    return dbModule.setAdminSetting(key, value);
  });
  ipcMain.handle('db-get-all-admin-settings', async () => {
    logger.debug('[IPC] db-get-all-admin-settings');
    return dbModule.getAllAdminSettings();
  });

  // Backup/Restore
  ipcMain.handle('db-export-all-data', async () => {
    logger.debug('[IPC] db-export-all-data');
    return dbModule.exportAllData();
  });
  ipcMain.handle('db-import-all-data', async (event: IpcMainInvokeEvent, data: any) => {
    logger.debug('[IPC] db-import-all-data');
    return dbModule.importAllData(data);
  });

  // PPTX Generation
  ipcMain.handle('pptx-generate', async (event: IpcMainInvokeEvent, sessionInfo: { name: string; date: string; referentiel: string }, participants: Participant[], questions: QuestionWithId[], template: any, adminSettings: AdminPPTXSettings) => {
    logger.info('[IPC] pptx-generate handler triggered.');
    logger.debug(`[IPC] pptx-generate: Generating presentation for session ${sessionInfo.name}`);
    let templateArrayBuffer: ArrayBuffer;

    if (template === 'tool_default_template') {
      const templatePath = path.join(__dirname, '../../public/templates/default.pptx');
      try {
        templateArrayBuffer = await fs.readFile(templatePath);
      } catch (error) {
        logger.debug(`Failed to read default PPTX template within pptx-generate: ${error}`);
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

    return generatePresentation(sessionInfo, participants, questions, templateArrayBuffer, adminSettings, logger);
  });

  ipcMain.handle('get-default-pptx-template', async () => {
    logger.debug('[IPC] get-default-pptx-template');
    const templatePath = path.join(__dirname, '../../public/templates/default.pptx');
    logger.debug(`[get-default-pptx-template] Calculated template path: ${templatePath}`);
    try {
      const fileBuffer = await fs.readFile(templatePath);
      logger.debug(`[get-default-pptx-template] Successfully read file, buffer length: ${fileBuffer.length}`);
      return fileBuffer;
    } catch (error) {
      logger.debug(`[get-default-pptx-template] Failed to read default PPTX template: ${error}`);
      throw new Error('Could not load default PPTX template.');
    }
  });

  ipcMain.handle('save-pptx-file', async (event: IpcMainInvokeEvent, fileBuffer: ArrayBuffer, fileName: string) => {
    logger.debug(`[IPC] save-pptx-file: ${fileName}`);
    try {
      const orsSavePath = await dbModule.getAdminSetting('orsSavePath');
      if (!orsSavePath) {
        throw new Error("Le chemin de sauvegarde des ORS n'est pas configuré dans les paramètres techniques.");
      }

      const filePath = path.join(orsSavePath, fileName);
      await fs.writeFile(filePath, Buffer.from(fileBuffer));
      return { success: true, filePath };
    } catch (error: any) {
      logger.debug(`Failed to save PPTX file: ${error}`);
      return { success: false, error: error.message };
    }
  });

  // File Operations
  ipcMain.handle('open-excel-file-dialog', async (event: IpcMainInvokeEvent) => {
    logger.debug('[IPC] open-excel-file-dialog');
    const { canceled, filePaths } = await dialog.showOpenDialog({
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
      logger.debug(`Failed to read file: ${error}`);
      return { canceled: false, error: error.message };
    }
  });

  ipcMain.handle('open-directory-dialogger.debug', async (event: IpcMainInvokeEvent, filePath?: string) => {
    logger.debug(`[IPC] open-directory-dialog: ${filePath || ''}`);
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
    logger.debug('[IPC] open-results-file');
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
      logger.debug(`Failed to read file: ${error}`);
      return { canceled: false, error: error.message };
    }
  });

  ipcMain.handle('read-image-file', async (event: IpcMainInvokeEvent, filePath: string) => {
    logger.debug(`[IPC] read-image-file: ${filePath}`);
    try {
      const fileBuffer = await fs.readFile(filePath);
      return fileBuffer.toString('base64');
    } catch (error: any) {
      logger.debug(`Failed to read image file: ${error}`);
      throw new Error(`Could not read image file: ${error.message}`);
    }
  });

  ipcMain.handle('open-file', async (event: IpcMainInvokeEvent, filePath: string) => {
    logger.debug(`[IPC] open-file: ${filePath}`);
    try {
      const { shell } = require('electron');
      const result = shell.openPath(filePath);
      return { success: true, result };
    } catch (error: any) {
      logger.debug(`Failed to open file ${filePath}: ${error}`);
      return { success: false, error: error.message };
    }
  });

  logger.debug('[IPC Handlers] IPC handlers registration attempt finished.');
}