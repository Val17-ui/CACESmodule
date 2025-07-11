import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as sqlite3 from 'sqlite3';
import * as fs from 'fs/promises';

// Initialiser SQLite3
const dbPath = path.join(app.getPath('userData'), 'caces.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erreur SQLite3 :', err);
  } else {
    console.log('Base de données SQLite3 connectée');
    // Créer les 13 tables
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        blocId INTEGER,
        text TEXT,
        type TEXT,
        correctAnswer TEXT,
        timeLimit INTEGER,
        isEliminatory BOOLEAN,
        createdAt TEXT,
        usageCount INTEGER,
        correctResponseRate REAL,
        slideGuid TEXT,
        options TEXT,
        FOREIGN KEY (blocId) REFERENCES blocs(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nomSession TEXT,
        dateSession TEXT,
        referentielId INTEGER,
        selectedBlocIds TEXT,
        selectedKitId INTEGER,
        createdAt TEXT,
        location TEXT,
        status TEXT,
        questionMappings TEXT,
        notes TEXT,
        trainerId INTEGER,
        ignoredSlideGuids TEXT,
        resolvedImportAnomalies TEXT,
        FOREIGN KEY (referentielId) REFERENCES referentiels(id),
        FOREIGN KEY (trainerId) REFERENCES trainers(id),
        FOREIGN KEY (selectedKitId) REFERENCES deviceKits(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS sessionResults (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sessionId INTEGER,
        questionId INTEGER,
        participantIdBoitier TEXT,
        answer TEXT,
        isCorrect BOOLEAN,
        pointsObtained INTEGER,
        timestamp TEXT,
        FOREIGN KEY (sessionId) REFERENCES sessions(id),
        FOREIGN KEY (questionId) REFERENCES questions(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS adminSettings (
        key TEXT PRIMARY KEY,
        value TEXT
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS votingDevices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        serialNumber TEXT UNIQUE
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS trainers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        isDefault INTEGER
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS sessionQuestions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sessionId INTEGER,
        dbQuestionId INTEGER,
        slideGuid TEXT,
        blockId INTEGER,
        FOREIGN KEY (sessionId) REFERENCES sessions(id),
        FOREIGN KEY (dbQuestionId) REFERENCES questions(id),
        FOREIGN KEY (blockId) REFERENCES blocs(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS sessionBoitiers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sessionId INTEGER,
        participantId TEXT,
        visualId TEXT,
        serialNumber TEXT,
        FOREIGN KEY (sessionId) REFERENCES sessions(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS referentiels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE,
        nom_complet TEXT
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS themes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code_theme TEXT UNIQUE,
        referentiel_id INTEGER,
        nom_complet TEXT,
        FOREIGN KEY (referentiel_id) REFERENCES referentiels(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS blocs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code_bloc TEXT UNIQUE,
        theme_id INTEGER,
        FOREIGN KEY (theme_id) REFERENCES themes(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS deviceKits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        isDefault INTEGER
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS deviceKitAssignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kitId INTEGER,
        votingDeviceId INTEGER,
        UNIQUE (kitId, votingDeviceId),
        FOREIGN KEY (kitId) REFERENCES deviceKits(id),
        FOREIGN KEY (votingDeviceId) REFERENCES votingDevices(id)
      )`);
    });
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadFile('dist/index.html'); // Charge le build Vite
}

// IPC pour chaque table (exemple pour quelques tables, à compléter pour toutes)
// questions
ipcMain.handle('get-questions', async () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM questions', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows.map(row => ({ ...row, options: JSON.parse(row.options || '[]') })));
    });
  });
});

ipcMain.handle('add-question', async (event, data) => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO questions (blocId, text, type, correctAnswer, timeLimit, isEliminatory, createdAt, usageCount, correctResponseRate, slideGuid, options) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        data.blocId,
        data.text,
        data.type,
        data.correctAnswer,
        data.timeLimit,
        data.isEliminatory ? 1 : 0,
        data.createdAt,
        data.usageCount,
        data.correctResponseRate,
        data.slideGuid,
        JSON.stringify(data.options)
      ],
      function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
});

ipcMain.handle('update-question', async (event, data) => {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE questions SET blocId = ?, text = ?, type = ?, correctAnswer = ?, timeLimit = ?, isEliminatory = ?, createdAt = ?, usageCount = ?, correctResponseRate = ?, slideGuid = ?, options = ? WHERE id = ?',
      [
        data.blocId,
        data.text,
        data.type,
        data.correctAnswer,
        data.timeLimit,
        data.isEliminatory ? 1 : 0,
        data.createdAt,
        data.usageCount,
        data.correctResponseRate,
        data.slideGuid,
        JSON.stringify(data.options),
        data.id
      ],
      function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      }
    );
  });
});

ipcMain.handle('delete-question', async (event, id) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM questions WHERE id = ?', [id], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
});

// sessions
ipcMain.handle('get-sessions', async () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM sessions', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows.map(row => ({
        ...row,
        selectedBlocIds: JSON.parse(row.selectedBlocIds || '[]'),
        ignoredSlideGuids: JSON.parse(row.ignoredSlideGuids || '[]'),
        questionMappings: JSON.parse(row.questionMappings || '{}'),
        resolvedImportAnomalies: JSON.parse(row.resolvedImportAnomalies || 'null')
      })));
    });
  });
});

ipcMain.handle('add-session', async (event, data) => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO sessions (nomSession, dateSession, referentielId, selectedBlocIds, selectedKitId, createdAt, location, status, questionMappings, notes, trainerId, ignoredSlideGuids, resolvedImportAnomalies) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        data.nomSession,
        data.dateSession,
        data.referentielId,
        JSON.stringify(data.selectedBlocIds || []),
        data.selectedKitId,
        data.createdAt,
        data.location,
        data.status,
        JSON.stringify(data.questionMappings || {}),
        data.notes,
        data.trainerId,
        JSON.stringify(data.ignoredSlideGuids || []),
        JSON.stringify(data.resolvedImportAnomalies || null)
      ],
      function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
});

// Ajoute des IPC similaires pour update-session, delete-session, et les autres tables
// sessionResults
ipcMain.handle('get-sessionResults', async () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM sessionResults', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
});

ipcMain.handle('add-sessionResult', async (event, data) => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO sessionResults (sessionId, questionId, participantIdBoitier, answer, isCorrect, pointsObtained, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        data.sessionId,
        data.questionId,
        data.participantIdBoitier,
        data.answer,
        data.isCorrect ? 1 : 0,
        data.pointsObtained,
        data.timestamp
      ],
      function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
});

// adminSettings
ipcMain.handle('get-adminSetting', async (event, key) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT value FROM adminSettings WHERE key = ?', [key], (err, row) => {
      if (err) reject(err);
      else resolve(row ? JSON.parse(row.value) : undefined);
    });
  });
});

ipcMain.handle('set-adminSetting', async (event, { key, value }) => {
  return new Promise((resolve, reject) => {
    db.run('INSERT OR REPLACE INTO adminSettings (key, value) VALUES (?, ?)', [key, JSON.stringify(value)], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
});

// votingDevices
ipcMain.handle('get-votingDevices', async () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM votingDevices', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
});

ipcMain.handle('add-votingDevice', async (event, data) => {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO votingDevices (name, serialNumber) VALUES (?, ?)', [data.name, data.serialNumber], function (err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
});

// trainers
ipcMain.handle('get-trainers', async () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM trainers', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
});

ipcMain.handle('add-trainer', async (event, data) => {
  return new Promise((resolve, reject) => {
    if (data.isDefault) {
      db.run('UPDATE trainers SET isDefault = 0 WHERE isDefault = 1', [], (err) => {
        if (err) reject(err);
        else {
          db.run('INSERT INTO trainers (name, isDefault) VALUES (?, ?)', [data.name, data.isDefault ? 1 : 0], function (err) {
            if (err) reject(err);
            else resolve(this.lastID);
          });
        }
      });
    } else {
      db.run('INSERT INTO trainers (name, isDefault) VALUES (?, ?)', [data.name, 0], function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    }
  });
});

// sessionQuestions
ipcMain.handle('get-sessionQuestions', async (event, sessionId) => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM sessionQuestions WHERE sessionId = ?', [sessionId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
});

ipcMain.handle('add-sessionQuestion', async (event, data) => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO sessionQuestions (sessionId, dbQuestionId, slideGuid, blockId) VALUES (?, ?, ?, ?)',
      [data.sessionId, data.dbQuestionId, data.slideGuid, data.blockId],
      function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
});

// sessionBoitiers
ipcMain.handle('get-sessionBoitiers', async (event, sessionId) => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM sessionBoitiers WHERE sessionId = ?', [sessionId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
});

ipcMain.handle('add-sessionBoitier', async (event, data) => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO sessionBoitiers (sessionId, participantId, visualId, serialNumber) VALUES (?, ?, ?, ?)',
      [data.sessionId, data.participantId, data.visualId, data.serialNumber],
      function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
});

// referentiels
ipcMain.handle('get-referentiels', async () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM referentiels', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
});

ipcMain.handle('add-referential', async (event, data) => {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO referentiels (code, nom_complet) VALUES (?, ?)', [data.code, data.nom_complet], function (err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
});

// themes
ipcMain.handle('get-themes', async (event, referentielId) => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM themes WHERE referentiel_id = ?', [referentielId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
});

ipcMain.handle('add-theme', async (event, data) => {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO themes (code_theme, referentiel_id, nom_complet) VALUES (?, ?, ?)', [data.code_theme, data.referentiel_id, data.nom_complet], function (err) {
      if (err) reject(err);
      else {
        const themeId = this.lastID;
        const defaultBlocCode = `${data.code_theme}_GEN`;
        db.run('INSERT INTO blocs (code_bloc, theme_id) VALUES (?, ?)', [defaultBlocCode, themeId], function (err) {
          if (err) reject(err);
          else resolve(themeId);
        });
      }
    });
  });
});

// blocs
ipcMain.handle('get-blocs', async (event, themeId) => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM blocs WHERE theme_id = ?', [themeId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
});

ipcMain.handle('add-bloc', async (event, data) => {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO blocs (code_bloc, theme_id) VALUES (?, ?)', [data.code_bloc, data.theme_id], function (err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
});

// deviceKits
ipcMain.handle('get-deviceKits', async () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM deviceKits', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
});

ipcMain.handle('add-deviceKit', async (event, data) => {
  return new Promise((resolve, reject) => {
    if (data.isDefault) {
      db.run('UPDATE deviceKits SET isDefault = 0 WHERE isDefault = 1', [], (err) => {
        if (err) reject(err);
        else {
          db.run('INSERT INTO deviceKits (name, isDefault) VALUES (?, ?)', [data.name, data.isDefault ? 1 : 0], function (err) {
            if (err) reject(err);
            else resolve(this.lastID);
          });
        }
      });
    } else {
      db.run('INSERT INTO deviceKits (name, isDefault) VALUES (?, ?)', [data.name, 0], function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    }
  });
});

// deviceKitAssignments
ipcMain.handle('get-deviceKitAssignments', async (event, kitId) => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM deviceKitAssignments WHERE kitId = ?', [kitId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
});

ipcMain.handle('add-deviceKitAssignment', async (event, data) => {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO deviceKitAssignments (kitId, votingDeviceId) VALUES (?, ?)', [data.kitId, data.votingDeviceId], function (err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
});

// Exportation de la base
ipcMain.handle('export-db', async () => {
  const exportPath = path.join(app.getPath('desktop'), 'caces_export.db');
  await fs.copyFile(dbPath, exportPath);
  return exportPath;
});

// Importation de la base
ipcMain.handle('import-db', async (event, importPath) => {
  const importDb = new sqlite3.Database(importPath);
  return new Promise((resolve, reject) => {
    importDb.serialize(() => {
      const tables = [
        'questions', 'sessions', 'sessionResults', 'adminSettings', 'votingDevices',
        'trainers', 'sessionQuestions', 'sessionBoitiers', 'referentiels', 'themes',
        'blocs', 'deviceKits', 'deviceKitAssignments'
      ];
      let completed = 0;
      tables.forEach((table) => {
        importDb.all(`SELECT * FROM ${table}`, [], (err, rows) => {
          if (err) return reject(err);
          db.serialize(() => {
            db.run(`DELETE FROM ${table}`); // Vider la table cible
            if (rows.length > 0) {
              const columns = Object.keys(rows[0]).filter(col => col !== 'id'); // Exclure id pour l’auto-incrémentation
              const placeholders = columns.map(() => '?').join(', ');
              const stmt = db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`);
              rows.forEach((row) => {
                const values = columns.map(col => {
                  if (['options', 'selectedBlocIds', 'ignoredSlideGuids', 'questionMappings', 'resolvedImportAnomalies'].includes(col)) {
                    return JSON.stringify(row[col] || (col === 'resolvedImportAnomalies' ? null : []));
                  }
                  return row[col];
                });
                stmt.run(values);
              });
              stmt.finalize();
            }
            completed++;
            if (completed === tables.length) {
              importDb.close();
              resolve('Importation terminée');
            }
          });
        });
      });
    });
  });
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  db.close();
});