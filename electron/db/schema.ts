import { getDb, logger } from './index';

export const createSchema = () => {
    logger?.debug("[DB SCHEMA] Attempting to create/verify schema...");
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
        userQuestionId TEXT UNIQUE,
        blocId INTEGER,
        text TEXT NOT NULL,
        type TEXT NOT NULL,
        correctAnswer TEXT,
        timeLimit INTEGER,
        isEliminatory INTEGER DEFAULT 0,
        createdAt TEXT,
        usageCount INTEGER DEFAULT 0,
        correctResponseRate REAL DEFAULT 0,
        slideGuid TEXT,
        options TEXT,
        version TEXT,
        updated_at TEXT,
        FOREIGN KEY (blocId) REFERENCES blocs(id) ON DELETE SET NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_questions_blocId ON questions(blocId);`,
      `CREATE INDEX IF NOT EXISTS idx_questions_userQuestionId ON questions(userQuestionId);`,

      `CREATE TABLE IF NOT EXISTS trainers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        isDefault INTEGER DEFAULT 0
      );`,
      `CREATE INDEX IF NOT EXISTS idx_trainers_isDefault ON trainers(isDefault);`,

      `CREATE TABLE IF NOT EXISTS deviceKits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        isDefault INTEGER DEFAULT 0,
        is_global INTEGER DEFAULT 0
      );`,
      `CREATE INDEX IF NOT EXISTS idx_deviceKits_isDefault ON deviceKits(isDefault);`,

      `CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nomSession TEXT NOT NULL,
        dateSession TEXT NOT NULL,
        referentielId INTEGER,
        selectedBlocIds TEXT,
        selectedKitId INTEGER,
        createdAt TEXT NOT NULL,
        location TEXT,
        status TEXT,
        questionMappings TEXT,
        notes TEXT,
        trainerId INTEGER,
        ignoredSlideGuids TEXT,
        resolvedImportAnomalies TEXT,
        orsFilePath TEXT,
        resultsImportedAt TEXT,
        num_session TEXT,
        num_stage TEXT,
        archived_at TEXT,
        iteration_count INTEGER,
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
        session_iteration_id INTEGER,
        questionId INTEGER NOT NULL,
        participantIdBoitier TEXT NOT NULL,
        participantId INTEGER,
        answer TEXT,
        isCorrect INTEGER,
        pointsObtained INTEGER,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (session_iteration_id) REFERENCES session_iterations(id) ON DELETE CASCADE,
        FOREIGN KEY (questionId) REFERENCES questions(id) ON DELETE CASCADE,
        FOREIGN KEY (participantId) REFERENCES participants(id) ON DELETE SET NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_sessionResults_sessionId ON sessionResults(sessionId);`,
      `CREATE INDEX IF NOT EXISTS idx_sessionResults_questionId ON sessionResults(questionId);`,
      `CREATE INDEX IF NOT EXISTS idx_sessionResults_participantIdBoitier ON sessionResults(participantIdBoitier);`,

      `CREATE TABLE IF NOT EXISTS adminSettings (
        key TEXT PRIMARY KEY,
        value TEXT
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
        dbQuestionId INTEGER NOT NULL,
        slideGuid TEXT,
        blockId TEXT,
        FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (dbQuestionId) REFERENCES questions(id) ON DELETE CASCADE
      );`,
      `CREATE INDEX IF NOT EXISTS idx_sessionQuestions_sessionId ON sessionQuestions(sessionId);`,
      `CREATE INDEX IF NOT EXISTS idx_sessionQuestions_dbQuestionId ON sessionQuestions(dbQuestionId);`,

      `CREATE TABLE IF NOT EXISTS sessionBoitiers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sessionId INTEGER NOT NULL,
        participantId TEXT,
        visualId TEXT,
        serialNumber TEXT NOT NULL,
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
      `CREATE INDEX IF NOT EXISTS idx_deviceKitAssignments_votingDeviceId ON deviceKitAssignments(votingDeviceId);`,

      `CREATE TABLE IF NOT EXISTS session_iterations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        iteration_index INTEGER NOT NULL,
        name TEXT NOT NULL,
        ors_file_path TEXT,
        status TEXT,
        question_mappings TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
        UNIQUE (session_id, iteration_index)
      );`,
      `CREATE INDEX IF NOT EXISTS idx_session_iterations_session_id ON session_iterations(session_id);`,

      `CREATE TABLE IF NOT EXISTS participants (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          organization TEXT,
          identification_code TEXT
      );`,

      `CREATE TABLE IF NOT EXISTS participant_assignments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_iteration_id INTEGER NOT NULL,
          participant_id INTEGER NOT NULL,
          voting_device_id INTEGER NOT NULL,
          kit_id INTEGER NOT NULL,
          status TEXT DEFAULT 'present',
          FOREIGN KEY (session_iteration_id) REFERENCES session_iterations(id) ON DELETE CASCADE,
          FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE,
          FOREIGN KEY (voting_device_id) REFERENCES votingDevices(id) ON DELETE CASCADE,
          FOREIGN KEY (kit_id) REFERENCES deviceKits(id) ON DELETE CASCADE,
          UNIQUE (session_iteration_id, participant_id),
          UNIQUE (session_iteration_id, voting_device_id)
      );`
    ];

    const transaction = getDb().transaction(() => {
      for (const stmt of DDL_STATEMENTS) {
        try {
          getDb().prepare(stmt).run();
        } catch (error) {
          logger?.debug(`[DB SCHEMA] Failed to execute DDL: ${stmt.substring(0,60)}... ${error}`);
          throw error;
        }
      }
    });

    try {
      logger.info('[DB SCHEMA] Executing CREATE TABLE statements...');
      transaction();
      logger.info('[DB SCHEMA] CREATE TABLE statements executed successfully.');

      const db = getDb();
      logger.info('[DB MIGRATION] Starting migration process...');
      const migrationTransaction = db.transaction(() => {
          interface TableInfo { name: string; type: string; cid: number; notnull: number; dflt_value: any; pk: number; }

          logger.debug("[DB MIGRATION] Checking for 'sessions' table migrations...");
          const sessionsColumns = db.pragma('table_info(sessions)') as TableInfo[];
          if (sessionsColumns.some(c => c.name === 'donneesOrs') && !sessionsColumns.some(c => c.name === 'orsFilePath')) {
              db.prepare("ALTER TABLE sessions RENAME COLUMN donneesOrs TO orsFilePath").run();
              logger.info("[DB MIGRATION] Renamed 'donneesOrs' to 'orsFilePath' in 'sessions'.");
          }
          const sessionsColumnsToAdd = [
              { name: 'orsFilePath', type: 'TEXT' }, { name: 'resultsImportedAt', type: 'TEXT' },
              { name: 'updatedAt', type: 'TEXT' }, { name: 'num_session', type: 'TEXT' },
              { name: 'num_stage', type: 'TEXT' }, { name: 'archived_at', type: 'TEXT' },
              { name: 'iteration_count', type: 'INTEGER' }
          ];
          const existingSessionsColNames = sessionsColumns.map(c => c.name);
          for (const column of sessionsColumnsToAdd) {
              if (!existingSessionsColNames.includes(column.name)) {
                  db.prepare(`ALTER TABLE sessions ADD COLUMN ${column.name} ${column.type}`).run();
                  logger.info(`[DB MIGRATION] Added column '${column.name}' to 'sessions'.`);
              }
          }

          logger.debug("[DB MIGRATION] Checking for 'session_iterations' table migrations...");
          const iterColumns = db.pragma('table_info(session_iterations)') as TableInfo[];
          if (!iterColumns.some(c => c.name === 'updated_at')) {
              db.prepare(`ALTER TABLE session_iterations ADD COLUMN updated_at TEXT`).run();
              logger.info(`[DB MIGRATION] Added column 'updated_at' to 'session_iterations'.`);
          }

          logger.debug("[DB MIGRATION] Checking for 'sessionResults' table migrations...");
          const resultsColumns = db.pragma('table_info(sessionResults)') as TableInfo[];
          if (!resultsColumns.some(c => c.name === 'session_iteration_id')) {
              db.prepare(`ALTER TABLE sessionResults ADD COLUMN session_iteration_id INTEGER`).run();
              logger.info(`[DB MIGRATION] Added column 'session_iteration_id' to 'sessionResults'.`);
              db.prepare(`CREATE INDEX IF NOT EXISTS idx_sessionResults_session_iteration_id ON sessionResults(session_iteration_id)`).run();
              logger.info(`[DB MIGRATION] Added index 'idx_sessionResults_session_iteration_id' to 'sessionResults'.`);
          }
          if (!resultsColumns.some(c => c.name === 'participantId')) {
              db.prepare(`ALTER TABLE sessionResults ADD COLUMN participantId INTEGER`).run();
              logger.info(`[DB MIGRATION] Added column 'participantId' to 'sessionResults'.`);
              db.prepare(`CREATE INDEX IF NOT EXISTS idx_sessionResults_participantId ON sessionResults(participantId)`).run();
              logger.info(`[DB MIGRATION] Added index 'idx_sessionResults_participantId' to 'sessionResults'.`);
          }

          logger.debug("[DB MIGRATION] Checking for 'questions' table migrations...");
          const questionsColumns = db.pragma('table_info(questions)') as TableInfo[];
          const existingQuestionsColNames = questionsColumns.map(c => c.name);

          const versionColumn = questionsColumns.find(c => c.name === 'version');
          if (versionColumn && versionColumn.type === 'INTEGER') {
              logger.warn("[DB MIGRATION] Found 'version' column with INTEGER type. This cannot be automatically migrated to TEXT in SQLite. New questions will be stored correctly, but old version data might remain as truncated numbers. Manual data migration may be required for full correction.");
          }

          const questionsColumnsToAdd = [
              { name: 'userQuestionId', type: 'TEXT' }, { name: 'version', type: 'TEXT' },
              { name: 'updated_at', type: 'TEXT' }
          ];
          for (const column of questionsColumnsToAdd) {
              if (!existingQuestionsColNames.includes(column.name)) {
                  db.prepare(`ALTER TABLE questions ADD COLUMN ${column.name} ${column.type}`).run();
                  logger.info(`[DB MIGRATION] Added column '${column.name}' to 'questions'.`);
              }
          }

          logger.debug("[DB MIGRATION] Checking for 'deviceKits' table migrations...");
          const kitsColumns = db.pragma('table_info(deviceKits)') as TableInfo[];
          if (!kitsColumns.some(c => c.name === 'is_global')) {
              db.prepare(`ALTER TABLE deviceKits ADD COLUMN is_global INTEGER`).run();
              logger.info(`[DB MIGRATION] Added column 'is_global' to 'deviceKits'.`);
          }

          logger.debug("[DB MIGRATION] Checking for 'participant_assignments' table migrations...");
          const assignmentsColumns = db.pragma('table_info(participant_assignments)') as TableInfo[];
          if (!assignmentsColumns.some(c => c.name === 'status')) {
              db.prepare(`ALTER TABLE participant_assignments ADD COLUMN status TEXT DEFAULT 'present'`).run();
              logger.info(`[DB MIGRATION] Added column 'status' to 'participant_assignments'.`);
          }

          try {
              logger.debug("[DB MIGRATION] Attempting to drop old unique index on participants.identification_code...");
              db.prepare(`DROP INDEX IF EXISTS sqlite_autoindex_participants_1`).run();
              logger.info("[DB MIGRATION] Successfully dropped old unique index on participants.identification_code (if it existed).");
          } catch (error) {
              logger.warn(`[DB MIGRATION] Could not drop unique index on participants (this is likely okay if it never existed): ${error}`);
          }
      });

      try {
          migrationTransaction();
          logger.info("[DB MIGRATION] Migration transaction executed successfully.");
      } catch (error) {
          logger.error(`[DB MIGRATION] A migration failed: ${error}. Transaction was rolled back.`);
          throw error;
      }

    } catch(error) {
      logger.error(`[DB SCHEMA] Initial DDL transaction failed. No changes were applied. ${error}`);
      throw error;
    }
  };
