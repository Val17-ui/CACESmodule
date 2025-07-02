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

// Specific function to get the globally stored PPTX template
export const getGlobalPptxTemplate = async (): Promise<File | null> => {
  try {
    const templateFile = await db.adminSettings.get('pptxTemplateFile');
    if (templateFile && templateFile.value instanceof File) {
      return templateFile.value;
    } else if (templateFile && templateFile.value instanceof Blob) {
      // If it's stored as a Blob, try to reconstruct a File object.
      // This might happen depending on how Dexie handles File objects across sessions/versions.
      // We'd ideally need the filename, but for now, a default name or just the blob is better than nothing.
      // For robust File reconstruction, storing filename alongside was a good idea.
      const fileName = (await db.adminSettings.get('pptxTemplateFileName'))?.value || 'template.pptx';
      return new File([templateFile.value], fileName, { type: templateFile.value.type });
    }
    return null;
  } catch (error) {
    console.error("Error getting global PPTX template:", error);
    return null;
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

// --- Fonctions de Reporting ---

export interface BlockUsage {
  referentiel: CACESReferential | string;
  theme: string;
  blockId: string;
  usageCount: number;
}

/**
 * Calcule le nombre de fois où chaque bloc a été utilisé dans les sessions terminées,
 * avec un filtre optionnel sur la période.
 * @param startDate - Date de début optionnelle (string ISO ou objet Date).
 * @param endDate - Date de fin optionnelle (string ISO ou objet Date).
 */
export const calculateBlockUsage = async (startDate?: string | Date, endDate?: string | Date): Promise<BlockUsage[]> => {
  const usageMap = new Map<string, BlockUsage>();

  try {
    let query = db.sessions.where('status').equals('completed');

    let sessionsQuery = db.sessions.where('status').equals('completed');

    if (startDate) {
      const start = startDate instanceof Date ? startDate : new Date(startDate);
      start.setHours(0, 0, 0, 0);
      // Placeholder pour une requête Dexie plus performante si dateSession est indexé
      // sessionsQuery = sessionsQuery.and(session => new Date(session.dateSession) >= start);
    }

    if (endDate) {
      const end = endDate instanceof Date ? endDate : new Date(endDate);
      end.setHours(23, 59, 59, 999);
      // Placeholder pour une requête Dexie plus performante
      // sessionsQuery = sessionsQuery.and(session => new Date(session.dateSession) <= end);
    }

    const completedSessions = await sessionsQuery.toArray();
    let filteredSessions = completedSessions;

    if (startDate) {
      const start = startDate instanceof Date ? startDate : new Date(startDate);
      start.setHours(0, 0, 0, 0);
      filteredSessions = filteredSessions.filter(session => {
        const sessionDate = new Date(session.dateSession);
        return sessionDate >= start;
      });
    }

    if (endDate) {
      const end = endDate instanceof Date ? endDate : new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filteredSessions = filteredSessions.filter(session => {
        const sessionDate = new Date(session.dateSession);
        return sessionDate <= end;
      });
    }

    for (const session of filteredSessions) {
      if (session.selectionBlocs && session.selectionBlocs.length > 0) {
        const sessionReferentiel = session.referentiel;

        for (const bloc of session.selectionBlocs) {
          const key = `${sessionReferentiel}-${bloc.theme}-${bloc.blockId}`;

          if (usageMap.has(key)) {
            const currentUsage = usageMap.get(key)!;
            currentUsage.usageCount++;
          } else {
            usageMap.set(key, {
              referentiel: sessionReferentiel,
              theme: bloc.theme,
              blockId: bloc.blockId,
              usageCount: 1,
            });
          }
        }
      }
    }
    return Array.from(usageMap.values());
  } catch (error) {
    console.error("Erreur lors du calcul de l'utilisation des blocs:", error);
    return [];
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
    await db.sessions.update(id, updates);
    return id;
  } catch (error) {
    console.error(`Error updating session with id ${id}: `, error);
  }
};

export const deleteSession = async (id: number): Promise<void> => {
  try {
    await db.sessions.delete(id);
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

export const getAllResults = async (): Promise<SessionResult[]> => {
  try {
    return await db.sessionResults.toArray();
  } catch (error) {
    console.error("Error getting all session results: ", error);
    return [];
  }
};

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

export const getQuestionsForSessionBlocks = async (selectionBlocs: { theme: string; blockId: string }[]): Promise<QuestionWithId[]> => {
  if (!selectionBlocs || selectionBlocs.length === 0) {
    return [];
  }
  const allMatchingQuestions: QuestionWithId[] = [];
  try {
    for (const bloc of selectionBlocs) {
      const questionsFromDb = await db.questions.where('theme').startsWith(bloc.theme).toArray();
      questionsFromDb.forEach(q => {
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