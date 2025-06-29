import Dexie, { Table } from 'dexie';
// Importer les types depuis src/types/index.ts
import {
  CACESReferential,
  Session,
  Participant, // Utilisé par Session
  SelectedBlock, // Utilisé par Session
  SessionResult,
  // Question // L'interface Question de types/index.ts décrit la structure originale.
             // Pour Dexie, nous utilisons QuestionWithId ci-dessous.
} from './types';

// L'interface QuestionWithId est spécifique à Dexie pour gérer l'id auto-incrémenté.
// Elle est similaire à l'interface Question mais id est number?
export interface QuestionWithId {
  id?: number; // Auto-incremented primary key
  text: string;
  type: 'multiple-choice' | 'true-false'; // Ajuster si QuestionType enum est préféré ici
  options: string[];
  correctAnswer: string;
  timeLimit?: number;
  isEliminatory: boolean;
  referential: CACESReferential | string; // Permettre string pour flexibilité
  theme: string;
  image?: Blob | null;
  createdAt?: string;
  updatedAt?: string;
  usageCount?: number;
  correctResponseRate?: number;
  // Il faut s'assurer que cette interface est cohérente avec la table 'questions' existante
  // et l'interface `Question` dans `types/index.ts` pour les champs non-ID.
}

export class MySubClassedDexie extends Dexie {
  questions!: Table<QuestionWithId, number>; // Clé primaire de type number
  sessions!: Table<Session, number>; // Nouvelle table pour les sessions
  sessionResults!: Table<SessionResult, number>; // Nouvelle table pour les résultats de session

  constructor() {
    super('myDatabase');
    this.version(1).stores({
      // Schéma existant pour la table questions
      questions: '++id, text, type, correctAnswer, timeLimit, isEliminatory, referential, theme, createdAt, usageCount, correctResponseRate, *options'
    });

    // Nouvelle version pour ajouter les tables sessions et sessionResults
    // et pour mettre à jour la table questions si nécessaire (ici, on la redéclare telle quelle)
    this.version(2).stores({
      questions: '++id, text, type, correctAnswer, timeLimit, isEliminatory, referential, theme, createdAt, usageCount, correctResponseRate, *options', // Redéclarer même si inchangée
      sessions: '++id, nomSession, dateSession, referentiel, createdAt, location', // Ajout de location (non indexé ici, mais présent)
      sessionResults: '++id, sessionId, questionId, participantIdBoitier, timestamp' // Champs indexés pour sessionResults
    });
    // Note: Si des migrations de données sont nécessaires (upgrade), elles seraient ajoutées ici.
    // Pour l'ajout de nouvelles tables, ce n'est pas strictement requis si les anciennes ne changent pas.
  }
}

export const db = new MySubClassedDexie();

// --- Fonctions CRUD pour Questions (existantes) ---
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

export const updateQuestion = async (id: number, updates: Partial<QuestionWithId>): Promise<number | undefined> => {
  try {
    await db.questions.update(id, updates);
    return id;
  } catch (error) {
    console.error(`Error updating question with id ${id}: `, error);
  }
};

export const deleteQuestion = async (id: number): Promise<void> => {
  try {
    await db.questions.delete(id);
  } catch (error) {
    console.error(`Error deleting question with id ${id}: `, error);
  }
};

// --- Nouvelles fonctions CRUD pour Sessions ---
export const addSession = async (session: Session): Promise<number | undefined> => {
  try {
    // Assurer que les dates sont stockées en string si nécessaire (Dexie les gère bien en Date object aussi)
    // session.createdAt = new Date().toISOString();
    // session.updatedAt = new Date().toISOString();
    const id = await db.sessions.add(session);
    return id;
  } catch (error) {
    console.error("Error adding session: ", error);
  }
};

export const getAllSessions = async (): Promise<Session[]> => {
  try {
    return await db.sessions.toArray();
  } catch (error) {
    console.error("Error getting all sessions: ", error);
    return [];
  }
};

export const getSessionById = async (id: number): Promise<Session | undefined> => {
  try {
    return await db.sessions.get(id);
  } catch (error) {
    console.error(`Error getting session with id ${id}: `, error);
  }
};

export const updateSession = async (id: number, updates: Partial<Session>): Promise<number | undefined> => {
  try {
    // updates.updatedAt = new Date().toISOString();
    await db.sessions.update(id, updates);
    return id;
  } catch (error) {
    console.error(`Error updating session with id ${id}: `, error);
  }
};

export const deleteSession = async (id: number): Promise<void> => {
  try {
    await db.sessions.delete(id);
    // Potentiellement, supprimer aussi les sessionResults associés
    await db.sessionResults.where('sessionId').equals(id).delete();
  } catch (error) {
    console.error(`Error deleting session with id ${id}: `, error);
  }
};

// --- Nouvelles fonctions CRUD pour SessionResults ---
export const addSessionResult = async (result: SessionResult): Promise<number | undefined> => {
  try {
    const id = await db.sessionResults.add(result);
    return id;
  } catch (error) {
    console.error("Error adding session result: ", error);
  }
};

export const addBulkSessionResults = async (results: SessionResult[]): Promise<number[] | undefined> => {
  try {
    const ids = await db.sessionResults.bulkAdd(results, { allKeys: true });
    return ids as number[];
  } catch (error) {
    console.error("Error adding bulk session results: ", error);
  }
}

export const getResultsForSession = async (sessionId: number): Promise<SessionResult[]> => {
  try {
    return await db.sessionResults.where('sessionId').equals(sessionId).toArray();
  } catch (error) {
    console.error(`Error getting results for session ${sessionId}: `, error);
    return [];
  }
};

export const getResultBySessionAndQuestion = async (sessionId: number, questionId: number, participantIdBoitier: string): Promise<SessionResult | undefined> => {
  try {
    return await db.sessionResults
      .where({ sessionId, questionId, participantIdBoitier })
      .first();
  } catch (error) {
    console.error(`Error getting specific result: `, error);
  }
};

export const updateSessionResult = async (id: number, updates: Partial<SessionResult>): Promise<number | undefined> => {
  try {
    await db.sessionResults.update(id, updates);
    return id;
  } catch (error) {
    console.error(`Error updating session result with id ${id}: `, error);
  }
};

export const deleteResultsForSession = async (sessionId: number): Promise<void> => {
  try {
    await db.sessionResults.where('sessionId').equals(sessionId).delete();
  } catch (error) {
    console.error(`Error deleting results for session ${sessionId}: `, error);
  }
};
