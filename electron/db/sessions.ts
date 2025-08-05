import { getDb, asyncDbRun, logger } from './index';
import type { Session, SessionIteration, Participant } from '@common/types';

const JSON_SESSION_FIELDS = [
  'selectedBlocIds', 'questionMappings', 'ignoredSlideGuids',
  'resolvedImportAnomalies'
];

const rowToSession = (row: any): Session => {
	if (!row) return undefined as any;
	const session: any = { ...row };
	for (const field of JSON_SESSION_FIELDS) {
	  if (session[field] && typeof session[field] === 'string') {
		try {
		  session[field] = JSON.parse(session[field]);
		} catch (e) {
		  logger?.debug(`[DB Sessions] Failed to parse JSON field ${field} for session id ${row.id}: ${e}`);
		}
	  } else if (session[field] === null && (field === 'selectedBlocIds' || field === 'ignoredSlideGuids')) {
		session[field] = [];
	  }
	}
	return session as Session;
  };

  const sessionToRow = (session: Partial<Omit<Session, 'id'> | Session>) => {
	const rowData: any = { ...session };
	for (const field of JSON_SESSION_FIELDS) {
	  if (rowData[field] !== undefined) {
		rowData[field] = JSON.stringify(rowData[field]);
	  }
	}
	if ('id' in rowData && !Object.prototype.hasOwnProperty.call(session, 'id')) {
	  delete rowData.id;
	}
	return rowData;
  };

export const addSession = async (session: Omit<Session, 'id'>): Promise<number | undefined> => {
  logger?.info(`[DB] LOG: addSession received data: ${JSON.stringify(session, null, 2)}`);
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare(`
        INSERT INTO sessions (
          nomSession, dateSession, referentielId, selectedBlocIds, selectedKitId,
          createdAt, location, status, questionMappings, notes, trainerId,
          ignoredSlideGuids, resolvedImportAnomalies, orsFilePath, resultsImportedAt,
          num_session, num_stage, iteration_count
        ) VALUES (
          @nomSession, @dateSession, @referentielId, @selectedBlocIds, @selectedKitId,
          @createdAt, @location, @status, @questionMappings, @notes, @trainerId,
          @ignoredSlideGuids, @resolvedImportAnomalies, @orsFilePath, @resultsImportedAt,
          @num_session, @num_stage, @iteration_count
        )
      `);
      const rowData = sessionToRow(session);
      const result = stmt.run(rowData);
      logger?.info(`[DB] New session added with ID: ${result.lastInsertRowid}`);
      return result.lastInsertRowid as number;
    } catch (error) {
      logger?.debug(`[DB Sessions] Error adding session: ${error}`);
      throw error;
    }
  });
};

export const getAllSessions = async (): Promise<Session[]> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare(`
        SELECT
          s.id, s.nomSession, s.dateSession, s.referentielId, s.selectedBlocIds, s.selectedKitId,
          s.createdAt, s.location, s.status, s.questionMappings, s.notes, s.trainerId,
          s.ignoredSlideGuids, s.resolvedImportAnomalies, s.orsFilePath, s.resultsImportedAt,
          s.num_session, s.num_stage, s.archived_at, s.iteration_count, s.updatedAt,
          (SELECT COUNT(DISTINCT pa.participant_id)
           FROM participant_assignments pa
           JOIN session_iterations si ON pa.session_iteration_id = si.id
           WHERE si.session_id = s.id) as participantCount,
          (SELECT AVG(sr.isCorrect) * 100
           FROM sessionResults sr
           WHERE sr.sessionId = s.id) as averageScore
        FROM sessions s
        ORDER BY s.dateSession DESC, s.createdAt DESC
      `);
      const rows = stmt.all() as any[];
      return rows.map(row => {
        const session = rowToSession(row);
        session.averageScore = row.averageScore === null ? null : Number(row.averageScore);
        return session;
      });
    } catch (error) {
      logger?.debug(`[DB Sessions] Error getting all sessions: ${error}`);
      throw error;
    }
  });
};

export const getSessionById = async (id: number): Promise<Session | undefined> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare(`
          SELECT
            id, nomSession, dateSession, referentielId, selectedBlocIds, selectedKitId,
            createdAt, location, status, questionMappings, notes, trainerId,
            ignoredSlideGuids, resolvedImportAnomalies, orsFilePath, resultsImportedAt,
            num_session, num_stage, archived_at, iteration_count, updatedAt
          FROM sessions
          WHERE id = ?
        `);
        const row = stmt.get(id) as any;
        if (!row) return undefined;

        const session = rowToSession(row);

        const iterationsFromDb = getDb().prepare("SELECT * FROM session_iterations WHERE session_id = ? ORDER BY iteration_index ASC").all(id) as SessionIteration[];

        const iterationsWithParticipants = iterationsFromDb.map(iter => {
          if (!iter.id) {
            return {
              ...iter,
              participants: [],
              question_mappings: iter.question_mappings ? JSON.parse(iter.question_mappings as any) : [],
            };
          }

          const assignments = getDb().prepare(`
            SELECT p.id as participant_id, p.first_name, p.last_name, p.organization, p.identification_code, pa.voting_device_id
            FROM participant_assignments pa
            JOIN participants p ON pa.participant_id = p.id
            WHERE pa.session_iteration_id = ?
          `).all(iter.id) as any[];

          const participantsForIter: Participant[] = assignments.map(a => ({
            id: a.participant_id,
            nom: a.last_name,
            prenom: a.first_name,
            organization: a.organization,
            identificationCode: a.identification_code,
            assignedGlobalDeviceId: a.voting_device_id,
          }));

          return {
            ...iter,
            participants: participantsForIter,
            question_mappings: iter.question_mappings ? JSON.parse(iter.question_mappings as any) : [],
          };
        });

        session.iterations = iterationsWithParticipants;

        const allParticipants = new Map<number, Participant>();
        iterationsWithParticipants.forEach(iter => {
          if (iter.participants) {
            iter.participants.forEach(p => {
              if (p.id) {
                allParticipants.set(p.id, p);
              }
            });
          }
        });
        session.participants = Array.from(allParticipants.values());

        return session;
      } catch (error) {
        logger?.debug(`[DB Sessions] Error getting session by id ${id}: ${error}`);
        throw error;
      }
    });
  };

export const updateSession = async (id: number, updates: Partial<Omit<Session, 'id'>>): Promise<number | undefined> => {
    return asyncDbRun(() => {
      try {
        const fieldsToUpdate = { ...updates };
        const rowUpdates = sessionToRow(fieldsToUpdate);

        if (updates.iteration_count !== undefined && !rowUpdates.hasOwnProperty('iteration_count')) {
            rowUpdates.iteration_count = updates.iteration_count;
        }

        const fields = Object.keys(rowUpdates).filter(key => key !== 'id');
        if (fields.length === 0) return 0;

        const setClause = fields.map(field => `${field} = @${field}`).join(', ');
        const stmt = getDb().prepare(`UPDATE sessions SET ${setClause} WHERE id = @id`);

        const result = stmt.run({ ...rowUpdates, id });
        return result.changes;
      } catch (error) {
        logger?.debug(`[DB Sessions] Error updating session ${id}: ${error}`);
        throw error;
      }
    });
  };

export const deleteSession = async (id: number): Promise<void> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare("DELETE FROM sessions WHERE id = ?");
        stmt.run(id);
      } catch (error) {
        logger?.debug(`[DB Sessions] Error deleting session ${id}: ${error}`);
        throw error;
      }
    });
  };

export const archiveOldSessions = async (): Promise<void> => {
    return asyncDbRun(() => {
      try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const stmt = getDb().prepare(`
          UPDATE sessions
          SET archived_at = ?
          WHERE status = 'completed'
            AND archived_at IS NULL
            AND date(resultsImportedAt) < date(?)
        `);
        stmt.run(new Date().toISOString(), sevenDaysAgo.toISOString());
      } catch (error) {
        logger?.debug(`[DB Sessions] Error archiving old sessions: ${error}`);
        throw error;
      }
    });
};

export const checkAndFinalizeSessionStatus = async (sessionId: number): Promise<boolean> => {
    return asyncDbRun(() => {
        try {
            const iterations = getDb().prepare("SELECT status FROM session_iterations WHERE session_id = ?").all(sessionId) as { status: string }[];

            if (iterations.length === 0) {
                return false;
            }

            const allIterationsDone = iterations.every(
                iter => iter.status === 'completed' || iter.status === 'cancelled'
            );

            if (allIterationsDone) {
                const stmt = getDb().prepare("UPDATE sessions SET status = 'completed', resultsImportedAt = ? WHERE id = ?");
                stmt.run(new Date().toISOString(), sessionId);
                return true;
            } else {
                return false;
            }
        } catch (error) {
            logger?.debug(`[DB Sessions] Error checking/finalizing session status for ${sessionId}: ${error}`);
            throw error;
        }
    });
};

export const addOrUpdateSessionIteration = async (iteration: SessionIteration): Promise<number | undefined> => {
    return asyncDbRun(() => {
        try {
            const selectStmt = getDb().prepare(
                'SELECT id FROM session_iterations WHERE session_id = ? AND iteration_index = ?'
            );
            const existing = selectStmt.get(iteration.session_id, iteration.iteration_index) as { id: number } | undefined;

            const dataToSave = {
                ...iteration,
                name: iteration.name || `Itération ${iteration.iteration_index + 1}`,
                question_mappings: JSON.stringify(iteration.question_mappings || []),
                created_at: iteration.created_at || new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };

            if (existing) {
                const { id, session_id, iteration_index, created_at, ...updates } = dataToSave;
                const fields = Object.keys(updates);
                if (fields.length === 0) return existing.id;
                const setClause = fields.map(field => `${field} = @${field}`).join(', ');
                const updateStmt = getDb().prepare(`UPDATE session_iterations SET ${setClause} WHERE id = @id`);
                updateStmt.run({ ...updates, id: existing.id });
                return existing.id;
            } else {
                const insertStmt = getDb().prepare(`
                    INSERT INTO session_iterations (session_id, iteration_index, name, ors_file_path, status, question_mappings, created_at, updated_at)
                    VALUES (@session_id, @iteration_index, @name, @ors_file_path, @status, @question_mappings, @created_at, @updated_at)
                `);
                const result = insertStmt.run(dataToSave);
                return result.lastInsertRowid as number;
            }
        } catch (error) {
            logger?.debug(`[DB SessionIterations] Error in addOrUpdateSessionIteration: ${error}`);
            throw error;
        }
    });
};

export const getSessionIterationsBySessionId = async (sessionId: number): Promise<SessionIteration[]> => {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("SELECT * FROM session_iterations WHERE session_id = ?");
            return stmt.all(sessionId) as SessionIteration[];
        } catch (error) {
            logger?.debug(`[DB SessionIterations] Error getting session iterations for session ${sessionId}: ${error}`);
            throw error;
        }
    });
};

export const updateSessionIteration = async (id: number, updates: Partial<Omit<SessionIteration, 'id'>>): Promise<number | undefined> => {
    return asyncDbRun(() => {
        try {
            const fields = Object.keys(updates).filter(key => key !== 'id');
            if (fields.length === 0) return 0;

            const setClause = fields.map(field => `${field} = @${field}`).join(', ');
            const stmt = getDb().prepare(`UPDATE session_iterations SET ${setClause} WHERE id = @id`);

            const result = stmt.run({ ...updates, id });
            return result.changes;
        } catch (error) {
            logger?.debug(`[DB SessionIterations] Error updating session iteration ${id}: ${error}`);
            throw error;
        }
    });
};
