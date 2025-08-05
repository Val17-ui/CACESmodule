import { getDb, asyncDbRun, logger } from './index';
import type { SessionResult, SessionQuestion, SessionBoitier } from '@common/types';

const rowToSessionResult = (row: any): SessionResult => {
    if (!row) return undefined as any;
    const result: any = { ...row };

    if (result.answer && typeof result.answer === 'string') {
      try {
        result.answer = JSON.parse(result.answer);
      } catch (e) {
        // Not JSON, leave as is
      }
    }
    result.isCorrect = result.isCorrect === 1;
    return result as SessionResult;
};

const sessionResultToRow = (sessionResult: Partial<Omit<SessionResult, 'id'> | SessionResult>) => {
    const rowData: any = { ...sessionResult };

    if (rowData.answer !== undefined && typeof rowData.answer !== 'string') {
      rowData.answer = JSON.stringify(rowData.answer);
    }
    if (rowData.isCorrect !== undefined) {
      rowData.isCorrect = rowData.isCorrect ? 1 : 0;
    }
    if ('id' in rowData && !Object.prototype.hasOwnProperty.call(sessionResult, 'id')) {
      delete rowData.id;
    }
    return rowData;
};

export const addSessionResult = async (result: Omit<SessionResult, 'id'>): Promise<number | undefined> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare(`
          INSERT INTO sessionResults (sessionId, session_iteration_id, questionId, participantIdBoitier, participantId, answer, isCorrect, pointsObtained, timestamp)
          VALUES (@sessionId, @sessionIterationId, @questionId, @participantIdBoitier, @participantId, @answer, @isCorrect, @pointsObtained, @timestamp)
        `);
        const rowData = sessionResultToRow(result);
        const res = stmt.run(rowData);
        return res.lastInsertRowid as number;
      } catch (error) {
        logger?.debug(`[DB SessionResults] Error adding session result: ${error}`);
        throw error;
      }
    });
};

export const addBulkSessionResults = async (results: Omit<SessionResult, 'id'>[]): Promise<(number | undefined)[] | undefined> => {
    if (!results || results.length === 0) return Promise.resolve([]);

    return asyncDbRun(() => {
      const insertedIds: (number | undefined)[] = [];
      const insertStmt = getDb().prepare(`
        INSERT INTO sessionResults (sessionId, session_iteration_id, questionId, participantIdBoitier, participantId, answer, isCorrect, pointsObtained, timestamp)
        VALUES (@sessionId, @sessionIterationId, @questionId, @participantIdBoitier, @participantId, @answer, @isCorrect, @pointsObtained, @timestamp)
      `);

      const transaction = getDb().transaction((items: Omit<SessionResult, 'id'>[]) => {
        for (const result of items) {
          try {
            const rowData = sessionResultToRow(result);
            const res = insertStmt.run(rowData);
            insertedIds.push(res.lastInsertRowid as number);
          } catch (error) {
            logger?.debug(`[DB SessionResults] Error in bulk adding session result for item: ${result}, ${error}`);
            insertedIds.push(undefined);
            throw error;
          }
        }
      });

      try {
        transaction(results);
        return insertedIds;
      } catch (error) {
        logger?.debug(`[DB SessionResults] Bulk add transaction failed.`);
        return undefined;
      }
    });
};

export const getAllResults = async (): Promise<SessionResult[]> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare("SELECT * FROM sessionResults");
        const rows = stmt.all() as any[];
        return rows.map(rowToSessionResult);
      } catch (error) {
        logger?.debug(`[DB SessionResults] Error getting all results: ${error}`);
        throw error;
      }
    });
};

export const getResultsForSession = async (sessionId: number): Promise<SessionResult[]> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare("SELECT * FROM sessionResults WHERE sessionId = ? ORDER BY timestamp ASC");
        const rows = stmt.all(sessionId) as any[];
        return rows.map(rowToSessionResult);
      } catch (error) {
        logger?.debug(`[DB SessionResults] Error getting results for session ${sessionId}: ${error}`);
        throw error;
      }
    });
};

export const getResultBySessionAndQuestion = async (sessionId: number, questionId: number, participantIdBoitier: string): Promise<SessionResult | undefined> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare("SELECT * FROM sessionResults WHERE sessionId = ? AND questionId = ? AND participantIdBoitier = ?");
        const row = stmt.get(sessionId, questionId, participantIdBoitier) as any;
        return row ? rowToSessionResult(row) : undefined;
      } catch (error) {
        logger?.debug(`[DB SessionResults] Error getting result for session ${sessionId}, question ${questionId}, boitier ${participantIdBoitier}: ${error}`);
        throw error;
      }
    });
};

export const updateSessionResult = async (id: number, updates: Partial<Omit<SessionResult, 'id'>>): Promise<number | undefined> => {
    return asyncDbRun(() => {
      try {
        const rowUpdates = sessionResultToRow(updates);
        const fields = Object.keys(rowUpdates).filter(key => key !== 'id');
        if (fields.length === 0) return 0;

        const setClause = fields.map(field => `${field} = @${field}`).join(', ');
        const stmt = getDb().prepare(`UPDATE sessionResults SET ${setClause} WHERE id = @id`);

        const result = stmt.run({ ...rowUpdates, id });
        return result.changes;
      } catch (error) {
        logger?.debug(`[DB SessionResults] Error updating session result ${id}: ${error}`);
        throw error;
      }
    });
};

export const deleteResultsForSession = async (sessionId: number): Promise<void> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare("DELETE FROM sessionResults WHERE sessionId = ?");
        stmt.run(sessionId);
      } catch (error) {
        logger?.debug(`[DB SessionResults] Error deleting results for session ${sessionId}: ${error}`);
        throw error;
      }
    });
};

export const deleteResultsForIteration = async (iterationId: number): Promise<void> => {
    return asyncDbRun(() => {
      try {
        const iteration = getDb().prepare("SELECT session_id FROM session_iterations WHERE id = ?").get(iterationId) as { session_id: number } | undefined;
        if (iteration) {
          const stmt = getDb().prepare("DELETE FROM sessionResults WHERE sessionId = ?");
          stmt.run(iteration.session_id);
        }
      } catch (error) {
        logger?.debug(`[DB SessionResults] Error deleting results for iteration ${iterationId}: ${error}`);
        throw error;
      }
    });
};

export const addSessionQuestion = async (sq: Omit<SessionQuestion, 'id'>): Promise<number | undefined> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare(`
          INSERT INTO sessionQuestions (sessionId, dbQuestionId, slideGuid, blockId)
          VALUES (@sessionId, @dbQuestionId, @slideGuid, @blockId)
        `);
        const result = stmt.run(sq);
        return result.lastInsertRowid as number;
      } catch (error) {
        logger?.debug(`[DB SessionQuestions] Error adding session question: ${error}`);
        throw error;
      }
    });
};

export const addBulkSessionQuestions = async (questions: Omit<SessionQuestion, 'id'>[]): Promise<(number | undefined)[] | undefined> => {
    if (!questions || questions.length === 0) return Promise.resolve([]);

    return asyncDbRun(() => {
      const insertedIds: (number | undefined)[] = [];
      const insertStmt = getDb().prepare(`
        INSERT INTO sessionQuestions (sessionId, dbQuestionId, slideGuid, blockId)
        VALUES (@sessionId, @dbQuestionId, @slideGuid, @blockId)
      `);

      const transaction = getDb().transaction((items: Omit<SessionQuestion, 'id'>[]) => {
        for (const question of items) {
          try {
            const result = insertStmt.run(question);
            insertedIds.push(result.lastInsertRowid as number);
          } catch (error) {
            logger?.debug(`[DB SessionQuestions] Error in bulk adding session question for item: ${question}, ${error}`);
            insertedIds.push(undefined);
            throw error;
          }
        }
      });

      try {
        transaction(questions);
        return insertedIds;
      } catch (error) {
        logger?.debug(`[DB SessionQuestions] Bulk add transaction failed.`);
        return undefined;
      }
    });
};

export const getSessionQuestionsBySessionId = async (sessionId: number): Promise<SessionQuestion[]> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare("SELECT * FROM sessionQuestions WHERE sessionId = ?");
        return stmt.all(sessionId) as SessionQuestion[];
      } catch (error) {
        logger?.debug(`[DB SessionQuestions] Error getting session questions for session ${sessionId}: ${error}`);
        throw error;
      }
    });
};

export const deleteSessionQuestionsBySessionId = async (sessionId: number): Promise<void> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare("DELETE FROM sessionQuestions WHERE sessionId = ?");
        stmt.run(sessionId);
      } catch (error) {
        logger?.debug(`[DB SessionQuestions] Error deleting session questions for session ${sessionId}: ${error}`);
        throw error;
      }
    });
};

export const addSessionBoitier = async (sb: Omit<SessionBoitier, 'id'>): Promise<number | undefined> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare(`
          INSERT INTO sessionBoitiers (sessionId, participantId, visualId, serialNumber)
          VALUES (@sessionId, @participantId, @visualId, @serialNumber)
        `);
        const result = stmt.run(sb);
        return result.lastInsertRowid as number;
      } catch (error) {
        logger?.debug(`[DB SessionBoitiers] Error adding session boitier: ${error}`);
        throw error;
      }
    });
};

export const addBulkSessionBoitiers = async (boitiers: Omit<SessionBoitier, 'id'>[]): Promise<(number | undefined)[] | undefined> => {
    if (!boitiers || boitiers.length === 0) return Promise.resolve([]);

    return asyncDbRun(() => {
      const insertedIds: (number | undefined)[] = [];
      const insertStmt = getDb().prepare(`
        INSERT INTO sessionBoitiers (sessionId, participantId, visualId, serialNumber)
        VALUES (@sessionId, @participantId, @visualId, @serialNumber)
      `);

      const transaction = getDb().transaction((items: Omit<SessionBoitier, 'id'>[]) => {
        for (const boitier of items) {
          try {
            const result = insertStmt.run(boitier);
            insertedIds.push(result.lastInsertRowid as number);
          } catch (error) {
            logger?.debug(`[DB SessionBoitiers] Error in bulk adding session boitier for item: ${boitier}, ${error}`);
            insertedIds.push(undefined);
            throw error;
          }
        }
      });

      try {
        transaction(boitiers);
        return insertedIds;
      } catch (error) {
        logger?.debug(`[DB SessionBoitiers] Bulk add transaction failed.`);
        return undefined;
      }
    });
};

export const getSessionBoitiersBySessionId = async (sessionId: number): Promise<SessionBoitier[]> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare("SELECT * FROM sessionBoitiers WHERE sessionId = ? ORDER BY visualId ASC, participantId ASC");
        return stmt.all(sessionId) as SessionBoitier[];
      } catch (error) {
        logger?.debug(`[DB SessionBoitiers] Error getting session boitiers for session ${sessionId}: ${error}`);
        throw error;
      }
    });
};

export const deleteSessionBoitiersBySessionId = async (sessionId: number): Promise<void> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare("DELETE FROM sessionBoitiers WHERE sessionId = ?");
        stmt.run(sessionId);
      } catch (error) {
        logger?.debug(`[DB SessionBoitiers] Error deleting session boitiers for session ${sessionId}: ${error}`);
        throw error;
      }
    });
};
