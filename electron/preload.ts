import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('dbAPI', {
  // Sessions
  getAllSessions: () => ipcRenderer.invoke('db-get-all-sessions'),
  getSessionById: (id: number) => ipcRenderer.invoke('db-get-session-by-id', id),
  addSession: (data: any) => ipcRenderer.invoke('db-add-session', data),
  updateSession: (id: number, updates: any) => ipcRenderer.invoke('db-update-session', id, updates),

  // SessionIterations
  addOrUpdateSessionIteration: (iteration: any) => ipcRenderer.invoke('db-add-or-update-session-iteration', iteration),
  getSessionIterations: (sessionId: number) => ipcRenderer.invoke('db-get-session-iterations', sessionId),

  // Participants
  upsertParticipant: (participant: any) => ipcRenderer.invoke('db-upsert-participant', participant),
  setParticipantAssignmentsForIteration: (iterationId: number, assignments: any[]) => ipcRenderer.invoke('db-set-participant-assignments-for-iteration', iterationId, assignments),

  // SessionResults
  addBulkSessionResults: (results: any) => ipcRenderer.invoke('db-add-bulk-session-results', results),
  getResultsForSession: (sessionId: number) => ipcRenderer.invoke('db-get-results-for-session', sessionId),
  deleteResultsForIteration: (iterationId: number) => ipcRenderer.invoke('db-delete-results-for-iteration', iterationId),
  importResultsForIteration: (iterationId: number, sessionId: number, results: any[]) => ipcRenderer.invoke('import-results-for-iteration', iterationId, sessionId, results),

  // SessionQuestions
  addBulkSessionQuestions: (questions: any) => ipcRenderer.invoke('db-add-bulk-session-questions', questions),
  deleteSessionQuestionsBySessionId: (sessionId: number) => ipcRenderer.invoke('db-delete-session-questions-by-session-id', sessionId),
  getSessionQuestionsBySessionId: (sessionId: number) => ipcRenderer.invoke('db-get-session-questions-by-session-id', sessionId),

  // VotingDevices
  getAllVotingDevices: () => ipcRenderer.invoke('db-get-all-voting-devices'),
  addVotingDevice: (device: any) => ipcRenderer.invoke('db-add-voting-device', device),
  updateVotingDevice: (id: number, updates: any) => ipcRenderer.invoke('db-update-voting-device', id, updates),
  deleteVotingDevice: (id: number) => ipcRenderer.invoke('db-delete-voting-device', id),
  bulkAddVotingDevices: (devices: any[]) => ipcRenderer.invoke('db-bulk-add-voting-devices', devices),
  getVotingDevicesForKit: (kitId: number) => ipcRenderer.invoke('db-get-voting-devices-for-kit', kitId),
  addBulkSessionBoitiers: (boitiers: any) => ipcRenderer.invoke('db-add-bulk-session-boitiers', boitiers),
  deleteSessionBoitiersBySessionId: (sessionId: number) => ipcRenderer.invoke('db-delete-session-boitiers-by-session-id', sessionId),
  getSessionBoitiersBySessionId: (sessionId: number) => ipcRenderer.invoke('db-get-session-boitiers-by-session-id', sessionId),

  // DeviceKits
  getAllDeviceKits: () => ipcRenderer.invoke('db-get-all-device-kits'),
  getDeviceKitById: (id: number) => ipcRenderer.invoke('db-get-device-kit-by-id', id),
  getDefaultDeviceKit: () => ipcRenderer.invoke('db-get-default-device-kit'),
  addDeviceKit: (data: any) => ipcRenderer.invoke('db-add-device-kit', data),
  updateDeviceKit: (id: number, updates: any) => ipcRenderer.invoke('db-update-device-kit', id, updates),
  deleteDeviceKit: (id: number) => ipcRenderer.invoke('db-delete-device-kit', id),
  setDefaultDeviceKit: (id: number) => ipcRenderer.invoke('db-set-default-device-kit', id),
  assignDeviceToKit: (kitId: number, votingDeviceId: number) => ipcRenderer.invoke('db-assign-device-to-kit', kitId, votingDeviceId),
  removeDeviceFromKit: (kitId: number, votingDeviceId: number) => ipcRenderer.invoke('db-remove-device-from-kit', kitId, votingDeviceId),
  
  
  
  removeAssignmentsByKitId: (kitId: number) => ipcRenderer.invoke('db-remove-assignments-by-kit-id', kitId),
  removeAssignmentsByVotingDeviceId: (votingDeviceId: number) => ipcRenderer.invoke('db-remove-assignments-by-voting-device-id', votingDeviceId),

  // Referentiels
  addReferential: (data: any) => ipcRenderer.invoke('db-add-referential', data),
  getAllReferentiels: () => ipcRenderer.invoke('db-get-all-referentiels'),
  getReferentialByCode: (code: string) => ipcRenderer.invoke('db-get-referential-by-code', code),
  getReferentialById: (id: number) => ipcRenderer.invoke('db-get-referential-by-id', id),

  // Trainers
  getAllTrainers: () => ipcRenderer.invoke('db-get-all-trainers'),
  addTrainer: (data: any) => ipcRenderer.invoke('db-add-trainer', data),
  deleteTrainer: (id: number) => ipcRenderer.invoke('db-delete-trainer', id),
  setDefaultTrainer: (id: number) => ipcRenderer.invoke('db-set-default-trainer', id),
  updateTrainer: (id: number, updates: any) => ipcRenderer.invoke('db-update-trainer', id, updates),
  getTrainerById: (id: number) => ipcRenderer.invoke('db-get-trainer-by-id', id),

  // Themes
  addTheme: (data: any) => ipcRenderer.invoke('db-add-theme', data),
  getThemeByCodeAndReferentialId: (code: string, refId: number) => ipcRenderer.invoke('db-get-theme-by-code-and-referential-id', code, refId),
  getThemesByReferentialId: (refId: number) => ipcRenderer.invoke('db-get-themes-by-referential-id', refId),
  getThemeById: (id: number) => ipcRenderer.invoke('db-get-theme-by-id', id),
  getAllThemes: () => ipcRenderer.invoke('db-get-all-themes'),

  // Blocs
  addBloc: (data: any) => ipcRenderer.invoke('db-add-bloc', data),
  getBlocByCodeAndThemeId: (code: string, themeId: number) => ipcRenderer.invoke('db-get-bloc-by-code-and-theme-id', code, themeId),
  getBlocsByThemeId: (themeId: number) => ipcRenderer.invoke('db-get-blocs-by-theme-id', themeId),
  getBlocById: (id: number) => ipcRenderer.invoke('db-get-bloc-by-id', id),
  getAllBlocs: () => ipcRenderer.invoke('db-get-all-blocs'),

  // Questions
  addQuestion: (data: any) => ipcRenderer.invoke('db-add-question', data),
  upsertQuestion: (data: any) => ipcRenderer.invoke('db-upsert-question', data),
  getQuestionById: (id: number) => ipcRenderer.invoke('db-get-question-by-id', id),
  getQuestionsByBlocId: (blocId: number) => ipcRenderer.invoke('db-get-questions-by-bloc-id', blocId),
  updateQuestion: (id: number, updates: any) => ipcRenderer.invoke('db-update-question', id, updates),
  deleteQuestion: (id: number) => ipcRenderer.invoke('db-delete-question', id),
  getAllQuestions: () => ipcRenderer.invoke('db-get-all-questions'),
  getQuestionsByIds: (ids: number[]) => ipcRenderer.invoke('db-get-questions-by-ids', ids),
  getQuestionsForSessionBlocks: (blocIds?: number[]) => ipcRenderer.invoke('db-get-questions-for-session-blocks', blocIds),

  // AdminSettings
  getAdminSetting: (key: string) => ipcRenderer.invoke('db-get-admin-setting', key),
  setAdminSetting: (key: string, value: any) => ipcRenderer.invoke('db-set-admin-setting', key, value),
  getAllAdminSettings: () => ipcRenderer.invoke('db-get-all-admin-settings'),

  // Backup/Restore
  exportAllData: () => ipcRenderer.invoke('db-export-all-data'),
  importAllData: (data: any) => ipcRenderer.invoke('db-import-all-data', data),

  // PPTX Generation
  generatePresentation: (sessionInfo: any, participants: any[], questions: any[], template?: any, adminSettings?: any) => ipcRenderer.invoke('pptx-generate', sessionInfo, participants, questions, template, adminSettings),
  savePptxFile: (fileBuffer: string, fileName: string) => ipcRenderer.invoke('save-pptx-file', fileBuffer, fileName),
  getDefaultPptxTemplate: () => ipcRenderer.invoke('get-default-pptx-template'),

  // File Operations
  openExcelFileDialog: () => ipcRenderer.invoke('open-excel-file-dialog'),
  openDirectoryDialog: (filePath?: string) => ipcRenderer.invoke('open-directory-dialog', filePath),
  openResultsFile: () => ipcRenderer.invoke('open-results-file'),
  openFile: (filePath: string) => ipcRenderer.invoke('open-file', filePath),
  readFileBuffer: (filePath: string) => ipcRenderer.invoke('read-file-buffer', filePath),
});

contextBridge.exposeInMainWorld('electronAPI', {
  readImageFile: (path: string | Blob | null) => ipcRenderer.invoke('read-image-file', path),
  Buffer_from: (buffer: string, encoding: string) => Buffer.from(buffer, encoding as BufferEncoding),
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  info: (message: string) => ipcRenderer.send('log:info', message),
  warn: (message: string) => ipcRenderer.send('log:warn', message),
  error: (message: string) => ipcRenderer.send('log:error', message),
});
