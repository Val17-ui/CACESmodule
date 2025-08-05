import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import type { Database } from 'better-sqlite3';
import { getLogger, ILogger } from '@electron/utils/logger';
import { createSchema } from './schema';
import { createOrUpdateGlobalKit } from './devices';
import { archiveOldSessions } from './sessions';

let _db: Database;
let _logger: ILogger;

const appName = 'easycertif';
const dbDir = path.join(app.getPath('userData'), appName, 'db_data');
const dbPath = process.env.NODE_ENV === 'development'
  ? path.join(process.cwd(), 'src/db_data/database.sqlite3')
  : path.join(dbDir, 'database.sqlite3');

async function initializeDatabase(loggerInstance: ILogger) {
  _logger = loggerInstance;
  if (_db) {
    _logger.debug('[DB SETUP] Database already initialized. Skipping.');
    return;
  }
  _logger.info('[DB SETUP] Starting database initialization...');
  _logger.debug(`[DB SETUP] Database path resolved to: ${dbPath}`);

  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    _logger.debug(`[DB SETUP] Database directory does not exist. Creating: ${dbDir}`);
    await fs.promises.mkdir(dbDir, { recursive: true });
  } else {
    _logger.debug(`[DB SETUP] Database directory already exists: ${dbDir}`);
  }

  try {
    const BetterSqlite3Module = (await import('better-sqlite3')).default;
    _db = new BetterSqlite3Module(dbPath, { verbose: (message) => _logger.debug(String(message)) });
    _logger.info('[DB SETUP] SQLite database connection established.');
  } catch (error) {
    _logger.error(`[DB SETUP] CRITICAL: Failed to connect to SQLite database at ${dbPath}. ${error}`);
    throw error;
  }

  try {
    getDb().pragma('foreign_keys = ON');
    _logger.debug("[DB SETUP] Foreign key support enabled.");
  } catch (error) {
    _logger.error(`[DB SETUP] Failed to enable foreign keys: ${String(error)}`);
  }

  try {
    _logger.info('[DB SETUP] Proceeding to schema creation and migration...');
    createSchema();
    _logger.info('[DB SETUP] Schema creation and migration step completed.');
  } catch (error) {
    _logger.error(`[DB SETUP] FATAL: Failed to create or verify database schema. Application cannot continue safely. ${error}`);
    throw error;
  }

  try {
    _logger.debug('[DB SETUP] Proceeding to create/update global kit...');
    await createOrUpdateGlobalKit();
    _logger.debug('[DB SETUP] Global kit setup completed.');
  } catch (err) {
    _logger.error(`[DB SETUP] Failed to create/update global kit: ${err}`);
  }

  try {
    _logger.debug('[DB SETUP] Proceeding to archive old sessions...');
    await archiveOldSessions();
    _logger.debug('[DB SETUP] Archiving old sessions completed.');
  } catch (err) {
    _logger.error(`[DB SETUP] Failed to archive old sessions: ${err}`);
  }

  _logger.info("[DB SETUP] Database initialization process finished successfully.");
}

const getDb = (): Database => {
    if (!_db) {
        throw new Error("Database not initialized. Please call initializeDatabase first.");
    }
    return _db;
};

async function asyncDbRun<T>(fn: () => T): Promise<T> {
    try {
      return Promise.resolve(fn());
    } catch (error: any) {
      const errorMessage = error.code === 'SQLITE_CONSTRAINT'
        ? `[ASYNC DB RUNNER] SQLite constraint violation: ${String(error)}`
        : `[ASYNC DB RUNNER] SQLite operation failed: ${String(error)}`;
      _logger?.error(errorMessage);
      throw error;
    }
}

export { initializeDatabase, getDb, asyncDbRun, _logger as logger };

export * from './sessions';
export * from './participants';
export * from './questions';
export * from './devices';
export * from './results';
export * from './admin';
export * from './trainers';
export * from './referentiels';
export * from './schema';
