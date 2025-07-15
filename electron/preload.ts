const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dbAPI', {
  // Pour les sessions
  getAllSessions: () => ipcRenderer.invoke('db-get-all-sessions'),
  getSessionById: (id: number) => ipcRenderer.invoke('db-get-session-by-id', id),

  // Pour les référentiels (basé sur les exemples dans ipcHandlers.ts)
  addReferential: (data: any) => ipcRenderer.invoke('db-add-referential', data),
  getAllReferentiels: () => ipcRenderer.invoke('db-get-all-referentiels'),

  // Pour les trainers (basé sur les exemples dans ipcHandlers.ts)
  getAllTrainers: () => ipcRenderer.invoke('db-get-all-trainers'),

  // Referentiels
  getReferentialByCode: (code: string) => ipcRenderer.invoke('db-get-referential-by-code', code),
  getReferentialById: (id: number) => ipcRenderer.invoke('db-get-referential-by-id', id),
  // addReferential et getAllReferentiels sont déjà là

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
});
