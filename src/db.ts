import Dexie, { Table } from 'dexie';
// Import specific types needed from the project's type definitions
import { CACESReferential, QuestionTheme } from './types'; // Adjusted path, ensured CACESReferential is imported

// Define QuestionWithId specifically for Dexie storage.
// It does not extend project's Question interface directly to allow 'id' to be a number for Dexie.
export interface QuestionWithId {
  id?: number; // Auto-incremented primary key
  text: string;
  type: 'multiple-choice' | 'true-false'; // Using literal types directly
  options: string[];
  correctAnswer: string; // Storing the answer text or a key that maps to it
  timeLimit?: number;
  isEliminatory: boolean;
  referential: CACESReferential; // Standardize to CACESReferential enum
  theme: QuestionTheme;         // Using imported QuestionTheme
  image?: Blob | null; // Allow null for easier clearing, Blob for storage
  createdAt?: string;
  updatedAt?: string; // Add missing field
  usageCount?: number;
  correctResponseRate?: number;
}

// QuestionnaireWithId interface removed as Questionnaire entity is no longer stored.

export class MySubClassedDexie extends Dexie {
  questions!: Table<QuestionWithId, number>; // Second type arg is the primary key type
  // questionnaires table removed.

  constructor() {
    super('myDatabase');
    this.version(1).stores({
      // Define schema for QuestionWithId. All fields to be indexed are listed.
      // `image` (Blob) is typically not indexed directly.
      questions: '++id, text, type, correctAnswer, timeLimit, isEliminatory, referential, theme, createdAt, usageCount, correctResponseRate, *options'
      // Indexing 'options' as a multiEntry index if searching by options is needed.
      // questionnaires table definition removed.
    });
  }
}

export const db = new MySubClassedDexie();

// Service functions

export const addQuestion = async (question: QuestionWithId): Promise<number | undefined> => {
  try {
    // Ensure `image` is either a Blob or undefined, not null, if Dexie has issues with null.
    // However, Dexie v4 should handle null fine. Let's assume it's okay or handled by QuestionWithId type.
    const id = await db.questions.add(question);
    return id;
  } catch (error) {
    console.error("Error adding question: ", error);
    // Consider re-throwing or returning a more specific error/result
  }
};

export const getAllQuestions = async (): Promise<QuestionWithId[]> => {
  try {
    const questions = await db.questions.toArray();
    return questions;
  } catch (error) {
    console.error("Error getting all questions: ", error);
    return []; // Return empty array or re-throw
  }
};

export const getQuestionById = async (id: number): Promise<QuestionWithId | undefined> => {
  try {
    const question = await db.questions.get(id);
    return question;
  } catch (error) {
    console.error(`Error getting question with id ${id}: `, error);
    // Consider re-throwing
  }
};

export const updateQuestion = async (id: number, updates: Partial<QuestionWithId>): Promise<number | undefined> => {
  try {
    await db.questions.update(id, updates);
    return id;
  } catch (error) {
    console.error(`Error updating question with id ${id}: `, error);
    // Consider re-throwing
  }
};

export const deleteQuestion = async (id: number): Promise<void> => {
  try {
    await db.questions.delete(id);
  } catch (error) {
    console.error(`Error deleting question with id ${id}: `, error);
    // Consider re-throwing
  }
};
