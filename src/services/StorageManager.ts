// src/services/StorageManager.ts
import {
  db,
  QuestionWithId,
  addReferential,
  getAllReferentiels,
  getReferentialByCode,
  addTheme,
  getAllThemes,
  getThemesByReferentialId,
  getThemeByCodeAndReferentialId,
  addBloc,
  getAllBlocs,
  getBlocsByThemeId,
  getBlocByCodeAndThemeId
} from '../db';
// CACESReferential might be unused now. Referential, Theme, Bloc types are likely still needed if StoredQuestion or other types here reference them.
// For now, let's keep Referential, Theme, Bloc types from ../types if they are implicitly used by QuestionWithId or other function signatures.
// import { CACESReferential, Referential, Theme, Bloc } from '../types';
// CACESReferential removed from imports as it's not directly used by StorageManager methods anymore.

// Re-export QuestionWithId as StoredQuestion for clarity within this module and for consumers
// StoredQuestion now reflects the new structure from db.ts (with blocId, without referential/theme)
export type StoredQuestion = QuestionWithId;
// StoredQuestionnaire type removed

export const StorageManager = {
  // Expose db functions for referentiels, themes, blocs directly by re-exporting them.
  // This makes them available under the StorageManager namespace for components that already use it.
  // Alternatively, components could import these directly from '../db.ts'.
  addReferential,
  getAllReferentiels,
  getReferentialByCode,
  addTheme,
  getAllThemes,
  getThemesByReferentialId,
  getThemeByCodeAndReferentialId,
  addBloc,
  getAllBlocs,
  getBlocsByThemeId,
  getBlocByCodeAndThemeId,

  /**
   * Adds a new question to the database.
   * The 'id' field should be omitted as it's auto-generated by Dexie.
   * @param questionData - The question data without the 'id'.
   * @returns The ID of the newly added question, or undefined if an error occurs.
   */
  async addQuestion(questionData: Omit<StoredQuestion, 'id'>): Promise<number | undefined> {
    try {
      // Dexie's add method expects the full object, but 'id' will be auto-filled.
      // If StoredQuestion['id'] is optional (e.g., id?: number), this cast is fine.
      // If 'id' is mandatory in StoredQuestion, this approach correctly uses Omit.
      const id = await db.questions.add(questionData as StoredQuestion);
      return id;
    } catch (error) {
      console.error("StorageManager: Error adding question", error);
      return undefined;
    }
  },

  /**
   * Retrieves all questions from the database.
   * @returns An array of StoredQuestion objects.
   */
  async getAllQuestions(): Promise<StoredQuestion[]> {
    try {
      const questions = await db.questions.toArray();
      return questions;
    } catch (error) { // Added opening curly brace
      console.error("StorageManager: Error getting all questions", error);
      return []; // Return an empty array in case of error
    }
  },

  /**
   * Retrieves a specific question by its ID.
   * @param id - The ID of the question to retrieve.
   * @returns The StoredQuestion object if found, otherwise undefined.
   */
  async getQuestionById(id: number): Promise<StoredQuestion | undefined> {
    try {
      const question = await db.questions.get(id);
      return question;
    } catch (error) {
      console.error(`StorageManager: Error getting question with id ${id}`, error);
      return undefined;
    }
  },

  /**
   * Updates an existing question in the database.
   * @param id - The ID of the question to update.
   * @param updates - An object containing the fields to update.
   * @returns The number of updated records (0 or 1), or undefined if an error occurs.
   */
  async updateQuestion(id: number, updates: Partial<StoredQuestion>): Promise<number | undefined> {
    try {
      // Ensure 'id' is not part of the updates object passed to Dexie's update method
      const { id: _, ...restUpdates } = updates;
      const numUpdated = await db.questions.update(id, restUpdates);
      return numUpdated;
    } catch (error) {
      console.error(`StorageManager: Error updating question with id ${id}`, error);
      return undefined;
    }
  },

  /**
   * Deletes a question from the database.
   * @param id - The ID of the question to delete.
   * @returns A promise that resolves when the deletion is complete, or rejects on error.
   */
  async deleteQuestion(id: number): Promise<void> {
    try {
      await db.questions.delete(id);
    } catch (error) {
      console.error(`StorageManager: Error deleting question with id ${id}`, error);
      // Optionally re-throw or handle more gracefully depending on application needs
      // For now, just logging, as the return type is void.
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

  /**
   * Retrieves all questions for a specific blocId.
   * @param blocId - The ID of the bloc.
   * @returns A promise that resolves to an array of StoredQuestion objects.
   */
  async getQuestionsForBloc(blocId: number): Promise<StoredQuestion[]> {
    try {
      const questions = await db.questions.where({ blocId }).toArray();
      return questions;
    } catch (error) {
      console.error(`StorageManager: Error getting questions for blocId ${blocId}`, error);
      return [];
    }
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
