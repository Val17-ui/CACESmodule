import { getDb, asyncDbRun, logger } from './index';
import type { Trainer } from '@common/types';

export const addTrainer = async (trainer: Omit<Trainer, 'id'>): Promise<number | undefined> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare(`
          INSERT INTO trainers (name, isDefault)
          VALUES (@name, @isDefault)
        `);
        const isDefault = trainer.isDefault ? 1 : 0;
        const result = stmt.run({ ...trainer, isDefault });
        return result.lastInsertRowid as number;
      } catch (error) {
        logger?.debug(`[DB Trainers] Error adding trainer: ${error}`);
        throw error;
      }
    });
};

export const getAllTrainers = async (): Promise<Trainer[]> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare("SELECT * FROM trainers");
        const trainers = stmt.all() as any[];
        return trainers.map(t => ({ ...t, isDefault: t.isDefault === 1 }));
      } catch (error) {
        logger?.debug(`[DB Trainers] Error getting all trainers: ${error}`);
        throw error;
      }
    });
};

export const getTrainerById = async (id: number): Promise<Trainer | undefined> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare("SELECT * FROM trainers WHERE id = ?");
        const trainer = stmt.get(id) as any | undefined;
        if (trainer) {
          return { ...trainer, isDefault: trainer.isDefault === 1 };
        }
        return undefined;
      } catch (error) {
        logger?.debug(`[DB Trainers] Error getting trainer by id ${id}: ${error}`);
        throw error;
      }
    });
};

export const updateTrainer = async (id: number, updates: Partial<Omit<Trainer, 'id'>>): Promise<number | undefined> => {
    return asyncDbRun(() => {
      try {
        const fields = Object.keys(updates).filter(key => key !== 'id');
        if (fields.length === 0) return 0;

        const setClause = fields.map(field => `${field} = @${field}`).join(', ');
        const stmt = getDb().prepare(`UPDATE trainers SET ${setClause} WHERE id = @id`);

        const params: any = { ...updates, id };
        if (updates.isDefault !== undefined) {
          params.isDefault = updates.isDefault ? 1 : 0;
        }

        const result = stmt.run(params);
        return result.changes;
      } catch (error) {
        logger?.debug(`[DB Trainers] Error updating trainer ${id}: ${error}`);
        throw error;
      }
    });
};

export const deleteTrainer = async (id: number): Promise<void> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare("DELETE FROM trainers WHERE id = ?");
        stmt.run(id);
      } catch (error) {
        logger?.debug(`[DB Trainers] Error deleting trainer ${id}: ${error}`);
        throw error;
      }
    });
};

export const setDefaultTrainer = async (id: number): Promise<void> => {
    return asyncDbRun(() => {
      const transaction = getDb().transaction(() => {
        try {
          const resetStmt = getDb().prepare("UPDATE trainers SET isDefault = 0 WHERE isDefault = 1");
          resetStmt.run();

          const setStmt = getDb().prepare("UPDATE trainers SET isDefault = 1 WHERE id = ?");
          setStmt.run(id);
        } catch (error) {
          logger?.debug(`[DB Trainers] Error setting default trainer ${id}: ${error}`);
          throw error;
        }
      });
      transaction();
    });
};

export const getDefaultTrainer = async (): Promise<Trainer | undefined> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare("SELECT * FROM trainers WHERE isDefault = 1 LIMIT 1");
        const trainer = stmt.get() as any | undefined;
        if (trainer) {
          return { ...trainer, isDefault: true };
        }
        return undefined;
      } catch (error) {
        logger?.debug(`[DB Trainers] Error getting default trainer: ${error}`);
        throw error;
      }
    });
};
