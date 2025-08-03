import React, { useState, useEffect, useCallback } from 'react';
import Button from '../ui/Button';
import { Save, Trash2 } from 'lucide-react';
import {
  CACESReferential,
  Session as DBSession,
  Participant as DBParticipantType,
  Trainer,
  SessionQuestion,
  SessionBoitier,
  Referential,
  Theme,
  Bloc,
  QuestionWithId as StoredQuestion,
  VotingDevice,
  DeviceKit
} from '@common/types';
import { StorageManager } from '../../services/StorageManager';
import { parseOmbeaResultsXml, ExtractedResultFromXml, transformParsedResponsesToSessionResults } from '../../utils/resultsParser';
import { getActivePptxTemplateFile } from '../../utils/templateManager';
import { logger } from '../../utils/logger';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import AnomalyResolutionModal, { DetectedAnomalies } from './AnomalyResolutionModal';
import { ExpectedIssueResolution, UnknownDeviceResolution } from '@common/types';

type FormParticipant = DBParticipantType & {
  uiId: string;
  dbId?: number;
  firstName: string;
  lastName: string;
  deviceId: number | null;
  hasSigned?: boolean;
};

import { parseFullSessionExcel } from '../../utils/excelProcessor';

interface SessionFormProps {
  sessionIdToLoad?: number;
  sessionToImport?: File | null;
}

type TabKey = 'details' | 'participants' | 'generateQuestionnaire' | 'importResults';

interface AdminPPTXSettings {
    defaultDuration: number;
    pollTimeLimit: number;
    answersBulletStyle: string;
    pollStartMode: string;
    chartValueLabelFormat: string;
    pollCountdownStartMode: string;
    pollMultipleResponse: string;
}

import ResultsImporter from './form/ResultsImporter';
import QuestionnaireGenerator from './form/QuestionnaireGenerator';
import ParticipantManager from './form/ParticipantManager';
import SessionDetailsForm from './form/SessionDetailsForm';

const parseFrenchDate = (dateValue: string | Date | number): string => {
  if (!dateValue) return '';

  // The new Date() constructor can handle many formats, including ISO strings,
  // timestamps (numbers), and the long string format from the logs.
  // It is, however, unreliable for DD/MM/YYYY formats, which must be handled manually.

  if (typeof dateValue === 'string') {
    const parts = dateValue.replace(/\//g, '-').split('-');
    if (parts.length === 3) {
      const [p1, p2, p3] = parts;
      // DD-MM-YYYY
      if (p1.length <= 2 && p2.length <= 2 && p3.length === 4) {
        // new Date(year, monthIndex, day)
        const date = new Date(Number(p3), Number(p2) - 1, Number(p1));
        if (!isNaN(date.getTime())) {
          const timezoneOffset = date.getTimezoneOffset() * 60000;
          const adjustedDate = new Date(date.getTime() - timezoneOffset);
          return adjustedDate.toISOString().split('T')[0];
        }
      }
    }
  }

  // For all other cases (Date object, timestamp, YYYY-MM-DD string, long string)
  // use the new Date() constructor which is more robust for these formats.
  const date = new Date(dateValue as any);
  if (!isNaN(date.getTime())) {
    const timezoneOffset = date.getTimezoneOffset() * 60000;
    const adjustedDate = new Date(date.getTime() - timezoneOffset);
    return adjustedDate.toISOString().split('T')[0];
  }

  return dateValue.toString(); // Fallback
};


const SessionForm: React.FC<SessionFormProps> = ({ sessionIdToLoad, sessionToImport }) => {
  const [currentSessionDbId, setCurrentSessionDbId] = useState<number | null>(sessionIdToLoad || null);
  const [sessionName, setSessionName] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [numSession, setNumSession] = useState('');
  const [numStage, setNumStage] = useState('');
  const [iterationCount, setIterationCount] = useState(1);
  const [iterationNames, setIterationNames] = useState<string[]>(['Session_1']);
  const [selectedReferential, setSelectedReferential] = useState<CACESReferential | ''>('');
  const [selectedReferentialId, setSelectedReferentialId] = useState<number | null>(null);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [participants, setParticipants] = useState<FormParticipant[]>([]);
  const [displayedBlockDetails, setDisplayedBlockDetails] = useState<Array<{ themeName: string, blocName: string }>>([]);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [editingSessionData, setEditingSessionData] = useState<DBSession | null>(null);
  const [hardwareDevices, setHardwareDevices] = useState<VotingDevice[]>([]);
  const [hardwareLoaded, setHardwareLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('details');
  const [isGeneratingOrs, setIsGeneratingOrs] = useState(false);
  const [modifiedAfterOrsGeneration, setModifiedAfterOrsGeneration] = useState(false);
  const [trainersList, setTrainersList] = useState<Trainer[]>([]);
  const [selectedTrainerId, setSelectedTrainerId] = useState<number | null>(null);
  const [referentielsData, setReferentielsData] = useState<Referential[]>([]);
  const [allThemesData, setAllThemesData] = useState<Theme[]>([]);
  const [allBlocsData, setAllBlocsData] = useState<Bloc[]>([]);
  const [deviceKitsList, setDeviceKitsList] = useState<DeviceKit[]>([]);
  const [selectedKitIdState, setSelectedKitIdState] = useState<number | null>(null);
  const [isLoadingKits, setIsLoadingKits] = useState(true);
  const [votingDevicesInSelectedKit, setVotingDevicesInSelectedKit] = useState<VotingDevice[]>([]);
  const [detectedAnomalies, setDetectedAnomalies] = useState<DetectedAnomalies | null>(null);
  const [pendingValidResults, setPendingValidResults] = useState<ExtractedResultFromXml[]>([]);
  const [showAnomalyResolutionUI, setShowAnomalyResolutionUI] = useState<boolean>(false);
  const [currentIterationForImport, setCurrentIterationForImport] = useState<number | null>(null);
  const [participantAssignments, setParticipantAssignments] = useState<Record<number, { id: string; assignedGlobalDeviceId: number | null }[]>>({});
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    const fetchGlobalData = async () => {
      setIsLoadingKits(true);
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
        setIsLoadingKits(false);

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
        setIsLoadingKits(false);
      }
    };
    fetchGlobalData();
  }, [sessionIdToLoad]);

  useEffect(() => {
    const fetchDevicesInKit = async () => {
      if (selectedKitIdState !== null) {
        try {
          const devices = await StorageManager.getVotingDevicesForKit(selectedKitIdState);
          setVotingDevicesInSelectedKit(devices);
        } catch (error) {
          console.error(`Erreur lors du chargement des boîtiers pour le kit ${selectedKitIdState}:`, error);
          setVotingDevicesInSelectedKit([]);
        }
      } else {
        setVotingDevicesInSelectedKit([]);
      }
    };
    fetchDevicesInKit();
  }, [selectedKitIdState]);

  const resetFormTactic = useCallback(() => {
    setCurrentSessionDbId(null);
    setSessionName('');
    setSessionDate('');
    setSelectedReferential('');
    setSelectedReferentialId(null);
    setLocation('');
    setNotes('');
    setParticipants([]);
    setDisplayedBlockDetails([]);
    setImportSummary(null);
    setEditingSessionData(null);
    setActiveTab('details');
    setModifiedAfterOrsGeneration(false);
  }, []);

  useEffect(() => {
    if (sessionIdToLoad && !isImporting && hardwareLoaded && referentielsData.length > 0) {
      const loadSession = async () => {
        console.log(`[SessionLoad] Loading session with ID: ${sessionIdToLoad}`);
        try {
          const sessionData = await StorageManager.getSessionById(sessionIdToLoad);
          console.log('[SessionLoad] Raw data from DB:', sessionData);
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
                console.warn(`Référentiel avec ID ${sessionData.referentielId} non trouvé dans referentielsData.`);
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

            setModifiedAfterOrsGeneration(false);
            if (sessionData.iterations && sessionData.iterations.length > 0) {
                console.log('[SessionLoad-LOG] Step 1: Raw sessionData.iterations received from DB:', JSON.parse(JSON.stringify(sessionData.iterations)));
                                                                                    const allParticipantsFromIterations = sessionData.iterations.flatMap((iter: any) => (iter as any).participants || []);
                console.log('[SessionLoad-LOG] Step 2: Flattened list of all participants from all iterations:', JSON.parse(JSON.stringify(allParticipantsFromIterations)));

                const uniqueParticipantsMap = new Map<string | number, DBParticipantType>();
                allParticipantsFromIterations.forEach((p: DBParticipantType) => {
                    if (p.id) {
                        uniqueParticipantsMap.set(p.id, p);
                    }
                });
                const uniqueParticipants = Array.from(uniqueParticipantsMap.values());
                console.log('[SessionLoad-LOG] Step 3: De-duplicated list of unique participants:', JSON.parse(JSON.stringify(uniqueParticipants)));

                const formParticipants: FormParticipant[] = uniqueParticipants.map((p_db: DBParticipantType) => ({
                    ...p_db,
                    uiId: p_db.id!.toString(),
                    firstName: p_db.prenom,
                    lastName: p_db.nom,
                    deviceId: p_db.assignedGlobalDeviceId || null,
                    organization: p_db.organization || '',
                    hasSigned: false,
                }));
                console.log('[SessionLoad-LOG] Step 4: Mapped participants to FormParticipant shape:', JSON.parse(JSON.stringify(formParticipants)));
                setParticipants(formParticipants);

                const newAssignments: Record<number, { id: string; assignedGlobalDeviceId: number | null }[]> = {};
                console.log('[FINAL_DEBUG] Form Participants State before assignment:', JSON.parse(JSON.stringify(formParticipants)));
                sessionData.iterations.forEach((iter: any) => {
                    if (!iter.id) return;
                    const participantsForThisIter = (iter as any).participants || [];
                    console.log(`[FINAL_DEBUG] Iteration ${iter.iteration_index} - Participants from DB:`, JSON.parse(JSON.stringify(participantsForThisIter)));

                    const assignmentsForThisIter = participantsForThisIter
                        .map((p_iter: DBParticipantType) => {
                            if (!p_iter.id) {
                                console.warn('[SessionLoad-LOG] Iteration participant missing ID:', p_iter);
                                return null;
                            };
                            const matchingFormParticipant = formParticipants.find(fp => fp.dbId === p_iter.id);
                            if (matchingFormParticipant) {
                                return {
                                    id: matchingFormParticipant.id,
                                    assignedGlobalDeviceId: p_iter.assignedGlobalDeviceId || null
                                };
                            }
                            console.warn(`[SessionLoad-LOG] Could not find a matching form participant for DB participant ID: ${p_iter.id}`);
                            return null;
                        })
                        .filter((p: { id: string; assignedGlobalDeviceId: number | null } | null): p is { id: string; assignedGlobalDeviceId: number | null } => p !== null);

                    newAssignments[iter.iteration_index] = assignmentsForThisIter;
                });
                console.log('[SessionLoad-LOG] Step 5b: Final reconstructed participant assignments object:', JSON.parse(JSON.stringify(newAssignments)));
                setParticipantAssignments(newAssignments);
            } else {
              console.log('[SessionLoad-LOG] No iterations found in sessionData, setting participants and assignments to empty.');
              setParticipants([]);
              setParticipantAssignments({});
            }
          } else {
            console.warn(`Session avec ID ${sessionIdToLoad} non trouvée.`);
            resetFormTactic();
          }
        } catch (error) {
            console.error("Erreur chargement session:", error);
            resetFormTactic();
        }
      };
      loadSession();
    } else if (!sessionIdToLoad && !isImporting && referentielsData.length > 0) {
      resetFormTactic();
    }
  }, [sessionIdToLoad, isImporting, hardwareLoaded, referentielsData, resetFormTactic]);

  useEffect(() => {
    if (editingSessionData?.selectedBlocIds && allThemesData.length > 0 && allBlocsData.length > 0) {
      const details: Array<{ themeName: string, blocName: string }> = [];
      for (const blocId of editingSessionData.selectedBlocIds) {
        const bloc = allBlocsData.find(b => b.id === blocId);
        if (bloc) {
          const theme = allThemesData.find(t => t.id === bloc.theme_id);
          details.push({
            themeName: theme ? `${theme.code_theme} - ${theme.nom_complet}` : `ID Thème: ${bloc.theme_id}`,
            blocName: bloc.code_bloc
          });
        } else {
          details.push({ themeName: 'N/A', blocName: `ID Bloc: ${blocId}` });
        }
      }
      setDisplayedBlockDetails(details);
    } else {
      setDisplayedBlockDetails([]);
    }
  }, [editingSessionData, editingSessionData?.selectedBlocIds, allThemesData, allBlocsData]);

  useEffect(() => {
    // If there is only one iteration, all participants should be assigned to it by default.
    // This is crucial because the iteration selection dropdown is not shown in the UI for single-iteration sessions.
    if (iterationCount === 1) {
        const allParticipantIds = participants.map(p => ({ id: p.uiId, assignedGlobalDeviceId: p.assignedGlobalDeviceId || null }));
        // Only update the state if it's different to avoid an infinite loop.
        if (JSON.stringify(participantAssignments[0] || []) !== JSON.stringify(allParticipantIds)) {
            setParticipantAssignments({ 0: allParticipantIds });
        }
    }
  }, [participants, iterationCount, participantAssignments]);

  useEffect(() => {
    if (sessionToImport) {
        if (referentielsData.length === 0 || trainersList.length === 0 || deviceKitsList.length === 0) {
            // Data is not ready yet, wait for the next run of the effect.
            return;
        }
        setIsImporting(true);
        const processImport = async () => {
            try {
                const { details, participants: parsedParticipants } = await parseFullSessionExcel(sessionToImport);

                // Populate session details
                if (details.nomSession) setSessionName(details.nomSession.toString());
                if (details.dateSession) setSessionDate(parseFrenchDate(details.dateSession.toString()));
                if (details.numSession) setNumSession(details.numSession.toString());
                if (details.numStage) setNumStage(details.numStage.toString());
                if (details.location) setLocation(details.location.toString());
                if (details.notes) setNotes(details.notes.toString());

                // Lookups
                if (details.referentielCode) {
                    const ref = referentielsData.find(r => r.code === details.referentielCode);
                    if (ref) {
                        setSelectedReferentialId(ref.id!);
                        setSelectedReferential(ref.code as CACESReferential);
                    } else {
                        console.warn(`Referential with code ${details.referentielCode} not found.`);
                    }
                }
                if (details.trainerName) {
                    const trainer = trainersList.find(t => t.name === details.trainerName);
                    if (trainer) {
                        setSelectedTrainerId(trainer.id!);
                    } else {
                        console.warn(`Trainer with name ${details.trainerName} not found.`);
                    }
                }
                if (details.kitName) {
                    const kit = deviceKitsList.find(k => k.name === details.kitName);
                    if (kit) {
                        setSelectedKitIdState(kit.id!);
                    } else {
                        console.warn(`Kit with name ${details.kitName} not found.`);
                    }
                }

                // Iterations
                const iterationCount = parseInt(details.iterationCount?.toString() || '1', 10);
                setIterationCount(iterationCount);
                if (details.iterationNames) {
                    setIterationNames(details.iterationNames.toString().split(',').map((name: string) => name.trim()));
                } else {
                    setIterationNames(Array.from({ length: iterationCount }, (_, i) => `Session_${i + 1}`));
                }

                // Populate participants
                const newFormParticipants: FormParticipant[] = parsedParticipants.map((p, index) => {
                    const device = hardwareDevices.find(d => d.name === p.deviceName);
                    return {
                        uiId: `imported-${Date.now()}-${index}`,
                        dbId: undefined,
                        firstName: p.prenom,
                        lastName: p.nom,
                        organization: p.organization,
                        identificationCode: p.identificationCode,
                        deviceId: null, // This is a visual ID, not the hardware ID. Let's see how it's used.
                        assignedGlobalDeviceId: device?.id ?? null,
                        hasSigned: false,
                        // DBParticipantType fields
                        nom: p.nom,
                        prenom: p.prenom,
                        score: undefined,
                        reussite: undefined,
                        statusInSession: 'present',
                    };
                });
                setParticipants(newFormParticipants);

                // Populate participant assignments
                const newAssignments: Record<number, { id: string; assignedGlobalDeviceId: number | null }[]> = {};
                newFormParticipants.forEach((fp, index) => {
                    const parsedP = parsedParticipants[index];
                    const iterationIndex = parsedP.iterationNumber - 1; // 0-based index
                    if (!newAssignments[iterationIndex]) {
                        newAssignments[iterationIndex] = [];
                    }
                    newAssignments[iterationIndex].push({
                        id: fp.uiId,
                        assignedGlobalDeviceId: fp.assignedGlobalDeviceId ?? null,
                    });
                });
                setParticipantAssignments(newAssignments);

                setImportSummary(`${parsedParticipants.length} participants et les détails de la session ont été importés avec succès.`);
            } catch (error) {
                console.error("Error processing imported session file:", error);
                setImportSummary(`Erreur lors de l'importation du fichier de session: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
            } finally {
                setIsImporting(false);
            }
        };
        processImport();
    }
}, [sessionToImport, referentielsData, trainersList, deviceKitsList, hardwareDevices]); // Dependencies are important!

  

  const handleAddParticipant = () => {
    if (editingSessionData?.orsFilePath && editingSessionData.status !== 'completed') { setModifiedAfterOrsGeneration(true); }
    if (!selectedKitIdState) {
      alert("Veuillez d'abord sélectionner un kit de boîtiers dans l'onglet 'Participants'.");
      setActiveTab('participants');
      return;
    }
    if (votingDevicesInSelectedKit.length === 0) {
      alert("Le kit sélectionné ne contient aucun boîtier. Veuillez ajouter des boîtiers au kit ou en sélectionner un autre.");
      return;
    }

    const assignedDeviceIds = participants.map(p => p.assignedGlobalDeviceId).filter(id => id !== null);
    const nextAvailableDevice = votingDevicesInSelectedKit.find(d => !assignedDeviceIds.includes(d.id));

    const newParticipant: FormParticipant = {
      nom: '',
      prenom: '',
      identificationCode: '',
      score: undefined,
      reussite: undefined,
      assignedGlobalDeviceId: nextAvailableDevice?.id || null,
      statusInSession: 'present',
      uiId: Date.now().toString(),
      firstName: '',
      lastName: '',
      organization: '',
      deviceId: null,
      hasSigned: false,
    };
    setParticipants([...participants, newParticipant]);
  };

  const handleRemoveParticipant = (id: string) => {
    if (editingSessionData?.orsFilePath && editingSessionData.status !== 'completed') { setModifiedAfterOrsGeneration(true); }
    const updatedParticipants = participants.filter(p => p.uiId !== id);
    setParticipants(updatedParticipants);
    // Also remove from assignments
    setParticipantAssignments(prev => {
        const newAssignments = { ...prev };
        Object.keys(newAssignments).forEach(iterIndex => {
            const index = parseInt(iterIndex, 10);
            newAssignments[index] = (newAssignments[index] || []).filter(p => p.id !== id);
        });
        return newAssignments;
    });
  };

  const handleParticipantChange = (id: string, field: keyof FormParticipant, value: string | number | boolean | null) => {
    if (editingSessionData?.orsFilePath && field !== 'deviceId' && editingSessionData.status !== 'completed') {
      setModifiedAfterOrsGeneration(true);
    }
    setParticipants(participants.map((p: FormParticipant) => {
      if (p.uiId === id) {
        const updatedP = { ...p, [field]: value };
        if (field === 'firstName') updatedP.prenom = value as string;
        if (field === 'lastName') updatedP.nom = value as string;
        return updatedP;
      }
      return p;
    }));
  };

  const handleParticipantIterationChange = (participantUiId: string, newIterationIndex: number) => {
    console.log(`[IterationChange] participantUiId: ${participantUiId}, newIterationIndex: ${newIterationIndex}`);
    setParticipantAssignments(prev => {
        const newAssignments = { ...prev };
        const participantToMove = participants.find(p => p.uiId === participantUiId);
        if (!participantToMove) {
            console.warn(`[IterationChange] Participant with uiId ${participantUiId} not found in state.`);
            return prev;
        }

        // Remove participant from all iterations first
        Object.keys(newAssignments).forEach(iterIndex => {
            const index = parseInt(iterIndex, 10);
            newAssignments[index] = (newAssignments[index] || []).filter(p => p.id !== participantUiId);
        });

        // Add to the new iteration
        if (!newAssignments[newIterationIndex]) {
            newAssignments[newIterationIndex] = [];
        }
        newAssignments[newIterationIndex].push({ id: participantToMove.uiId, assignedGlobalDeviceId: participantToMove.assignedGlobalDeviceId || null });

        console.log('[IterationChange] New assignments state:', newAssignments);
        return newAssignments;
    });
  };

  const parseCsvParticipants = (fileContent: string): Array<Partial<DBParticipantType>> => {
    const parsed: Array<Partial<DBParticipantType>> = [];
    const lines = fileContent.split(/\r\n|\n/);
    lines.forEach(line => {
      if (line.trim() === '') return;
      const values = line.split(',');
      if (values.length >= 2) {
        parsed.push({
          prenom: values[0]?.trim() || '', nom: values[1]?.trim() || '',
          organization: values[2]?.trim() || '', identificationCode: values[3]?.trim() || '',
        } as Partial<DBParticipantType>);
      }
    });
    return parsed;
  };

  const parseExcelParticipants = (data: Uint8Array): Array<Partial<DBParticipantType> & { iteration?: number }> => {
    const parsed: Array<Partial<DBParticipantType> & { iteration?: number }> = [];
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
    if (jsonData.length === 0) return parsed;
    let headers: string[] = [];
    let dataStartIndex = 0;
    const potentialHeaders = jsonData[0].map(h => h.toString().toLowerCase());
    const hasPrenom = potentialHeaders.includes('prénom') || potentialHeaders.includes('prenom');
    const hasNom = potentialHeaders.includes('nom');
    if (hasPrenom && hasNom) {
      headers = potentialHeaders; dataStartIndex = 1;
    } else {
      headers = ['prénom', 'nom', 'organisation', 'code identification', 'itération']; dataStartIndex = 0;
    }
    const prenomIndex = headers.findIndex(h => h === 'prénom' || h === 'prenom');
    const nomIndex = headers.findIndex(h => h === 'nom');
    const orgIndex = headers.findIndex(h => h === 'organisation');
    const codeIndex = headers.findIndex(h => h === 'code identification' || h === 'code');
    const iterationIndex = headers.findIndex(h => h === 'itération' || h === 'iteration');
    for (let i = dataStartIndex; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (row.some(cell => cell && cell.toString().trim() !== '')) {
        const prenom = prenomIndex !== -1 ? row[prenomIndex]?.toString().trim() || '' : row[0]?.toString().trim() || '';
        const nom = nomIndex !== -1 ? row[nomIndex]?.toString().trim() || '' : row[1]?.toString().trim() || '';
        if (prenom || nom) {
            parsed.push({
            prenom, nom,
            organization: orgIndex !== -1 ? row[orgIndex]?.toString().trim() || '' : row[2]?.toString().trim() || '',
            identificationCode: codeIndex !== -1 ? row[codeIndex]?.toString().trim() || '' : row[3]?.toString().trim() || '',
            iteration: iterationIndex !== -1 ? parseInt(row[iterationIndex]?.toString().trim(), 10) : 1,
            } as Partial<DBParticipantType> & { iteration?: number });
        }
      }
    }
    return parsed;
  };

  const addImportedParticipants = (
    parsedData: Array<Partial<DBParticipantType> & { iteration?: number }>,
    fileName: string
  ) => {
    if (editingSessionData?.orsFilePath && editingSessionData.status !== 'completed') { setModifiedAfterOrsGeneration(true); }
    if (parsedData.length > 0) {
      const newFormParticipants: FormParticipant[] = parsedData.map((p, index) => ({
        nom: p.nom || '',
        prenom: p.prenom || '',
        identificationCode: p.identificationCode || '',
        score: undefined,
        reussite: undefined,
        assignedGlobalDeviceId: null,
        statusInSession: 'present',
        uiId: `imported-${Date.now()}-${index}`,
        dbId: undefined,
        firstName: p.prenom || '',
        lastName: p.nom || '',
        organization: (p as any).organization || '',
        deviceId: null,
        hasSigned: false,
      }));
      setParticipants(prev => {
        const updatedParticipants = [...prev, ...newFormParticipants];
        // Assign imported participants to iterations
        const newAssignments = { ...participantAssignments };
        newFormParticipants.forEach((p, index) => {
          const parsedInfo = parsedData[index];
          const targetIteration = parsedInfo?.iteration || 1; // Default to 1st iteration
          const iterationIndex = targetIteration - 1; // Convert to 0-based index
          if (!newAssignments[iterationIndex]) {
            newAssignments[iterationIndex] = [];
          }
          newAssignments[iterationIndex].push({ id: p.uiId, assignedGlobalDeviceId: p.assignedGlobalDeviceId || null });
        });
        setParticipantAssignments(newAssignments);
        return updatedParticipants;
      });
      setImportSummary(`${parsedData.length} participants importés de ${fileName}. Assignez les boîtiers.`);
    } else {
      setImportSummary(`Aucun participant valide trouvé dans ${fileName}.`);
    }
  };

const handleGenerateQuestionnaire = async () => {
    const sessionData = await prepareSessionDataForDb();
    if (sessionData) {
        const savedId = await handleSaveSession(sessionData);
        if (savedId) {
            handleGenerateQuestionnaireAndOrs(savedId);
        }
    }
};

  const handleParticipantFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportSummary(`Import du fichier ${file.name}...`);
    try {
      let parsedData: Array<Partial<DBParticipantType>> = [];
      if (file.name.endsWith('.csv') || file.type === 'text/csv') {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          parsedData = parseCsvParticipants(text);
          addImportedParticipants(parsedData, file.name);
        };
        reader.onerror = () => setImportSummary(`Erreur lecture fichier CSV: ${reader.error}`);
        reader.readAsText(file);
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.type === 'application/vnd.ms-excel') {
        const reader = new FileReader();
        reader.onload = (e) => {
          const data = e.target?.result as ArrayBuffer;
          const byteArray = new Uint8Array(data);
          parsedData = parseExcelParticipants(byteArray);
          addImportedParticipants(parsedData, file.name);
        };
        reader.onerror = () => setImportSummary(`Erreur lecture fichier Excel: ${reader.error}`);
        reader.readAsArrayBuffer(file);
      } else {
        setImportSummary(`Type de fichier non supporté: ${file.name}`);
      }
    } catch (error: any) {
      setImportSummary(`Erreur import: ${error.message}`);
      console.error("Erreur import participants:", error);
    } finally {
      if (event.target) { event.target.value = ''; }
    }
  };

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
      selectedBlocIds: editingSessionData?.selectedBlocIds || [],
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

    // Check for unassigned participants
    const assignedParticipantIds = new Set(Object.values(participantAssignments).flat().map((p: { id: string; assignedGlobalDeviceId: number | null }) => p.id));
    const unassignedParticipants = participants.filter(p => !assignedParticipantIds.has(p.id));

    if (unassignedParticipants.length > 0) {
        const unassignedNames = unassignedParticipants.map(p => `${p.firstName} ${p.lastName}`).join(', ');
        const warningMessage = `Attention : Le(s) participant(s) suivant(s) ne sont assignés à aucune itération et ne seront pas sauvegardés : ${unassignedNames}. Voulez-vous continuer quand même ?`;
        if (!window.confirm(warningMessage)) {
            return null; // Abort save
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
            if (typeof dbId === 'number') { // Assurez-vous que dbId est bien un nombre
                if (typeof dbId === 'number') {
                    participantDbIdMap.set(p.uiId, dbId);
                } else {
                    console.warn(`[handleSaveSession] dbId pour participant ${p.uiId} n'est pas un nombre: ${dbId}`);
                }
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

if (savedIterationId) { // <-- On ajoute cette condition
    const assignedFormParticipantIds = (participantAssignments[i] || []).map((p: {id: string}) => p.id);
    const assignmentsForDb = [];

    for (const formPId of assignedFormParticipantIds) {
        const dbPId = participantDbIdMap.get(formPId);
        const participantFormState = participants.find(p => p.uiId === formPId);
        if (dbPId && participantFormState && participantFormState.assignedGlobalDeviceId) {
            assignmentsForDb.push({
                session_iteration_id: savedIterationId, // Maintenant, c'est sûr que c'est un nombre
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

  const handleSaveDraft = async () => {
    const sessionData = await prepareSessionDataForDb(editingSessionData?.orsFilePath);
    if (sessionData) {
      const savedId = await handleSaveSession(sessionData);
      if (savedId) { setImportSummary(`Session (ID: ${savedId}) sauvegardée avec succès !`); }
    }
  };

  const handleCancelSession = async () => {
    if (window.confirm("Êtes-vous sûr de vouloir annuler cette session ? Cette action est irréversible.")) {
      if (currentSessionDbId) {
        try {
          await StorageManager.updateSession(currentSessionDbId, {
            status: 'cancelled',
            archived_at: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          setImportSummary("Session annulée et archivée.");
          // Optionnel: rediriger l'utilisateur ou rafraîchir l'état
        } catch (error) {
          console.error("Erreur lors de l'annulation de la session:", error);
          setImportSummary("Erreur lors de l'annulation de la session.");
        }
      } else {
        setImportSummary("Impossible d'annuler une session non sauvegardée.");
      }
    }
  };

  const handleGenerateQuestionnaireAndOrs = async (iterationIndex?: number) => {
    const refCodeToUse = selectedReferential || (editingSessionData?.referentielId ? referentielsData.find(r => r.id === editingSessionData.referentielId)?.code : null);
    if (!refCodeToUse) {
      setImportSummary("Veuillez sélectionner un référentiel pour générer l'ORS.");
      return;
    }
    setIsGeneratingOrs(true);
    setImportSummary("Sauvegarde de la session avant génération...");
    let sessionDataPreORS = await prepareSessionDataForDb();
    if (!sessionDataPreORS) {
      setImportSummary("Erreur lors de la préparation des données de la session.");
      setIsGeneratingOrs(false); return;
    }
    const currentSavedId = await handleSaveSession(sessionDataPreORS);
    if (!currentSavedId) {
      setImportSummary("Erreur lors de la sauvegarde de la session avant la génération.");
      setIsGeneratingOrs(false); return;
    }
    const upToDateSessionData = await StorageManager.getSessionById(currentSavedId);
    if (!upToDateSessionData) {
      setImportSummary("Erreur lors du rechargement de la session après sauvegarde.");
      setIsGeneratingOrs(false); return;
    }
    setEditingSessionData(upToDateSessionData);

    try {
      let allSelectedQuestionsForPptx: StoredQuestion[] = [];
      if (!upToDateSessionData.questionMappings || upToDateSessionData.questionMappings.length === 0) {
        const referentielObject = await StorageManager.getReferentialByCode(refCodeToUse as string);
        if (!referentielObject?.id) throw new Error(`Référentiel non trouvé: ${refCodeToUse}`);
        const themes = await StorageManager.getThemesByReferentialId(referentielObject.id);
        for (const theme of themes) {
          if (!theme.id) continue;
          const blocs = (await StorageManager.getBlocsByThemeId(theme.id)).filter(b => b.code_bloc.match(/_([A-E]|G\d+)$/i));
          if (blocs.length > 0) {
            const chosenBloc = blocs[Math.floor(Math.random() * blocs.length)];
            if (chosenBloc.id) {
              const questions = await StorageManager.getQuestionsForBloc(chosenBloc.id);
              allSelectedQuestionsForPptx.push(...questions);
            }
          }
        }
        if (allSelectedQuestionsForPptx.length === 0) throw new Error("Aucune question sélectionnée.");
      } else {
        const questionIds = upToDateSessionData.questionMappings.map((q: any) => q.dbQuestionId).filter((id: number): id is number => id != null);
        allSelectedQuestionsForPptx = await StorageManager.getQuestionsByIds(questionIds);
      }

      const iterationsToGenerate = iterationIndex !== undefined ? [iterationIndex] : Array.from({ length: iterationCount }, (_, i) => i);
      for (const i of iterationsToGenerate) {
        const iterationName = iterationNames[i];
        const assignedParticipantIds = (participantAssignments[i] || []).map((p: { id: string; assignedGlobalDeviceId: number | null }) => String(p.id));
        const participantsForIteration = participants.filter(p => assignedParticipantIds.includes(p.id));
        const participantsForGenerator = participantsForIteration.map(p => {
          const device = hardwareDevices.find(hd => hd.id === p.assignedGlobalDeviceId);
          return { idBoitier: device?.serialNumber || '', nom: p.lastName, prenom: p.firstName, identificationCode: p.identificationCode };
        });

        const templateFile = await getActivePptxTemplateFile();
        const { orsBlob, questionMappings } = await window.dbAPI?.generatePresentation(
          { name: `${sessionName} - ${iterationName}`, date: sessionDate, referential: refCodeToUse as CACESReferential },
          participantsForGenerator, allSelectedQuestionsForPptx, templateFile, {} as AdminPPTXSettings
        );

        if (orsBlob) {
          const safeSessionName = (sessionName || 'Session').replace(/ /g, '_');
          const safeIterationName = (iterationName || 'Iteration').replace(/ /g, '_');
          const fileName = `${safeSessionName}_${safeIterationName}.ors`;
          const saveResult = await window.dbAPI?.savePptxFile(orsBlob, fileName);
          if (saveResult && saveResult.success) {
            const iterToUpdate = upToDateSessionData.iterations?.find((it: any) => it.iteration_index === i) || { created_at: new Date().toISOString() };
            await StorageManager.addOrUpdateSessionIteration({
              ...iterToUpdate,
              session_id: currentSavedId,
              iteration_index: i,
              name: iterationName,
              ors_file_path: saveResult.filePath,
              status: 'ready',
              question_mappings: questionMappings,
            });
            setImportSummary(`Itération ${iterationName} générée.`);
          } else { throw new Error(`Sauvegarde échouée pour ${iterationName}: ${saveResult?.error}`); }
        }
      }
      const finalSessionData = await StorageManager.getSessionById(currentSavedId);
      setEditingSessionData(finalSessionData || null);
    } catch (error: any) {
      setImportSummary(`Erreur majeure génération: ${error.message}`);
    } finally {
      setIsGeneratingOrs(false);
    }
  };

  

  const handleImportResults = async (iterationIndex: number) => {
    if (!currentSessionDbId || !editingSessionData) {
      setImportSummary("Aucune session active.");
      return;
    }
    const iteration = editingSessionData.iterations?.find(it => it.iteration_index === iterationIndex);
    if (!iteration?.id || !iteration?.ors_file_path) {
      setImportSummary("Veuillez d'abord générer un fichier .ors pour cette itération.");
      return;
    }
    if (iteration.status === 'completed') {
      if (!window.confirm("Les résultats pour cette itération ont déjà été importés. Voulez-vous vraiment les ré-importer et écraser les données existantes ?")) {
        return;
      }
      await StorageManager.deleteResultsForIteration(iteration.id);
    }
    setImportSummary(`Lecture du fichier ORS pour l'itération ${iteration.name}...`);
    try {
      const fileData = await window.dbAPI?.openResultsFile();
      if (!fileData || fileData.canceled || !fileData.fileBuffer) {
        setImportSummary("Aucun fichier sélectionné ou lecture annulée.");
        return;
      }
      const arrayBuffer = Buffer.from(fileData.fileBuffer, 'base64');

      const zip = await JSZip.loadAsync(arrayBuffer);
      const orSessionXmlFile = zip.file("ORSession.xml");
      if (!orSessionXmlFile) { setImportSummary("Erreur: ORSession.xml introuvable dans le .zip."); return; }
      const xmlString = await orSessionXmlFile.async("string");
      setImportSummary("Parsing XML...");
      let extractedResultsFromXml: ExtractedResultFromXml[] = parseOmbeaResultsXml(xmlString);
      if (extractedResultsFromXml.length === 0) {
        setImportSummary("Aucune réponse trouvée dans le fichier XML.");
        return;
      }
      logger.info(`[Import Results] ${extractedResultsFromXml.length} réponses initialement extraites du XML.`);
      const slideGuidsToIgnore = editingSessionData.ignoredSlideGuids;
      if (slideGuidsToIgnore && slideGuidsToIgnore.length > 0) {
        const countBeforeFilteringIgnored = extractedResultsFromXml.length;
        extractedResultsFromXml = extractedResultsFromXml.filter(
          (result: ExtractedResultFromXml) => !slideGuidsToIgnore.includes(result.questionSlideGuid)
        );
        const countAfterFilteringIgnored = extractedResultsFromXml.length;
        if (countBeforeFilteringIgnored > countAfterFilteringIgnored) {
          logger.info(`[Import Results] ${countBeforeFilteringIgnored - countAfterFilteringIgnored} réponses correspondant à ${slideGuidsToIgnore.length} GUID(s) ignoré(s) ont été filtrées.`);
        }
      }
      const latestResultsMap = new Map<string, ExtractedResultFromXml>();
      for (const result of extractedResultsFromXml) {
        const key = `${result.participantDeviceID}-${result.questionSlideGuid}`;
        const existingResult = latestResultsMap.get(key);
        if (!existingResult) {
          latestResultsMap.set(key, result);
        } else {
          if (result.timestamp && existingResult.timestamp) {
            if (new Date(result.timestamp) > new Date(existingResult.timestamp)) {
              latestResultsMap.set(key, result);
            }
          } else if (result.timestamp && !existingResult.timestamp) {
            latestResultsMap.set(key, result);
          }
        }
      }
      const finalExtractedResults = Array.from(latestResultsMap.values());
      logger.info(`[Import Results] ${finalExtractedResults.length} réponses retenues après déduplication.`);
      if (finalExtractedResults.length === 0 && !(editingSessionData.ignoredSlideGuids && editingSessionData.ignoredSlideGuids.length > 0 && extractedResultsFromXml.length === 0) ) {
        setImportSummary("Aucune réponse valide à importer après filtrage et déduplication.");
        return;
      }
      if (!currentSessionDbId) {
        setImportSummary("Erreur: ID de session non défini. Impossible de continuer.");
        logger.error("[Import Results] currentSessionDbId is null, cannot proceed.");
        return;
      }
      const sessionQuestionsFromDb = await StorageManager.getSessionQuestionsBySessionId(currentSessionDbId);
      const sessionBoitiers = await StorageManager.getSessionBoitiersBySessionId(currentSessionDbId);
      if (!sessionQuestionsFromDb || sessionQuestionsFromDb.length === 0) {
        setImportSummary("Erreur: Impossible de charger les questions de référence pour cette session.");
        logger.error(`[Import Results] Impossible de charger sessionQuestions pour sessionId: ${currentSessionDbId}`);
        return;
      }
      if (!sessionBoitiers) {
           console.warn(`[Import Results] Aucune information de boîtier (sessionBoitiers) trouvée pour sessionId: ${currentSessionDbId}.`);
      }
      const relevantSessionQuestions = editingSessionData.ignoredSlideGuids
        ? sessionQuestionsFromDb.filter((sq: SessionQuestion) => !editingSessionData.ignoredSlideGuids!.includes(sq.slideGuid))
        : sessionQuestionsFromDb;
      const relevantSessionQuestionGuids = new Set(relevantSessionQuestions.map((sq: SessionQuestion) => sq.slideGuid));
      const totalRelevantQuestionsCount = relevantSessionQuestionGuids.size;
      logger.info(`[Import Results] Nombre total de questions pertinentes pour la session: ${totalRelevantQuestionsCount}`);
      for (const result of finalExtractedResults) {
        if (!relevantSessionQuestionGuids.has(result.questionSlideGuid)) {
          const errorMessage = `GUID de question importé (${result.questionSlideGuid}) n'est pas parmi les questions pertinentes de la session.`;
          setImportSummary(errorMessage);
          logger.error(`[Import Results - Anomaly] ${errorMessage}`, {
            importedGuid: result.questionSlideGuid,
            expectedGuids: Array.from(relevantSessionQuestionGuids)
          });
          return;
        }
      }
      logger.info("[Import Results] Vérification des GUID de questions terminée.");
      const detectedAnomaliesData: DetectedAnomalies = {
        expectedHavingIssues: [],
        unknownThatResponded: [],
      };
      const responsesFromExpectedDevices: ExtractedResultFromXml[] = [];
      for (const boitierAttendu of (sessionBoitiers || [])) {
        const responsesForThisExpectedDevice = finalExtractedResults.filter(
          (r: ExtractedResultFromXml) => r.participantDeviceID === boitierAttendu.serialNumber
        );
        const respondedGuidsForThisExpected = new Set(responsesForThisExpectedDevice.map((r: ExtractedResultFromXml) => r.questionSlideGuid));
        const missedGuidsForThisExpected: string[] = [];
        if (totalRelevantQuestionsCount > 0) {
          relevantSessionQuestionGuids.forEach((guid: string, _key: string, _set: Set<string>) => {
            if (!respondedGuidsForThisExpected.has(guid)) {
              missedGuidsForThisExpected.push(guid);
            }
          });
        }
        if (missedGuidsForThisExpected.length > 0 && totalRelevantQuestionsCount > 0) {
          if (!detectedAnomaliesData.expectedHavingIssues) detectedAnomaliesData.expectedHavingIssues = [];
          detectedAnomaliesData.expectedHavingIssues.push({
            serialNumber: boitierAttendu.serialNumber,
            visualId: boitierAttendu.visualId,
            participantName: boitierAttendu.participantName,
            responseInfo: {
              respondedToQuestionsGuids: Array.from(respondedGuidsForThisExpected),
              responsesProvidedByExpected: responsesForThisExpectedDevice,
              missedQuestionsGuids: missedGuidsForThisExpected,
              totalSessionQuestionsCount: totalRelevantQuestionsCount,
            },
          });
        } else if (totalRelevantQuestionsCount === 0 && responsesForThisExpectedDevice.length > 0) {
           responsesFromExpectedDevices.push(...responsesForThisExpectedDevice);
        } else {
          responsesFromExpectedDevices.push(...responsesForThisExpectedDevice);
        }
      }
      logger.info(`[Import Results] ${detectedAnomaliesData.expectedHavingIssues?.length || 0} boîtier(s) attendu(s) ont des réponses manquantes.`);
      const expectedSerialNumbers = new Set((sessionBoitiers || []).map((b: SessionBoitier) => b.serialNumber));
      const unknownSerialNumbersResponses: { [key: string]: ExtractedResultFromXml[] } = {};
      for (const result of finalExtractedResults) {
        if (!expectedSerialNumbers.has(result.participantDeviceID)) {
          if (!unknownSerialNumbersResponses[result.participantDeviceID]) {
            unknownSerialNumbersResponses[result.participantDeviceID] = [];
          }
          unknownSerialNumbersResponses[result.participantDeviceID].push(result);
        }
      }
      Object.entries(unknownSerialNumbersResponses).forEach(([serialNumber, responses]: [string, ExtractedResultFromXml[]]) => {
        if (!detectedAnomaliesData.unknownThatResponded) detectedAnomaliesData.unknownThatResponded = [];
        detectedAnomaliesData.unknownThatResponded.push({
          serialNumber: serialNumber,
          responses: responses,
        });
      });
      logger.info(`[Import Results] ${detectedAnomaliesData.unknownThatResponded?.length || 0} boîtier(s) inconnu(s) ont répondu.`);
      if ((detectedAnomaliesData.expectedHavingIssues?.length || 0) > 0 || (detectedAnomaliesData.unknownThatResponded?.length || 0) > 0) {
        setImportSummary(`Anomalies détectées: ${detectedAnomaliesData.expectedHavingIssues?.length || 0} boîtier(s) attendu(s) avec problèmes, ${detectedAnomaliesData.unknownThatResponded?.length || 0} boîtier(s) inconnu(s). Résolution nécessaire.`);
        setDetectedAnomalies(detectedAnomaliesData as DetectedAnomalies);
        setPendingValidResults(responsesFromExpectedDevices);
        setCurrentIterationForImport(iteration.id);
        setShowAnomalyResolutionUI(true);
        logger.info("[Import Results] Des anomalies de boîtiers ont été détectées. Affichage de l'interface de résolution.");
        return;
      }
      logger.info("[Import Results] Aucune anomalie de boîtier détectée. Procédure d'import direct.");
      setImportSummary(`${responsesFromExpectedDevices.length} réponses valides prêtes pour transformation et import...`);
      const currentQuestionMappings = editingSessionData.questionMappings;
      if (!currentQuestionMappings || currentQuestionMappings.length === 0) {
        setImportSummary("Erreur: Mappages de questions manquants pour la session. Impossible de lier les résultats.");
        return;
      }
      const sessionResultsToSave = transformParsedResponsesToSessionResults(
        responsesFromExpectedDevices,
        currentQuestionMappings,
        currentSessionDbId,
        iteration.id
      );
      if (sessionResultsToSave.length > 0) {
        try {
          const updatedSession = await StorageManager.importResultsForIteration(iteration.id, currentSessionDbId, sessionResultsToSave);
          if (updatedSession) {
            setEditingSessionData(updatedSession);
            setImportSummary(`${sessionResultsToSave.length} résultats importés et traités avec succès pour l'itération ${iteration.name}.`);
          } else {
            setImportSummary("Erreur lors de la finalisation de l'itération.");
          }
        } catch (error: any) {
          setImportSummary(`Erreur lors de la finalisation de l'itération: ${error.message}`);
        }
      } else {
        setImportSummary("Aucun résultat à importer.");
      }
    } catch (error: any) {
      setImportSummary(`Erreur traitement fichier: ${error.message}`);
      logger.error(`Erreur lors du traitement du fichier de résultats pour la session ID ${currentSessionDbId}`, {eventType: 'RESULTS_IMPORT_FILE_PROCESSING_ERROR', sessionId: currentSessionDbId, error});
    }
  };

  const handleResolveAnomalies = async (
    baseResultsToProcess: ExtractedResultFromXml[],
    expectedResolutions: ExpectedIssueResolution[],
    unknownResolutions: UnknownDeviceResolution[]
  ) => {
    logger.info(`[AnomalyResolution] Début du traitement des résolutions.`);
    logger.info('[AnomalyResolution] Décisions pour les attendus:', expectedResolutions);
    logger.info('[AnomalyResolution] Décisions pour les inconnus:', unknownResolutions);
    setShowAnomalyResolutionUI(false);
    if (!currentSessionDbId || !editingSessionData || !editingSessionData.questionMappings) {
      setImportSummary("Erreur critique : Données de session manquantes pour finaliser l'import après résolution.");
      logger.error("[AnomalyResolution] Données de session critiques manquantes pour finaliser l'import.");
      return;
    }
    let finalResultsToImport: ExtractedResultFromXml[] = [...baseResultsToProcess];
    let updatedParticipantsList: DBParticipantType[] = editingSessionData.iterations?.flatMap((iter: any) => (iter as any).participants || []) || [];
    let participantsDataChanged = false;
    const originalAnomalies = detectedAnomalies;
    if (!originalAnomalies) {
        setImportSummary("Erreur critique : Données d'anomalies originales non trouvées.");
        logger.error("[AnomalyResolution] Données d'anomalies originales (état detectedAnomalies) non trouvées.");
        return;
    }
    for (const resolution of expectedResolutions) {
      const expectedDeviceData = originalAnomalies.expectedHavingIssues?.find(
        (e: any) => e.serialNumber === resolution.serialNumber
      );
      if (!expectedDeviceData) continue;
      const participantIndex = updatedParticipantsList.findIndex((p: DBParticipantType) => {
        const device = hardwareDevices.find(hd => hd.id === p.assignedGlobalDeviceId);
        return device?.serialNumber === resolution.serialNumber;
      });
      if (resolution.action === 'mark_absent' || resolution.action === 'ignore_device') {
        logger.info(`[AnomalyResolution] Traitement pour ${expectedDeviceData.participantName} (SN: ${resolution.serialNumber}): Action = ${resolution.action}.`);
        if (participantIndex !== -1) {
          const currentParticipant = updatedParticipantsList[participantIndex];
          updatedParticipantsList[participantIndex] = {
            ...currentParticipant,
            statusInSession: 'absent',
            score: 0,
            reussite: false
          };
          participantsDataChanged = true;
          logger.info(`[AnomalyResolution] Participant ${expectedDeviceData.participantName} marqué comme absent. Score et réussite mis à 0.`);
        } else {
          console.warn(`[AnomalyResolution] Participant non trouvé pour ${expectedDeviceData.participantName} (SN: ${resolution.serialNumber}) lors du marquage comme absent.`);
        }
      } else if (resolution.action === 'aggregate_with_unknown') {
        if (resolution.sourceUnknownSerialNumber) {
          const unknownSourceDeviceData = originalAnomalies.unknownThatResponded?.find(
            (u: any) => u.serialNumber === resolution.sourceUnknownSerialNumber
          );
          if (unknownSourceDeviceData) {
            logger.info(`[AnomalyResolution] Agrégation pour ${expectedDeviceData.participantName} (SN: ${resolution.serialNumber}) avec inconnu SN: ${resolution.sourceUnknownSerialNumber}.`);
            const expectedResponses = expectedDeviceData.responseInfo.responsesProvidedByExpected;
            const unknownResponses = unknownSourceDeviceData.responses;
            const mergedResponsesForKey = new Map<string, ExtractedResultFromXml>();
            for (const resp of expectedResponses) {
              mergedResponsesForKey.set(resp.questionSlideGuid, {
                ...resp,
                participantDeviceID: resolution.serialNumber
              });
            }
            for (const resp of unknownResponses) {
              mergedResponsesForKey.set(resp.questionSlideGuid, {
                ...resp,
                participantDeviceID: resolution.serialNumber
              });
            }
            finalResultsToImport.push(...Array.from(mergedResponsesForKey.values()));
          } else {
            console.warn(`[AnomalyResolution] Source inconnue SN: ${resolution.sourceUnknownSerialNumber} non trouvée pour agrégation avec ${resolution.serialNumber}.`);
            finalResultsToImport.push(...expectedDeviceData.responseInfo.responsesProvidedByExpected.map((r: ExtractedResultFromXml) => ({...r, participantDeviceID: resolution.serialNumber})));
          }
        } else {
           console.warn(`[AnomalyResolution] Action 'aggregate_with_unknown' pour ${resolution.serialNumber} mais pas de sourceUnknownSerialNumber.`);
           finalResultsToImport.push(...expectedDeviceData.responseInfo.responsesProvidedByExpected.map((r: ExtractedResultFromXml) => ({...r, participantDeviceID: resolution.serialNumber})));
        }
      }
    }
    for (const resolution of unknownResolutions) {
      const isUsedAsSource = expectedResolutions.some(
        expRes => expRes.action === 'aggregate_with_unknown' && expRes.sourceUnknownSerialNumber === resolution.serialNumber
      );
      if (isUsedAsSource) {
        logger.info(`[AnomalyResolution] Inconnu SN: ${resolution.serialNumber} utilisé pour agrégation. Pas de traitement séparé.`);
        continue;
      }
      const unknownDeviceData = originalAnomalies.unknownThatResponded?.find(
        (u: any) => u.serialNumber === resolution.serialNumber
      );
      if (!unknownDeviceData) continue;
      if (resolution.action === 'add_as_new_participant') {
        logger.info(`[AnomalyResolution] Ajout nouveau participant pour inconnu SN: ${resolution.serialNumber}, nom: ${resolution.newParticipantName}.`);
        finalResultsToImport.push(...unknownDeviceData.responses);
        const newParticipantName = resolution.newParticipantName || `Participant Inconnu ${resolution.serialNumber.slice(-4)}`;
        let assignedGlobalDeviceIdForNew: number | null = null;
        const existingHardwareDevice = hardwareDevices.find(hd => hd.serialNumber === resolution.serialNumber);
        if (existingHardwareDevice) {
            assignedGlobalDeviceIdForNew = existingHardwareDevice.id!;
        } else {
            console.warn(`[AnomalyResolution] Aucun VotingDevice global pour SN ${resolution.serialNumber}. Nouveau participant sans assignedGlobalDeviceId.`);
        }
        const newParticipantEntry: DBParticipantType = {
          nom: newParticipantName.split(' ').slice(1).join(' ') || `SN-${resolution.serialNumber.slice(-4)}`,
          prenom: newParticipantName.split(' ')[0] || 'Inconnu',
          assignedGlobalDeviceId: assignedGlobalDeviceIdForNew,
          identificationCode: `NEW_${resolution.serialNumber}`,
        };
        updatedParticipantsList.push(newParticipantEntry);
        participantsDataChanged = true;
      } else if (resolution.action === 'ignore_responses') {
        logger.info(`[AnomalyResolution] Réponses de l'inconnu SN: ${resolution.serialNumber} ignorées.`);
      }
    }
    const uniqueResultsMap = new Map<string, ExtractedResultFromXml>();
    for (const result of finalResultsToImport) {
        const key = `${result.participantDeviceID}-${result.questionSlideGuid}`;
        uniqueResultsMap.set(key, result);
    }
    finalResultsToImport = Array.from(uniqueResultsMap.values());
    logger.info(`[AnomalyResolution] ${finalResultsToImport.length} résultats finaux à importer après résolution.`);
    if (participantsDataChanged) {
        try {
            await StorageManager.updateSession(currentSessionDbId, { participants: updatedParticipantsList, updatedAt: new Date().toISOString() });
            const reloadedSessionForUI = await StorageManager.getSessionById(currentSessionDbId);
            if (reloadedSessionForUI && reloadedSessionForUI.iterations) {
                setEditingSessionData(reloadedSessionForUI);
                const allParticipantsFromIterations = reloadedSessionForUI.iterations.flatMap((iter: any) => (iter as any).participants || []);
                const uniqueParticipants: DBParticipantType[] = Array.from(new Map(allParticipantsFromIterations.map((p: DBParticipantType) => [p.identificationCode, p])).values());
                const formParticipantsToUpdate: FormParticipant[] = uniqueParticipants.map((p_db_updated: DBParticipantType, index: number) => {
                    const visualDeviceId = index + 1;
                    const currentFormParticipantState = participants[index];
                    return {
                      nom: p_db_updated.nom,
                      prenom: p_db_updated.prenom,
                      identificationCode: p_db_updated.identificationCode,
                      score: p_db_updated.score,
                      reussite: p_db_updated.reussite,
                      assignedGlobalDeviceId: p_db_updated.assignedGlobalDeviceId,
                      statusInSession: p_db_updated.statusInSession,
                      uiId: currentFormParticipantState?.uiId || `updated-${index}-${Date.now()}`,
                      dbId: p_db_updated.id,
                      firstName: p_db_updated.prenom,
                      lastName: p_db_updated.nom,
                      deviceId: currentFormParticipantState?.deviceId ?? visualDeviceId,
                      organization: currentFormParticipantState?.organization || '',
                      hasSigned: currentFormParticipantState?.hasSigned || false,
                    };
                });
                setParticipants(formParticipantsToUpdate);
            }
            logger.info(`[AnomalyResolution] Liste des participants mise à jour dans la session ${currentSessionDbId}.`);
        } catch (error: any) {
            logger.error(`[AnomalyResolution] Erreur lors de la mise à jour des participants pour la session ${currentSessionDbId}.`, error);
            setImportSummary("Erreur lors de la mise à jour des participants après résolution. L'import est stoppé.");
            return;
        }
    }
    try {
      if (!currentIterationForImport) {
        setImportSummary("Erreur critique: ID d'itération manquant pour la résolution des anomalies.");
        logger.error("[AnomalyResolution] currentIterationForImport is null, cannot proceed.");
        return;
      }
      const sessionQuestionMaps = editingSessionData.questionMappings;
      if (!sessionQuestionMaps || sessionQuestionMaps.length === 0) {
          setImportSummary("Erreur: Mappages de questions (questionMappings) manquants pour la session. Impossible de lier les résultats.");
          return;
      }
      const sessionResultsToSave = transformParsedResponsesToSessionResults(
        finalResultsToImport,
        sessionQuestionMaps,
        currentSessionDbId,
        currentIterationForImport
      );
      if (sessionResultsToSave.length > 0) {
        const updatedSession = await StorageManager.importResultsForIteration(currentIterationForImport, currentSessionDbId, sessionResultsToSave);
        let message = `${sessionResultsToSave.length} résultats (après résolution) sauvegardés !`;

        if (updatedSession) {
            setEditingSessionData(updatedSession);
            const finalSessionDataForScores = updatedSession;
            if (finalSessionDataForScores && finalSessionDataForScores.questionMappings && finalSessionDataForScores.iterations) {
              const questionDbIds = finalSessionDataForScores.questionMappings.map((qm: any) => qm.dbQuestionId).filter((id: number | null) => id != null) as number[];
              const questionsForScoreCalc = await StorageManager.getQuestionsByIds(questionDbIds);
              const allResultsForScoreCalc = await StorageManager.getResultsForSession(currentSessionDbId);
              if (questionsForScoreCalc.length > 0 && allResultsForScoreCalc.length > 0) {
                  const anomaliesAuditData = {
                    expectedIssues: expectedResolutions,
                    unknownDevices: unknownResolutions,
                    resolvedAt: new Date().toISOString(),
                  };
                  // This needs to be refactored to update participants in their respective iterations
                  // For now, just updating the session status
                  await StorageManager.updateSession(currentSessionDbId, {
                    // status: 'completed', // Status is now handled by checkAndFinalizeSessionStatus
                    resolvedImportAnomalies: anomaliesAuditData,
                    updatedAt: new Date().toISOString()
                  });
                  message += "\nAnomalies auditées.";
                  logger.info(`[AnomalyResolution] Anomalies résolues et auditées pour session ID ${currentSessionDbId}`, {
                    eventType: 'ANOMALIES_RESOLVED_AUDITED',
                    sessionId: currentSessionDbId,
                    sessionName: finalSessionDataForScores?.nomSession || editingSessionData.nomSession,
                    resolutions: anomaliesAuditData
                  });
                  const finalUpdatedSessionWithScores = await StorageManager.getSessionById(currentSessionDbId);
                       if (finalUpdatedSessionWithScores && finalUpdatedSessionWithScores.iterations) {
                      setEditingSessionData(finalUpdatedSessionWithScores);
                          const allParticipantsFromIterations = finalUpdatedSessionWithScores.iterations.flatMap((iter: any) => (iter as any).participants || []);
                          const uniqueParticipants: DBParticipantType[] = Array.from(new Map(allParticipantsFromIterations.map((p: DBParticipantType) => [p.identificationCode, p])).values());
                                                    const formParticipantsToUpdate: FormParticipant[] = uniqueParticipants.map((p_db_updated: DBParticipantType, index: number) => {
                          const visualDeviceId = index + 1;
                          const currentFormParticipantState = participants[index];
                          return {
                            nom: p_db_updated.nom,
                            prenom: p_db_updated.prenom,
                            identificationCode: p_db_updated.identificationCode,
                            score: p_db_updated.score,
                            reussite: p_db_updated.reussite,
                            assignedGlobalDeviceId: p_db_updated.assignedGlobalDeviceId,
                            statusInSession: p_db_updated.statusInSession,
                            uiId: currentFormParticipantState?.uiId || `final-updated-${index}-${Date.now()}`,
                            dbId: p_db_updated.id,
                            firstName: p_db_updated.prenom,
                            lastName: p_db_updated.nom,
                            deviceId: currentFormParticipantState?.deviceId ?? visualDeviceId,
                            organization: currentFormParticipantState?.organization || '',
                            hasSigned: currentFormParticipantState?.hasSigned || false,
                          };
                      });
                      setParticipants(formParticipantsToUpdate);
                  }
              } else { message += "\nImpossible de charger données pour scores."; }
          } else { message += "\nImpossible de calculer les scores (données de session manquantes)."; }
        }
        setImportSummary(message);
        logger.info(`Résultats importés et résolus pour session ID ${currentSessionDbId}.`);
      } else {
        setImportSummary("Aucun résultat à sauvegarder après résolution.");
      }
    } catch (error: any) {
        setImportSummary(`Erreur finalisation import après résolution: ${error.message}`);
        logger.error(`Erreur finalisation import après résolution pour session ID ${currentSessionDbId}`, { error });
    }
    setDetectedAnomalies(null);
  };

  const handleCancelAnomalyResolution = () => {
    setShowAnomalyResolutionUI(false);
    setDetectedAnomalies(null);
    setPendingValidResults([]);
    setImportSummary("Importation des résultats annulée par l'utilisateur en raison d'anomalies.");
  };

  const renderTabNavigation = () => {
    const tabLabels: Record<TabKey, string> = {
        details: 'Détails Session',
        participants: 'Participants',
        generateQuestionnaire: 'Générer le questionnaire',
        importResults: 'Importer les résultats',
    };

    return (
        <div className="mb-6">
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-4 sm:space-x-8" aria-label="Tabs">
                    {(['details', 'participants', 'generateQuestionnaire', 'importResults'] as TabKey[]).map((tabKey) => (
                        <button
                            key={tabKey}
                            onClick={() => setActiveTab(tabKey)}
                            className={`
                                ${activeTab === tabKey ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                                whitespace-nowrap py-3 px-2 sm:py-4 sm:px-3 border-b-2 font-medium text-sm
                            `}
                            aria-current={activeTab === tabKey ? 'page' : undefined}
                        >
                            {tabLabels[tabKey]}
                        </button>
                    ))}
                </nav>
            </div>

        </div>
    );
};

  const renderTabContent = () => {
    const isReadOnly = editingSessionData?.status === 'completed';

    switch (activeTab) {
      case 'details':
        return (
          <SessionDetailsForm
            isReadOnly={isReadOnly}
            sessionName={sessionName}
            setSessionName={setSessionName}
            sessionDate={sessionDate}
            setSessionDate={setSessionDate}
            referentielsData={referentielsData}
            selectedReferential={selectedReferential}
            setSelectedReferential={setSelectedReferential}
            setSelectedReferentialId={setSelectedReferentialId}
            editingSessionData={editingSessionData}
            trainersList={trainersList}
            selectedTrainerId={selectedTrainerId}
            setSelectedTrainerId={setSelectedTrainerId}
            numSession={numSession}
            setNumSession={setNumSession}
            numStage={numStage}
            setNumStage={setNumStage}
            iterationCount={iterationCount}
            setIterationCount={setIterationCount}
            setIterationNames={setIterationNames}
            setParticipantAssignments={setParticipantAssignments}
            location={location}
            setLocation={setLocation}
            notes={notes}
            setNotes={setNotes}
            displayedBlockDetails={displayedBlockDetails}
          />
        );
      case 'participants':
        return (
          <ParticipantManager
            isReadOnly={isReadOnly}
            participants={participants}
            setParticipants={setParticipants as React.Dispatch<React.SetStateAction<FormParticipant[]>>}
            handleParticipantChange={handleParticipantChange}
            handleRemoveParticipant={handleRemoveParticipant}
            handleAddParticipant={handleAddParticipant}
            handleParticipantFileSelect={handleParticipantFileSelect}
            iterationCount={iterationCount}
            iterationNames={iterationNames}
            participantAssignments={participantAssignments}
            handleParticipantIterationChange={handleParticipantIterationChange}
            deviceKitsList={deviceKitsList}
            selectedKitIdState={selectedKitIdState}
            setSelectedKitIdState={setSelectedKitIdState}
            votingDevicesInSelectedKit={votingDevicesInSelectedKit}
            isLoadingKits={isLoadingKits}
          />
        );
      case 'generateQuestionnaire':
        return (
          <QuestionnaireGenerator
            isReadOnly={isReadOnly}
            isGeneratingOrs={isGeneratingOrs}
            handleGenerateQuestionnaire={handleGenerateQuestionnaire}
            editingSessionData={editingSessionData}
            modifiedAfterOrsGeneration={modifiedAfterOrsGeneration}
            importSummary={importSummary}
            activeTab={activeTab}
            currentSessionDbId={currentSessionDbId}
            selectedReferential={selectedReferential}
          />
        );
      case 'importResults':
        return (
          <ResultsImporter
            isReadOnly={isReadOnly}
            editingSessionData={editingSessionData}
            handleImportResults={handleImportResults}
            importSummary={importSummary}
            activeTab={activeTab}
            currentSessionDbId={currentSessionDbId}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div>
        {renderTabNavigation()}
        {renderTabContent()}
      <div className="flex justify-between items-center mt-8 py-4 border-t border-gray-200">
        <div>
          <Button variant="outline" icon={<Save size={16} />} onClick={handleSaveDraft} disabled={editingSessionData?.status === 'completed' || isGeneratingOrs}>
            Enregistrer Brouillon
          </Button>
        </div>
        <Button variant="danger" icon={<Trash2 size={16} />} onClick={handleCancelSession} disabled={editingSessionData?.status === 'completed' || editingSessionData?.status === 'cancelled'}>
          Annuler la Session
        </Button>
      </div>
      {showAnomalyResolutionUI && detectedAnomalies && (
        <AnomalyResolutionModal
          isOpen={showAnomalyResolutionUI}
          detectedAnomalies={detectedAnomalies}
          pendingValidResults={pendingValidResults}
          onResolve={handleResolveAnomalies}
          onCancel={handleCancelAnomalyResolution}
        />
      )}
    </div>
  );
};

export default SessionForm;
