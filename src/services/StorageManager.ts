// src/services/StorageManager.ts
import { QuestionWithId, Omit } from '../types'; // Importer Omit et les types nécessaires depuis ../types

// Re-export QuestionWithId as StoredQuestion for clarity
export type StoredQuestion = QuestionWithId;

// Vérification que dbAPI est disponible (important pour le contexte de rendu)
if (typeof window === 'undefined' || !window.dbAPI) {
  // Si window ou window.dbAPI n'est pas défini, cela signifie que nous ne sommes pas dans un environnement de rendu Electron configuré correctement.
  // Cela peut arriver lors de tests unitaires côté Node sans mock de l'API Electron, ou si le preload n'a pas fonctionné.
  // Pour les tests unitaires purs de StorageManager, il faudrait mocker window.dbAPI.
  // Pour l'exécution dans l'application, cela indiquerait un problème de configuration.
  console.warn(
    'window.dbAPI is not available. StorageManager DB calls will fail. ' +
    'Ensure this code runs in an Electron renderer context with the preload script correctly configured.'
  );
}


export const StorageManager = {
  // Les réexportations directes des fonctions de '../db.ts' sont supprimées.
  // Toutes les interactions DB se feront via window.dbAPI.

  /**
   * Adds a new question to the database.
   * @param questionData - The question data without the 'id'.
   * @returns The ID of the newly added question, or undefined if an error occurs.
   */
  async addQuestion(questionData: Omit<StoredQuestion, 'id'>): Promise<number | undefined> {
    if (!window.dbAPI?.addQuestion) throw new Error("dbAPI.addQuestion is not available.");
    try {
      const id = await window.dbAPI.addQuestion(questionData);
      return id;
    } catch (error) {
      console.error("StorageManager: Error adding question via IPC", error);
      throw error; // Re-throw to allow UI to handle it
    }
  },

  /**
   * Retrieves all questions from the database.
   * @returns An array of StoredQuestion objects.
   */
  async getAllQuestions(): Promise<StoredQuestion[]> {
    if (!window.dbAPI?.getAllQuestions) throw new Error("dbAPI.getAllQuestions is not available.");
    try {
      const questions = await window.dbAPI.getAllQuestions();
      return questions;
    } catch (error) {
      console.error("StorageManager: Error getting all questions via IPC", error);
      throw error;
    }
  },

  /**
   * Retrieves a specific question by its ID.
   * @param id - The ID of the question to retrieve.
   * @returns The StoredQuestion object if found, otherwise undefined.
   */
  async getQuestionById(id: number): Promise<StoredQuestion | undefined> {
    if (!window.dbAPI?.getQuestionById) throw new Error("dbAPI.getQuestionById is not available.");
    try {
      const question = await window.dbAPI.getQuestionById(id);
      return question;
    } catch (error) {
      console.error(`StorageManager: Error getting question with id ${id} via IPC`, error);
      throw error;
    }
  },

  /**
   * Updates an existing question in the database.
   * @param id - The ID of the question to update.
   * @param updates - An object containing the fields to update.
   * @returns The number of updated records (0 or 1), or undefined if an error occurs.
   */
  async updateQuestion(id: number, updates: Partial<Omit<StoredQuestion, 'id'>>): Promise<number | undefined> {
    if (!window.dbAPI?.updateQuestion) throw new Error("dbAPI.updateQuestion is not available.");
    try {
      // Omit 'id' from updates object for the IPC call, as the main process handler expects this.
      const { id: _, ...restUpdates } = updates as any; // Cast to any if 'id' might not be in updates
      const numUpdated = await window.dbAPI.updateQuestion(id, restUpdates);
      return numUpdated;
    } catch (error) {
      console.error(`StorageManager: Error updating question with id ${id} via IPC`, error);
      throw error;
    }
  },

  /**
   * Deletes a question from the database.
   * @param id - The ID of the question to delete.
   * @returns A promise that resolves when the deletion is complete, or rejects on error.
   */
  async deleteQuestion(id: number): Promise<void> {
    if (!window.dbAPI?.deleteQuestion) throw new Error("dbAPI.deleteQuestion is not available.");
    try {
      await window.dbAPI.deleteQuestion(id);
    } catch (error) {
      console.error(`StorageManager: Error deleting question with id ${id} via IPC`, error);
      throw error;
    }
  },

  // Methods related to 'Questionnaire' entity have been removed:
  // - addQuestionnaire
  // - getAllQuestionnaires
  // - getQuestionnaireById
  // - updateQuestionnaire
  // - deleteQuestionnaire

  /**
   * Retrieves all unique base themes for a given referential.
   * e.g., for 'securite_A', 'securite_B', 'technique_A', it would return ['securite', 'technique'].
   * @param referential - The CACES referential.
   * @returns A promise that resolves to an array of unique base theme names.
   */
  // getAllBaseThemesForReferential has been removed.
  // Use StorageManager.db.getThemesByReferentialId(referentialId: number) instead.
  // Example:
  // const referential = await StorageManager.db.getReferentialByCode("R489");
  // if (referential && referential.id) {
  //   const themes = await StorageManager.db.getThemesByReferentialId(referential.id);
  //   // themes will be an array of Theme objects
  // }

  // getAllBlockIdentifiersForTheme has been removed.
  // Use StorageManager.db.getBlocsByThemeId(themeId: number) instead.
  // Example:
  // const theme = await StorageManager.db.getThemeByCodeAndReferentialId("R489PR", referentialId);
  // if (theme && theme.id) {
  //   const blocs = await StorageManager.db.getBlocsByThemeId(theme.id);
  //   // blocs will be an array of Bloc objects
  // }
  // >>> The above comments are now obsolete as StorageManager.db (direct db access) is removed.
  // >>> If these aggregate functions are needed, they should be rebuilt using window.dbAPI calls.

  /**
   * Retrieves all questions for a specific blocId.
   * @param blocId - The ID of the bloc.
   * @returns A promise that resolves to an array of StoredQuestion objects.
   */
  async getQuestionsForBloc(blocId: number): Promise<StoredQuestion[]> {
    if (!window.dbAPI?.getQuestionsByBlocId) throw new Error("dbAPI.getQuestionsByBlocId is not available.");
    try {
      const questions = await window.dbAPI.getQuestionsByBlocId(blocId);
      return questions;
    } catch (error) {
      console.error(`StorageManager: Error getting questions for blocId ${blocId} via IPC`, error);
      throw error;
    }
  },

  // Sessions
  async getAllSessions() {
    if (!window.dbAPI?.getAllSessions) throw new Error("dbAPI.getAllSessions is not available.");
    return window.dbAPI.getAllSessions();
  },

  async getSessionById(id: number) {
    if (!window.dbAPI?.getSessionById) throw new Error("dbAPI.getSessionById is not available.");
    return window.dbAPI.getSessionById(id);
  },

  async addSession(data: any) {
    if (!window.dbAPI?.addSession) throw new Error("dbAPI.addSession is not available.");
    return window.dbAPI.addSession(data);
  },

  async updateSession(id: number, updates: any) {
    if (!window.dbAPI?.updateSession) throw new Error("dbAPI.updateSession is not available.");
    return window.dbAPI.updateSession(id, updates);
  },

  // SessionResults
  async addBulkSessionResults(results: any) {
    if (!window.dbAPI?.addBulkSessionResults) throw new Error("dbAPI.addBulkSessionResults is not available.");
    return window.dbAPI.addBulkSessionResults(results);
  },

  async getResultsForSession(sessionId: number) {
    if (!window.dbAPI?.getResultsForSession) throw new Error("dbAPI.getResultsForSession is not available.");
    return window.dbAPI.getResultsForSession(sessionId);
  },

  // VotingDevices
  async getAllVotingDevices() {
    if (!window.dbAPI?.getAllVotingDevices) throw new Error("dbAPI.getAllVotingDevices is not available.");
    return window.dbAPI.getAllVotingDevices();
  },

  async getVotingDevicesForKit(kitId: number) {
    if (!window.dbAPI?.getVotingDevicesForKit) throw new Error("dbAPI.getVotingDevicesForKit is not available.");
    return window.dbAPI.getVotingDevicesForKit(kitId);
  },

  async bulkAddVotingDevices(devices: any[]) {
    if (!window.dbAPI?.addBulkSessionBoitiers) throw new Error("dbAPI.addBulkSessionBoitiers is not available.");
    return window.dbAPI.addBulkSessionBoitiers(devices);
  },

  // SessionQuestions
  async addBulkSessionQuestions(questions: any) {
    if (!window.dbAPI?.addBulkSessionQuestions) throw new Error("dbAPI.addBulkSessionQuestions is not available.");
    return window.dbAPI.addBulkSessionQuestions(questions);
  },

  async deleteSessionQuestionsBySessionId(sessionId: number) {
    if (!window.dbAPI?.deleteSessionQuestionsBySessionId) throw new Error("dbAPI.deleteSessionQuestionsBySessionId is not available.");
    return window.dbAPI.deleteSessionQuestionsBySessionId(sessionId);
  },

  async getSessionQuestionsBySessionId(sessionId: number) {
    if (!window.dbAPI?.getSessionQuestionsBySessionId) throw new Error("dbAPI.getSessionQuestionsBySessionId is not available.");
    return window.dbAPI.getSessionQuestionsBySessionId(sessionId);
  },

  // SessionBoitiers
  async addBulkSessionBoitiers(boitiers: any) {
    if (!window.dbAPI?.addBulkSessionBoitiers) throw new Error("dbAPI.addBulkSessionBoitiers is not available.");
    return window.dbAPI.addBulkSessionBoitiers(boitiers);
  },

  async deleteSessionBoitiersBySessionId(sessionId: number) {
    if (!window.dbAPI?.deleteSessionBoitiersBySessionId) throw new Error("dbAPI.deleteSessionBoitiersBySessionId is not available.");
    return window.dbAPI.deleteSessionBoitiersBySessionId(sessionId);
  },

  async getSessionBoitiersBySessionId(sessionId: number) {
    if (!window.dbAPI?.getSessionBoitiersBySessionId) throw new Error("dbAPI.getSessionBoitiersBySessionId is not available.");
    return window.dbAPI.getSessionBoitiersBySessionId(sessionId);
  },

  // DeviceKits
  async getAllDeviceKits() {
    if (!window.dbAPI?.getAllDeviceKits) throw new Error("dbAPI.getAllDeviceKits is not available.");
    return window.dbAPI.getAllDeviceKits();
  },

  async getDefaultDeviceKit() {
    if (!window.dbAPI?.getDefaultDeviceKit) throw new Error("dbAPI.getDefaultDeviceKit is not available.");
    return window.dbAPI.getDefaultDeviceKit();
  },

  // Referentiels
  async addReferential(data: any) {
    if (!window.dbAPI?.addReferential) throw new Error("dbAPI.addReferential is not available.");
    return window.dbAPI.addReferential(data);
  },

  async getAllReferentiels() {
    if (!window.dbAPI?.getAllReferentiels) throw new Error("dbAPI.getAllReferentiels is not available.");
    return window.dbAPI.getAllReferentiels();
  },

  async getReferentialByCode(code: string) {
    if (!window.dbAPI?.getReferentialByCode) throw new Error("dbAPI.getReferentialByCode is not available.");
    return window.dbAPI.getReferentialByCode(code);
  },

  async getReferentialById(id: number) {
    if (!window.dbAPI?.getReferentialById) throw new Error("dbAPI.getReferentialById is not available.");
    return window.dbAPI.getReferentialById(id);
  },

  // Trainers
  async getAllTrainers() {
    if (!window.dbAPI?.getAllTrainers) throw new Error("dbAPI.getAllTrainers is not available.");
    return window.dbAPI.getAllTrainers();
  },

  // Themes
  async addTheme(data: any) {
    if (!window.dbAPI?.addTheme) throw new Error("dbAPI.addTheme is not available.");
    return window.dbAPI.addTheme(data);
  },

  async getThemeByCodeAndReferentialId(code: string, refId: number) {
    if (!window.dbAPI?.getThemeByCodeAndReferentialId) throw new Error("dbAPI.getThemeByCodeAndReferentialId is not available.");
    return window.dbAPI.getThemeByCodeAndReferentialId(code, refId);
  },

  async getThemesByReferentialId(refId: number) {
    if (!window.dbAPI?.getThemesByReferentialId) throw new Error("dbAPI.getThemesByReferentialId is not available.");
    return window.dbAPI.getThemesByReferentialId(refId);
  },

  async getThemeById(id: number) {
    if (!window.dbAPI?.getThemeById) throw new Error("dbAPI.getThemeById is not available.");
    return window.dbAPI.getThemeById(id);
  },

  async getAllThemes() {
    if (!window.dbAPI?.getAllThemes) throw new Error("dbAPI.getAllThemes is not available.");
    return window.dbAPI.getAllThemes();
  },

  // Blocs
  async addBloc(data: any) {
    if (!window.dbAPI?.addBloc) throw new Error("dbAPI.addBloc is not available.");
    return window.dbAPI.addBloc(data);
  },

  async getBlocByCodeAndThemeId(code: string, themeId: number) {
    if (!window.dbAPI?.getBlocByCodeAndThemeId) throw new Error("dbAPI.getBlocByCodeAndThemeId is not available.");
    return window.dbAPI.getBlocByCodeAndThemeId(code, themeId);
  },

  async getBlocsByThemeId(themeId: number) {
    if (!window.dbAPI?.getBlocsByThemeId) throw new Error("dbAPI.getBlocsByThemeId is not available.");
    return window.dbAPI.getBlocsByThemeId(themeId);
  },

  async getBlocById(id: number) {
    if (!window.dbAPI?.getBlocById) throw new Error("dbAPI.getBlocById is not available.");
    return window.dbAPI.getBlocById(id);
  },

  async getAllBlocs() {
    if (!window.dbAPI?.getAllBlocs) throw new Error("dbAPI.getAllBlocs is not available.");
    return window.dbAPI.getAllBlocs();
  },

  // Questions
  async getQuestionsByIds(ids: number[]) {
    if (!window.dbAPI?.getQuestionsByIds) throw new Error("dbAPI.getQuestionsByIds is not available.");
    return window.dbAPI.getQuestionsByIds(ids);
  },

  async getQuestionsForSessionBlocks(blocIds?: number[]) {
    if (!window.dbAPI?.getQuestionsForSessionBlocks) throw new Error("dbAPI.getQuestionsForSessionBlocks is not available.");
    return window.dbAPI.getQuestionsForSessionBlocks(blocIds);
  },

  // AdminSettings
  async getAdminSetting(key: string) {
    if (!window.dbAPI?.getAdminSetting) throw new Error("dbAPI.getAdminSetting is not available.");
    return window.dbAPI.getAdminSetting(key);
  },

  async setAdminSetting(key: string, value: any) {
    if (!window.dbAPI?.setAdminSetting) throw new Error("dbAPI.setAdminSetting is not available.");
    return window.dbAPI.setAdminSetting(key, value);
  },

  async getAllAdminSettings() {
    if (!window.dbAPI?.getAllAdminSettings) throw new Error("dbAPI.getAllAdminSettings is not available.");
    return window.dbAPI.getAllAdminSettings();
  },

  // PPTX Generation
  async generatePresentation(sessionInfo: any, participants: any[], questions: any[], template?: any, adminSettings?: any) {
    if (!window.dbAPI?.generatePresentation) throw new Error("dbAPI.generatePresentation is not available.");
    return window.dbAPI.generatePresentation(sessionInfo, participants, questions, template, adminSettings);
  }
};

// Example usage (optional, for testing or demonstration within this file):
/*
async function testStorageManager() {
  console.log("Testing StorageManager...");

  // Test addQuestion
  const newQuestionData: Omit<StoredQuestion, 'id'> = {
    text: "What is 2+2?",
    type: "multiple-choice",
    options: ["3", "4", "5"],
    correctAnswer: "4",
    isEliminatory: false,
    referential: "R489", // Assuming ReferentialType allows this
    theme: "Calculs",    // Assuming QuestionTheme allows this
    createdAt: new Date().toISOString(),
  };
  const addedId = await StorageManager.addQuestion(newQuestionData);
  console.log("Added question with ID:", addedId);

  if (addedId) {
    // Test getQuestionById
    const fetchedQuestion = await StorageManager.getQuestionById(addedId);
    console.log("Fetched question by ID:", fetchedQuestion);

    // Test updateQuestion
    const updates: Partial<StoredQuestion> = { text: "What is two plus two?" };
    const updatedCount = await StorageManager.updateQuestion(addedId, updates);
    console.log("Updated question, count:", updatedCount);
    const updatedQuestion = await StorageManager.getQuestionById(addedId);
    console.log("Fetched updated question:", updatedQuestion);


    // Test getAllQuestions
    // const allQuestions = await StorageManager.getAllQuestions();
    // console.log("All questions:", allQuestions);


    // Test deleteQuestion
    // await StorageManager.deleteQuestion(addedId);
    // console.log("Deleted question with ID:", addedId);
    // const deletedQuestion = await StorageManager.getQuestionById(addedId);
    // console.log("Attempt to fetch deleted question:", deletedQuestion); // Should be undefined
  }

   const allQuestions = await StorageManager.getAllQuestions();
   console.log("All questions at end:", allQuestions);
}

// testStorageManager(); // Uncomment to run test
*/
