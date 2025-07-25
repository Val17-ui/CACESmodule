import cron from 'node-cron';
import { getDb } from './db';
import { ILogger } from './utils/logger';

let logger: ILogger;

export function setupCronJobs(loggerInstance: ILogger) {
  logger = loggerInstance;
  // Schedule a job to run every day at 1 AM
  cron.schedule('0 1 * * *', () => {
    logger.info('[CRON] Running job to archive old sessions...');
    archiveOldSessions();
  });
}

async function archiveOldSessions() {
  const db = getDb();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  try {
    const stmt = db.prepare(
      `UPDATE sessions
       SET archived_at = ?
       WHERE status = 'completed'
         AND date(dateSession) <= date(?)
         AND archived_at IS NULL`
    );
    const result = stmt.run(new Date().toISOString(), sevenDaysAgo.toISOString().split('T')[0]);
    logger.info(`[CRON] Archived ${result.changes} sessions.`);
  } catch (error) {
    logger.error('[CRON] Error archiving old sessions:', error);
  }
}
