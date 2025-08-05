import { getDb, asyncDbRun, logger } from './index';
import type { Participant, ParticipantAssignment } from '@common/types';

export const addParticipant = async (participant: Omit<Participant, 'id'>): Promise<number | undefined> => {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare(`
                INSERT INTO participants (first_name, last_name, organization, identification_code)
                VALUES (@first_name, @last_name, @organization, @identification_code)
            `);
            const result = stmt.run(participant);
            return result.lastInsertRowid as number;
        } catch (error) {
            logger?.debug(`[DB Participants] Error adding participant: ${error}`);
            throw error;
        }
    });
}

export const upsertParticipant = async (participant: Participant): Promise<number | undefined> => {
    return asyncDbRun(() => {
        const { prenom, nom, organization, identificationCode } = participant;

        if (identificationCode && identificationCode.trim() !== '') {
            const existingStmt = getDb().prepare('SELECT id FROM participants WHERE identification_code = ?');
            const existing = existingStmt.get(identificationCode) as { id: number } | undefined;

            if (existing) {
                const updateStmt = getDb().prepare(`
                    UPDATE participants
                    SET first_name = ?, last_name = ?, organization = ?
                    WHERE id = ?
                `);
                updateStmt.run(prenom, nom, organization, existing.id);
                return existing.id;
            }
        }

        const insertStmt = getDb().prepare(`
            INSERT INTO participants (first_name, last_name, organization, identification_code)
            VALUES (?, ?, ?, ?)
        `);
        const result = insertStmt.run(prenom, nom, organization, identificationCode);
        return result.lastInsertRowid as number;
    });
};

export const addParticipantAssignment = async (assignment: Omit<ParticipantAssignment, 'id'>): Promise<number | undefined> => {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare(`
                INSERT INTO participant_assignments (session_iteration_id, participant_id, voting_device_id, kit_id)
                VALUES (@session_iteration_id, @participant_id, @voting_device_id, @kit_id)
            `);
            const result = stmt.run(assignment);
            return result.lastInsertRowid as number;
        } catch (error) {
            logger?.debug(`[DB ParticipantAssignments] Error adding participant assignment: ${error}`);
            throw error;
        }
    });
};

export const getParticipantAssignmentsByIterationId = async (iterationId: number): Promise<ParticipantAssignment[]> => {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("SELECT * FROM participant_assignments WHERE session_iteration_id = ?");
            return stmt.all(iterationId) as ParticipantAssignment[];
        } catch (error) {
            logger?.debug(`[DB ParticipantAssignments] Error getting participant assignments for iteration ${iterationId}: ${error}`);
            throw error;
        }
    });
};

export const updateParticipantStatusInIteration = async (participantId: number, iterationId: number, status: 'present' | 'absent'): Promise<number | undefined> => {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare(`
                UPDATE participant_assignments
                SET status = ?
                WHERE participant_id = ? AND session_iteration_id = ?
            `);
            const result = stmt.run(status, participantId, iterationId);
            logger?.info(`[DB ParticipantAssignments] Updated status for participant ${participantId} in iteration ${iterationId} to ${status}. Changes: ${result.changes}`);
            return result.changes;
        } catch (error) {
            logger?.debug(`[DB ParticipantAssignments] Error updating status for participant ${participantId} in iteration ${iterationId}: ${error}`);
            throw error;
        }
    });
};

export const clearAssignmentsForIteration = async (iterationId: number): Promise<void> => {
    return asyncDbRun(() => {
        try {
            const stmt = getDb().prepare("DELETE FROM participant_assignments WHERE session_iteration_id = ?");
            stmt.run(iterationId);
        } catch (error) {
            logger?.debug(`[DB ParticipantAssignments] Error clearing assignments for iteration ${iterationId}: ${error}`);
            throw error;
        }
    });
};
