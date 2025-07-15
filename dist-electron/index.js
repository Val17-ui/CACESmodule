import { ipcMain, app, BrowserWindow } from "electron";
import path from "path";
import Database from "better-sqlite3";
import fs from "fs";
import { fileURLToPath } from "url";
const appName = "easycertif";
let userDataPath;
if (process.env.APPDATA) {
  userDataPath = process.env.APPDATA;
} else if (process.platform === "darwin") {
  userDataPath = path.join(process.env.HOME || "", "Library", "Application Support");
} else {
  userDataPath = path.join(process.env.HOME || "", ".config");
}
const dbDir = path.join(userDataPath, appName, "db_data");
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const dbPath = path.join(dbDir, "database.sqlite3");
console.log(`[DB SETUP] Database path determined as: ${dbPath}`);
let db;
function initializeDatabase() {
  if (db) {
    console.log("[DB SETUP] Database already initialized.");
    return;
  }
  console.log("[DB SETUP] Initializing database...");
  db = new Database(dbPath);
  console.log(`[DB SETUP] SQLite database connection established.`);
  try {
    db.pragma("foreign_keys = ON");
    console.log("[DB SETUP] Foreign key support enabled.");
  } catch (error) {
    console.error("[DB SETUP] Failed to enable foreign keys:", error);
  }
  try {
    createSchema();
  } catch (error) {
    console.error("[DB SETUP] FATAL: Failed to create/verify database schema. Application might not work correctly.", error);
  }
  console.log("[DB SETUP] SQLite database module loaded and initialized.");
}
const createSchema = () => {
  if (!db) {
    console.error("[DB SCHEMA] Cannot create schema, DB not initialized.");
    return;
  }
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
        console.error(`[DB SCHEMA] Failed to execute DDL: ${stmt.substring(0, 60)}...`, error);
        throw error;
      }
    }
  });
  try {
    transaction();
    console.log("[DB SCHEMA] Database schema created/verified successfully.");
  } catch (error) {
    console.error("[DB SCHEMA] Transaction failed during schema creation. No changes were applied.", error);
    throw error;
  }
};
async function asyncDbRun(fn) {
  try {
    const result = fn();
    return Promise.resolve(result);
  } catch (error) {
    console.error("[ASYNC DB RUNNER] SQLite operation failed:", error);
    return Promise.reject(error);
  }
}
const rowToQuestion = (row) => {
  if (!row) return void 0;
  return {
    ...row,
    options: row.options ? JSON.parse(row.options) : [],
    isEliminatory: row.isEliminatory === 1
    // createdAt devrait déjà être un string ISO, pas de transformation nécessaire a priori
  };
};
const questionToRow = (question) => {
  const rowData = { ...question };
  if (question.options !== void 0) {
    rowData.options = JSON.stringify(question.options);
  }
  if (question.isEliminatory !== void 0) {
    rowData.isEliminatory = question.isEliminatory ? 1 : 0;
  }
  if ("id" in rowData && !Object.prototype.hasOwnProperty.call(question, "id")) {
    delete rowData.id;
  }
  return rowData;
};
const addQuestion = async (question) => {
  return asyncDbRun(() => {
    try {
      const { blocId, text, type, correctAnswer, timeLimit, isEliminatory, createdAt, usageCount, correctResponseRate, slideGuid, options } = question;
      const stmt = db.prepare(`
        INSERT INTO questions (blocId, text, type, correctAnswer, timeLimit, isEliminatory, createdAt, usageCount, correctResponseRate, slideGuid, options)
        VALUES (@blocId, @text, @type, @correctAnswer, @timeLimit, @isEliminatory, @createdAt, @usageCount, @correctResponseRate, @slideGuid, @options)
      `);
      const rowData = questionToRow({
        blocId,
        text,
        type,
        correctAnswer,
        timeLimit,
        isEliminatory,
        // Sera converti en 0/1 par questionToRow
        createdAt,
        usageCount: usageCount ?? 0,
        correctResponseRate: correctResponseRate ?? 0,
        slideGuid,
        options
        // Sera stringifié par questionToRow
      });
      const result = stmt.run(rowData);
      return result.lastInsertRowid;
    } catch (error) {
      console.error(`[DB Questions] Error adding question:`, error);
      throw error;
    }
  });
};
const getAllQuestions = async () => {
  return asyncDbRun(() => {
    try {
      const stmt = db.prepare("SELECT * FROM questions");
      const rows = stmt.all();
      return rows.map(rowToQuestion);
    } catch (error) {
      console.error(`[DB Questions] Error getting all questions:`, error);
      throw error;
    }
  });
};
const getQuestionById = async (id) => {
  return asyncDbRun(() => {
    try {
      const stmt = db.prepare("SELECT * FROM questions WHERE id = ?");
      const row = stmt.get(id);
      return row ? rowToQuestion(row) : void 0;
    } catch (error) {
      console.error(`[DB Questions] Error getting question by id ${id}:`, error);
      throw error;
    }
  });
};
const getQuestionsByIds = async (ids) => {
  if (!ids || ids.length === 0) return Promise.resolve([]);
  return asyncDbRun(() => {
    try {
      const placeholders = ids.map(() => "?").join(",");
      const stmt = db.prepare(`SELECT * FROM questions WHERE id IN (${placeholders})`);
      const rows = stmt.all(...ids);
      return rows.map(rowToQuestion);
    } catch (error) {
      console.error(`[DB Questions] Error getting questions by ids:`, error);
      throw error;
    }
  });
};
const updateQuestion = async (id, updates) => {
  return asyncDbRun(() => {
    try {
      const rowUpdates = questionToRow(updates);
      const fields = Object.keys(rowUpdates).filter((key) => key !== "id");
      if (fields.length === 0) return 0;
      const setClause = fields.map((field) => `${field} = @${field}`).join(", ");
      const stmt = db.prepare(`UPDATE questions SET ${setClause} WHERE id = @id`);
      const result = stmt.run({ ...rowUpdates, id });
      return result.changes;
    } catch (error) {
      console.error(`[DB Questions] Error updating question ${id}:`, error);
      throw error;
    }
  });
};
const deleteQuestion = async (id) => {
  return asyncDbRun(() => {
    try {
      const stmt = db.prepare("DELETE FROM questions WHERE id = ?");
      stmt.run(id);
    } catch (error) {
      console.error(`[DB Questions] Error deleting question ${id}:`, error);
      throw error;
    }
  });
};
const getQuestionsByBlocId = async (blocId) => {
  return asyncDbRun(() => {
    try {
      const stmt = db.prepare("SELECT * FROM questions WHERE blocId = ?");
      const rows = stmt.all(blocId);
      return rows.map(rowToQuestion);
    } catch (error) {
      console.error(`[DB Questions] Error getting questions by blocId ${blocId}:`, error);
      throw error;
    }
  });
};
const getQuestionsForSessionBlocks = async (selectedBlocIds) => {
  if (!selectedBlocIds || selectedBlocIds.length === 0) {
    return asyncDbRun(() => {
      try {
        const stmt = db.prepare("SELECT * FROM questions WHERE blocId IS NULL");
        const rows = stmt.all();
        return rows.map(rowToQuestion);
      } catch (error) {
        console.error(`[DB Questions] Error getting questions with no blocId:`, error);
        throw error;
      }
    });
  }
  return asyncDbRun(() => {
    try {
      const placeholders = selectedBlocIds.map(() => "?").join(",");
      const stmt = db.prepare(`SELECT * FROM questions WHERE blocId IN (${placeholders})`);
      const rows = stmt.all(...selectedBlocIds);
      return rows.map(rowToQuestion);
    } catch (error) {
      console.error(`[DB Questions] Error getting questions for session blocks:`, error);
      throw error;
    }
  });
};
const parseAdminSettingValue = (value) => {
  if (value === null || value === void 0) return void 0;
  try {
    return JSON.parse(value);
  } catch (e) {
    return value;
  }
};
const getAdminSetting = async (key) => {
  return asyncDbRun(() => {
    try {
      const stmt = db.prepare("SELECT value FROM adminSettings WHERE key = ?");
      const row = stmt.get(key);
      return row ? parseAdminSettingValue(row.value) : void 0;
    } catch (error) {
      console.error(`[DB AdminSettings] Error getting setting ${key}:`, error);
      throw error;
    }
  });
};
const setAdminSetting = async (key, value) => {
  return asyncDbRun(() => {
    try {
      const stmt = db.prepare(`
        INSERT INTO adminSettings (key, value)
        VALUES (@key, @value)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `);
      const valueToStore = typeof value === "string" ? value : value === null || value === void 0 ? null : JSON.stringify(value);
      stmt.run({ key, value: valueToStore });
    } catch (error) {
      console.error(`[DB AdminSettings] Error setting setting ${key}:`, error);
      throw error;
    }
  });
};
const getAllAdminSettings = async () => {
  return asyncDbRun(() => {
    try {
      const stmt = db.prepare("SELECT key, value FROM adminSettings");
      const rows = stmt.all();
      return rows.map((row) => ({
        key: row.key,
        value: parseAdminSettingValue(row.value)
      }));
    } catch (error) {
      console.error(`[DB AdminSettings] Error getting all settings:`, error);
      throw error;
    }
  });
};
const JSON_SESSION_FIELDS = [
  "selectedBlocIds",
  "questionMappings",
  "ignoredSlideGuids",
  "resolvedImportAnomalies",
  "participants"
];
const rowToSession = (row) => {
  if (!row) return void 0;
  const session = { ...row };
  for (const field of JSON_SESSION_FIELDS) {
    if (session[field] && typeof session[field] === "string") {
      try {
        session[field] = JSON.parse(session[field]);
      } catch (e) {
        console.error(`[DB Sessions] Failed to parse JSON field ${field} for session id ${row.id}:`, e);
      }
    } else if (session[field] === null && (field === "selectedBlocIds" || field === "ignoredSlideGuids" || field === "participants")) {
      session[field] = [];
    }
  }
  return session;
};
const getAllSessions = async () => {
  return asyncDbRun(() => {
    try {
      const stmt = db.prepare("SELECT * FROM sessions ORDER BY dateSession DESC, createdAt DESC");
      const rows = stmt.all();
      return rows.map(rowToSession);
    } catch (error) {
      console.error(`[DB Sessions] Error getting all sessions:`, error);
      throw error;
    }
  });
};
const getSessionById = async (id) => {
  return asyncDbRun(() => {
    try {
      const stmt = db.prepare("SELECT * FROM sessions WHERE id = ?");
      const row = stmt.get(id);
      return row ? rowToSession(row) : void 0;
    } catch (error) {
      console.error(`[DB Sessions] Error getting session by id ${id}:`, error);
      throw error;
    }
  });
};
const getAllTrainers = async () => {
  return asyncDbRun(() => {
    try {
      const stmt = db.prepare("SELECT * FROM trainers");
      const trainers = stmt.all();
      return trainers.map((t) => ({ ...t, isDefault: t.isDefault === 1 }));
    } catch (error) {
      console.error(`[DB Trainers] Error getting all trainers:`, error);
      throw error;
    }
  });
};
const addReferential = async (referential) => {
  return asyncDbRun(() => {
    try {
      const stmt = db.prepare(`
        INSERT INTO referentiels (code, nom_complet)
        VALUES (@code, @nom_complet)
      `);
      const result = stmt.run(referential);
      return result.lastInsertRowid;
    } catch (error) {
      console.error(`[DB Referentiels] Error adding referential:`, error);
      if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
        throw new Error(`Referential with code ${referential.code} already exists.`);
      }
      throw error;
    }
  });
};
const getAllReferentiels = async () => {
  return asyncDbRun(() => {
    try {
      const stmt = db.prepare("SELECT * FROM referentiels");
      const referentiels = stmt.all();
      return referentiels;
    } catch (error) {
      console.error(`[DB Referentiels] Error getting all referentiels:`, error);
      throw error;
    }
  });
};
const getReferentialByCode = async (code) => {
  return asyncDbRun(() => {
    try {
      const stmt = db.prepare("SELECT * FROM referentiels WHERE code = ?");
      const referential = stmt.get(code);
      return referential;
    } catch (error) {
      console.error(`[DB Referentiels] Error getting referential by code ${code}:`, error);
      throw error;
    }
  });
};
const getReferentialById = async (id) => {
  return asyncDbRun(() => {
    try {
      const stmt = db.prepare("SELECT * FROM referentiels WHERE id = ?");
      const referential = stmt.get(id);
      return referential;
    } catch (error) {
      console.error(`[DB Referentiels] Error getting referential by id ${id}:`, error);
      throw error;
    }
  });
};
const addTheme = async (theme) => {
  return asyncDbRun(() => {
    try {
      const stmt = db.prepare(`
        INSERT INTO themes (code_theme, nom_complet, referentiel_id)
        VALUES (@code_theme, @nom_complet, @referentiel_id)
      `);
      const result = stmt.run(theme);
      return result.lastInsertRowid;
    } catch (error) {
      console.error(`[DB Themes] Error adding theme:`, error);
      if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
        throw new Error(`Theme with code ${theme.code_theme} already exists for referential ${theme.referentiel_id}.`);
      }
      throw error;
    }
  });
};
const getAllThemes = async () => {
  return asyncDbRun(() => {
    try {
      const stmt = db.prepare("SELECT * FROM themes");
      return stmt.all();
    } catch (error) {
      console.error(`[DB Themes] Error getting all themes:`, error);
      throw error;
    }
  });
};
const getThemesByReferentialId = async (referentialId) => {
  return asyncDbRun(() => {
    try {
      const stmt = db.prepare("SELECT * FROM themes WHERE referentiel_id = ?");
      return stmt.all(referentialId);
    } catch (error) {
      console.error(`[DB Themes] Error getting themes by referentialId ${referentialId}:`, error);
      throw error;
    }
  });
};
const getThemeByCodeAndReferentialId = async (code_theme, referentiel_id) => {
  return asyncDbRun(() => {
    try {
      const stmt = db.prepare("SELECT * FROM themes WHERE code_theme = ? AND referentiel_id = ?");
      return stmt.get(code_theme, referentiel_id);
    } catch (error) {
      console.error(`[DB Themes] Error getting theme by code ${code_theme} and referentialId ${referentiel_id}:`, error);
      throw error;
    }
  });
};
const getThemeById = async (id) => {
  return asyncDbRun(() => {
    try {
      const stmt = db.prepare("SELECT * FROM themes WHERE id = ?");
      return stmt.get(id);
    } catch (error) {
      console.error(`[DB Themes] Error getting theme by id ${id}:`, error);
      throw error;
    }
  });
};
const addBloc = async (bloc) => {
  return asyncDbRun(() => {
    try {
      const stmt = db.prepare(`
        INSERT INTO blocs (code_bloc, nom_complet, theme_id)
        VALUES (@code_bloc, @nom_complet, @theme_id)
      `);
      const result = stmt.run(bloc);
      return result.lastInsertRowid;
    } catch (error) {
      console.error(`[DB Blocs] Error adding bloc:`, error);
      if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
        throw new Error(`Bloc with code ${bloc.code_bloc} already exists for theme ${bloc.theme_id}.`);
      }
      throw error;
    }
  });
};
const getAllBlocs = async () => {
  return asyncDbRun(() => {
    try {
      const stmt = db.prepare("SELECT * FROM blocs");
      return stmt.all();
    } catch (error) {
      console.error(`[DB Blocs] Error getting all blocs:`, error);
      throw error;
    }
  });
};
const getBlocsByThemeId = async (themeId) => {
  return asyncDbRun(() => {
    try {
      const stmt = db.prepare("SELECT * FROM blocs WHERE theme_id = ?");
      return stmt.all(themeId);
    } catch (error) {
      console.error(`[DB Blocs] Error getting blocs by themeId ${themeId}:`, error);
      throw error;
    }
  });
};
const getBlocByCodeAndThemeId = async (code_bloc, theme_id) => {
  return asyncDbRun(() => {
    try {
      const stmt = db.prepare("SELECT * FROM blocs WHERE code_bloc = ? AND theme_id = ?");
      return stmt.get(code_bloc, theme_id);
    } catch (error) {
      console.error(`[DB Blocs] Error getting bloc by code ${code_bloc} and themeId ${theme_id}:`, error);
      throw error;
    }
  });
};
const getBlocById = async (id) => {
  return asyncDbRun(() => {
    try {
      const stmt = db.prepare("SELECT * FROM blocs WHERE id = ?");
      return stmt.get(id);
    } catch (error) {
      console.error(`[DB Blocs] Error getting bloc by id ${id}:`, error);
      throw error;
    }
  });
};
function initializeIpcHandlers() {
  console.log("[IPC Handlers] Initializing IPC handlers...");
  ipcMain.handle("db-get-all-sessions", async () => {
    console.log("[IPC Main] Received db-get-all-sessions");
    try {
      const sessions = await getAllSessions();
      return sessions;
    } catch (error) {
      console.error("[IPC Main] Error in db-get-all-sessions:", error);
      throw error;
    }
  });
  ipcMain.handle("db-get-session-by-id", async (event, sessionId) => {
    console.log(`[IPC Main] Received db-get-session-by-id for id: ${sessionId}`);
    if (typeof sessionId !== "number") {
      console.error("[IPC Main] Invalid sessionId received for db-get-session-by-id:", sessionId);
      throw new Error("Invalid sessionId provided.");
    }
    try {
      const session = await getSessionById(sessionId);
      return session;
    } catch (error) {
      console.error(`[IPC Main] Error in db-get-session-by-id for id ${sessionId}:`, error);
      throw error;
    }
  });
  ipcMain.handle("db-add-referential", async (event, referentialData) => {
    console.log("[IPC Main] Received db-add-referential with data:", referentialData);
    try {
      const newId = await addReferential(referentialData);
      return newId;
    } catch (error) {
      console.error("[IPC Main] Error in db-add-referential:", error);
      throw error;
    }
  });
  ipcMain.handle("db-get-all-referentiels", async () => {
    console.log("[IPC Main] Received db-get-all-referentiels");
    try {
      return await getAllReferentiels();
    } catch (error) {
      console.error("[IPC Main] Error in db-get-all-referentiels:", error);
      throw error;
    }
  });
  ipcMain.handle("db-get-all-trainers", async () => {
    console.log("[IPC Main] Received db-get-all-trainers");
    try {
      return await getAllTrainers();
    } catch (error) {
      console.error("[IPC Main] Error in db-get-all-trainers:", error);
      throw error;
    }
  });
  ipcMain.handle("db-get-referential-by-code", async (event, code) => {
    try {
      return await getReferentialByCode(code);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });
  ipcMain.handle("db-get-referential-by-id", async (event, id) => {
    try {
      return await getReferentialById(id);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });
  ipcMain.handle("db-add-theme", async (event, data) => {
    try {
      return await addTheme(data);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });
  ipcMain.handle("db-get-theme-by-code-and-referential-id", async (event, code, refId) => {
    try {
      return await getThemeByCodeAndReferentialId(code, refId);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });
  ipcMain.handle("db-get-themes-by-referential-id", async (event, refId) => {
    try {
      return await getThemesByReferentialId(refId);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });
  ipcMain.handle("db-get-theme-by-id", async (event, id) => {
    try {
      return await getThemeById(id);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });
  ipcMain.handle("db-get-all-themes", async () => {
    try {
      return await getAllThemes();
    } catch (e) {
      console.error(e);
      throw e;
    }
  });
  ipcMain.handle("db-add-bloc", async (event, data) => {
    try {
      return await addBloc(data);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });
  ipcMain.handle("db-get-bloc-by-code-and-theme-id", async (event, code, themeId) => {
    try {
      return await getBlocByCodeAndThemeId(code, themeId);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });
  ipcMain.handle("db-get-blocs-by-theme-id", async (event, themeId) => {
    try {
      return await getBlocsByThemeId(themeId);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });
  ipcMain.handle("db-get-bloc-by-id", async (event, id) => {
    try {
      return await getBlocById(id);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });
  ipcMain.handle("db-get-all-blocs", async () => {
    try {
      return await getAllBlocs();
    } catch (e) {
      console.error(e);
      throw e;
    }
  });
  ipcMain.handle("db-add-question", async (event, data) => {
    try {
      return await addQuestion(data);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });
  ipcMain.handle("db-get-question-by-id", async (event, id) => {
    try {
      return await getQuestionById(id);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });
  ipcMain.handle("db-get-questions-by-bloc-id", async (event, blocId) => {
    try {
      return await getQuestionsByBlocId(blocId);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });
  ipcMain.handle("db-update-question", async (event, id, updates) => {
    try {
      return await updateQuestion(id, updates);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });
  ipcMain.handle("db-delete-question", async (event, id) => {
    try {
      await deleteQuestion(id);
      return;
    } catch (e) {
      console.error(e);
      throw e;
    }
  });
  ipcMain.handle("db-get-all-questions", async () => {
    try {
      return await getAllQuestions();
    } catch (e) {
      console.error(e);
      throw e;
    }
  });
  ipcMain.handle("db-get-questions-by-ids", async (event, ids) => {
    try {
      return await getQuestionsByIds(ids);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });
  ipcMain.handle("db-get-questions-for-session-blocks", async (event, blocIds) => {
    try {
      return await getQuestionsForSessionBlocks(blocIds);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });
  ipcMain.handle("db-get-admin-setting", async (event, key) => {
    try {
      return await getAdminSetting(key);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });
  ipcMain.handle("db-set-admin-setting", async (event, key, value) => {
    try {
      await setAdminSetting(key, value);
      return;
    } catch (e) {
      console.error(e);
      throw e;
    }
  });
  ipcMain.handle("db-get-all-admin-settings", async () => {
    try {
      return await getAllAdminSettings();
    } catch (e) {
      console.error(e);
      throw e;
    }
  });
  console.log("[IPC Handlers] IPC handlers registration attempt finished.");
}
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.webContents.on("did-finish-load", () => {
    win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
  if (!app.isPackaged) {
    win.webContents.openDevTools();
  }
}
app.whenReady().then(async () => {
  try {
    await initializeDatabase();
    initializeIpcHandlers();
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    console.error("[Main] Failed to initialize application:", error);
    app.quit();
  }
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
