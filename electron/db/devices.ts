import { getDb, asyncDbRun, logger } from './index';
import type { VotingDevice, DeviceKit } from '@common/types';

export const addVotingDevice = async (device: Omit<VotingDevice, 'id'>): Promise<number | undefined> => {
    const result = await asyncDbRun(() => {
      try {
        const stmt = getDb().prepare("INSERT INTO votingDevices (name, serialNumber) VALUES (@name, @serialNumber)");
        const result = stmt.run(device);
        return result.lastInsertRowid as number;
      } catch (error) {
        logger?.debug(`[DB VotingDevices] Error adding voting device: ${error}`);
        if ((error as any).code === 'SQLITE_CONSTRAINT_UNIQUE') {
          throw new Error(`Voting device with serial number ${device.serialNumber} already exists.`);
        }
        throw error;
      }
    });
    await createOrUpdateGlobalKit();
    return result;
  };

  export const getAllVotingDevices = async (): Promise<VotingDevice[]> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare("SELECT * FROM votingDevices ORDER BY name ASC, serialNumber ASC");
        const devices = stmt.all() as VotingDevice[];
        return devices;
      } catch (error) {
        logger?.debug(`[DB VotingDevices] Error getting all voting devices: ${error}`);
        throw error;
      }
    });
  };

  export const updateVotingDevice = async (id: number, updates: Partial<Omit<VotingDevice, 'id'>>): Promise<number> => {
    return asyncDbRun(() => {
      try {
        const fields = Object.keys(updates).filter(key => key !== 'id' && (updates as any)[key] !== undefined);
        if (fields.length === 0) return 0;

        const setClause = fields.map(field => `${field} = @${field}`).join(', ');
        const stmt = getDb().prepare(`UPDATE votingDevices SET ${setClause} WHERE id = @id`);

        const params: any = { id };
        for (const field of fields) {
          params[field] = (updates as any)[field];
        }

        const result = stmt.run(params);
        return result.changes;
      } catch (error) {
        logger?.debug(`[DB VotingDevices] Error updating voting device ${id}: ${error}`);
        if ((error as any).code === 'SQLITE_CONSTRAINT_UNIQUE' && updates.serialNumber) {
          throw new Error(`Voting device with serial number ${updates.serialNumber} already exists.`);
        }
        throw error;
      }
    });
  };

  export const deleteVotingDevice = async (id: number): Promise<void> => {
    await asyncDbRun(() => {
      try {
        const stmt = getDb().prepare("DELETE FROM votingDevices WHERE id = ?");
        stmt.run(id);
      } catch (error) {
        logger?.debug(`[DB VotingDevices] Error deleting voting device ${id}: ${error}`);
        throw error;
      }
    });
    await createOrUpdateGlobalKit();
  };

  export const bulkAddVotingDevices = async (devices: Omit<VotingDevice, 'id'>[]): Promise<void> => {
    if (!devices || devices.length === 0) return Promise.resolve();

    await asyncDbRun(() => {
      const insertStmt = getDb().prepare("INSERT OR IGNORE INTO votingDevices (name, serialNumber) VALUES (@name, @serialNumber)");
      const transaction = getDb().transaction((items: Omit<VotingDevice, 'id'>[]) => {
        for (const device of items) {
          try {
            insertStmt.run(device);
          } catch (error) {
            logger?.debug(`[DB VotingDevices] Error in bulk adding voting device for item: ${device}, ${error}`);
            throw error;
          }
        }
      });

      try {
        transaction(devices);
      } catch (error) {
        logger?.debug(`[DB VotingDevices] Bulk add transaction failed overall.`);
        throw error;
      }
    });
    await createOrUpdateGlobalKit();
  };

  const rowToDeviceKit = (row: any): DeviceKit => {
    if (!row) return undefined as any;
    return {
      ...row,
      isDefault: row.isDefault === 1,
      is_global: row.is_global === 1,
    };
  };

  export const addDeviceKit = async (kit: Omit<DeviceKit, 'id'>): Promise<number | undefined> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare("INSERT INTO deviceKits (name, isDefault, is_global) VALUES (@name, @isDefault, @is_global)");
        const isDefault = kit.isDefault ? 1 : 0;
        const is_global = kit.is_global ? 1 : 0;
        const result = stmt.run({ ...kit, isDefault, is_global });
        return result.lastInsertRowid as number;
      } catch (error) {
        logger?.debug(`[DB DeviceKits] Error adding device kit: ${error}`);
        if ((error as any).code === 'SQLITE_CONSTRAINT_UNIQUE') {
          throw new Error(`Device kit with name ${kit.name} already exists.`);
        }
        throw error;
      }
    });
  };

  export const getAllDeviceKits = async (): Promise<DeviceKit[]> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare("SELECT * FROM deviceKits ORDER BY name ASC");
        const rows = stmt.all() as any[];
        return rows.map(rowToDeviceKit);
      } catch (error) {
        logger?.debug(`[DB DeviceKits] Error getting all device kits: ${error}`);
        throw error;
      }
    });
  };

  export const getDeviceKitById = async (id: number): Promise<DeviceKit | undefined> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare("SELECT * FROM deviceKits WHERE id = ?");
        const row = stmt.get(id) as any;
        return row ? rowToDeviceKit(row) : undefined;
      } catch (error) {
        logger?.debug(`[DB DeviceKits] Error getting device kit by id ${id}: ${error}`);
        throw error;
      }
    });
  };

  export const updateDeviceKit = async (id: number, updates: Partial<Omit<DeviceKit, 'id'>>): Promise<number | undefined> => {
    return asyncDbRun(() => {
      try {
        const fields = Object.keys(updates).filter(key => key !== 'id');
        if (fields.length === 0) return 0;

        const setClause = fields.map(field => `${field} = @${field}`).join(', ');
        const stmt = getDb().prepare(`UPDATE deviceKits SET ${setClause} WHERE id = @id`);

        const params: any = { ...updates, id };
        if (updates.isDefault !== undefined) {
          params.isDefault = updates.isDefault ? 1 : 0;
        }

        const result = stmt.run(params);
        return result.changes;
      } catch (error) {
        logger?.debug(`[DB DeviceKits] Error updating device kit ${id}: ${error}`);
        if ((error as any).code === 'SQLITE_CONSTRAINT_UNIQUE' && updates.name) {
          throw new Error(`Device kit with name ${updates.name} already exists.`);
        }
        throw error;
      }
    });
  };

  export const deleteDeviceKit = async (id: number): Promise<void> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare("DELETE FROM deviceKits WHERE id = ?");
        stmt.run(id);
      } catch (error) {
        logger?.debug(`[DB DeviceKits] Error deleting device kit ${id}: ${error}`);
        throw error;
      }
    });
  };

  export const getDefaultDeviceKit = async (): Promise<DeviceKit | undefined> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare("SELECT * FROM deviceKits WHERE isDefault = 1 LIMIT 1");
        const row = stmt.get() as any;
        return row ? rowToDeviceKit(row) : undefined;
      } catch (error) {
        logger?.debug(`[DB DeviceKits] Error getting default device kit: ${error}`);
        throw error;
      }
    });
  };

  export const setDefaultDeviceKit = async (kitId: number): Promise<void> => {
    return asyncDbRun(() => {
      const transaction = getDb().transaction(() => {
        try {
          const resetStmt = getDb().prepare("UPDATE deviceKits SET isDefault = 0 WHERE isDefault = 1");
          resetStmt.run();

          const setStmt = getDb().prepare("UPDATE deviceKits SET isDefault = 1 WHERE id = ?");
          setStmt.run(kitId);
        } catch (error) {
          logger?.debug(`[DB DeviceKits] Error setting default device kit ${kitId}: ${error}`);
          throw error;
        }
      });
      transaction();
    });
  };

  export const createOrUpdateGlobalKit = async (): Promise<void> => {
    return asyncDbRun(() => {
      const db = getDb();
      const transaction = db.transaction(() => {
        try {
          let globalKit: DeviceKit | undefined = db.prepare("SELECT * FROM deviceKits WHERE is_global = 1").get() as DeviceKit | undefined;
          if (!globalKit) {
            const result = db.prepare("INSERT INTO deviceKits (name, is_global) VALUES (?, 1)").run("Tous les boîtiers");
            globalKit = { id: result.lastInsertRowid as number, name: "Tous les boîtiers", is_global: 1, isDefault: 0 };
          }

          const allDevices = db.prepare("SELECT id FROM votingDevices").all();

          if (!globalKit || globalKit.id === undefined) {
              throw new Error("Could not create or find global kit.");
          }
          const currentAssignments = db.prepare("SELECT votingDeviceId FROM deviceKitAssignments WHERE kitId = ?").all(globalKit.id).map((row: any) => row.votingDeviceId);

          const allDeviceIds = allDevices.map((row: any) => row.id);
          const devicesToAdd = allDeviceIds.filter((id: number) => !currentAssignments.includes(id));
          const devicesToRemove = currentAssignments.filter((id: number) => !allDeviceIds.includes(id));

          const addStmt = db.prepare("INSERT INTO deviceKitAssignments (kitId, votingDeviceId) VALUES (?, ?)");
          for (const deviceId of devicesToAdd) {
            addStmt.run(globalKit.id, deviceId);
          }

          if (devicesToRemove.length > 0) {
            const removeStmt = db.prepare(`DELETE FROM deviceKitAssignments WHERE kitId = ? AND votingDeviceId IN (${devicesToRemove.map(() => '?').join(',')})`);
            removeStmt.run(globalKit.id, ...devicesToRemove);
          }
        } catch (error) {
          logger?.error(`[DB DeviceKits] Error creating/updating global kit: ${error}`);
          throw error;
        }
      });
      transaction();
    });
  }

  export const assignDeviceToKit = async (kitId: number, votingDeviceId: number): Promise<number | undefined> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare("INSERT INTO deviceKitAssignments (kitId, votingDeviceId) VALUES (?, ?)");
        const result = stmt.run(kitId, votingDeviceId);
        return result.lastInsertRowid as number;
      } catch (error) {
        logger?.debug(`[DB DeviceKitAssignments] Error assigning device ${votingDeviceId} to kit ${kitId}: ${error}`);
        if ((error as any).code === 'SQLITE_CONSTRAINT_UNIQUE') {
          throw new Error(`Device ${votingDeviceId} is already assigned to kit ${kitId}.`);
        }
        throw error;
      }
    });
  };

  export const removeDeviceFromKit = async (kitId: number, votingDeviceId: number): Promise<void> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare("DELETE FROM deviceKitAssignments WHERE kitId = ? AND votingDeviceId = ?");
        stmt.run(kitId, votingDeviceId);
      } catch (error) {
        logger?.debug(`[DB DeviceKitAssignments] Error removing device ${votingDeviceId} from kit ${kitId}: ${error}`);
        throw error;
      }
    });
  };

  export const getVotingDevicesForKit = async (kitId: number): Promise<VotingDevice[]> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare(`
          SELECT vd.*
          FROM votingDevices vd
          JOIN deviceKitAssignments dka ON vd.id = dka.votingDeviceId
          WHERE dka.kitId = ?
          ORDER BY vd.name ASC, vd.serialNumber ASC
        `);
        return stmt.all(kitId) as VotingDevice[];
      } catch (error) {
        logger?.debug(`[DB DeviceKitAssignments] Error getting voting devices for kit ${kitId}: ${error}`);
        throw error;
      }
    });
  };

  export const getKitsForVotingDevice = async (votingDeviceId: number): Promise<DeviceKit[]> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare(`
          SELECT dk.*
          FROM deviceKits dk
          JOIN deviceKitAssignments dka ON dk.id = dka.kitId
          WHERE dka.votingDeviceId = ?
          ORDER BY dk.name ASC
        `);
        const rows = stmt.all(votingDeviceId) as any[];
        return rows.map(rowToDeviceKit);
      } catch (error) {
        logger?.debug(`[DB DeviceKitAssignments] Error getting kits for voting device ${votingDeviceId}: ${error}`);
        throw error;
      }
    });
  };

  export const removeAssignmentsByKitId = async (kitId: number): Promise<void> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare("DELETE FROM deviceKitAssignments WHERE kitId = ?");
        stmt.run(kitId);
      } catch (error) {
        logger?.debug(`[DB DeviceKitAssignments] Error removing assignments by kitId ${kitId}: ${error}`);
        throw error;
      }
    });
  };

  export const removeAssignmentsByVotingDeviceId = async (votingDeviceId: number): Promise<void> => {
    return asyncDbRun(() => {
      try {
        const stmt = getDb().prepare("DELETE FROM deviceKitAssignments WHERE votingDeviceId = ?");
        stmt.run(votingDeviceId);
      } catch (error) {
        logger?.debug(`[DB DeviceKitAssignments] Error removing assignments by votingDeviceId ${votingDeviceId}: ${error}`);
        throw error;
      }
    });
  };
