import { useEffect } from 'react';
import {
  Session as DBSession,
  Trainer,
  Referential,
  Theme,
  Bloc,
  VotingDevice,
  DeviceKit,
  FormParticipant,
  Participant as DBParticipantType,
  CACESReferential,
} from '@common/types';
import { StorageManager } from '../../../services/StorageManager';
import { parseFullSessionExcel } from '../../../utils/excelProcessor';

interface UseSessionLoaderProps {
  sessionIdToLoad?: number;
  sessionToImport?: File | null;
  dispatch: React.Dispatch<any>;
  state: {
    referentielsData: Referential[];
    trainersList: Trainer[];
    deviceKitsList: DeviceKit[];
    hardwareDevices: VotingDevice[];
  }
}

const parseFrenchDate = (dateValue: string | Date | number): string => {
    if (!dateValue) return '';
    if (typeof dateValue === 'string') {
      const parts = dateValue.replace(/\//g, '-').split('-');
      if (parts.length === 3) {
        const [p1, p2, p3] = parts;
        if (p1.length <= 2 && p2.length <= 2 && p3.length === 4) {
          const date = new Date(Number(p3), Number(p2) - 1, Number(p1));
          if (!isNaN(date.getTime())) {
            const timezoneOffset = date.getTimezoneOffset() * 60000;
            const adjustedDate = new Date(date.getTime() - timezoneOffset);
            return adjustedDate.toISOString().split('T')[0];
          }
        }
      }
    }
    const date = new Date(dateValue as any);
    if (!isNaN(date.getTime())) {
      const timezoneOffset = date.getTimezoneOffset() * 60000;
      const adjustedDate = new Date(date.getTime() - timezoneOffset);
      return adjustedDate.toISOString().split('T')[0];
    }
    return dateValue.toString();
};

export const useSessionLoader = ({
  sessionIdToLoad,
  sessionToImport,
  dispatch,
  state,
}: UseSessionLoaderProps) => {

  useEffect(() => {
    const fetchGlobalData = async () => {
        dispatch({ type: 'SET_FIELD', field: 'isLoadingKits', payload: true });
        try {
          const [devices, trainers, refs, themes, blocs, kits, defaultKitResult] = await Promise.all([
            StorageManager.getAllVotingDevices(),
            StorageManager.getAllTrainers(),
            StorageManager.getAllReferentiels(),
            StorageManager.getAllThemes(),
            StorageManager.getAllBlocs(),
            StorageManager.getAllDeviceKits(),
            StorageManager.getDefaultDeviceKit()
          ]);
          dispatch({ type: 'SET_FIELD', field: 'hardwareDevices', payload: devices.sort((a: VotingDevice, b: VotingDevice) => (a.id ?? 0) - (b.id ?? 0)) });
          dispatch({ type: 'SET_FIELD', field: 'trainersList', payload: trainers.sort((a: Trainer, b: Trainer) => a.name.localeCompare(b.name)) });
          dispatch({ type: 'SET_FIELD', field: 'referentielsData', payload: refs });
          dispatch({ type: 'SET_FIELD', field: 'allThemesData', payload: themes });
          dispatch({ type: 'SET_FIELD', field: 'allBlocsData', payload: blocs });
          dispatch({ type: 'SET_FIELD', field: 'deviceKitsList', payload: kits });
          dispatch({ type: 'SET_FIELD', field: 'hardwareLoaded', payload: true });
          dispatch({ type: 'SET_FIELD', field: 'isLoadingKits', payload: false });

          if (!sessionIdToLoad) {
            if (trainers.length > 0) {
              const defaultTrainer = trainers.find((t: Trainer) => t.isDefault === 1) || trainers[0];
              if (defaultTrainer?.id) dispatch({ type: 'SET_FIELD', field: 'selectedTrainerId', payload: defaultTrainer.id });
            }
            if (defaultKitResult?.id) {
              dispatch({ type: 'SET_FIELD', field: 'selectedKitIdState', payload: defaultKitResult.id });
            } else if (kits.length > 0 && kits[0].id !== undefined) {
              dispatch({ type: 'SET_FIELD', field: 'selectedKitIdState', payload: kits[0].id });
            }
          }
        } catch (error) {
          console.error("Erreur lors du chargement des données globales:", error);
          dispatch({ type: 'SET_FIELD', field: 'importSummary', payload: "Erreur de chargement des données initiales." });
          dispatch({ type: 'SET_FIELD', field: 'isLoadingKits', payload: false });
        }
      };
      fetchGlobalData();
  }, [sessionIdToLoad, dispatch]);

  useEffect(() => {
    const loadSession = async () => {
      if (sessionIdToLoad && state.referentielsData.length > 0) {
        try {
          const sessionData = await StorageManager.getSessionById(sessionIdToLoad);
          dispatch({ type: 'SET_FIELD', field: 'editingSessionData', payload: sessionData || null });
          if (sessionData) {
            dispatch({ type: 'SET_FIELD', field: 'currentSessionDbId', payload: sessionData.id ?? null });
            dispatch({ type: 'SET_FIELD', field: 'sessionName', payload: sessionData.nomSession });
            dispatch({ type: 'SET_FIELD', field: 'sessionDate', payload: sessionData.dateSession ? sessionData.dateSession.split('T')[0] : '' });
            dispatch({ type: 'SET_FIELD', field: 'numSession', payload: sessionData.num_session || '' });
            dispatch({ type: 'SET_FIELD', field: 'numStage', payload: sessionData.num_stage || '' });
            if (sessionData.referentielId) {
                const refObj = state.referentielsData.find(r => r.id === sessionData.referentielId);
                if (refObj) {
                  dispatch({ type: 'SET_FIELD', field: 'selectedReferential', payload: refObj.code as CACESReferential });
                  dispatch({ type: 'SET_FIELD', field: 'selectedReferentialId', payload: refObj.id! });
                }
            }
          }
        } catch (error) {
          console.error("Erreur chargement session:", error);
          dispatch({ type: 'RESET_FORM' });
        }
      }
    };
    loadSession();
  }, [sessionIdToLoad, dispatch, state.referentielsData]);

  useEffect(() => {
    if (sessionToImport && state.referentielsData.length > 0 && state.trainersList.length > 0 && state.deviceKitsList.length > 0) {
        const processImport = async () => {
            dispatch({ type: 'SET_FIELD', field: 'isImporting', payload: true });
            try {
                const { details, participants: parsedParticipants } = await parseFullSessionExcel(sessionToImport);

                if (details.nomSession) dispatch({ type: 'SET_FIELD', field: 'sessionName', payload: details.nomSession.toString() });
                if (details.dateSession) dispatch({ type: 'SET_FIELD', field: 'sessionDate', payload: parseFrenchDate(details.dateSession.toString()) });
                if (details.numSession) dispatch({ type: 'SET_FIELD', field: 'numSession', payload: details.numSession.toString() });
                if (details.numStage) dispatch({ type: 'SET_FIELD', field: 'numStage', payload: details.numStage.toString() });
                if (details.location) dispatch({ type: 'SET_FIELD', field: 'location', payload: details.location.toString() });
                if (details.notes) dispatch({ type: 'SET_FIELD', field: 'notes', payload: details.notes.toString() });

                if (details.referentielCode) {
                    const ref = state.referentielsData.find(r => r.code === details.referentielCode);
                    if (ref) {
                        dispatch({ type: 'SET_FIELD', field: 'selectedReferentialId', payload: ref.id! });
                        dispatch({ type: 'SET_FIELD', field: 'selectedReferential', payload: ref.code as CACESReferential });
                    }
                }
                if (details.trainerName) {
                    const trainer = state.trainersList.find(t => t.name === details.trainerName);
                    if (trainer) {
                        dispatch({ type: 'SET_FIELD', field: 'selectedTrainerId', payload: trainer.id! });
                    }
                }
                if (details.kitName) {
                    const kit = state.deviceKitsList.find(k => k.name === details.kitName);
                    if (kit) {
                        dispatch({ type: 'SET_FIELD', field: 'selectedKitIdState', payload: kit.id! });
                    }
                }

                const iterationCount = parseInt(details.iterationCount?.toString() || '1', 10);
                dispatch({ type: 'SET_FIELD', field: 'iterationCount', payload: iterationCount });
                if (details.iterationNames) {
                    dispatch({ type: 'SET_FIELD', field: 'iterationNames', payload: details.iterationNames.toString().split(',').map((name: string) => name.trim()) });
                } else {
                    dispatch({ type: 'SET_FIELD', field: 'iterationNames', payload: Array.from({ length: iterationCount }, (_, i) => `Session_${i + 1}`) });
                }

                const newFormParticipants: FormParticipant[] = parsedParticipants.map((p, index) => {
                    const device = state.hardwareDevices.find(d => d.name === p.deviceName);
                    return {
                        uiId: `imported-${Date.now()}-${index}`,
                        firstName: p.prenom,
                        lastName: p.nom,
                        organization: p.organization,
                        identificationCode: p.identificationCode,
                        deviceId: null,
                        assignedGlobalDeviceId: device?.id ?? null,
                        hasSigned: false,
                        nom: p.nom,
                        prenom: p.prenom,
                        score: undefined,
                        reussite: undefined,
                        statusInSession: 'present',
                    };
                });
                dispatch({ type: 'SET_PARTICIPANTS', payload: newFormParticipants });

                const newAssignments: Record<number, { id: string; assignedGlobalDeviceId: number | null }[]> = {};
                newFormParticipants.forEach((fp, index) => {
                    const parsedP = parsedParticipants[index];
                    const iterationIndex = parsedP.iterationNumber - 1;
                    if (!newAssignments[iterationIndex]) {
                        newAssignments[iterationIndex] = [];
                    }
                    newAssignments[iterationIndex].push({
                        id: fp.uiId,
                        assignedGlobalDeviceId: fp.assignedGlobalDeviceId ?? null,
                    });
                });
                dispatch({ type: 'SET_ASSIGNMENTS', payload: newAssignments });

                dispatch({ type: 'SET_FIELD', field: 'importSummary', payload: `${parsedParticipants.length} participants et les détails de la session ont été importés avec succès.` });
            } catch (error) {
                console.error("Error processing imported session file:", error);
                dispatch({ type: 'SET_FIELD', field: 'importSummary', payload: `Erreur lors de l'importation du fichier de session: ${error instanceof Error ? error.message : 'Erreur inconnue'}` });
            } finally {
                dispatch({ type: 'SET_FIELD', field: 'isImporting', payload: false });
                dispatch({ type: 'SET_FIELD', field: 'importCompleted', payload: true });
            }
        };
        processImport();
    }
  }, [sessionToImport, dispatch, state.referentielsData, state.trainersList, state.deviceKitsList, state.hardwareDevices]);
};
