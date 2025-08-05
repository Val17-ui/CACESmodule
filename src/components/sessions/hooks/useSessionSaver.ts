import {
  CACESReferential,
  Session as DBSession,
  Participant as DBParticipantType,
  Referential,
  FormParticipant,
} from '@common/types';
import { StorageManager } from '../../../services/StorageManager';

// Define the state the hook needs from the component
interface SessionSaverState {
  currentSessionDbId: number | null;
  sessionName: string;
  sessionDate: string;
  numSession: string;
  numStage: string;
  iterationCount: number;
  iterationNames: string[];
  selectedReferential: CACESReferential | '';
  selectedReferentialId: number | null;
  location: string;
  notes: string;
  participants: FormParticipant[];
  selectedBlocIds: number[];
  editingSessionData: DBSession | null;
  selectedTrainerId: number | null;
  referentielsData: Referential[];
  selectedKitIdState: number | null;
  participantAssignments: Record<number, { id: string; assignedGlobalDeviceId: number | null }[]>;
}

// Define the props for the hook
interface UseSessionSaverProps {
  initialState: SessionSaverState;
  setEditingSessionData: (session: DBSession | null) => void;
  setCurrentSessionDbId: (id: number | null) => void;
  setImportSummary: (summary: string | null) => void;
  setModifiedAfterOrsGeneration: (modified: boolean) => void;
}

export const useSessionSaver = ({
  initialState,
  setEditingSessionData,
  setCurrentSessionDbId,
  setImportSummary,
  setModifiedAfterOrsGeneration,
}: UseSessionSaverProps) => {
  const {
    currentSessionDbId,
    sessionName,
    sessionDate,
    numSession,
    numStage,
    iterationCount,
    iterationNames,
    selectedReferential,
    selectedReferentialId,
    location,
    notes,
    participants,
    selectedBlocIds,
    editingSessionData,
    selectedTrainerId,
    referentielsData,
    selectedKitIdState,
    participantAssignments,
  } = initialState;

  const prepareSessionDataForDb = async (includeOrsBlob?: string | Blob | ArrayBuffer | null): Promise<DBSession | null> => {
    let currentReferentielId: number | undefined = undefined;
    if (selectedReferentialId) {
        currentReferentielId = selectedReferentialId;
    } else if (selectedReferential) {
        const refObj = referentielsData.find(r => r.code === selectedReferential);
        if (refObj?.id) {
            currentReferentielId = refObj.id;
        } else {
            console.error(`Impossible de trouver l'ID pour le code référentiel: ${selectedReferential}`);
            setImportSummary(`Erreur: Référentiel ${selectedReferential} non valide.`);
            return null;
        }
    } else if (editingSessionData?.referentielId) {
        currentReferentielId = editingSessionData.referentielId;
    }
    const sessionToSave: Omit<DBSession, 'participants'> = {
      id: currentSessionDbId || undefined,
      iteration_count: iterationCount,
      nomSession: sessionName || `Session du ${new Date().toLocaleDateString()}`,
      dateSession: sessionDate || new Date().toISOString().split('T')[0],
      num_session: numSession,
      num_stage: numStage,
      referentielId: currentReferentielId,
      selectedBlocIds: selectedBlocIds,
      selectedKitId: selectedKitIdState,
      orsFilePath: includeOrsBlob !== undefined ? includeOrsBlob : editingSessionData?.orsFilePath,
      status: editingSessionData?.status || 'planned',
      location: location,
      questionMappings: editingSessionData?.questionMappings,
      notes: notes,
      trainerId: selectedTrainerId ?? undefined,
      createdAt: editingSessionData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ignoredSlideGuids: editingSessionData?.ignoredSlideGuids,
      resolvedImportAnomalies: editingSessionData?.resolvedImportAnomalies,
      resultsImportedAt: null,
    };
    return sessionToSave as DBSession;
  };

  const handleSaveSession = async (sessionDataToSave: DBSession | null) => {
    console.log('[SessionSave] Starting save process...');
    if (!sessionDataToSave) return null;

    const assignedParticipantIds = new Set(Object.values(participantAssignments).flat().map((p: { id: string; }) => p.id));
    const unassignedParticipants = participants.filter(p => !assignedParticipantIds.has(p.uiId));

    if (unassignedParticipants.length > 0) {
        const unassignedNames = unassignedParticipants.map(p => `${p.firstName} ${p.lastName}`).join(', ');
        const warningMessage = `Attention : Le(s) participant(s) suivant(s) ne sont assignés à aucune itération et ne seront pas sauvegardés : ${unassignedNames}. Voulez-vous continuer quand même ?`;
        if (!window.confirm(warningMessage)) {
            return null;
        }
    }

    try {
        const participantDbIdMap = new Map<string, number>();
        for (const p of participants) {
            const dbParticipant: DBParticipantType = {
                nom: p.lastName,
                prenom: p.firstName,
                organization: p.organization,
                identificationCode: p.identificationCode,
            };
            const dbId = await StorageManager.upsertParticipant(dbParticipant);
            if (typeof dbId === 'number') {
                participantDbIdMap.set(p.uiId, dbId);
            } else {
                console.warn(`[handleSaveSession] dbId pour participant ${p.uiId} n'est pas un nombre: ${dbId}`);
            }
        }

        let savedSessionId: number | undefined;
        if (sessionDataToSave.id) {
            await StorageManager.updateSession(sessionDataToSave.id, sessionDataToSave);
            savedSessionId = sessionDataToSave.id;
        } else {
            const newId = await StorageManager.addSession(sessionDataToSave);
            if (newId) {
                setCurrentSessionDbId(newId);
                savedSessionId = newId;
            } else {
                setImportSummary("Erreur critique : La nouvelle session n'a pas pu être créée.");
                return null;
            }
        }

        if (savedSessionId) {
            for (let i = 0; i < iterationCount; i++) {
                const existingIteration = editingSessionData?.iterations?.find(iter => iter.iteration_index === i);

                const iterationToSave: any = {
                    id: existingIteration?.id,
                    session_id: savedSessionId,
                    iteration_index: i,
                    name: iterationNames[i] || `Session_${i + 1}`,
                    status: existingIteration?.status || 'planned',
                    ors_file_path: existingIteration?.ors_file_path,
                    question_mappings: existingIteration?.question_mappings,
                    created_at: existingIteration?.created_at || new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                };

                const savedIterationId = await StorageManager.addOrUpdateSessionIteration(iterationToSave);

                if (savedIterationId) {
                    const assignedFormParticipantIds = (participantAssignments[i] || []).map((p: {id: string}) => p.id);
                    const assignmentsForDb = [];

                    for (const formPId of assignedFormParticipantIds) {
                        const dbPId = participantDbIdMap.get(formPId);
                        const participantFormState = participants.find(p => p.uiId === formPId);
                        if (dbPId && participantFormState && participantFormState.assignedGlobalDeviceId) {
                            assignmentsForDb.push({
                                session_iteration_id: savedIterationId,
                                participant_id: dbPId,
                                voting_device_id: participantFormState.assignedGlobalDeviceId,
                                kit_id: selectedKitIdState || 0,
                            });
                        }
                    }
                    await StorageManager.setParticipantAssignmentsForIteration(savedIterationId, assignmentsForDb);
                }
            }
            const reloadedSession = await StorageManager.getSessionById(savedSessionId);
            setEditingSessionData(reloadedSession || null);
            if (reloadedSession) {
                setModifiedAfterOrsGeneration(false);
            }
        }
        return savedSessionId;
    } catch (error: any) {
        console.error("Erreur sauvegarde session:", error);
        setImportSummary(`Erreur sauvegarde session: ${error.message}`);
        return null;
    }
  };

  return { prepareSessionDataForDb, handleSaveSession };
};
