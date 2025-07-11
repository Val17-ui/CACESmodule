// src/db.ts
import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import { app } from 'electron';
import path from 'path';
import {
  CACESReferential,
  Session,
  SessionResult,
  Trainer,
  SessionQuestion,
  SessionBoitier,
  Referential,
  Theme,
  Bloc,
  QuestionWithId,
  VotingDevice,
  DeviceKit,
  DeviceKitAssignment,
  BlockUsage
} from './types';
import { logger } from './utils/logger';

// Initialize SQLite3 database
let db: Database | null = null;

async function initializeDb() {
  if (db) return db;

  // Set database path to userData directory
  const dbPath = path.join(app.getPath('userData'), 'database.sqlite');

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Create tables based on Dexie version 15 schema
  await db.exec(`
    -- Table for questions
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      blocId INTEGER,
      text TEXT NOT NULL,
      type TEXT,
      correctAnswer TEXT,
      timeLimit INTEGER,
      isEliminatory INTEGER,
      createdAt TEXT,
      usageCount INTEGER DEFAULT 0,
      correctResponseRate REAL,
      slideGuid TEXT,
      options TEXT, -- JSON stringified array
      FOREIGN KEY (blocId) REFERENCES blocs(id)
    );

    -- Table for referentiels
    CREATE TABLE IF NOT EXISTS referentiels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      nom_complet TEXT
    );

    -- Table for themes
    CREATE TABLE IF NOT EXISTS themes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code_theme TEXT NOT NULL,
      nom_complet TEXT,
      referentiel_id INTEGER,
      UNIQUE (code_theme, referentiel_id),
      FOREIGN KEY (referentiel_id) REFERENCES referentiels(id)
    );

    -- Table for blocs
    CREATE TABLE IF NOT EXISTS blocs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code_bloc TEXT NOT NULL,
      theme_id INTEGER,
      UNIQUE (code_bloc, theme_id),
      FOREIGN KEY (theme_id) REFERENCES themes(id)
    );

    -- Table for sessions
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nomSession TEXT NOT NULL,
      dateSession TEXT NOT NULL,
      referentielId INTEGER,
      selectedBlocIds TEXT, -- JSON stringified array
      selectedKitId INTEGER,
      createdAt TEXT,
      location TEXT,
      status TEXT CHECK(status IN ('planned', 'ready', 'completed')),
      questionMappings TEXT, -- JSON stringified array
      notes TEXT,
      trainerId INTEGER,
      ignoredSlideGuids TEXT, -- JSON stringified array
      resolvedImportAnomalies TEXT, -- JSON stringified object
      FOREIGN KEY (referentielId) REFERENCES referentiels(id),
      FOREIGN KEY (trainerId) REFERENCES trainers(id),
      FOREIGN KEY (selectedKitId) REFERENCES deviceKits(id)
    );

    -- Table for sessionResults
    CREATE TABLE IF NOT EXISTS sessionResults (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionId INTEGER,
      questionId INTEGER,
      participantIdBoitier TEXT,
      answer TEXT,
      isCorrect INTEGER,
      pointsObtained INTEGER,
      timestamp TEXT,
      FOREIGN KEY (sessionId) REFERENCES sessions(id),
      FOREIGN KEY (questionId) REFERENCES questions(id)
    );

    -- Table for adminSettings
    CREATE TABLE IF NOT EXISTS adminSettings (
      key TEXT PRIMARY KEY,
      value BLOB
    );

    -- Table for votingDevices
    CREATE TABLE IF NOT EXISTS votingDevices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      serialNumber TEXT UNIQUE NOT NULL
    );

    -- Table for trainers
    CREATE TABLE IF NOT EXISTS trainers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      isDefault INTEGER DEFAULT 0
    );

    -- Table for sessionQuestions
    CREATE TABLE IF NOT EXISTS sessionQuestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionId INTEGER,
      dbQuestionId INTEGER,
      slideGuid TEXT,
      blockId INTEGER,
      FOREIGN KEY (sessionId) REFERENCES sessions(id),
      FOREIGN KEY (dbQuestionId) REFERENCES questions(id),
      FOREIGN KEY (blockId) REFERENCES blocs(id)
    );

    -- Table for sessionBoitiers
    CREATE TABLE IF NOT EXISTS sessionBoitiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionId INTEGER,
      participantId TEXT,
      visualId INTEGER,
      serialNumber TEXT,
      FOREIGN KEY (sessionId) REFERENCES sessions(id)
    );

    -- Table for deviceKits
    CREATE TABLE IF NOT EXISTS deviceKits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      isDefault INTEGER DEFAULT 0
    );

    -- Table for deviceKitAssignments
    CREATE TABLE IF NOT EXISTS deviceKitAssignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kitId INTEGER,
      votingDeviceId INTEGER,
      UNIQUE (kitId, votingDeviceId),
      FOREIGN KEY (kitId) REFERENCES deviceKits(id),
      FOREIGN KEY (votingDeviceId) REFERENCES votingDevices(id)
    );
  `);

  // Ensure only one trainer is default
  await db.run(`
    UPDATE trainers
    SET isDefault = 0
    WHERE id NOT IN (
      SELECT id FROM trainers WHERE isDefault = 1 LIMIT 1
    )
  `);

  return db;
}

// Helper function to parse JSON fields
function parseJsonField<T>(value: string | undefined | null): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.error(`Error parsing JSON field:`, error);
    return undefined;
  }
}

// Helper function to serialize JSON fields
function serializeJsonField(value: any): string | null {
  if (value === undefined || value === null) return null;
  try {
    return JSON.stringify(value);
  } catch (error) {
    console.error(`Error serializing JSON field:`, error);
    return null;
  }
}

// CRUD for Questions
export const addQuestion = async (question: QuestionWithId): Promise<number | undefined> => {
  const db = await initializeDb();
  try {
    const { id, blocId, text, type, correctAnswer, timeLimit, isEliminatory, createdAt, usageCount, correctResponseRate, slideGuid, options } = question;
    const result = await db.run(
      `INSERT INTO questions (blocId, text, type, correctAnswer, timeLimit, isEliminatory, createdAt, usageCount, correctResponseRate, slideGuid, options)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        blocId,
        text,
        type,
        correctAnswer,
        timeLimit,
        isEliminatory ? 1 : 0,
        createdAt || new Date().toISOString(),
        usageCount || 0,
        correctResponseRate || 0,
        slideGuid,
        serializeJsonField(options)
      ]
    );
    return result.lastID;
  } catch (error) {
    console.error("Error adding question: ", error);
    return undefined;
  }
};

export const getGlobalPptxTemplate = async (): Promise<File | null> => {
  const db = await initializeDb();
  try {
    const template = await db.get<{ value: Buffer }>('SELECT value FROM adminSettings WHERE key = ?', ['pptxTemplateFile']);
    const fileName = (await db.get<{ value: string }>('SELECT value FROM adminSettings WHERE key = ?', ['pptxTemplateFileName']))?.value || 'template.pptx';
    if (template?.value) {
      return new File([template.value], fileName, { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
    }
    return null;
  } catch (error) {
    console.error("Error getting global PPTX template:", error);
    return null;
  }
};

export const getAllQuestions = async (): Promise<QuestionWithId[]> => {
  const db = await initializeDb();
  try {
    const questions = await db.all<QuestionWithId[]>(
      `SELECT * FROM questions`
    );
    return questions.map(q => ({
      ...q,
      isEliminatory: q.isEliminatory === 1,
      options: parseJsonField(q.options)
    }));
  } catch (error) {
    console.error("Error getting all questions: ", error);
    return [];
  }
};

// CRUD for DeviceKits
export const addDeviceKit = async (kit: Omit<DeviceKit, 'id'>): Promise<number | undefined> => {
  const db = await initializeDb();
  try {
    if (kit.isDefault === 1) {
      await db.run(`UPDATE deviceKits SET isDefault = 0 WHERE isDefault = 1`);
    }
    const result = await db.run(
      `INSERT INTO deviceKits (name, isDefault) VALUES (?, ?)`,
      [kit.name, kit.isDefault || 0]
    );
    return result.lastID;
  } catch (error) {
    console.error("Error adding device kit: ", error);
    throw error;
  }
};

export const getAllDeviceKits = async (): Promise<DeviceKit[]> => {
  const db = await initializeDb();
  try {
    return await db.all<DeviceKit[]>(`SELECT * FROM deviceKits ORDER BY name`);
  } catch (error) {
    console.error("Error getting all device kits: ", error);
    return [];
  }
};

export const getDeviceKitById = async (id: number): Promise<DeviceKit | undefined> => {
  const db = await initializeDb();
  try {
    return await db.get<DeviceKit>(`SELECT * FROM deviceKits WHERE id = ?`, [id]);
  } catch (error) {
    console.error(`Error getting device kit with id ${id}: `, error);
    return undefined;
  }
};

export const updateDeviceKit = async (id: number, updates: Partial<Omit<DeviceKit, 'id'>>): Promise<number | undefined> => {
  const db = await initializeDb();
  try {
    if (updates.isDefault === 1) {
      await db.run(`UPDATE deviceKits SET isDefault = 0 WHERE isDefault = 1 AND id != ?`, [id]);
    }
    const fields = Object.entries(updates).filter(([key]) => key !== 'id');
    if (fields.length === 0) return id;
    const setClause = fields.map(([key]) => `${key} = ?`).join(', ');
    const values = fields.map(([_, value]) => value);
    values.push(id);
    await db.run(`UPDATE deviceKits SET ${setClause} WHERE id = ?`, values);
    return id;
  } catch (error) {
    console.error(`Error updating device kit with id ${id}: `, error);
    throw error;
  }
};

export const deleteDeviceKit = async (id: number): Promise<void> => {
  const db = await initializeDb();
  try {
    await db.run(`DELETE FROM deviceKitAssignments WHERE kitId = ?`, [id]);
    await db.run(`DELETE FROM deviceKits WHERE id = ?`, [id]);
  } catch (error) {
    console.error(`Error deleting device kit with id ${id}: `, error);
    throw error;
  }
};

export const getDefaultDeviceKit = async (): Promise<DeviceKit | undefined> => {
  const db = await initializeDb();
  try {
    return await db.get<DeviceKit>(`SELECT * FROM deviceKits WHERE isDefault = 1 LIMIT 1`);
  } catch (error) {
    console.error("Error getting default device kit: ", error);
    return undefined;
  }
};

export const setDefaultDeviceKit = async (kitId: number): Promise<void> => {
  const db = await initializeDb();
  try {
    await db.run(`UPDATE deviceKits SET isDefault = 0 WHERE isDefault = 1`);
    await db.run(`UPDATE deviceKits SET isDefault = 1 WHERE id = ?`, [kitId]);
  } catch (error) {
    console.error(`Error setting default device kit for id ${kitId}:`, error);
    throw error;
  }
};

// CRUD for DeviceKitAssignments
export const assignDeviceToKit = async (kitId: number, votingDeviceId: number): Promise<number | undefined> => {
  const db = await initializeDb();
  console.log(`[DB_TRACE] Tentative d'assignation du boîtier ${votingDeviceId} au kit ${kitId}`);
  try {
    const existing = await db.get(`SELECT id FROM deviceKitAssignments WHERE kitId = ? AND votingDeviceId = ?`, [kitId, votingDeviceId]);
    if (existing) {
      console.log(`[DB_TRACE] Assignation déjà existante pour kit ${kitId} et boîtier ${votingDeviceId}. ID: ${existing.id}`);
      return existing.id;
    }
    const result = await db.run(
      `INSERT INTO deviceKitAssignments (kitId, votingDeviceId) VALUES (?, ?)`,
      [kitId, votingDeviceId]
    );
    console.log(`[DB_TRACE] Boîtier ${votingDeviceId} assigné au kit ${kitId}. Nouvel ID d'assignation: ${result.lastID}`);
    return result.lastID;
  } catch (error) {
    console.error(`[DB_ERROR] Erreur lors de l'assignation du boîtier ${votingDeviceId} au kit ${kitId}: `, error);
    throw error;
  }
};

export const removeDeviceFromKit = async (kitId: number, votingDeviceId: number): Promise<void> => {
  const db = await initializeDb();
  try {
    await db.run(`DELETE FROM deviceKitAssignments WHERE kitId = ? AND votingDeviceId = ?`, [kitId, votingDeviceId]);
  } catch (error) {
    console.error(`Error removing device ${votingDeviceId} from kit ${kitId}: `, error);
    throw error;
  }
};

export const getVotingDevicesForKit = async (kitId: number): Promise<VotingDevice[]> => {
  const db = await initializeDb();
  console.log(`[DB_TRACE] Récupération des boîtiers pour le kit ${kitId}`);
  try {
    const assignments = await db.all<{ votingDeviceId: number }[]>(
      `SELECT votingDeviceId FROM deviceKitAssignments WHERE kitId = ?`,
      [kitId]
    );
    console.log(`[DB_TRACE] Assignations trouvées pour kit ${kitId}:`, assignments.length);
    if (assignments.length === 0) {
      console.log(`[DB_TRACE] Aucun boîtier assigné au kit ${kitId}.`);
      return [];
    }
    const deviceIds = assignments.map(a => a.votingDeviceId);
    const devices = await db.all<VotingDevice[]>(
      `SELECT * FROM votingDevices WHERE id IN (${deviceIds.map(() => '?').join(',')}) ORDER BY name`,
      deviceIds
    );
    console.log(`[DB_TRACE] Boîtiers valides récupérés pour kit ${kitId}:`, devices.length);
    return devices;
  } catch (error) {
    console.error(`[DB_ERROR] Erreur lors de la récupération des boîtiers pour le kit ${kitId}: `, error);
    return [];
  }
};

export const getKitsForVotingDevice = async (votingDeviceId: number): Promise<DeviceKit[]> => {
  const db = await initializeDb();
  try {
    const assignments = await db.all<{ kitId: number }[]>(
      `SELECT kitId FROM deviceKitAssignments WHERE votingDeviceId = ?`,
      [votingDeviceId]
    );
    if (assignments.length === 0) return [];
    const kitIds = assignments.map(a => a.kitId);
    const kits = await db.all<DeviceKit[]>(
      `SELECT * FROM deviceKits WHERE id IN (${kitIds.map(() => '?').join(',')})`,
      kitIds
    );
    return kits;
  } catch (error) {
    console.error(`Error getting kits for voting device ${votingDeviceId}: `, error);
    return [];
  }
};

export const removeAssignmentsByKitId = async (kitId: number): Promise<void> => {
  const db = await initializeDb();
  try {
    await db.run(`DELETE FROM deviceKitAssignments WHERE kitId = ?`, [kitId]);
  } catch (error) {
    console.error(`Error removing assignments by kitId ${kitId}:`, error);
    throw error;
  }
};

export const removeAssignmentsByVotingDeviceId = async (votingDeviceId: number): Promise<void> => {
  const db = await initializeDb();
  try {
    await db.run(`DELETE FROM deviceKitAssignments WHERE votingDeviceId = ?`, [votingDeviceId]);
  } catch (error) {
    console.error(`Error removing assignments by votingDeviceId ${votingDeviceId}:`, error);
    throw error;
  }
};

// CRUD for Referentiels, Themes, Blocs
export const addReferential = async (referential: Omit<Referential, 'id'>): Promise<number | undefined> => {
  const db = await initializeDb();
  try {
    const result = await db.run(
      `INSERT INTO referentiels (code, nom_complet) VALUES (?, ?)`,
      [referential.code, referential.nom_complet]
    );
    return result.lastID;
  } catch (error) {
    console.error("Error adding referential: ", error);
    throw error;
  }
};

export const getAllReferentiels = async (): Promise<Referential[]> => {
  const db = await initializeDb();
  try {
    return await db.all<Referential[]>(`SELECT * FROM referentiels`);
  } catch (error) {
    console.error("Error getting all referentiels: ", error);
    return [];
  }
};

export const getReferentialById = async (id: number): Promise<Referential | undefined> => {
  const db = await initializeDb();
  try {
    return await db.get<Referential>(`SELECT * FROM referentiels WHERE id = ?`, [id]);
  } catch (error) {
    console.error(`Error getting referential with id ${id}: `, error);
    return undefined;
  }
};

export const getReferentialByCode = async (code: string): Promise<Referential | undefined> => {
  const db = await initializeDb();
  try {
    return await db.get<Referential>(`SELECT * FROM referentiels WHERE code = ?`, [code]);
  } catch (error) {
    console.error(`Error getting referential with code ${code}: `, error);
    return undefined;
  }
};

export const addTheme = async (theme: Omit<Theme, 'id'>): Promise<number | undefined> => {
  const db = await initializeDb();
  try {
    const result = await db.run(
      `INSERT INTO themes (code_theme, nom_complet, referentiel_id) VALUES (?, ?, ?)`,
      [theme.code_theme, theme.nom_complet, theme.referentiel_id]
    );
    const themeId = result.lastID;
    if (themeId) {
      const defaultBlocCode = `${theme.code_theme}_GEN`;
      await addBloc({ code_bloc: defaultBlocCode, theme_id: themeId });
    }
    return themeId;
  } catch (error) {
    console.error("Error adding theme: ", error);
    throw error;
  }
};

export const getAllThemes = async (): Promise<Theme[]> => {
  const db = await initializeDb();
  try {
    return await db.all<Theme[]>(`SELECT * FROM themes`);
  } catch (error) {
    console.error("Error getting all themes: ", error);
    return [];
  }
};

export const getThemesByReferentialId = async (referentielId: number): Promise<Theme[]> => {
  const db = await initializeDb();
  try {
    return await db.all<Theme[]>(`SELECT * FROM themes WHERE referentiel_id = ?`, [referentielId]);
  } catch (error) {
    console.error(`Error getting themes for referential id ${referentielId}:`, error);
    return [];
  }
};

export const getThemeByCodeAndReferentialId = async (code_theme: string, referentiel_id: number): Promise<Theme | undefined> => {
  const db = await initializeDb();
  try {
    return await db.get<Theme>(
      `SELECT * FROM themes WHERE code_theme = ? AND referentiel_id = ?`,
      [code_theme, referentiel_id]
    );
  } catch (error) {
    console.error(`Error getting theme with code_theme ${code_theme} and referentiel_id ${referentiel_id}: `, error);
    return undefined;
  }
};

export const addBloc = async (bloc: Omit<Bloc, 'id'>): Promise<number | undefined> => {
  const db = await initializeDb();
  try {
    const result = await db.run(
      `INSERT INTO blocs (code_bloc, theme_id) VALUES (?, ?)`,
      [bloc.code_bloc, bloc.theme_id]
    );
    return result.lastID;
  } catch (error) {
    console.error("Error adding bloc: ", error);
    throw error;
  }
};

export const getAllBlocs = async (): Promise<Bloc[]> => {
  const db = await initializeDb();
  try {
    return await db.all<Bloc[]>(`SELECT * FROM blocs`);
  } catch (error) {
    console.error("Error getting all blocs: ", error);
    return [];
  }
};

export const getBlocsByThemeId = async (themeId: number): Promise<Bloc[]> => {
  const db = await initializeDb();
  try {
    return await db.all<Bloc[]>(`SELECT * FROM blocs WHERE theme_id = ?`, [themeId]);
  } catch (error) {
    console.error(`Error getting blocs for theme id ${themeId}:`, error);
    return [];
  }
};

export const getBlocById = async (id: number): Promise<Bloc | undefined> => {
  const db = await initializeDb();
  try {
    return await db.get<Bloc>(`SELECT * FROM blocs WHERE id = ?`, [id]);
  } catch (error) {
    console.error(`Error getting bloc with id ${id}: `, error);
    return undefined;
  }
};

export const getBlocByCodeAndThemeId = async (code_bloc: string, theme_id: number): Promise<Bloc | undefined> => {
  const db = await initializeDb();
  try {
    return await db.get<Bloc>(
      `SELECT * FROM blocs WHERE code_bloc = ? AND theme_id = ?`,
      [code_bloc, theme_id]
    );
  } catch (error) {
    console.error(`Error getting bloc with code_bloc ${code_bloc} and theme_id ${theme_id}: `, error);
    return undefined;
  }
};

export const getQuestionsByBlocId = async (blocId: number): Promise<QuestionWithId[]> => {
  const db = await initializeDb();
  try {
    const questions = await db.all<QuestionWithId[]>(
      `SELECT * FROM questions WHERE blocId = ?`,
      [blocId]
    );
    return questions.map(q => ({
      ...q,
      isEliminatory: q.isEliminatory === 1,
      options: parseJsonField(q.options)
    }));
  } catch (error) {
    console.error(`Error getting questions for blocId ${blocId}: `, error);
    return [];
  }
};

export const getQuestionById = async (id: number): Promise<QuestionWithId | undefined> => {
  const db = await initializeDb();
  try {
    const question = await db.get<QuestionWithId>(`SELECT * FROM questions WHERE id = ?`, [id]);
    if (question) {
      question.isEliminatory = question.isEliminatory === 1;
      question.options = parseJsonField(question.options);
    }
    return question;
  } catch (error) {
    console.error(`Error getting question with id ${id}: `, error);
    return undefined;
  }
};

export const getQuestionsByIds = async (ids: number[]): Promise<QuestionWithId[]> => {
  const db = await initializeDb();
  try {
    if (ids.length === 0) return [];
    const questions = await db.all<QuestionWithId[]>(
      `SELECT * FROM questions WHERE id IN (${ids.map(() => '?').join(',')})`,
      ids
    );
    return questions.map(q => ({
      ...q,
      isEliminatory: q.isEliminatory === 1,
      options: parseJsonField(q.options)
    }));
  } catch (error) {
    console.error(`Error getting questions by ids: `, error);
    return [];
  }
};

export const updateQuestion = async (id: number, updates: Partial<QuestionWithId>): Promise<number | undefined> => {
  const db = await initializeDb();
  try {
    const fields = Object.entries(updates).filter(([key]) => key !== 'id');
    if (fields.length === 0) return id;
    const setClause = fields.map(([key]) => `${key} = ?`).join(', ');
    const values = fields.map(([_, value]) =>
      key === 'options' ? serializeJsonField(value) : key === 'isEliminatory' ? (value ? 1 : 0) : value
    );
    values.push(id);
    await db.run(`UPDATE questions SET ${setClause} WHERE id = ?`, values);
    return id;
  } catch (error) {
    console.error(`Error updating question with id ${id}: `, error);
    return undefined;
  }
};

export const deleteQuestion = async (id: number): Promise<void> => {
  const db = await initializeDb();
  try {
    await db.run(`DELETE FROM questions WHERE id = ?`, [id]);
  } catch (error) {
    console.error(`Error deleting question with id ${id}: `, error);
  }
};

// CRUD for Sessions
export const addSession = async (session: Session): Promise<number | undefined> => {
  const db = await initializeDb();
  try {
    const { nomSession, dateSession, referentielId, selectedBlocIds, selectedKitId, createdAt, location, status, questionMappings, notes, trainerId, ignoredSlideGuids, resolvedImportAnomalies } = session;
    const result = await db.run(
      `INSERT INTO sessions (
        nomSession, dateSession, referentielId, selectedBlocIds, selectedKitId,
        createdAt, location, status, questionMappings, notes, trainerId,
        ignoredSlideGuids, resolvedImportAnomalies
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nomSession,
        dateSession,
        referentielId,
        serializeJsonField(selectedBlocIds),
        selectedKitId,
        createdAt || new Date().toISOString(),
        location,
        status,
        serializeJsonField(questionMappings),
        notes,
        trainerId,
        serializeJsonField(ignoredSlideGuids),
        serializeJsonField(resolvedImportAnomalies)
      ]
    );
    const id = result.lastID;
    if (id !== undefined) {
      logger.info(`Session créée : "${nomSession}"`, {
        eventType: 'SESSION_CREATED',
        sessionId: id,
        sessionName: nomSession,
        referentialId: referentielId,
        participantsCount: session.participants?.length || 0
      });
    }
    return id;
  } catch (error) {
    logger.error(`Erreur lors de la création de la session "${session.nomSession}"`, { error, sessionDetails: session });
    console.error("Error adding session: ", error);
    return undefined;
  }
};

export const getAllSessions = async (): Promise<Session[]> => {
  const db = await initializeDb();
  try {
    const sessions = await db.all<Session[]>(`SELECT * FROM sessions`);
    return sessions.map(s => ({
      ...s,
      selectedBlocIds: parseJsonField(s.selectedBlocIds) || [],
      questionMappings: parseJsonField(s.questionMappings) || [],
      ignoredSlideGuids: parseJsonField(s.ignoredSlideGuids) || [],
      resolvedImportAnomalies: parseJsonField(s.resolvedImportAnomalies)
    }));
  } catch (error) {
    console.error("Error getting all sessions: ", error);
    return [];
  }
};

export const getSessionById = async (id: number): Promise<Session | undefined> => {
  const db = await initializeDb();
  try {
    const session = await db.get<Session>(`SELECT * FROM sessions WHERE id = ?`, [id]);
    if (session) {
      session.selectedBlocIds = parseJsonField(session.selectedBlocIds) || [];
      session.questionMappings = parseJsonField(session.questionMappings) || [];
      session.ignoredSlideGuids = parseJsonField(session.ignoredSlideGuids) || [];
      session.resolvedImportAnomalies = parseJsonField(session.resolvedImportAnomalies);
    }
    return session;
  } catch (error) {
    console.error(`Error getting session with id ${id}: `, error);
    return undefined;
  }
};

export const updateSession = async (id: number, updates: Partial<Session>): Promise<number | undefined> => {
  const db = await initializeDb();
  try {
    const fields = Object.entries(updates).filter(([key]) => key !== 'id');
    if (fields.length === 0) return id;
    const setClause = fields.map(([key]) => `${key} = ?`).join(', ');
    const values = fields.map(([_, value]) =>
      ['selectedBlocIds', 'questionMappings', 'ignoredSlideGuids', 'resolvedImportAnomalies'].includes(key)
        ? serializeJsonField(value)
        : value
    );
    values.push(id);
    const numAffected = await db.run(`UPDATE sessions SET ${setClause} WHERE id = ?`, values);
    if (numAffected > 0) {
      const sessionName = updates.nomSession || (await db.get<{ nomSession: string }>(`SELECT nomSession FROM sessions WHERE id = ?`, [id]))?.nomSession || `ID ${id}`;
      const logDetails: any = {
        eventType: 'SESSION_UPDATED',
        sessionId: id,
        updatedFields: Object.keys(updates)
      };
      if (updates.participants) {
        logDetails.participantsCount = updates.participants.length;
      }
      logger.info(`Session modifiée : "${sessionName}"`, logDetails);
    }
    return id;
  } catch (error) {
    logger.error(`Erreur lors de la modification de la session ID ${id}`, { error, updates });
    console.error(`Error updating session with id ${id}: `, error);
    return undefined;
  }
};

export const deleteSession = async (id: number): Promise<void> => {
  const db = await initializeDb();
  try {
    await db.run(`DELETE FROM sessionResults WHERE sessionId = ?`, [id]);
    await db.run(`DELETE FROM sessions WHERE id = ?`, [id]);
  } catch (error) {
    console.error(`Error deleting session with id ${id}: `, error);
  }
};

// CRUD for SessionResults
export const addSessionResult = async (result: SessionResult): Promise<number | undefined> => {
  const db = await initializeDb();
  try {
    const { sessionId, questionId, participantIdBoitier, answer, isCorrect, pointsObtained, timestamp } = result;
    const resultDb = await db.run(
      `INSERT INTO sessionResults (sessionId, questionId, participantIdBoitier, answer, isCorrect, pointsObtained, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [sessionId, questionId, participantIdBoitier, answer, isCorrect ? 1 : 0, pointsObtained, timestamp]
    );
    return resultDb.lastID;
  } catch (error) {
    console.error("Error adding session result: ", error);
    return undefined;
  }
};

export const addBulkSessionResults = async (results: SessionResult[]): Promise<number[] | undefined> => {
  const db = await initializeDb();
  try {
    const ids: number[] = [];
    for (const result of results) {
      const { sessionId, questionId, participantIdBoitier, answer, isCorrect, pointsObtained, timestamp } = result;
      const resultDb = await db.run(
        `INSERT INTO sessionResults (sessionId, questionId, participantIdBoitier, answer, isCorrect, pointsObtained, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [sessionId, questionId, participantIdBoitier, answer, isCorrect ? 1 : 0, pointsObtained, timestamp]
      );
      if (resultDb.lastID) ids.push(resultDb.lastID);
    }
    return ids;
  } catch (error) {
    console.error("Error adding bulk session results: ", error);
    return undefined;
  }
};

export const getAllResults = async (): Promise<SessionResult[]> => {
  const db = await initializeDb();
  try {
    const results = await db.all<SessionResult[]>(`SELECT * FROM sessionResults`);
    return results.map(r => ({
      ...r,
      isCorrect: r.isCorrect === 1
    }));
  } catch (error) {
    console.error("Error getting all session results: ", error);
    return [];
  }
};

export const getResultsForSession = async (sessionId: number): Promise<SessionResult[]> => {
  const db = await initializeDb();
  try {
    const results = await db.all<SessionResult[]>(
      `SELECT * FROM sessionResults WHERE sessionId = ?`,
      [sessionId]
    );
    return results.map(r => ({
      ...r,
      isCorrect: r.isCorrect === 1
    }));
  } catch (error) {
    console.error(`Error getting results for session ${sessionId}: `, error);
    return [];
  }
};

export const getResultBySessionAndQuestion = async (sessionId: number, questionId: number, participantIdBoitier: string): Promise<SessionResult | undefined> => {
  const db = await initializeDb();
  try {
    const result = await db.get<SessionResult>(
      `SELECT * FROM sessionResults WHERE sessionId = ? AND questionId = ? AND participantIdBoitier = ?`,
      [sessionId, questionId, participantIdBoitier]
    );
    if (result) {
      result.isCorrect = result.isCorrect === 1;
    }
    return result;
  } catch (error) {
    console.error(`Error getting specific result: `, error);
    return undefined;
  }
};

export const updateSessionResult = async (id: number, updates: Partial<SessionResult>): Promise<number | undefined> => {
  const db = await initializeDb();
  try {
    const fields = Object.entries(updates).filter(([key]) => key !== 'id');
    if (fields.length === 0) return id;
    const setClause = fields.map(([key]) => `${key} = ?`).join(', ');
    const values = fields.map(([_, value]) => key === 'isCorrect' ? (value ? 1 : 0) : value);
    values.push(id);
    await db.run(`UPDATE sessionResults SET ${setClause} WHERE id = ?`, values);
    return id;
  } catch (error) {
    console.error(`Error updating session result with id ${id}: `, error);
    return undefined;
  }
};

export const deleteResultsForSession = async (sessionId: number): Promise<void> => {
  const db = await initializeDb();
  try {
    await db.run(`DELETE FROM sessionResults WHERE sessionId = ?`, [sessionId]);
  } catch (error) {
    console.error(`Error deleting results for session ${sessionId}: `, error);
  }
};

export const getQuestionsForSessionBlocks = async (selectedBlocIds?: number[]): Promise<QuestionWithId[]> => {
  const db = await initializeDb();
  if (!selectedBlocIds || selectedBlocIds.length === 0) {
    return [];
  }
  try {
    const questions = await db.all<QuestionWithId[]>(
      `SELECT * FROM questions WHERE blocId IN (${selectedBlocIds.map(() => '?').join(',')})`,
      selectedBlocIds.filter(id => typeof id === 'number')
    );
    return questions.map(q => ({
      ...q,
      isEliminatory: q.isEliminatory === 1,
      options: parseJsonField(q.options)
    }));
  } catch (error) {
    console.error("Erreur lors de la récupération des questions pour les IDs de bloc de session:", error);
    return [];
  }
};

// AdminSettings
export const getAdminSetting = async (key: string): Promise<any> => {
  const db = await initializeDb();
  try {
    const setting = await db.get<{ value: any }>(`SELECT value FROM adminSettings WHERE key = ?`, [key]);
    return setting?.value;
  } catch (error) {
    console.error(`Error getting setting ${key}:`, error);
    return undefined;
  }
};

export const setAdminSetting = async (key: string, value: any): Promise<void> => {
  const db = await initializeDb();
  try {
    await db.run(
      `INSERT OR REPLACE INTO adminSettings (key, value) VALUES (?, ?)`,
      [key, value]
    );
  } catch (error) {
    console.error(`Error setting ${key}:`, error);
  }
};

export const getAllAdminSettings = async (): Promise<{ key: string; value: any }[]> => {
  const db = await initializeDb();
  try {
    return await db.all<{ key: string; value: any }[]>(`SELECT * FROM adminSettings`);
  } catch (error) {
    console.error("Error getting all admin settings:", error);
    return [];
  }
};

// CRUD for VotingDevices
export const addVotingDevice = async (device: Omit<VotingDevice, 'id'>): Promise<number | undefined> => {
  const db = await initializeDb();
  try {
    const result = await db.run(
      `INSERT INTO votingDevices (name, serialNumber) VALUES (?, ?)`,
      [device.name, device.serialNumber]
    );
    return result.lastID;
  } catch (error) {
    console.error("Error adding voting device:", error);
    return undefined;
  }
};

export const getAllVotingDevices = async (): Promise<VotingDevice[]> => {
  const db = await initializeDb();
  console.log(`[DB_TRACE] Récupération de tous les boîtiers votants.`);
  try {
    const devices = await db.all<VotingDevice[]>(`SELECT * FROM votingDevices ORDER BY name`);
    console.log(`[DB_TRACE] Nombre total de boîtiers récupérés: ${devices.length}`);
    return devices;
  } catch (error) {
    console.error("[DB_ERROR] Erreur lors de la récupération de tous les boîtiers votants:", error);
    return [];
  }
};

export const updateVotingDevice = async (id: number, updates: Partial<VotingDevice>): Promise<number> => {
  const db = await initializeDb();
  try {
    const fields = Object.entries(updates).filter(([key]) => key !== 'id');
    if (fields.length === 0) return 1;
    const setClause = fields.map(([key]) => `${key} = ?`).join(', ');
    const values = fields.map(([_, value]) => value);
    values.push(id);
    const result = await db.run(`UPDATE votingDevices SET ${setClause} WHERE id = ?`, values);
    return result.changes || 0;
  } catch (error) {
    console.error(`Error updating voting device ${id}:`, error);
    return 0;
  }
};

export const deleteVotingDevice = async (id: number): Promise<void> => {
  const db = await initializeDb();
  try {
    await db.run(`DELETE FROM votingDevices WHERE id = ?`, [id]);
  } catch (error) {
    console.error(`Error deleting voting device ${id}:`, error);
  }
};

export const bulkAddVotingDevices = async (devices: VotingDevice[]): Promise<void> => {
  const db = await initializeDb();
  try {
    for (const device of devices) {
      await db.run(
        `INSERT INTO votingDevices (name, serialNumber) VALUES (?, ?)`,
        [device.name, device.serialNumber]
      );
    }
  } catch (error) {
    console.error("Error bulk adding voting devices:", error);
  }
};

// CRUD for Trainers
export const addTrainer = async (trainer: Omit<Trainer, 'id'>): Promise<number | undefined> => {
  const db = await initializeDb();
  try {
    if (trainer.isDefault === 1) {
      await db.run(`UPDATE trainers SET isDefault = 0 WHERE isDefault = 1`);
    }
    const result = await db.run(
      `INSERT INTO trainers (name, isDefault) VALUES (?, ?)`,
      [trainer.name, trainer.isDefault || 0]
    );
    return result.lastID;
  } catch (error) {
    console.error("Error adding trainer: ", error);
    return undefined;
  }
};

export const getAllTrainers = async (): Promise<Trainer[]> => {
  const db = await initializeDb();
  try {
    return await db.all<Trainer[]>(`SELECT * FROM trainers`);
  } catch (error) {
    console.error("Error getting all trainers: ", error);
    return [];
  }
};

export const getTrainerById = async (id: number): Promise<Trainer | undefined> => {
  const db = await initializeDb();
  try {
    return await db.get<Trainer>(`SELECT * FROM trainers WHERE id = ?`, [id]);
  } catch (error) {
    console.error(`Error getting trainer with id ${id}: `, error);
    return undefined;
  }
};

export const updateTrainer = async (id: number, updates: Partial<Omit<Trainer, 'id'>>): Promise<number | undefined> => {
  const db = await initializeDb();
  try {
    if (updates.isDefault === 1) {
      await db.run(`UPDATE trainers SET isDefault = 0 WHERE isDefault = 1 AND id != ?`, [id]);
    }
    const fields = Object.entries(updates).filter(([key]) => key !== 'id');
    if (fields.length === 0) return id;
    const setClause = fields.map(([key]) => `${key} = ?`).join(', ');
    const values = fields.map(([_, value]) => value);
    values.push(id);
    await db.run(`UPDATE trainers SET ${setClause} WHERE id = ?`, values);
    return id;
  } catch (error) {
    console.error(`Error updating trainer with id ${id}: `, error);
    return undefined;
  }
};

export const deleteTrainer = async (id: number): Promise<void> => {
  const db = await initializeDb();
  try {
    await db.run(`DELETE FROM trainers WHERE id = ?`, [id]);
  } catch (error) {
    console.error(`Error deleting trainer with id ${id}: `, error);
  }
};

export const setDefaultTrainer = async (id: number): Promise<number | undefined> => {
  const db = await initializeDb();
  try {
    await db.run(`UPDATE trainers SET isDefault = 0 WHERE isDefault = 1`);
    await db.run(`UPDATE trainers SET isDefault = 1 WHERE id = ?`, [id]);
    return id;
  } catch (error) {
    console.error(`Error setting default trainer for id ${id}:`, error);
    return undefined;
  }
};

export const getDefaultTrainer = async (): Promise<Trainer | undefined> => {
  const db = await initializeDb();
  try {
    return await db.get<Trainer>(`SELECT * FROM trainers WHERE isDefault = 1 LIMIT 1`);
  } catch (error) {
    console.error("Error getting default trainer:", error);
    return undefined;
  }
};

// CRUD for SessionQuestion
export const addSessionQuestion = async (sq: SessionQuestion): Promise<number | undefined> => {
  const db = await initializeDb();
  try {
    const { sessionId, dbQuestionId, slideGuid, blockId } = sq;
    const result = await db.run(
      `INSERT INTO sessionQuestions (sessionId, dbQuestionId, slideGuid, blockId) VALUES (?, ?, ?, ?)`,
      [sessionId, dbQuestionId, slideGuid, blockId]
    );
    return result.lastID;
  } catch (error) {
    console.error("Error adding session question:", error);
    return undefined;
  }
};

export const addBulkSessionQuestions = async (questions: SessionQuestion[]): Promise<number[] | undefined> => {
  const db = await initializeDb();
  try {
    const ids: number[] = [];
    for (const q of questions) {
      const { sessionId, dbQuestionId, slideGuid, blockId } = q;
      const result = await db.run(
        `INSERT INTO sessionQuestions (sessionId, dbQuestionId, slideGuid, blockId) VALUES (?, ?, ?, ?)`,
        [sessionId, dbQuestionId, slideGuid, blockId]
      );
      if (result.lastID) ids.push(result.lastID);
    }
    return ids;
  } catch (error) {
    console.error("Error bulk adding session questions:", error);
    return undefined;
  }
};

export const getSessionQuestionsBySessionId = async (sessionId: number): Promise<SessionQuestion[]> => {
  const db = await initializeDb();
  try {
    return await db.all<SessionQuestion[]>(`SELECT * FROM sessionQuestions WHERE sessionId = ?`, [sessionId]);
  } catch (error) {
    console.error(`Error getting session questions for session ${sessionId}:`, error);
    return [];
  }
};

export const deleteSessionQuestionsBySessionId = async (sessionId: number): Promise<void> => {
  const db = await initializeDb();
  try {
    await db.run(`DELETE FROM sessionQuestions WHERE sessionId = ?`, [sessionId]);
  } catch (error) {
    console.error(`Error deleting session questions for session ${sessionId}:`, error);
  }
};

// CRUD for SessionBoitier
export const addSessionBoitier = async (sb: SessionBoitier): Promise<number | undefined> => {
  const db = await initializeDb();
  try {
    const { sessionId, participantId, visualId, serialNumber } = sb;
    const result = await db.run(
      `INSERT INTO sessionBoitiers (sessionId, participantId, visualId, serialNumber) VALUES (?, ?, ?, ?)`,
      [sessionId, participantId, visualId, serialNumber]
    );
    return result.lastID;
  } catch (error) {
    console.error("Error adding session boitier:", error);
    return undefined;
  }
};

export const addBulkSessionBoitiers = async (boitiers: SessionBoitier[]): Promise<number[] | undefined> => {
  const db = await initializeDb();
  try {
    const ids: number[] = [];
    for (const b of boitiers) {
      const { sessionId, participantId, visualId, serialNumber } = b;
      const result = await db.run(
        `INSERT INTO sessionBoitiers (sessionId, participantId, visualId, serialNumber) VALUES (?, ?, ?, ?)`,
        [sessionId, participantId, visualId, serialNumber]
      );
      if (result.lastID) ids.push(result.lastID);
    }
    return ids;
  } catch (error) {
    console.error("Error bulk adding session boitiers:", error);
    return undefined;
  }
};

export const getSessionBoitiersBySessionId = async (sessionId: number): Promise<SessionBoitier[]> => {
  const db = await initializeDb();
  try {
    return await db.all<SessionBoitier[]>(`SELECT * FROM sessionBoitiers WHERE sessionId = ?`, [sessionId]);
  } catch (error) {
    console.error(`Error getting session boitiers for session ${sessionId}:`, error);
    return [];
  }
};

export const deleteSessionBoitiersBySessionId = async (sessionId: number): Promise<void> => {
  const db = await initializeDb();
  try {
    await db.run(`DELETE FROM sessionBoitiers WHERE sessionId = ?`, [sessionId]);
  } catch (error) {
    console.error(`Error deleting session boitiers for session ${sessionId}:`, error);
  }
};

// Block Usage Reporting
export const calculateBlockUsage = async (startDate?: string | Date, endDate?: string | Date): Promise<BlockUsage[]> => {
  const db = await initializeDb();
  const usageMap = new Map<string, BlockUsage>();
  try {
    let query = `SELECT * FROM sessions WHERE status = 'completed'`;
    const params: (string | number)[] = [];
    if (startDate) {
      const start = startDate instanceof Date ? startDate.toISOString().split('T')[0] : new Date(startDate).toISOString().split('T')[0];
      query += ` AND dateSession >= ?`;
      params.push(start);
    }
    if (endDate) {
      const end = endDate instanceof Date ? endDate.toISOString().split('T')[0] : new Date(endDate).toISOString().split('T')[0];
      query += ` AND dateSession <= ?`;
      params.push(end);
    }
    const sessions = await db.all<Session[]>(query, params);
    const filteredSessions = sessions.map(s => ({
      ...s,
      selectedBlocIds: parseJsonField(s.selectedBlocIds) || []
    }));

    const allReferentiels = await db.all<Referential[]>(`SELECT * FROM referentiels`);
    const allThemes = await db.all<Theme[]>(`SELECT * FROM themes`);
    const allBlocs = await db.all<Bloc[]>(`SELECT * FROM blocs`);

    const referentielsMap = new Map(allReferentiels.map(r => [r.id, r]));
    const themesMap = new Map(allThemes.map(t => [t.id, t]));
    const blocsMap = new Map(allBlocs.map(b => [b.id, b]));

    for (const session of filteredSessions) {
      if (session.selectedBlocIds && session.selectedBlocIds.length > 0) {
        for (const blocId of session.selectedBlocIds) {
          const bloc = blocsMap.get(blocId);
          if (!bloc) {
            console.warn(`Bloc with ID ${blocId} not found for session ${session.id}. Skipping.`);
            continue;
          }
          const theme = themesMap.get(bloc.theme_id);
          if (!theme) {
            console.warn(`Theme with ID ${bloc.theme_id} not found for bloc ${blocId}. Skipping.`);
            continue;
          }
          const referentiel = referentielsMap.get(theme.referentiel_id);
          if (!referentiel) {
            console.warn(`Referentiel with ID ${theme.referentiel_id} not found for theme ${theme.id}. Skipping.`);
            continue;
          }
          const key = `${referentiel.code}-${theme.code_theme}-${bloc.code_bloc}`;
          if (usageMap.has(key)) {
            const currentUsage = usageMap.get(key)!;
            currentUsage.usageCount++;
          } else {
            usageMap.set(key, {
              referentiel: referentiel.code,
              theme: theme.code_theme,
              blockId: bloc.code_bloc,
              usageCount: 1
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