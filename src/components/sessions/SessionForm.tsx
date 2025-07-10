import React, { useState, useEffect, useCallback } from 'react';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { Save, FileUp, UserPlus, Trash2, PackagePlus, AlertTriangle } from 'lucide-react';
import {
  CACESReferential,
  Session as DBSession,
  Participant as DBParticipantType,
  SessionResult,
  Trainer,
  SessionQuestion,
  SessionBoitier,
  Referential,
  Theme,
  Bloc,
  QuestionWithId as StoredQuestion,
  VotingDevice,
  DeviceKit
} from '../../types';
import { StorageManager } from '../../services/StorageManager';
import {
  addSession,
  updateSession,
  getSessionById,
  addBulkSessionResults,
  getResultsForSession,
  getQuestionsByIds,
  getAllVotingDevices,
  getAdminSetting,
  getAllTrainers,
  addBulkSessionQuestions,
  deleteSessionQuestionsBySessionId,
  addBulkSessionBoitiers,
  deleteSessionBoitiersBySessionId,
  getSessionQuestionsBySessionId,
  getSessionBoitiersBySessionId,
  getAllDeviceKits,
  getDefaultDeviceKit,
  getVotingDevicesForKit
} from '../../db';
import { generatePresentation, AdminPPTXSettings } from '../../utils/pptxOrchestrator';
import { parseOmbeaResultsXml, ExtractedResultFromXml, transformParsedResponsesToSessionResults } from '../../utils/resultsParser';
import { calculateParticipantScore, calculateThemeScores, determineIndividualSuccess } from '../../utils/reportCalculators';
import { logger } from '../../utils/logger';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import AnomalyResolutionModal, { DetectedAnomalies } from './AnomalyResolutionModal';
import { ExpectedIssueResolution, UnknownDeviceResolution } from '../../types';

interface FormParticipant extends DBParticipantType {
  id: string;
  firstName: string;
  lastName: string;
  organization?: string;
  deviceId: number | null;
  hasSigned?: boolean;
}

interface SessionFormProps {
  sessionIdToLoad?: number;
}

type TabKey = 'details' | 'participants' | 'resultsOrs';

const SessionForm: React.FC<SessionFormProps> = ({ sessionIdToLoad }) => {
  const [currentSessionDbId, setCurrentSessionDbId] = useState<number | null>(sessionIdToLoad || null);
  const [sessionName, setSessionName] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [selectedReferential, setSelectedReferential] = useState<CACESReferential | ''>('');
  const [selectedReferentialId, setSelectedReferentialId] = useState<number | null>(null);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [participants, setParticipants] = useState<FormParticipant[]>([]);
  const [displayedBlockDetails, setDisplayedBlockDetails] = useState<Array<{ themeName: string, blocName: string }>>([]);
  const [resultsFile, setResultsFile] = useState<File | null>(null);
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

  useEffect(() => {
    const fetchGlobalData = async () => {
      setIsLoadingKits(true);
      try {
        const [devices, trainers, refs, themes, blocs, kits, defaultKitResult] = await Promise.all([
          getAllVotingDevices(),
          getAllTrainers(),
          StorageManager.getAllReferentiels(),
          StorageManager.getAllThemes(),
          StorageManager.getAllBlocs(),
          getAllDeviceKits(),
          getDefaultDeviceKit()
        ]);
        setHardwareDevices(devices.sort((a, b) => (a.id ?? 0) - (b.id ?? 0)));
        setTrainersList(trainers.sort((a, b) => a.name.localeCompare(b.name)));
        setReferentielsData(refs);
        setAllThemesData(themes);
        setAllBlocsData(blocs);
        setDeviceKitsList(kits);
        setHardwareLoaded(true);
        setIsLoadingKits(false);

        if (!sessionIdToLoad) {
          if (trainers.length > 0) {
            const defaultTrainer = trainers.find(t => t.isDefault === 1) || trainers[0];
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
          const devices = await getVotingDevicesForKit(selectedKitIdState);
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
    setResultsFile(null);
    setImportSummary(null);
    setEditingSessionData(null);
    setActiveTab('details');
    setModifiedAfterOrsGeneration(false);
  }, []);

  useEffect(() => {
    if (sessionIdToLoad && hardwareLoaded && referentielsData.length > 0) {
      const loadSession = async () => {
        try {
          const sessionData = await getSessionById(sessionIdToLoad);
          setEditingSessionData(sessionData || null);
          if (sessionData) {
            setCurrentSessionDbId(sessionData.id ?? null);
            setSessionName(sessionData.nomSession);
            setSessionDate(sessionData.dateSession ? sessionData.dateSession.split('T')[0] : '');
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
            setModifiedAfterOrsGeneration(false);
            const formParticipants: FormParticipant[] = sessionData.participants.map((p_db: DBParticipantType, loopIndex: number) => ({
              ...p_db,
              id: `loaded-${loopIndex}-${Date.now()}`,
              firstName: p_db.prenom,
              lastName: p_db.nom,
              deviceId: loopIndex + 1,
              organization: (p_db as any).organization || '',
              hasSigned: (p_db as any).hasSigned || false,
            }));
            setParticipants(formParticipants);
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
    } else if (!sessionIdToLoad && referentielsData.length > 0) {
      resetFormTactic();
    }
  }, [sessionIdToLoad, hardwareLoaded, referentielsData, resetFormTactic]);

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

  const referentialOptionsFromData = referentielsData.map((r: Referential) => ({
    value: r.code,
    label: `${r.code} - ${r.nom_complet}`,
  }));

  const handleAddParticipant = () => {
    if (editingSessionData?.donneesOrs && editingSessionData.status !== 'completed') { setModifiedAfterOrsGeneration(true); }
    if (!selectedKitIdState) {
      alert("Veuillez d'abord sélectionner un kit de boîtiers dans l'onglet 'Participants'.");
      setActiveTab('participants');
      return;
    }
    if (votingDevicesInSelectedKit.length === 0) {
      alert("Le kit sélectionné ne contient aucun boîtier. Veuillez ajouter des boîtiers au kit ou en sélectionner un autre.");
      return;
    }
    const assignedDeviceIdsInSession = new Set(
      participants.map(p => p.assignedGlobalDeviceId).filter(id => id !== null)
    );
    let nextAvailableDevice: VotingDevice | null = null;
    for (const deviceInKit of votingDevicesInSelectedKit) {
      if (deviceInKit.id && !assignedDeviceIdsInSession.has(deviceInKit.id)) {
        nextAvailableDevice = deviceInKit;
        break;
      }
    }
    if (!nextAvailableDevice) {
      alert("Tous les boîtiers du kit sélectionné sont déjà assignés dans cette session.");
      return;
    }
    const nextVisualDeviceId = participants.length > 0
        ? Math.max(...participants.map(p => p.deviceId || 0)) + 1
        : 1;
    const newParticipant: FormParticipant = {
      nom: '',
      prenom: '',
      identificationCode: '',
      score: undefined,
      reussite: undefined,
      assignedGlobalDeviceId: nextAvailableDevice.id!,
      statusInSession: 'present',
      id: Date.now().toString(),
      firstName: '',
      lastName: '',
      organization: '',
      deviceId: nextVisualDeviceId,
      hasSigned: false,
    };
    setParticipants([...participants, newParticipant]);
  };

  const handleRemoveParticipant = (id: string) => {
    if (editingSessionData?.donneesOrs && editingSessionData.status !== 'completed') { setModifiedAfterOrsGeneration(true); }
    const updatedParticipants = participants.filter(p => p.id !== id);
    setParticipants(updatedParticipants);
  };

  const handleParticipantChange = (id: string, field: keyof FormParticipant, value: string | number | boolean | null) => {
    if (editingSessionData?.donneesOrs && field !== 'deviceId' && editingSessionData.status !== 'completed') {
      setModifiedAfterOrsGeneration(true);
    }
    setParticipants(participants.map((p: FormParticipant) => {
      if (p.id === id) {
        const updatedP = { ...p, [field]: value };
        if (field === 'firstName') updatedP.prenom = value as string;
        if (field === 'lastName') updatedP.nom = value as string;
        return updatedP;
      }
      return p;
    }));
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

  const parseExcelParticipants = (data: Uint8Array): Array<Partial<DBParticipantType>> => {
    const parsed: Array<Partial<DBParticipantType>> = [];
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
      headers = ['prénom', 'nom', 'organisation', 'code identification']; dataStartIndex = 0;
    }
    const prenomIndex = headers.findIndex(h => h === 'prénom' || h === 'prenom');
    const nomIndex = headers.findIndex(h => h === 'nom');
    const orgIndex = headers.findIndex(h => h === 'organisation');
    const codeIndex = headers.findIndex(h => h === 'code identification' || h === 'code');
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
            } as Partial<DBParticipantType>);
        }
      }
    }
    return parsed;
  };

  const addImportedParticipants = (
    parsedData: Array<Partial<DBParticipantType>>,
    fileName: string
  ) => {
    if (editingSessionData?.donneesOrs && editingSessionData.status !== 'completed') { setModifiedAfterOrsGeneration(true); }
    if (parsedData.length > 0) {
      const newFormParticipants: FormParticipant[] = parsedData.map((p, index) => ({
        nom: p.nom || '',
        prenom: p.prenom || '',
        identificationCode: p.identificationCode || '',
        score: undefined,
        reussite: undefined,
        assignedGlobalDeviceId: null,
        statusInSession: 'present',
        id: `imported-${Date.now()}-${index}`,
        firstName: p.prenom || '',
        lastName: p.nom || '',
        organization: (p as any).organization || '',
        deviceId: null,
        hasSigned: false,
      }));
      setParticipants(prev => [...prev, ...newFormParticipants]);
      setImportSummary(`${parsedData.length} participants importés de ${fileName}. Assignez les boîtiers.`);
    } else {
      setImportSummary(`Aucun participant valide trouvé dans ${fileName}.`);
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

  const prepareSessionDataForDb = async (includeOrsBlob?: Blob | null): Promise<DBSession | null> => {
    const dbParticipants: DBParticipantType[] = participants.map((p_form: FormParticipant) => ({
      nom: p_form.lastName,
      prenom: p_form.firstName,
      identificationCode: p_form.identificationCode,
      score: p_form.score,
      reussite: p_form.reussite,
      assignedGlobalDeviceId: p_form.assignedGlobalDeviceId,
      statusInSession: p_form.statusInSession,
    }));
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
    const sessionToSave: DBSession = {
      id: currentSessionDbId || undefined,
      nomSession: sessionName || `Session du ${new Date().toLocaleDateString()}`,
      dateSession: sessionDate || new Date().toISOString().split('T')[0],
      referentielId: currentReferentielId,
      participants: dbParticipants,
      selectedBlocIds: editingSessionData?.selectedBlocIds || [],
      selectedKitId: selectedKitIdState,
      donneesOrs: includeOrsBlob !== undefined ? includeOrsBlob : editingSessionData?.donneesOrs,
      status: editingSessionData?.status || 'planned',
      location: location,
      questionMappings: editingSessionData?.questionMappings,
      notes: notes,
      trainerId: selectedTrainerId ?? undefined,
      createdAt: editingSessionData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ignoredSlideGuids: editingSessionData?.ignoredSlideGuids,
      resolvedImportAnomalies: editingSessionData?.resolvedImportAnomalies,
    };
    return sessionToSave;
  };

  const handleSaveSession = async (sessionDataToSave: DBSession | null) => {
    if (!sessionDataToSave) return null;
    try {
      let savedId: number | undefined;
      if (sessionDataToSave.id) {
        await updateSession(sessionDataToSave.id, sessionDataToSave);
        savedId = sessionDataToSave.id;
      } else {
        const newId = await addSession(sessionDataToSave);
        if (newId) { setCurrentSessionDbId(newId); savedId = newId; }
        else { setImportSummary("Erreur critique : La nouvelle session n'a pas pu être créée."); return null; }
      }
      if (savedId) {
         const reloadedSession = await getSessionById(savedId);
         setEditingSessionData(reloadedSession || null);
         if (reloadedSession) {
            setModifiedAfterOrsGeneration(false);
            const formParticipants: FormParticipant[] = reloadedSession.participants.map((p_db: DBParticipantType, index: number) => {
              const visualDeviceId = index + 1;
              const currentParticipantState = participants.find(p => p.nom === p_db.nom && p.prenom === p_db.prenom && p.assignedGlobalDeviceId === p_db.assignedGlobalDeviceId) || participants[index];
              return {
                nom: p_db.nom,
                prenom: p_db.prenom,
                identificationCode: p_db.identificationCode,
                score: p_db.score,
                reussite: p_db.reussite,
                assignedGlobalDeviceId: p_db.assignedGlobalDeviceId,
                statusInSession: p_db.statusInSession,
                id: currentParticipantState?.id || `form-reloaded-${index}-${Date.now()}`,
                firstName: p_db.prenom,
                lastName: p_db.nom,
                deviceId: currentParticipantState?.deviceId ?? visualDeviceId,
                organization: currentParticipantState?.organization || '',
                hasSigned: currentParticipantState?.hasSigned || false,
              };
            });
            setParticipants(formParticipants);
         }
      }
      return savedId;
    } catch (error: any) {
      console.error("Erreur sauvegarde session:", error);
      setImportSummary(`Erreur sauvegarde session: ${error.message}`);
      return null;
    }
  };

  const handleSaveDraft = async () => {
    const sessionData = await prepareSessionDataForDb(editingSessionData?.donneesOrs);
    if (sessionData) {
      const savedId = await handleSaveSession(sessionData);
      if (savedId) { setImportSummary(`Session (ID: ${savedId}) sauvegardée avec succès !`); }
    }
  };

  const handleGenerateQuestionnaireAndOrs = async () => {
    const refCodeToUse = selectedReferential || (editingSessionData?.referentielId ? referentielsData.find(r => r.id === editingSessionData.referentielId)?.code : null);
    if (!refCodeToUse) {
      setImportSummary("Veuillez sélectionner un référentiel pour générer l'ORS.");
      setIsGeneratingOrs(false); return;
    }
    setIsGeneratingOrs(true);
    setImportSummary("Préparation des données et vérification des boîtiers...");
    let sessionDataPreORS = await prepareSessionDataForDb(undefined);
    if (!sessionDataPreORS) { setImportSummary("Erreur préparation données session."); setIsGeneratingOrs(false); return; }
    const currentSavedId = await handleSaveSession(sessionDataPreORS);
    if (!currentSavedId) {
        setImportSummary("Erreur lors de la sauvegarde de la session avant génération ORS.");
        setIsGeneratingOrs(false); return;
    }
    const upToDateSessionData = await getSessionById(currentSavedId);
    if (!upToDateSessionData) { setImportSummary("Erreur rechargement session après sauvegarde."); setIsGeneratingOrs(false); return; }
    setEditingSessionData(upToDateSessionData);
    const participantsWithoutValidDevice = [];
    for (const p of upToDateSessionData.participants) {
      if (p.assignedGlobalDeviceId === null || p.assignedGlobalDeviceId === undefined) {
        participantsWithoutValidDevice.push(`${p.prenom} ${p.nom} (aucun boîtier physique assigné)`);
      } else {
        const foundDevice = hardwareDevices.find(hd => hd.id === p.assignedGlobalDeviceId);
        if (!foundDevice) {
          participantsWithoutValidDevice.push(`${p.prenom} ${p.nom} (boîtier physique assigné introuvable - ID: ${p.assignedGlobalDeviceId})`);
        }
      }
    }
    if (participantsWithoutValidDevice.length > 0) {
      const participantIssues = participantsWithoutValidDevice.join('; ');
      setImportSummary(`Erreur: Participants avec problèmes d'assignation de boîtier: ${participantIssues}. Vérifiez les assignations.`);
      setIsGeneratingOrs(false); return;
    }
    setImportSummary("Préparation du modèle PPTX et génération .ors...");
    let allSelectedQuestionsForPptx: StoredQuestion[] = [];
    let selectedBlocIdsForSession: number[] = [];
    try {
      const referentielObject = await StorageManager.getReferentialByCode(refCodeToUse as string);
      if (!referentielObject || !referentielObject.id) {
        setImportSummary(`Référentiel avec code "${refCodeToUse}" non trouvé.`);
        setIsGeneratingOrs(false); return;
      }
      const themesForReferential = await StorageManager.getThemesByReferentialId(referentielObject.id);
      if (!themesForReferential || themesForReferential.length === 0) {
        setImportSummary(`Aucun thème trouvé pour le référentiel "${refCodeToUse}".`);
        setIsGeneratingOrs(false); return;
      }
      for (const theme of themesForReferential) {
        if (!theme.id) continue;
        const blocsForTheme = await StorageManager.getBlocsByThemeId(theme.id);
        if (!blocsForTheme || blocsForTheme.length === 0) {
          console.warn(`Aucun bloc trouvé pour le thème "${theme.code_theme}" (ID: ${theme.id}).`);
          continue;
        }
        const filteredBlocs = blocsForTheme.filter((bloc: Bloc) =>
          bloc.code_bloc.match(/_([A-E])$/i)
        );
        if (filteredBlocs.length === 0) {
          console.warn(`Aucun bloc de type _A à _E trouvé pour le thème "${theme.code_theme}".`);
          continue;
        }
        const chosenBloc = filteredBlocs[Math.floor(Math.random() * filteredBlocs.length)];
        if (chosenBloc && chosenBloc.id) {
          selectedBlocIdsForSession.push(chosenBloc.id);
          const questionsFromBloc = await StorageManager.getQuestionsForBloc(chosenBloc.id);
          allSelectedQuestionsForPptx = allSelectedQuestionsForPptx.concat(questionsFromBloc);
          logger.info(`Thème: ${theme.code_theme}, Bloc choisi: ${chosenBloc.code_bloc}, Questions: ${questionsFromBloc.length}`);
        }
      }
      if (allSelectedQuestionsForPptx.length === 0) {
        setImportSummary("Aucune question sélectionnée après le processus de choix aléatoire des blocs.");
        setIsGeneratingOrs(false); return;
      }
      const sessionDataWithSelectedBlocs: DBSession = {
        ...upToDateSessionData,
        selectedBlocIds: selectedBlocIdsForSession,
        referentielId: referentielObject.id
      };
      await updateSession(currentSavedId, { selectedBlocIds: selectedBlocIdsForSession, referentielId: referentielObject.id });
      setEditingSessionData(sessionDataWithSelectedBlocs);
      const sessionInfoForPptx = { name: sessionDataWithSelectedBlocs.nomSession, date: sessionDataWithSelectedBlocs.dateSession, referential: referentielObject.code as CACESReferential };
      const prefPollStartMode = await getAdminSetting('pollStartMode') || 'Automatic';
      const prefAnswersBulletStyle = await getAdminSetting('answersBulletStyle') || 'ppBulletAlphaUCPeriod';
      const prefPollTimeLimit = await getAdminSetting('pollTimeLimit');
      const prefPollCountdownStartMode = await getAdminSetting('pollCountdownStartMode') || 'Automatic';
      const timeLimitFromPrefs = prefPollTimeLimit !== undefined ? Number(prefPollTimeLimit) : 30;
      const adminSettings: AdminPPTXSettings = {
        defaultDuration: timeLimitFromPrefs, pollTimeLimit: timeLimitFromPrefs,
        answersBulletStyle: prefAnswersBulletStyle, pollStartMode: prefPollStartMode,
        chartValueLabelFormat: 'Response_Count', pollCountdownStartMode: prefPollCountdownStartMode,
        pollMultipleResponse: '1'
      };
      const participantsForGenerator = sessionDataWithSelectedBlocs.participants.map((p_db: DBParticipantType) => {
        const assignedDevice = hardwareDevices.find(hd => hd.id === p_db.assignedGlobalDeviceId);
        return {
          idBoitier: assignedDevice ? assignedDevice.serialNumber : '',
          nom: p_db.nom,
          prenom: p_db.prenom,
          identificationCode: p_db.identificationCode,
        };
      });
      const stillMissingSerial = participantsForGenerator.find(p => !p.idBoitier);
      if (stillMissingSerial) {
          setImportSummary(`Erreur critique: Impossible de trouver le numéro de série pour ${stillMissingSerial.prenom} ${stillMissingSerial.nom}.`);
          setIsGeneratingOrs(false); return;
      }
      const generationOutput = await generatePresentation(
        sessionInfoForPptx,
        participantsForGenerator as DBParticipantType[],
        allSelectedQuestionsForPptx,
        undefined,
        adminSettings
      );
      if (generationOutput && generationOutput.orsBlob && generationOutput.questionMappings && sessionDataWithSelectedBlocs) {
        const { orsBlob, questionMappings, ignoredSlideGuids: newlyIgnoredSlideGuids } = generationOutput;
        try {
          await updateSession(currentSavedId, {
            donneesOrs: orsBlob,
            questionMappings: questionMappings,
            ignoredSlideGuids: newlyIgnoredSlideGuids || [],
            updatedAt: new Date().toISOString(),
            status: 'ready',
            selectedBlocIds: sessionDataWithSelectedBlocs.selectedBlocIds,
            referentielId: sessionDataWithSelectedBlocs.referentielId
          });
          const freshlyUpdatedSessionData = await getSessionById(currentSavedId);
          if (!freshlyUpdatedSessionData) {
            throw new Error("Impossible de recharger la session après la mise à jour avec l'ORS.");
          }
          setEditingSessionData(freshlyUpdatedSessionData);
          await deleteSessionQuestionsBySessionId(currentSavedId);
          await deleteSessionBoitiersBySessionId(currentSavedId);
          const sessionQuestionsToSave: SessionQuestion[] = [];
          for (const qMap of questionMappings) {
            if (qMap.slideGuid && qMap.dbQuestionId !== undefined) {
              const originalQuestion = allSelectedQuestionsForPptx.find(q => q.id === qMap.dbQuestionId);
              if (originalQuestion) {
                let blocCodeForSessionQuestion = 'N/A';
                if (originalQuestion.blocId) {
                  const blocDetails = allBlocsData.find((b: Bloc) => b.id === originalQuestion.blocId);
                  if (blocDetails) {
                    blocCodeForSessionQuestion = blocDetails.code_bloc;
                  } else {
                    blocCodeForSessionQuestion = `ID_Bloc_${originalQuestion.blocId}`;
                  }
                }
                sessionQuestionsToSave.push({
                  sessionId: currentSavedId,
                  dbQuestionId: originalQuestion.id!,
                  slideGuid: qMap.slideGuid,
                  text: originalQuestion.text,
                  options: originalQuestion.options,
                  correctAnswer: originalQuestion.correctAnswer,
                  blockId: blocCodeForSessionQuestion,
                });
              }
            }
          }
          if (sessionQuestionsToSave.length > 0) {
            await addBulkSessionQuestions(sessionQuestionsToSave);
          }
          const sessionBoitiersToSave: SessionBoitier[] = [];
          freshlyUpdatedSessionData.participants.forEach((p_db: DBParticipantType, p_idx: number) => {
            const assignedDevice = hardwareDevices.find(hd => hd.id === p_db.assignedGlobalDeviceId);
            if (assignedDevice) {
              const formP = participants.find(fp => fp.assignedGlobalDeviceId === p_db.assignedGlobalDeviceId);
              const visualId = formP?.deviceId ?? (p_idx + 1);
              sessionBoitiersToSave.push({
                sessionId: currentSavedId,
                participantId: `P${p_idx + 1}`,
                visualId: visualId,
                serialNumber: assignedDevice.serialNumber,
                participantName: `${p_db.prenom} ${p_db.nom}`,
              });
            }
          });
          if (sessionBoitiersToSave.length > 0) {
            await addBulkSessionBoitiers(sessionBoitiersToSave);
          }
          setImportSummary(`Session (ID: ${currentSavedId}) .ors, mappings et métadonnées générés. Statut: Prête.`);
          logger.info(`Fichier .ors, mappings et métadonnées générés/mis à jour pour la session "${freshlyUpdatedSessionData.nomSession}"`, {
            eventType: 'ORS_METADATA_UPDATED',
            sessionId: currentSavedId,
            sessionName: freshlyUpdatedSessionData.nomSession
          });
          setModifiedAfterOrsGeneration(false);
        } catch (e: any) {
          setImportSummary(`Erreur sauvegarde .ors/mappings/métadonnées: ${e.message}`);
          console.error("Erreur sauvegarde .ors/mappings/métadonnées:", e);
          logger.error(`Erreur lors de la sauvegarde .ors/mappings/métadonnées pour la session "${sessionDataWithSelectedBlocs.nomSession}"`, { eventType: 'ORS_METADATA_SAVE_ERROR', sessionId: currentSavedId, error: e });
        }
      } else {
        setImportSummary("Erreur génération .ors/mappings ou données de session manquantes.");
        console.error("Erreur génération .ors/mappings. Output:", generationOutput);
        logger.error(`Erreur lors de la génération .ors/mappings pour la session "${sessionDataWithSelectedBlocs.nomSession}"`, { eventType: 'ORS_GENERATION_ERROR', sessionId: currentSavedId, output: generationOutput });
      }
    } catch (error: any) {
      setImportSummary(`Erreur majeure génération: ${error.message}`);
      console.error("Erreur majeure génération:", error);
      logger.error(`Erreur majeure lors de la génération ORS pour la session "${upToDateSessionData?.nomSession || `ID ${currentSavedId}`}"`, { eventType: 'ORS_MAJOR_GENERATION_ERROR', sessionId: currentSavedId, error });
    }
    finally { setIsGeneratingOrs(false); }
    };

    const handleResultsFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        setResultsFile(file || null);
        setImportSummary(null);
    if(file) console.log("Fichier résultats sélectionné:", file.name);
    };

    const handleImportResults = async () => {
        if (!resultsFile) { setImportSummary("Veuillez sélectionner un fichier de résultats."); return; }
        if (!currentSessionDbId || !editingSessionData) { setImportSummary("Aucune session active."); return; }
        if (!editingSessionData.donneesOrs) { setImportSummary("Veuillez d'abord générer un fichier .ors pour cette session."); return; }
    setImportSummary("Lecture .ors...");
    try {
      const arrayBuffer = await resultsFile.arrayBuffer();
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
      const sessionQuestionsFromDb = await getSessionQuestionsBySessionId(currentSessionDbId);
      const sessionBoitiers = await getSessionBoitiersBySessionId(currentSessionDbId);
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
          relevantSessionQuestionGuids.forEach((guid: string) => {
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
        currentSessionDbId
      );
      if (sessionResultsToSave.length > 0) {
        try {
          const savedResultIds = await addBulkSessionResults(sessionResultsToSave);
          if (savedResultIds && savedResultIds.length > 0) {
            let message = `${savedResultIds.length} résultats sauvegardés !`;
            let sessionProcessError: string | null = null;
            try {
              if (currentSessionDbId) {
                await updateSession(currentSessionDbId, { status: 'completed', updatedAt: new Date().toISOString() });
                message += "\nStatut session: 'Terminée'.";
                const sessionResultsForScore: SessionResult[] = await getResultsForSession(currentSessionDbId);
                let sessionDataForScores = await getSessionById(currentSessionDbId);
                if (sessionDataForScores && sessionDataForScores.questionMappings && sessionResultsForScore.length > 0) {
                  const questionIds = sessionDataForScores.questionMappings.map(q => q.dbQuestionId).filter((id): id is number => id !== null && id !== undefined);
                  const sessionQuestionsDb = await getQuestionsByIds(questionIds);
                  if (sessionQuestionsDb.length > 0) {
                    const updatedParticipants = sessionDataForScores.participants.map((p_db: DBParticipantType) => {
                      const matchingGlobalDevice = hardwareDevices.find(hd => hd.id === p_db.assignedGlobalDeviceId);
                      if (!matchingGlobalDevice) {
                        console.warn(`Participant ${p_db.nom} ${p_db.prenom} n'a pas de boîtier physique valide assigné pour le calcul des scores.`);
                        return { ...p_db, score: p_db.score || 0, reussite: p_db.reussite || false };
                      }
                      const participantActualSerialNumber = matchingGlobalDevice.serialNumber;
                      const participantResults = sessionResultsForScore.filter(r => r.participantIdBoitier === participantActualSerialNumber);
                      const score = calculateParticipantScore(participantResults, sessionQuestionsDb);
                      const themeScores = calculateThemeScores(participantResults, sessionQuestionsDb);
                      const reussite = determineIndividualSuccess(score, themeScores);
                      return { ...p_db, score, reussite };
                    });
                    await updateSession(currentSessionDbId, { participants: updatedParticipants, updatedAt: new Date().toISOString() });
                    message += "\nScores et réussite calculés et mis à jour.";
                    const finalUpdatedSession = await getSessionById(currentSessionDbId);
                    if (finalUpdatedSession) {
                      setEditingSessionData(finalUpdatedSession);
                      const formParticipantsToUpdate: FormParticipant[] = finalUpdatedSession.participants.map((p_db_updated: DBParticipantType, index: number) => {
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
                          id: currentFormParticipantState?.id || `updated-${index}-${Date.now()}`,
                          firstName: p_db_updated.prenom,
                          lastName: p_db_updated.nom,
                          deviceId: currentFormParticipantState?.deviceId ?? visualDeviceId,
                          organization: currentFormParticipantState?.organization || '',
                          hasSigned: currentFormParticipantState?.hasSigned || false,
                        };
                      });
                      setParticipants(formParticipantsToUpdate);
                    }
                  } else { message += "\nImpossible charger questions pour scores."; }
                } else { message += "\nImpossible calculer scores."; }
              }
            } catch (processingError: any) { sessionProcessError = processingError.message; }
            if(sessionProcessError) { message += `\nErreur post-traitement: ${sessionProcessError}`; }
            setImportSummary(message);
            setResultsFile(null);
            logger.info(`Résultats importés pour la session ID ${currentSessionDbId}`, {
              eventType: 'RESULTS_IMPORTED',
              sessionId: currentSessionDbId,
              fileName: resultsFile.name,
              resultsCount: savedResultIds.length
            });
          } else {
            setImportSummary("Echec sauvegarde résultats.");
            logger.warning(`Échec de la sauvegarde des résultats importés pour la session ID ${currentSessionDbId}`, { eventType: 'RESULTS_IMPORT_FAILED_DB_SAVE', sessionId: currentSessionDbId, fileName: resultsFile.name });
          }
        } catch (dbError: any) {
          setImportSummary(`Erreur DB sauvegarde résultats: ${dbError.message}`);
          logger.error(`Erreur DB lors de la sauvegarde des résultats importés pour la session ID ${currentSessionDbId}`, { eventType: 'RESULTS_IMPORT_ERROR_DB_SAVE', sessionId: currentSessionDbId, error: dbError, fileName: resultsFile.name });
        }
      } else {
        setImportSummary("Aucun résultat transformé.");
        logger.warning(`Aucun résultat transformé après parsing du fichier pour la session ID ${currentSessionDbId}`, {eventType: 'RESULTS_IMPORT_NO_TRANSFORMED_DATA', sessionId: currentSessionDbId, fileName: resultsFile.name});
      }
    } catch (error: any) {
      setImportSummary(`Erreur traitement fichier: ${error.message}`);
      logger.error(`Erreur lors du traitement du fichier de résultats pour la session ID ${currentSessionDbId}`, {eventType: 'RESULTS_IMPORT_FILE_PROCESSING_ERROR', sessionId: currentSessionDbId, error, fileName: resultsFile?.name});
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
    let updatedParticipantsList: DBParticipantType[] = editingSessionData.participants ? [...editingSessionData.participants] : [];
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
            await updateSession(currentSessionDbId, { participants: updatedParticipantsList, updatedAt: new Date().toISOString() });
            const reloadedSessionForUI = await getSessionById(currentSessionDbId);
            if (reloadedSessionForUI) {
                setEditingSessionData(reloadedSessionForUI);
                const formParticipantsToUpdate: FormParticipant[] = reloadedSessionForUI.participants.map((p_db_updated: DBParticipantType, index: number) => {
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
                      id: currentFormParticipantState?.id || `updated-${index}-${Date.now()}`,
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
      const sessionQuestionMaps = editingSessionData.questionMappings;
      if (!sessionQuestionMaps || sessionQuestionMaps.length === 0) {
          setImportSummary("Erreur: Mappages de questions (questionMappings) manquants pour la session. Impossible de lier les résultats.");
          return;
      }
      const sessionResultsToSave = transformParsedResponsesToSessionResults(
        finalResultsToImport,
        sessionQuestionMaps,
        currentSessionDbId
      );
      if (sessionResultsToSave.length > 0) {
        const savedResultIds = await addBulkSessionResults(sessionResultsToSave);
        let message = `${savedResultIds?.length || 0} résultats (après résolution) sauvegardés !`;
        await updateSession(currentSessionDbId, { status: 'completed', updatedAt: new Date().toISOString() });
        message += "\nStatut session: 'Terminée'.";
        const finalSessionDataForScores = await getSessionById(currentSessionDbId);
        if (finalSessionDataForScores && finalSessionDataForScores.questionMappings) {
            const questionDbIds = finalSessionDataForScores.questionMappings.map(qm => qm.dbQuestionId).filter(id => id != null) as number[];
            const questionsForScoreCalc = await getQuestionsByIds(questionDbIds);
            const allResultsForScoreCalc = await getResultsForSession(currentSessionDbId);
            if (questionsForScoreCalc.length > 0 && allResultsForScoreCalc.length > 0) {
                const participantsWithScores = finalSessionDataForScores.participants.map((p: DBParticipantType) => {
                    const device = hardwareDevices.find(hd => hd.id === p.assignedGlobalDeviceId);
                    const participantSerialNumber = device ? device.serialNumber : p.identificationCode?.startsWith('NEW_') ? p.identificationCode.substring(4) : null;
                    if (!participantSerialNumber) return { ...p, score: p.score || 0, reussite: p.reussite || false };
                    const participantResults = allResultsForScoreCalc.filter((r: SessionResult) => r.participantIdBoitier === participantSerialNumber);
                    const score = calculateParticipantScore(participantResults, questionsForScoreCalc);
                    const themeScores = calculateThemeScores(participantResults, questionsForScoreCalc);
                    const reussite = determineIndividualSuccess(score, themeScores);
                    return { ...p, score, reussite };
                });
                const anomaliesAuditData = {
                  expectedIssues: expectedResolutions,
                  unknownDevices: unknownResolutions,
                  resolvedAt: new Date().toISOString(),
                };
                await updateSession(currentSessionDbId, {
                  participants: participantsWithScores,
                  status: 'completed',
                  resolvedImportAnomalies: anomaliesAuditData,
                  updatedAt: new Date().toISOString()
                });
                message += "\nScores et réussite calculés. Statut session: 'Terminée', Audit des anomalies sauvegardé.";
                logger.info(`[AnomalyResolution] Anomalies résolues et auditées pour session ID ${currentSessionDbId}`, {
                  eventType: 'ANOMALIES_RESOLVED_AUDITED',
                  sessionId: currentSessionDbId,
                  sessionName: finalSessionDataForScores?.nomSession || editingSessionData.nomSession,
                  resolutions: anomaliesAuditData
                });
                const finalUpdatedSessionWithScores = await getSessionById(currentSessionDbId);
                 if (finalUpdatedSessionWithScores) {
                    setEditingSessionData(finalUpdatedSessionWithScores);
                    const formParticipantsToUpdate: FormParticipant[] = finalUpdatedSessionWithScores.participants.map((p_db_updated: DBParticipantType, index: number) => {
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
                          id: currentFormParticipantState?.id || `final-updated-${index}-${Date.now()}`,
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
        } else { message += "\nImpossible calculer scores (données session manquantes)."; }
        setImportSummary(message);
        setResultsFile(null);
        logger.info(`Résultats importés et résolus pour session ID ${currentSessionDbId}.`, { /* ... */ });
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
    setResultsFile(null);
  };

  const renderTabNavigation = () => (
    <div className="mb-6 border-b border-gray-200">
      <nav className="-mb-px flex space-x-4 sm:space-x-8" aria-label="Tabs">
        {(Object.keys({ details: 'Détails Session', participants: 'Participants', resultsOrs: 'Résultats & ORS' }) as TabKey[]).map((tabKey) => {
          const tabLabels: Record<TabKey, string> = {
            details: 'Détails Session',
            participants: 'Participants',
            resultsOrs: 'Résultats & ORS',
          };
          return (
            <button
              key={tabKey}
              onClick={() => setActiveTab(tabKey)}
              className={`
                ${activeTab === tabKey
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                whitespace-nowrap py-3 px-2 sm:py-4 sm:px-3 border-b-2 font-medium text-sm
              `}
              aria-current={activeTab === tabKey ? 'page' : undefined}
            >
              {tabLabels[tabKey]}
            </button>
          );
        })}
      </nav>
    </div>
  );
  
  const renderTabContent = () => {
    const isReadOnly = editingSessionData?.status === 'completed';
    const isOrsGeneratedAndNotEditable = !!editingSessionData?.donneesOrs && (editingSessionData?.status !== 'planned' && editingSessionData?.status !== 'ready');
  
    switch (activeTab) {
      case 'details':
        return (
          <Card title="Informations générales" className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Nom de la session"
                placeholder="Ex: Formation CACES R489 - Groupe A"
                value={sessionName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSessionName(e.target.value)}
                required
                disabled={isReadOnly}
              />
              <Input
                label="Date de la session"
                type="date"
                value={sessionDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSessionDate(e.target.value)}
                required
                disabled={isReadOnly}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <Select
                label="Référentiel CACES"
                options={referentialOptionsFromData}
                value={selectedReferential}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  const newSelectedCode = e.target.value as CACESReferential | '';
                  setSelectedReferential(newSelectedCode);
                  if (newSelectedCode) {
                    const refObj = referentielsData.find(r => r.code === newSelectedCode);
                    setSelectedReferentialId(refObj?.id || null);
                  } else {
                    setSelectedReferentialId(null);
                  }
                }}
                placeholder="Sélectionner un référentiel"
                required
                disabled={!!editingSessionData?.questionMappings || isReadOnly}
              />
              <Select
                label="Formateur"
                options={trainersList.map((t: Trainer) => ({ value: t.id?.toString() || '', label: t.name }))}
                value={selectedTrainerId?.toString() || ''}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedTrainerId(e.target.value ? parseInt(e.target.value, 10) : null)}
                placeholder="Sélectionner un formateur"
                disabled={isReadOnly}
              />
              {/* Le Select "Kit de Boîtiers" est déplacé vers l'onglet Participants */}
            </div>
            <div className="mt-4">
              <Input
                label="Lieu de formation"
                placeholder="Ex: Centre de formation Paris Nord"
                value={location}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocation(e.target.value)}
                disabled={isReadOnly}
              />
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                rows={3}
                className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="Informations complémentaires..."
                value={notes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                readOnly={isReadOnly}
              />
            </div>
            {currentSessionDbId && displayedBlockDetails.length > 0 && (
              <div className="mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50 mb-6">
                <h4 className="text-md font-semibold text-gray-700 mb-2">Blocs thématiques sélectionnés:</h4>
                <ul className="list-disc list-inside pl-2 space-y-1">
                  {displayedBlockDetails.map((detail, index) => (
                    <li key={index} className="text-sm text-gray-600">
                      <span className="font-medium">{detail.themeName}:</span> Bloc {detail.blocName}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        );
      case 'participants':
        return (
          <Card title="Participants" className="mb-6">
            {/* Champ Kit de Boîtiers déplacé ici */}
            <div className="mb-6 pb-4 border-b border-gray-200">
              <Select
                label="Kit de Boîtiers Actif pour cette Session *"
                options={deviceKitsList.map(kit => ({ value: kit.id!.toString(), label: kit.name }))}
                value={selectedKitIdState?.toString() || ''}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  const newKitIdValue = e.target.value;
                  const newKitId = newKitIdValue ? parseInt(newKitIdValue, 10) : null;

                  if (newKitId !== selectedKitIdState) {
                    if (participants.length > 0) {
                      if (window.confirm("Changer de kit réinitialisera les assignations de boîtiers pour tous les participants de cette session et videra la liste des participants actuels. Voulez-vous continuer ?")) {
                        setParticipants([]); // Vider les participants car les assignations de boîtiers ne sont plus valides
                        setSelectedKitIdState(newKitId);
                        if (editingSessionData?.donneesOrs && editingSessionData.status !== 'completed') {
                          setModifiedAfterOrsGeneration(true);
                        }
                      } else {
                        e.target.value = selectedKitIdState?.toString() || '';
                        return;
                      }
                    } else {
                      setSelectedKitIdState(newKitId);
                      if (editingSessionData?.donneesOrs && editingSessionData.status !== 'completed') {
                        setModifiedAfterOrsGeneration(true);
                      }
                    }
                  }
                }}
                placeholder="Sélectionner un kit de boîtiers"
                disabled={isReadOnly || isLoadingKits}
                required
              />
               {!selectedKitIdState && !isReadOnly && (
                <p className="mt-1 text-xs text-red-600">La sélection d'un kit est requise pour ajouter des participants.</p>
              )}
               {selectedKitIdState && votingDevicesInSelectedKit.length === 0 && !isReadOnly && (
                 <p className="mt-1 text-xs text-yellow-600">Le kit sélectionné ne contient aucun boîtier. Ajoutez des boîtiers au kit dans les paramètres.</p>
               )}
            </div>

            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-gray-500">Gérez la liste des participants.</p>
              <div className="flex space-x-3">
                 <input
                  type="file"
                  id="participant-file-input"
                  className="hidden"
                  accept=".csv, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={handleParticipantFileSelect}
                />
                <Button
                  variant="outline"
                  icon={<FileUp size={16} />}
                  disabled={isOrsGeneratedAndNotEditable || isReadOnly}
                  onClick={() => document.getElementById('participant-file-input')?.click()}
                  title={isOrsGeneratedAndNotEditable ? "Modifications bloquées car l'ORS est généré et la session n'est plus en attente." : "Importer une liste de participants"}
                >
                  Importer Participants
                </Button>
                <Button
                  variant="outline"
                  icon={<UserPlus size={16} />}
                  onClick={handleAddParticipant}
                  disabled={isOrsGeneratedAndNotEditable || isReadOnly || !selectedKitIdState} // Désactiver si aucun kit sélectionné
                  title={!selectedKitIdState ? "Sélectionnez d'abord un kit" : isOrsGeneratedAndNotEditable ? "Modifications bloquées" : "Ajouter un participant"}
                />
              </div>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Boîtier Assigné (Nom et S/N)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prénom</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organisation</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code Ident.</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Réussite</th>
                    <th className="relative px-4 py-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {participants.map((participant, index) => {
                    const assignedDevice = votingDevicesInSelectedKit.find(d => d.id === participant.assignedGlobalDeviceId);
                    return (
                      <tr key={participant.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{participant.deviceId || index + 1}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                          {assignedDevice
                            ? `${assignedDevice.name} (S/N: ${assignedDevice.serialNumber})`
                            : <span className="text-xs text-red-500 italic">Non assigné / Kit changé</span>
                          }
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="text"
                            value={participant.firstName}
                            onChange={(e) => handleParticipantChange(participant.id, 'firstName', e.target.value)}
                            className="mt-1 block w-full sm:text-sm"
                            disabled={isOrsGeneratedAndNotEditable || isReadOnly}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="text"
                            value={participant.lastName}
                            onChange={(e) => handleParticipantChange(participant.id, 'lastName', e.target.value)}
                            className="mt-1 block w-full sm:text-sm"
                            disabled={isOrsGeneratedAndNotEditable || isReadOnly}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="text"
                            value={participant.organization || ''}
                            onChange={(e) => handleParticipantChange(participant.id, 'organization', e.target.value)}
                            className="mt-1 block w-full sm:text-sm"
                            disabled={isOrsGeneratedAndNotEditable || isReadOnly}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="text"
                            value={participant.identificationCode || ''}
                            onChange={(e) => handleParticipantChange(participant.id, 'identificationCode', e.target.value)}
                            className="mt-1 block w-full sm:text-sm"
                            disabled={isOrsGeneratedAndNotEditable || isReadOnly}
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                          {participant.score !== undefined ? `${participant.score}%` : 'N/A'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                          {participant.reussite === undefined ? <Badge variant="default">N/A</Badge> :
                           participant.reussite ? <Badge variant="success">Réussi</Badge> : <Badge variant="danger">Échoué</Badge>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveParticipant(participant.id)}
                            disabled={isOrsGeneratedAndNotEditable || isReadOnly}
                            title="Supprimer participant"
                          >
                            <Trash2 size={16} className="text-red-500 hover:text-red-700" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {participants.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-center py-10 text-sm text-gray-500 italic">
                        Aucun participant ajouté à cette session.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {participants.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Attribution boîtiers :</strong> Lors de l'ajout d'un participant, le prochain boîtier disponible du kit sélectionné est automatiquement assigné.
                  Vérifiez les assignations. Les participants sans boîtier valide ou avec des boîtiers dupliqués empêcheront la génération de l'ORS.
                </p>
              </div>
            )}
          </Card>
        );
      case 'resultsOrs':
        return (
          <>
            {currentSessionDbId && (
          <Card title="Résultats de la Session (Import)" className="mb-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="resultsFileInput" className="block text-sm font-medium text-gray-700 mb-1">Fichier résultats (.zip contenant ORSession.xml)</label>
              <Input
                id="resultsFileInput"
                type="file"
                accept=".ors"
                onChange={handleResultsFileSelect}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                disabled={!editingSessionData?.donneesOrs || isReadOnly}
              />
              {resultsFile && <p className="mt-1 text-xs text-green-600">Fichier: {resultsFile.name}</p>}
            </div>
            <Button
              variant="secondary"
              icon={<FileUp size={16} />}
              onClick={handleImportResults}
              disabled={!resultsFile || !editingSessionData?.questionMappings || isReadOnly || !editingSessionData?.donneesOrs}
            >
              Importer les Résultats
            </Button>
            {!editingSessionData?.donneesOrs && !isReadOnly && (
               <p className="text-sm text-yellow-700 bg-yellow-100 p-2 rounded-md">Générez d'abord le .ors pour cette session avant d'importer les résultats.</p>
            )}
            {isReadOnly && (
                 <p className="text-sm text-yellow-700 bg-yellow-100 p-2 rounded-md">Résultats déjà importés (session terminée).</p>
            )}
            <p className="text-xs text-gray-500">Importez le fichier .zip contenant ORSession.xml après le vote.</p>
            {importSummary && (
              <div className={`mt-4 p-3 rounded-md text-sm ${importSummary.toLowerCase().includes("erreur") || importSummary.toLowerCase().includes("échoué") || importSummary.toLowerCase().includes("impossible") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                <p style={{ whiteSpace: 'pre-wrap' }}>{importSummary}</p>
              </div>
            )}
          </div>
        </Card>
            )}
               <Card title="Génération .ORS & PPTX" className="mb-6">
                <Button
                    variant="primary"
                    icon={<PackagePlus size={16} />}
                    onClick={handleGenerateQuestionnaireAndOrs}
                    disabled={isGeneratingOrs || isReadOnly || (!selectedReferential && !currentSessionDbId && !editingSessionData?.referentielId)}
                    title={(!selectedReferential && !currentSessionDbId && !editingSessionData?.referentielId) ? "Veuillez d'abord sélectionner un référentiel" :
                           isReadOnly ? "La session est terminée, regénération bloquée." :
                           (!!editingSessionData?.donneesOrs) ? "Régénérer .ors & PPTX (Attention : ceci écrasera l'ORS existant)" :
                           "Générer .ors & PPTX"}
                  >
                    {isGeneratingOrs ? "Génération..." : (editingSessionData?.donneesOrs ? "Régénérer .ors & PPTX" : "Générer .ors & PPTX")}
                  </Button>
                  {isReadOnly && (
                     <p className="mt-2 text-sm text-yellow-700">La session est terminée, la génération/régénération de l'ORS est bloquée.</p>
                  )}
                   {(!selectedReferential && !currentSessionDbId && !editingSessionData?.referentielId) && !isReadOnly && (
                     <p className="mt-2 text-sm text-yellow-700">Veuillez sélectionner un référentiel pour activer la génération.</p>
                  )}
                  {modifiedAfterOrsGeneration && !!editingSessionData?.donneesOrs && !isReadOnly && (
                    <p className="mt-3 text-sm text-orange-600 bg-orange-100 p-3 rounded-md flex items-center">
                      <AlertTriangle size={18} className="mr-2 flex-shrink-0" />
                      <span>
                        <strong className="font-semibold">Attention :</strong> Les informations des participants ont été modifiées après la dernière génération de l'ORS.
                        Veuillez regénérer le fichier .ors et PPTX pour inclure ces changements.
                      </span>
                    </p>
                  )}
             </Card>
          </>
        );
      default:
        return null;
    }
  };
 
  return (
    <div>
      {renderTabNavigation()}
      {renderTabContent()}
      <div className="flex justify-end items-center mt-8 py-4 border-t border-gray-200">
        <Button variant="outline" icon={<Save size={16} />} onClick={handleSaveDraft} disabled={editingSessionData?.status === 'completed' || isGeneratingOrs}>
          Enregistrer Brouillon
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
