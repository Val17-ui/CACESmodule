import React, { useState, useEffect, useCallback } from 'react';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { Save, FileUp, UserPlus, Trash2, PackagePlus, AlertTriangle } from 'lucide-react';
import {
  CACESReferential,
  referentials,
  Session as DBSession,
  Participant as DBParticipantType,
  SessionResult,
  Trainer,
  SessionQuestion,
  SessionBoitier
} from '../../types';
import { StorageManager } from '../../services/StorageManager';
import {
  QuestionWithId as StoredQuestion,
  addSession,
  updateSession,
  getSessionById,
  addBulkSessionResults,
  getResultsForSession,
  getQuestionsByIds,
  getAllVotingDevices,
  VotingDevice,
  getGlobalPptxTemplate,
  getAdminSetting,
  getAllTrainers,
  getDefaultTrainer,
  addBulkSessionQuestions,
  deleteSessionQuestionsBySessionId,
  addBulkSessionBoitiers,
  deleteSessionBoitiersBySessionId,
  getSessionQuestionsBySessionId, // Importation ajoutée
  getSessionBoitiersBySessionId // Importation ajoutée
} from '../../db';
import { generatePresentation, AdminPPTXSettings, QuestionMapping } from '../../utils/pptxOrchestrator'; // Added QuestionMapping
import { parseOmbeaResultsXml, ExtractedResultFromXml, transformParsedResponsesToSessionResults } from '../../utils/resultsParser';
import { calculateParticipantScore, calculateThemeScores, determineIndividualSuccess } from '../../utils/reportCalculators';
import { logger } from '../../utils/logger'; // Importer le logger
import JSZip from 'jszip';
import * as XLSX from 'xlsx';

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
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [participants, setParticipants] = useState<FormParticipant[]>([]);
  const [selectedBlocksSummary, setSelectedBlocksSummary] = useState<Record<string, string>>({});
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

  // États pour la résolution des anomalies d'importation
  const [detectedAnomalies, setDetectedAnomalies] = useState<{
    muets: Array<{ serialNumber: string; visualId: number; participantName: string; responses: ExtractedResultFromXml[] }>;
    inconnus: Array<{ serialNumber: string; responses: ExtractedResultFromXml[] }>;
  } | null>(null);
  const [pendingValidResults, setPendingValidResults] = useState<ExtractedResultFromXml[]>([]);
  const [showAnomalyResolutionUI, setShowAnomalyResolutionUI] = useState<boolean>(false);

  useEffect(() => {
    const fetchInitialData = async () => {
      const devicesFromDb = await getAllVotingDevices();
      setHardwareDevices(devicesFromDb.sort((a, b) => (a.id ?? 0) - (b.id ?? 0)));
      setHardwareLoaded(true);

      const allTrainers = await getAllTrainers();
      setTrainersList(allTrainers.sort((a,b) => a.name.localeCompare(b.name)));

      if (!sessionIdToLoad) {
        const defaultTrainer = await getDefaultTrainer();
        if (defaultTrainer && defaultTrainer.id) {
          setSelectedTrainerId(defaultTrainer.id);
        } else if (allTrainers.length > 0 && allTrainers[0].id) {
          setSelectedTrainerId(allTrainers[0].id);
        }
      }
    };
    fetchInitialData();
  }, [sessionIdToLoad]);

  const resetFormTactic = useCallback(() => {
    setCurrentSessionDbId(null);
    setSessionName('');
    setSessionDate('');
    setSelectedReferential('');
    setLocation('');
    setNotes('');
    setParticipants([]);
    setSelectedBlocksSummary({});
    setResultsFile(null);
    setImportSummary(null);
    setEditingSessionData(null);
    setActiveTab('details');
    setModifiedAfterOrsGeneration(false);
  }, []);

  useEffect(() => {
    if (sessionIdToLoad && hardwareLoaded && trainersList.length >= 0) {
      const loadSession = async () => {
        const sessionData = await getSessionById(sessionIdToLoad);
        setEditingSessionData(sessionData || null);
        if (sessionData) {
          setCurrentSessionDbId(sessionData.id ?? null);
          setSessionName(sessionData.nomSession);
          setSessionDate(sessionData.dateSession ? sessionData.dateSession.split('T')[0] : '');
          setSelectedReferential((sessionData.referentiel as CACESReferential) || '');
          setLocation(sessionData.location || '');
          setNotes(sessionData.notes || '');
          setSelectedTrainerId(sessionData.trainerId || null);
          setModifiedAfterOrsGeneration(false);
          const formParticipants: FormParticipant[] = sessionData.participants.map((p_db, loopIndex) => {
            // p_db est de type Participant from types/index.ts,
            // il a donc p_db.assignedGlobalDeviceId et n'a plus p_db.idBoitier.
            // hardwareDevices contient maintenant des VotingDevice {id, name, serialNumber}

            // Le deviceId visuel est maintenant juste l'ordre dans la liste.
            const visualDeviceId = loopIndex + 1;

            // Le p_db.id (UI id) doit être unique, on peut utiliser l'index et la date.
            // Attention: p_db n'a plus idBoitier, donc la clé d'unicité change.
            // Si p_db a déjà un ID unique venant de la DB (pas le cas pour Participant dans un array Session), on l'utiliserait.
            // Pour l'instant, on génère un ID pour le formulaire.
            const formParticipantId = `loaded-${loopIndex}-${Date.now()}`;

            return {
              ...p_db, // Contient nom, prenom, assignedGlobalDeviceId, etc.
              id: formParticipantId,
              firstName: p_db.prenom,
              lastName: p_db.nom,
              deviceId: visualDeviceId, // Le numéro visuel (1, 2, 3...)
              // assignedGlobalDeviceId est déjà dans p_db
              organization: (p_db as any).organization || '', // Conserver si pertinent
              hasSigned: (p_db as any).hasSigned || false,    // Conserver si pertinent
            };
          });
          setParticipants(formParticipants);
          const summary: Record<string, string> = {};
          if(sessionData.selectionBlocs){
            sessionData.selectionBlocs.forEach(sb => { summary[sb.theme] = sb.blockId; });
          }
          setSelectedBlocksSummary(summary);
        } else {
          console.warn(`Session avec ID ${sessionIdToLoad} non trouvée.`);
          resetFormTactic();
        }
      };
      loadSession();
    } else if (!sessionIdToLoad) {
      resetFormTactic();
    }
  }, [sessionIdToLoad, hardwareLoaded, hardwareDevices, resetFormTactic, trainersList]);

  const referentialOptions = Object.entries(referentials).map(([value, label]) => ({
    value,
    label: `${value} - ${label}`,
  }));

  const handleAddParticipant = () => {
    if (editingSessionData?.donneesOrs && editingSessionData.status !== 'completed') { setModifiedAfterOrsGeneration(true); }

    const existingDeviceIds = participants
      .map(p => p.deviceId)
      .filter(id => id !== null) as number[];
    existingDeviceIds.sort((a, b) => a - b);

    let nextDeviceId = 1;
    for (const id of existingDeviceIds) {
      if (id === nextDeviceId) {
        nextDeviceId++;
      } else if (id > nextDeviceId) {
        break;
      }
    }

    const newParticipant: FormParticipant = {
      // ...p_db spread from DBParticipantType will implicitly carry assignedGlobalDeviceId if it's optional
      // Explicitly ensure all fields from DBParticipantType are covered or intentionally omitted.
      // DBParticipantType now has: nom, prenom, identificationCode?, score?, reussite?, assignedGlobalDeviceId?
      nom: '',
      prenom: '',
      identificationCode: '',
      score: undefined,
      reussite: undefined,
      // Auto-assign GlobalDevice based on visual deviceId order
      assignedGlobalDeviceId: (hardwareDevices[nextDeviceId - 1]) ? hardwareDevices[nextDeviceId - 1].id! : null,

      // FormParticipant specific fields
      id: Date.now().toString(),
      firstName: '',
      lastName: '',
      organization: '',
      deviceId: nextDeviceId, // Visual/logical ID
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
    setParticipants(participants.map(p => {
      if (p.id === id) {
        const updatedP = { ...p, [field]: value };
        if (field === 'firstName') updatedP.prenom = value as string;
        if (field === 'lastName') updatedP.nom = value as string;
        return updatedP;
      }
      return p;
    }));
  };

  // --- Début Logique Import Participants ---
  const parseCsvParticipants = (fileContent: string): Omit<FormParticipant, 'id' | 'deviceId' | 'idBoitier' | 'score' | 'reussite' | 'hasSigned'>[] => {
    const newParticipantsCsv: Omit<FormParticipant, 'id' | 'deviceId' | 'idBoitier' | 'score' | 'reussite' | 'hasSigned'>[] = [];
    const lines = fileContent.split(/\r\n|\n/);
    lines.forEach(line => {
      if (line.trim() === '') return;
      const values = line.split(',');
      if (values.length >= 2) {
        newParticipantsCsv.push({
          firstName: values[0]?.trim() || '', lastName: values[1]?.trim() || '',
          prenom: values[0]?.trim() || '', nom: values[1]?.trim() || '',
          organization: values[2]?.trim() || '', identificationCode: values[3]?.trim() || '',
        });
      }
    });
    return newParticipantsCsv;
  };

  const parseExcelParticipants = (data: Uint8Array): Omit<FormParticipant, 'id' | 'deviceId' | 'idBoitier' | 'score' | 'reussite' | 'hasSigned'>[] => {
    const newParticipantsExcel: Omit<FormParticipant, 'id' | 'deviceId' | 'idBoitier' | 'score' | 'reussite' | 'hasSigned'>[] = [];
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
    if (jsonData.length === 0) return newParticipantsExcel;
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
        const firstName = prenomIndex !== -1 ? row[prenomIndex]?.toString().trim() || '' : row[0]?.toString().trim() || '';
        const lastName = nomIndex !== -1 ? row[nomIndex]?.toString().trim() || '' : row[1]?.toString().trim() || '';
        if (firstName || lastName) {
            newParticipantsExcel.push({
            firstName, lastName, prenom: firstName, nom: lastName,
            organization: orgIndex !== -1 ? row[orgIndex]?.toString().trim() || '' : row[2]?.toString().trim() || '',
            identificationCode: codeIndex !== -1 ? row[codeIndex]?.toString().trim() || '' : row[3]?.toString().trim() || '',
            });
        }
      }
    }
    return newParticipantsExcel;
  };

  const addImportedParticipants = (
    parsedData: Omit<FormParticipant, 'id' | 'deviceId' | 'idBoitier' | 'score' | 'reussite' | 'hasSigned'>[],
    fileName: string
  ) => {
    if (editingSessionData?.donneesOrs && editingSessionData.status !== 'completed') { setModifiedAfterOrsGeneration(true); }
    if (parsedData.length > 0) {
      const newFormParticipants = parsedData.map((p, index) => ({
        ...p, id: `imported-${Date.now()}-${index}`, deviceId: null,
        idBoitier: '', score: undefined, reussite: undefined, hasSigned: false,
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
      let parsedData: Omit<FormParticipant, 'id' | 'deviceId' | 'idBoitier' | 'score' | 'reussite' | 'hasSigned'>[] = [];
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
  // --- Fin Logique Import Participants ---

  const prepareSessionDataForDb = async (includeOrsBlob?: Blob | null): Promise<DBSession | null> => {
    const dbParticipants: DBParticipantType[] = participants.map((p_form) => {
      // p_form est FormParticipant. Il a p_form.assignedGlobalDeviceId.
      // DBParticipantType (Participant from types/index.ts) a aussi assignedGlobalDeviceId.
      // L'ancien idBoitier (serialNumber) n'est plus stocké directement sur le participant en DB.
      // Le serialNumber sera récupéré via assignedGlobalDeviceId au moment de la génération de l'ORS.

      // Les champs à copier directement de FormParticipant vers DBParticipantType
      // (ceux définis dans DBParticipantType)
      return {
        nom: p_form.lastName, // ou p_form.nom si FormParticipant a été aligné
        prenom: p_form.firstName, // ou p_form.prenom
        identificationCode: p_form.identificationCode,
        score: p_form.score,
        reussite: p_form.reussite,
        assignedGlobalDeviceId: p_form.assignedGlobalDeviceId, // C'est le champ clé ici
      };
    });
    const sessionToUpdate = editingSessionData;
    const sessionToSave: DBSession = {
      id: currentSessionDbId || undefined,
      nomSession: sessionName || `Session du ${new Date().toLocaleDateString()}`,
      dateSession: sessionDate || new Date().toISOString().split('T')[0],
      referentiel: selectedReferential || sessionToUpdate?.referentiel || '',
      participants: dbParticipants,
      selectionBlocs: Object.entries(selectedBlocksSummary).map(([theme, blockId]) => ({ theme, blockId })),
      donneesOrs: includeOrsBlob !== undefined ? includeOrsBlob : sessionToUpdate?.donneesOrs,
      location: location, status: sessionToUpdate?.status || 'planned',
      questionMappings: sessionToUpdate?.questionMappings, notes: notes,
      trainerId: selectedTrainerId ?? undefined,
      createdAt: sessionToUpdate?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return sessionToSave;
  };

  const handleSaveSession = async (sessionData: DBSession | null) => {
    if (!sessionData) return null;
    try {
      let savedId: number | undefined;
      if (sessionData.id) {
        await updateSession(sessionData.id, sessionData); savedId = sessionData.id;
      } else {
        const newId = await addSession(sessionData);
        if (newId) { setCurrentSessionDbId(newId); savedId = newId; }
        else { setImportSummary("Erreur critique : La nouvelle session n'a pas pu être créée."); return null; }
      }
      if (savedId) {
         const reloadedSession = await getSessionById(savedId);
         setEditingSessionData(reloadedSession || null);
         if (reloadedSession) {
            setModifiedAfterOrsGeneration(false);
            const formParticipants: FormParticipant[] = reloadedSession.participants.map((p_db, index) => {
              // p_db est de type Participant from types/index.ts et a p_db.assignedGlobalDeviceId
              // L'ancien idBoitier n'existe plus.
              // participants[index] est l'état précédent du FormParticipant.

              const visualDeviceId = index + 1; // Le deviceId visuel basé sur l'ordre

              return {
                ...p_db, // Contient nom, prenom, assignedGlobalDeviceId, etc.
                id: participants[index]?.id || `form-reloaded-${index}-${Date.now()}`, // Conserve l'ID de formulaire existant si possible
                firstName: p_db.prenom,
                lastName: p_db.nom,
                deviceId: visualDeviceId, // Numéro visuel (1, 2, 3...)
                // assignedGlobalDeviceId est déjà dans p_db
                organization: participants[index]?.organization || (p_db as any).organization || '',
                hasSigned: participants[index]?.hasSigned || (p_db as any).hasSigned || false,
              };
            });
            setParticipants(formParticipants);
            const summary: Record<string, string> = {};
            if(reloadedSession.selectionBlocs){
                reloadedSession.selectionBlocs.forEach(sb => { summary[sb.theme] = sb.blockId; });
            }
            setSelectedBlocksSummary(summary);
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
    const refToUse = selectedReferential || editingSessionData?.referentiel;
    if (!refToUse) {
      setImportSummary("Veuillez sélectionner un référentiel pour générer l'ORS.");
      return;
    }
    setIsGeneratingOrs(true);
    setImportSummary("Préparation des données et vérification des boîtiers...");

    let sessionDataForDb = await prepareSessionDataForDb(editingSessionData?.donneesOrs);
    if (!sessionDataForDb) { setImportSummary("Erreur préparation données session pour vérification."); setIsGeneratingOrs(false); return; }

    const currentSavedId = await handleSaveSession(sessionDataForDb);
    if (!currentSavedId) {
        setImportSummary("Erreur lors de la sauvegarde de la session avant génération ORS.");
        setIsGeneratingOrs(false); return;
    }
    const upToDateSessionData = await getSessionById(currentSavedId);
    if (!upToDateSessionData) { setImportSummary("Erreur rechargement session après sauvegarde."); setIsGeneratingOrs(false); return; }

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

    setImportSummary("Vérification du modèle PPTX global...");
    const globalPptxTemplate = await getGlobalPptxTemplate();
    if (!globalPptxTemplate) {
      setImportSummary("Aucun modèle PPTX global n'est configuré.");
      setIsGeneratingOrs(false); return;
    }
    setImportSummary("Génération .ors...");
    let allSelectedQuestionsForPptx: StoredQuestion[] = [];
    let tempSelectedBlocksSummary: Record<string, string> = {};
    try {
      const baseThemes = await StorageManager.getAllBaseThemesForReferential(refToUse as CACESReferential);
      if (baseThemes.length === 0) { setImportSummary(`Aucun thème pour ${refToUse}.`); setIsGeneratingOrs(false); return; }
      for (const baseTheme of baseThemes) {
        const blockIdentifiers = await StorageManager.getAllBlockIdentifiersForTheme(refToUse as CACESReferential, baseTheme);
        if (blockIdentifiers.length === 0) { console.warn(`Aucun bloc pour ${baseTheme}`); continue; }
        const chosenBlockIdentifier = blockIdentifiers[Math.floor(Math.random() * blockIdentifiers.length)];
        tempSelectedBlocksSummary[baseTheme] = chosenBlockIdentifier;
        const questionsFromBlock = await StorageManager.getQuestionsForBlock(refToUse as CACESReferential, baseTheme, chosenBlockIdentifier);
        allSelectedQuestionsForPptx = allSelectedQuestionsForPptx.concat(questionsFromBlock);
      }

      if (allSelectedQuestionsForPptx.length === 0) { setImportSummary("Aucune question sélectionnée."); setIsGeneratingOrs(false); return; }

      upToDateSessionData.selectionBlocs = Object.entries(tempSelectedBlocksSummary).map(([theme, blockId]) => ({ theme, blockId }));

      const sessionInfoForPptx = { name: upToDateSessionData.nomSession, date: upToDateSessionData.dateSession, referential: upToDateSessionData.referentiel as CACESReferential };
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

      const participantsForGenerator = upToDateSessionData.participants.map(p_db => {
        const assignedDevice = hardwareDevices.find(hd => hd.id === p_db.assignedGlobalDeviceId);
        return {
          // idBoitier pour generatePresentation doit être le serialNumber
          idBoitier: assignedDevice ? assignedDevice.serialNumber : '',
          nom: p_db.nom,
          prenom: p_db.prenom,
          identificationCode: p_db.identificationCode,
          // score et reussite ne sont pas nécessaires pour la génération ORS ici,
          // mais DBParticipantType les a comme optionnels.
          // On s'assure que ce qu'on passe à generatePresentation est conforme à ce qu'il attend.
          // Si generatePresentation s'attend à DBParticipantType, alors on peut passer p_db directement
          // après avoir modifié idBoitier.
          // Pour l'instant, on construit un objet avec les champs attendus par generatePresentation.
        };
      });

      // Vérification supplémentaire au cas où un device aurait été supprimé entre temps (improbable mais sécuritaire)
      const stillMissingSerial = participantsForGenerator.find(p => !p.idBoitier);
      if (stillMissingSerial) {
          setImportSummary(`Erreur critique: Impossible de trouver le numéro de série pour ${stillMissingSerial.prenom} ${stillMissingSerial.nom} bien qu'un ID global ait été assigné. Vérifiez la configuration des boîtiers.`);
          setIsGeneratingOrs(false); return;
      }

      console.log('[SessionForm Gen .ors] Participants sent to generatePresentation:', participantsForGenerator);
      // Assumons que generatePresentation attend un type compatible avec {idBoitier: string, nom: string, prenom: string, ...}
      const generationOutput = await generatePresentation(sessionInfoForPptx, participantsForGenerator as DBParticipantType[], allSelectedQuestionsForPptx, globalPptxTemplate, adminSettings);
      if (generationOutput && generationOutput.orsBlob && generationOutput.questionMappings && upToDateSessionData) {
        const { orsBlob, questionMappings } = generationOutput;
        try {
          // 1. Mettre à jour la session principale avec l'ORS et les mappings
          await updateSession(currentSavedId, {
            donneesOrs: orsBlob,
            questionMappings: questionMappings,
            updatedAt: new Date().toISOString(),
            status: 'ready',
            selectionBlocs: upToDateSessionData.selectionBlocs,
            // testSlideGuid sera mis à jour ci-dessous si applicable
          });

          // Recharger les données de session pour avoir la version la plus à jour
          const freshlyUpdatedSessionData = await getSessionById(currentSavedId);
          if (!freshlyUpdatedSessionData) {
            throw new Error("Impossible de recharger la session après la mise à jour avec l'ORS.");
          }
          setEditingSessionData(freshlyUpdatedSessionData);

          // 2. Nettoyer les anciennes métadonnées pour cette session
          await deleteSessionQuestionsBySessionId(currentSavedId);
          await deleteSessionBoitiersBySessionId(currentSavedId);

          // 3. Stocker les SessionQuestions
          const sessionQuestionsToSave: SessionQuestion[] = [];
          for (const qMap of questionMappings) {
            if (qMap.slideGuid && qMap.dbQuestionId !== undefined) {
              const originalQuestion = allSelectedQuestionsForPptx.find(q => q.id === qMap.dbQuestionId);
              if (originalQuestion) {
                // Déterminer blockId
                let blockId = 'N/A';
                const questionThemeParts = originalQuestion.theme.split('_');
                const baseTheme = questionThemeParts[0];
                const selectedBlock = freshlyUpdatedSessionData.selectionBlocs?.find(sb => sb.theme === baseTheme);
                if (selectedBlock) {
                  blockId = selectedBlock.blockId;
                } else if (questionThemeParts.length > 1) {
                  // Fallback si selectionBlocs n'est pas parfaitement aligné, mais que le theme de la question a un blockId
                  blockId = questionThemeParts[1];
                }

                sessionQuestionsToSave.push({
                  sessionId: currentSavedId,
                  dbQuestionId: originalQuestion.id!,
                  slideGuid: qMap.slideGuid,
                  text: originalQuestion.text,
                  options: originalQuestion.options,
                  correctAnswer: originalQuestion.correctAnswer,
                  blockId: blockId,
                });
              }
            }
          }
          if (sessionQuestionsToSave.length > 0) {
            await addBulkSessionQuestions(sessionQuestionsToSave);
          }

          // 4. Stocker les SessionBoitiers
          const sessionBoitiersToSave: SessionBoitier[] = [];
          freshlyUpdatedSessionData.participants.forEach((p_db, p_idx) => {
            const assignedDevice = hardwareDevices.find(hd => hd.id === p_db.assignedGlobalDeviceId);
            if (assignedDevice) {
              // Trouver le visualId (deviceId du FormParticipant)
              // On fait correspondre le participant de la DB (p_db) avec celui du formulaire (participants)
              // via assignedGlobalDeviceId car c'est l'identifiant le plus stable.
              const formP = participants.find(fp => fp.assignedGlobalDeviceId === p_db.assignedGlobalDeviceId);
              const visualId = formP?.deviceId ?? (p_idx + 1); // Fallback à l'index + 1 si non trouvé

              sessionBoitiersToSave.push({
                sessionId: currentSavedId,
                participantId: `P${p_idx + 1}`, // Utilisation de l'index comme ID simple pour le moment
                visualId: visualId,
                serialNumber: assignedDevice.serialNumber,
                participantName: `${p_db.prenom} ${p_db.nom}`,
              });
            }
          });
          if (sessionBoitiersToSave.length > 0) {
            await addBulkSessionBoitiers(sessionBoitiersToSave);
          }

          // 5. Gérer testSlideGuid (logique d'identification à définir)
          // TODO: Implémenter la logique pour identifier la question test et son dbQuestionId
          const testQuestionDbId: number | null = null; // Mettre l'ID de la question test ici
          if (testQuestionDbId) {
            const testMapping = questionMappings.find(qm => qm.dbQuestionId === testQuestionDbId);
            if (testMapping && testMapping.slideGuid) {
              await updateSession(currentSavedId, { testSlideGuid: testMapping.slideGuid });
              // Re-mettre à jour editingSessionData si nécessaire
              setEditingSessionData(await getSessionById(currentSavedId) || null);
            }
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
          logger.error(`Erreur lors de la sauvegarde .ors/mappings/métadonnées pour la session "${upToDateSessionData.nomSession}"`, { eventType: 'ORS_METADATA_SAVE_ERROR', sessionId: currentSavedId, error: e });
        }
      } else {
        setImportSummary("Erreur génération .ors/mappings ou données de session manquantes.");
        console.error("Erreur génération .ors/mappings. Output:", generationOutput);
        logger.error(`Erreur lors de la génération .ors/mappings pour la session "${upToDateSessionData.nomSession}"`, { eventType: 'ORS_GENERATION_ERROR', sessionId: currentSavedId, output: generationOutput });
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

      // 2.2. Filtrer la "question test"
      const testSlideGuid = editingSessionData.testSlideGuid;
      if (testSlideGuid) {
        const countBeforeFilteringTest = extractedResultsFromXml.length;
        extractedResultsFromXml = extractedResultsFromXml.filter(
          (result) => result.questionSlideGuid !== testSlideGuid
        );
        const countAfterFilteringTest = extractedResultsFromXml.length;
        if (countBeforeFilteringTest > countAfterFilteringTest) {
          logger.info(`[Import Results] ${countBeforeFilteringTest - countAfterFilteringTest} réponses à la question test (GUID: ${testSlideGuid}) ont été filtrées.`);
        }
      }

      // 2.3. Grouper les réponses par (serialNumber, slideGuid) et ne retenir que la dernière (timestamp le plus élevé)
      const latestResultsMap = new Map<string, ExtractedResultFromXml>();
      for (const result of extractedResultsFromXml) {
        const key = `${result.participantDeviceID}-${result.questionSlideGuid}`;
        const existingResult = latestResultsMap.get(key);

        if (!existingResult) {
          latestResultsMap.set(key, result);
        } else {
          // Si les timestamps sont disponibles, comparer. Sinon, la dernière vue écrase (ce qui est le comportement si OMBEA ne donne que la dernière)
          // Pour une comparaison de timestamp plus robuste, s'assurer qu'ils sont dans un format comparable (ex: ISO string ou objets Date)
          if (result.timestamp && existingResult.timestamp) {
            if (new Date(result.timestamp) > new Date(existingResult.timestamp)) {
              latestResultsMap.set(key, result);
            }
          } else if (result.timestamp && !existingResult.timestamp) { // La nouvelle a un timestamp, l'ancienne non
            latestResultsMap.set(key, result);
          }
          // Si la nouvelle n'a pas de timestamp et que l'ancienne en a un, on garde l'ancienne.
          // Si les deux n'ont pas de timestamp, la dernière vue (actuelle 'result') est implicitement ignorée si on ne fait rien,
          // ou on peut choisir de la prendre: if (!result.timestamp && !existingResult.timestamp) { latestResultsMap.set(key, result); }
          // Pour l'instant, si pas de timestamp, on garde la première rencontrée. Pour changer, ajouter une condition.
        }
      }
      const finalExtractedResults = Array.from(latestResultsMap.values());
      logger.info(`[Import Results] ${finalExtractedResults.length} réponses retenues après déduplication (conservation de la dernière réponse par timestamp).`);

      if (finalExtractedResults.length === 0) {
        setImportSummary("Aucune réponse valide à importer après filtrage et déduplication.");
        return;
      }

      // Étape 1.1: Charger les données de référence de la session
      const sessionQuestions = await getSessionQuestionsBySessionId(currentSessionDbId);
      const sessionBoitiers = await getSessionBoitiersBySessionId(currentSessionDbId);

      if (!sessionQuestions || sessionQuestions.length === 0) {
        setImportSummary("Erreur: Impossible de charger les questions de référence pour cette session. L'import ne peut continuer.");
        logger.error(`[Import Results] Impossible de charger sessionQuestions pour sessionId: ${currentSessionDbId}`);
        return;
      }
      if (!sessionBoitiers) { // sessionBoitiers peut être vide si aucun participant n'a été configuré avec boîtier.
        logger.warn(`[Import Results] Aucune information de boîtier (sessionBoitiers) trouvée pour sessionId: ${currentSessionDbId}. Les vérifications de boîtiers seront limitées.`);
        // Ne pas bloquer ici, car une session pourrait ne pas avoir de participants pré-assignés.
      }

      // Étape 3.1: Vérification des questions
      const validSlideGuids = new Set(sessionQuestions.map(sq => sq.slideGuid));
      // Note: testSlideGuid a déjà été filtré de finalExtractedResults, donc pas besoin de l'exclure ici explicitement.

      for (const result of finalExtractedResults) {
        if (!validSlideGuids.has(result.questionSlideGuid)) {
          const errorMessage = `Certains GUID de question (ex: ${result.questionSlideGuid}) dans le fichier de résultats ne correspondent pas à cette session. Vérifiez votre fichier ORS.`;
          setImportSummary(errorMessage);
          logger.error(`[Import Results - Anomaly] ${errorMessage}`, {
            importedGuid: result.questionSlideGuid,
            expectedGuids: Array.from(validSlideGuids)
          });
          return; // Arrêter le processus d'import
        }
      }
      logger.info("[Import Results] Vérification des GUID de questions terminée. Tous les GUID importés sont valides pour cette session.");

      // Étape 3.2: Correspondance des boîtiers et préparation des listes d'anomalies
      const prevusSerialNumbers = new Set(sessionBoitiers.map(b => b.serialNumber));
      // Clonage pour pouvoir modifier muetsAttendus sans affecter sessionBoitiers directement
      let muetsAttendus: { serialNumber: string; visualId: number; participantName: string; responses: ExtractedResultFromXml[] }[] = sessionBoitiers.map(b => ({
        serialNumber: b.serialNumber,
        visualId: b.visualId,
        participantName: b.participantName,
        responses: [] // Initialisé vide, pour le cas partiel plus tard
      }));

      const inconnusDetectes: { serialNumber: string, responses: ExtractedResultFromXml[] }[] = [];
      const reponsesDesAttendus: ExtractedResultFromXml[] = []; // Pour stocker les réponses des boîtiers attendus

      for (const result of finalExtractedResults) {
        const serialNumberRepondant = result.participantDeviceID;
        if (prevusSerialNumbers.has(serialNumberRepondant)) {
          // Le boîtier est attendu
          reponsesDesAttendus.push(result); // Garder cette réponse

          // Retirer de la liste des muets (s'il y est encore)
          muetsAttendus = muetsAttendus.filter(muet => muet.serialNumber !== serialNumberRepondant);

          // (Optionnel pour cas partiel - ajout de la réponse au boîtier attendu)
          // Pour cela, il faudrait modifier l'objet dans sessionBoitiers ou une copie.
          // Pour l'instant, on se contente de le retirer des muets.
          // La logique pour le cas partiel sera plus complexe et nécessitera de savoir quelles questions ont été répondues.

        } else {
          // Le boîtier est inconnu
          let inconnuEntry = inconnusDetectes.find(inc => inc.serialNumber === serialNumberRepondant);
          if (!inconnuEntry) {
            inconnuEntry = { serialNumber: serialNumberRepondant, responses: [] };
            inconnusDetectes.push(inconnuEntry);
          }
          inconnuEntry.responses.push(result);
        }
      }

      logger.info(`[Import Results] Correspondance des boîtiers terminée. ${muetsAttendus.length} boîtier(s) attendu(s) sont muets. ${inconnusDetectes.length} boîtier(s) inconnu(s) ont répondu.`);

      // À ce point, nous avons:
      // - reponsesDesAttendus: ExtractedResultFromXml[] des boîtiers prévus
      // - muetsAttendus: SessionBoitier[] (avec un champ 'responses' vide pour l'instant)
      // - inconnusDetectes: { serialNumber: string, responses: ExtractedResultFromXml[] }[]

      // Si anomalies (muets ou inconnus), on ne procède pas à la sauvegarde directe.
      // On stocke ces listes pour l'UI de résolution.
      if (muetsAttendus.length > 0 || inconnusDetectes.length > 0) {
        setImportSummary(`Anomalies détectées: ${muetsAttendus.length} boîtier(s) muet(s), ${inconnusDetectes.length} boîtier(s) inconnu(s). Résolution nécessaire.`);
        setDetectedAnomalies({ muets: muetsAttendus, inconnus: inconnusDetectes });
        setPendingValidResults(reponsesDesAttendus); // Stocker les réponses valides qui ne posent pas de problème de boîtier
        setShowAnomalyResolutionUI(true); // Déclencheur pour afficher l'UI de résolution
        logger.info("[Import Results] Des anomalies de boîtiers ont été détectées. Affichage de l'interface de résolution.");
        return;
      }

      // Si aucune anomalie de boîtier, procéder à la transformation et sauvegarde des reponsesDesAttendus
      logger.info("[Import Results] Aucune anomalie de boîtier détectée. Procédure d'import direct.");
      setImportSummary(`${reponsesDesAttendus.length} réponses valides prêtes pour transformation et import...`);

      const currentQuestionMappings = editingSessionData.questionMappings;
      if (!currentQuestionMappings || currentQuestionMappings.length === 0) {
        setImportSummary("Erreur: Mappages de questions manquants pour la session (editingSessionData.questionMappings). Impossible de lier les résultats.");
        return;
      }

      // Utiliser reponsesDesAttendus car il ne contient que les réponses des boîtiers prévus et validés jusqu'ici
      const sessionResultsToSave = transformParsedResponsesToSessionResults(
        reponsesDesAttendus,
        currentQuestionMappings,
        currentSessionDbId
      );

      if (sessionResultsToSave.length > 0) {
        try {
          // Avant d'ajouter, il pourrait être pertinent de supprimer les anciens résultats pour cette session si c'est un ré-import.
          // await deleteResultsForSession(currentSessionDbId); // A décommenter si nécessaire. Pour l'instant, on ajoute.
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
                  const sessionQuestions = await getQuestionsByIds(questionIds);
                  if (sessionQuestions.length > 0) {
                    // Créer un map pour faciliter la recherche de globalDeviceId par serialNumber
                    const deviceIdBySerialMap = new Map(hardwareDevices.map(hd => [hd.serialNumber, hd.id]));

                    const updatedParticipants = sessionDataForScores.participants.map((p_db) => {
                      // p_db a assignedGlobalDeviceId. Il faut trouver le serialNumber correspondant.
                      const matchingGlobalDevice = hardwareDevices.find(hd => hd.id === p_db.assignedGlobalDeviceId);
                      if (!matchingGlobalDevice) {
                        console.warn(`Participant ${p_db.nom} ${p_db.prenom} n'a pas de boîtier physique valide assigné pour le calcul des scores.`);
                        return { ...p_db, score: p_db.score || 0, reussite: p_db.reussite || false }; // Garder les scores existants ou initialiser
                      }
                      const participantActualSerialNumber = matchingGlobalDevice.serialNumber;

                      const participantResults = sessionResultsForScore.filter(r => r.participantIdBoitier === participantActualSerialNumber);
                      const score = calculateParticipantScore(participantResults, sessionQuestions);
                      const themeScores = calculateThemeScores(participantResults, sessionQuestions);
                      const reussite = determineIndividualSuccess(score, themeScores);
                      return { ...p_db, score, reussite };
                    });

                    await updateSession(currentSessionDbId, { participants: updatedParticipants, updatedAt: new Date().toISOString() });
                    message += "\nScores et réussite calculés et mis à jour.";
                    const finalUpdatedSession = await getSessionById(currentSessionDbId);

                    if (finalUpdatedSession) {
                      setEditingSessionData(finalUpdatedSession);
                      // Re-mapper vers FormParticipant, similaire à loadSession et handleSaveSession
                      const formParticipantsToUpdate: FormParticipant[] = finalUpdatedSession.participants.map((p_db_updated, index) => {
                        const visualDeviceId = index + 1; // Basé sur l'ordre
                        const currentFormParticipantState = participants.find(fp => fp.id.startsWith('loaded-') ?
                                                                  fp.assignedGlobalDeviceId === p_db_updated.assignedGlobalDeviceId : // Heuristique pour retrouver par ID de boitier si possible
                                                                  (fp.deviceId === visualDeviceId && fp.nom === p_db_updated.nom) // Sinon par ordre et nom
                                                                ) || participants[index]; // Fallback plus simple

                        return {
                          ...p_db_updated, // Contient nom, prenom, score, reussite, assignedGlobalDeviceId
                          id: currentFormParticipantState?.id || `updated-${index}-${Date.now()}`,
                          firstName: p_db_updated.prenom,
                          lastName: p_db_updated.nom,
                          deviceId: visualDeviceId,
                          organization: currentFormParticipantState?.organization || (p_db_updated as any).organization || '',
                          hasSigned: currentFormParticipantState?.hasSigned || (p_db_updated as any).hasSigned || false,
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
                onChange={(e) => setSessionName(e.target.value)}
                required
                disabled={isReadOnly}
              />
              <Input
                label="Date de la session"
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                required
                disabled={isReadOnly}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <Select
                label="Référentiel CACES"
                options={referentialOptions}
                value={selectedReferential}
                onChange={(e) => setSelectedReferential(e.target.value as CACESReferential | '')}
                placeholder="Sélectionner un référentiel"
                required
                disabled={!!editingSessionData?.questionMappings || isReadOnly}
              />
               <Select
                label="Formateur"
                options={trainersList.map(t => ({ value: t.id?.toString() || '', label: t.name }))}
                value={selectedTrainerId?.toString() || ''}
                onChange={(e) => setSelectedTrainerId(e.target.value ? parseInt(e.target.value, 10) : null)}
                placeholder="Sélectionner un formateur"
                disabled={isReadOnly}
              />
            </div>
            <div className="mt-4">
              <Input
                label="Lieu de formation"
                placeholder="Ex: Centre de formation Paris Nord"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
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
                onChange={(e) => setNotes(e.target.value)}
                readOnly={isReadOnly}
              />
            </div>
            {currentSessionDbId && editingSessionData?.selectionBlocs && editingSessionData.selectionBlocs.length > 0 && (
              <div className="mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50 mb-6">
                <h4 className="text-md font-semibold text-gray-700 mb-2">Blocs thématiques sélectionnés:</h4>
                <ul className="list-disc list-inside pl-2 space-y-1">
                  {editingSessionData.selectionBlocs.map((sb) => (
                    <li key={`${sb.theme}-${sb.blockId}`} className="text-sm text-gray-600">
                      <span className="font-medium">{sb.theme}:</span> Bloc {sb.blockId}
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
                  disabled={isOrsGeneratedAndNotEditable || isReadOnly}
                  title={isOrsGeneratedAndNotEditable ? "Modifications bloquées car l'ORS est généré et la session n'est plus en attente." : "Ajouter un participant"}
                />
              </div>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Numéro de boîtier</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Boîtier Assigné</th>
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
                  {participants.length === 0 ? (
                    <tr><td className="px-4 py-4 text-center text-sm text-gray-500" colSpan={9}>Aucun participant.</td></tr>
                  ) : (
                    participants.map((participant) => (
                      <tr key={participant.id}>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <Input
                            type="number"
                            value={participant.deviceId === null ? '' : participant.deviceId?.toString()}
                            onChange={(e) => handleParticipantChange(participant.id, 'deviceId', e.target.value === '' ? null : (parseInt(e.target.value,10) || null))}
                            className="mb-0 w-24 text-center"
                            placeholder="N/A"
                            disabled={isOrsGeneratedAndNotEditable || isReadOnly}
                          />
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
                          {(() => {
                            if (participant.assignedGlobalDeviceId === null || participant.assignedGlobalDeviceId === undefined) {
                              return <span className="text-gray-500">Non assigné</span>;
                            }
                            const assignedDevice = hardwareDevices.find(hd => hd.id === participant.assignedGlobalDeviceId);
                            if (assignedDevice) {
                              return assignedDevice.serialNumber; // Afficher le numéro de série
                            }
                            return <span className="text-red-500">Boîtier introuvable (ID: {participant.assignedGlobalDeviceId})</span>;
                          })()}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <Input value={participant.firstName} onChange={(e) => handleParticipantChange(participant.id, 'firstName', e.target.value)} placeholder="Prénom" className="mb-0" disabled={isReadOnly} />
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <Input value={participant.lastName} onChange={(e) => handleParticipantChange(participant.id, 'lastName', e.target.value)} placeholder="Nom" className="mb-0" disabled={isReadOnly} />
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <Input value={participant.organization || ''} onChange={(e) => handleParticipantChange(participant.id, 'organization', e.target.value)} placeholder="Organisation" className="mb-0" disabled={isReadOnly} />
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <Input value={participant.identificationCode || ''} onChange={(e) => handleParticipantChange(participant.id, 'identificationCode', e.target.value)} placeholder="Code" className="mb-0" disabled={isReadOnly} />
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700 text-center">
                          {participant.score !== undefined ? `${participant.score}%` : '-'}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-center">
                          {participant.reussite === true && <Badge variant="success">Réussi</Badge>}
                          {participant.reussite === false && <Badge variant="danger">Échec</Badge>}
                          {participant.reussite === undefined && <Badge variant="default">-</Badge>}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-medium">
                          <Button
                            variant="ghost"
                            disabled={isOrsGeneratedAndNotEditable || isReadOnly}
                            size="sm"
                            icon={<Trash2 size={16} />}
                            onClick={() => handleRemoveParticipant(participant.id)}
                            title={isOrsGeneratedAndNotEditable ? "Modifications bloquées car l'ORS est généré et la session n'est plus en attente." : "Supprimer participant"}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {participants.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Attribution boîtiers :</strong> Le numéro de boîtier est utilisé pour identifier les participants. Assurez-vous que chaque numéro est unique et correspond à un boîtier physique configuré dans les paramètres matériels.
                  Les boîtiers non assignés (N/A) ou incorrectement assignés empêcheront la génération de l'ORS.
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
                      accept=".zip"
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
                    disabled={isGeneratingOrs || isReadOnly || (!selectedReferential && !currentSessionDbId && !editingSessionData?.referentiel)}
                    title={(!selectedReferential && !currentSessionDbId && !editingSessionData?.referentiel) ? "Veuillez d'abord sélectionner un référentiel" :
                           isReadOnly ? "La session est terminée, regénération bloquée." :
                           (!!editingSessionData?.donneesOrs) ? "Régénérer .ors & PPTX (Attention : ceci écrasera l'ORS existant)" :
                           "Générer .ors & PPTX"}
                  >
                    {isGeneratingOrs ? "Génération..." : (editingSessionData?.donneesOrs ? "Régénérer .ors & PPTX" : "Générer .ors & PPTX")}
                  </Button>
                  {isReadOnly && (
                     <p className="mt-2 text-sm text-yellow-700">La session est terminée, la génération/régénération de l'ORS est bloquée.</p>
                  )}
                   {(!selectedReferential && !currentSessionDbId && !editingSessionData?.referentiel) && !isReadOnly && (
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
    </div>
  );
};

export default SessionForm;