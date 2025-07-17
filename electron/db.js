"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addTheme = exports.getReferentialById = exports.getReferentialByCode = exports.getAllReferentiels = exports.addReferential = exports.deleteSessionBoitiersBySessionId = exports.getSessionBoitiersBySessionId = exports.addBulkSessionBoitiers = exports.addSessionBoitier = exports.deleteSessionQuestionsBySessionId = exports.getSessionQuestionsBySessionId = exports.addBulkSessionQuestions = exports.addSessionQuestion = exports.getDefaultTrainer = exports.setDefaultTrainer = exports.deleteTrainer = exports.updateTrainer = exports.getTrainerById = exports.getAllTrainers = exports.addTrainer = exports.bulkAddVotingDevices = exports.deleteVotingDevice = exports.updateVotingDevice = exports.getAllVotingDevices = exports.addVotingDevice = exports.deleteResultsForSession = exports.updateSessionResult = exports.getResultBySessionAndQuestion = exports.getResultsForSession = exports.getAllResults = exports.addBulkSessionResults = exports.addSessionResult = exports.deleteSession = exports.updateSession = exports.getSessionById = exports.getAllSessions = exports.addSession = exports.getGlobalPptxTemplate = exports.getAllAdminSettings = exports.setAdminSetting = exports.getAdminSetting = exports.getQuestionsForSessionBlocks = exports.getQuestionsByBlocId = exports.deleteQuestion = exports.updateQuestion = exports.getQuestionsByIds = exports.getQuestionById = exports.getAllQuestions = exports.addQuestion = exports.getDb = void 0;
exports.calculateBlockUsage = exports.removeAssignmentsByVotingDeviceId = exports.removeAssignmentsByKitId = exports.getKitsForVotingDevice = exports.getVotingDevicesForKit = exports.removeDeviceFromKit = exports.assignDeviceToKit = exports.setDefaultDeviceKit = exports.getDefaultDeviceKit = exports.deleteDeviceKit = exports.updateDeviceKit = exports.getDeviceKitById = exports.getAllDeviceKits = exports.addDeviceKit = exports.getBlocById = exports.getBlocByCodeAndThemeId = exports.getBlocsByThemeId = exports.getAllBlocs = exports.addBloc = exports.getThemeById = exports.getThemeByCodeAndReferentialId = exports.getThemesByReferentialId = exports.getAllThemes = void 0;
exports.initializeDatabase = initializeDatabase;
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
// Déterminer le chemin de la base de données de manière plus robuste
const appName = 'easycertif'; // Nom de votre application
let userDataPath;
if (process.env.APPDATA) { // Windows
    userDataPath = process.env.APPDATA;
}
else if (process.platform === 'darwin') { // macOS
    userDataPath = path.join(process.env.HOME || '', 'Library', 'Application Support');
}
else { // Linux et autres
    userDataPath = path.join(process.env.HOME || '', '.config');
}
const dbDir = path.join(userDataPath, appName, 'db_data');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}
const dbPath = path.join(dbDir, 'database.sqlite3');
console.log(`[DB SETUP] Database path determined as: ${dbPath}`);
let db;
function initializeDatabase() {
    if (db) {
        console.log('[DB SETUP] Database already initialized.');
        return;
    }
    console.log('[DB SETUP] Initializing database...');
    db = new Database(dbPath);
    console.log(`[DB SETUP] SQLite database connection established.`);
    // Activer les clés étrangères
    try {
        getDb().pragma('foreign_keys = ON');
        console.log("[DB SETUP] Foreign key support enabled.");
    }
    catch (error) {
        console.error("[DB SETUP] Failed to enable foreign keys:", error);
    }
    // Créer le schéma
    try {
        createSchema();
    }
    catch (error) {
        console.error("[DB SETUP] FATAL: Failed to create/verify database schema. Application might not work correctly.", error);
        // Envisager de quitter l'application si le schéma est critique et ne peut être créé
        // process.exit(1);
    }
    console.log("[DB SETUP] SQLite database module loaded and initialized.");
}
// Schéma de la base de données
const getDb = () => {
    if (!db) {
        throw new Error("Database not initialized. Please call initializeDatabase first.");
    }
    return db;
};
exports.getDb = getDb;
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
            }
            catch (error) {
                console.error(`[DB SCHEMA] Failed to execute DDL: ${stmt.substring(0, 60)}...`, error);
                // En cas d'erreur, la transaction sera automatiquement annulée par better-sqlite3
                throw error;
            }
        }
    });
    try {
        transaction();
        console.log("[DB SCHEMA] Database schema created/verified successfully.");
        // --- Migrations for 'sessions' table ---
        const db = getDb();
        try {
            // Check if the old column exists before trying to rename
            const columns = db.pragma('table_info(sessions)');
            const hasDonneesOrs = columns.some(col => col.name === 'donneesOrs');
            const hasOrsFilePath = columns.some(col => col.name === 'orsFilePath');
            if (hasDonneesOrs && !hasOrsFilePath) {
                db.prepare("ALTER TABLE sessions RENAME COLUMN donneesOrs TO orsFilePath").run();
                console.log("[DB MIGRATION] Renamed column 'donneesOrs' to 'orsFilePath'.");
            }
        }
        catch (error) {
            // This might fail for other reasons, log it but proceed.
            console.error("[DB MIGRATION] Error during rename check/operation for 'donneesOrs':", error);
        }
        // Migration step 2: Add new columns if they don't exist
        const columnsToAdd = [
            { name: 'orsFilePath', type: 'TEXT' },
            { name: 'resultsImportedAt', type: 'TEXT' },
            { name: 'updatedAt', type: 'TEXT' }
        ];
        const existingColumns = db.pragma('table_info(sessions)').map(col => col.name);
        for (const column of columnsToAdd) {
            if (!existingColumns.includes(column.name)) {
                try {
                    db.prepare(`ALTER TABLE sessions ADD COLUMN ${column.name} ${column.type}`).run();
                    console.log(`[DB MIGRATION] Added '${column.name}' column to 'sessions' table.`);
                }
                catch (error) {
                    // Catching errors here just in case, though the check should prevent duplicates.
                    console.error(`[DB MIGRATION] Error adding '${column.name}' column:`, error);
                }
            }
        }
    }
    catch (error) {
        console.error("[DB SCHEMA] Transaction failed during schema creation. No changes were applied.", error);
        throw error; // Renvoyer l'erreur pour indiquer l'échec de createSchema
    }
};
// --- Helper function to wrap sync better-sqlite3 calls in Promises ---
// This helps maintain an async API similar to Dexie, minimizing changes in consuming code.
function asyncDbRun(fn) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // For potentially long-running synchronous operations,
            // consider setImmediate or process.nextTick to yield to the event loop,
            // though better-sqlite3 operations are generally very fast.
            // For now, a direct Promise.resolve/reject is fine.
            const result = fn();
            return Promise.resolve(result);
        }
        catch (error) {
            console.error("[ASYNC DB RUNNER] SQLite operation failed:", error);
            return Promise.reject(error);
        }
    });
}
// --- CRUD Function Placeholders (to be implemented with SQLite logic) ---
// Questions
// Helper pour transformer une ligne de DB en QuestionWithId (gère JSON et booléens)
const rowToQuestion = (row) => {
    if (!row)
        return undefined; // Should not happen if called correctly
    return Object.assign(Object.assign({}, row), { options: row.options ? JSON.parse(row.options) : [], isEliminatory: row.isEliminatory === 1 });
};
const questionToRow = (question) => {
    const rowData = Object.assign({}, question);
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
const addQuestion = (question) => __awaiter(void 0, void 0, void 0, function* () {
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
                usageCount: usageCount !== null && usageCount !== void 0 ? usageCount : 0,
                correctResponseRate: correctResponseRate !== null && correctResponseRate !== void 0 ? correctResponseRate : 0,
                slideGuid,
                options // Sera stringifié par questionToRow
            });
            const result = stmt.run(rowData);
            return result.lastInsertRowid;
        }
        catch (error) {
            console.error(`[DB Questions] Error adding question:`, error);
            throw error;
        }
    });
});
exports.addQuestion = addQuestion;
const getAllQuestions = () => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("SELECT * FROM questions");
            const rows = stmt.all();
            return rows.map(rowToQuestion);
        }
        catch (error) {
            console.error(`[DB Questions] Error getting all questions:`, error);
            throw error;
        }
    });
});
exports.getAllQuestions = getAllQuestions;
const getQuestionById = (id) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("SELECT * FROM questions WHERE id = ?");
            const row = stmt.get(id);
            return row ? rowToQuestion(row) : undefined;
        }
        catch (error) {
            console.error(`[DB Questions] Error getting question by id ${id}:`, error);
            throw error;
        }
    });
});
exports.getQuestionById = getQuestionById;
const getQuestionsByIds = (ids) => __awaiter(void 0, void 0, void 0, function* () {
    if (!ids || ids.length === 0)
        return Promise.resolve([]);
    return asyncDbRun(() => {
        try {
            // SQLite ne supporte pas directement un array dans `IN (?)`. Il faut générer les placeholders.
            const placeholders = ids.map(() => '?').join(',');
            const stmt = getDb().prepare(`SELECT * FROM questions WHERE id IN (${placeholders})`);
            const rows = stmt.all(...ids);
            return rows.map(rowToQuestion);
        }
        catch (error) {
            console.error(`[DB Questions] Error getting questions by ids:`, error);
            throw error;
        }
    });
});
exports.getQuestionsByIds = getQuestionsByIds;
const updateQuestion = (id, updates) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const rowUpdates = questionToRow(updates);
            const fields = Object.keys(rowUpdates).filter(key => key !== 'id');
            if (fields.length === 0)
                return 0;
            const setClause = fields.map(field => `${field} = @${field}`).join(', ');
            const stmt = getDb().prepare(`UPDATE questions SET ${setClause} WHERE id = @id`);
            const result = stmt.run(Object.assign(Object.assign({}, rowUpdates), { id }));
            return result.changes;
        }
        catch (error) {
            console.error(`[DB Questions] Error updating question ${id}:`, error);
            throw error;
        }
    });
});
exports.updateQuestion = updateQuestion;
const deleteQuestion = (id) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("DELETE FROM questions WHERE id = ?");
            stmt.run(id);
        }
        catch (error) {
            console.error(`[DB Questions] Error deleting question ${id}:`, error);
            throw error;
        }
    });
});
exports.deleteQuestion = deleteQuestion;
const getQuestionsByBlocId = (blocId) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("SELECT * FROM questions WHERE blocId = ?");
            const rows = stmt.all(blocId);
            return rows.map(rowToQuestion);
        }
        catch (error) {
            console.error(`[DB Questions] Error getting questions by blocId ${blocId}:`, error);
            throw error;
        }
    });
});
exports.getQuestionsByBlocId = getQuestionsByBlocId;
const getQuestionsForSessionBlocks = (selectedBlocIds) => __awaiter(void 0, void 0, void 0, function* () {
    if (!selectedBlocIds || selectedBlocIds.length === 0) {
        // Si aucun blocId n'est sélectionné, doit-on retourner toutes les questions SANS blocId (orphelines)
        // ou toutes les questions de l'application ? La logique Dexie d'origine serait à vérifier.
        // Pour l'instant, si selectedBlocIds est vide ou non fourni, on retourne les questions sans blocId.
        // Si une logique différente est attendue, il faudra ajuster.
        return asyncDbRun(() => {
            try {
                const stmt = getDb().prepare("SELECT * FROM questions WHERE blocId IS NULL");
                const rows = stmt.all();
                return rows.map(rowToQuestion);
            }
            catch (error) {
                console.error(`[DB Questions] Error getting questions with no blocId:`, error);
                throw error;
            }
        });
    }
    return asyncDbRun(() => {
        try {
            const placeholders = selectedBlocIds.map(() => '?').join(',');
            const stmt = getDb().prepare(`SELECT * FROM questions WHERE blocId IN (${placeholders})`);
            const rows = stmt.all(...selectedBlocIds);
            return rows.map(rowToQuestion);
        }
        catch (error) {
            console.error(`[DB Questions] Error getting questions for session blocks:`, error);
            throw error;
        }
    });
});
exports.getQuestionsForSessionBlocks = getQuestionsForSessionBlocks;
// AdminSettings
// Helper pour parser la valeur d'un adminSetting
const parseAdminSettingValue = (value) => {
    if (value === null || value === undefined)
        return undefined;
    try {
        return JSON.parse(value);
    }
    catch (e) {
        // Si ce n'est pas du JSON valide, retourner la chaîne brute
        return value;
    }
};
const getAdminSetting = (key) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("SELECT value FROM adminSettings WHERE key = ?");
            const row = stmt.get(key);
            return row ? parseAdminSettingValue(row.value) : undefined;
        }
        catch (error) {
            console.error(`[DB AdminSettings] Error getting setting ${key}:`, error);
            throw error;
        }
    });
});
exports.getAdminSetting = getAdminSetting;
const setAdminSetting = (key, value) => __awaiter(void 0, void 0, void 0, function* () {
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
        }
        catch (error) {
            console.error(`[DB AdminSettings] Error setting setting ${key}:`, error);
            throw error;
        }
    });
});
exports.setAdminSetting = setAdminSetting;
const getAllAdminSettings = () => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("SELECT key, value FROM adminSettings");
            const rows = stmt.all();
            return rows.map(row => ({
                key: row.key,
                value: parseAdminSettingValue(row.value),
            }));
        }
        catch (error) {
            console.error(`[DB AdminSettings] Error getting all settings:`, error);
            throw error;
        }
    });
});
exports.getAllAdminSettings = getAllAdminSettings;
const getGlobalPptxTemplate = () => __awaiter(void 0, void 0, void 0, function* () {
    console.warn("[DB AdminSettings] getGlobalPptxTemplate: Returning null. Logic to fetch/construct File object from path/blob is outside direct DB scope for now.");
    // Potentiellement:
    // const filePath = await getAdminSetting('globalPptxTemplatePath');
    // if (filePath && typeof filePath === 'string') {
    //   // Logique pour créer un objet File ou retourner le chemin
    //   // Pour l'instant, on ne fait rien de plus.
    // }
    return Promise.resolve(null);
});
exports.getGlobalPptxTemplate = getGlobalPptxTemplate;
// Sessions
const JSON_SESSION_FIELDS = [
    'selectedBlocIds', 'questionMappings', 'ignoredSlideGuids',
    'resolvedImportAnomalies', 'participants'
];
const rowToSession = (row) => {
    if (!row)
        return undefined;
    const session = Object.assign({}, row);
    for (const field of JSON_SESSION_FIELDS) {
        if (session[field] && typeof session[field] === 'string') {
            try {
                session[field] = JSON.parse(session[field]);
            }
            catch (e) {
                console.error(`[DB Sessions] Failed to parse JSON field ${field} for session id ${row.id}:`, e);
                // Conserver la chaîne brute ou mettre à null/undefined selon la politique de gestion d'erreur
                // Pour l'instant, on garde la chaîne brute si le parsing échoue, mais idéalement, ça ne devrait pas arriver.
            }
        }
        else if (session[field] === null && (field === 'selectedBlocIds' || field === 'ignoredSlideGuids' || field === 'participants')) {
            // Pour les champs qui sont des tableaux, s'assurer qu'ils sont des tableaux vides si null en DB,
            // plutôt que null, pour la cohérence du type.
            // questionMappings et resolvedImportAnomalies peuvent être null/undefined s'ils ne sont pas définis.
            session[field] = [];
        }
    }
    // Les champs comme referentielId, selectedKitId, trainerId sont des FK et restent des nombres.
    // dateSession et createdAt sont des TEXT ISO8601, pas de conversion nécessaire ici.
    return session;
};
const sessionToRow = (session) => {
    const rowData = Object.assign({}, session);
    for (const field of JSON_SESSION_FIELDS) {
        if (rowData[field] !== undefined) {
            rowData[field] = JSON.stringify(rowData[field]);
        }
    }
    // Supprimer 'id' si présent et qu'on ne veut pas l'utiliser dans un SET par exemple
    if ('id' in rowData && !Object.prototype.hasOwnProperty.call(session, 'id')) {
        delete rowData.id;
    }
    return rowData;
};
const addSession = (session) => __awaiter(void 0, void 0, void 0, function* () {
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
            return result.lastInsertRowid;
        }
        catch (error) {
            console.error(`[DB Sessions] Error adding session:`, error);
            throw error;
        }
    });
});
exports.addSession = addSession;
const getAllSessions = () => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("SELECT * FROM sessions ORDER BY dateSession DESC, createdAt DESC");
            const rows = stmt.all();
            return rows.map(rowToSession);
        }
        catch (error) {
            console.error(`[DB Sessions] Error getting all sessions:`, error);
            throw error;
        }
    });
});
exports.getAllSessions = getAllSessions;
const getSessionById = (id) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("SELECT * FROM sessions WHERE id = ?");
            const row = stmt.get(id);
            return row ? rowToSession(row) : undefined;
        }
        catch (error) {
            console.error(`[DB Sessions] Error getting session by id ${id}:`, error);
            throw error;
        }
    });
});
exports.getSessionById = getSessionById;
const updateSession = (id, updates) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const rowUpdates = sessionToRow(updates);
            const fields = Object.keys(rowUpdates).filter(key => key !== 'id');
            if (fields.length === 0)
                return 0;
            const setClause = fields.map(field => `${field} = @${field}`).join(', ');
            const stmt = getDb().prepare(`UPDATE sessions SET ${setClause} WHERE id = @id`);
            const result = stmt.run(Object.assign(Object.assign({}, rowUpdates), { id }));
            return result.changes;
        }
        catch (error) {
            console.error(`[DB Sessions] Error updating session ${id}:`, error);
            throw error;
        }
    });
});
exports.updateSession = updateSession;
const deleteSession = (id) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            // Les tables sessionResults, sessionQuestions, sessionBoitiers devraient être nettoyées
            // par ON DELETE CASCADE défini dans le schéma.
            const stmt = getDb().prepare("DELETE FROM sessions WHERE id = ?");
            stmt.run(id);
        }
        catch (error) {
            console.error(`[DB Sessions] Error deleting session ${id}:`, error);
            throw error;
        }
    });
});
exports.deleteSession = deleteSession;
// SessionResults
const rowToSessionResult = (row) => {
    if (!row)
        return undefined;
    const result = Object.assign({}, row);
    if (result.answer && typeof result.answer === 'string') {
        try {
            result.answer = JSON.parse(result.answer);
        }
        catch (e) {
            // Si ce n'est pas du JSON, c'est probablement une réponse simple (chaîne)
            // Laisser tel quel.
        }
    }
    result.isCorrect = result.isCorrect === 1;
    // timestamp est un INTEGER (Unix timestamp), pas de conversion nécessaire.
    return result;
};
const sessionResultToRow = (sessionResult) => {
    const rowData = Object.assign({}, sessionResult);
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
const addSessionResult = (result) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare(`
        INSERT INTO sessionResults (sessionId, questionId, participantIdBoitier, answer, isCorrect, pointsObtained, timestamp)
        VALUES (@sessionId, @questionId, @participantIdBoitier, @answer, @isCorrect, @pointsObtained, @timestamp)
      `);
            const rowData = sessionResultToRow(result);
            const res = stmt.run(rowData);
            return res.lastInsertRowid;
        }
        catch (error) {
            console.error(`[DB SessionResults] Error adding session result:`, error);
            throw error;
        }
    });
});
exports.addSessionResult = addSessionResult;
const addBulkSessionResults = (results) => __awaiter(void 0, void 0, void 0, function* () {
    if (!results || results.length === 0)
        return Promise.resolve([]);
    return asyncDbRun(() => {
        const insertedIds = [];
        const insertStmt = getDb().prepare(`
      INSERT INTO sessionResults (sessionId, questionId, participantIdBoitier, answer, isCorrect, pointsObtained, timestamp)
      VALUES (@sessionId, @questionId, @participantIdBoitier, @answer, @isCorrect, @pointsObtained, @timestamp)
    `);
        const transaction = getDb().transaction((items) => {
            for (const result of items) {
                try {
                    const rowData = sessionResultToRow(result);
                    const res = insertStmt.run(rowData);
                    insertedIds.push(res.lastInsertRowid);
                }
                catch (error) {
                    console.error(`[DB SessionResults] Error in bulk adding session result for item:`, result, error);
                    // En cas d'erreur sur un item, on peut choisir d'arrêter ou de continuer.
                    // Ici, la transaction sera annulée par défaut si une erreur est levée.
                    // Si on veut continuer et juste logger l'erreur, il faudrait un try/catch interne.
                    // Pour l'instant, on laisse la transaction échouer en cas d'erreur.
                    insertedIds.push(undefined); // Marquer l'échec pour cet item
                    throw error; // Important pour annuler la transaction
                }
            }
        });
        try {
            transaction(results);
            return insertedIds;
        }
        catch (error) {
            // L'erreur a déjà été loggée dans la transaction ou par asyncDbRun
            // Retourner un tableau avec des undefined pour les échecs si la transaction a été partiellement tentée
            // ou simplement undefined si la transaction entière a échoué tôt.
            // Étant donné que la transaction s'annule, il est plus probable que rien ne soit réellement inséré.
            // Dexie retournait `Promise<Key[] | undefined>`, donc `undefined` est une option.
            // Pour être plus précis, on pourrait retourner un tableau de la même longueur que `results`
            // avec `undefined` pour chaque item si la transaction échoue.
            console.error(`[DB SessionResults] Bulk add transaction failed.`);
            return undefined;
        }
    });
});
exports.addBulkSessionResults = addBulkSessionResults;
const getAllResults = () => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("SELECT * FROM sessionResults");
            const rows = stmt.all();
            return rows.map(rowToSessionResult);
        }
        catch (error) {
            console.error(`[DB SessionResults] Error getting all results:`, error);
            throw error;
        }
    });
});
exports.getAllResults = getAllResults;
const getResultsForSession = (sessionId) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("SELECT * FROM sessionResults WHERE sessionId = ? ORDER BY timestamp ASC");
            const rows = stmt.all(sessionId);
            return rows.map(rowToSessionResult);
        }
        catch (error) {
            console.error(`[DB SessionResults] Error getting results for session ${sessionId}:`, error);
            throw error;
        }
    });
});
exports.getResultsForSession = getResultsForSession;
const getResultBySessionAndQuestion = (sessionId, questionId, participantIdBoitier) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("SELECT * FROM sessionResults WHERE sessionId = ? AND questionId = ? AND participantIdBoitier = ?");
            const row = stmt.get(sessionId, questionId, participantIdBoitier);
            return row ? rowToSessionResult(row) : undefined;
        }
        catch (error) {
            console.error(`[DB SessionResults] Error getting result for session ${sessionId}, question ${questionId}, boitier ${participantIdBoitier}:`, error);
            throw error;
        }
    });
});
exports.getResultBySessionAndQuestion = getResultBySessionAndQuestion;
const updateSessionResult = (id, updates) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const rowUpdates = sessionResultToRow(updates);
            const fields = Object.keys(rowUpdates).filter(key => key !== 'id');
            if (fields.length === 0)
                return 0;
            const setClause = fields.map(field => `${field} = @${field}`).join(', ');
            const stmt = getDb().prepare(`UPDATE sessionResults SET ${setClause} WHERE id = @id`);
            const result = stmt.run(Object.assign(Object.assign({}, rowUpdates), { id }));
            return result.changes;
        }
        catch (error) {
            console.error(`[DB SessionResults] Error updating session result ${id}:`, error);
            throw error;
        }
    });
});
exports.updateSessionResult = updateSessionResult;
const deleteResultsForSession = (sessionId) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("DELETE FROM sessionResults WHERE sessionId = ?");
            stmt.run(sessionId);
        }
        catch (error) {
            console.error(`[DB SessionResults] Error deleting results for session ${sessionId}:`, error);
            throw error;
        }
    });
});
exports.deleteResultsForSession = deleteResultsForSession;
// VotingDevices
const addVotingDevice = (device) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("INSERT INTO votingDevices (name, serialNumber) VALUES (@name, @serialNumber)");
            const result = stmt.run(device);
            return result.lastInsertRowid;
        }
        catch (error) {
            console.error(`[DB VotingDevices] Error adding voting device:`, error);
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                throw new Error(`Voting device with serial number ${device.serialNumber} already exists.`);
            }
            throw error;
        }
    });
});
exports.addVotingDevice = addVotingDevice;
const getAllVotingDevices = () => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("SELECT * FROM votingDevices ORDER BY name ASC, serialNumber ASC");
            const devices = stmt.all();
            console.log(`[DB VotingDevices] getAllVotingDevices returned: ${devices.length} devices`, devices);
            return devices;
        }
        catch (error) {
            console.error(`[DB VotingDevices] Error getting all voting devices:`, error);
            throw error;
        }
    });
});
exports.getAllVotingDevices = getAllVotingDevices;
const updateVotingDevice = (id, updates) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const fields = Object.keys(updates).filter(key => key !== 'id' && updates[key] !== undefined);
            if (fields.length === 0)
                return 0;
            const setClause = fields.map(field => `${field} = @${field}`).join(', ');
            const stmt = getDb().prepare(`UPDATE votingDevices SET ${setClause} WHERE id = @id`);
            const params = { id };
            for (const field of fields) {
                params[field] = updates[field];
            }
            const result = stmt.run(params);
            return result.changes;
        }
        catch (error) {
            console.error(`[DB VotingDevices] Error updating voting device ${id}:`, error);
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' && updates.serialNumber) {
                throw new Error(`Voting device with serial number ${updates.serialNumber} already exists.`);
            }
            throw error;
        }
    });
});
exports.updateVotingDevice = updateVotingDevice;
const deleteVotingDevice = (id) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            // ON DELETE CASCADE sur deviceKitAssignments.votingDeviceId devrait gérer les affectations.
            const stmt = getDb().prepare("DELETE FROM votingDevices WHERE id = ?");
            stmt.run(id);
        }
        catch (error) {
            console.error(`[DB VotingDevices] Error deleting voting device ${id}:`, error);
            throw error;
        }
    });
});
exports.deleteVotingDevice = deleteVotingDevice;
const bulkAddVotingDevices = (devices) => __awaiter(void 0, void 0, void 0, function* () {
    if (!devices || devices.length === 0)
        return Promise.resolve();
    return asyncDbRun(() => {
        const insertStmt = getDb().prepare("INSERT OR IGNORE INTO votingDevices (name, serialNumber) VALUES (@name, @serialNumber)");
        // Utilisation de "INSERT OR IGNORE" pour éviter les erreurs si un serialNumber existe déjà.
        // Cela signifie que les doublons basés sur serialNumber seront ignorés silencieusement.
        // Si un comportement différent est souhaité (ex: lever une erreur pour le lot), il faudrait ajuster.
        const transaction = getDb().transaction((items) => {
            for (const device of items) {
                try {
                    insertStmt.run(device);
                }
                catch (error) {
                    // Normalement, INSERT OR IGNORE devrait prévenir les erreurs SQLITE_CONSTRAINT_UNIQUE.
                    // Mais on garde un catch pour d'autres erreurs potentielles.
                    console.error(`[DB VotingDevices] Error in bulk adding voting device for item:`, device, error);
                    throw error; // Annule la transaction si une erreur inattendue survient.
                }
            }
        });
        try {
            transaction(devices);
        }
        catch (error) {
            // L'erreur a déjà été loggée.
            console.error(`[DB VotingDevices] Bulk add transaction failed overall.`);
            // On ne retourne rien (void) comme spécifié, mais on propage l'erreur pour que l'appelant soit notifié.
            throw error;
        }
    });
});
exports.bulkAddVotingDevices = bulkAddVotingDevices;
// Trainers
const addTrainer = (trainer) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare(`
        INSERT INTO trainers (name, isDefault)
        VALUES (@name, @isDefault)
      `);
            // Assurer que isDefault est bien 0 ou 1 si non fourni explicitement
            const isDefault = trainer.isDefault ? 1 : 0;
            const result = stmt.run(Object.assign(Object.assign({}, trainer), { isDefault }));
            return result.lastInsertRowid;
        }
        catch (error) {
            console.error(`[DB Trainers] Error adding trainer:`, error);
            throw error;
        }
    });
});
exports.addTrainer = addTrainer;
const getAllTrainers = () => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("SELECT * FROM trainers");
            const trainers = stmt.all();
            // Convertir isDefault en booléen pour la logique applicative si nécessaire (ici on garde 0/1 comme dans le schéma)
            return trainers.map(t => (Object.assign(Object.assign({}, t), { isDefault: t.isDefault === 1 })));
        }
        catch (error) {
            console.error(`[DB Trainers] Error getting all trainers:`, error);
            throw error;
        }
    });
});
exports.getAllTrainers = getAllTrainers;
const getTrainerById = (id) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("SELECT * FROM trainers WHERE id = ?");
            const trainer = stmt.get(id);
            if (trainer) {
                return Object.assign(Object.assign({}, trainer), { isDefault: trainer.isDefault === 1 });
            }
            return undefined;
        }
        catch (error) {
            console.error(`[DB Trainers] Error getting trainer by id ${id}:`, error);
            throw error;
        }
    });
});
exports.getTrainerById = getTrainerById;
const updateTrainer = (id, updates) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const fields = Object.keys(updates).filter(key => key !== 'id'); // Exclure 'id' des champs à mettre à jour
            if (fields.length === 0)
                return 0; // Pas de champs à mettre à jour
            const setClause = fields.map(field => `${field} = @${field}`).join(', ');
            const stmt = getDb().prepare(`UPDATE trainers SET ${setClause} WHERE id = @id`);
            // Assurer que isDefault est 0 ou 1 si présent dans updates
            const params = Object.assign(Object.assign({}, updates), { id });
            if (updates.isDefault !== undefined) {
                params.isDefault = updates.isDefault ? 1 : 0;
            }
            const result = stmt.run(params);
            return result.changes; // Nombre de lignes modifiées
        }
        catch (error) {
            console.error(`[DB Trainers] Error updating trainer ${id}:`, error);
            throw error;
        }
    });
});
exports.updateTrainer = updateTrainer;
const deleteTrainer = (id) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("DELETE FROM trainers WHERE id = ?");
            stmt.run(id);
        }
        catch (error) {
            console.error(`[DB Trainers] Error deleting trainer ${id}:`, error);
            throw error;
        }
    });
});
exports.deleteTrainer = deleteTrainer;
const setDefaultTrainer = (id) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        const transaction = getDb().transaction(() => {
            try {
                const resetStmt = getDb().prepare("UPDATE trainers SET isDefault = 0 WHERE isDefault = 1");
                resetStmt.run();
                const setStmt = getDb().prepare("UPDATE trainers SET isDefault = 1 WHERE id = ?");
                const result = setStmt.run(id);
                if (result.changes === 0) {
                    console.warn(`[DB Trainers] setDefaultTrainer: Trainer with id ${id} not found or no change made.`);
                }
            }
            catch (error) {
                console.error(`[DB Trainers] Error setting default trainer ${id}:`, error);
                throw error; // Annule la transaction
            }
        });
        transaction();
    });
});
exports.setDefaultTrainer = setDefaultTrainer;
const getDefaultTrainer = () => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("SELECT * FROM trainers WHERE isDefault = 1 LIMIT 1");
            const trainer = stmt.get();
            if (trainer) {
                return Object.assign(Object.assign({}, trainer), { isDefault: true }); // Assure que isDefault est un booléen
            }
            return undefined;
        }
        catch (error) {
            console.error(`[DB Trainers] Error getting default trainer:`, error);
            throw error;
        }
    });
});
exports.getDefaultTrainer = getDefaultTrainer;
// SessionQuestions
const addSessionQuestion = (sq) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare(`
        INSERT INTO sessionQuestions (sessionId, dbQuestionId, slideGuid, blockId)
        VALUES (@sessionId, @dbQuestionId, @slideGuid, @blockId)
      `);
            const result = stmt.run(sq);
            return result.lastInsertRowid;
        }
        catch (error) {
            console.error(`[DB SessionQuestions] Error adding session question:`, error);
            throw error;
        }
    });
});
exports.addSessionQuestion = addSessionQuestion;
const addBulkSessionQuestions = (questions) => __awaiter(void 0, void 0, void 0, function* () {
    if (!questions || questions.length === 0)
        return Promise.resolve([]);
    return asyncDbRun(() => {
        const insertedIds = [];
        const insertStmt = getDb().prepare(`
      INSERT INTO sessionQuestions (sessionId, dbQuestionId, slideGuid, blockId)
      VALUES (@sessionId, @dbQuestionId, @slideGuid, @blockId)
    `);
        const transaction = getDb().transaction((items) => {
            for (const question of items) {
                try {
                    const result = insertStmt.run(question);
                    insertedIds.push(result.lastInsertRowid);
                }
                catch (error) {
                    console.error(`[DB SessionQuestions] Error in bulk adding session question for item:`, question, error);
                    insertedIds.push(undefined);
                    throw error; // Rollback transaction
                }
            }
        });
        try {
            transaction(questions);
            return insertedIds;
        }
        catch (error) {
            console.error(`[DB SessionQuestions] Bulk add transaction failed.`);
            return undefined; // Ou retourner le tableau `insertedIds` partiellement rempli si on ne relance pas l'erreur dans la boucle
        }
    });
});
exports.addBulkSessionQuestions = addBulkSessionQuestions;
const getSessionQuestionsBySessionId = (sessionId) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("SELECT * FROM sessionQuestions WHERE sessionId = ?");
            // Il pourrait être utile de trier, par exemple par ID ou un autre critère si l'ordre est important.
            // Pour l'instant, pas de tri explicite.
            return stmt.all(sessionId);
        }
        catch (error) {
            console.error(`[DB SessionQuestions] Error getting session questions for session ${sessionId}:`, error);
            throw error;
        }
    });
});
exports.getSessionQuestionsBySessionId = getSessionQuestionsBySessionId;
const deleteSessionQuestionsBySessionId = (sessionId) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("DELETE FROM sessionQuestions WHERE sessionId = ?");
            stmt.run(sessionId);
        }
        catch (error) {
            console.error(`[DB SessionQuestions] Error deleting session questions for session ${sessionId}:`, error);
            throw error;
        }
    });
});
exports.deleteSessionQuestionsBySessionId = deleteSessionQuestionsBySessionId;
// SessionBoitiers
const addSessionBoitier = (sb) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare(`
        INSERT INTO sessionBoitiers (sessionId, participantId, visualId, serialNumber)
        VALUES (@sessionId, @participantId, @visualId, @serialNumber)
      `);
            const result = stmt.run(sb);
            return result.lastInsertRowid;
        }
        catch (error) {
            console.error(`[DB SessionBoitiers] Error adding session boitier:`, error);
            // Potentielle contrainte UNIQUE à vérifier si on en ajoute une sur (sessionId, serialNumber) ou (sessionId, participantId)
            throw error;
        }
    });
});
exports.addSessionBoitier = addSessionBoitier;
const addBulkSessionBoitiers = (boitiers) => __awaiter(void 0, void 0, void 0, function* () {
    if (!boitiers || boitiers.length === 0)
        return Promise.resolve([]);
    return asyncDbRun(() => {
        const insertedIds = [];
        const insertStmt = getDb().prepare(`
      INSERT INTO sessionBoitiers (sessionId, participantId, visualId, serialNumber)
      VALUES (@sessionId, @participantId, @visualId, @serialNumber)
    `);
        const transaction = getDb().transaction((items) => {
            for (const boitier of items) {
                try {
                    const result = insertStmt.run(boitier);
                    insertedIds.push(result.lastInsertRowid);
                }
                catch (error) {
                    console.error(`[DB SessionBoitiers] Error in bulk adding session boitier for item:`, boitier, error);
                    insertedIds.push(undefined);
                    throw error; // Rollback transaction
                }
            }
        });
        try {
            transaction(boitiers);
            return insertedIds;
        }
        catch (error) {
            console.error(`[DB SessionBoitiers] Bulk add transaction failed.`);
            return undefined;
        }
    });
});
exports.addBulkSessionBoitiers = addBulkSessionBoitiers;
const getSessionBoitiersBySessionId = (sessionId) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("SELECT * FROM sessionBoitiers WHERE sessionId = ? ORDER BY visualId ASC, participantId ASC");
            return stmt.all(sessionId);
        }
        catch (error) {
            console.error(`[DB SessionBoitiers] Error getting session boitiers for session ${sessionId}:`, error);
            throw error;
        }
    });
});
exports.getSessionBoitiersBySessionId = getSessionBoitiersBySessionId;
const deleteSessionBoitiersBySessionId = (sessionId) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("DELETE FROM sessionBoitiers WHERE sessionId = ?");
            stmt.run(sessionId);
        }
        catch (error) {
            console.error(`[DB SessionBoitiers] Error deleting session boitiers for session ${sessionId}:`, error);
            throw error;
        }
    });
});
exports.deleteSessionBoitiersBySessionId = deleteSessionBoitiersBySessionId;
// Referentiels
const addReferential = (referential) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare(`
        INSERT INTO referentiels (code, nom_complet)
        VALUES (@code, @nom_complet)
      `);
            const result = stmt.run(referential);
            return result.lastInsertRowid;
        }
        catch (error) {
            console.error(`[DB Referentiels] Error adding referential:`, error);
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                // Optionnel: gérer spécifiquement les erreurs d'unicité ou les laisser remonter
                throw new Error(`Referential with code ${referential.code} already exists.`);
            }
            throw error; // Renvoyer l'erreur pour que asyncDbRun la capture
        }
    });
});
exports.addReferential = addReferential;
const getAllReferentiels = () => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("SELECT * FROM referentiels");
            const referentiels = stmt.all();
            return referentiels;
        }
        catch (error) {
            console.error(`[DB Referentiels] Error getting all referentiels:`, error);
            throw error;
        }
    });
});
exports.getAllReferentiels = getAllReferentiels;
const getReferentialByCode = (code) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("SELECT * FROM referentiels WHERE code = ?");
            const referential = stmt.get(code);
            return referential;
        }
        catch (error) {
            console.error(`[DB Referentiels] Error getting referential by code ${code}:`, error);
            throw error;
        }
    });
});
exports.getReferentialByCode = getReferentialByCode;
const getReferentialById = (id) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("SELECT * FROM referentiels WHERE id = ?");
            const referential = stmt.get(id);
            return referential;
        }
        catch (error) {
            console.error(`[DB Referentiels] Error getting referential by id ${id}:`, error);
            throw error;
        }
    });
});
exports.getReferentialById = getReferentialById;
// Themes
const addTheme = (theme) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare(`
        INSERT INTO themes (code_theme, nom_complet, referentiel_id)
        VALUES (@code_theme, @nom_complet, @referentiel_id)
      `);
            const result = stmt.run(theme);
            return result.lastInsertRowid;
        }
        catch (error) {
            console.error(`[DB Themes] Error adding theme:`, error);
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                throw new Error(`Theme with code ${theme.code_theme} already exists for referential ${theme.referentiel_id}.`);
            }
            throw error;
        }
    });
});
exports.addTheme = addTheme;
const getAllThemes = () => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("SELECT * FROM themes");
            return stmt.all();
        }
        catch (error) {
            console.error(`[DB Themes] Error getting all themes:`, error);
            throw error;
        }
    });
});
exports.getAllThemes = getAllThemes;
const getThemesByReferentialId = (referentialId) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("SELECT * FROM themes WHERE referentiel_id = ?");
            return stmt.all(referentialId);
        }
        catch (error) {
            console.error(`[DB Themes] Error getting themes by referentialId ${referentialId}:`, error);
            throw error;
        }
    });
});
exports.getThemesByReferentialId = getThemesByReferentialId;
const getThemeByCodeAndReferentialId = (code_theme, referentiel_id) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("SELECT * FROM themes WHERE code_theme = ? AND referentiel_id = ?");
            return stmt.get(code_theme, referentiel_id);
        }
        catch (error) {
            console.error(`[DB Themes] Error getting theme by code ${code_theme} and referentialId ${referentiel_id}:`, error);
            throw error;
        }
    });
});
exports.getThemeByCodeAndReferentialId = getThemeByCodeAndReferentialId;
const getThemeById = (id) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("SELECT * FROM themes WHERE id = ?");
            return stmt.get(id);
        }
        catch (error) {
            console.error(`[DB Themes] Error getting theme by id ${id}:`, error);
            throw error;
        }
    });
});
exports.getThemeById = getThemeById;
// Blocs
const addBloc = (bloc) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare(`
        INSERT INTO blocs (code_bloc, nom_complet, theme_id)
        VALUES (@code_bloc, @nom_complet, @theme_id)
      `);
            const result = stmt.run(bloc);
            return result.lastInsertRowid;
        }
        catch (error) {
            console.error(`[DB Blocs] Error adding bloc:`, error);
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                throw new Error(`Bloc with code ${bloc.code_bloc} already exists for theme ${bloc.theme_id}.`);
            }
            throw error;
        }
    });
});
exports.addBloc = addBloc;
const getAllBlocs = () => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("SELECT * FROM blocs");
            return stmt.all();
        }
        catch (error) {
            console.error(`[DB Blocs] Error getting all blocs:`, error);
            throw error;
        }
    });
});
exports.getAllBlocs = getAllBlocs;
const getBlocsByThemeId = (themeId) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("SELECT * FROM blocs WHERE theme_id = ?");
            return stmt.all(themeId);
        }
        catch (error) {
            console.error(`[DB Blocs] Error getting blocs by themeId ${themeId}:`, error);
            throw error;
        }
    });
});
exports.getBlocsByThemeId = getBlocsByThemeId;
const getBlocByCodeAndThemeId = (code_bloc, theme_id) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("SELECT * FROM blocs WHERE code_bloc = ? AND theme_id = ?");
            return stmt.get(code_bloc, theme_id);
        }
        catch (error) {
            console.error(`[DB Blocs] Error getting bloc by code ${code_bloc} and themeId ${theme_id}:`, error);
            throw error;
        }
    });
});
exports.getBlocByCodeAndThemeId = getBlocByCodeAndThemeId;
const getBlocById = (id) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("SELECT * FROM blocs WHERE id = ?");
            return stmt.get(id);
        }
        catch (error) {
            console.error(`[DB Blocs] Error getting bloc by id ${id}:`, error);
            throw error;
        }
    });
});
exports.getBlocById = getBlocById;
// DeviceKits
// Helper pour convertir la valeur de isDefault (0/1) en booléen pour la logique applicative
const rowToDeviceKit = (row) => {
    if (!row)
        return undefined;
    return Object.assign(Object.assign({}, row), { isDefault: row.isDefault === 1 });
};
const addDeviceKit = (kit) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            console.log(`[DB DeviceKits] Attempting to add device kit:`, kit);
            const stmt = getDb().prepare("INSERT INTO deviceKits (name, isDefault) VALUES (@name, @isDefault)");
            const isDefault = kit.isDefault ? 1 : 0;
            const result = stmt.run(Object.assign(Object.assign({}, kit), { isDefault }));
            console.log(`[DB DeviceKits] Successfully added device kit with ID: ${result.lastInsertRowid}`);
            return result.lastInsertRowid;
        }
        catch (error) {
            console.error(`[DB DeviceKits] Error adding device kit:`, error);
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                throw new Error(`Device kit with name ${kit.name} already exists.`);
            }
            throw error;
        }
    });
});
exports.addDeviceKit = addDeviceKit;
const getAllDeviceKits = () => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("SELECT * FROM deviceKits ORDER BY name ASC");
            const rows = stmt.all();
            return rows.map(rowToDeviceKit);
        }
        catch (error) {
            console.error(`[DB DeviceKits] Error getting all device kits:`, error);
            throw error;
        }
    });
});
exports.getAllDeviceKits = getAllDeviceKits;
const getDeviceKitById = (id) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("SELECT * FROM deviceKits WHERE id = ?");
            const row = stmt.get(id);
            return row ? rowToDeviceKit(row) : undefined;
        }
        catch (error) {
            console.error(`[DB DeviceKits] Error getting device kit by id ${id}:`, error);
            throw error;
        }
    });
});
exports.getDeviceKitById = getDeviceKitById;
const updateDeviceKit = (id, updates) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const fields = Object.keys(updates).filter(key => key !== 'id');
            if (fields.length === 0)
                return 0;
            const setClause = fields.map(field => `${field} = @${field}`).join(', ');
            const stmt = getDb().prepare(`UPDATE deviceKits SET ${setClause} WHERE id = @id`);
            const params = Object.assign(Object.assign({}, updates), { id });
            if (updates.isDefault !== undefined) {
                params.isDefault = updates.isDefault ? 1 : 0;
            }
            const result = stmt.run(params);
            return result.changes;
        }
        catch (error) {
            console.error(`[DB DeviceKits] Error updating device kit ${id}:`, error);
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' && updates.name) {
                throw new Error(`Device kit with name ${updates.name} already exists.`);
            }
            throw error;
        }
    });
});
exports.updateDeviceKit = updateDeviceKit;
const deleteDeviceKit = (id) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            // ON DELETE CASCADE sur deviceKitAssignments.kitId devrait gérer les affectations.
            const stmt = getDb().prepare("DELETE FROM deviceKits WHERE id = ?");
            stmt.run(id);
        }
        catch (error) {
            console.error(`[DB DeviceKits] Error deleting device kit ${id}:`, error);
            throw error;
        }
    });
});
exports.deleteDeviceKit = deleteDeviceKit;
const getDefaultDeviceKit = () => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("SELECT * FROM deviceKits WHERE isDefault = 1 LIMIT 1");
            const row = stmt.get();
            return row ? rowToDeviceKit(row) : undefined;
        }
        catch (error) {
            console.error(`[DB DeviceKits] Error getting default device kit:`, error);
            throw error;
        }
    });
});
exports.getDefaultDeviceKit = getDefaultDeviceKit;
const setDefaultDeviceKit = (kitId) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        const transaction = getDb().transaction(() => {
            try {
                const resetStmt = getDb().prepare("UPDATE deviceKits SET isDefault = 0 WHERE isDefault = 1");
                resetStmt.run();
                const setStmt = getDb().prepare("UPDATE deviceKits SET isDefault = 1 WHERE id = ?");
                const result = setStmt.run(kitId);
                if (result.changes === 0) {
                    console.warn(`[DB DeviceKits] setDefaultDeviceKit: Kit with id ${kitId} not found or no change made.`);
                    // On pourrait vouloir lever une erreur ici si le kitId n'est pas trouvé,
                    // mais pour l'instant, on garde un comportement silencieux si pas de changement.
                }
                // La fonction originale retournait void, donc on ne retourne rien ici non plus.
            }
            catch (error) {
                console.error(`[DB DeviceKits] Error setting default device kit ${kitId}:`, error);
                throw error; // Annule la transaction
            }
        });
        transaction();
    });
});
exports.setDefaultDeviceKit = setDefaultDeviceKit;
// DeviceKitAssignments
const assignDeviceToKit = (kitId, votingDeviceId) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("INSERT INTO deviceKitAssignments (kitId, votingDeviceId) VALUES (?, ?)");
            const result = stmt.run(kitId, votingDeviceId);
            return result.lastInsertRowid;
        }
        catch (error) {
            console.error(`[DB DeviceKitAssignments] Error assigning device ${votingDeviceId} to kit ${kitId}:`, error);
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                // Cette erreur signifie que l'assignation existe déjà.
                // On peut choisir de la retourner comme un succès silencieux ou de lever une erreur spécifique.
                // Pour l'instant, on la laisse remonter pour que l'appelant soit conscient.
                throw new Error(`Device ${votingDeviceId} is already assigned to kit ${kitId}.`);
            }
            throw error;
        }
    });
});
exports.assignDeviceToKit = assignDeviceToKit;
const removeDeviceFromKit = (kitId, votingDeviceId) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("DELETE FROM deviceKitAssignments WHERE kitId = ? AND votingDeviceId = ?");
            stmt.run(kitId, votingDeviceId);
        }
        catch (error) {
            console.error(`[DB DeviceKitAssignments] Error removing device ${votingDeviceId} from kit ${kitId}:`, error);
            throw error;
        }
    });
});
exports.removeDeviceFromKit = removeDeviceFromKit;
const getVotingDevicesForKit = (kitId) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare(`
        SELECT vd.*
        FROM votingDevices vd
        JOIN deviceKitAssignments dka ON vd.id = dka.votingDeviceId
        WHERE dka.kitId = ?
        ORDER BY vd.name ASC, vd.serialNumber ASC
      `);
            return stmt.all(kitId);
        }
        catch (error) {
            console.error(`[DB DeviceKitAssignments] Error getting voting devices for kit ${kitId}:`, error);
            throw error;
        }
    });
});
exports.getVotingDevicesForKit = getVotingDevicesForKit;
const getKitsForVotingDevice = (votingDeviceId) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare(`
        SELECT dk.*
        FROM deviceKits dk
        JOIN deviceKitAssignments dka ON dk.id = dka.kitId
        WHERE dka.votingDeviceId = ?
        ORDER BY dk.name ASC
      `);
            const rows = stmt.all(votingDeviceId);
            return rows.map(rowToDeviceKit); // Utilise le helper existant pour convertir isDefault
        }
        catch (error) {
            console.error(`[DB DeviceKitAssignments] Error getting kits for voting device ${votingDeviceId}:`, error);
            throw error;
        }
    });
});
exports.getKitsForVotingDevice = getKitsForVotingDevice;
const removeAssignmentsByKitId = (kitId) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("DELETE FROM deviceKitAssignments WHERE kitId = ?");
            stmt.run(kitId);
        }
        catch (error) {
            console.error(`[DB DeviceKitAssignments] Error removing assignments by kitId ${kitId}:`, error);
            throw error;
        }
    });
});
exports.removeAssignmentsByKitId = removeAssignmentsByKitId;
const removeAssignmentsByVotingDeviceId = (votingDeviceId) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("DELETE FROM deviceKitAssignments WHERE votingDeviceId = ?");
            stmt.run(votingDeviceId);
        }
        catch (error) {
            console.error(`[DB DeviceKitAssignments] Error removing assignments by votingDeviceId ${votingDeviceId}:`, error);
            throw error;
        }
    });
});
exports.removeAssignmentsByVotingDeviceId = removeAssignmentsByVotingDeviceId;
const calculateBlockUsage = (startDate, endDate) => __awaiter(void 0, void 0, void 0, function* () {
    return asyncDbRun(() => {
        let query = "SELECT id, dateSession, referentielId, selectedBlocIds FROM sessions WHERE status = 'completed'";
        const params = [];
        if (startDate) {
            query += " AND dateSession >= ?";
            params.push(typeof startDate === 'string' ? startDate : startDate.toISOString());
        }
        if (endDate) {
            query += " AND dateSession <= ?";
            params.push(typeof endDate === 'string' ? endDate : endDate.toISOString());
        }
        const sessionsForBlockUsage = getDb().prepare(query).all(...params);
        const blockUsageMap = new Map();
        for (const session of sessionsForBlockUsage) {
            if (!session.selectedBlocIds || !session.referentielId) {
                continue;
            }
            let blocIds = [];
            try {
                // selectedBlocIds est stocké comme JSON array de nombres (IDs de blocs)
                const parsedBlocIds = JSON.parse(session.selectedBlocIds);
                if (Array.isArray(parsedBlocIds) && parsedBlocIds.every(id => typeof id === 'number')) {
                    blocIds = parsedBlocIds;
                }
                else {
                    console.warn(`[DB Reports] Session ${session.id} has malformed selectedBlocIds: ${session.selectedBlocIds}`);
                    continue;
                }
            }
            catch (e) {
                console.warn(`[DB Reports] Session ${session.id} failed to parse selectedBlocIds: ${session.selectedBlocIds}`, e);
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
                    const blocDetails = blocInfoStmt.get(blocId, session.referentielId);
                    if (blocDetails) {
                        const key = `${blocDetails.referentiel_code}-${blocDetails.code_theme}-${blocDetails.code_bloc}`;
                        if (blockUsageMap.has(key)) {
                            blockUsageMap.get(key).usageCount++;
                        }
                        else {
                            blockUsageMap.set(key, {
                                referentiel: blocDetails.referentiel_code,
                                theme: blocDetails.code_theme,
                                blockId: blocDetails.code_bloc,
                                usageCount: 1,
                            });
                        }
                    }
                    else {
                        // Ce cas peut arriver si un blocId dans selectedBlocIds n'existe plus
                        // ou n'appartient pas au référentiel de la session.
                        console.warn(`[DB Reports] Block details not found for blocId ${blocId} in referentielId ${session.referentielId} for session ${session.id}`);
                    }
                }
                catch (e) {
                    console.error(`[DB Reports] Error processing blocId ${blocId} for session ${session.id}:`, e);
                }
            }
        }
        return Array.from(blockUsageMap.values());
    });
});
exports.calculateBlockUsage = calculateBlockUsage;
