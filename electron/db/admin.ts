import { getDb, asyncDbRun, logger } from './index';

const parseAdminSettingValue = (value: string | null): any => {
    if (value === null || value === undefined) return undefined;
    try {
      return JSON.parse(value);
    } catch (e) {
      return value;
    }
};

export const getAdminSetting = async (key: string): Promise<any> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare("SELECT value FROM adminSettings WHERE key = ?");
        const row = stmt.get(key) as { value: string } | undefined;
        return row ? parseAdminSettingValue(row.value) : undefined;
      } catch (error) {
        logger?.debug(`[DB AdminSettings] Error getting setting ${key}: ${error}`);
        throw error;
      }
    });
};

export const setAdminSetting = async (key: string, value: any): Promise<void> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare(`
          INSERT INTO adminSettings (key, value)
          VALUES (@key, @value)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `);
        const valueToStore = typeof value === 'string' ? value : (value === null || value === undefined ? null : JSON.stringify(value));
        stmt.run({ key, value: valueToStore });
      } catch (error) {
        logger?.debug(`[DB AdminSettings] Error setting setting ${key}: ${error}`);
        throw error;
      }
    });
};

export const getAllAdminSettings = async (): Promise<{ key: string; value: any }[]> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare("SELECT key, value FROM adminSettings");
        const rows = stmt.all() as { key: string; value: string }[];
        return rows.map(row => ({
          key: row.key,
          value: parseAdminSettingValue(row.value),
        }));
      } catch (error) {
        logger?.debug(`[DB AdminSettings] Error getting all settings: ${error}`);
        throw error;
      }
    });
};

export async function getGlobalPptxTemplate(): Promise<string | null> {
    logger?.debug('[DB AdminSettings] Fetching global PPTX template path.');
    const filePath = await getAdminSetting('globalPptxTemplatePath');
    if (filePath && typeof filePath === 'string' && require('fs').existsSync(filePath)) {
      return filePath;
    }
    return null;
}

export async function exportAllData(): Promise<unknown> {
    logger?.debug('[DB Backup] Exporting all data (TODO: Implement)');
    throw new Error('exportAllData not implemented');
}

export async function importAllData(data: unknown): Promise<void> {
    logger?.debug('[DB Restore] Importing data (TODO: Implement)');
    throw new Error('importAllData not implemented');
}

interface BlockUsage {
    referentiel: string;
    theme: string;
    blockId: string;
    usageCount: number;
}

export const calculateBlockUsage = async (startDate?: string | Date, endDate?: string | Date): Promise<BlockUsage[]> => {
    return asyncDbRun(() => {
      let query = "SELECT id, dateSession, referentielId, selectedBlocIds FROM sessions WHERE status = 'completed'";
      const params: (string | number)[] = [];

      if (startDate) {
        query += " AND dateSession >= ?";
        params.push(typeof startDate === 'string' ? startDate : startDate.toISOString());
      }
      if (endDate) {
        query += " AND dateSession <= ?";
        params.push(typeof endDate === 'string' ? endDate : endDate.toISOString());
      }

      const sessionsForBlockUsage = getDb().prepare(query).all(...params) as any[];

      const blockUsageMap = new Map<string, BlockUsage>();

      for (const session of sessionsForBlockUsage) {
        if (!session.selectedBlocIds || !session.referentielId) {
          continue;
        }

        let blocIds: number[] = [];
        try {
          const parsedBlocIds = JSON.parse(session.selectedBlocIds as any);
          if (Array.isArray(parsedBlocIds) && parsedBlocIds.every(id => typeof id === 'number')) {
            blocIds = parsedBlocIds;
          } else {
            continue;
          }
        } catch (e) {
          continue;
        }

        if (blocIds.length === 0) {
          continue;
        }

        for (const blocId of blocIds) {
          try {
            const blocInfoStmt = getDb().prepare(`
              SELECT b.code_bloc, t.code_theme, r.code as referentiel_code
              FROM blocs b
              JOIN themes t ON b.theme_id = t.id
              JOIN referentiels r ON t.referentiel_id = r.id
              WHERE b.id = ? AND r.id = ?
            `);
            const blocDetails = blocInfoStmt.get(blocId, session.referentielId) as { code_bloc: string; code_theme: string; referentiel_code: string } | undefined;

            if (blocDetails) {
              const key = `${blocDetails.referentiel_code}-${blocDetails.code_theme}-${blocDetails.code_bloc}`;
              if (blockUsageMap.has(key)) {
                blockUsageMap.get(key)!.usageCount++;
              } else {
                blockUsageMap.set(key, {
                  referentiel: blocDetails.referentiel_code,
                  theme: blocDetails.code_theme,
                  blockId: blocDetails.code_bloc,
                  usageCount: 1,
                });
              }
            }
          } catch (e) {
            logger?.debug(`[DB Reports] Error processing blocId ${blocId} for session ${session.id}: ${e}`);
          }
        }
      }
      return Array.from(blockUsageMap.values());
    });
};
