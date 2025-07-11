import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import {
  QuestionWithId, Session, SessionResult, Trainer,
  SessionQuestion, SessionBoitier, Referential, Theme, Bloc,
  VotingDevice, DeviceKit, DeviceKitAssignment
} from './types'; // Assurez-vous que ces types sont toujours pertinents

// Déterminer le chemin de la base de données de manière plus robuste
const appName = 'val17-app'; // Nom de votre application
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
console.log(`[DB SETUP] Database path determined as: ${dbPath}`);

export const db = new Database(dbPath);
console.log(`[DB SETUP] SQLite database connection established.`);

// Activer les clés étrangères
try {
  db.pragma('foreign_keys = ON');
  console.log("[DB SETUP] Foreign key support enabled.");
} catch (error) {
  console.error("[DB SETUP] Failed to enable foreign keys:", error);
}


// Schéma de la base de données
const createSchema = () => {
  console.log("[DB SCHEMA] Attempting to create/verify schema...");
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

  const transaction = db.transaction(() => {
    for (const stmt of DDL_STATEMENTS) {
      try {
        db.prepare(stmt).run();
      } catch (error) {
        console.error(`[DB SCHEMA] Failed to execute DDL: ${stmt.substring(0,60)}...`, error);
        // En cas d'erreur, la transaction sera automatiquement annulée par better-sqlite3
        throw error; 
      }
    }
  });

  try {
    transaction();
    console.log("[DB SCHEMA] Database schema created/verified successfully.");
  } catch(error) {
    console.error("[DB SCHEMA] Transaction failed during schema creation. No changes were applied.", error);
    throw error; // Renvoyer l'erreur pour indiquer l'échec de createSchema
  }
};

// Exécuter la création du schéma au démarrage de ce module
try {
  createSchema();
} catch (error) {
  console.error("[DB SETUP] FATAL: Failed to create/verify database schema. Application might not work correctly.", error);
  // Envisager de quitter l'application si le schéma est critique et ne peut être créé
  // process.exit(1); 
}

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
    console.error("[ASYNC DB RUNNER] SQLite operation failed:", error);
    return Promise.reject(error);
  }
}

// --- CRUD Function Placeholders (to be implemented with SQLite logic) ---

// Questions
export const addQuestion = async (question: Omit<QuestionWithId, 'id'>): Promise<number | undefined> => {
  console.warn("[DB STUB] addQuestion called", question);
  return asyncDbRun(() => undefined);
};
export const getAllQuestions = async (): Promise<QuestionWithId[]> => {
  console.warn("[DB STUB] getAllQuestions called");
  return asyncDbRun(() => []);
};
export const getQuestionById = async (id: number): Promise<QuestionWithId | undefined> => {
  console.warn(`[DB STUB] getQuestionById(${id}) called`);
  return asyncDbRun(() => undefined);
}
export const getQuestionsByIds = async (ids: number[]): Promise<QuestionWithId[]> => {
  console.warn(`[DB STUB] getQuestionsByIds called`, ids);
  return asyncDbRun(() => []);
}
export const updateQuestion = async (id: number, updates: Partial<QuestionWithId>): Promise<number | undefined> => {
  console.warn(`[DB STUB] updateQuestion(${id}) called`, updates);
  return asyncDbRun(() => undefined);
}
export const deleteQuestion = async (id: number): Promise<void> => {
  console.warn(`[DB STUB] deleteQuestion(${id}) called`);
  return asyncDbRun(() => {});
}
export const getQuestionsByBlocId = async (blocId: number): Promise<QuestionWithId[]> => {
  console.warn(`[DB STUB] getQuestionsByBlocId(${blocId}) called`);
  return asyncDbRun(() => []);
}
export const getQuestionsForSessionBlocks = async (selectedBlocIds?: number[]): Promise<QuestionWithId[]> => {
  console.warn("[DB STUB] getQuestionsForSessionBlocks called", selectedBlocIds);
  return asyncDbRun(() => []);
}

// AdminSettings
export const getAdminSetting = async (key: string): Promise<any> => {
  console.warn(`[DB STUB] getAdminSetting(${key}) called`);
  return asyncDbRun(() => undefined);
};
export const setAdminSetting = async (key: string, value: any): Promise<void> => {
  console.warn(`[DB STUB] setAdminSetting(${key}) called`, value);
  return asyncDbRun(() => {});
};
export const getAllAdminSettings = async (): Promise<{ key: string; value: any }[]> => {
  console.warn("[DB STUB] getAllAdminSettings called");
  return asyncDbRun(() => []);
};
export const getGlobalPptxTemplate = async (): Promise<File | null> => {
  console.warn("[DB STUB] getGlobalPptxTemplate called. Note: File objects are not directly storable in SQLite; typically path or BLOB is stored.");
  return asyncDbRun(() => null);
};

// Sessions
export const addSession = async (session: Session): Promise<number | undefined> => {
  console.warn("[DB STUB] addSession called", session);
  return asyncDbRun(() => undefined);
};
export const getAllSessions = async (): Promise<Session[]> => {
  console.warn("[DB STUB] getAllSessions called");
  return asyncDbRun(() => []);
};
export const getSessionById = async (id: number): Promise<Session | undefined> => {
  console.warn(`[DB STUB] getSessionById(${id}) called`);
  return asyncDbRun(() => undefined);
};
export const updateSession = async (id: number, updates: Partial<Session>): Promise<number | undefined> => {
  console.warn(`[DB STUB] updateSession(${id}) called`, updates);
  return asyncDbRun(() => undefined);
};
export const deleteSession = async (id: number): Promise<void> => {
  console.warn(`[DB STUB] deleteSession(${id}) called`);
  return asyncDbRun(() => {});
};

// SessionResults
export const addSessionResult = async (result: SessionResult): Promise<number | undefined> => {
  console.warn("[DB STUB] addSessionResult called", result);
  return asyncDbRun(() => undefined);
};
export const addBulkSessionResults = async (results: SessionResult[]): Promise<number[] | undefined> => {
  console.warn("[DB STUB] addBulkSessionResults called", results);
  return asyncDbRun(() => undefined);
}
export const getAllResults = async (): Promise<SessionResult[]> => {
  console.warn("[DB STUB] getAllResults called");
  return asyncDbRun(() => []);
};
export const getResultsForSession = async (sessionId: number): Promise<SessionResult[]> => {
  console.warn(`[DB STUB] getResultsForSession(${sessionId}) called`);
  return asyncDbRun(() => []);
};
export const getResultBySessionAndQuestion = async (sessionId: number, questionId: number, participantIdBoitier: string): Promise<SessionResult | undefined> => {
  console.warn(`[DB STUB] getResultBySessionAndQuestion called for session ${sessionId}, question ${questionId}, boitier ${participantIdBoitier}`);
  return asyncDbRun(() => undefined);
};
export const updateSessionResult = async (id: number, updates: Partial<SessionResult>): Promise<number | undefined> => {
  console.warn(`[DB STUB] updateSessionResult(${id}) called`, updates);
  return asyncDbRun(() => undefined);
};
export const deleteResultsForSession = async (sessionId: number): Promise<void> => {
  console.warn(`[DB STUB] deleteResultsForSession(${sessionId}) called`);
  return asyncDbRun(() => {});
};

// VotingDevices
export const addVotingDevice = async (device: Omit<VotingDevice, 'id'>): Promise<number | undefined> => {
  console.warn("[DB STUB] addVotingDevice called", device);
  return asyncDbRun(() => undefined);
};
export const getAllVotingDevices = async (): Promise<VotingDevice[]> => {
  console.warn("[DB STUB] getAllVotingDevices called");
  return asyncDbRun(() => []);
};
export const updateVotingDevice = async (id: number, updates: Partial<VotingDevice>): Promise<number> => {
  console.warn(`[DB STUB] updateVotingDevice(${id}) called`, updates);
  return asyncDbRun(() => 0); // Dexie's update returned number of affected rows. SQLite update returns changes.
};
export const deleteVotingDevice = async (id: number): Promise<void> => {
  console.warn(`[DB STUB] deleteVotingDevice(${id}) called`);
  // Foreign key ON DELETE CASCADE for deviceKitAssignments.votingDeviceId should handle related assignments.
  return asyncDbRun(() => {});
};
export const bulkAddVotingDevices = async (devices: VotingDevice[]): Promise<void> => {
  console.warn("[DB STUB] bulkAddVotingDevices called", devices);
  return asyncDbRun(() => {});
};

// Trainers
export const addTrainer = async (trainer: Omit<Trainer, 'id'>): Promise<number | undefined> => {
  console.warn("[DB STUB] addTrainer called", trainer);
  return asyncDbRun(() => undefined);
};
export const getAllTrainers = async (): Promise<Trainer[]> => {
  console.warn("[DB STUB] getAllTrainers called");
  return asyncDbRun(() => []);
};
export const getTrainerById = async (id: number): Promise<Trainer | undefined> => {
  console.warn(`[DB STUB] getTrainerById(${id}) called`);
  return asyncDbRun(() => undefined);
};
export const updateTrainer = async (id: number, updates: Partial<Omit<Trainer, 'id'>>): Promise<number | undefined> => {
  console.warn(`[DB STUB] updateTrainer(${id}) called`, updates);
  return asyncDbRun(() => undefined);
};
export const deleteTrainer = async (id: number): Promise<void> => {
  console.warn(`[DB STUB] deleteTrainer(${id}) called`);
  return asyncDbRun(() => {});
};
export const setDefaultTrainer = async (id: number): Promise<number | undefined> => {
  console.warn(`[DB STUB] setDefaultTrainer(${id}) called`);
  return asyncDbRun(() => undefined);
};
export const getDefaultTrainer = async (): Promise<Trainer | undefined> => {
  console.warn("[DB STUB] getDefaultTrainer called");
  return asyncDbRun(() => undefined);
};

// SessionQuestions
export const addSessionQuestion = async (sq: SessionQuestion): Promise<number | undefined> => {
  console.warn("[DB STUB] addSessionQuestion called", sq);
  return asyncDbRun(() => undefined);
};
export const addBulkSessionQuestions = async (questions: SessionQuestion[]): Promise<number[] | undefined> => {
  console.warn("[DB STUB] addBulkSessionQuestions called", questions);
  return asyncDbRun(() => undefined); // Dexie returned array of keys. SQLite bulk insert doesn't directly.
};
export const getSessionQuestionsBySessionId = async (sessionId: number): Promise<SessionQuestion[]> => {
  console.warn(`[DB STUB] getSessionQuestionsBySessionId(${sessionId}) called`);
  return asyncDbRun(() => []);
};
export const deleteSessionQuestionsBySessionId = async (sessionId: number): Promise<void> => {
  console.warn(`[DB STUB] deleteSessionQuestionsBySessionId(${sessionId}) called`);
  return asyncDbRun(() => {});
};

// SessionBoitiers
export const addSessionBoitier = async (sb: SessionBoitier): Promise<number | undefined> => {
  console.warn("[DB STUB] addSessionBoitier called", sb);
  return asyncDbRun(() => undefined);
};
export const addBulkSessionBoitiers = async (boitiers: SessionBoitier[]): Promise<number[] | undefined> => {
  console.warn("[DB STUB] addBulkSessionBoitiers called", boitiers);
  return asyncDbRun(() => undefined);
};
export const getSessionBoitiersBySessionId = async (sessionId: number): Promise<SessionBoitier[]> => {
  console.warn(`[DB STUB] getSessionBoitiersBySessionId(${sessionId}) called`);
  return asyncDbRun(() => []);
};
export const deleteSessionBoitiersBySessionId = async (sessionId: number): Promise<void> => {
  console.warn(`[DB STUB] deleteSessionBoitiersBySessionId(${sessionId}) called`);
  return asyncDbRun(() => {});
};

// Referentiels
export const addReferential = async (referential: Omit<Referential, 'id'>): Promise<number | undefined> => {
  console.warn("[DB STUB] addReferential called", referential);
  return asyncDbRun(() => undefined);
};
export const getAllReferentiels = async (): Promise<Referential[]> => {
  console.warn("[DB STUB] getAllReferentiels called");
  return asyncDbRun(() => []);
};
export const getReferentialByCode = async (code: string): Promise<Referential | undefined> => {
  console.warn(`[DB STUB] getReferentialByCode(${code}) called`);
  return asyncDbRun(() => undefined);
};
export const getReferentialById = async (id: number): Promise<Referential | undefined> => {
  console.warn(`[DB STUB] getReferentialById(${id}) called`);
  return asyncDbRun(() => undefined);
};

// Themes
export const addTheme = async (theme: Omit<Theme, 'id'>): Promise<number | undefined> => {
  console.warn("[DB STUB] addTheme called", theme);
  return asyncDbRun(() => undefined);
};
export const getAllThemes = async (): Promise<Theme[]> => {
  console.warn("[DB STUB] getAllThemes called");
  return asyncDbRun(() => []);
};
export const getThemesByReferentialId = async (referentialId: number): Promise<Theme[]> => {
  console.warn(`[DB STUB] getThemesByReferentialId(${referentialId}) called`);
  return asyncDbRun(() => []);
};
export const getThemeByCodeAndReferentialId = async (code_theme: string, referentiel_id: number): Promise<Theme | undefined> => {
  console.warn(`[DB STUB] getThemeByCodeAndReferentialId for code ${code_theme}, ref_id ${referentiel_id} called`);
  return asyncDbRun(() => undefined);
};
export const getThemeById = async (id: number): Promise<Theme | undefined> => {
  console.warn(`[DB STUB] getThemeById(${id}) called`);
  return asyncDbRun(() => undefined);
};

// Blocs
export const addBloc = async (bloc: Omit<Bloc, 'id'>): Promise<number | undefined> => {
  console.warn("[DB STUB] addBloc called", bloc);
  return asyncDbRun(() => undefined);
};
export const getAllBlocs = async (): Promise<Bloc[]> => {
  console.warn("[DB STUB] getAllBlocs called");
  return asyncDbRun(() => []);
};
export const getBlocsByThemeId = async (themeId: number): Promise<Bloc[]> => {
  console.warn(`[DB STUB] getBlocsByThemeId(${themeId}) called`);
  return asyncDbRun(() => []);
};
export const getBlocByCodeAndThemeId = async (code_bloc: string, theme_id: number): Promise<Bloc | undefined> => {
  console.warn(`[DB STUB] getBlocByCodeAndThemeId for code ${code_bloc}, theme_id ${theme_id} called`);
  return asyncDbRun(() => undefined);
};
export const getBlocById = async (id: number): Promise<Bloc | undefined> => {
  console.warn(`[DB STUB] getBlocById(${id}) called`);
  return asyncDbRun(() => undefined);
};

// DeviceKits
export const addDeviceKit = async (kit: Omit<DeviceKit, 'id'>): Promise<number | undefined> => {
  console.warn("[DB STUB] addDeviceKit called", kit);
  return asyncDbRun(() => undefined);
};
export const getAllDeviceKits = async (): Promise<DeviceKit[]> => {
  console.warn("[DB STUB] getAllDeviceKits called");
  return asyncDbRun(() => []);
};
export const getDeviceKitById = async (id: number): Promise<DeviceKit | undefined> => {
  console.warn(`[DB STUB] getDeviceKitById(${id}) called`);
  return asyncDbRun(() => undefined);
};
export const updateDeviceKit = async (id: number, updates: Partial<Omit<DeviceKit, 'id'>>): Promise<number | undefined> => {
  console.warn(`[DB STUB] updateDeviceKit(${id}) called`, updates);
  return asyncDbRun(() => undefined); // Dexie update returned number of affected rows.
};
export const deleteDeviceKit = async (id: number): Promise<void> => {
  console.warn(`[DB STUB] deleteDeviceKit(${id}) called`);
  // Foreign key ON DELETE CASCADE for deviceKitAssignments.kitId should handle assignments.
  return asyncDbRun(() => {});
};
export const getDefaultDeviceKit = async (): Promise<DeviceKit | undefined> => {
  console.warn("[DB STUB] getDefaultDeviceKit called");
  return asyncDbRun(() => undefined);
};
export const setDefaultDeviceKit = async (kitId: number): Promise<void> => {
  console.warn(`[DB STUB] setDefaultDeviceKit(${kitId}) called`);
  return asyncDbRun(() => {});
};

// DeviceKitAssignments
export const assignDeviceToKit = async (kitId: number, votingDeviceId: number): Promise<number | undefined> => {
  console.warn(`[DB STUB] assignDeviceToKit for kit ${kitId}, device ${votingDeviceId} called`);
  return asyncDbRun(() => undefined);
};
export const removeDeviceFromKit = async (kitId: number, votingDeviceId: number): Promise<void> => {
  console.warn(`[DB STUB] removeDeviceFromKit for kit ${kitId}, device ${votingDeviceId} called`);
  return asyncDbRun(() => {});
};
export const getVotingDevicesForKit = async (kitId: number): Promise<VotingDevice[]> => {
  console.warn(`[DB STUB] getVotingDevicesForKit(${kitId}) called`);
  return asyncDbRun(() => []);
};
export const getKitsForVotingDevice = async (votingDeviceId: number): Promise<DeviceKit[]> => {
  console.warn(`[DB STUB] getKitsForVotingDevice(${votingDeviceId}) called`);
  return asyncDbRun(() => []);
};
export const removeAssignmentsByKitId = async (kitId: number): Promise<void> => {
  console.warn(`[DB STUB] removeAssignmentsByKitId(${kitId}) called`);
  // This function is likely redundant if ON DELETE CASCADE is used on deviceKits.
  // If called, it would perform a targeted delete.
  return asyncDbRun(() => {});
};
export const removeAssignmentsByVotingDeviceId = async (votingDeviceId: number): Promise<void> => {
  console.warn(`[DB STUB] removeAssignmentsByVotingDeviceId(${votingDeviceId}) called`);
  // Similarly, redundant if ON DELETE CASCADE is used on votingDevices.
  return asyncDbRun(() => {});
};

// Reporting
export interface BlockUsage {
  referentiel: string; // code of referentiel
  theme: string; // code_theme of theme
  blockId: string; // code_bloc of bloc
  usageCount: number;
}
export const calculateBlockUsage = async (startDate?: string | Date, endDate?: string | Date): Promise<BlockUsage[]> => {
  console.warn("[DB STUB] calculateBlockUsage called", { startDate, endDate });
  return asyncDbRun(() => []);
};

console.log("[DB SETUP] SQLite database module loaded. Schema applied. CRUD functions are placeholders.");

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
// 5. Error Handling: The current `asyncDbRun` has basic error logging. Production code would
//    need more robust error handling and possibly custom error types.
// 6. Transactions: The schema creation is wrapped in a transaction. Individual CRUD operations
//    that involve multiple steps (e.g., updating a default flag) should also use transactions.
// 7. Logging: Added more console logs with prefixes for easier debugging of setup and stub calls.
