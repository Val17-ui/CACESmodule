import Dexie, { Table } from 'dexie';
import { CACESReferential, Session, Participant, SessionResult } from './types';

// Interfaces pour la DB
export interface QuestionWithId {
  id?: number;
  text: string;
  type: 'multiple-choice' | 'true-false';
  options: string[];
  correctAnswer: string;
  timeLimit?: number;
  isEliminatory: boolean;
  referential: CACESReferential | string;
  theme: string;
  image?: Blob | null;
  createdAt?: string;
  updatedAt?: string;
  usageCount?: number;
  correctResponseRate?: number;
  slideGuid?: string;
}

export interface VotingDevice {
  id?: number;
  physicalId: string;
}

export class MySubClassedDexie extends Dexie {
  questions!: Table<QuestionWithId, number>;
  sessions!: Table<Session, number>;
  sessionResults!: Table<SessionResult, number>;
  adminSettings!: Table<{ key: string; value: any }, string>;
  votingDevices!: Table<VotingDevice, number>;

  constructor() {
    super('myDatabase');
    this.version(1).stores({
      questions: '++id, text, type, correctAnswer, timeLimit, isEliminatory, referential, theme, createdAt, usageCount, correctResponseRate, *options'
    });
    this.version(2).stores({
      questions: '++id, text, type, correctAnswer, timeLimit, isEliminatory, referentiel, theme, createdAt, usageCount, correctResponseRate, *options',
      sessions: '++id, nomSession, dateSession, referentiel, createdAt, location',
      sessionResults: '++id, sessionId, questionId, participantIdBoitier, timestamp'
    });
    this.version(3).stores({
      questions: '++id, text, type, correctAnswer, timeLimit, isEliminatory, referential, theme, createdAt, usageCount, correctResponseRate, slideGuid, *options',
      sessions: '++id, nomSession, dateSession, referentiel, createdAt, location',
      sessionResults: '++id, sessionId, questionId, participantIdBoitier, timestamp'
    });
    this.version(4).stores({
      questions: '++id, text, type, correctAnswer, timeLimit, isEliminatory, referential, theme, createdAt, usageCount, correctResponseRate, slideGuid, *options',
      sessions: '++id, nomSession, dateSession, referentiel, createdAt, location, status, questionMappings',
      sessionResults: '++id, sessionId, questionId, participantIdBoitier, timestamp'
    });
    this.version(5).stores({
      questions: '++id, text, type, correctAnswer, timeLimit, isEliminatory, referential, theme, createdAt, usageCount, correctResponseRate, slideGuid, *options',
      sessions: '++id, nomSession, dateSession, referentiel, createdAt, location, status, questionMappings, notes',
      sessionResults: '++id, sessionId, questionId, participantIdBoitier, answer, isCorrect, pointsObtained, timestamp'
    });
    this.version(6).stores({
      adminSettings: '&key'
    });
    this.version(7).stores({
      votingDevices: '++id, &physicalId'
    });
  }
}

export const db = new MySubClassedDexie();

// Fonctions CRUD pour Questions
export const addQuestion = async (question: QuestionWithId): Promise<number | undefined> => {
  try {
    const id = await db.questions.add(question);
    return id;
  } catch (error) {
    console.error("Error adding question: ", error);
  }
};

export const getAllQuestions = async (): Promise<QuestionWithId[]> => {
  try {
    return await db.questions.toArray();
  } catch (error) {
    console.error("Error getting all questions: ", error);
    return [];
  }
};

export const getQuestionById = async (id: number): Promise<QuestionWithId | undefined> => {
  try {
    return await db.questions.get(id);
  } catch (error) {
    console.error(`Error getting question with id ${id}: `, error);
  }
};

export const getQuestionsByIds = async (ids: number[]): Promise<QuestionWithId[]> => {
  try {
    const questions = await db.questions.bulkGet(ids);
    return questions.filter((q): q is QuestionWithId => q !== undefined);
  } catch (error) {
    console.error(`Error getting questions by ids: `, error);
    return [];
  }
};

// ... (autres fonctions pour questions, sessions, etc.)

// Fonctions pour AdminSettings
export const getAdminSetting = async (key: string): Promise<any> => {
  try {
    const setting = await db.adminSettings.get(key);
    return setting?.value;
  } catch (error) {
    console.error(`Error getting setting ${key}:`, error);
    return undefined;
  }
};

export const setAdminSetting = async (key: string, value: any): Promise<void> => {
  try {
    await db.adminSettings.put({ key, value });
  } catch (error) {
    console.error(`Error setting ${key}:`, error);
  }
};

export const getAllAdminSettings = async (): Promise<{ key: string; value: any }[]> => {
  try {
    return await db.adminSettings.toArray();
  } catch (error) {
    console.error("Error getting all admin settings:", error);
    return [];
  }
};

// Fonctions CRUD pour VotingDevices
export const addVotingDevice = async (device: Omit<VotingDevice, 'id'>): Promise<number | undefined> => {
  try {
    return await db.votingDevices.add(device as VotingDevice);
  } catch (error) {
    console.error("Error adding voting device:", error);
  }
};

export const getAllVotingDevices = async (): Promise<VotingDevice[]> => {
  try {
    return await db.votingDevices.toArray();
  } catch (error) {
    console.error("Error getting all voting devices:", error);
    return [];
  }
};

export const updateVotingDevice = async (id: number, updates: Partial<VotingDevice>): Promise<number> => {
  try {
    return await db.votingDevices.update(id, updates);
  } catch (error) {
    console.error(`Error updating voting device ${id}:`, error);
    return 0;
  }
};

export const deleteVotingDevice = async (id: number): Promise<void> => {
  try {
    await db.votingDevices.delete(id);
  } catch (error) {
    console.error(`Error deleting voting device ${id}:`, error);
  }
};

export const bulkAddVotingDevices = async (devices: VotingDevice[]): Promise<void> => {
  try {
    await db.votingDevices.bulkAdd(devices, { allKeys: false });
  } catch (error) {
    console.error("Error bulk adding voting devices:", error);
  }
};