// electron/IPCHandler.ts
import { IpcMainInvokeEvent, ipcMain, dialog, shell } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import {
  getAllSessions, getSessionById, addSession, updateSession,
  addOrUpdateSessionIteration, getSessionIterationsBySessionId, updateSessionIteration,
  addBulkSessionResults, getResultsForSession, getAllResults,
  getAllVotingDevices, addVotingDevice, updateVotingDevice, deleteVotingDevice, bulkAddVotingDevices,
  addBulkSessionQuestions, deleteSessionQuestionsBySessionId, getSessionQuestionsBySessionId,
  addBulkSessionBoitiers, deleteSessionBoitiersBySessionId, getSessionBoitiersBySessionId,
  getAllDeviceKits, getDefaultDeviceKit, addDeviceKit, updateDeviceKit, deleteDeviceKit, setDefaultDeviceKit, getDeviceKitById,
  assignDeviceToKit, removeDeviceFromKit, getKitsForVotingDevice, removeAssignmentsByVotingDeviceId,
  addReferential, getAllReferentiels, getReferentialByCode, getReferentialById,
  getAllTrainers, addTrainer, deleteTrainer, setDefaultTrainer, updateTrainer, getTrainerById,
  addTheme, getThemeByCodeAndReferentialId, getThemesByReferentialId, getThemeById, getAllThemes,
  addBloc, getBlocByCodeAndThemeId, getBlocsByThemeId, getBlocById, getAllBlocs,
  addQuestion, upsertQuestion, getQuestionById, getQuestionsByBlocId, updateQuestion, deleteQuestion,
  getAllQuestions, getQuestionsByIds, getQuestionsForSessionBlocks,
  getAdminSetting, setAdminSetting, getAllAdminSettings,
  exportAllData, importAllData, getVotingDevicesForKit, calculateBlockUsage,
  upsertParticipant, clearAssignmentsForIteration, addParticipantAssignment,
  checkAndFinalizeSessionStatus
} from '@electron/db';

import { getLogger, ILogger } from '@electron/utils/logger';
import { Participant, QuestionWithId, Session, SessionResult, SessionQuestion, SessionBoitier, VotingDevice, DeviceKit, Trainer, Referential, Theme, Bloc, Question, SessionIteration, AdminPPTXSettings } from '@common/types';

let handlerInitialized = false;

export function initializeIpcHandlers(loggerInstance: ILogger) {
  if (handlerInitialized) {
    loggerInstance.debug('[IPC Handlers] Already initialized. Skipping.');
    return;
  }
  loggerInstance.debug('[IPC Handlers] Initializing IPC handlers...');
  handlerInitialized = true;

  // Sessions
  ipcMain.handle('db-get-all-sessions', async () => {
    loggerInstance.debug('[IPC] db-get-all-sessions');
    return getAllSessions();
  });
  ipcMain.handle('db-get-session-by-id', async (_event: IpcMainInvokeEvent, sessionId: number) => {
    loggerInstance.debug(`[IPC] db-get-session-by-id: ${sessionId}`);
    return getSessionById(sessionId);
  });
  ipcMain.handle('db-add-session', async (_event: IpcMainInvokeEvent, data: Session) => {
    loggerInstance.debug('[IPC] db-add-session');
    return addSession(data);
  });
  ipcMain.handle('db-update-session', async (_event: IpcMainInvokeEvent, id: number, updates: Partial<Session>) => {
    loggerInstance.debug(`[IPC] db-update-session: ${id}`);
    return updateSession(id, updates);
  });

  // SessionIterations
  ipcMain.handle('db-add-or-update-session-iteration', async (_event: IpcMainInvokeEvent, iteration: any) => {
    loggerInstance.debug(`[IPC] db-add-or-update-session-iteration: iteration for session ${iteration.session_id}`);
    return addOrUpdateSessionIteration(iteration);
  });
  ipcMain.handle('db-get-session-iterations', async (_event: IpcMainInvokeEvent, sessionId: number) => {
    loggerInstance.debug(`[IPC] db-get-session-iterations: for session ${sessionId}`);
    return getSessionIterationsBySessionId(sessionId);
  });

  // SessionResults
  ipcMain.handle('db-add-bulk-session-results', async (_event: IpcMainInvokeEvent, results: SessionResult[]) => {
    loggerInstance.debug(`[IPC] db-add-bulk-session-results: adding ${results.length} results`);
    return addBulkSessionResults(results);
  });
  ipcMain.handle('db-get-results-for-session', async (_event: IpcMainInvokeEvent, sessionId: number) => {
    loggerInstance.debug(`[IPC] db-get-results-for-session: ${sessionId}`);
    return getResultsForSession(sessionId);
  });

  ipcMain.handle('db-get-all-results', async () => {
    loggerInstance.debug('[IPC] db-get-all-results');
    return getAllResults();
  });

  ipcMain.handle('import-results-for-iteration', async (_event: IpcMainInvokeEvent, iterationId: number, sessionId: number, results: SessionResult[]) => {
    loggerInstance.debug(`[IPC] import-results-for-iteration: iterationId=${iterationId}, sessionId=${sessionId}`);
    try {
        await addBulkSessionResults(results);
        await updateSessionIteration(iterationId, { status: 'completed' });
        await checkAndFinalizeSessionStatus(sessionId);
        // Return the updated session object to the frontend
        return getSessionById(sessionId);
    } catch (error) {
        loggerInstance.error(`[IPC] import-results-for-iteration failed for iteration ${iterationId}: ${error}`);
        throw error;
    }
  });

  ipcMain.handle('check-and-finalize-session', async (_event: IpcMainInvokeEvent, sessionId: number) => {
    loggerInstance.debug(`[IPC] check-and-finalize-session: sessionId=${sessionId}`);
    try {
      await checkAndFinalizeSessionStatus(sessionId);
      return getSessionById(sessionId);
    } catch (error) {
      loggerInstance.error(`[IPC] check-and-finalize-session failed for session ${sessionId}: ${error}`);
      throw error;
    }
  });

  // VotingDevices
  ipcMain.handle('db-get-all-voting-devices', async () => {
    loggerInstance.debug('[IPC] db-get-all-voting-devices');
    return getAllVotingDevices();
  });
  ipcMain.handle('db-add-voting-device', async (_event: IpcMainInvokeEvent, device: VotingDevice) => {
    loggerInstance.debug('[IPC] db-add-voting-device');
    return addVotingDevice(device);
  });
  ipcMain.handle('db-update-voting-device', async (_event: IpcMainInvokeEvent, id: number, updates: Partial<VotingDevice>) => {
    loggerInstance.debug(`[IPC] db-update-voting-device: ${id}`);
    return updateVotingDevice(id, updates);
  });
  ipcMain.handle('db-delete-voting-device', async (_event: IpcMainInvokeEvent, id: number) => {
    loggerInstance.debug(`[IPC] db-delete-voting-device: ${id}`);
    return deleteVotingDevice(id);
  });
  ipcMain.handle('db-bulk-add-voting-devices', async (_event: IpcMainInvokeEvent, devices: VotingDevice[]) => {
    loggerInstance.debug(`[IPC] db-bulk-add-voting-devices: adding ${devices.length} devices`);
    return bulkAddVotingDevices(devices);
  });

  // SessionQuestions
  ipcMain.handle('db-add-bulk-session-questions', async (_event: IpcMainInvokeEvent, questions: SessionQuestion[]) => {
    loggerInstance.debug(`[IPC] db-add-bulk-session-questions: adding ${questions.length} questions`);
    return addBulkSessionQuestions(questions);
  });
  ipcMain.handle('db-delete-session-questions-by-session-id', async (_event: IpcMainInvokeEvent, sessionId: number) => {
    loggerInstance.debug(`[IPC] db-delete-session-questions-by-session-id: ${sessionId}`);
    return deleteSessionQuestionsBySessionId(sessionId);
  });
  ipcMain.handle('db-get-session-questions-by-session-id', async (_event: IpcMainInvokeEvent, sessionId: number) => {
    loggerInstance.debug(`[IPC] db-get-session-questions-by-session-id: ${sessionId}`);
    return getSessionQuestionsBySessionId(sessionId);
  });

  // SessionBoitiers
  ipcMain.handle('db-add-bulk-session-boitiers', async (_event: IpcMainInvokeEvent, boitiers: SessionBoitier[]) => {
    loggerInstance.debug(`[IPC] db-add-bulk-session-boitiers: adding ${boitiers.length} boitiers`);
    return addBulkSessionBoitiers(boitiers);
  });
  ipcMain.handle('db-delete-session-boitiers-by-session-id', async (_event: IpcMainInvokeEvent, sessionId: number) => {
    loggerInstance.debug(`[IPC] db-delete-session-boitiers-by-session-id: ${sessionId}`);
    return deleteSessionBoitiersBySessionId(sessionId);
  });
  ipcMain.handle('db-get-session-boitiers-by-session-id', async (_event: IpcMainInvokeEvent, sessionId: number) => {
    loggerInstance.debug(`[IPC] db-get-session-boitiers-by-session-id: ${sessionId}`);
    return getSessionBoitiersBySessionId(sessionId);
  });

  // DeviceKits
  ipcMain.handle('db-get-voting-devices-for-kit', async (_event: IpcMainInvokeEvent, kitId: number) => {
    loggerInstance.debug(`[IPC] db-get-voting-devices-for-kit: ${kitId}`);
    return getVotingDevicesForKit(kitId);
  });
  ipcMain.handle('db-get-all-device-kits', async () => {
    loggerInstance.debug('[IPC] db-get-all-device-kits');
    return getAllDeviceKits();
  });
  ipcMain.handle('db-get-device-kit-by-id', async (_event: IpcMainInvokeEvent, id: number) => {
    loggerInstance.debug(`[IPC] db-get-device-kit-by-id: ${id}`);
    return getDeviceKitById(id);
  });
  ipcMain.handle('db-get-default-device-kit', async () => {
    loggerInstance.debug('[IPC] db-get-default-device-kit');
    return getDefaultDeviceKit();
  });
  ipcMain.handle('db-add-device-kit', async (_event: IpcMainInvokeEvent, data: DeviceKit) => {
    loggerInstance.debug('[IPC] db-add-device-kit');
    return addDeviceKit(data);
  });
  ipcMain.handle('db-update-device-kit', async (_event: IpcMainInvokeEvent, id: number, updates: Partial<DeviceKit>) => {
    loggerInstance.debug(`[IPC] db-update-device-kit: ${id}`);
    return updateDeviceKit(id, updates);
  });
  ipcMain.handle('db-delete-device-kit', async (_event: IpcMainInvokeEvent, id: number) => {
    loggerInstance.debug(`[IPC] db-delete-device-kit: ${id}`);
    return deleteDeviceKit(id);
  });
  ipcMain.handle('db-set-default-device-kit', async (_event: IpcMainInvokeEvent, id: number) => {
    loggerInstance.debug(`[IPC] db-set-default-device-kit: ${id}`);
    return setDefaultDeviceKit(id);
  });
  ipcMain.handle('db-assign-device-to-kit', async (_event: IpcMainInvokeEvent, kitId: number, votingDeviceId: number) => {
    loggerInstance.debug(`[IPC] db-assign-device-to-kit: kitId=${kitId}, deviceId=${votingDeviceId}`);
    return assignDeviceToKit(kitId, votingDeviceId);
  });
  ipcMain.handle('db-remove-device-from-kit', async (_event: IpcMainInvokeEvent, kitId: number, votingDeviceId: number) => {
    loggerInstance.debug(`[IPC] db-remove-device-from-kit: kitId=${kitId}, deviceId=${votingDeviceId}`);
    return removeDeviceFromKit(kitId, votingDeviceId);
  });
  ipcMain.handle('db-get-kits-for-voting-device', async (_event: IpcMainInvokeEvent, votingDeviceId: number) => {
    loggerInstance.debug(`[IPC] db-get-kits-for-voting-device: ${votingDeviceId}`);
    return getKitsForVotingDevice(votingDeviceId);
  });
  ipcMain.handle('db-remove-assignments-by-voting-device-id', async (_event: IpcMainInvokeEvent, votingDeviceId: number) => {
    loggerInstance.debug(`[IPC] db-remove-assignments-by-voting-device-id: ${votingDeviceId}`);
    return removeAssignmentsByVotingDeviceId(votingDeviceId);
  });

  // Referentiels
  ipcMain.handle('db-add-referential', async (_event: IpcMainInvokeEvent, data: Referential) => {
    loggerInstance.debug('[IPC] db-add-referential');
    return addReferential(data);
  });
  ipcMain.handle('db-get-all-referentiels', async () => {
    loggerInstance.debug('[IPC] db-get-all-referentiels');
    return getAllReferentiels();
  });
  ipcMain.handle('db-get-referential-by-code', async (_event: IpcMainInvokeEvent, code: string) => {
    loggerInstance.debug(`[IPC] db-get-referential-by-code: ${code}`);
    return getReferentialByCode(code);
  });
  ipcMain.handle('db-get-referential-by-id', async (_event: IpcMainInvokeEvent, id: number) => {
    loggerInstance.debug(`[IPC] db-get-referential-by-id: ${id}`);
    return getReferentialById(id);
  });

  // Trainers
  ipcMain.handle('db-get-all-trainers', async () => {
    loggerInstance.debug('[IPC] db-get-all-trainers');
    return getAllTrainers();
  });
  ipcMain.handle('db-add-trainer', async (_event: IpcMainInvokeEvent, data: Trainer) => {
    loggerInstance.debug('[IPC] db-add-trainer');
    return addTrainer(data);
  });
  ipcMain.handle('db-delete-trainer', async (_event: IpcMainInvokeEvent, id: number) => {
    loggerInstance.debug(`[IPC] db-delete-trainer: ${id}`);
    return deleteTrainer(id);
  });
  ipcMain.handle('db-set-default-trainer', async (_event: IpcMainInvokeEvent, id: number) => {
    loggerInstance.debug(`[IPC] db-set-default-trainer: ${id}`);
    return setDefaultTrainer(id);
  });
  ipcMain.handle('db-update-trainer', async (_event: IpcMainInvokeEvent, id: number, updates: Partial<Trainer>) => {
    loggerInstance.debug(`[IPC] db-update-trainer: ${id}`);
    return updateTrainer(id, updates);
  });
  ipcMain.handle('db-get-trainer-by-id', async (_event: IpcMainInvokeEvent, id: number) => {
    loggerInstance.debug(`[IPC] db-get-trainer-by-id: ${id}`);
    return getTrainerById(id);
  });

  ipcMain.handle('db-calculate-block-usage', async () => {
    loggerInstance.debug('[IPC] db-calculate-block-usage');
    return calculateBlockUsage();
  });

  // Themes
  ipcMain.handle('db-add-theme', async (_event: IpcMainInvokeEvent, data: Theme) => {
    loggerInstance.debug('[IPC] db-add-theme');
    return addTheme(data);
  });
  ipcMain.handle('db-get-theme-by-code-and-referential-id', async (_event: IpcMainInvokeEvent, code: string, refId: number) => {
    loggerInstance.debug(`[IPC] db-get-theme-by-code-and-referential-id: code=${code}, refId=${refId}`);
    return getThemeByCodeAndReferentialId(code, refId);
  });
  ipcMain.handle('db-get-themes-by-referential-id', async (_event: IpcMainInvokeEvent, refId: number) => {
    loggerInstance.debug(`[IPC] db-get-themes-by-referential-id: ${refId}`);
    return getThemesByReferentialId(refId);
  });
  ipcMain.handle('db-get-theme-by-id', async (_event: IpcMainInvokeEvent, id: number) => {
    loggerInstance.debug(`[IPC] db-get-theme-by-id: ${id}`);
    return getThemeById(id);
  });
  ipcMain.handle('db-get-all-themes', async () => {
    loggerInstance.debug('[IPC] db-get-all-themes');
    return getAllThemes();
  });

  // Blocs
  ipcMain.handle('db-add-bloc', async (_event: IpcMainInvokeEvent, data: Bloc) => {
    loggerInstance.debug('[IPC] db-add-bloc');
    return addBloc(data);
  });
  ipcMain.handle('db-get-bloc-by-code-and-theme-id', async (_event: IpcMainInvokeEvent, code: string, themeId: number) => {
    loggerInstance.debug(`[IPC] db-get-bloc-by-code-and-theme-id: code=${code}, themeId=${themeId}`);
    return getBlocByCodeAndThemeId(code, themeId);
  });
  ipcMain.handle('db-get-blocs-by-theme-id', async (_event: IpcMainInvokeEvent, themeId: number) => {
    loggerInstance.debug(`[IPC] db-get-blocs-by-theme-id: ${themeId}`);
    return getBlocsByThemeId(themeId);
  });
  ipcMain.handle('db-get-bloc-by-id', async (_event: IpcMainInvokeEvent, id: number) => {
    loggerInstance.debug(`[IPC] db-get-bloc-by-id: ${id}`);
    return getBlocById(id);
  });
  ipcMain.handle('db-get-all-blocs', async () => {
    loggerInstance.debug('[IPC] db-get-all-blocs');
    return getAllBlocs();
  });

  // Questions
  ipcMain.handle('db-add-question', async (_event: IpcMainInvokeEvent, data: Question) => {
    loggerInstance.debug('[IPC] db-add-question');
    const questionToAdd = {
      ...data,
      blocId: data.blocId === undefined ? null : data.blocId
    };
    return addQuestion(questionToAdd as Omit<QuestionWithId, 'id'>);
  });
  ipcMain.handle('db-upsert-question', async (_event: IpcMainInvokeEvent, data: Question) => {
    loggerInstance.debug('[IPC] db-upsert-question');
    const questionToUpsert = {
      ...data,
      blocId: data.blocId === undefined ? null : data.blocId
    };
    return upsertQuestion(questionToUpsert as Omit<QuestionWithId, 'id'>);
  });
  ipcMain.handle('db-get-question-by-id', async (_event: IpcMainInvokeEvent, id: number) => {
    loggerInstance.debug(`[IPC] db-get-question-by-id: ${id}`);
    return getQuestionById(id);
  });
  ipcMain.handle('db-get-questions-by-bloc-id', async (_event: IpcMainInvokeEvent, blocId: number) => {
    loggerInstance.debug(`[IPC] db-get-questions-by-bloc-id: ${blocId}`);
    return getQuestionsByBlocId(blocId);
  });
  ipcMain.handle('db-update-question', async (_event: IpcMainInvokeEvent, id: number, updates: Partial<Question>) => {
    loggerInstance.debug(`[IPC] db-update-question: ${id}`);
    return updateQuestion(id, updates);
  });
  ipcMain.handle('db-delete-question', async (_event: IpcMainInvokeEvent, id: number) => {
    loggerInstance.debug(`[IPC] db-delete-question: ${id}`);
    return deleteQuestion(id);
  });
  ipcMain.handle('db-get-all-questions', async () => {
    loggerInstance.debug('[IPC] db-get-all-questions');
    return getAllQuestions();
  });
  ipcMain.handle('db-get-questions-by-ids', async (_event: IpcMainInvokeEvent, ids: number[]) => {
    loggerInstance.debug(`[IPC] db-get-questions-by-ids: ${ids.length} ids`);
    return getQuestionsByIds(ids);
  });
  ipcMain.handle('db-get-questions-for-session-blocks', async (_event: IpcMainInvokeEvent, blocIds?: number[]) => {
    loggerInstance.debug(`[IPC] db-get-questions-for-session-blocks: ${blocIds?.length || 0} blocIds`);
    return getQuestionsForSessionBlocks(blocIds);
  });

  // Participants
  ipcMain.handle('db-upsert-participant', async (_event: IpcMainInvokeEvent, participant: any) => {
    loggerInstance.debug(`[IPC] db-upsert-participant for participant with code: ${participant.identificationCode}`);
    return upsertParticipant(participant);
  });

  ipcMain.handle('db-set-participant-assignments-for-iteration', async (_event: IpcMainInvokeEvent, iterationId: number, assignments: any[]) => {
      loggerInstance.debug(`[IPC] db-set-participant-assignments-for-iteration for iteration ${iterationId}`);
      await clearAssignmentsForIteration(iterationId);
      const promises = assignments.map(assignment => addParticipantAssignment(assignment));
      return Promise.all(promises);
  });

  // AdminSettings
  ipcMain.handle('db-get-admin-setting', async (_event: IpcMainInvokeEvent, key: string) => {
    loggerInstance.debug(`[IPC] db-get-admin-setting: ${key}`);
    return getAdminSetting(key);
  });
  ipcMain.handle('db-set-admin-setting', async (_event: IpcMainInvokeEvent, key: string, value: any) => {
    loggerInstance.debug(`[IPC] db-set-admin-setting: ${key}`);
    return setAdminSetting(key, value);
  });
  ipcMain.handle('db-get-all-admin-settings', async () => {
    loggerInstance.debug('[IPC] db-get-all-admin-settings');
    return getAllAdminSettings();
  });

  // Backup/Restore
  ipcMain.handle('db-export-all-data', async () => {
    loggerInstance.debug('[IPC] db-export-all-data');
    return exportAllData();
  });
  ipcMain.handle('db-import-all-data', async (_event: IpcMainInvokeEvent, data: any) => {
    loggerInstance.debug('[IPC] db-import-all-data');
    return importAllData(data);
  });

  // PPTX Generation
ipcMain.handle(
  'pptx-generate',
  async (
    _event: IpcMainInvokeEvent,
    sessionInfo: { name: string; date: string; referentiel: string },
    participants: Participant[],
    questions: QuestionWithId[],
    template: any,
    adminSettings: AdminPPTXSettings
  ) => {
    loggerInstance.info('[IPC] pptx-generate handler triggered.');
    const { generatePresentation } = await import('@electron/utils/pptxOrchestrator');
    loggerInstance.debug(`[IPC] pptx-generate: Generating presentation for session ${sessionInfo.name}`);

    let templateArrayBuffer: ArrayBuffer;

    if (template === 'tool_default_template') {
      // This path is relative to the location of the compiled ipcHandlers.js file
      const templatePath = path.resolve(__dirname, '../../dist/templates/default.pptx');
      try {
        const buffer = await fs.readFile(templatePath); // Returns a Buffer
        // Conversion en ArrayBuffer
        templateArrayBuffer = new ArrayBuffer(buffer.length);
        const uint8Array = new Uint8Array(templateArrayBuffer);
        uint8Array.set(buffer); // Copie les données du Buffer dans l'ArrayBuffer
      } catch (error) {
        loggerInstance.debug(`Failed to read default PPTX template within pptx-generate: ${error}`);
        throw new Error('Could not load default PPTX template.');
      }
    } else if (template && template.type === 'Buffer' && Array.isArray(template.data)) {
      const buffer = Buffer.from(template.data); // Retourne un Buffer
      // Conversion en ArrayBuffer
      templateArrayBuffer = new ArrayBuffer(buffer.length);
      const uint8Array = new Uint8Array(templateArrayBuffer);
      uint8Array.set(buffer); // Copie les données du Buffer dans l'ArrayBuffer
    } else if (template instanceof ArrayBuffer) {
      templateArrayBuffer = template;
    } else if (template && typeof template.arrayBuffer === 'function') {
      templateArrayBuffer = await template.arrayBuffer();
    } else {
      throw new Error('Invalid template format provided to pptx-generate IPC handler.');
    }

    return generatePresentation(sessionInfo, participants, questions, templateArrayBuffer, adminSettings, loggerInstance);
  }
);

  ipcMain.handle('get-default-pptx-template', async () => {
    loggerInstance.debug('[IPC] get-default-pptx-template');
    const templatePath = path.resolve(__dirname, '../../dist/templates/default.pptx');
    loggerInstance.debug(`[get-default-pptx-template] Calculated template path: ${templatePath}`);
    try {
      const fileBuffer = await fs.readFile(templatePath);
      loggerInstance.debug(`[get-default-pptx-template] Successfully read file, buffer length: ${fileBuffer.length}`);
      return fileBuffer;
    } catch (error) {
      loggerInstance.debug(`[get-default-pptx-template] Failed to read default PPTX template: ${error}`);
      throw new Error('Could not load default PPTX template.');
    }
  });

  ipcMain.handle('save-pptx-file', async (_event: IpcMainInvokeEvent, fileBuffer: ArrayBuffer, fileName: string) => {
    loggerInstance.debug(`[IPC] save-pptx-file: ${fileName}`);
    try {
      const orsSavePath = await getAdminSetting('orsSavePath');
      if (!orsSavePath) {
        throw new Error("Le chemin de sauvegarde des ORS n'est pas configuré dans les paramètres techniques.");
      }
      const filePath = path.join(orsSavePath, fileName);
      await fs.writeFile(filePath, Buffer.from(fileBuffer));
      return { success: true, filePath };
    } catch (error: any) {
      loggerInstance.debug(`Failed to save PPTX file: ${error}`);
      return { success: false, error: error.message };
    }
  });

  // File Operations
  ipcMain.handle('open-file-dialog', async () => {
    loggerInstance.debug('[IPC] open-file-dialog');
   const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Tous les fichiers', extensions: ['*'] }
      ]
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true, filePaths: [], fileName: null, fileBuffer: null, error: null };
    }
    const filePath = result.filePaths[0];
    try {
      const fileBuffer = await fs.readFile(filePath);
      return {
        canceled: false,
        fileName: path.basename(filePath),
        fileBuffer: fileBuffer.toString('base64'),
        error: null
      };
    } catch (error: any) {
      loggerInstance.debug(`Failed to read file: ${error}`);
      return { canceled: false, fileName: null, fileBuffer: null, error: error.message };
    }
  });

  ipcMain.handle('open-excel-file-dialog', async () => {
    loggerInstance.debug('[IPC] open-excel-file-dialog');
    const result = await dialog.showOpenDialog({
      filters: [
        { name: 'Fichiers Excel', extensions: ['xlsx', 'xls'] },
        { name: 'Tous les fichiers', extensions: ['*'] }
      ],
      properties: ['openFile']
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true, filePaths: [], fileName: null, fileBuffer: null, error: null };
    }
    const filePath = result.filePaths[0];
    try {
      const fileBuffer = await fs.readFile(filePath);
      return {
        canceled: false,
        fileName: path.basename(filePath),
        fileBuffer: fileBuffer.toString('base64'),
        error: null
      };
    } catch (error: any) {
      loggerInstance.debug(`Failed to read file: ${error}`);
      return { canceled: false, fileName: null, fileBuffer: null, error: error.message };
    }
  });

  ipcMain.handle('open-directory-dialog', async (_event: IpcMainInvokeEvent, filePath?: string) => {
    loggerInstance.debug(`[IPC] open-directory-dialog: ${filePath || ''}`);
    if (filePath) {
      shell.showItemInFolder(filePath);
      return { canceled: false, path: path.dirname(filePath) };
    }
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }
    return { canceled: false, path: result.filePaths[0] };
  });

  ipcMain.handle('open-results-file', async () => {
    loggerInstance.debug('[IPC] open-results-file');
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Fichiers ORS', extensions: ['ors'] },
        { name: 'Tous les fichiers', extensions: ['*'] }
      ]
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true, filePaths: [], fileName: null, fileBuffer: null, error: null };
    }
    const filePath = result.filePaths[0];
    try {
      const fileBuffer = await fs.readFile(filePath);
      return {
        canceled: false,
        fileName: path.basename(filePath),
        fileBuffer: fileBuffer.toString('base64'),
        error: null
      };
    } catch (error: any) {
      loggerInstance.debug(`Failed to read file: ${error}`);
      return { canceled: false, fileName: null, fileBuffer: null, error: error.message };
    }
  });

  ipcMain.handle('read-image-file', async (_event: IpcMainInvokeEvent, filePath: string) => {
    loggerInstance.debug(`[IPC] read-image-file: ${filePath}`);
    try {
      const fileBuffer = await fs.readFile(filePath);
      return fileBuffer.toString('base64');
    } catch (error: any) {
      loggerInstance.debug(`Failed to read image file: ${error}`);
      throw new Error(`Could not read image file: ${error.message}`);
    }
  });

  ipcMain.handle('read-file-buffer', async (_event: IpcMainInvokeEvent, filePath: string) => {
    loggerInstance.debug(`[IPC] read-file-buffer: ${filePath}`);
    try {
      const fileBuffer = await fs.readFile(filePath);
      return {
        canceled: false,
        fileName: path.basename(filePath),
        fileBuffer: fileBuffer.toString('base64'),
        error: null
      };
    } catch (error: any) {
      loggerInstance.debug(`Failed to read file for buffer: ${error}`);
      return { canceled: false, fileName: null, fileBuffer: null, error: error.message };
    }
  });

  ipcMain.handle('open-file', async (_event: IpcMainInvokeEvent, filePath: string) => {
    loggerInstance.debug(`[IPC] open-file: ${filePath}`);
    try {
      const result = await shell.openPath(filePath);
      return { success: true, result };
    } catch (error: any) {
      loggerInstance.debug(`Failed to open file ${filePath}: ${error}`);
      return { success: false, error: error.message };
    }
  });

  loggerInstance.debug('[IPC Handlers] IPC handlers registration attempt finished.');
}