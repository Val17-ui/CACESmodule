import React, { useState, useEffect, useCallback } from 'react';
import Button from '../ui/Button';
import { Save, Trash2 } from 'lucide-react';
import {
  CACESReferential,
  Session as DBSession,
  Participant as DBParticipantType,
  Trainer,
  Referential,
  Theme,
  Bloc,
  QuestionWithId as StoredQuestion,
  VotingDevice,
  DeviceKit,
  FormParticipant,
  SessionIteration
} from '@common/types';
import { StorageManager } from '../../services/StorageManager';
import { parseOmbeaResultsXml, ExtractedResultFromXml, transformParsedResponsesToSessionResults } from '../../utils/resultsParser';
import { getActivePptxTemplateFile } from '../../utils/templateManager';
import { logger } from '../../utils/logger';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import AnomalyResolutionModal, { DetectedAnomalies } from './AnomalyResolutionModal';
import { ExpectedIssueResolution, UnknownDeviceResolution } from '@common/types';
import { parseFullSessionExcel } from '../../utils/excelProcessor';

// Centralized state for the form
export type SessionFormData = {
  sessionName: string;
  sessionDate: string;
  numSession: string;
  numStage: string;
  selectedReferential: CACESReferential | '';
  selectedReferentialId: number | null;
  location: string;
  notes: string;
  selectedTrainerId: number | null | undefined;
  selectedKitIdState: number | null;
  iterationCount: number;
  iterationNames: string[];
};

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

interface SessionFormProps {
  sessionIdToLoad?: number;
  sessionToImport?: File | null;
}

type TabKey = 'details' | 'participants' | 'generateQuestionnaire' | 'importResults' | 'report';

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
import ReportDetails from '../reports/ReportDetails';

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

  const [formData, setFormData] = useState<SessionFormData>({
    sessionName: '',
    sessionDate: '',
    numSession: '',
    numStage: '',
    selectedReferential: '',
    selectedReferentialId: null,
    location: '',
    notes: '',
    selectedTrainerId: null,
    selectedKitIdState: null,
    iterationCount: 1,
    iterationNames: ['Session_1'],
  });

  const handleDataChange = <T extends keyof SessionFormData>(field: T, value: SessionFormData[T]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const [participants, setParticipants] = useState<FormParticipant[]>([]);
  const [selectedBlocIds, setSelectedBlocIds] = useState<number[]>([]);
  const [displayedBlockDetails, setDisplayedBlockDetails] = useState<Array<{ themeName: string, blocName: string }>>([]);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [editingSessionData, setEditingSessionData] = useState<DBSession | null>(null);
  const [hardwareDevices, setHardwareDevices] = useState<VotingDevice[]>([]);
  const [hardwareLoaded, setHardwareLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('details');
  const [isGeneratingOrs, setIsGeneratingOrs] = useState(false);
  const [isFirstGenerationDone, setIsFirstGenerationDone] = useState(false);
  const [iterationHasResults, setIterationHasResults] = useState<Record<number, boolean>>({});
  const [modifiedAfterOrsGeneration, setModifiedAfterOrsGeneration] = useState(false);
  const [trainersList, setTrainersList] = useState<Trainer[]>([]);
  const [referentielsData, setReferentielsData] = useState<Referential[]>([]);
  const [allThemesData, setAllThemesData] = useState<Theme[]>([]);
  const [allBlocsData, setAllBlocsData] = useState<Bloc[]>([]);
  const [deviceKitsList, setDeviceKitsList] = useState<DeviceKit[]>([]);
  const [isLoadingKits, setIsLoadingKits] = useState(true);
  const [votingDevicesInSelectedKit, setVotingDevicesInSelectedKit] = useState<VotingDevice[]>([]);
  const [detectedAnomalies, setDetectedAnomalies] = useState<DetectedAnomalies | null>(null);
  const [pendingValidResults, setPendingValidResults] = useState<ExtractedResultFromXml[]>([]);
  const [showAnomalyResolutionUI, setShowAnomalyResolutionUI] = useState<boolean>(false);
  const [currentIterationForImport, setCurrentIterationForImport] = useState<number | null>(null);
  const [participantAssignments, setParticipantAssignments] = useState<Record<number, { id: string; assignedGlobalDeviceId: number | null }[]>>({});
  const [isImporting, setIsImporting] = useState(false);
  const [importCompleted, setImportCompleted] = useState(false);

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
            const defaultTrainer = trainers.find((t: Trainer) => t.isDefault === 1) || (trainers.length > 0 ? trainers[0] : null);
            const defaultKit = defaultKitResult || (kits.length > 0 ? kits[0] : null);

            setFormData(prev => ({
                ...prev,
                selectedTrainerId: defaultTrainer?.id || null,
                selectedKitIdState: defaultKit?.id || null,
            }));
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
      if (formData.selectedKitIdState !== null) {
        try {
          const devices = await StorageManager.getVotingDevicesForKit(formData.selectedKitIdState);
          setVotingDevicesInSelectedKit(devices);
        } catch (error) {
          console.error(`Erreur lors du chargement des boîtiers pour le kit ${formData.selectedKitIdState}:`, error);
          setVotingDevicesInSelectedKit([]);
        }
      } else {
        setVotingDevicesInSelectedKit([]);
      }
    };
    fetchDevicesInKit();
  }, [formData.selectedKitIdState]);

  const resetFormTactic = useCallback(() => {
    setCurrentSessionDbId(null);
    setFormData({
        sessionName: '',
        sessionDate: '',
        numSession: '',
        numStage: '',
        selectedReferential: '',
        selectedReferentialId: null,
        location: '',
        notes: '',
        selectedTrainerId: formData.selectedTrainerId, // Keep default
        selectedKitIdState: formData.selectedKitIdState, // Keep default
        iterationCount: 1,
        iterationNames: ['Session_1'],
    });
    setParticipants([]);
    setSelectedBlocIds([]);
    setDisplayedBlockDetails([]);
    setImportSummary(null);
    setEditingSessionData(null);
    setActiveTab('details');
    setModifiedAfterOrsGeneration(false);
  }, [formData.selectedTrainerId, formData.selectedKitIdState]);

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

            let refCode: CACESReferential | '' = '';
            let refId: number | null = null;
            if (sessionData.referentielId) {
              const refObj = referentielsData.find(r => r.id === sessionData.referentielId);
              if (refObj) {
                refCode = refObj.code as CACESReferential;
                refId = refObj.id!;
              } else {
                console.warn(`Référentiel avec ID ${sessionData.referentielId} non trouvé dans referentielsData.`);
              }
            } else {
              const oldRefCode = (sessionData as any).referentiel as CACESReferential | '';
              const refObj = referentielsData.find(r => r.code === oldRefCode);
              refCode = oldRefCode;
              refId = refObj?.id || null;
            }

            const count = sessionData.iteration_count || 1;
            let names = sessionData.iterations?.map((iter: { name: any; }, index: number) => iter.name || `Session_${index + 1}`) || [];
            if (names.length < count) {
                const additionalNames = Array.from({ length: count - names.length }, (_, i) => `Session_${names.length + i + 1}`);
                names = [...names, ...additionalNames];
            }
            if (names.length > count) {
                names = names.slice(0, count);
            }

            setFormData({
                sessionName: sessionData.nomSession,
                sessionDate: sessionData.dateSession ? sessionData.dateSession.split('T')[0] : '',
                numSession: sessionData.num_session || '',
                numStage: sessionData.num_stage || '',
                selectedReferential: refCode,
                selectedReferentialId: refId,
                location: sessionData.location || '',
                notes: sessionData.notes || '',
                selectedTrainerId: sessionData.trainerId || null,
                selectedKitIdState: sessionData.selectedKitId || null,
                iterationCount: count,
                iterationNames: names.length > 0 ? names : ['Session_1'],
            });

            setSelectedBlocIds(sessionData.selectedBlocIds || []);

            if (sessionData.orsFilePath) {
              setIsFirstGenerationDone(true);
            }

            if (sessionData.iterations) {
                const hasResultsMap: Record<number, boolean> = {};
                for (const iter of sessionData.iterations) {
                  if (iter.id) {
                    const hasResults = await window.dbAPI?.hasResultsForIteration(iter.id);
                    hasResultsMap[iter.iteration_index] = !!hasResults;
                  }
                }
                setIterationHasResults(hasResultsMap);
            }

            setModifiedAfterOrsGeneration(false);
            if (sessionData.iterations && sessionData.iterations.length > 0) {
                console.log('[SessionLoad-LOG] Step 1: Raw sessionData.iterations received from DB:', JSON.parse(JSON.stringify(sessionData.iterations)));
                const allParticipantsFromIterations = (sessionData.iterations.flatMap((iter: any) => (iter as any).participants || [])) as DBParticipantType[];
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
                            const matchingFormParticipant = formParticipants.find(fp => fp.id === p_iter.id);
                            if (matchingFormParticipant) {
                                return {
                                    id: matchingFormParticipant.uiId,
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
    } else if (!sessionIdToLoad && !isImporting && !importCompleted && referentielsData.length > 0) {
      resetFormTactic();
    }
  }, [sessionIdToLoad, isImporting, importCompleted, hardwareLoaded, referentielsData, resetFormTactic]);

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
    if (formData.iterationCount === 1) {
        const allParticipantIds = participants.map(p => ({ id: p.uiId, assignedGlobalDeviceId: p.assignedGlobalDeviceId || null }));
        // Only update the state if it's different to avoid an infinite loop.
        if (JSON.stringify(participantAssignments[0] || []) !== JSON.stringify(allParticipantIds)) {
            setParticipantAssignments({ 0: allParticipantIds });
        }
    }
  }, [participants, formData.iterationCount, participantAssignments]);

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
                console.log('[SessionForm Import] Received data from parseFullSessionExcel. Details:', JSON.stringify(details, null, 2));
                console.log('[SessionForm Import] Received data from parseFullSessionExcel. Participants:', JSON.stringify(parsedParticipants, null, 2));

                // Populate session details
                const ref = details.referentielCode ? referentielsData.find(r => r.code === details.referentielCode) : null;
                const trainer = details.trainerName ? trainersList.find(t => t.name === details.trainerName) : null;
                const kit = details.kitName ? deviceKitsList.find(k => k.name === details.kitName) : null;
                const iterationCount = parseInt(details.iterationCount?.toString() || '1', 10);
                const iterationNames = details.iterationNames ? details.iterationNames.toString().split(',').map((name: string) => name.trim()) : Array.from({ length: iterationCount }, (_, i) => `Session_${i + 1}`);

                // Iterations
                setFormData(prev => ({
                    ...prev,
                    sessionName: details.nomSession?.toString() || '',
                    sessionDate: details.dateSession ? parseFrenchDate(details.dateSession.toString()) : '',
                    numSession: details.numSession?.toString() || '',
                    numStage: details.numStage?.toString() || '',
                    location: details.location?.toString() || '',
                    notes: details.notes?.toString() || '',
                    selectedReferential: ref ? ref.code as CACESReferential : '',
                    selectedReferentialId: ref ? ref.id! : null,
                    selectedTrainerId: trainer ? trainer.id! : null,
                    selectedKitIdState: kit ? kit.id! : null,
                    iterationCount: iterationCount,
                    iterationNames: iterationNames,
                }));

                // Populate participants
                const newFormParticipants: FormParticipant[] = parsedParticipants.map((p, index) => {
                    const device = hardwareDevices.find(d => d.name === p.deviceName);
                    return {
                        uiId: `imported-${Date.now()}-${index}`,
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
                setImportCompleted(true);
            }
        };
        processImport();
    }
}, [sessionToImport, referentielsData, trainersList, deviceKitsList, hardwareDevices]); // Dependencies are important!

  

  const handleAddParticipant = () => {
    if (editingSessionData?.orsFilePath && editingSessionData.status !== 'completed') { setModifiedAfterOrsGeneration(true); }
    if (!formData.selectedKitIdState) {
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
    const potentialHeaders = jsonData[0].map((h: any) => h.toString().toLowerCase());
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
    const validationErrors = validateSessionDataForGeneration();
    if (validationErrors.length > 0) {
      setImportSummary(`Erreur de validation :\n- ${validationErrors.join('\n- ')}`);
      setActiveTab('participants');
      return;
    }

    const sessionData = await prepareSessionDataForDb();
    if (sessionData) {
        const savedId = await handleSaveSession(sessionData);
        if (savedId) {
            handleGenerateQuestionnaireAndOrs();
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
    let currentReferentielId: number | undefined = formData.selectedReferentialId;
    if (!currentReferentielId && formData.selectedReferential) {
        const refObj = referentielsData.find(r => r.code === formData.selectedReferential);
        if (refObj) currentReferentielId = refObj.id;
    } else if (editingSessionData?.referentielId) {
        currentReferentielId = editingSessionData.referentielId;
    }
    const sessionToSave: Omit<DBSession, 'participants'> = {
      id: currentSessionDbId || undefined,
      iteration_count: formData.iterationCount,
      nomSession: formData.sessionName || `Session du ${new Date().toLocaleDateString()}`,
      dateSession: formData.sessionDate || new Date().toISOString().split('T')[0],
      num_session: formData.numSession,
      num_stage: formData.numStage,
      referentielId: currentReferentielId,
      selectedBlocIds: selectedBlocIds,
      selectedKitId: formData.selectedKitIdState,
      orsFilePath: includeOrsBlob !== undefined ? includeOrsBlob : editingSessionData?.orsFilePath,
      status: editingSessionData?.status || 'planned',
      location: formData.location,
      questionMappings: editingSessionData?.questionMappings,
      notes: formData.notes,
      trainerId: formData.selectedTrainerId ?? undefined,
      createdAt: editingSessionData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ignoredSlideGuids: editingSessionData?.ignoredSlideGuids,
      resolvedImportAnomalies: editingSessionData?.resolvedImportAnomalies,
      resultsImportedAt: null,
    };
    return sessionToSave as DBSession;
  };

  const validateSessionDataForGeneration = (iterationIndex?: number): string[] => {
    const errors: string[] = [];
    const iterationsToValidate = iterationIndex !== undefined ? [iterationIndex] : Array.from({ length: formData.iterationCount }, (_, i) => i);

    const allAssignedParticipantUiIds = new Set(Object.values(participantAssignments).flat().map(p => p.id));

    for (const p of participants) {
      if (!allAssignedParticipantUiIds.has(p.uiId)) {
        errors.push(`Le participant ${p.firstName} ${p.lastName} n'est lié à aucune itération.`);
      }
      if (!p.firstName || !p.lastName) {
        errors.push(`Le nom ou le prénom d'un participant est manquant.`);
      }
    }

    for (const i of iterationsToValidate) {
      const iterationName = formData.iterationNames[i] || `Itération ${i + 1}`;
      const assignedParticipants = (participantAssignments[i] || []).map(assignment => {
        return participants.find(p => p.uiId === assignment.id);
      }).filter((p): p is FormParticipant => p !== undefined);

      if (assignedParticipants.length === 0) {
        errors.push(`L'itération '${iterationName}' n'a aucun participant assigné.`);
        continue;
      }

      const deviceIdMap = new Map<number, FormParticipant[]>();
      for (const p of assignedParticipants) {
        if (!p.assignedGlobalDeviceId) {
          errors.push(`Veuillez assigner un boîtier à ${p.firstName} ${p.lastName} dans l'itération '${iterationName}'.`);
        } else {
          if (!deviceIdMap.has(p.assignedGlobalDeviceId)) {
            deviceIdMap.set(p.assignedGlobalDeviceId, []);
          }
          deviceIdMap.get(p.assignedGlobalDeviceId)!.push(p);
        }
      }

      for (const [deviceId, assigned] of deviceIdMap.entries()) {
        if (assigned.length > 1) {
          const names = assigned.map(p => `${p.firstName} ${p.lastName}`).join(' et ');
          const deviceName = hardwareDevices.find(d => d.id === deviceId)?.name || `ID: ${deviceId}`;
          errors.push(`Dans l'itération '${iterationName}', le boîtier ${deviceName} est assigné à plusieurs participants : ${names}.`);
        }
      }
    }

    return errors;
  };

const handleSaveSession = async (sessionDataToSave: DBSession | null) => {
    console.log('[SessionSave] Starting save process...');
    if (!sessionDataToSave) return null;

    // Check for unassigned participants
    const assignedParticipantIds = new Set(
      Object.values(participantAssignments)
        .flat()
        .map((p: { id: string; assignedGlobalDeviceId: number | null }) => p.id)
    );
    const unassignedParticipants = participants.filter((p: FormParticipant) => !assignedParticipantIds.has(p.uiId));

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
            for (let i = 0; i < formData.iterationCount; i++) {
                const existingIteration = editingSessionData?.iterations?.find(iter => iter.iteration_index === i);

                const iterationToSave: any = {
                    id: existingIteration?.id,
                    session_id: savedSessionId,
                    iteration_index: i,
                    name: formData.iterationNames[i] || `Session_${i + 1}`,
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
                kit_id: formData.selectedKitIdState || 0,
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

  const handleRegenerateIteration = async (iterationIndex: number) => {
    const validationErrors = validateSessionDataForGeneration(iterationIndex);
    if (validationErrors.length > 0) {
      setImportSummary(`Erreur de validation :\n- ${validationErrors.join('\n- ')}`);
      setActiveTab('participants');
      return;
    }

    if (window.confirm("Êtes-vous certain de vouloir régénérer ce questionnaire ? Si celui-ci contient des votes, ceux-ci seront perdus.")) {
      await handleGenerateQuestionnaireAndOrs(iterationIndex);
    }
  };

  const handleGenerateQuestionnaireAndOrs = async (iterationIndex?: number) => {
    const refCodeToUse = formData.selectedReferential || (editingSessionData?.referentielId ? referentielsData.find(r => r.id === editingSessionData.referentielId)?.code : null);
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
    let upToDateSessionData = await StorageManager.getSessionById(currentSavedId);
    if (!upToDateSessionData) {
      setImportSummary("Erreur lors du rechargement de la session après sauvegarde.");
      setIsGeneratingOrs(false); return;
    }
    setEditingSessionData(upToDateSessionData);

    try {
      let allSelectedQuestionsForPptx: StoredQuestion[] = [];
      const newlySelectedBlocIds: number[] = [];
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
              newlySelectedBlocIds.push(chosenBloc.id);
              const questions = await StorageManager.getQuestionsForBloc(chosenBloc.id);
              allSelectedQuestionsForPptx.push(...questions);
            }
          }
        }
        if (newlySelectedBlocIds.length > 0) {
          setSelectedBlocIds(newlySelectedBlocIds);
          await StorageManager.updateSession(currentSavedId, { selectedBlocIds: newlySelectedBlocIds });
          const reloadedSessionWithBlocks = await StorageManager.getSessionById(currentSavedId);
          if (!reloadedSessionWithBlocks) {
            throw new Error("Impossible de recharger la session après la sauvegarde des blocs.");
          }
          upToDateSessionData = reloadedSessionWithBlocks;
          setEditingSessionData(reloadedSessionWithBlocks);
        }
        if (allSelectedQuestionsForPptx.length === 0) throw new Error("Aucune question sélectionnée.");
      } else {
        const questionIds = upToDateSessionData.questionMappings.map((q: any) => q.dbQuestionId).filter((id: number): id is number => id != null);
        allSelectedQuestionsForPptx = await StorageManager.getQuestionsByIds(questionIds);
      }

      const iterationsToGenerate = iterationIndex !== undefined ? [iterationIndex] : Array.from({ length: formData.iterationCount }, (_, i) => i);
      for (const i of iterationsToGenerate) {
        const iterationName = formData.iterationNames[i];
        const assignedParticipantIds = (participantAssignments[i] || []).map((p: { id: string; assignedGlobalDeviceId: number | null }) => String(p.id));
        const participantsForIteration = participants.filter(p => assignedParticipantIds.includes(p.uiId));
        const participantsForGenerator = participantsForIteration.map(p => {
          const device = hardwareDevices.find(hd => hd.id === p.assignedGlobalDeviceId);
          return { idBoitier: device?.serialNumber || '', nom: p.lastName, prenom: p.firstName, identificationCode: p.identificationCode };
        });
        const templateFile = await getActivePptxTemplateFile();
        const { orsBlob, questionMappings } = await window.dbAPI?.generatePresentation(
          { name: `${formData.sessionName} - ${iterationName}`, date: formData.sessionDate, referential: refCodeToUse as CACESReferential },
          participantsForGenerator, allSelectedQuestionsForPptx, templateFile, {} as AdminPPTXSettings
        );

        if (orsBlob) {
          // Enregistrer les mappings sur la session principale UNE SEULE FOIS
          if (i === 0 && (!upToDateSessionData.questionMappings || upToDateSessionData.questionMappings.length === 0)) {
            await StorageManager.updateSession(currentSavedId, { questionMappings: questionMappings });
          }

          const safeSessionName = (formData.sessionName || 'Session').replace(/ /g, '_');
          const safeIterationName = (iterationName || 'Iteration').replace(/ /g, '_');
          const fileName = `${safeSessionName}_${safeIterationName}.ors`;
          const saveResult = await window.dbAPI?.savePptxFile(orsBlob, fileName);
          if (saveResult && saveResult.success) {
            const iterToUpdateRaw = upToDateSessionData.iterations?.find((it: any) => it.iteration_index === i);
            const { participants, ...iterToUpdate } = iterToUpdateRaw || { created_at: new Date().toISOString() };

            await StorageManager.addOrUpdateSessionIteration({
              ...iterToUpdate,
              session_id: currentSavedId,
              iteration_index: i,
              name: iterationName,
              ors_file_path: saveResult.filePath,
              status: 'ready',
              question_mappings: questionMappings, // Garder aussi sur l'itération pour référence
            });
            setImportSummary(`Itération ${iterationName} générée.`);
             // Update the main session as well to reflect that a file exists
            await StorageManager.updateSession(currentSavedId, { orsFilePath: saveResult.filePath });
          } else { throw new Error(`Sauvegarde échouée pour ${iterationName}: ${saveResult?.error}`); }
        }
      }
      const finalSessionData = await StorageManager.getSessionById(currentSavedId);
      setEditingSessionData(finalSessionData || null);
      if (iterationIndex === undefined) {
        setIsFirstGenerationDone(true);
      }
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
    if (!iteration?.id || !iteration.ors_file_path) {
      setImportSummary("Veuillez d'abord générer un fichier .ors pour cette itération.");
      return;
    }

    const currentQuestionMappings = iteration.question_mappings;
    if (!currentQuestionMappings || currentQuestionMappings.length === 0) {
      setImportSummary("Erreur: Mappages de questions manquants pour cette itération. Impossible de lier les résultats.");
      logger.error(`[Import Results] No question mappings found for iteration ${iteration.id}`);
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
      const fileData = await window.electronAPI?.readFileBuffer(iteration.ors_file_path);
      if (!fileData || !fileData.fileBuffer) {
        setImportSummary(`Lecture du fichier ORS échouée: ${fileData?.error || 'Buffer vide.'}`);
        return;
      }

      const arrayBuffer = base64ToArrayBuffer(fileData.fileBuffer);
      const zip = await JSZip.loadAsync(arrayBuffer);
      const orSessionXmlFile = zip.file("ORSession.xml");
      if (!orSessionXmlFile) {
        setImportSummary("Erreur: ORSession.xml introuvable dans le .zip.");
        return;
      }

      const xmlString = await orSessionXmlFile.async("string");
      setImportSummary("Parsing XML...");
      let extractedResultsFromXml: ExtractedResultFromXml[] = parseOmbeaResultsXml(xmlString);

      if (extractedResultsFromXml.length === 0) {
        setImportSummary("Aucune réponse trouvée dans le fichier XML.");
        return;
      }
      logger.info(`[Import Results] ${extractedResultsFromXml.length} réponses initialement extraites du XML pour l'itération ${iteration.id}.`);

      const slideGuidsToIgnore = editingSessionData.ignoredSlideGuids;
      if (slideGuidsToIgnore && slideGuidsToIgnore.length > 0) {
        const countBeforeFiltering = extractedResultsFromXml.length;
        extractedResultsFromXml = extractedResultsFromXml.filter(
          (result) => !slideGuidsToIgnore.includes(result.questionSlideGuid)
        );
        const countAfterFiltering = extractedResultsFromXml.length;
        if (countBeforeFiltering > countAfterFiltering) {
          logger.info(`[Import Results] ${countBeforeFiltering - countAfterFiltering} réponses correspondant à des GUIDs ignorés ont été filtrées.`);
        }
      }

      // Deduplication
      const latestResultsMap = new Map<string, ExtractedResultFromXml>();
      for (const result of extractedResultsFromXml) {
        const key = `${result.participantDeviceID}-${result.questionSlideGuid}`;
        const existingResult = latestResultsMap.get(key);
        if (!existingResult || (result.timestamp && existingResult.timestamp && new Date(result.timestamp) > new Date(existingResult.timestamp))) {
          latestResultsMap.set(key, result);
        }
      }
      const finalExtractedResults = Array.from(latestResultsMap.values());
      logger.info(`[Import Results] ${finalExtractedResults.length} réponses retenues après déduplication.`);

      if (finalExtractedResults.length === 0) {
        setImportSummary("Aucune réponse valide à importer après déduplication.");
        return;
      }

      const sessionBoitiers = (iteration.participants || []).map((p: any, index: number) => ({
        serialNumber: hardwareDevices.find(d => d.id === p.assignedGlobalDeviceId)?.serialNumber,
        participantName: `${p.prenom} ${p.nom}`,
        visualId: index + 1, // Utiliser l'index comme ID visuel
      })).filter((b: any) => b.serialNumber);

      if (!sessionBoitiers || sessionBoitiers.length === 0) {
           console.warn(`[Import Results] Aucune information de boîtier (sessionBoitiers) trouvée pour l'itération ${iteration.id}.`);
      }

      const relevantSessionQuestionGuids = new Set(currentQuestionMappings.map((q: any) => q.slideGuid));

      // Anomaly detection
      const detectedAnomaliesData: DetectedAnomalies = { expectedHavingIssues: [], unknownThatResponded: [] };
      const responsesFromExpectedDevices: ExtractedResultFromXml[] = [];
      const expectedSerialNumbers = new Set(sessionBoitiers.map((b: any) => b.serialNumber));

      finalExtractedResults.forEach(result => {
        if (expectedSerialNumbers.has(result.participantDeviceID)) {
          responsesFromExpectedDevices.push(result);
        } else {
          let unknown = detectedAnomaliesData.unknownThatResponded.find(u => u.serialNumber === result.participantDeviceID);
          if (!unknown) {
            unknown = { serialNumber: result.participantDeviceID, responses: [] };
            detectedAnomaliesData.unknownThatResponded.push(unknown);
          }
          unknown.responses.push(result);
        }
      });

      sessionBoitiers.forEach((boitier: any) => {
        const respondedGuids = new Set(finalExtractedResults.filter(r => r.participantDeviceID === boitier.serialNumber).map(r => r.questionSlideGuid));
        const missedGuids = [...relevantSessionQuestionGuids].filter(guid => !respondedGuids.has(guid as string));
        if (missedGuids.length > 0) {
          detectedAnomaliesData.expectedHavingIssues.push({
            serialNumber: boitier.serialNumber,
            participantName: boitier.participantName,
            visualId: boitier.visualId,
            responseInfo: {
              respondedToQuestionsGuids: [...respondedGuids],
              missedQuestionsGuids: missedGuids,
              totalSessionQuestionsCount: relevantSessionQuestionGuids.size,
              responsesProvidedByExpected: finalExtractedResults.filter(r => r.participantDeviceID === boitier.serialNumber),
            }
          });
        }
      });

      if ((detectedAnomaliesData.expectedHavingIssues.length || 0) > 0 || (detectedAnomaliesData.unknownThatResponded.length || 0) > 0) {
        setImportSummary(`Anomalies détectées: ${detectedAnomaliesData.expectedHavingIssues.length || 0} boîtier(s) attendu(s) avec problèmes, ${detectedAnomaliesData.unknownThatResponded.length || 0} boîtier(s) inconnu(s). Résolution nécessaire.`);
        setDetectedAnomalies(detectedAnomaliesData);
        setPendingValidResults(responsesFromExpectedDevices);
        setCurrentIterationForImport(iteration.id);
        setShowAnomalyResolutionUI(true);
        logger.info("[Import Results] Des anomalies de boîtiers ont été détectées. Affichage de l'interface de résolution.");
        return;
      }

      logger.info("[Import Results] Aucune anomalie de boîtier détectée. Procédure d'import direct.");
      const participantsForIteration = (iteration.participants || [])
        .map((p: DBParticipantType) => {
          const device = hardwareDevices.find(d => d.id === p.assignedGlobalDeviceId);
          return {
            id: p.id,
            serialNumber: device ? device.serialNumber : undefined,
          };
        })
        .filter((p): p is { id: number; serialNumber: string } => !!p.id && !!p.serialNumber);

      const sessionResultsToSave = transformParsedResponsesToSessionResults(
        responsesFromExpectedDevices,
        currentQuestionMappings,
        currentSessionDbId,
        iteration.id,
        participantsForIteration
      );

      if (sessionResultsToSave.length > 0) {
        const updatedSession = await StorageManager.importResultsForIteration(iteration.id, currentSessionDbId, sessionResultsToSave);
        if (updatedSession) {
          setEditingSessionData(updatedSession);
          setImportSummary(`${sessionResultsToSave.length} résultats importés et traités avec succès pour l'itération ${iteration.name}.`);
        } else {
          setImportSummary("Erreur lors de la finalisation de l'itération.");
        }
      } else {
        setImportSummary("Aucun résultat à importer.");
      }
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setImportSummary(`Erreur traitement fichier: ${errorMessage}`);
      logger.error(`Erreur lors du traitement du fichier de résultats pour la session ID ${currentSessionDbId}`, {
        eventType: 'RESULTS_IMPORT_FILE_PROCESSING_ERROR',
        sessionId: currentSessionDbId,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : 'No stack available'
      });
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

    if (!currentSessionDbId) {
      setImportSummary("Erreur critique : ID de session manquant.");
      logger.error("[AnomalyResolution] ID de session manquant.");
      return;
    }

    const freshSessionData = await StorageManager.getSessionById(currentSessionDbId);

    if (!freshSessionData) {
      setImportSummary("Erreur critique : Impossible de recharger les données de la session.");
      logger.error("[AnomalyResolution] Impossible de recharger les données de la session.");
      return;
    }

    const iterationForImport = freshSessionData.iterations?.find((it: SessionIteration) => it.id === currentIterationForImport);

    if (!iterationForImport || !iterationForImport.question_mappings) {
      setImportSummary("Erreur critique : Données de l'itération manquantes pour finaliser l'import.");
      logger.error("[AnomalyResolution] Données de l'itération (ou ses mappings) manquantes pour finaliser l'import.");
      return;
    }

    let finalResultsToImport: ExtractedResultFromXml[] = [...baseResultsToProcess];
    const originalAnomalies = detectedAnomalies;
    if (!originalAnomalies) {
        setImportSummary("Erreur critique : Données d'anomalies originales non trouvées.");
        logger.error("[AnomalyResolution] Données d'anomalies originales (état detectedAnomalies) non trouvées.");
        return;
    }

    const allAssignmentsInSession = freshSessionData.iterations?.flatMap((iter: SessionIteration) => {
        const iterId = iter.id;
        if (!iterId || !iter.participants) return [];
        return iter.participants.map((p: DBParticipantType) => ({
            participantId: p.id,
            iterationId: iterId,
            deviceId: p.assignedGlobalDeviceId,
            deviceSerialNumber: hardwareDevices.find(hd => hd.id === p.assignedGlobalDeviceId)?.serialNumber,
        }));
    }) || [];

    for (const resolution of expectedResolutions) {
        const expectedDeviceData = originalAnomalies.expectedHavingIssues?.find(
            (e: { serialNumber: string }) => e.serialNumber === resolution.serialNumber
        );
        if (!expectedDeviceData) continue;

        const assignmentInfo = allAssignmentsInSession.find((a: { deviceSerialNumber: string | undefined; iterationId: number; }) => a && a.deviceSerialNumber === resolution.serialNumber && a.iterationId === currentIterationForImport);
        if (!assignmentInfo || !assignmentInfo.participantId) {
            logger.warning(`[AnomalyResolution] Could not find assignment for device SN ${resolution.serialNumber} in iteration ${currentIterationForImport}.`);
            continue;
        }

        if (resolution.action === 'mark_absent' || resolution.action === 'ignore_device') {
            logger.info(`[AnomalyResolution] Marking participant ${assignmentInfo.participantId} as absent in iteration ${assignmentInfo.iterationId}.`);
            await window.dbAPI.updateParticipantStatusInIteration(assignmentInfo.participantId, assignmentInfo.iterationId, 'absent');
            // Remove their results from the final import list
            finalResultsToImport = finalResultsToImport.filter(r => r.participantDeviceID !== resolution.serialNumber);

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
        (u: { serialNumber: string }) => u.serialNumber === resolution.serialNumber
      );
      if (!unknownDeviceData) continue;
      if (resolution.action === 'add_as_new_participant') {
        // This part needs to be refactored to use proper DB calls (upsertParticipant, addParticipantAssignment)
        // For now, we log it and do not crash.
        logger.warning(`[AnomalyResolution] 'add_as_new_participant' is not fully implemented and will not persist correctly. SN: ${resolution.serialNumber}`);
        finalResultsToImport.push(...unknownDeviceData.responses);
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

    try {
      if (!currentIterationForImport) {
        setImportSummary("Erreur critique: ID d'itération manquant pour la résolution des anomalies.");
        logger.error("[AnomalyResolution] currentIterationForImport is null, cannot proceed.");
        return;
      }
      // Utiliser les mappings de l'itération spécifique, pas de la session globale
      const sessionQuestionMaps = iterationForImport.question_mappings;
      if (!sessionQuestionMaps || sessionQuestionMaps.length === 0) {
          setImportSummary("Erreur: Mappages de questions (questionMappings) manquants pour l'itération. Impossible de lier les résultats.");
          return;
      }
      const participantsForIteration = (iterationForImport.participants || [])
        .map((p: any) => {
            const device = hardwareDevices.find(d => d.id === p.assignedGlobalDeviceId);
            return {
                id: p.id,
                serialNumber: device ? device.serialNumber : undefined,
            };
        })
        .filter((p): p is { id: number; serialNumber: string } => !!p.id && !!p.serialNumber);

      const sessionResultsToSave = transformParsedResponsesToSessionResults(
        finalResultsToImport,
        sessionQuestionMaps,
        currentSessionDbId,
        currentIterationForImport,
        participantsForIteration
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
                    sessionName: finalSessionDataForScores?.nomSession || editingSessionData?.nomSession || '',
                    resolutions: anomaliesAuditData
                  });
                  const finalUpdatedSessionWithScores = await StorageManager.getSessionById(currentSessionDbId);
                       if (finalUpdatedSessionWithScores && finalUpdatedSessionWithScores.iterations) {
                      setEditingSessionData(finalUpdatedSessionWithScores);
                          const allParticipantsFromIterations = (finalUpdatedSessionWithScores.iterations.flatMap((iter: any) => (iter as any).participants || [])) as DBParticipantType[];
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
                            id: p_db_updated.id,
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
        report: 'Rapport',
    };

    const isReportTabVisible = editingSessionData?.status === 'completed';
    let tabsToShow: TabKey[] = ['details', 'participants', 'generateQuestionnaire', 'importResults'];
    if (isReportTabVisible) {
      tabsToShow.push('report');
    }

    return (
        <div className="mb-6">
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-4 sm:space-x-8" aria-label="Tabs">
                    {tabsToShow.map((tabKey) => (
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
            formData={formData}
            handleDataChange={handleDataChange}
            isReadOnly={isReadOnly}
            referentielsData={referentielsData}
            editingSessionData={editingSessionData}
            trainersList={trainersList}
            setParticipantAssignments={setParticipantAssignments}
            displayedBlockDetails={displayedBlockDetails}
          />
        );
      case 'participants':
        return (
          <ParticipantManager
            isReadOnly={isReadOnly}
            participants={participants}
            setParticipants={setParticipants}
            handleParticipantChange={handleParticipantChange}
            handleRemoveParticipant={handleRemoveParticipant}
            handleAddParticipant={handleAddParticipant}
            handleParticipantFileSelect={handleParticipantFileSelect}
            iterationCount={formData.iterationCount}
            iterationNames={formData.iterationNames}
            participantAssignments={participantAssignments}
            handleParticipantIterationChange={handleParticipantIterationChange}
            deviceKitsList={deviceKitsList}
            selectedKitIdState={formData.selectedKitIdState}
            setSelectedKitIdState={(id: any) => handleDataChange('selectedKitIdState', id)}
            votingDevicesInSelectedKit={votingDevicesInSelectedKit}
            isLoadingKits={isLoadingKits}
          />
        );
      case 'generateQuestionnaire':
        return (
          <QuestionnaireGenerator
            isReadOnly={isReadOnly}
            isGeneratingOrs={isGeneratingOrs}
            isFirstGenerationDone={isFirstGenerationDone}
            iterationHasResults={iterationHasResults}
            handleGenerateQuestionnaire={handleGenerateQuestionnaire}
            handleRegenerateIteration={handleRegenerateIteration}
            editingSessionData={editingSessionData}
            modifiedAfterOrsGeneration={modifiedAfterOrsGeneration}
            importSummary={importSummary}
            activeTab={activeTab}
            currentSessionDbId={currentSessionDbId}
            selectedReferential={formData.selectedReferential}
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
      case 'report':
        return editingSessionData ? <ReportDetails session={editingSessionData} /> : <div>Chargement du rapport...</div>;
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
