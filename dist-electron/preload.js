import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("dbAPI", {
  // Pour les sessions
  getAllSessions: () => ipcRenderer.invoke("db-get-all-sessions"),
  getSessionById: (id) => ipcRenderer.invoke("db-get-session-by-id", id),
  // Pour les référentiels (basé sur les exemples dans ipcHandlers.ts)
  addReferential: (data) => ipcRenderer.invoke("db-add-referential", data),
  getAllReferentiels: () => ipcRenderer.invoke("db-get-all-referentiels"),
  // Pour les trainers (basé sur les exemples dans ipcHandlers.ts)
  getAllTrainers: () => ipcRenderer.invoke("db-get-all-trainers"),
  // Referentiels
  getReferentialByCode: (code) => ipcRenderer.invoke("db-get-referential-by-code", code),
  getReferentialById: (id) => ipcRenderer.invoke("db-get-referential-by-id", id),
  // addReferential et getAllReferentiels sont déjà là
  // Themes
  addTheme: (data) => ipcRenderer.invoke("db-add-theme", data),
  getThemeByCodeAndReferentialId: (code, refId) => ipcRenderer.invoke("db-get-theme-by-code-and-referential-id", code, refId),
  getThemesByReferentialId: (refId) => ipcRenderer.invoke("db-get-themes-by-referential-id", refId),
  getThemeById: (id) => ipcRenderer.invoke("db-get-theme-by-id", id),
  getAllThemes: () => ipcRenderer.invoke("db-get-all-themes"),
  // Blocs
  addBloc: (data) => ipcRenderer.invoke("db-add-bloc", data),
  getBlocByCodeAndThemeId: (code, themeId) => ipcRenderer.invoke("db-get-bloc-by-code-and-theme-id", code, themeId),
  getBlocsByThemeId: (themeId) => ipcRenderer.invoke("db-get-blocs-by-theme-id", themeId),
  getBlocById: (id) => ipcRenderer.invoke("db-get-bloc-by-id", id),
  getAllBlocs: () => ipcRenderer.invoke("db-get-all-blocs"),
  // Questions
  addQuestion: (data) => ipcRenderer.invoke("db-add-question", data),
  getQuestionById: (id) => ipcRenderer.invoke("db-get-question-by-id", id),
  getQuestionsByBlocId: (blocId) => ipcRenderer.invoke("db-get-questions-by-bloc-id", blocId),
  updateQuestion: (id, updates) => ipcRenderer.invoke("db-update-question", id, updates),
  deleteQuestion: (id) => ipcRenderer.invoke("db-delete-question", id),
  getAllQuestions: () => ipcRenderer.invoke("db-get-all-questions"),
  getQuestionsByIds: (ids) => ipcRenderer.invoke("db-get-questions-by-ids", ids),
  getQuestionsForSessionBlocks: (blocIds) => ipcRenderer.invoke("db-get-questions-for-session-blocks", blocIds),
  // AdminSettings
  getAdminSetting: (key) => ipcRenderer.invoke("db-get-admin-setting", key),
  setAdminSetting: (key, value) => ipcRenderer.invoke("db-set-admin-setting", key, value),
  getAllAdminSettings: () => ipcRenderer.invoke("db-get-all-admin-settings")
  // N'oubliez pas d'ajouter les autres fonctions CRUD pour les autres entités au fur et à mesure
  // (SessionResults, VotingDevices, sessionQuestions, sessionBoitiers,
  // deviceKits, deviceKitAssignments, etc.)
  // Et mettre à jour le fichier de déclaration de types (renderer.d.ts) en conséquence.
});
console.log("[Preload Script] Context bridge for dbAPI initialized.");
