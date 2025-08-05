import { useState, useEffect, useCallback } from 'react';
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

interface UseSessionLoaderProps {
  sessionIdToLoad?: number;
  isImporting: boolean;
  importCompleted: boolean;
  hardwareLoaded: boolean;
  setHardwareLoaded: (loaded: boolean) => void;
  referentielsData: Referential[];
  setReferentielsData: (data: Referential[]) => void;
  setTrainersList: (data: Trainer[]) => void;
  setAllThemesData: (data: Theme[]) => void;
  setAllBlocsData: (data: Bloc[]) => void;
  setDeviceKitsList: (data: DeviceKit[]) => void;
  setHardwareDevices: (data: VotingDevice[]) => void;
  setEditingSessionData: (data: DBSession | null) => void;
  setCurrentSessionDbId: (id: number | null) => void;
  setSessionName: (name: string) => void;
  setSessionDate: (date: string) => void;
  setNumSession: (num: string) => void;
  setNumStage: (num: string) => void;
  setSelectedReferential: (ref: CACESReferential | '') => void;
  setSelectedReferentialId: (id: number | null) => void;
  setLocation: (location: string) => void;
  setNotes: (notes: string) => void;
  setSelectedTrainerId: (id: number | null) => void;
  setSelectedBlocIds: (ids: number[]) => void;
  setSelectedKitIdState: (id: number | null) => void;
  setIterationCount: (count: number) => void;
  setIterationNames: (names: string[]) => void;
  setParticipants: (participants: FormParticipant[]) => void;
  setParticipantAssignments: (assignments: Record<number, { id: string; assignedGlobalDeviceId: number | null }[]>) => void;
  setImportSummary: (summary: string | null) => void;
  resetForm: () => void;
}

export const useSessionLoader = ({
  sessionIdToLoad,
  isImporting,
  importCompleted,
  hardwareLoaded,
  setHardwareLoaded,
  referentielsData,
  setReferentielsData,
  setTrainersList,
  setAllThemesData,
  setAllBlocsData,
  setDeviceKitsList,
  setHardwareDevices,
  setEditingSessionData,
  setCurrentSessionDbId,
  setSessionName,
  setSessionDate,
  setNumSession,
  setNumStage,
  setSelectedReferential,
  setSelectedReferentialId,
  setLocation,
  setNotes,
  setSelectedTrainerId,
  setSelectedBlocIds,
  setSelectedKitIdState,
  setIterationCount,
  setIterationNames,
  setParticipants,
  setParticipantAssignments,
  setImportSummary,
  resetForm,
}: UseSessionLoaderProps) => {

  useEffect(() => {
    const fetchGlobalData = async () => {
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
        setHardwareDevices(devices.sort((a: VotingDevice, b: VotingDevice) => (a.id ?? 0) - (b.id ?? 0)));
        setTrainersList(trainers.sort((a: Trainer, b: Trainer) => a.name.localeCompare(b.name)));
        setReferentielsData(refs);
        setAllThemesData(themes);
        setAllBlocsData(blocs);
        setDeviceKitsList(kits);
        setHardwareLoaded(true);

        if (!sessionIdToLoad) {
          if (trainers.length > 0) {
            const defaultTrainer = trainers.find((t: Trainer) => t.isDefault === 1) || trainers[0];
            if (defaultTrainer?.id) setSelectedTrainerId(defaultTrainer.id);
          }
          if (defaultKitResult?.id) {
            setSelectedKitIdState(defaultKitResult.id);
          } else if (kits.length > 0 && kits[0].id !== undefined) {
            setSelectedKitIdState(kits[0].id);
          }
        }
      } catch (error) {
        console.error("Erreur lors du chargement des données globales:", error);
        setImportSummary("Erreur de chargement des données initiales.");
      }
    };
    fetchGlobalData();
  }, [sessionIdToLoad]);

  useEffect(() => {
    if (sessionIdToLoad && !isImporting && hardwareLoaded && referentielsData.length > 0) {
      const loadSession = async () => {
        try {
          const sessionData = await StorageManager.getSessionById(sessionIdToLoad);
          setEditingSessionData(sessionData || null);
          if (sessionData) {
            setCurrentSessionDbId(sessionData.id ?? null);
            setSessionName(sessionData.nomSession);
            setSessionDate(sessionData.dateSession ? sessionData.dateSession.split('T')[0] : '');
            setNumSession(sessionData.num_session || '');
            setNumStage(sessionData.num_stage || '');
            if (sessionData.referentielId) {
              const refObj = referentielsData.find(r => r.id === sessionData.referentielId);
              if (refObj) {
                setSelectedReferential(refObj.code as CACESReferential);
                setSelectedReferentialId(refObj.id!);
              } else {
                setSelectedReferential('');
                setSelectedReferentialId(null);
              }
            } else {
              const oldRefCode = (sessionData as any).referentiel as CACESReferential | '';
              setSelectedReferential(oldRefCode);
              const refObj = referentielsData.find(r => r.code === oldRefCode);
              setSelectedReferentialId(refObj?.id || null);
            }
            setLocation(sessionData.location || '');
            setNotes(sessionData.notes || '');
            setSelectedTrainerId(sessionData.trainerId || null);
            setSelectedBlocIds(sessionData.selectedBlocIds || []);
            setSelectedKitIdState(sessionData.selectedKitId || null);

            if (sessionData.iteration_count && sessionData.iteration_count > 0) {
              const count = sessionData.iteration_count;
              setIterationCount(count);
              let names = sessionData.iterations?.map((iter: { name: any; }, index: number) => iter.name || `Session_${index + 1}`) || [];
              if (names.length < count) {
                const additionalNames = Array.from({ length: count - names.length }, (_, i) => `Session_${names.length + i + 1}`);
                names = [...names, ...additionalNames];
              }
              if (names.length > count) {
                names = names.slice(0, count);
              }
              setIterationNames(names);
            } else {
              setIterationCount(1);
              setIterationNames(['Session_1']);
            }

            if (sessionData.iterations && sessionData.iterations.length > 0) {
                const allParticipantsFromIterations = (sessionData.iterations.flatMap((iter: any) => (iter as any).participants || [])) as DBParticipantType[];
                const uniqueParticipantsMap = new Map<string | number, DBParticipantType>();
                allParticipantsFromIterations.forEach((p: DBParticipantType) => {
                    if (p.id) {
                        uniqueParticipantsMap.set(p.id, p);
                    }
                });
                const uniqueParticipants = Array.from(uniqueParticipantsMap.values());
                const formParticipants: FormParticipant[] = uniqueParticipants.map((p_db: DBParticipantType) => ({
                    ...p_db,
                    uiId: p_db.id!.toString(),
                    firstName: p_db.prenom,
                    lastName: p_db.nom,
                    deviceId: p_db.assignedGlobalDeviceId || null,
                    organization: p_db.organization || '',
                    hasSigned: false,
                }));
                setParticipants(formParticipants);

                const newAssignments: Record<number, { id: string; assignedGlobalDeviceId: number | null }[]> = {};
                sessionData.iterations.forEach((iter: any) => {
                    if (!iter.id) return;
                    const participantsForThisIter = (iter as any).participants || [];
                    const assignmentsForThisIter = participantsForThisIter
                        .map((p_iter: DBParticipantType) => {
                            if (!p_iter.id) return null;
                            const matchingFormParticipant = formParticipants.find(fp => fp.id === p_iter.id);
                            if (matchingFormParticipant) {
                                return {
                                    id: matchingFormParticipant.uiId,
                                    assignedGlobalDeviceId: p_iter.assignedGlobalDeviceId || null
                                };
                            }
                            return null;
                        })
                        .filter((p): p is { id: string; assignedGlobalDeviceId: number | null } => p !== null);

                    newAssignments[iter.iteration_index] = assignmentsForThisIter;
                });
                setParticipantAssignments(newAssignments);
            } else {
              setParticipants([]);
              setParticipantAssignments({});
            }
          } else {
            resetForm();
          }
        } catch (error) {
            console.error("Erreur chargement session:", error);
            resetForm();
        }
      };
      loadSession();
    } else if (!sessionIdToLoad && !isImporting && !importCompleted) {
      resetForm();
    }
  }, [sessionIdToLoad, isImporting, importCompleted, hardwareLoaded, referentielsData, resetForm]);
};
