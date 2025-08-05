import { getDb, asyncDbRun, logger } from './index';
import type { QuestionWithId, Referential, Theme, Bloc } from '@common/types';

const rowToQuestion = (row: any): QuestionWithId | undefined => {
  if (!row) return undefined;
  return {
    ...row,
    options: row.options ? JSON.parse(row.options) : [],
    isEliminatory: row.isEliminatory === 1,
  };
};

const questionToRow = (question: Partial<Omit<QuestionWithId, 'id'> | QuestionWithId>) => {
  const rowData: any = { ...question };
  if (question.options !== undefined) {
    rowData.options = JSON.stringify(question.options);
  }
  if (question.isEliminatory !== undefined) {
    rowData.isEliminatory = question.isEliminatory ? 1 : 0;
  }
  if (question.userQuestionId !== undefined) {
    rowData.userQuestionId = question.userQuestionId;
  }
  if (question.version !== undefined) {
    rowData.version = question.version;
  }
  if (question.updatedAt !== undefined) {
    rowData.updated_at = question.updatedAt;
  }
  if ('id' in rowData && !Object.prototype.hasOwnProperty.call(question, 'id')) {
    delete rowData.id;
  }
  return rowData;
};


export const addQuestion = async (question: Omit<QuestionWithId, 'id'>): Promise<number | undefined> => {
  return asyncDbRun(() => {
    try {
      const { text, type, correctAnswer, timeLimit, isEliminatory, createdAt, usageCount, correctResponseRate, slideGuid, options, version, updatedAt } = question;
      const blocId = question.blocId === undefined || question.blocId === null ? null : question.blocId;
      const stmt = getDb().prepare(`
        INSERT INTO questions (blocId, text, type, correctAnswer, timeLimit, isEliminatory, createdAt, usageCount, correctResponseRate, slideGuid, options, version, updated_at)
        VALUES (@blocId, @text, @type, @correctAnswer, @timeLimit, @isEliminatory, @createdAt, @usageCount, @correctResponseRate, @slideGuid, @options, @version, @updated_at)
      `);
      const rowData = questionToRow({
        blocId, text, type, correctAnswer, timeLimit,
        isEliminatory,
        createdAt,
        usageCount: usageCount ?? 0,
        correctResponseRate: correctResponseRate ?? 0,
        slideGuid,
        options,
        version,
        updatedAt
      });
      const result = stmt.run(rowData);
      return result.lastInsertRowid as number;
    } catch (error) {
      logger?.debug(`[DB Questions] Error adding question: ${error}`);
      throw error;
    }
  });
};

export const upsertQuestion = async (question: Omit<QuestionWithId, 'id'>): Promise<number | undefined> => {
  return asyncDbRun(() => {
    try {
      const { userQuestionId, blocId, text, type, correctAnswer, timeLimit, isEliminatory, createdAt, usageCount, correctResponseRate, slideGuid, options, version, updatedAt } = question;
      const finalUpdatedAt = updatedAt || new Date().toISOString();
      const stmt = getDb().prepare(`
        INSERT INTO questions (userQuestionId, blocId, text, type, correctAnswer, timeLimit, isEliminatory, createdAt, usageCount, correctResponseRate, slideGuid, options, version, updated_at)
        VALUES (@userQuestionId, @blocId, @text, @type, @correctAnswer, @timeLimit, @isEliminatory, @createdAt, @usageCount, @correctResponseRate, @slideGuid, @options, @version, @updated_at)
        ON CONFLICT(userQuestionId) DO UPDATE SET
          blocId = excluded.blocId,
          text = excluded.text,
          type = excluded.type,
          correctAnswer = excluded.correctAnswer,
          timeLimit = excluded.timeLimit,
          isEliminatory = excluded.isEliminatory,
          usageCount = excluded.usageCount,
          correctResponseRate = excluded.correctResponseRate,
          slideGuid = excluded.slideGuid,
          options = excluded.options,
          version = excluded.version,
          updated_at = excluded.updated_at
      `);
      const rowData = questionToRow({
        userQuestionId, blocId, text, type, correctAnswer, timeLimit,
        isEliminatory,
        createdAt,
        usageCount: usageCount ?? 0,
        correctResponseRate: correctResponseRate ?? 0,
        slideGuid,
        options,
        version,
        updatedAt: finalUpdatedAt
      });
      const result = stmt.run(rowData);
      return result.lastInsertRowid as number;
    } catch (error) {
      logger?.debug(`[DB Questions] Error upserting question: ${error}`);
      throw error;
    }
  });
};

export const getAllQuestions = async (): Promise<QuestionWithId[]> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("SELECT * FROM questions");
      const rows = stmt.all() as any[];
      return rows
        .map(rowToQuestion)
        .filter((item): item is QuestionWithId => item !== undefined);
    } catch (error) {
      logger?.debug(`[DB Questions] Error getting all questions: ${error}`);
      throw error;
    }
  });
};

export const getQuestionById = async (id: number): Promise<QuestionWithId | undefined> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("SELECT * FROM questions WHERE id = ?");
      const row = stmt.get(id) as any;
      return row ? rowToQuestion(row) : undefined;
    } catch (error) {
      logger?.debug(`[DB Questions] Error getting question by id ${id}: ${error}`);
      throw error;
    }
  });
}

export const getQuestionCount = async (): Promise<number> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("SELECT COUNT(*) as count FROM questions");
      const result = stmt.get() as { count: number };
      return result.count;
    } catch (error) {
      logger?.debug(`[DB Questions] Error getting question count: ${error}`);
      throw error;
    }
  });
};

export const getQuestionsByIds = async (ids: number[]): Promise<QuestionWithId[]> => {
  if (!ids || ids.length === 0) return Promise.resolve([]);
  return asyncDbRun(() => {
    try {
      const placeholders = ids.map(() => '?').join(',');
      const stmt = getDb().prepare(`SELECT * FROM questions WHERE id IN (${placeholders})`);
      const rows = stmt.all(...ids) as any[];
      return rows
        .map(rowToQuestion)
        .filter((item): item is QuestionWithId => item !== undefined);
    } catch (error) {
      logger?.debug(`[DB Questions] Error getting questions by ids: ${error}`);
      throw error;
    }
  });
};

export const updateQuestion = async (id: number, updates: Partial<Omit<QuestionWithId, 'id'>>): Promise<number | undefined> => {
  return asyncDbRun(() => {
    try {
      const rowUpdates = questionToRow(updates);
      const fields = Object.keys(rowUpdates).filter(key => key !== 'id');
      if (fields.length === 0) return 0;

      const setClause = fields.map(field => `${field} = @${field}`).join(', ');
      const stmt = getDb().prepare(`UPDATE questions SET ${setClause} WHERE id = @id`);

      const result = stmt.run({ ...rowUpdates, id });
      return result.changes;
    } catch (error) {
      logger?.debug(`[DB Questions] Error updating question ${id}: ${error}`);
      throw error;
    }
  });
}

export const deleteQuestion = async (id: number): Promise<void> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("DELETE FROM questions WHERE id = ?");
      stmt.run(id);
    } catch (error) {
      logger?.debug(`[DB Questions] Error deleting question ${id}: ${error}`);
      throw error;
    }
  });
}

export const getQuestionsByBlocId = async (blocId: number): Promise<QuestionWithId[]> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("SELECT * FROM questions WHERE blocId = ?");
      const rows = stmt.all(blocId) as any[];
      return rows
        .map(rowToQuestion)
        .filter((item): item is QuestionWithId => item !== undefined);
    } catch (error) {
      logger?.debug(`[DB Questions] Error getting questions by blocId ${blocId}: ${error}`);
      throw error;
    }
  });
};


export const getQuestionsForSessionBlocks = async (selectedBlocIds?: number[]): Promise<QuestionWithId[]> => {
  if (!selectedBlocIds || selectedBlocIds.length === 0) {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare("SELECT * FROM questions WHERE blocId IS NULL");
        const rows = stmt.all() as any[];
        return rows
          .map(rowToQuestion)
          .filter((item): item is QuestionWithId => item !== undefined);
      } catch (error) {
        logger?.debug(`[DB Questions] Error getting questions with no blocId: ${error}`);
        throw error;
      }
    });
  }
  return asyncDbRun(() => {
    try {
      const placeholders = selectedBlocIds.map(() => '?').join(',');
      const stmt = getDb().prepare(`SELECT * FROM questions WHERE blocId IN (${placeholders})`);
      const rows = stmt.all(...selectedBlocIds) as any[];
      return rows
        .map(rowToQuestion)
        .filter((item): item is QuestionWithId => item !== undefined);
    } catch (error) {
      logger?.debug(`[DB Questions] Error getting questions for session blocks: ${error}`);
      throw error;
    }
  });
};

export const addReferential = async (referential: Omit<Referential, 'id'>): Promise<number | undefined> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare(`
          INSERT INTO referentiels (code, nom_complet)
          VALUES (@code, @nom_complet)
        `);
        const result = stmt.run(referential);
        return result.lastInsertRowid as number;
      } catch (error) {
        logger?.debug(`[DB Referentiels] Error adding referential: ${error}`);
        if ((error as any).code === 'SQLITE_CONSTRAINT_UNIQUE') {
          throw new Error(`Referential with code ${referential.code} already exists.`);
        }
        throw error;
      }
    });
};

export const getAllReferentiels = async (): Promise<Referential[]> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare("SELECT * FROM referentiels");
        const referentiels = stmt.all() as Referential[];
        return referentiels;
      } catch (error) {
        logger?.debug(`[DB Referentiels] Error getting all referentiels: ${error}`);
        throw error;
      }
    });
};

export const getReferentialByCode = async (code: string): Promise<Referential | undefined> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare("SELECT * FROM referentiels WHERE code = ?");
        const referential = stmt.get(code) as Referential | undefined;
        return referential;
      } catch (error) {
        logger?.debug(`[DB Referentiels] Error getting referential by code ${code}: ${error}`);
        throw error;
      }
    });
};

export const getReferentialById = async (id: number): Promise<Referential | undefined> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare("SELECT * FROM referentiels WHERE id = ?");
        const referential = stmt.get(id) as Referential | undefined;
        return referential;
      } catch (error) {
        logger?.debug(`[DB Referentiels] Error getting referential by id ${id}: ${error}`);
        throw error;
      }
    });
};

export const addTheme = async (theme: Omit<Theme, 'id'>): Promise<number | undefined> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare(`
          INSERT INTO themes (code_theme, nom_complet, referentiel_id)
          VALUES (@code_theme, @nom_complet, @referentiel_id)
        `);
        const result = stmt.run(theme);
        return result.lastInsertRowid as number;
      } catch (error) {
        logger?.debug(`[DB Themes] Error adding theme: ${error}`);
        if ((error as any).code === 'SQLITE_CONSTRAINT_UNIQUE') {
          throw new Error(`Theme with code ${theme.code_theme} already exists for referential ${theme.referentiel_id}.`);
        }
        throw error;
      }
    });
};

export const getAllThemes = async (): Promise<Theme[]> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare("SELECT * FROM themes");
        return stmt.all() as Theme[];
      } catch (error) {
        logger?.debug(`[DB Themes] Error getting all themes: ${error}`);
        throw error;
      }
    });
};

export const getThemesByReferentialId = async (referentialId: number): Promise<Theme[]> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare("SELECT * FROM themes WHERE referentiel_id = ?");
        return stmt.all(referentialId) as Theme[];
      } catch (error) {
        logger?.debug(`[DB Themes] Error getting themes by referentialId ${referentialId}: ${error}`);
        throw error;
      }
    });
};

export const getThemeByCodeAndReferentialId = async (code_theme: string, referentiel_id: number): Promise<Theme | undefined> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare("SELECT * FROM themes WHERE code_theme = ? AND referentiel_id = ?");
        return stmt.get(code_theme, referentiel_id) as Theme | undefined;
      } catch (error) {
        logger?.debug(`[DB Themes] Error getting theme by code ${code_theme} and referentialId ${referentiel_id}: ${error}`);
        throw error;
      }
    });
};

export const getThemeById = async (id: number): Promise<Theme | undefined> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare("SELECT * FROM themes WHERE id = ?");
        return stmt.get(id) as Theme | undefined;
      } catch (error) {
        logger?.debug(`[DB Themes] Error getting theme by id ${id}: ${error}`);
        throw error;
      }
    });
};

export const addBloc = async (bloc: Omit<Bloc, 'id'>): Promise<number | undefined> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare(`
          INSERT INTO blocs (code_bloc, nom_complet, theme_id)
          VALUES (@code_bloc, @nom_complet, @theme_id)
        `);
        const result = stmt.run(bloc);
        return result.lastInsertRowid as number;
      } catch (error) {
        logger?.debug(`[DB Blocs] Error adding bloc: ${error}`);
        if ((error as any).code === 'SQLITE_CONSTRAINT_UNIQUE') {
          throw new Error(`Bloc with code ${bloc.code_bloc} already exists for theme ${bloc.theme_id}.`);
        }
        throw error;
      }
    });
};

export const getAllBlocs = async (): Promise<Bloc[]> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare("SELECT * FROM blocs");
        return stmt.all() as Bloc[];
      } catch (error) {
        logger?.debug(`[DB Blocs] Error getting all blocs: ${error}`);
        throw error;
      }
    });
};

export const getBlocsByThemeId = async (themeId: number): Promise<Bloc[]> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare("SELECT * FROM blocs WHERE theme_id = ?");
        return stmt.all(themeId) as Bloc[];
      } catch (error) {
        logger?.debug(`[DB Blocs] Error getting blocs by themeId ${themeId}: ${error}`);
        throw error;
      }
    });
};

export const getBlocByCodeAndThemeId = async (code_bloc: string, theme_id: number): Promise<Bloc | undefined> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare("SELECT * FROM blocs WHERE code_bloc = ? AND theme_id = ?");
        return stmt.get(code_bloc, theme_id) as Bloc | undefined;
      } catch (error) {
        logger?.debug(`[DB Blocs] Error getting bloc by code ${code_bloc} and themeId ${theme_id}: ${error}`);
        throw error;
      }
    });
};

export const getBlocById = async (id: number): Promise<Bloc | undefined> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare("SELECT * FROM blocs WHERE id = ?");
        return stmt.get(id) as Bloc | undefined;
      } catch (error) {
        logger?.debug(`[DB Blocs] Error getting bloc by id ${id}: ${error}`);
        throw error;
      }
    });
};
