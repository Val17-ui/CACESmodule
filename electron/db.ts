import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type {
    QuestionWithId, Session, SessionResult, Trainer,
    SessionQuestion, SessionBoitier, Referential, Theme, Bloc,
    VotingDevice, DeviceKit, DeviceKitAssignment
  } from '../src/types/index';
import { getLogger, ILogger } from './utils/logger';

// Déterminer le chemin de la base de données de manière plus robuste
const appName = 'easycertif'; // Nom de votre application
let userDataPath;
if (process.env.APPDATA) { // Windows
  userDataPath = process.env.APPDATA;
} else if (process.platform === 'darwin') { // macOS
  userDataPath = path.join(process.env.HOME || '', 'Library', 'Application Support');
} else { // Linux et autres
  userDataPath = path.join(process.env.HOME || '', '.config');
}
const dbDir = path.join(userDataPath, appName, 'db_data');

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const dbPath = path.join(dbDir, 'database.sqlite3');

let db: import('better-sqlite3').Database;
let _logger: ILogger;

function initializeDatabase(loggerInstance: ILogger) {
  _logger = loggerInstance;
  if (db) {
    _logger.debug('[DB SETUP] Database already initialized.');
    return;
  }
  _logger.debug('[DB SETUP] Initializing database...');
  db = new Database(dbPath);
  _logger.debug(`[DB SETUP] SQLite database connection established.`);

  // Activer les clés étrangères
  try {
    getDb().pragma('foreign_keys = ON');
    _logger.debug("[DB SETUP] Foreign key support enabled.");
  } catch (error) {
    _logger.debug(`[DB SETUP] Failed to enable foreign keys: ${error}`);
  }

  // Créer le schéma
  try {
    createSchema();
  } catch (error) {
    _logger.debug(`[DB SETUP] FATAL: Failed to create/verify database schema. Application might not work correctly. ${error}`);
    // Envisager de quitter l'application si le schéma est critique et ne peut être créé
    // process.exit(1);
  }

  _logger.debug("[DB SETUP] SQLite database module loaded and initialized.");
}

module.exports.initializeDatabase = initializeDatabase;


// Schéma de la base de données
const getDb = () => {
    if (!db) {
        throw new Error("Database not initialized. Please call initializeDatabase first.");
    }
    return db;
};
const createSchema = () => {
  _logger.debug("[DB SCHEMA] Attempting to create/verify schema...");
  const DDL_STATEMENTS = [
    `CREATE TABLE IF NOT EXISTS referentiels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      nom_complet TEXT
    );`,

    `CREATE TABLE IF NOT EXISTS themes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code_theme TEXT NOT NULL,
      nom_complet TEXT,
      referentiel_id INTEGER NOT NULL,
      FOREIGN KEY (referentiel_id) REFERENCES referentiels(id) ON DELETE CASCADE,
      UNIQUE (code_theme, referentiel_id)
    );`,

    `CREATE TABLE IF NOT EXISTS blocs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code_bloc TEXT NOT NULL,
      nom_complet TEXT,
      theme_id INTEGER NOT NULL,
      FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE CASCADE,
      UNIQUE (code_bloc, theme_id)
    );`,

    `CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      blocId INTEGER,
      text TEXT NOT NULL,
      type TEXT NOT NULL,
      correctAnswer TEXT,
      timeLimit INTEGER,
      isEliminatory INTEGER DEFAULT 0, /* 0 for false, 1 for true */
      createdAt TEXT, /* ISO8601 string */
      usageCount INTEGER DEFAULT 0,
      correctResponseRate REAL DEFAULT 0,
      slideGuid TEXT,
      options TEXT, /* JSON array of strings */
      FOREIGN KEY (blocId) REFERENCES blocs(id) ON DELETE SET NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_questions_blocId ON questions(blocId);`,

    `CREATE TABLE IF NOT EXISTS trainers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      isDefault INTEGER DEFAULT 0 /* 0 for false, 1 for true */
    );`,
    `CREATE INDEX IF NOT EXISTS idx_trainers_isDefault ON trainers(isDefault);`,

    `CREATE TABLE IF NOT EXISTS deviceKits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      isDefault INTEGER DEFAULT 0 /* 0 for false, 1 for true */
    );`,
    `CREATE INDEX IF NOT EXISTS idx_deviceKits_isDefault ON deviceKits(isDefault);`,

    `CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nomSession TEXT NOT NULL,
      dateSession TEXT NOT NULL, /* ISO8601 string */
      referentielId INTEGER,
      selectedBlocIds TEXT, /* JSON array of bloc IDs (numbers) */
      selectedKitId INTEGER,
      createdAt TEXT NOT NULL, /* ISO8601 string */
      location TEXT,
      status TEXT, /* e.g., 'pending', 'active', 'completed' */
      questionMappings TEXT, /* JSON object for mapping question IDs or GUIDs */
      notes TEXT,
      trainerId INTEGER,
      ignoredSlideGuids TEXT, /* JSON array of strings */
      resolvedImportAnomalies TEXT, /* JSON object or array */
      participants TEXT, /* JSON array of participant info, structure TBD */
      orsFilePath TEXT, /* path to the generated ORS file */
      resultsImportedAt TEXT, /* ISO8601 string for when results were imported */
      FOREIGN KEY (referentielId) REFERENCES referentiels(id) ON DELETE SET NULL,
      FOREIGN KEY (selectedKitId) REFERENCES deviceKits(id) ON DELETE SET NULL,
      FOREIGN KEY (trainerId) REFERENCES trainers(id) ON DELETE SET NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_referentielId ON sessions(referentielId);`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_selectedKitId ON sessions(selectedKitId);`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_trainerId ON sessions(trainerId);`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_dateSession ON sessions(dateSession);`,

    `CREATE TABLE IF NOT EXISTS sessionResults (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionId INTEGER NOT NULL,
      questionId INTEGER NOT NULL, /* references questions.id */
      participantIdBoitier TEXT NOT NULL, /* Could be serialNumber of votingDevice or a participant identifier */
      answer TEXT, /* JSON array of selected answers or single answer */
      isCorrect INTEGER, /* 0 for false, 1 for true */
      pointsObtained INTEGER,
      timestamp INTEGER NOT NULL, /* Unix timestamp (seconds since epoch) */
      FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (questionId) REFERENCES questions(id) ON DELETE CASCADE
    );`,
    `CREATE INDEX IF NOT EXISTS idx_sessionResults_sessionId ON sessionResults(sessionId);`,
    `CREATE INDEX IF NOT EXISTS idx_sessionResults_questionId ON sessionResults(questionId);`,
    `CREATE INDEX IF NOT EXISTS idx_sessionResults_participantIdBoitier ON sessionResults(participantIdBoitier);`,

    `CREATE TABLE IF NOT EXISTS adminSettings (
      key TEXT PRIMARY KEY,
      value TEXT /* Can store various types, often as JSON strings */
    );`,

    `CREATE TABLE IF NOT EXISTS votingDevices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      serialNumber TEXT UNIQUE NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_votingDevices_name ON votingDevices(name);`,

    `CREATE TABLE IF NOT EXISTS sessionQuestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionId INTEGER NOT NULL,
      dbQuestionId INTEGER NOT NULL, /* Foreign key to questions.id */
      slideGuid TEXT, /* GUID from PPTX for this question in this session */
      blockId TEXT, /* Original block identifier from PPTX, not necessarily blocs.id */
      FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (dbQuestionId) REFERENCES questions(id) ON DELETE CASCADE
    );`,
    `CREATE INDEX IF NOT EXISTS idx_sessionQuestions_sessionId ON sessionQuestions(sessionId);`,
    `CREATE INDEX IF NOT EXISTS idx_sessionQuestions_dbQuestionId ON sessionQuestions(dbQuestionId);`,

    `CREATE TABLE IF NOT EXISTS sessionBoitiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionId INTEGER NOT NULL,
      participantId TEXT, /* User-defined participant ID/name for this session */
      visualId TEXT, /* e.g., P1, P2 for display during session */
      serialNumber TEXT NOT NULL, /* serialNumber of the votingDevice used by this participant in this session */
      FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (serialNumber) REFERENCES votingDevices(serialNumber) ON DELETE CASCADE
    );`,
    `CREATE INDEX IF NOT EXISTS idx_sessionBoitiers_sessionId ON sessionBoitiers(sessionId);`,
    `CREATE INDEX IF NOT EXISTS idx_sessionBoitiers_serialNumber ON sessionBoitiers(serialNumber);`,

    `CREATE TABLE IF NOT EXISTS deviceKitAssignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kitId INTEGER NOT NULL,
      votingDeviceId INTEGER NOT NULL,
      FOREIGN KEY (kitId) REFERENCES deviceKits(id) ON DELETE CASCADE,
      FOREIGN KEY (votingDeviceId) REFERENCES votingDevices(id) ON DELETE CASCADE,
      UNIQUE (kitId, votingDeviceId)
    );`,
    `CREATE INDEX IF NOT EXISTS idx_deviceKitAssignments_kitId ON deviceKitAssignments(kitId);`,
    `CREATE INDEX IF NOT EXISTS idx_deviceKitAssignments_votingDeviceId ON deviceKitAssignments(votingDeviceId);`
  ];

  const transaction = getDb().transaction(() => {
    for (const stmt of DDL_STATEMENTS) {
      try {
        getDb().prepare(stmt).run();
      } catch (error) {
        _logger.debug(`[DB SCHEMA] Failed to execute DDL: ${stmt.substring(0,60)}... ${error}`);
        // En cas d'erreur, la transaction sera automatiquement annulée par better-sqlite3
        throw error;
      }
    }
  });

  try {
    transaction();
    _logger.debug("[DB SCHEMA] Database schema created/verified successfully.");

    // --- Migrations for 'sessions' table ---
    const db = getDb();

    // Migration step 1: Rename old column if it exists
    interface TableInfo { name: string; type: string; cid: number; notnull: number; dflt_value: any; pk: number; }
    try {
        // Check if the old column exists before trying to rename
        const columns: TableInfo[] = db.pragma('table_info(sessions)') as TableInfo[];
        const hasDonneesOrs = columns.some(col => col.name === 'donneesOrs');
        const hasOrsFilePath = columns.some(col => col.name === 'orsFilePath');

        if (hasDonneesOrs && !hasOrsFilePath) {
            db.prepare("ALTER TABLE sessions RENAME COLUMN donneesOrs TO orsFilePath").run();
            _logger.debug("[DB MIGRATION] Renamed column 'donneesOrs' to 'orsFilePath'.");
        }
    } catch (error) {
        // This might fail for other reasons, _logger.debug it but proceed.
        _logger.debug(`[DB MIGRATION] Error during rename check/operation for 'donneesOrs': ${error}`);
    }

    // Migration step 2: Add new columns if they don't exist
    const columnsToAdd = [
        { name: 'orsFilePath', type: 'TEXT' },
        { name: 'resultsImportedAt', type: 'TEXT' },
        { name: 'updatedAt', type: 'TEXT' }
    ];

    const existingColumns = (db.pragma('table_info(sessions)') as TableInfo[]).map(col => col.name);

    for (const column of columnsToAdd) {
        if (!existingColumns.includes(column.name)) {
            try {
                db.prepare(`ALTER TABLE sessions ADD COLUMN ${column.name} ${column.type}`).run();
                _logger.debug(`[DB MIGRATION] Added '${column.name}' column to 'sessions' table.`);
            } catch (error: any) {
                // Catching errors here just in case, though the check should prevent duplicates.
                _logger.debug(`[DB MIGRATION] Error adding '${column.name}' column: ${error}`);
            }
        }
    }

  } catch(error) {
    _logger.debug(`[DB SCHEMA] Transaction failed during schema creation. No changes were applied. ${error}`);
    throw error; // Renvoyer l'erreur pour indiquer l'échec de createSchema
  }
};

export type {
    QuestionWithId, Session, SessionResult, Trainer,
    SessionQuestion, SessionBoitier, Referential, Theme, Bloc,
    VotingDevice, DeviceKit, DeviceKitAssignment
  };

// --- Helper function to wrap sync better-sqlite3 calls in Promises ---
// This helps maintain an async API similar to Dexie, minimizing changes in consuming code.
async function asyncDbRun<T>(fn: () => T): Promise<T> {
  try {
    // For potentially long-running synchronous operations,
    // consider setImmediate or process.nextTick to yield to the event loop,
    // though better-sqlite3 operations are generally very fast.
    // For now, a direct Promise.resolve/reject is fine.
    const result = fn();
    return Promise.resolve(result);
  } catch (error) {
    _logger.debug(`[ASYNC DB RUNNER] SQLite operation failed: ${error}`);
    return Promise.reject(error);
  }
}

// --- CRUD Function Placeholders (to be implemented with SQLite _logger.debugic) ---

// Questions

// Helper pour transformer une ligne de DB en QuestionWithId (gère JSON et booléens)
const rowToQuestion = (row: any): QuestionWithId => {
  if (!row) return undefined as any; // Should not happen if called correctly
  return {
    ...row,
    options: row.options ? JSON.parse(row.options) : [],
    isEliminatory: row.isEliminatory === 1,
    // createdAt devrait déjà être un string ISO, pas de transformation nécessaire a priori
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
  // Supprimer 'id' si présent et qu'on ne veut pas l'utiliser dans un SET par exemple
  if ('id' in rowData && !Object.prototype.hasOwnProperty.call(question, 'id')) {
    delete rowData.id;
  }
  return rowData;
};


const addQuestion = async (question: Omit<QuestionWithId, 'id'>): Promise<number | undefined> => {
  return asyncDbRun(() => {
    try {
      const { blocId, text, type, correctAnswer, timeLimit, isEliminatory, createdAt, usageCount, correctResponseRate, slideGuid, options } = question;
      const stmt = getDb().prepare(`
        INSERT INTO questions (blocId, text, type, correctAnswer, timeLimit, isEliminatory, createdAt, usageCount, correctResponseRate, slideGuid, options)
        VALUES (@blocId, @text, @type, @correctAnswer, @timeLimit, @isEliminatory, @createdAt, @usageCount, @correctResponseRate, @slideGuid, @options)
      `);
      const rowData = questionToRow({
        blocId, text, type, correctAnswer, timeLimit,
        isEliminatory, // Sera converti en 0/1 par questionToRow
        createdAt,
        usageCount: usageCount ?? 0,
        correctResponseRate: correctResponseRate ?? 0,
        slideGuid,
        options // Sera stringifié par questionToRow
      });
      const result = stmt.run(rowData);
      return result.lastInsertRowid as number;
    } catch (error) {
      _logger.debug(`[DB Questions] Error adding question: ${error}`);
      throw error;
    }
  });
};

const getAllQuestions = async (): Promise<QuestionWithId[]> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("SELECT * FROM questions");
      const rows = stmt.all() as any[];
      return rows.map(rowToQuestion);
    } catch (error) {
      _logger.debug(`[DB Questions] Error getting all questions: ${error}`);
      throw error;
    }
  });
};

const getQuestionById = async (id: number): Promise<QuestionWithId | undefined> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("SELECT * FROM questions WHERE id = ?");
      const row = stmt.get(id) as any;
      return row ? rowToQuestion(row) : undefined;
    } catch (error) {
      _logger.debug(`[DB Questions] Error getting question by id ${id}: ${error}`);
      throw error;
    }
  });
}

const getQuestionsByIds = async (ids: number[]): Promise<QuestionWithId[]> => {
  if (!ids || ids.length === 0) return Promise.resolve([]);
  return asyncDbRun(() => {
    try {
      // SQLite ne supporte pas directement un array dans `IN (?)`. Il faut générer les placeholders.
      const placeholders = ids.map(() => '?').join(',');
      const stmt = getDb().prepare(`SELECT * FROM questions WHERE id IN (${placeholders})`);
      const rows = stmt.all(...ids) as any[];
      return rows.map(rowToQuestion);
    } catch (error) {
      _logger.debug(`[DB Questions] Error getting questions by ids: ${error}`);
      throw error;
    }
  });
}

const updateQuestion = async (id: number, updates: Partial<Omit<QuestionWithId, 'id'>>): Promise<number | undefined> => {
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
      _logger.debug(`[DB Questions] Error updating question ${id}: ${error}`);
      throw error;
    }
  });
}

const deleteQuestion = async (id: number): Promise<void> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("DELETE FROM questions WHERE id = ?");
      stmt.run(id);
    } catch (error) {
      _logger.debug(`[DB Questions] Error deleting question ${id}: ${error}`);
      throw error;
    }
  });
}

const getQuestionsByBlocId = async (blocId: number): Promise<QuestionWithId[]> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("SELECT * FROM questions WHERE blocId = ?");
      const rows = stmt.all(blocId) as any[];
      return rows.map(rowToQuestion);
    } catch (error) {
      _logger.debug(`[DB Questions] Error getting questions by blocId ${blocId}: ${error}`);
      throw error;
    }
  });
}

const getQuestionsForSessionBlocks = async (selectedBlocIds?: number[]): Promise<QuestionWithId[]> => {
  if (!selectedBlocIds || selectedBlocIds.length === 0) {
    // Si aucun blocId n'est sélectionné, doit-on retourner toutes les questions SANS blocId (orphelines)
    // ou toutes les questions de l'application ? La _logger.debugique Dexie d'origine serait à vérifier.
    // Pour l'instant, si selectedBlocIds est vide ou non fourni, on retourne les questions sans blocId.
    // Si une _logger.debugique différente est attendue, il faudra ajuster.
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare("SELECT * FROM questions WHERE blocId IS NULL");
        const rows = stmt.all() as any[];
        return rows.map(rowToQuestion);
      } catch (error) {
        _logger.debug(`[DB Questions] Error getting questions with no blocId: ${error}`);
        throw error;
      }
    });
  }

  return asyncDbRun(() => {
    try {
      const placeholders = selectedBlocIds.map(() => '?').join(',');
      const stmt = getDb().prepare(`SELECT * FROM questions WHERE blocId IN (${placeholders})`);
      const rows = stmt.all(...selectedBlocIds) as any[];
      return rows.map(rowToQuestion);
    } catch (error) {
      _logger.debug(`[DB Questions] Error getting questions for session blocks: ${error}`);
      throw error;
    }
  });
}

// AdminSettings

// Helper pour parser la valeur d'un adminSetting
const parseAdminSettingValue = (value: string | null): any => {
  if (value === null || value === undefined) return undefined;
  try {
    return JSON.parse(value);
  } catch (e) {
    // Si ce n'est pas du JSON valide, retourner la chaîne brute
    return value;
  }
};

const getAdminSetting = async (key: string): Promise<any> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("SELECT value FROM adminSettings WHERE key = ?");
      const row = stmt.get(key) as { value: string } | undefined;
      return row ? parseAdminSettingValue(row.value) : undefined;
    } catch (error) {
      _logger.debug(`[DB AdminSettings] Error getting setting ${key}: ${error}`);
      throw error;
    }
  });
};

const setAdminSetting = async (key: string, value: any): Promise<void> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare(`
        INSERT INTO adminSettings (key, value)
        VALUES (@key, @value)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `);
      // Stringify la valeur, sauf si elle est déjà une chaîne (pour éviter les doubles guillemets)
      // ou si elle est null/undefined. Les nombres et booléens seront correctement stringifiés.
      const valueToStore = typeof value === 'string' ? value : (value === null || value === undefined ? null : JSON.stringify(value));
      stmt.run({ key, value: valueToStore });
    } catch (error) {
      _logger.debug(`[DB AdminSettings] Error setting setting ${key}: ${error}`);
      throw error;
    }
  });
};

const getAllAdminSettings = async (): Promise<{ key: string; value: any }[]> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("SELECT key, value FROM adminSettings");
      const rows = stmt.all() as { key: string; value: string }[];
      return rows.map(row => ({
        key: row.key,
        value: parseAdminSettingValue(row.value),
      }));
    } catch (error) {
      _logger.debug(`[DB AdminSettings] Error getting all settings: ${error}`);
      throw error;
    }
  });
};

const getGlobalPptxTemplate = async (): Promise<File | null> => {
  _logger.debug("[DB AdminSettings] getGlobalPptxTemplate: Returning null. Logic to fetch/construct File object from path/blob is outside direct DB scope for now.");
  // Potentiellement:
  // const filePath = await getAdminSetting('globalPptxTemplatePath');
  // if (filePath && typeof filePath === 'string') {
  //   // Logique pour créer un objet File ou retourner le chemin
  //   // Pour l'instant, on ne fait rien de plus.
  // }
  return Promise.resolve(null);
};

// Sessions

const JSON_SESSION_FIELDS = [
  'selectedBlocIds', 'questionMappings', 'ignoredSlideGuids',
  'resolvedImportAnomalies', 'participants'
];

const rowToSession = (row: any): Session => {
  if (!row) return undefined as any;
  const session: any = { ...row };
  for (const field of JSON_SESSION_FIELDS) {
    if (field === 'participants') { // Add this check
      _logger.debug(`[DB Sessions] rowToSession: Raw participants for session ${row.id}: ${session[field]}`);
    }
    if (session[field] && typeof session[field] === 'string') {
      try {
        session[field] = JSON.parse(session[field]);
      } catch (e) {
        _logger.debug(`[DB Sessions] Failed to parse JSON field ${field} for session id ${row.id}: ${e}`);
        // Conserver la chaîne brute ou mettre à null/undefined selon la politique de gestion d'erreur
        // Pour l'instant, on garde la chaîne brute si le parsing échoue, mais idéalement, ça ne devrait pas arriver.
      }
    } else if (session[field] === null && (field === 'selectedBlocIds' || field === 'ignoredSlideGuids' || field === 'participants')) {
      // Pour les champs qui sont des tableaux, s'assurer qu'ils sont des tableaux vides si null en DB,
      // plutôt que null, pour la cohérence du type.
      // questionMappings et resolvedImportAnomalies peuvent être null/undefined s'ils ne sont pas définis.
      session[field] = [];
    }
  }
  // Les champs comme referentielId, selectedKitId, trainerId sont des FK et restent des nombres.
  // dateSession et createdAt sont des TEXT ISO8601, pas de conversion nécessaire ici.
  return session as Session;
};

const sessionToRow = (session: Partial<Omit<Session, 'id'> | Session>) => {
  const rowData: any = { ...session };
  for (const field of JSON_SESSION_FIELDS) {
    if (rowData[field] !== undefined) {
      if (field === 'participants') {
        _logger.debug(`[DB Sessions] sessionToRow: Serializing participants for session: ${JSON.stringify(rowData[field])}`);
      }
      rowData[field] = JSON.stringify(rowData[field]);
    }
  }
  // Supprimer 'id' si présent et qu'on ne veut pas l'utiliser dans un SET par exemple
  if ('id' in rowData && !Object.prototype.hasOwnProperty.call(session, 'id')) {
    delete rowData.id;
  }
  return rowData;
};

const addSession = async (session: Omit<Session, 'id'>): Promise<number | undefined> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare(`
        INSERT INTO sessions (
          nomSession, dateSession, referentielId, selectedBlocIds, selectedKitId,
          createdAt, location, status, questionMappings, notes, trainerId,
          ignoredSlideGuids, resolvedImportAnomalies, participants, orsFilePath, resultsImportedAt
        ) VALUES (
          @nomSession, @dateSession, @referentielId, @selectedBlocIds, @selectedKitId,
          @createdAt, @location, @status, @questionMappings, @notes, @trainerId,
          @ignoredSlideGuids, @resolvedImportAnomalies, @participants, @orsFilePath, @resultsImportedAt
        )
      `);
      const rowData = sessionToRow(session);
      const result = stmt.run(rowData);
      return result.lastInsertRowid as number;
    } catch (error) {
      _logger.debug(`[DB Sessions] Error adding session: ${error}`);
      throw error;
    }
  });
};

const getAllSessions = async (): Promise<Session[]> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("SELECT * FROM sessions ORDER BY dateSession DESC, createdAt DESC");
      const rows = stmt.all() as any[];
      return rows.map(rowToSession);
    } catch (error) {
      _logger.debug(`[DB Sessions] Error getting all sessions: ${error}`);
      throw error;
    }
  });
};

const getSessionById = async (id: number): Promise<Session | undefined> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("SELECT * FROM sessions WHERE id = ?");
      const row = stmt.get(id) as any;
      _logger.debug(`[DB Sessions] getSessionById: Raw row for session ${id}: ${JSON.stringify(row)}`);
      return row ? rowToSession(row) : undefined;
    } catch (error) {
      _logger.debug(`[DB Sessions] Error getting session by id ${id}: ${error}`);
      throw error;
    }
  });
};

const updateSession = async (id: number, updates: Partial<Omit<Session, 'id'>>): Promise<number | undefined> => {
  return asyncDbRun(() => {
    try {
      const rowUpdates = sessionToRow(updates);
      const fields = Object.keys(rowUpdates).filter(key => key !== 'id');
      if (fields.length === 0) return 0;

      const setClause = fields.map(field => `${field} = @${field}`).join(', ');
      const stmt = getDb().prepare(`UPDATE sessions SET ${setClause} WHERE id = @id`);

      const result = stmt.run({ ...rowUpdates, id });
      return result.changes;
    } catch (error) {
      _logger.debug(`[DB Sessions] Error updating session ${id}: ${error}`);
      throw error;
    }
  });
};

const deleteSession = async (id: number): Promise<void> => {
  return asyncDbRun(() => {
    try {
      // Les tables sessionResults, sessionQuestions, sessionBoitiers devraient être nettoyées
      // par ON DELETE CASCADE défini dans le schéma.
      const stmt = getDb().prepare("DELETE FROM sessions WHERE id = ?");
      stmt.run(id);
    } catch (error) {
      _logger.debug(`[DB Sessions] Error deleting session ${id}: ${error}`);
      throw error;
    }
  });
};

// SessionResults

const rowToSessionResult = (row: any): SessionResult => {
  if (!row) return undefined as any;
  const result: any = { ...row };

  if (result.answer && typeof result.answer === 'string') {
    try {
      result.answer = JSON.parse(result.answer);
    } catch (e) {
      // Si ce n'est pas du JSON, c'est probablement une réponse simple (chaîne)
      // Laisser tel quel.
    }
  }
  result.isCorrect = result.isCorrect === 1;
  // timestamp est un INTEGER (Unix timestamp), pas de conversion nécessaire.
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

const addSessionResult = async (result: Omit<SessionResult, 'id'>): Promise<number | undefined> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare(`
        INSERT INTO sessionResults (sessionId, questionId, participantIdBoitier, answer, isCorrect, pointsObtained, timestamp)
        VALUES (@sessionId, @questionId, @participantIdBoitier, @answer, @isCorrect, @pointsObtained, @timestamp)
      `);
      const rowData = sessionResultToRow(result);
      const res = stmt.run(rowData);
      return res.lastInsertRowid as number;
    } catch (error) {
      _logger.debug(`[DB SessionResults] Error adding session result: ${error}`);
      throw error;
    }
  });
};

const addBulkSessionResults = async (results: Omit<SessionResult, 'id'>[]): Promise<(number | undefined)[] | undefined> => {
  if (!results || results.length === 0) return Promise.resolve([]);

  return asyncDbRun(() => {
    const insertedIds: (number | undefined)[] = [];
    const insertStmt = getDb().prepare(`
      INSERT INTO sessionResults (sessionId, questionId, participantIdBoitier, answer, isCorrect, pointsObtained, timestamp)
      VALUES (@sessionId, @questionId, @participantIdBoitier, @answer, @isCorrect, @pointsObtained, @timestamp)
    `);

    const transaction = getDb().transaction((items: Omit<SessionResult, 'id'>[]) => {
      for (const result of items) {
        try {
          const rowData = sessionResultToRow(result);
          const res = insertStmt.run(rowData);
          insertedIds.push(res.lastInsertRowid as number);
        } catch (error) {
          _logger.debug(`[DB SessionResults] Error in bulk adding session result for item: ${result}, ${error}`);
          // En cas d'erreur sur un item, on peut choisir d'arrêter ou de continuer.
          // Ici, la transaction sera annulée par défaut si une erreur est levée.
          // Si on veut continuer et juste _logger.debugger l'erreur, il faudrait un try/catch interne.
          // Pour l'instant, on laisse la transaction échouer en cas d'erreur.
          insertedIds.push(undefined); // Marquer l'échec pour cet item
          throw error; // Important pour annuler la transaction
        }
      }
    });

    try {
      transaction(results);
      return insertedIds;
    } catch (error) {
      // L'erreur a déjà été _logger.debuggée dans la transaction ou par asyncDbRun
      // Retourner un tableau avec des undefined pour les échecs si la transaction a été partiellement tentée
      // ou simplement undefined si la transaction entière a échoué tôt.
      // Étant donné que la transaction s'annule, il est plus probable que rien ne soit réellement inséré.
      // Dexie retournait `Promise<Key[] | undefined>`, donc `undefined` est une option.
      // Pour être plus précis, on pourrait retourner un tableau de la même longueur que `results`
      // avec `undefined` pour chaque item si la transaction échoue.
      _logger.debug(`[DB SessionResults] Bulk add transaction failed.`);
      return undefined;
    }
  });
};

const getAllResults = async (): Promise<SessionResult[]> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("SELECT * FROM sessionResults");
      const rows = stmt.all() as any[];
      return rows.map(rowToSessionResult);
    } catch (error) {
      _logger.debug(`[DB SessionResults] Error getting all results: ${error}`);
      throw error;
    }
  });
};

const getResultsForSession = async (sessionId: number): Promise<SessionResult[]> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("SELECT * FROM sessionResults WHERE sessionId = ? ORDER BY timestamp ASC");
      const rows = stmt.all(sessionId) as any[];
      return rows.map(rowToSessionResult);
    } catch (error) {
      _logger.debug(`[DB SessionResults] Error getting results for session ${sessionId}: ${error}`);
      throw error;
    }
  });
};

const getResultBySessionAndQuestion = async (sessionId: number, questionId: number, participantIdBoitier: string): Promise<SessionResult | undefined> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("SELECT * FROM sessionResults WHERE sessionId = ? AND questionId = ? AND participantIdBoitier = ?");
      const row = stmt.get(sessionId, questionId, participantIdBoitier) as any;
      return row ? rowToSessionResult(row) : undefined;
    } catch (error) {
      _logger.debug(`[DB SessionResults] Error getting result for session ${sessionId}, question ${questionId}, boitier ${participantIdBoitier}: ${error}`);
      throw error;
    }
  });
};

const updateSessionResult = async (id: number, updates: Partial<Omit<SessionResult, 'id'>>): Promise<number | undefined> => {
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
      _logger.debug(`[DB SessionResults] Error updating session result ${id}: ${error}`);
      throw error;
    }
  });
};

const deleteResultsForSession = async (sessionId: number): Promise<void> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("DELETE FROM sessionResults WHERE sessionId = ?");
      stmt.run(sessionId);
    } catch (error) {
      _logger.debug(`[DB SessionResults] Error deleting results for session ${sessionId}: ${error}`);
      throw error;
    }
  });
};

// VotingDevices
const addVotingDevice = async (device: Omit<VotingDevice, 'id'>): Promise<number | undefined> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("INSERT INTO votingDevices (name, serialNumber) VALUES (@name, @serialNumber)");
      const result = stmt.run(device);
      return result.lastInsertRowid as number;
    } catch (error) {
      _logger.debug(`[DB VotingDevices] Error adding voting device: ${error}`);
      if ((error as any).code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new Error(`Voting device with serial number ${device.serialNumber} already exists.`);
      }
      throw error;
    }
  });
};

const getAllVotingDevices = async (): Promise<VotingDevice[]> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("SELECT * FROM votingDevices ORDER BY name ASC, serialNumber ASC");
      const devices = stmt.all() as VotingDevice[];
      _logger.debug(`[DB VotingDevices] getAllVotingDevices returned: ${devices.length} devices`);
      return devices;
    } catch (error) {
      _logger.debug(`[DB VotingDevices] Error getting all voting devices: ${error}`);
      throw error;
    }
  });
};

const updateVotingDevice = async (id: number, updates: Partial<Omit<VotingDevice, 'id'>>): Promise<number> => {
  return asyncDbRun(() => {
    try {
      const fields = Object.keys(updates).filter(key => key !== 'id' && (updates as any)[key] !== undefined);
      if (fields.length === 0) return 0;

      const setClause = fields.map(field => `${field} = @${field}`).join(', ');
      const stmt = getDb().prepare(`UPDATE votingDevices SET ${setClause} WHERE id = @id`);

      const params: any = { id };
      for (const field of fields) {
        params[field] = (updates as any)[field];
      }

      const result = stmt.run(params);
      return result.changes;
    } catch (error) {
      _logger.debug(`[DB VotingDevices] Error updating voting device ${id}: ${error}`);
      if ((error as any).code === 'SQLITE_CONSTRAINT_UNIQUE' && updates.serialNumber) {
        throw new Error(`Voting device with serial number ${updates.serialNumber} already exists.`);
      }
      throw error;
    }
  });
};

const deleteVotingDevice = async (id: number): Promise<void> => {
  return asyncDbRun(() => {
    try {
      // ON DELETE CASCADE sur deviceKitAssignments.votingDeviceId devrait gérer les affectations.
      const stmt = getDb().prepare("DELETE FROM votingDevices WHERE id = ?");
      stmt.run(id);
    } catch (error) {
      _logger.debug(`[DB VotingDevices] Error deleting voting device ${id}: ${error}`);
      throw error;
    }
  });
};

const bulkAddVotingDevices = async (devices: Omit<VotingDevice, 'id'>[]): Promise<void> => {
  if (!devices || devices.length === 0) return Promise.resolve();

  return asyncDbRun(() => {
    const insertStmt = getDb().prepare("INSERT OR IGNORE INTO votingDevices (name, serialNumber) VALUES (@name, @serialNumber)");
    // Utilisation de "INSERT OR IGNORE" pour éviter les erreurs si un serialNumber existe déjà.
    // Cela signifie que les doublons basés sur serialNumber seront ignorés silencieusement.
    // Si un comportement différent est souhaité (ex: lever une erreur pour le lot), il faudrait ajuster.

    const transaction = getDb().transaction((items: Omit<VotingDevice, 'id'>[]) => {
      for (const device of items) {
        try {
          insertStmt.run(device);
        } catch (error) {
          // Normalement, INSERT OR IGNORE devrait prévenir les erreurs SQLITE_CONSTRAINT_UNIQUE.
          // Mais on garde un catch pour d'autres erreurs potentielles.
          _logger.debug(`[DB VotingDevices] Error in bulk adding voting device for item: ${device}, ${error}`);
          throw error; // Annule la transaction si une erreur inattendue survient.
        }
      }
    });

    try {
      transaction(devices);
    } catch (error) {
      // L'erreur a déjà été _logger.debuggée.
      _logger.debug(`[DB VotingDevices] Bulk add transaction failed overall.`);
      // On ne retourne rien (void) comme spécifié, mais on propage l'erreur pour que l'appelant soit notifié.
      throw error;
    }
  });
};

// Trainers
const addTrainer = async (trainer: Omit<Trainer, 'id'>): Promise<number | undefined> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare(`
        INSERT INTO trainers (name, isDefault)
        VALUES (@name, @isDefault)
      `);
      // Assurer que isDefault est bien 0 ou 1 si non fourni explicitement
      const isDefault = trainer.isDefault ? 1 : 0;
      const result = stmt.run({ ...trainer, isDefault });
      return result.lastInsertRowid as number;
    } catch (error) {
      _logger.debug(`[DB Trainers] Error adding trainer: ${error}`);
      throw error;
    }
  });
};

const getAllTrainers = async (): Promise<Trainer[]> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("SELECT * FROM trainers");
      const trainers = stmt.all() as any[];
      // Convertir isDefault en booléen pour la _logger.debugique applicative si nécessaire (ici on garde 0/1 comme dans le schéma)
      return trainers.map(t => ({ ...t, isDefault: t.isDefault === 1 }));
    } catch (error) {
      _logger.debug(`[DB Trainers] Error getting all trainers: ${error}`);
      throw error;
    }
  });
};

const getTrainerById = async (id: number): Promise<Trainer | undefined> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("SELECT * FROM trainers WHERE id = ?");
      const trainer = stmt.get(id) as any | undefined;
      if (trainer) {
        return { ...trainer, isDefault: trainer.isDefault === 1 };
      }
      return undefined;
    } catch (error) {
      _logger.debug(`[DB Trainers] Error getting trainer by id ${id}: ${error}`);
      throw error;
    }
  });
};

const updateTrainer = async (id: number, updates: Partial<Omit<Trainer, 'id'>>): Promise<number | undefined> => {
  return asyncDbRun(() => {
    try {
      const fields = Object.keys(updates).filter(key => key !== 'id'); // Exclure 'id' des champs à mettre à jour
      if (fields.length === 0) return 0; // Pas de champs à mettre à jour

      const setClause = fields.map(field => `${field} = @${field}`).join(', ');
      const stmt = getDb().prepare(`UPDATE trainers SET ${setClause} WHERE id = @id`);

      // Assurer que isDefault est 0 ou 1 si présent dans updates
      const params: any = { ...updates, id };
      if (updates.isDefault !== undefined) {
        params.isDefault = updates.isDefault ? 1 : 0;
      }

      const result = stmt.run(params);
      return result.changes; // Nombre de lignes modifiées
    } catch (error) {
      _logger.debug(`[DB Trainers] Error updating trainer ${id}: ${error}`);
      throw error;
    }
  });
};

const deleteTrainer = async (id: number): Promise<void> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("DELETE FROM trainers WHERE id = ?");
      stmt.run(id);
    } catch (error) {
      _logger.debug(`[DB Trainers] Error deleting trainer ${id}: ${error}`);
      throw error;
    }
  });
};

const setDefaultTrainer = async (id: number): Promise<void> => {
  return asyncDbRun(() => {
    const transaction = getDb().transaction(() => {
      try {
        const resetStmt = getDb().prepare("UPDATE trainers SET isDefault = 0 WHERE isDefault = 1");
        resetStmt.run();

        const setStmt = getDb().prepare("UPDATE trainers SET isDefault = 1 WHERE id = ?");
        const result = setStmt.run(id);

        if (result.changes === 0) {
          _logger.debug(`[DB Trainers] setDefaultTrainer: Trainer with id ${id} not found or no change made.`);
        }
      } catch (error) {
        _logger.debug(`[DB Trainers] Error setting default trainer ${id}: ${error}`);
        throw error; // Annule la transaction
      }
    });
    transaction();
  });
};

const getDefaultTrainer = async (): Promise<Trainer | undefined> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("SELECT * FROM trainers WHERE isDefault = 1 LIMIT 1");
      const trainer = stmt.get() as any | undefined;
      if (trainer) {
        return { ...trainer, isDefault: true }; // Assure que isDefault est un booléen
      }
      return undefined;
    } catch (error) {
      _logger.debug(`[DB Trainers] Error getting default trainer: ${error}`);
      throw error;
    }
  });
};

// SessionQuestions
const addSessionQuestion = async (sq: Omit<SessionQuestion, 'id'>): Promise<number | undefined> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare(`
        INSERT INTO sessionQuestions (sessionId, dbQuestionId, slideGuid, blockId)
        VALUES (@sessionId, @dbQuestionId, @slideGuid, @blockId)
      `);
      const result = stmt.run(sq);
      return result.lastInsertRowid as number;
    } catch (error) {
      _logger.debug(`[DB SessionQuestions] Error adding session question: ${error}`);
      throw error;
    }
  });
};

const addBulkSessionQuestions = async (questions: Omit<SessionQuestion, 'id'>[]): Promise<(number | undefined)[] | undefined> => {
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
          _logger.debug(`[DB SessionQuestions] Error in bulk adding session question for item: ${question}, ${error}`);
          insertedIds.push(undefined);
          throw error; // Rollback transaction
        }
      }
    });

    try {
      transaction(questions);
      return insertedIds;
    } catch (error) {
      _logger.debug(`[DB SessionQuestions] Bulk add transaction failed.`);
      return undefined; // Ou retourner le tableau `insertedIds` partiellement rempli si on ne relance pas l'erreur dans la boucle
    }
  });
};

const getSessionQuestionsBySessionId = async (sessionId: number): Promise<SessionQuestion[]> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("SELECT * FROM sessionQuestions WHERE sessionId = ?");
      // Il pourrait être utile de trier, par exemple par ID ou un autre critère si l'ordre est important.
      // Pour l'instant, pas de tri explicite.
      return stmt.all(sessionId) as SessionQuestion[];
    } catch (error) {
      _logger.debug(`[DB SessionQuestions] Error getting session questions for session ${sessionId}: ${error}`);
      throw error;
    }
  });
};

const deleteSessionQuestionsBySessionId = async (sessionId: number): Promise<void> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("DELETE FROM sessionQuestions WHERE sessionId = ?");
      stmt.run(sessionId);
    } catch (error) {
      _logger.debug(`[DB SessionQuestions] Error deleting session questions for session ${sessionId}: ${error}`);
      throw error;
    }
  });
};

// SessionBoitiers
const addSessionBoitier = async (sb: Omit<SessionBoitier, 'id'>): Promise<number | undefined> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare(`
        INSERT INTO sessionBoitiers (sessionId, participantId, visualId, serialNumber)
        VALUES (@sessionId, @participantId, @visualId, @serialNumber)
      `);
      const result = stmt.run(sb);
      return result.lastInsertRowid as number;
    } catch (error) {
      _logger.debug(`[DB SessionBoitiers] Error adding session boitier: ${error}`);
      // Potentielle contrainte UNIQUE à vérifier si on en ajoute une sur (sessionId, serialNumber) ou (sessionId, participantId)
      throw error;
    }
  });
};

const addBulkSessionBoitiers = async (boitiers: Omit<SessionBoitier, 'id'>[]): Promise<(number | undefined)[] | undefined> => {
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
          _logger.debug(`[DB SessionBoitiers] Error in bulk adding session boitier for item: ${boitier}, ${error}`);
          insertedIds.push(undefined);
          throw error; // Rollback transaction
        }
      }
    });

    try {
      transaction(boitiers);
      return insertedIds;
    } catch (error) {
      _logger.debug(`[DB SessionBoitiers] Bulk add transaction failed.`);
      return undefined;
    }
  });
};

const getSessionBoitiersBySessionId = async (sessionId: number): Promise<SessionBoitier[]> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("SELECT * FROM sessionBoitiers WHERE sessionId = ? ORDER BY visualId ASC, participantId ASC");
      return stmt.all(sessionId) as SessionBoitier[];
    } catch (error) {
      _logger.debug(`[DB SessionBoitiers] Error getting session boitiers for session ${sessionId}: ${error}`);
      throw error;
    }
  });
};

const deleteSessionBoitiersBySessionId = async (sessionId: number): Promise<void> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("DELETE FROM sessionBoitiers WHERE sessionId = ?");
      stmt.run(sessionId);
    } catch (error) {
      _logger.debug(`[DB SessionBoitiers] Error deleting session boitiers for session ${sessionId}: ${error}`);
      throw error;
    }
  });
};

// Referentiels
const addReferential = async (referential: Omit<Referential, 'id'>): Promise<number | undefined> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare(`
        INSERT INTO referentiels (code, nom_complet)
        VALUES (@code, @nom_complet)
      `);
      const result = stmt.run(referential);
      return result.lastInsertRowid as number;
    } catch (error) {
      _logger.debug(`[DB Referentiels] Error adding referential: ${error}`);
      if ((error as any).code === 'SQLITE_CONSTRAINT_UNIQUE') {
        // Optionnel: gérer spécifiquement les erreurs d'unicité ou les laisser remonter
        throw new Error(`Referential with code ${referential.code} already exists.`);
      }
      throw error; // Renvoyer l'erreur pour que asyncDbRun la capture
    }
  });
};

const getAllReferentiels = async (): Promise<Referential[]> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("SELECT * FROM referentiels");
      const referentiels = stmt.all() as Referential[];
      return referentiels;
    } catch (error) {
      _logger.debug(`[DB Referentiels] Error getting all referentiels: ${error}`);
      throw error;
    }
  });
};

const getReferentialByCode = async (code: string): Promise<Referential | undefined> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("SELECT * FROM referentiels WHERE code = ?");
      const referential = stmt.get(code) as Referential | undefined;
      return referential;
    } catch (error) {
      _logger.debug(`[DB Referentiels] Error getting referential by code ${code}: ${error}`);
      throw error;
    }
  });
};

const getReferentialById = async (id: number): Promise<Referential | undefined> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("SELECT * FROM referentiels WHERE id = ?");
      const referential = stmt.get(id) as Referential | undefined;
      return referential;
    } catch (error) {
      _logger.debug(`[DB Referentiels] Error getting referential by id ${id}: ${error}`);
      throw error;
    }
  });
};

// Themes
const addTheme = async (theme: Omit<Theme, 'id'>): Promise<number | undefined> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare(`
        INSERT INTO themes (code_theme, nom_complet, referentiel_id)
        VALUES (@code_theme, @nom_complet, @referentiel_id)
      `);
      const result = stmt.run(theme);
      return result.lastInsertRowid as number;
    } catch (error) {
      _logger.debug(`[DB Themes] Error adding theme: ${error}`);
      if ((error as any).code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new Error(`Theme with code ${theme.code_theme} already exists for referential ${theme.referentiel_id}.`);
      }
      throw error;
    }
  });
};

const getAllThemes = async (): Promise<Theme[]> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("SELECT * FROM themes");
      return stmt.all() as Theme[];
    } catch (error) {
      _logger.debug(`[DB Themes] Error getting all themes: ${error}`);
      throw error;
    }
  });
};

const getThemesByReferentialId = async (referentialId: number): Promise<Theme[]> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("SELECT * FROM themes WHERE referentiel_id = ?");
      return stmt.all(referentialId) as Theme[];
    } catch (error) {
      _logger.debug(`[DB Themes] Error getting themes by referentialId ${referentialId}: ${error}`);
      throw error;
    }
  });
};

const getThemeByCodeAndReferentialId = async (code_theme: string, referentiel_id: number): Promise<Theme | undefined> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("SELECT * FROM themes WHERE code_theme = ? AND referentiel_id = ?");
      return stmt.get(code_theme, referentiel_id) as Theme | undefined;
    } catch (error) {
      _logger.debug(`[DB Themes] Error getting theme by code ${code_theme} and referentialId ${referentiel_id}: ${error}`);
      throw error;
    }
  });
};

const getThemeById = async (id: number): Promise<Theme | undefined> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("SELECT * FROM themes WHERE id = ?");
      return stmt.get(id) as Theme | undefined;
    } catch (error) {
      _logger.debug(`[DB Themes] Error getting theme by id ${id}: ${error}`);
      throw error;
    }
  });
};

// Blocs
const addBloc = async (bloc: Omit<Bloc, 'id'>): Promise<number | undefined> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare(`
        INSERT INTO blocs (code_bloc, nom_complet, theme_id)
        VALUES (@code_bloc, @nom_complet, @theme_id)
      `);
      const result = stmt.run(bloc);
      return result.lastInsertRowid as number;
    } catch (error) {
      _logger.debug(`[DB Blocs] Error adding bloc: ${error}`);
      if ((error as any).code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new Error(`Bloc with code ${bloc.code_bloc} already exists for theme ${bloc.theme_id}.`);
      }
      throw error;
    }
  });
};

const getAllBlocs = async (): Promise<Bloc[]> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("SELECT * FROM blocs");
      return stmt.all() as Bloc[];
    } catch (error) {
      _logger.debug(`[DB Blocs] Error getting all blocs: ${error}`);
      throw error;
    }
  });
};

const getBlocsByThemeId = async (themeId: number): Promise<Bloc[]> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("SELECT * FROM blocs WHERE theme_id = ?");
      return stmt.all(themeId) as Bloc[];
    } catch (error) {
      _logger.debug(`[DB Blocs] Error getting blocs by themeId ${themeId}: ${error}`);
      throw error;
    }
  });
};

const getBlocByCodeAndThemeId = async (code_bloc: string, theme_id: number): Promise<Bloc | undefined> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("SELECT * FROM blocs WHERE code_bloc = ? AND theme_id = ?");
      return stmt.get(code_bloc, theme_id) as Bloc | undefined;
    } catch (error) {
      _logger.debug(`[DB Blocs] Error getting bloc by code ${code_bloc} and themeId ${theme_id}: ${error}`);
      throw error;
    }
  });
};

const getBlocById = async (id: number): Promise<Bloc | undefined> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("SELECT * FROM blocs WHERE id = ?");
      return stmt.get(id) as Bloc | undefined;
    } catch (error) {
      _logger.debug(`[DB Blocs] Error getting bloc by id ${id}: ${error}`);
      throw error;
    }
  });
};

// DeviceKits

// Helper pour convertir la valeur de isDefault (0/1) en booléen pour la _logger.debugique applicative
const rowToDeviceKit = (row: any): DeviceKit => {
  if (!row) return undefined as any;
  return {
    ...row,
    isDefault: row.isDefault === 1,
  };
};

const addDeviceKit = async (kit: Omit<DeviceKit, 'id'>): Promise<number | undefined> => {
  return asyncDbRun(() => {
    try {
      _logger.debug(`[DB DeviceKits] Attempting to add device kit: ${kit}`);
      const stmt = getDb().prepare("INSERT INTO deviceKits (name, isDefault) VALUES (@name, @isDefault)");
      const isDefault = kit.isDefault ? 1 : 0;
      const result = stmt.run({ ...kit, isDefault });
      _logger.debug(`[DB DeviceKits] Successfully added device kit with ID: ${result.lastInsertRowid}`);
      return result.lastInsertRowid as number;
    } catch (error) {
      _logger.debug(`[DB DeviceKits] Error adding device kit: ${error}`);
      if ((error as any).code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new Error(`Device kit with name ${kit.name} already exists.`);
      }
      throw error;
    }
  });
};

const getAllDeviceKits = async (): Promise<DeviceKit[]> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("SELECT * FROM deviceKits ORDER BY name ASC");
      const rows = stmt.all() as any[];
      return rows.map(rowToDeviceKit);
    } catch (error) {
      _logger.debug(`[DB DeviceKits] Error getting all device kits: ${error}`);
      throw error;
    }
  });
};

const getDeviceKitById = async (id: number): Promise<DeviceKit | undefined> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("SELECT * FROM deviceKits WHERE id = ?");
      const row = stmt.get(id) as any;
      return row ? rowToDeviceKit(row) : undefined;
    } catch (error) {
      _logger.debug(`[DB DeviceKits] Error getting device kit by id ${id}: ${error}`);
      throw error;
    }
  });
};

const updateDeviceKit = async (id: number, updates: Partial<Omit<DeviceKit, 'id'>>): Promise<number | undefined> => {
  return asyncDbRun(() => {
    try {
      const fields = Object.keys(updates).filter(key => key !== 'id');
      if (fields.length === 0) return 0;

      const setClause = fields.map(field => `${field} = @${field}`).join(', ');
      const stmt = getDb().prepare(`UPDATE deviceKits SET ${setClause} WHERE id = @id`);

      const params: any = { ...updates, id };
      if (updates.isDefault !== undefined) {
        params.isDefault = updates.isDefault ? 1 : 0;
      }

      const result = stmt.run(params);
      return result.changes;
    } catch (error) {
      _logger.debug(`[DB DeviceKits] Error updating device kit ${id}: ${error}`);
      if ((error as any).code === 'SQLITE_CONSTRAINT_UNIQUE' && updates.name) {
        throw new Error(`Device kit with name ${updates.name} already exists.`);
      }
      throw error;
    }
  });
};

const deleteDeviceKit = async (id: number): Promise<void> => {
  return asyncDbRun(() => {
    try {
      // ON DELETE CASCADE sur deviceKitAssignments.kitId devrait gérer les affectations.
      const stmt = getDb().prepare("DELETE FROM deviceKits WHERE id = ?");
      stmt.run(id);
    } catch (error) {
      _logger.debug(`[DB DeviceKits] Error deleting device kit ${id}: ${error}`);
      throw error;
    }
  });
};

const getDefaultDeviceKit = async (): Promise<DeviceKit | undefined> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("SELECT * FROM deviceKits WHERE isDefault = 1 LIMIT 1");
      const row = stmt.get() as any;
      return row ? rowToDeviceKit(row) : undefined;
    } catch (error) {
      _logger.debug(`[DB DeviceKits] Error getting default device kit: ${error}`);
      throw error;
    }
  });
};

const setDefaultDeviceKit = async (kitId: number): Promise<void> => {
  return asyncDbRun(() => {
    const transaction = getDb().transaction(() => {
      try {
        const resetStmt = getDb().prepare("UPDATE deviceKits SET isDefault = 0 WHERE isDefault = 1");
        resetStmt.run();

        const setStmt = getDb().prepare("UPDATE deviceKits SET isDefault = 1 WHERE id = ?");
        const result = setStmt.run(kitId);

        if (result.changes === 0) {
          _logger.debug(`[DB DeviceKits] setDefaultDeviceKit: Kit with id ${kitId} not found or no change made.`);
          // On pourrait vouloir lever une erreur ici si le kitId n'est pas trouvé,
          // mais pour l'instant, on garde un comportement silencieux si pas de changement.
        }
        // La fonction originale retournait void, donc on ne retourne rien ici non plus.
      } catch (error) {
        _logger.debug(`[DB DeviceKits] Error setting default device kit ${kitId}: ${error}`);
        throw error; // Annule la transaction
      }
    });
    transaction();
  });
};

// DeviceKitAssignments
const assignDeviceToKit = async (kitId: number, votingDeviceId: number): Promise<number | undefined> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("INSERT INTO deviceKitAssignments (kitId, votingDeviceId) VALUES (?, ?)");
      const result = stmt.run(kitId, votingDeviceId);
      return result.lastInsertRowid as number;
    } catch (error) {
      _logger.debug(`[DB DeviceKitAssignments] Error assigning device ${votingDeviceId} to kit ${kitId}: ${error}`);
      if ((error as any).code === 'SQLITE_CONSTRAINT_UNIQUE') {
        // Cette erreur signifie que l'assignation existe déjà.
        // On peut choisir de la retourner comme un succès silencieux ou de lever une erreur spécifique.
        // Pour l'instant, on la laisse remonter pour que l'appelant soit conscient.
        throw new Error(`Device ${votingDeviceId} is already assigned to kit ${kitId}.`);
      }
      throw error;
    }
  });
};

const removeDeviceFromKit = async (kitId: number, votingDeviceId: number): Promise<void> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("DELETE FROM deviceKitAssignments WHERE kitId = ? AND votingDeviceId = ?");
      stmt.run(kitId, votingDeviceId);
    } catch (error) {
      _logger.debug(`[DB DeviceKitAssignments] Error removing device ${votingDeviceId} from kit ${kitId}: ${error}`);
      throw error;
    }
  });
};

const getVotingDevicesForKit = async (kitId: number): Promise<VotingDevice[]> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare(`
        SELECT vd.*
        FROM votingDevices vd
        JOIN deviceKitAssignments dka ON vd.id = dka.votingDeviceId
        WHERE dka.kitId = ?
        ORDER BY vd.name ASC, vd.serialNumber ASC
      `);
      return stmt.all(kitId) as VotingDevice[];
    } catch (error) {
      _logger.debug(`[DB DeviceKitAssignments] Error getting voting devices for kit ${kitId}: ${error}`);
      throw error;
    }
  });
};

const getKitsForVotingDevice = async (votingDeviceId: number): Promise<DeviceKit[]> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare(`
        SELECT dk.*
        FROM deviceKits dk
        JOIN deviceKitAssignments dka ON dk.id = dka.kitId
        WHERE dka.votingDeviceId = ?
        ORDER BY dk.name ASC
      `);
      const rows = stmt.all(votingDeviceId) as any[];
      return rows.map(rowToDeviceKit); // Utilise le helper existant pour convertir isDefault
    } catch (error) {
      _logger.debug(`[DB DeviceKitAssignments] Error getting kits for voting device ${votingDeviceId}: ${error}`);
      throw error;
    }
  });
};

const removeAssignmentsByKitId = async (kitId: number): Promise<void> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("DELETE FROM deviceKitAssignments WHERE kitId = ?");
      stmt.run(kitId);
    } catch (error) {
      _logger.debug(`[DB DeviceKitAssignments] Error removing assignments by kitId ${kitId}: ${error}`);
      throw error;
    }
  });
};

const removeAssignmentsByVotingDeviceId = async (votingDeviceId: number): Promise<void> => {
  return asyncDbRun(() => {
    try {
      const stmt = getDb().prepare("DELETE FROM deviceKitAssignments WHERE votingDeviceId = ?");
      stmt.run(votingDeviceId);
    } catch (error) {
      _logger.debug(`[DB DeviceKitAssignments] Error removing assignments by votingDeviceId ${votingDeviceId}: ${error}`);
      throw error;
    }
  });
};

// Reporting
interface BlockUsage {
  referentiel: string; // code of referentiel
  theme: string; // code_theme of theme
  blockId: string; // code_bloc of bloc
  usageCount: number;
}
const calculateBlockUsage = async (startDate?: string | Date, endDate?: string | Date): Promise<BlockUsage[]> => {
  return asyncDbRun(() => {
    let query = "SELECT id, dateSession, referentielId, selectedBlocIds FROM sessions WHERE status = 'completed'";
    const params: (string | number)[] = [];

    if (startDate) {
      query += " AND dateSession >= ?";
      params.push(typeof startDate === 'string' ? startDate : startDate.toISOString());
    }
    if (endDate) {
      query += " AND dateSession <= ?";
      params.push(typeof endDate === 'string' ? endDate : endDate.toISOString());
    }

    const sessionsForBlockUsage = getDb().prepare(query).all(...params) as Pick<Session, 'id' | 'dateSession' | 'referentielId' | 'selectedBlocIds'>[];

    const blockUsageMap = new Map<string, BlockUsage>();

    for (const session of sessionsForBlockUsage) {
      if (!session.selectedBlocIds || !session.referentielId) {
        continue;
      }

      let blocIds: number[] = [];
      try {
        // selectedBlocIds est stocké comme JSON array de nombres (IDs de blocs)
        const parsedBlocIds = JSON.parse(session.selectedBlocIds as any);
        if (Array.isArray(parsedBlocIds) && parsedBlocIds.every(id => typeof id === 'number')) {
          blocIds = parsedBlocIds;
        } else {
          _logger.debug(`[DB Reports] Session ${session.id} has malformed selectedBlocIds: ${session.selectedBlocIds}`);
          continue;
        }
      } catch (e) {
        _logger.debug(`[DB Reports] Session ${session.id} failed to parse selectedBlocIds: ${session.selectedBlocIds}, ${e}`);
        continue;
      }

      if (blocIds.length === 0) {
        continue;
      }

      // Pour chaque blocId, trouver son code_bloc, puis le thème et le référentiel associés
      for (const blocId of blocIds) {
        try {
          const blocInfoStmt = getDb().prepare(`
            SELECT b.code_bloc, t.code_theme, r.code as referentiel_code
            FROM blocs b
            JOIN themes t ON b.theme_id = t.id
            JOIN referentiels r ON t.referentiel_id = r.id
            WHERE b.id = ? AND r.id = ?
          `);
          // On s'assure que le bloc appartient bien au référentiel de la session pour la cohérence
          const blocDetails = blocInfoStmt.get(blocId, session.referentielId) as { code_bloc: string; code_theme: string; referentiel_code: string } | undefined;

          if (blocDetails) {
            const key = `${blocDetails.referentiel_code}-${blocDetails.code_theme}-${blocDetails.code_bloc}`;
            if (blockUsageMap.has(key)) {
              blockUsageMap.get(key)!.usageCount++;
            } else {
              blockUsageMap.set(key, {
                referentiel: blocDetails.referentiel_code,
                theme: blocDetails.code_theme,
                blockId: blocDetails.code_bloc,
                usageCount: 1,
              });
            }
          } else {
            // Ce cas peut arriver si un blocId dans selectedBlocIds n'existe plus
            // ou n'appartient pas au référentiel de la session.
            _logger.debug(`[DB Reports] Block details not found for blocId ${blocId} in referentielId ${session.referentielId} for session ${session.id}`);
          }
        } catch (e) {
            _logger.debug(`[DB Reports] Error processing blocId ${blocId} for session ${session.id}: ${e}`);
        }
      }
    }
    return Array.from(blockUsageMap.values());
  });
};

// Backup and Restore
const exportAllData = async () => {
    // Implementation for exporting data
};

const importAllData = async (data: any) => {
    // Implementation for importing data
};

// General Notes for this file:
// 1. Path Resolution: The database path is now more robust for typical application user data directories.
//    This is important for packaged Electron applications.
// 2. Main vs. Renderer: This file is designed to run in Electron's main process.
//    Renderer processes should use IPC to request data operations from the main process.
// 3. Async API: All exported CRUD functions maintain an async Promise-based API to align with
//    the previous Dexie implementation. The `asyncDbRun` helper is a basic way to wrap
//    synchronous `better-sqlite3` calls. More specific error handling or return value
//    adaptation (e.g., `lastInsertRowid` for adds, `changes` for updates/deletes)
//    will be needed when these functions are fully implemented.
// 4. JSON Fields: Fields like `questions.options`, `sessions.selectedBlocIds`, etc., are stored as TEXT
//    and will contain JSON strings. Serialization/deserialization will be handled in the CRUD implementations.
// 5. Error Handling: The current `asyncDbRun` has basic error _logger.debugging. Production code would
//    need more robust error handling and possibly custom error types.
// 6. Transactions: The schema creation is wrapped in a transaction. Individual CRUD operations
//    that involve multiple steps (e.g., updating a default flag) should also use transactions.
// 7. Logging: Added more console _logger.debugs with prefixes for easier debugging of setup and stub calls.

Object.assign(module.exports, { getDb, addQuestion, getAllQuestions, getQuestionById, getQuestionsByIds, updateQuestion, deleteQuestion, getQuestionsByBlocId, getQuestionsForSessionBlocks,
     getAdminSetting, setAdminSetting, getAllAdminSettings, getGlobalPptxTemplate, addSession, getAllSessions, getSessionById, updateSession, deleteSession, addSessionResult,
     addBulkSessionResults, getAllResults, getResultsForSession, getResultBySessionAndQuestion, updateSessionResult, deleteResultsForSession, addVotingDevice, getAllVotingDevices,
     updateVotingDevice, deleteVotingDevice, bulkAddVotingDevices, addTrainer, getAllTrainers, getTrainerById, updateTrainer, deleteTrainer, setDefaultTrainer, getDefaultTrainer,
     addSessionQuestion, addBulkSessionQuestions, getSessionQuestionsBySessionId, deleteSessionQuestionsBySessionId, addSessionBoitier, addBulkSessionBoitiers,
     getSessionBoitiersBySessionId, deleteSessionBoitiersBySessionId, addReferential, getAllReferentiels, getReferentialByCode, getReferentialById, addTheme, getAllThemes,
     getThemesByReferentialId, getThemeByCodeAndReferentialId, getThemeById, addBloc, getAllBlocs, getBlocsByThemeId, getBlocByCodeAndThemeId, getBlocById, addDeviceKit,
     getAllDeviceKits, getDeviceKitById, updateDeviceKit, deleteDeviceKit, getDefaultDeviceKit, setDefaultDeviceKit, assignDeviceToKit, removeDeviceFromKit, getVotingDevicesForKit,
     getKitsForVotingDevice, removeAssignmentsByKitId, removeAssignmentsByVotingDeviceId, calculateBlockUsage, exportAllData, importAllData, });