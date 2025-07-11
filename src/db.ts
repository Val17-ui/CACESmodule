// This is the backend src/db.ts file.
// It contains the SQLite database logic and CRUD functions.
// Interfaces are defined and exported here for use in main.ts.

import sqlite3 from 'sqlite3';
import path from 'path';
import { app } from 'electron';

const verboseSqlite3 = sqlite3.verbose();
const dbPath = path.join(app.getPath('userData'), 'easycertif.db');
console.log(`Chemin de la base de données SQLite : ${dbPath}`);

export const db = new verboseSqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erreur lors de la connexion à la base de données SQLite', err.message);
  } else {
    console.log('Connecté à la base de données SQLite.');
    db.run("PRAGMA foreign_keys = ON;", (fkErr) => {
      if (fkErr) {
        console.error("Erreur lors de l'activation des clés étrangères:", fkErr.message);
      } else {
        console.log("Clés étrangères activées.");
        initializeDatabase();
      }
    });
  }
});

const initializeDatabase = () => {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT NOT NULL UNIQUE,
        prenom TEXT,
        identification_code TEXT UNIQUE,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS referentiels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        nom_complet TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS themes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code_theme TEXT NOT NULL,
        nom_complet TEXT NOT NULL,
        referentiel_id INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(code_theme, referentiel_id),
        FOREIGN KEY (referentiel_id) REFERENCES referentiels(id) ON DELETE CASCADE
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS blocs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code_bloc TEXT NOT NULL,
        nom_complet TEXT,
        theme_id INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(code_bloc, theme_id),
        FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE CASCADE
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        texte_question TEXT NOT NULL,
        type_question TEXT NOT NULL CHECK(type_question IN ('QCM', 'QCS', 'QROC', 'Oral', 'Pratique')),
        options TEXT, -- JSON string for options
        correct_answer TEXT, -- JSON string for correct answer(s) or index
        is_eliminatory INTEGER DEFAULT 0,
        time_limit INTEGER DEFAULT 30,
        image BLOB,
        image_name TEXT,
        points INTEGER DEFAULT 1,
        feedback TEXT,
        bloc_id INTEGER NOT NULL,
        referentiel_id INTEGER, -- Denormalized, but might be useful for some queries
        theme_id INTEGER, -- Denormalized
        usage_count INTEGER DEFAULT 0,
        correct_response_rate REAL DEFAULT 0,
        slide_guid TEXT, -- For PPTX mapping
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bloc_id) REFERENCES blocs(id) ON DELETE CASCADE,
        FOREIGN KEY (referentiel_id) REFERENCES referentiels(id) ON DELETE SET NULL,
        FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE SET NULL
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS trainers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT NOT NULL,
        prenom TEXT NOT NULL,
        signature BLOB,
        is_default INTEGER DEFAULT 0, -- 0 for false, 1 for true
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(nom, prenom)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS voting_devices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        serial_number TEXT UNIQUE,
        status TEXT DEFAULT 'available', -- e.g., 'available', 'in_use', 'maintenance'
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS device_kits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        is_default INTEGER DEFAULT 0, -- 0 for false, 1 for true
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS device_kit_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kit_id INTEGER NOT NULL,
        voting_device_id INTEGER NOT NULL,
        assigned_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(kit_id, voting_device_id),
        FOREIGN KEY (kit_id) REFERENCES device_kits(id) ON DELETE CASCADE,
        FOREIGN KEY (voting_device_id) REFERENCES voting_devices(id) ON DELETE CASCADE
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nomSession TEXT NOT NULL,
        dateSession TEXT NOT NULL,
        typeSession TEXT,
        status TEXT DEFAULT 'planifiée', -- planned, in-progress, completed, cancelled, ready
        referentiel_id INTEGER,
        theme_id INTEGER, -- Could be denormalized or derived
        trainer_id INTEGER,
        default_voting_device_kit_id INTEGER, -- kit_id used for this session
        selectedBlocIds TEXT, -- JSON array of bloc IDs
        questionMappings TEXT, -- JSON array of {dbQuestionId, slideGuid, orderInPptx}
        ignoredSlideGuids TEXT, -- JSON array of strings
        resolvedImportAnomalies TEXT, -- JSON object for audit
        donneesOrs BLOB,
        nomFichierOrs TEXT,
        location TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (referentiel_id) REFERENCES referentiels(id) ON DELETE SET NULL,
        FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE SET NULL,
        FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE SET NULL,
        FOREIGN KEY (default_voting_device_kit_id) REFERENCES device_kits(id) ON DELETE SET NULL
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS session_participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        nom TEXT NOT NULL,
        prenom TEXT,
        identification_code TEXT,
        score REAL,
        reussite INTEGER,
        status_in_session TEXT DEFAULT 'inscrit',
        assigned_voting_device_id INTEGER,
        original_participant_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(session_id, nom, prenom, identification_code),
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_voting_device_id) REFERENCES voting_devices(id) ON DELETE SET NULL,
        FOREIGN KEY (original_participant_id) REFERENCES participants(id) ON DELETE SET NULL
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS session_questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        original_question_id INTEGER,
        texte_question TEXT NOT NULL,
        type_question TEXT NOT NULL,
        options TEXT,
        image BLOB,
        image_name TEXT,
        points INTEGER,
        feedback TEXT,
        bloc_id INTEGER,
        ordre_apparition INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (original_question_id) REFERENCES questions(id) ON DELETE SET NULL,
        FOREIGN KEY (bloc_id) REFERENCES blocs(id) ON DELETE SET NULL
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS session_boitiers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        original_voting_device_id INTEGER,
        name TEXT NOT NULL,
        serial_number TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (original_voting_device_id) REFERENCES voting_devices(id) ON DELETE SET NULL
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS session_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        session_question_id INTEGER NOT NULL,
        session_participant_id INTEGER NOT NULL,
        reponse_choisie TEXT,
        est_correct INTEGER,
        points_obtenus INTEGER,
        temps_reponse INTEGER,
        submitted_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (session_question_id) REFERENCES session_questions(id) ON DELETE CASCADE,
        FOREIGN KEY (session_participant_id) REFERENCES session_participants(id) ON DELETE CASCADE,
        UNIQUE(session_question_id, session_participant_id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS admin_settings (
        key TEXT PRIMARY KEY NOT NULL,
        value ANY,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log("Initialisation de la base de données terminée.");
  });
};

// INTERFACES -Data et fonctions CRUD (harmonisées)

// GeneralParticipant
export interface GeneralParticipantData {
    id: number;
    nom: string;
    prenom?: string | null;
    identification_code?: string | null;
    createdAt?: string;
    updatedAt?: string;
}
const mapRowToGeneralParticipantData = (row: any): GeneralParticipantData | null => {
    if(!row) return null;
    return { id: row.id, nom: row.nom, prenom: row.prenom, identification_code: row.identification_code, createdAt: row.created_at, updatedAt: row.updated_at };
}
export const addGeneralParticipant = (nom: string, prenom?: string, identification_code?: string): Promise<number> => {
    return new Promise((resolve, reject) => {
        const sqlCheck = `SELECT id FROM participants WHERE nom = ?${prenom ? ' AND prenom = ?' : ' AND prenom IS NULL'}${identification_code ? ' AND identification_code = ?' : ' AND identification_code IS NULL'}`;
        const paramsCheck = [nom];
        if (prenom) paramsCheck.push(prenom);
        if (identification_code) paramsCheck.push(identification_code);
        db.get(sqlCheck, paramsCheck, (err, existingRow: {id: number}) => {
            if (err) return reject(err);
            if (existingRow) return resolve(existingRow.id);
            const sqlInsert = `INSERT INTO participants (nom, prenom, identification_code, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
            const paramsInsert = [nom, prenom || null, identification_code || null];
            db.run(sqlInsert, paramsInsert, function (this: sqlite3.Statement, insertErr) {
                if (insertErr) return reject(insertErr);
                resolve(this.lastID);
            });
        });
    });
};
export const getAllGeneralParticipants = (): Promise<GeneralParticipantData[]> => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM participants", [], (err, rows: any[]) => {
            if (err) reject(err); else resolve(rows.map(mapRowToGeneralParticipantData).filter(p => p !== null) as GeneralParticipantData[]);
        });
    });
};
export const getGeneralParticipantById = (id: number): Promise<GeneralParticipantData | null> => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM participants WHERE id = ?", [id], (err, row: any) => {
            if (err) reject(err); else resolve(mapRowToGeneralParticipantData(row));
        });
    });
};
export const updateGeneralParticipant = (id: number, nom: string, prenom?: string, identification_code?: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const sql = `UPDATE participants SET nom = ?, prenom = ?, identification_code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        db.run(sql, [nom, prenom || null, identification_code || null, id], (err) => {
            if (err) reject(err); else resolve();
        });
    });
};
export const deleteGeneralParticipant = (id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM participants WHERE id = ?", [id], (err) => {
            if (err) reject(err); else resolve();
        });
    });
};

// Referential
export interface ReferentialData {
    id: number;
    code: string;
    nom_complet: string;
    createdAt?: string;
    updatedAt?: string;
}
const mapRowToReferentialData = (row: any): ReferentialData | null => {
    if (!row) return null;
    return { id: row.id, code: row.code, nom_complet: row.nom_complet, createdAt: row.created_at, updatedAt: row.updated_at };
};
export const addReferentiel = (code: string, nom_complet: string): Promise<number> => {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO referentiels (code, nom_complet, created_at, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
        db.run(sql, [code, nom_complet], function(this: sqlite3.Statement, err) { if (err) reject(err); else resolve(this.lastID); });
    });
};
export const getAllReferentiels = (): Promise<ReferentialData[]> => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM referentiels", [], (err, rows: any[]) => {
            if (err) reject(err); else resolve(rows.map(mapRowToReferentialData).filter(r => r !== null) as ReferentialData[]);
        });
    });
};
export const getReferentielById = (id: number): Promise<ReferentialData | null> => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM referentiels WHERE id = ?", [id], (err, row: any) => {
            if (err) reject(err); else resolve(mapRowToReferentialData(row));
        });
    });
};
export const updateReferentiel = (id: number, code: string, nom_complet: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const sql = `UPDATE referentiels SET code = ?, nom_complet = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        db.run(sql, [code, nom_complet, id], (err) => { if (err) reject(err); else resolve(); });
    });
};
export const deleteReferentiel = (id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM referentiels WHERE id = ?", [id], (err) => { if (err) reject(err); else resolve(); });
    });
};

// Theme
export interface ThemeData {
    id: number;
    code_theme: string;
    nom_complet: string;
    referentiel_id: number;
    createdAt?: string;
    updatedAt?: string;
}
const mapRowToThemeData = (row: any): ThemeData | null => {
    if (!row) return null;
    return { id: row.id, code_theme: row.code_theme, nom_complet: row.nom_complet, referentiel_id: row.referentiel_id, createdAt: row.created_at, updatedAt: row.updated_at };
};
export const addTheme = (code_theme: string, nom_complet: string, referentiel_id: number): Promise<number> => {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO themes (code_theme, nom_complet, referentiel_id, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
        db.run(sql, [code_theme, nom_complet, referentiel_id], function(this: sqlite3.Statement, err) { if (err) reject(err); else resolve(this.lastID); });
    });
};
export const getAllThemes = (): Promise<ThemeData[]> => {
     return new Promise((resolve, reject) => {
        db.all("SELECT * FROM themes", [], (err, rows: any[]) => {
            if (err) reject(err); else resolve(rows.map(mapRowToThemeData).filter(t => t !== null) as ThemeData[]);
        });
    });
};
export const getThemesByReferentielId = (referentiel_id: number): Promise<ThemeData[]> => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM themes WHERE referentiel_id = ?", [referentiel_id], (err, rows: any[]) => {
            if (err) reject(err); else resolve(rows.map(mapRowToThemeData).filter(t => t !== null) as ThemeData[]);
        });
    });
};
export const getThemeById = (id: number): Promise<ThemeData | null> => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM themes WHERE id = ?", [id], (err, row: any) => {
            if (err) reject(err); else resolve(mapRowToThemeData(row));
        });
    });
};
export const updateTheme = (id: number, code_theme: string, nom_complet: string, referentiel_id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        const sql = `UPDATE themes SET code_theme = ?, nom_complet = ?, referentiel_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        db.run(sql, [code_theme, nom_complet, referentiel_id, id], (err) => { if (err) reject(err); else resolve(); });
    });
};
export const deleteTheme = (id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM themes WHERE id = ?", [id], (err) => { if (err) reject(err); else resolve(); });
    });
};

// Bloc
export interface BlocData {
    id: number;
    code_bloc: string;
    nom_complet?: string | null;
    theme_id: number;
    createdAt?: string;
    updatedAt?: string;
}
const mapRowToBlocData = (row: any): BlocData | null => {
    if (!row) return null;
    return { id: row.id, code_bloc: row.code_bloc, nom_complet: row.nom_complet, theme_id: row.theme_id, createdAt: row.created_at, updatedAt: row.updated_at };
};
export const addBloc = (code_bloc: string, theme_id: number, nom_complet?: string): Promise<number> => {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO blocs (code_bloc, nom_complet, theme_id, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
        db.run(sql, [code_bloc, nom_complet || null, theme_id], function(this: sqlite3.Statement, err) { if (err) reject(err); else resolve(this.lastID); });
    });
};
export const getAllBlocs = (): Promise<BlocData[]> => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM blocs", [], (err, rows: any[]) => {
            if (err) reject(err); else resolve(rows.map(mapRowToBlocData).filter(b => b !== null) as BlocData[]);
        });
    });
};
export const getBlocsByThemeId = (theme_id: number): Promise<BlocData[]> => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM blocs WHERE theme_id = ?", [theme_id], (err, rows: any[]) => {
            if (err) reject(err); else resolve(rows.map(mapRowToBlocData).filter(b => b !== null) as BlocData[]);
        });
    });
};
export const getBlocById = (id: number): Promise<BlocData | null> => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM blocs WHERE id = ?", [id], (err, row: any) => {
            if (err) reject(err); else resolve(mapRowToBlocData(row));
        });
    });
};
export const updateBloc = (id: number, code_bloc: string, theme_id: number, nom_complet?: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const sql = `UPDATE blocs SET code_bloc = ?, nom_complet = ?, theme_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        db.run(sql, [code_bloc, nom_complet || null, theme_id, id], (err) => { if (err) reject(err); else resolve(); });
    });
};
export const deleteBloc = (id: number): Promise<void> => {
     return new Promise((resolve, reject) => {
        db.run("DELETE FROM blocs WHERE id = ?", [id], (err) => { if (err) reject(err); else resolve(); });
    });
};

// Question
export interface QuestionOption {
    texte: string;
    estCorrecte: boolean;
}
export interface QuestionData {
    id?: number;
    text: string;
    type: string;
    options?: any;
    correctAnswer?: string;
    isEliminatory?: boolean;
    timeLimit?: number;
    image?: Buffer | null;
    imageName?: string | null;
    points?: number;
    feedback?: string | null;
    blocId: number;
    referentiel_id?: number | null;
    theme_id?: number | null;
    createdAt?: string;
    updatedAt?: string;
    usageCount?: number;
    correctResponseRate?: number;
    slideGuid?: string;
}
const mapDbTypeToQuestionTypeString = (dbType: string): string => {
    switch (dbType) {
        case 'QCM': return 'multiple-choice';
        case 'QCS': return 'single-choice';
        default: return dbType;
    }
};
const mapQuestionTypeStringToDbType = (typeString: string): string => {
    switch (typeString) {
        case 'multiple-choice': return 'QCM';
        case 'single-choice': return 'QCS';
        case 'true-false': return 'QCM';
        default: return typeString;
    }
};
const mapRowToQuestionData = (row: any): QuestionData => {
    if (!row) throw new Error("mapRowToQuestionData: row is null or undefined");
    return {
        id: row.id,
        text: row.texte_question,
        type: mapDbTypeToQuestionTypeString(row.type_question),
        options: row.options,
        correctAnswer: row.correct_answer,
        isEliminatory: !!row.is_eliminatory,
        timeLimit: row.time_limit,
        image: row.image,
        imageName: row.image_name,
        points: row.points,
        feedback: row.feedback,
        blocId: row.bloc_id,
        referentiel_id: row.referentiel_id,
        theme_id: row.theme_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        usageCount: row.usage_count,
        correctResponseRate: row.correct_response_rate,
        slideGuid: row.slide_guid,
    };
};
export const addQuestion = (data: Partial<Omit<QuestionData, 'id'>>): Promise<number> => {
    return new Promise((resolve, reject) => {
        const optionsJSON = typeof data.options === 'string' ? data.options : (data.options ? JSON.stringify(data.options) : null);
        const sql = `INSERT INTO questions (
                       texte_question, type_question, options, correct_answer, is_eliminatory, time_limit,
                       image, image_name, points, feedback, bloc_id, referentiel_id, theme_id,
                       usage_count, correct_response_rate, slide_guid, created_at, updated_at
                     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
        const params = [
            data.text, mapQuestionTypeStringToDbType(data.type as string), optionsJSON, data.correctAnswer, data.isEliminatory ? 1 : 0, data.timeLimit,
            data.image || null, data.imageName || null, data.points || 1, data.feedback || null,
            data.blocId, data.referentiel_id || null, data.theme_id || null,
            data.usageCount || 0, data.correctResponseRate || 0, data.slideGuid || null
        ];
        db.run(sql, params, function(this: sqlite3.Statement, err) {
            if (err) reject(err); else resolve(this.lastID);
        });
    });
};
const parseQuestionOptions = (question: QuestionData): QuestionData => {
    if (question.options && typeof question.options === 'string') {
        try {
            question.options = JSON.parse(question.options);
        } catch (e) {
            console.error("Erreur de parsing JSON pour les options de la question:", e);
            question.options = [];
        }
    }
    return question;
};
export const getAllQuestions = (): Promise<QuestionData[]> => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM questions", [], (err, rows: any[]) => {
            if (err) reject(err); else resolve(rows.map(mapRowToQuestionData).map(parseQuestionOptions));
        });
    });
};
export const getQuestionsByBlocId = (blocId: number): Promise<QuestionData[]> => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM questions WHERE bloc_id = ?", [blocId], (err, rows: any[]) => {
            if (err) reject(err); else resolve(rows.map(mapRowToQuestionData).map(parseQuestionOptions));
        });
    });
};
export const getQuestionById = (id: number): Promise<QuestionData | null> => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM questions WHERE id = ?", [id], (err, row: any) => {
            if (err) reject(err); else resolve(row ? parseQuestionOptions(mapRowToQuestionData(row)) : null);
        });
    });
};
export const updateQuestion = (id: number, data: Partial<QuestionData>): Promise<void> => {
    return new Promise((resolve, reject) => {
        const fieldsToUpdate: string[] = [];
        const params: any[] = [];
        const dbData: Record<string, any> = {};
        if (data.text !== undefined) dbData.texte_question = data.text;
        if (data.type !== undefined) dbData.type_question = mapQuestionTypeStringToDbType(data.type);
        if (data.options !== undefined) dbData.options = typeof data.options === 'string' ? data.options : JSON.stringify(data.options);
        if (data.correctAnswer !== undefined) dbData.correct_answer = data.correctAnswer;
        if (data.isEliminatory !== undefined) dbData.is_eliminatory = data.isEliminatory ? 1 : 0;
        if (data.timeLimit !== undefined) dbData.time_limit = data.timeLimit;
        if (data.image !== undefined) dbData.image = data.image;
        if (data.imageName !== undefined) dbData.image_name = data.imageName;
        if (data.points !== undefined) dbData.points = data.points;
        if (data.feedback !== undefined) dbData.feedback = data.feedback;
        if (data.blocId !== undefined) dbData.bloc_id = data.blocId;
        if (data.referentiel_id !== undefined) dbData.referentiel_id = data.referentiel_id;
        if (data.theme_id !== undefined) dbData.theme_id = data.theme_id;
        if (data.usageCount !== undefined) dbData.usage_count = data.usageCount;
        if (data.correctResponseRate !== undefined) dbData.correct_response_rate = data.correctResponseRate;
        if (data.slideGuid !== undefined) dbData.slide_guid = data.slideGuid;

        Object.entries(dbData).forEach(([key, value]) => {
            fieldsToUpdate.push(`${key} = ?`);
            params.push(value);
        });

        if (fieldsToUpdate.length === 0) return resolve();
        fieldsToUpdate.push("updated_at = CURRENT_TIMESTAMP");
        params.push(id);
        const sql = `UPDATE questions SET ${fieldsToUpdate.join(', ')} WHERE id = ?`;
        db.run(sql, params, (err) => {
            if (err) reject(err); else resolve();
        });
    });
};
export const updateQuestionImage = (id: number, image: Buffer | null, imageName: string | null): Promise<void> => {
    return new Promise((resolve, reject) => {
        const sql = `UPDATE questions SET image = ?, image_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        db.run(sql, [image, imageName, id], (err) => { if (err) reject(err); else resolve(); });
    });
};
export const deleteQuestion = (id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM questions WHERE id = ?", [id], (err) => { if (err) reject(err); else resolve(); });
    });
};

// Trainer
export interface TrainerData {
    id?: number;
    nom: string;
    prenom: string;
    signature?: Buffer | null;
    isDefault?: number;
    createdAt?: string;
    updatedAt?: string;
}
const mapRowToTrainerData = (row: any): TrainerData | null => {
    if (!row) return null;
    return { id: row.id, nom: row.nom, prenom: row.prenom, signature: row.signature, isDefault: row.is_default, createdAt: row.created_at, updatedAt: row.updated_at };
};
export const addTrainer = (data: Omit<TrainerData, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> => {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO trainers (nom, prenom, signature, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
        db.run(sql, [data.nom, data.prenom, data.signature || null, data.isDefault || 0], function(this: sqlite3.Statement, err) {
            if (err) reject(err);
            else {
                if (data.isDefault === 1) {
                    const newId = this.lastID;
                    db.run("UPDATE trainers SET is_default = 0 WHERE id != ?", [newId], (updateErr) => {
                        if (updateErr) console.error("Erreur lors de la mise à jour des autres formateurs par défaut:", updateErr);
                        resolve(newId);
                    });
                } else {
                    resolve(this.lastID);
                }
            }
        });
    });
};
export const getAllTrainers = (): Promise<TrainerData[]> => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM trainers", [], (err, rows: any[]) => {
            if (err) reject(err); else resolve(rows.map(mapRowToTrainerData).filter(t => t !== null) as TrainerData[]);
        });
    });
};
export const getTrainerById = (id: number): Promise<TrainerData | null> => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM trainers WHERE id = ?", [id], (err, row: any) => {
            if (err) reject(err); else resolve(mapRowToTrainerData(row));
        });
    });
};
export const updateTrainer = (id: number, data: Partial<Omit<TrainerData, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> => {
    return new Promise((resolve, reject) => {
        const fieldsToUpdate: string[] = [];
        const params: any[] = [];
        const dbData: Record<string, any> = {};
        if (data.nom !== undefined) dbData.nom = data.nom;
        if (data.prenom !== undefined) dbData.prenom = data.prenom;
        if (data.signature !== undefined) dbData.signature = data.signature;
        if (data.isDefault !== undefined) dbData.is_default = data.isDefault;
        Object.entries(dbData).forEach(([key, value]) => {
            fieldsToUpdate.push(`${key} = ?`);
            params.push(value);
        });
        if (fieldsToUpdate.length === 0) return resolve();
        fieldsToUpdate.push("updated_at = CURRENT_TIMESTAMP");
        params.push(id);
        const sql = `UPDATE trainers SET ${fieldsToUpdate.join(", ")} WHERE id = ?`;
        db.run(sql, params, (err) => {
            if (err) reject(err);
            else {
                if (data.isDefault === 1) { // Check against camelCase property
                    db.run("UPDATE trainers SET is_default = 0 WHERE id != ?", [id], (updateErr) => {
                        if (updateErr) console.error("Erreur lors de la mise à jour des autres formateurs par défaut (update):", updateErr);
                        resolve();
                    });
                } else {
                    resolve();
                }
            }
        });
    });
};
export const deleteTrainer = (id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM trainers WHERE id = ?", [id], (err) => { if (err) reject(err); else resolve(); });
    });
};
export const getDefaultTrainer = (): Promise<TrainerData | null> => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM trainers WHERE is_default = 1", [], (err, row: any) => {
            if (err) reject(err); else resolve(mapRowToTrainerData(row));
        });
    });
};
export const setDefaultTrainer = (id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run("UPDATE trainers SET is_default = 0", [], (errUpdate) => {
                if (errUpdate) return reject(errUpdate);
                db.run("UPDATE trainers SET is_default = 1 WHERE id = ?", [id], (errSet) => {
                    if (errSet) return reject(errSet);
                    resolve();
                });
            });
        });
    });
};

// VotingDevice
export interface VotingDeviceData {
    id?: number;
    name: string;
    serialNumber?: string | null;
    status?: string;
    createdAt?: string;
    updatedAt?: string;
}
const mapRowToVotingDeviceData = (row: any): VotingDeviceData | null => {
    if (!row) return null;
    return { id: row.id, name: row.name, serialNumber: row.serial_number, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at };
};
export const addVotingDevice = (data: Omit<VotingDeviceData, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> => {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO voting_devices (name, serial_number, status, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
        db.run(sql, [data.name, data.serialNumber || null, data.status || 'available'], function(this: sqlite3.Statement, err) {
            if (err) reject(err); else resolve(this.lastID);
        });
    });
};
export const bulkAddVotingDevices = (devices: Omit<VotingDeviceData, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (devices.length === 0) return resolve();
        db.serialize(() => {
            const stmt = db.prepare("INSERT INTO voting_devices (name, serial_number, status, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)");
            let completed = 0; let failed = 0;
            devices.forEach(device => {
                stmt.run(device.name, device.serialNumber || null, device.status || 'available', function(this: sqlite3.Statement, err) {
                    if (err) { console.error(`Erreur ajout boîtier ${device.name}:`, err.message); failed++; }
                    completed++;
                    if (completed === devices.length) {
                        stmt.finalize((finalizeErr) => {
                            if (finalizeErr) return reject(finalizeErr);
                            if (failed > 0) return reject(new Error(`${failed} boîtiers non ajoutés.`));
                            resolve();
                        });
                    }
                });
            });
        });
    });
};
export const getAllVotingDevices = (): Promise<VotingDeviceData[]> => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM voting_devices", [], (err, rows: any[]) => {
            if (err) reject(err); else resolve(rows.map(mapRowToVotingDeviceData).filter(d => d !== null) as VotingDeviceData[]);
        });
    });
};
export const getVotingDeviceById = (id: number): Promise<VotingDeviceData | null> => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM voting_devices WHERE id = ?", [id], (err, row: any) => {
            if (err) reject(err); else resolve(mapRowToVotingDeviceData(row));
        });
    });
};
export const getVotingDeviceBySerialNumber = (serialNumber: string): Promise<VotingDeviceData | null> => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM voting_devices WHERE serial_number = ?", [serialNumber], (err, row: any) => {
            if (err) reject(err); else resolve(mapRowToVotingDeviceData(row));
        });
    });
};
export const updateVotingDevice = (id: number, data: Partial<Omit<VotingDeviceData, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> => {
    return new Promise((resolve, reject) => {
        const fieldsToUpdate: string[] = []; const params: any[] = [];
        const dbData: Record<string, any> = {};
        if (data.name !== undefined) dbData.name = data.name;
        if (data.serialNumber !== undefined) dbData.serial_number = data.serialNumber;
        if (data.status !== undefined) dbData.status = data.status;
        Object.entries(dbData).forEach(([key, value]) => { fieldsToUpdate.push(`${key} = ?`); params.push(value); });
        if (fieldsToUpdate.length === 0) return resolve();
        fieldsToUpdate.push("updated_at = CURRENT_TIMESTAMP"); params.push(id);
        const sql = `UPDATE voting_devices SET ${fieldsToUpdate.join(", ")} WHERE id = ?`;
        db.run(sql, params, (err) => { if (err) reject(err); else resolve(); });
    });
};
export const deleteVotingDevice = (id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM voting_devices WHERE id = ?", [id], (err) => { if (err) reject(err); else resolve(); });
    });
};

// DeviceKit
export interface DeviceKitData {
    id?: number;
    name: string;
    description?: string | null;
    isDefault?: number;
    createdAt?: string;
    updatedAt?: string;
    voting_devices?: VotingDeviceData[];
}
const mapRowToDeviceKitData = (row: any): DeviceKitData | null => {
    if (!row) return null;
    return { id: row.id, name: row.name, description: row.description, isDefault: row.is_default, createdAt: row.created_at, updatedAt: row.updated_at };
};
export const addDeviceKit = (data: Omit<DeviceKitData, 'id' | 'createdAt' | 'updatedAt' | 'voting_devices'>): Promise<number> => {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO device_kits (name, description, is_default, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
        db.run(sql, [data.name, data.description || null, data.isDefault || 0], function(this: sqlite3.Statement, err) {
            if (err) reject(err);
            else {
                if (data.isDefault === 1) {
                    const newId = this.lastID;
                    db.run("UPDATE device_kits SET is_default = 0 WHERE id != ?", [newId], (updateErr) => {
                        if (updateErr) console.error("Erreur màj autres kits par défaut:", updateErr);
                        resolve(newId);
                    });
                } else { resolve(this.lastID); }
            }
        });
    });
};
export const getAllDeviceKits = (): Promise<DeviceKitData[]> => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM device_kits", [], (err, rows: any[]) => {
            if (err) reject(err); else resolve(rows.map(mapRowToDeviceKitData).filter(dk => dk !== null) as DeviceKitData[]);
        });
    });
};
export const getDeviceKitById = (id: number): Promise<DeviceKitData | null> => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM device_kits WHERE id = ?", [id], (err, row: any) => {
            if (err) reject(err); else resolve(mapRowToDeviceKitData(row));
        });
    });
};
export const updateDeviceKit = (id: number, data: Partial<Omit<DeviceKitData, 'id' | 'createdAt' | 'updatedAt' | 'voting_devices'>>): Promise<void> => {
    return new Promise((resolve, reject) => {
        const fieldsToUpdate: string[] = []; const params: any[] = [];
        const dbData: Record<string, any> = {};
        if (data.name !== undefined) dbData.name = data.name;
        if (data.description !== undefined) dbData.description = data.description;
        if (data.isDefault !== undefined) dbData.is_default = data.isDefault;
        Object.entries(dbData).forEach(([key, value]) => { fieldsToUpdate.push(`${key} = ?`); params.push(value); });
        if (fieldsToUpdate.length === 0) return resolve();
        fieldsToUpdate.push("updated_at = CURRENT_TIMESTAMP"); params.push(id);
        const sql = `UPDATE device_kits SET ${fieldsToUpdate.join(", ")} WHERE id = ?`;
        db.run(sql, params, (err) => {
            if (err) reject(err);
            else {
                 if (data.isDefault === 1) {
                    db.run("UPDATE device_kits SET is_default = 0 WHERE id != ?", [id], (updateErr) => {
                        if (updateErr) console.error("Erreur màj autres kits par défaut (update):", updateErr);
                        resolve();
                    });
                } else { resolve(); }
            }
        });
    });
};
export const deleteDeviceKit = (id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM device_kits WHERE id = ?", [id], (err) => { if (err) reject(err); else resolve(); });
    });
};
export const getDefaultDeviceKit = (): Promise<DeviceKitData | null> => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM device_kits WHERE is_default = 1", [], (err, row: any) => {
            if (err) reject(err); else resolve(mapRowToDeviceKitData(row));
        });
    });
};
export const setDefaultDeviceKit = (id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run("UPDATE device_kits SET is_default = 0", [], (errUpdate) => {
                if (errUpdate) return reject(errUpdate);
                db.run("UPDATE device_kits SET is_default = 1 WHERE id = ?", [id], (errSet) => {
                    if (errSet) return reject(errSet);
                    resolve();
                });
            });
        });
    });
};

// DeviceKitAssignment
export interface DeviceKitAssignmentData {
    id?: number;
    kitId: number;
    votingDeviceId: number;
    assignedAt?: string;
}
const mapRowToDeviceKitAssignmentData = (row: any): DeviceKitAssignmentData | null => {
    if (!row) return null;
    return { id: row.id, kitId: row.kit_id, votingDeviceId: row.voting_device_id, assignedAt: row.assigned_at };
};
export const assignDeviceToKit = (kitId: number, votingDeviceId: number): Promise<number> => {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO device_kit_assignments (kit_id, voting_device_id, assigned_at) VALUES (?, ?, CURRENT_TIMESTAMP)`;
        db.run(sql, [kitId, votingDeviceId], function(this: sqlite3.Statement, err) {
            if (err) reject(err); else resolve(this.lastID);
        });
    });
};
export const removeDeviceFromKit = (kitId: number, votingDeviceId: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM device_kit_assignments WHERE kit_id = ? AND voting_device_id = ?", [kitId, votingDeviceId], (err) => {
            if (err) reject(err); else resolve();
        });
    });
};
export const getVotingDevicesForKit = (kitId: number): Promise<VotingDeviceData[]> => {
    return new Promise((resolve, reject) => {
        const sql = `SELECT vd.* FROM voting_devices vd JOIN device_kit_assignments dka ON vd.id = dka.voting_device_id WHERE dka.kit_id = ?`;
        db.all(sql, [kitId], (err, rows: any[]) => {
            if (err) reject(err); else resolve(rows.map(mapRowToVotingDeviceData).filter(d => d !== null) as VotingDeviceData[]);
        });
    });
};
export const getKitsForVotingDevice = (votingDeviceId: number): Promise<DeviceKitData[]> => {
    return new Promise((resolve, reject) => {
        const sql = `SELECT dk.* FROM device_kits dk JOIN device_kit_assignments dka ON dk.id = dka.kit_id WHERE dka.voting_device_id = ?`;
        db.all(sql, [votingDeviceId], (err, rows: any[]) => {
            if (err) reject(err); else resolve(rows.map(mapRowToDeviceKitData).filter(dk => dk !== null) as DeviceKitData[]);
        });
    });
};

// Session, SessionParticipant, SessionQuestion, SessionBoitier, SessionResult (déjà harmonisés plus haut)
// AdminSettings (déjà en camelCase ou géré)

export const closeDb = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) { console.error('Erreur fermeture DB (db.ts):', err.message); reject(err); }
      else { console.log('DB fermée (db.ts).'); resolve(); }
    });
  });
};
[end of src/db.ts]
