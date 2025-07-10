// This is the backend src/db.ts file.
// It contains the SQLite database logic and CRUD functions.
// Interfaces are defined and exported here for use in main.ts.

import sqlite3 from 'sqlite3';
import path from 'path';
import { app } from 'electron';

const verboseSqlite3 = sqlite3.verbose();
const dbPath = path.join(app.getPath('userData'), 'easycertif.db');
console.log(`Chemin de la base de données SQLite : ${dbPath}`);

const db = new verboseSqlite3.Database(dbPath, (err) => {
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
        options TEXT,
        image BLOB,
        image_name TEXT,
        points INTEGER DEFAULT 1,
        feedback TEXT,
        bloc_id INTEGER NOT NULL,
        referentiel_id INTEGER,
        theme_id INTEGER,
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
        is_default INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(nom, prenom)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS voting_devices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        serial_number TEXT UNIQUE,
        status TEXT DEFAULT 'available',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS device_kits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        is_default INTEGER DEFAULT 0,
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
        status TEXT DEFAULT 'planifiée',
        referentiel_id INTEGER,
        theme_id INTEGER,
        trainer_id INTEGER,
        default_voting_device_kit_id INTEGER,
        selectedBlocIds TEXT,
        questionMappings TEXT,
        ignoredSlideGuids TEXT,
        resolvedImportAnomalies TEXT,
        donneesOrs BLOB,
        nomFichierOrs TEXT,
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
        score INTEGER,
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

export interface GeneralParticipantData {
    id: number;
    nom: string;
    prenom?: string | null;
    identification_code?: string | null;
    created_at?: string;
    updated_at?: string;
}

export const addGeneralParticipant = (nom: string, prenom?: string, identification_code?: string): Promise<number> => {
    return new Promise((resolve, reject) => {
        const sqlCheck = `SELECT id FROM participants WHERE nom = ?${prenom ? ' AND prenom = ?' : ' AND prenom IS NULL'}${identification_code ? ' AND identification_code = ?' : ' AND identification_code IS NULL'}`;
        const paramsCheck = [nom];
        if (prenom) paramsCheck.push(prenom);
        if (identification_code) paramsCheck.push(identification_code);
        db.get(sqlCheck, paramsCheck, (err, row: {id: number}) => {
            if (err) return reject(err);
            if (row) return resolve(row.id);
            const sqlInsert = `INSERT INTO participants (nom, prenom, identification_code, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`;
            const paramsInsert = [nom, prenom || null, identification_code || null];
            db.run(sqlInsert, paramsInsert, function (this, insertErr) {
                if (insertErr) return reject(insertErr);
                resolve(this.lastID);
            });
        });
    });
};

export const getAllGeneralParticipants = (): Promise<GeneralParticipantData[]> => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM participants", [], (err, rows: GeneralParticipantData[]) => {
            if (err) reject(err); else resolve(rows);
        });
    });
};

export const getGeneralParticipantById = (id: number): Promise<GeneralParticipantData | null> => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM participants WHERE id = ?", [id], (err, row: GeneralParticipantData) => {
            if (err) reject(err); else resolve(row || null);
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

export interface ReferentialData {
    id: number;
    code: string;
    nom_complet: string;
    created_at?: string;
    updated_at?: string;
}

export const addReferentiel = (code: string, nom_complet: string): Promise<number> => {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO referentiels (code, nom_complet, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)`;
        db.run(sql, [code, nom_complet], function(this, err) {
            if (err) reject(err); else resolve(this.lastID);
        });
    });
};

export const getAllReferentiels = (): Promise<ReferentialData[]> => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM referentiels", [], (err, rows: ReferentialData[]) => {
            if (err) reject(err); else resolve(rows);
        });
    });
};

export const getReferentielById = (id: number): Promise<ReferentialData | null> => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM referentiels WHERE id = ?", [id], (err, row: ReferentialData) => {
            if (err) reject(err); else resolve(row || null);
        });
    });
};

export const updateReferentiel = (id: number, code: string, nom_complet: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const sql = `UPDATE referentiels SET code = ?, nom_complet = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        db.run(sql, [code, nom_complet, id], (err) => {
            if (err) reject(err); else resolve();
        });
    });
};

export const deleteReferentiel = (id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM referentiels WHERE id = ?", [id], (err) => {
            if (err) reject(err); else resolve();
        });
    });
};

export interface ThemeData {
    id: number;
    code_theme: string;
    nom_complet: string;
    referentiel_id: number;
    created_at?: string;
    updated_at?: string;
}

export const addTheme = (code_theme: string, nom_complet: string, referentiel_id: number): Promise<number> => {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO themes (code_theme, nom_complet, referentiel_id, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`;
        db.run(sql, [code_theme, nom_complet, referentiel_id], function(this, err) {
            if (err) reject(err); else resolve(this.lastID);
        });
    });
};

export const getAllThemes = (): Promise<ThemeData[]> => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM themes", [], (err, rows: ThemeData[]) => {
            if (err) reject(err); else resolve(rows);
        });
    });
};

export const getThemesByReferentielId = (referentiel_id: number): Promise<ThemeData[]> => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM themes WHERE referentiel_id = ?", [referentiel_id], (err, rows: ThemeData[]) => {
            if (err) reject(err); else resolve(rows);
        });
    });
};

export const getThemeById = (id: number): Promise<ThemeData | null> => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM themes WHERE id = ?", [id], (err, row: ThemeData) => {
            if (err) reject(err); else resolve(row || null);
        });
    });
};

export const updateTheme = (id: number, code_theme: string, nom_complet: string, referentiel_id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        const sql = `UPDATE themes SET code_theme = ?, nom_complet = ?, referentiel_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        db.run(sql, [code_theme, nom_complet, referentiel_id, id], (err) => {
            if (err) reject(err); else resolve();
        });
    });
};

export const deleteTheme = (id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM themes WHERE id = ?", [id], (err) => {
            if (err) reject(err); else resolve();
        });
    });
};

export interface BlocData {
    id: number;
    code_bloc: string;
    nom_complet?: string | null;
    theme_id: number;
    created_at?: string;
    updated_at?: string;
}

export const addBloc = (code_bloc: string, theme_id: number, nom_complet?: string): Promise<number> => {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO blocs (code_bloc, nom_complet, theme_id, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`;
        db.run(sql, [code_bloc, nom_complet || null, theme_id], function(this, err) {
            if (err) reject(err); else resolve(this.lastID);
        });
    });
};

export const getAllBlocs = (): Promise<BlocData[]> => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM blocs", [], (err, rows: BlocData[]) => {
            if (err) reject(err); else resolve(rows);
        });
    });
};

export const getBlocsByThemeId = (theme_id: number): Promise<BlocData[]> => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM blocs WHERE theme_id = ?", [theme_id], (err, rows: BlocData[]) => {
            if (err) reject(err); else resolve(rows);
        });
    });
};

export const getBlocById = (id: number): Promise<BlocData | null> => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM blocs WHERE id = ?", [id], (err, row: BlocData) => {
            if (err) reject(err); else resolve(row || null);
        });
    });
};

export const updateBloc = (id: number, code_bloc: string, theme_id: number, nom_complet?: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const sql = `UPDATE blocs SET code_bloc = ?, nom_complet = ?, theme_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        db.run(sql, [code_bloc, nom_complet || null, theme_id, id], (err) => {
            if (err) reject(err); else resolve();
        });
    });
};

export const deleteBloc = (id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM blocs WHERE id = ?", [id], (err) => {
            if (err) reject(err); else resolve();
        });
    });
};

export interface QuestionOption {
    texte: string;
    estCorrecte: boolean;
}

export interface QuestionData {
    id?: number;
    texte_question: string;
    type_question: 'QCM' | 'QCS' | 'QROC' | 'Oral' | 'Pratique';
    options?: QuestionOption[] | string | null;
    image?: Buffer | null;
    image_name?: string | null;
    points?: number;
    feedback?: string | null;
    bloc_id: number;
    referentiel_id?: number | null;
    theme_id?: number | null;
    created_at?: string;
    updated_at?: string;
}

export const addQuestion = (data: QuestionData): Promise<number> => {
    return new Promise((resolve, reject) => {
        const optionsJSON = typeof data.options === 'string' ? data.options : (data.options ? JSON.stringify(data.options) : null);
        const sql = `INSERT INTO questions (texte_question, type_question, options, image, image_name, points, feedback, bloc_id, referentiel_id, theme_id, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;
        const params = [
            data.texte_question, data.type_question, optionsJSON,
            data.image || null, data.image_name || null, data.points || 1, data.feedback || null,
            data.bloc_id, data.referentiel_id || null, data.theme_id || null
        ];
        db.run(sql, params, function(this, err) {
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
        db.all("SELECT * FROM questions", [], (err, rows: QuestionData[]) => {
            if (err) reject(err); else resolve(rows.map(parseQuestionOptions));
        });
    });
};

export const getQuestionsByBlocId = (bloc_id: number): Promise<QuestionData[]> => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM questions WHERE bloc_id = ?", [bloc_id], (err, rows: QuestionData[]) => {
            if (err) reject(err); else resolve(rows.map(parseQuestionOptions));
        });
    });
};

export const getQuestionById = (id: number): Promise<QuestionData | null> => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM questions WHERE id = ?", [id], (err, row: QuestionData) => {
            if (err) reject(err); else resolve(row ? parseQuestionOptions(row) : null);
        });
    });
};

export const updateQuestion = (id: number, data: Partial<QuestionData>): Promise<void> => {
    return new Promise((resolve, reject) => {
        const fields: string[] = [];
        const params: any[] = [];
        Object.entries(data).forEach(([key, value]) => {
            if (key === 'id' || key === 'created_at' || key === 'updated_at') return;
            if (key === 'options') {
                fields.push("options = ?");
                params.push(typeof value === 'string' ? value : (value ? JSON.stringify(value) : null));
            } else {
                fields.push(`${key} = ?`);
                params.push(value);
            }
        });
        if (fields.length === 0) return resolve();
        fields.push("updated_at = CURRENT_TIMESTAMP");
        params.push(id);
        const sql = `UPDATE questions SET ${fields.join(', ')} WHERE id = ?`;
        db.run(sql, params, (err) => {
            if (err) reject(err); else resolve();
        });
    });
};

export const updateQuestionImage = (id: number, image: Buffer | null, imageName: string | null): Promise<void> => {
    return new Promise((resolve, reject) => {
        const sql = `UPDATE questions SET image = ?, image_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        db.run(sql, [image, imageName, id], (err) => {
            if (err) reject(err); else resolve();
        });
    });
};

export const deleteQuestion = (id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM questions WHERE id = ?", [id], (err) => {
            if (err) reject(err); else resolve();
        });
    });
};

export interface TrainerData {
    id?: number;
    nom: string;
    prenom: string;
    signature?: Buffer | null;
    is_default?: number;
    created_at?: string;
    updated_at?: string;
}

export const addTrainer = (data: Omit<TrainerData, 'id' | 'created_at' | 'updated_at'>): Promise<number> => {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO trainers (nom, prenom, signature, is_default, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`;
        db.run(sql, [data.nom, data.prenom, data.signature || null, data.is_default || 0], function(this, err) {
            if (err) reject(err);
            else {
                if (data.is_default === 1) {
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
        db.all("SELECT * FROM trainers", [], (err, rows: TrainerData[]) => {
            if (err) reject(err); else resolve(rows);
        });
    });
};

export const getTrainerById = (id: number): Promise<TrainerData | null> => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM trainers WHERE id = ?", [id], (err, row: TrainerData) => {
            if (err) reject(err); else resolve(row || null);
        });
    });
};

export const updateTrainer = (id: number, data: Partial<Omit<TrainerData, 'id' | 'created_at' | 'updated_at'>>): Promise<void> => {
    return new Promise((resolve, reject) => {
        const fields: string[] = [];
        const params: any[] = [];
        Object.entries(data).forEach(([key, value]) => {
            fields.push(`${key} = ?`);
            params.push(value);
        });
        if (fields.length === 0) return resolve();
        fields.push("updated_at = CURRENT_TIMESTAMP");
        params.push(id);
        const sql = `UPDATE trainers SET ${fields.join(", ")} WHERE id = ?`;
        db.run(sql, params, (err) => {
            if (err) reject(err);
            else {
                if (data.is_default === 1) {
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
        db.run("DELETE FROM trainers WHERE id = ?", [id], (err) => {
            if (err) reject(err); else resolve();
        });
    });
};

export const getDefaultTrainer = (): Promise<TrainerData | null> => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM trainers WHERE is_default = 1", [], (err, row: TrainerData) => {
            if (err) reject(err); else resolve(row || null);
        });
    });
};

export const setDefaultTrainer = (id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run("UPDATE trainers SET is_default = 0", [], (err) => {
                if (err) return reject(err);
            });
            db.run("UPDATE trainers SET is_default = 1 WHERE id = ?", [id], (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    });
};

export interface VotingDeviceData {
    id?: number;
    name: string;
    serial_number?: string | null;
    status?: string;
    created_at?: string;
    updated_at?: string;
}

export const addVotingDevice = (data: Omit<VotingDeviceData, 'id' | 'created_at' | 'updated_at'>): Promise<number> => {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO voting_devices (name, serial_number, status, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`;
        db.run(sql, [data.name, data.serial_number || null, data.status || 'available'], function(this, err) {
            if (err) reject(err); else resolve(this.lastID);
        });
    });
};

export const bulkAddVotingDevices = (devices: Omit<VotingDeviceData, 'id' | 'created_at' | 'updated_at'>[]): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (devices.length === 0) return resolve();
        db.serialize(() => {
            const stmt = db.prepare("INSERT INTO voting_devices (name, serial_number, status, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)");
            let completed = 0;
            let failed = 0;
            devices.forEach(device => {
                stmt.run(device.name, device.serial_number || null, device.status || 'available', function(this, err) {
                    if (err) {
                        console.error(`Erreur lors de l'ajout du boîtier ${device.name}:`, err.message);
                        failed++;
                    }
                    completed++;
                    if (completed === devices.length) {
                        stmt.finalize((finalizeErr) => {
                            if (finalizeErr) return reject(finalizeErr);
                            if (failed > 0) return reject(new Error(`${failed} boîtiers n'ont pas pu être ajoutés.`));
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
        db.all("SELECT * FROM voting_devices", [], (err, rows: VotingDeviceData[]) => {
            if (err) reject(err); else resolve(rows);
        });
    });
};

export const getVotingDeviceById = (id: number): Promise<VotingDeviceData | null> => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM voting_devices WHERE id = ?", [id], (err, row: VotingDeviceData) => {
            if (err) reject(err); else resolve(row || null);
        });
    });
};

export const getVotingDeviceBySerialNumber = (serialNumber: string): Promise<VotingDeviceData | null> => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM voting_devices WHERE serial_number = ?", [serialNumber], (err, row: VotingDeviceData) => {
            if (err) reject(err); else resolve(row || null);
        });
    });
};

export const updateVotingDevice = (id: number, data: Partial<Omit<VotingDeviceData, 'id' | 'created_at' | 'updated_at'>>): Promise<void> => {
    return new Promise((resolve, reject) => {
        const fields: string[] = [];
        const params: any[] = [];
        Object.entries(data).forEach(([key, value]) => {
            fields.push(`${key} = ?`);
            params.push(value);
        });
        if (fields.length === 0) return resolve();
        fields.push("updated_at = CURRENT_TIMESTAMP");
        params.push(id);
        const sql = `UPDATE voting_devices SET ${fields.join(", ")} WHERE id = ?`;
        db.run(sql, params, (err) => {
            if (err) reject(err); else resolve();
        });
    });
};

export const deleteVotingDevice = (id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM voting_devices WHERE id = ?", [id], (err) => {
            if (err) reject(err); else resolve();
        });
    });
};

export interface DeviceKitData {
    id?: number;
    name: string;
    description?: string | null;
    is_default?: number;
    created_at?: string;
    updated_at?: string;
    voting_devices?: VotingDeviceData[];
}

export const addDeviceKit = (data: Omit<DeviceKitData, 'id' | 'created_at' | 'updated_at' | 'voting_devices'>): Promise<number> => {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO device_kits (name, description, is_default, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`;
        db.run(sql, [data.name, data.description || null, data.is_default || 0], function(this, err) {
            if (err) reject(err);
            else {
                if (data.is_default === 1) {
                    const newId = this.lastID;
                    db.run("UPDATE device_kits SET is_default = 0 WHERE id != ?", [newId], (updateErr) => {
                        if (updateErr) console.error("Erreur lors de la mise à jour des autres kits par défaut:", updateErr);
                        resolve(newId);
                    });
                } else {
                    resolve(this.lastID);
                }
            }
        });
    });
};

export const getAllDeviceKits = (): Promise<DeviceKitData[]> => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM device_kits", [], (err, rows: DeviceKitData[]) => {
            if (err) reject(err); else resolve(rows);
        });
    });
};

export const getDeviceKitById = (id: number): Promise<DeviceKitData | null> => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM device_kits WHERE id = ?", [id], (err, row: DeviceKitData) => {
            if (err) reject(err); else resolve(row || null);
        });
    });
};

export const updateDeviceKit = (id: number, data: Partial<Omit<DeviceKitData, 'id' | 'created_at' | 'updated_at' | 'voting_devices'>>): Promise<void> => {
    return new Promise((resolve, reject) => {
        const fields: string[] = [];
        const params: any[] = [];
        Object.entries(data).forEach(([key, value]) => {
            fields.push(`${key} = ?`);
            params.push(value);
        });
        if (fields.length === 0) return resolve();
        fields.push("updated_at = CURRENT_TIMESTAMP");
        params.push(id);
        const sql = `UPDATE device_kits SET ${fields.join(", ")} WHERE id = ?`;
        db.run(sql, params, (err) => {
            if (err) reject(err);
            else {
                 if (data.is_default === 1) {
                    db.run("UPDATE device_kits SET is_default = 0 WHERE id != ?", [id], (updateErr) => {
                        if (updateErr) console.error("Erreur lors de la mise à jour des autres kits par défaut (update):", updateErr);
                        resolve();
                    });
                } else {
                    resolve();
                }
            }
        });
    });
};

export const deleteDeviceKit = (id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM device_kits WHERE id = ?", [id], (err) => {
            if (err) reject(err); else resolve();
        });
    });
};

export const getDefaultDeviceKit = (): Promise<DeviceKitData | null> => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM device_kits WHERE is_default = 1", [], (err, row: DeviceKitData) => {
            if (err) reject(err); else resolve(row || null);
        });
    });
};

export const setDefaultDeviceKit = (id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run("UPDATE device_kits SET is_default = 0", [], (err) => {
                if (err) return reject(err);
            });
            db.run("UPDATE device_kits SET is_default = 1 WHERE id = ?", [id], (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    });
};

export interface DeviceKitAssignmentData {
    id?: number;
    kit_id: number;
    voting_device_id: number;
    assigned_at?: string;
}

export const assignDeviceToKit = (kit_id: number, voting_device_id: number): Promise<number> => {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO device_kit_assignments (kit_id, voting_device_id) VALUES (?, ?)`;
        db.run(sql, [kit_id, voting_device_id], function(this, err) {
            if (err) reject(err); else resolve(this.lastID);
        });
    });
};

export const removeDeviceFromKit = (kit_id: number, voting_device_id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM device_kit_assignments WHERE kit_id = ? AND voting_device_id = ?", [kit_id, voting_device_id], (err) => {
            if (err) reject(err); else resolve();
        });
    });
};

export const getVotingDevicesForKit = (kit_id: number): Promise<VotingDeviceData[]> => {
    return new Promise((resolve, reject) => {
        const sql = `SELECT vd.* FROM voting_devices vd JOIN device_kit_assignments dka ON vd.id = dka.voting_device_id WHERE dka.kit_id = ?`;
        db.all(sql, [kit_id], (err, rows: VotingDeviceData[]) => {
            if (err) reject(err); else resolve(rows);
        });
    });
};

export const getKitsForVotingDevice = (voting_device_id: number): Promise<DeviceKitData[]> => {
    return new Promise((resolve, reject) => {
        const sql = `SELECT dk.* FROM device_kits dk JOIN device_kit_assignments dka ON dk.id = dka.kit_id WHERE dka.voting_device_id = ?`;
        db.all(sql, [voting_device_id], (err, rows: DeviceKitData[]) => {
            if (err) reject(err); else resolve(rows);
        });
    });
};

export interface SessionData {
    id?: number;
    nomSession: string;
    dateSession: string;
    typeSession?: string | null;
    status?: string;
    referentiel_id?: number | null;
    theme_id?: number | null;
    trainer_id?: number | null;
    default_voting_device_kit_id?: number | null;
    selectedBlocIds?: number[] | string | null;
    questionMappings?: any[] | string | null;
    ignoredSlideGuids?: string[] | string | null;
    resolvedImportAnomalies?: object | string | null;
    donneesOrs?: Buffer | null;
    nomFichierOrs?: string | null;
    participants?: SessionParticipantData[];
    created_at?: string;
    updated_at?: string;
}

export interface SessionParticipantData {
    id?: number;
    session_id?: number;
    nom: string;
    prenom?: string | null;
    identification_code?: string | null;
    score?: number | null;
    reussite?: number | null;
    status_in_session?: string;
    assigned_voting_device_id?: number | null;
    original_participant_id?: number | null;
    created_at?: string;
    updated_at?: string;
}

export const addSession = (data: SessionData): Promise<number> => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            const selectedBlocIdsJSON = typeof data.selectedBlocIds === 'string' ? data.selectedBlocIds : (data.selectedBlocIds ? JSON.stringify(data.selectedBlocIds) : null);
            const questionMappingsJSON = typeof data.questionMappings === 'string' ? data.questionMappings : (data.questionMappings ? JSON.stringify(data.questionMappings) : null);
            const ignoredSlideGuidsJSON = typeof data.ignoredSlideGuids === 'string' ? data.ignoredSlideGuids : (data.ignoredSlideGuids ? JSON.stringify(data.ignoredSlideGuids) : null);
            const resolvedImportAnomaliesJSON = typeof data.resolvedImportAnomalies === 'string' ? data.resolvedImportAnomalies : (data.resolvedImportAnomalies ? JSON.stringify(data.resolvedImportAnomalies) : null);
            const sqlSession = `INSERT INTO sessions (nomSession, dateSession, typeSession, status, referentiel_id, theme_id, trainer_id, default_voting_device_kit_id, selectedBlocIds, questionMappings, ignoredSlideGuids, resolvedImportAnomalies, donneesOrs, nomFichierOrs, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;
            const paramsSession = [data.nomSession, data.dateSession, data.typeSession || null, data.status || 'planifiée', data.referentiel_id || null, data.theme_id || null, data.trainer_id || null, data.default_voting_device_kit_id || null, selectedBlocIdsJSON, questionMappingsJSON, ignoredSlideGuidsJSON, resolvedImportAnomaliesJSON, data.donneesOrs || null, data.nomFichierOrs || null];
            db.run(sqlSession, paramsSession, function(this, err) {
                if (err) { db.run("ROLLBACK"); return reject(err); }
                const sessionId = this.lastID;
                if (data.participants && data.participants.length > 0) {
                    const sqlParticipant = `INSERT INTO session_participants (session_id, nom, prenom, identification_code, score, reussite, status_in_session, assigned_voting_device_id, original_participant_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;
                    let participantsCompleted = 0;
                    let firstError: Error | null = null;
                    data.participants.forEach(p => {
                        const paramsP = [sessionId, p.nom, p.prenom || null, p.identification_code || null, p.score || null, p.reussite === 1 ? 1 : (p.reussite === 0 ? 0 : null), p.status_in_session || 'inscrit', p.assigned_voting_device_id || null, p.original_participant_id || null];
                        db.run(sqlParticipant, paramsP, (pErr) => {
                            if (pErr && !firstError) firstError = pErr;
                            participantsCompleted++;
                            if (participantsCompleted === data.participants!.length) {
                                if (firstError) { db.run("ROLLBACK"); return reject(firstError); }
                                db.run("COMMIT"); resolve(sessionId);
                            }
                        });
                    });
                    if (firstError && participantsCompleted < data.participants.length) { db.run("ROLLBACK"); return reject(firstError); }
                } else {
                    db.run("COMMIT"); resolve(sessionId);
                }
            });
        });
    });
};

const parseSessionJSONFields = (session: SessionData): SessionData => {
    const fieldsToParse: (keyof SessionData)[] = ['selectedBlocIds', 'questionMappings', 'ignoredSlideGuids', 'resolvedImportAnomalies'];
    fieldsToParse.forEach(field => {
        if (session[field] && typeof session[field] === 'string') {
            try { (session as any)[field] = JSON.parse(session[field] as string); }
            catch (e) { console.error(`Erreur de parsing JSON pour ${field} session ${session.id}:`, e); (session as any)[field] = null; }
        }
    });
    return session;
};

export const getSessionById = (id: number): Promise<SessionData | null> => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM sessions WHERE id = ?", [id], (err, sessionRow: SessionData) => {
            if (err) return reject(err);
            if (!sessionRow) return resolve(null);
            const parsedSession = parseSessionJSONFields(sessionRow);
            db.all("SELECT * FROM session_participants WHERE session_id = ?", [id], (pErr, participantRows: SessionParticipantData[]) => {
                if (pErr) return reject(pErr);
                parsedSession.participants = participantRows;
                resolve(parsedSession);
            });
        });
    });
};

export const getAllSessionsWithParticipants = (): Promise<SessionData[]> => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM sessions", [], (err, sessionRows: SessionData[]) => {
            if (err) return reject(err);
            if (sessionRows.length === 0) return resolve([]);
            const sessionsWithParticipants: SessionData[] = [];
            let sessionsProcessed = 0;
            sessionRows.forEach(sessionRow => {
                const parsedSession = parseSessionJSONFields(sessionRow);
                db.all("SELECT * FROM session_participants WHERE session_id = ?", [parsedSession.id!], (pErr, participantRows: SessionParticipantData[]) => {
                    if (pErr) { console.error(`Erreur get participants session ${parsedSession.id!}:`, pErr); parsedSession.participants = []; }
                    else { parsedSession.participants = participantRows; }
                    sessionsWithParticipants.push(parsedSession);
                    sessionsProcessed++;
                    if (sessionsProcessed === sessionRows.length) resolve(sessionsWithParticipants);
                });
            });
        });
    });
};

export const updateSession = (id: number, data: Partial<SessionData>): Promise<void> => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            const fields: string[] = []; const params: any[] = [];
            Object.entries(data).forEach(([key, value]) => {
                if (key === 'id' || key === 'created_at' || key === 'updated_at' || key === 'participants') return;
                let valToStore = value;
                if (['selectedBlocIds', 'questionMappings', 'ignoredSlideGuids', 'resolvedImportAnomalies'].includes(key)) {
                    valToStore = typeof value === 'string' ? value : (value ? JSON.stringify(value) : null);
                }
                fields.push(`${key} = ?`); params.push(valToStore);
            });
            if (fields.length > 0) {
                fields.push("updated_at = CURRENT_TIMESTAMP"); params.push(id);
                const sqlSessionUpdate = `UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`;
                db.run(sqlSessionUpdate, params, (sErr) => { if (sErr) { db.run("ROLLBACK"); return reject(sErr); } });
            }
            if (data.participants) {
                db.run("DELETE FROM session_participants WHERE session_id = ?", [id], (delErr) => {
                    if (delErr) { db.run("ROLLBACK"); return reject(delErr); }
                    if (data.participants!.length > 0) {
                        const sqlParticipant = `INSERT INTO session_participants (session_id, nom, prenom, identification_code, score, reussite, status_in_session, assigned_voting_device_id, original_participant_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;
                        let participantsCompleted = 0; let participantInsertError: Error | null = null;
                        data.participants!.forEach(p => {
                            const paramsP = [id, p.nom, p.prenom || null, p.identification_code || null, p.score || null, p.reussite === 1 ? 1 : (p.reussite === 0 ? 0 : null), p.status_in_session || 'inscrit', p.assigned_voting_device_id || null, p.original_participant_id || null];
                            db.run(sqlParticipant, paramsP, (pErr) => {
                                if (pErr && !participantInsertError) participantInsertError = pErr;
                                participantsCompleted++;
                                if (participantsCompleted === data.participants!.length) {
                                    if (participantInsertError) { db.run("ROLLBACK"); return reject(participantInsertError); }
                                    db.run("COMMIT"); resolve();
                                }
                            });
                        });
                        if (participantInsertError && participantsCompleted < data.participants!.length) { db.run("ROLLBACK"); return reject(participantInsertError); }
                    } else { db.run("COMMIT"); resolve(); }
                });
            } else {
                if (fields.length > 0) { db.run("COMMIT"); resolve(); }
                else { db.run("COMMIT"); resolve(); }
            }
        });
    });
};

export const deleteSession = (id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM sessions WHERE id = ?", [id], (err) => { if (err) reject(err); else resolve(); });
    });
};

export const addSessionParticipant = (sessionId: number, participantData: Omit<SessionParticipantData, 'id' | 'session_id' | 'created_at' | 'updated_at'>): Promise<number> => {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO session_participants (session_id, nom, prenom, identification_code, score, reussite, status_in_session, assigned_voting_device_id, original_participant_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;
        const params = [sessionId, participantData.nom, participantData.prenom || null, participantData.identification_code || null, participantData.score || null, participantData.reussite === 1 ? 1 : (participantData.reussite === 0 ? 0 : null), participantData.status_in_session || 'inscrit', participantData.assigned_voting_device_id || null, participantData.original_participant_id || null];
        db.run(sql, params, function(this, err) { if (err) reject(err); else resolve(this.lastID); });
    });
};

export const getSessionParticipantsBySessionId = (sessionId: number): Promise<SessionParticipantData[]> => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM session_participants WHERE session_id = ?", [sessionId], (err, rows: SessionParticipantData[]) => { if (err) reject(err); else resolve(rows); });
    });
};

export const updateSessionParticipant = (participantId: number, data: Partial<Omit<SessionParticipantData, 'id' | 'session_id' | 'created_at' | 'updated_at'>>): Promise<void> => {
    return new Promise((resolve, reject) => {
        const fields: string[] = []; const params: any[] = [];
        Object.entries(data).forEach(([key, value]) => { fields.push(`${key} = ?`); params.push(value); });
        if (fields.length === 0) return resolve();
        fields.push("updated_at = CURRENT_TIMESTAMP"); params.push(participantId);
        const sql = `UPDATE session_participants SET ${fields.join(", ")} WHERE id = ?`;
        db.run(sql, params, (err) => { if (err) reject(err); else resolve(); });
    });
};

export const deleteSessionParticipant = (participantId: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM session_participants WHERE id = ?", [participantId], (err) => { if (err) reject(err); else resolve(); });
    });
};

export interface SessionQuestionData {
    id?: number;
    session_id: number;
    original_question_id?: number | null;
    texte_question: string;
    type_question: string;
    options?: QuestionOption[] | string | null;
    image?: Buffer | null;
    image_name?: string | null;
    points?: number | null;
    feedback?: string | null;
    bloc_id?: number | null;
    ordre_apparition?: number | null;
    created_at?: string;
}

const parseSessionQuestionOptions = (sq: SessionQuestionData): SessionQuestionData => {
    if (sq.options && typeof sq.options === 'string') {
        try { sq.options = JSON.parse(sq.options); }
        catch (e) { console.error("Erreur parsing JSON options session question:", e); sq.options = []; }
    }
    return sq;
};

export const addSessionQuestion = (data: Omit<SessionQuestionData, 'id' | 'created_at'>): Promise<number> => {
    return new Promise((resolve, reject) => {
        const optionsJSON = typeof data.options === 'string' ? data.options : (data.options ? JSON.stringify(data.options) : null);
        const sql = `INSERT INTO session_questions (session_id, original_question_id, texte_question, type_question, options, image, image_name, points, feedback, bloc_id, ordre_apparition) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const params = [data.session_id, data.original_question_id || null, data.texte_question, data.type_question, optionsJSON, data.image || null, data.image_name || null, data.points || null, data.feedback || null, data.bloc_id || null, data.ordre_apparition || null];
        db.run(sql, params, function(this, err) { if (err) reject(err); else resolve(this.lastID); });
    });
};

export const addBulkSessionQuestions = (sessionId: number, questions: Omit<SessionQuestionData, 'id' | 'session_id' | 'created_at'>[]): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (questions.length === 0) return resolve();
        db.serialize(() => {
            const stmt = db.prepare(`INSERT INTO session_questions (session_id, original_question_id, texte_question, type_question, options, image, image_name, points, feedback, bloc_id, ordre_apparition) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
            let completed = 0; let firstError: Error | null = null;
            questions.forEach(q => {
                const optionsJSON = typeof q.options === 'string' ? q.options : (q.options ? JSON.stringify(q.options) : null);
                const params = [sessionId, q.original_question_id || null, q.texte_question, q.type_question, optionsJSON, q.image || null, q.image_name || null, q.points || null, q.feedback || null, q.bloc_id || null, q.ordre_apparition || null];
                stmt.run(params, function(this, err) {
                    if (err && !firstError) firstError = err;
                    completed++;
                    if (completed === questions.length) {
                        stmt.finalize((finalizeErr) => {
                            if (finalizeErr && !firstError) firstError = finalizeErr;
                            if (firstError) reject(firstError); else resolve();
                        });
                    }
                });
            });
        });
    });
};

export const getSessionQuestionsBySessionId = (sessionId: number): Promise<SessionQuestionData[]> => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM session_questions WHERE session_id = ? ORDER BY ordre_apparition, id", [sessionId], (err, rows: SessionQuestionData[]) => {
            if (err) reject(err); else resolve(rows.map(parseSessionQuestionOptions));
        });
    });
};

export const deleteSessionQuestionsBySessionId = (sessionId: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM session_questions WHERE session_id = ?", [sessionId], (err) => { if (err) reject(err); else resolve(); });
    });
};

export interface SessionBoitierData {
    id?: number;
    session_id: number;
    original_voting_device_id?: number | null;
    name: string;
    serial_number?: string | null;
    created_at?: string;
}

export const addSessionBoitier = (data: Omit<SessionBoitierData, 'id' | 'created_at'>): Promise<number> => {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO session_boitiers (session_id, original_voting_device_id, name, serial_number) VALUES (?, ?, ?, ?)`;
        db.run(sql, [data.session_id, data.original_voting_device_id || null, data.name, data.serial_number || null], function(this, err) { if (err) reject(err); else resolve(this.lastID); });
    });
};

export const addBulkSessionBoitiers = (sessionId: number, boitiers: Omit<SessionBoitierData, 'id' | 'session_id' | 'created_at'>[]): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (boitiers.length === 0) return resolve();
        db.serialize(() => {
            const stmt = db.prepare("INSERT INTO session_boitiers (session_id, original_voting_device_id, name, serial_number) VALUES (?, ?, ?, ?)");
            let completed = 0; let firstError: Error | null = null;
            boitiers.forEach(b => {
                stmt.run(sessionId, b.original_voting_device_id || null, b.name, b.serial_number || null, function(this, err) {
                    if (err && !firstError) firstError = err;
                    completed++;
                    if (completed === boitiers.length) {
                        stmt.finalize((finalizeErr) => {
                            if (finalizeErr && !firstError) firstError = finalizeErr;
                            if (firstError) reject(firstError); else resolve();
                        });
                    }
                });
            });
        });
    });
};

export const getSessionBoitiersBySessionId = (sessionId: number): Promise<SessionBoitierData[]> => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM session_boitiers WHERE session_id = ?", [sessionId], (err, rows: SessionBoitierData[]) => { if (err) reject(err); else resolve(rows); });
    });
};

export const deleteSessionBoitiersBySessionId = (sessionId: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM session_boitiers WHERE session_id = ?", [sessionId], (err) => { if (err) reject(err); else resolve(); });
    });
};

export interface SessionResultData {
    id?: number;
    session_id: number;
    session_question_id: number;
    session_participant_id: number;
    reponse_choisie?: string | null;
    est_correct?: number | null;
    points_obtenus?: number | null;
    temps_reponse?: number | null;
    submitted_at?: string;
}

export const addSessionResult = (data: Omit<SessionResultData, 'id' | 'submitted_at'>): Promise<number> => {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO session_results (session_id, session_question_id, session_participant_id, reponse_choisie, est_correct, points_obtenus, temps_reponse) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const params = [data.session_id, data.session_question_id, data.session_participant_id, data.reponse_choisie || null, data.est_correct === 1 ? 1 : (data.est_correct === 0 ? 0 : null), data.points_obtenus || null, data.temps_reponse || null];
        db.run(sql, params, function(this, err) { if (err) reject(err); else resolve(this.lastID); });
    });
};

export const addBulkSessionResults = (results: Omit<SessionResultData, 'id' | 'submitted_at'>[]): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (results.length === 0) return resolve();
        db.serialize(() => {
            const stmt = db.prepare(`INSERT INTO session_results (session_id, session_question_id, session_participant_id, reponse_choisie, est_correct, points_obtenus, temps_reponse) VALUES (?, ?, ?, ?, ?, ?, ?)`);
            let completed = 0; let firstError: Error | null = null;
            results.forEach(r => {
                const params = [r.session_id, r.session_question_id, r.session_participant_id, r.reponse_choisie || null, r.est_correct === 1 ? 1 : (r.est_correct === 0 ? 0 : null), r.points_obtenus || null, r.temps_reponse || null];
                stmt.run(params, function(this, err) {
                    if (err && !firstError) firstError = err;
                    completed++;
                    if (completed === results.length) {
                        stmt.finalize((finalizeErr) => {
                            if (finalizeErr && !firstError) firstError = finalizeErr;
                            if (firstError) reject(firstError); else resolve();
                        });
                    }
                });
            });
        });
    });
};

export const getSessionResultsBySessionId = (sessionId: number): Promise<SessionResultData[]> => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM session_results WHERE session_id = ?", [sessionId], (err, rows: SessionResultData[]) => { if (err) reject(err); else resolve(rows); });
    });
};

export const getSessionResultsByParticipantBoitier = (sessionId: number, participantIdBoitier: string): Promise<SessionResultData[]> => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM session_results WHERE session_id = ? AND session_participant_id = (SELECT id FROM session_participants WHERE session_id = ? AND identification_code = ? LIMIT 1)", [sessionId, sessionId, participantIdBoitier], (err, rows: SessionResultData[]) => { if (err) reject(err); else resolve(rows); });
    });
};

export const updateSessionResult = (id: number, data: Partial<Omit<SessionResultData, 'id' | 'session_id' | 'session_question_id' | 'session_participant_id' | 'submitted_at'>>): Promise<void> => {
    return new Promise((resolve, reject) => {
        const fields: string[] = []; const params: any[] = [];
        Object.entries(data).forEach(([key, value]) => { fields.push(`${key} = ?`); params.push(value); });
        if (fields.length === 0) return resolve();
        params.push(id);
        const sql = `UPDATE session_results SET ${fields.join(", ")} WHERE id = ?`;
        db.run(sql, params, (err) => { if (err) reject(err); else resolve(); });
    });
};

export const deleteSessionResultsBySessionId = (sessionId: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM session_results WHERE session_id = ?", [sessionId], (err) => { if (err) reject(err); else resolve(); });
    });
};

export interface AdminSettingData {
    key: string;
    value: any;
    description?: string | null;
    created_at?: string;
    updated_at?: string;
}

export const getAdminSetting = (key: string): Promise<any | undefined> => {
    return new Promise((resolve, reject) => {
        db.get("SELECT value FROM admin_settings WHERE key = ?", [key], (err, row: { value: any }) => {
            if (err) return reject(err);
            if (!row) return resolve(undefined);
            let value = row.value;
            if (typeof value === 'string') {
                try { if ((value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']'))) value = JSON.parse(value); }
                catch (e) { /* Not JSON */ }
            }
            resolve(value);
        });
    });
};

export const setAdminSetting = (key: string, value: any): Promise<void> => {
    return new Promise((resolve, reject) => {
        let valueToStore = value;
        if (typeof value === 'object' && !(value instanceof Buffer)) valueToStore = JSON.stringify(value);
        else if (typeof value === 'boolean') valueToStore = value ? 1 : 0;
        const sql = `INSERT INTO admin_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`;
        db.run(sql, [key, valueToStore], (err) => { if (err) reject(err); else resolve(); });
    });
};

export const getAllAdminSettings = (): Promise<Record<string, any>> => {
    return new Promise((resolve, reject) => {
        db.all("SELECT key, value FROM admin_settings", [], (err, rows: { key: string, value: any }[]) => {
            if (err) return reject(err);
            const settings: Record<string, any> = {};
            rows.forEach(row => {
                let value = row.value;
                if (typeof value === 'string') {
                    try { if ((value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']'))) settings[row.key] = JSON.parse(value); else settings[row.key] = value; }
                    catch (e) { settings[row.key] = value; }
                } else { settings[row.key] = value; }
            });
            resolve(settings);
        });
    });
};

export const deleteAdminSetting = (key: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM admin_settings WHERE key = ?", [key], (err) => { if (err) reject(err); else resolve(); });
    });
};

export const closeDb = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) { console.error('Erreur fermeture DB (db.ts):', err.message); reject(err); }
      else { console.log('DB fermée (db.ts).'); resolve(); }
    });
  });
};
