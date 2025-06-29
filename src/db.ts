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
  slideGuid?: string; // Ajout du SlideGUID
}

export class MySubClassedDexie extends Dexie {
  questions!: Table<QuestionWithId, number>; // Clé primaire de type number
  sessions!: Table<Session, number>; // Nouvelle table pour les sessions
  sessionResults!: Table<SessionResult, number>; // Nouvelle table pour les résultats de session

  constructor() {
    super('myDatabase');
    this.version(1).stores({
      // Schéma existant pour la table questions (sans slideGuid)
      questions: '++id, text, type, correctAnswer, timeLimit, isEliminatory, referential, theme, createdAt, usageCount, correctResponseRate, *options'
    });

    this.version(2).stores({
      // Schéma de la v1 reconduit pour questions
      questions: '++id, text, type, correctAnswer, timeLimit, isEliminatory, referentiel, theme, createdAt, usageCount, correctResponseRate, *options',
      sessions: '++id, nomSession, dateSession, referentiel, createdAt, location',
      sessionResults: '++id, sessionId, questionId, participantIdBoitier, timestamp'
    });

    // Nouvelle version pour ajouter slideGuid à questions
    this.version(3).stores({
      questions: '++id, text, type, correctAnswer, timeLimit, isEliminatory, referential, theme, createdAt, usageCount, correctResponseRate, slideGuid, *options',
      sessions: '++id, nomSession, dateSession, referentiel, createdAt, location',
      sessionResults: '++id, sessionId, questionId, participantIdBoitier, timestamp'
    });

    // Nouvelle version pour ajouter questionMappings à sessions
    this.version(4).stores({
      questions: '++id, text, type, correctAnswer, timeLimit, isEliminatory, referential, theme, createdAt, usageCount, correctResponseRate, slideGuid, *options',
      sessions: '++id, nomSession, dateSession, referentiel, createdAt, location, status, questionMappings',
      sessionResults: '++id, sessionId, questionId, participantIdBoitier, timestamp'
    });

    // Nouvelle version pour ajouter pointsObtained à sessionResults
    this.version(5).stores({
      questions: '++id, text, type, correctAnswer, timeLimit, isEliminatory, referential, theme, createdAt, usageCount, correctResponseRate, slideGuid, *options', // Repris de v4
      sessions: '++id, nomSession, dateSession, referentiel, createdAt, location, status, questionMappings', // Repris de v4
      sessionResults: '++id, sessionId, questionId, participantIdBoitier, answer, isCorrect, pointsObtained, timestamp' // Ajout de pointsObtained
    });
    // Note: Dexie gère les migrations additives. Les sessionResults existants auront pointsObtained: undefined.
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

// Récupérer les questions spécifiques basées sur une sélection de blocs (pour une session)
export const getQuestionsForSessionBlocks = async (selectionBlocs: { theme: string; blockId: string }[]): Promise<QuestionWithId[]> => {
  if (!selectionBlocs || selectionBlocs.length === 0) {
    return [];
  }

  const allMatchingQuestions: QuestionWithId[] = [];

  try {
    for (const bloc of selectionBlocs) {
      // StorageManager.getQuestionsForBlock(referential, baseTheme, chosenBlockIdentifier);
      // Ici, nous devons simuler une logique similaire ou adapter.
      // Puisque QuestionWithId a 'theme' et potentiellement une manière d'identifier un 'blockId'
      // (peut-être que 'theme' dans QuestionWithId est composite comme 'securite_A')
      // ou alors il faut une structure de données plus complexe pour les blocs.
      // Pour l'instant, supposons que 'theme' dans QuestionWithId peut être 'theme_blockId'
      // ou que nous filtrons par thème puis par une autre propriété pour le bloc si elle existe.

      // Exemple simplifié: si le thème de la question est exactement "theme_blockId"
      // const blockThemeIdentifier = `${bloc.theme}_${bloc.blockId}`;
      // const questionsFromDb = await db.questions.where('theme').equals(blockThemeIdentifier).toArray();

      // Ou, si 'theme' est juste le thème principal et 'blockId' n'est pas directement un champ de QuestionWithId
      // cette fonction devient plus complexe et pourrait nécessiter de lire toutes les questions d'un thème
      // puis de les filtrer d'une manière ou d'une autre si 'blockId' n'est pas un champ.
      // Pour la simulation, nous allons supposer que le thème stocké dans QuestionWithId
      // est une concaténation ou que nous pouvons filtrer par thème principal.
      // Pour l'instant, cette fonction est un placeholder et nécessitera une logique de filtrage
      // plus précise basée sur la structure réelle de QuestionWithId et comment les blocs sont définis.

      // Placeholder: Récupère toutes les questions pour le thème principal pour l'instant.
      // La logique de "bloc" spécifique doit être affinée.
      const questionsFromDb = await db.questions.where('theme').startsWith(bloc.theme).toArray();
      // Il faudrait ensuite filtrer ces questions pour celles appartenant spécifiquement à `bloc.blockId`.
      // Cela suppose que `blockId` est encodé quelque part dans les données de la question,
      // ou que la structure de `theme` dans `QuestionWithId` est composite (ex: `securite_A`).
      // Si `QuestionWithId.theme` est juste "securite", et `blockId` est "A", il faut une autre info.

      // Pour l'instant, on va ajouter toutes les questions du thème principal,
      // en sachant que c'est une simplification.
      questionsFromDb.forEach(q => {
        // Éviter les doublons si une question pouvait appartenir à plusieurs "blocs" logiques via ce filtre simple
        if (!allMatchingQuestions.some(mq => mq.id === q.id)) {
          allMatchingQuestions.push(q);
        }
      });
    }
    console.log(`Récupéré ${allMatchingQuestions.length} questions pour les blocs de la session.`);
    return allMatchingQuestions;
  } catch (error) {
    console.error("Erreur lors de la récupération des questions pour les blocs de session:", error);
    return [];
  }
};
