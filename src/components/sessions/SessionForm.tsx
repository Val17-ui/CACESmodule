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
  Referential,
  Theme,
  Bloc,
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
  addBulkSessionQuestions,
  deleteSessionQuestionsBySessionId,
  addBulkSessionBoitiers,
  deleteSessionBoitiersBySessionId,
  getSessionQuestionsBySessionId, // Importation ajoutée
  getSessionBoitiersBySessionId // Importation ajoutée
} from '../../db';
// QuestionMapping n'est plus utilisé directement ici, mais generatePresentation le retourne. On le garde pour l'instant.
import { generatePresentation, AdminPPTXSettings } from '../../utils/pptxOrchestrator';
import { parseOmbeaResultsXml, ExtractedResultFromXml, transformParsedResponsesToSessionResults } from '../../utils/resultsParser';
import { calculateParticipantScore, calculateThemeScores, determineIndividualSuccess } from '../../utils/reportCalculators';
import { logger } from '../../utils/logger'; // Importer le logger
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
// AnomalyDataForModal n'est plus nécessaire ici car le type est inféré ou non utilisé directement
import AnomalyResolutionModal, {
    DetectedAnomalies // ExpectedIssueResolution et UnknownDeviceResolution sont maintenant dans ../../types
} from './AnomalyResolutionModal';
import {
    ExpectedIssueResolution,
    UnknownDeviceResolution
} from '../../types'; // Importer depuis le fichier central des types

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
  const [selectedReferentialId, setSelectedReferentialId] = useState<number | null>(null);    // Pour l'ID numérique
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [participants, setParticipants] = useState<FormParticipant[]>([]);
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
const [displayedBlockDetails, setDisplayedBlockDetails] = useState<Array<{ themeName: string, blocName: string }>>([]);
  // États pour la résolution des anomalies d'importation
  const [detectedAnomalies, setDetectedAnomalies] = useState<DetectedAnomalies | null>(null);
  const [pendingValidResults, setPendingValidResults] = useState<ExtractedResultFromXml[]>([]);
  const [showAnomalyResolutionUI, setShowAnomalyResolutionUI] = useState<boolean>(false);

  useEffect(() => {
    const fetchGlobalData = async () => { // Renommez la fonction interne pour plus de clarté
      try {
        const [devices, trainers, refs, themes, blocs] = await Promise.all([
          getAllVotingDevices(),             // Fonction importée de ../../db
          getAllTrainers(),                  // Fonction importée de ../../db
          StorageManager.getAllReferentiels(), // Fonction sur StorageManager
          StorageManager.getAllThemes(),       // Fonction sur StorageManager
          StorageManager.getAllBlocs()        // Fonction sur StorageManager
        ]);
  
        setHardwareDevices(devices.sort((a: VotingDevice, b: VotingDevice) => (a.id ?? 0) - (b.id ?? 0)));
        setTrainersList(trainers.sort((a: Trainer, b: Trainer) => a.name.localeCompare(b.name)));
        
        setReferentielsData(refs);     // <--- APPEL DU SETTER
        setAllThemesData(themes);       // <--- APPEL DU SETTER
        setAllBlocsData(blocs);         // <--- APPEL DU SETTER
        
        setHardwareLoaded(true);
  
        if (!sessionIdToLoad && trainers.length > 0) {
          const defaultTrainer = trainers.find(t => t.isDefault === 1) || trainers[0];
          if (defaultTrainer?.id) {
            setSelectedTrainerId(defaultTrainer.id);
          }
        }
      } catch (error) {
        console.error("Erreur lors du chargement des données globales:", error);
        setImportSummary("Erreur critique: Impossible de charger les données de base (référentiels, thèmes, etc.).");
      }
    };
  
    fetchGlobalData();
  }, [sessionIdToLoad]); // Garder sessionIdToLoad comme dépendance pour la logique du formateur par défaut
  
  const resetFormTactic = useCallback(() => {
    setCurrentSessionDbId(null);
    setSessionName('');
    setSessionDate('');
    setSelectedReferential('');
    setLocation('');
    setNotes('');
    setParticipants([]);
    setResultsFile(null);
    setImportSummary(null);
    setEditingSessionData(null);
    setActiveTab('details');
    setModifiedAfterOrsGeneration(false);
  }, []);
  useEffect(() => {
    if (editingSessionData?.selectedBlocIds && allThemesData.length > 0 && allBlocsData.length > 0) {
      const details: Array<{ themeName: string, blocName: string }> = [];
      for (const blocId of editingSessionData.selectedBlocIds) {
        const bloc = allBlocsData.find(b => b.id === blocId);
        if (bloc) {
          const theme = allThemesData.find(t => t.id === bloc.theme_id);
          details.push({
            themeName: theme ? `${theme.code_theme} - ${theme.nom_complet}` : `ID Thème Inconnu: ${bloc.theme_id}`,
            blocName: bloc.code_bloc
          });
        } else {
          details.push({ themeName: 'N/A', blocName: `ID Bloc Inconnu: ${blocId}` });
        }
      }
      setDisplayedBlockDetails(details);
    } else {
      setDisplayedBlockDetails([]);
    }
  }, [editingSessionData, editingSessionData?.selectedBlocIds, allThemesData, allBlocsData]);
  useEffect(() => {
    // Condition pour s'assurer que les données nécessaires sont chargées
    if (sessionIdToLoad && hardwareLoaded && referentielsData.length > 0 && trainersList.length > 0) { 
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
                setSelectedReferentialId(refObj.id ?? null); // Important: Mettre à jour l'ID numérique
              } else {
                console.warn(`Référentiel ID ${sessionData.referentielId} non trouvé dans referentielsData.`);
                setSelectedReferential('');
                setSelectedReferentialId(null);
              }
            } else if ((sessionData as any).referentiel && typeof (sessionData as any).referentiel === 'string') {
              const oldCode = (sessionData as any).referentiel as CACESReferential;
              setSelectedReferential(oldCode);
              const refObj = referentielsData.find(r => r.code === oldCode);
              setSelectedReferentialId(refObj?.id || null);
              if (!refObj) {
                  console.warn(`Référentiel avec code ${oldCode} (fallback) non trouvé pour déterminer l'ID.`);
              }
            } else {
              setSelectedReferential('');
              setSelectedReferentialId(null);
            }
  
            setLocation(sessionData.location || '');
            setNotes(sessionData.notes || '');
            setSelectedTrainerId(sessionData.trainerId || null);
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
  
            // La logique pour selectedBlocksSummary est obsolète car selectionBlocs n'existe plus sur sessionData.
            // L'affichage des blocs sélectionnés doit se baser sur sessionData.selectedBlocIds
            // et être géré par un useEffect séparé qui peuple `displayedBlockDetails`.
            // setSelectedBlocksSummary({}); 
  
          } else {
            console.warn(`Session avec ID ${sessionIdToLoad} non trouvée.`);
            resetFormTactic();
          }
        } catch (error) {
          console.error("Erreur lors du chargement de la session:", error);
          resetFormTactic();
        }
      };
      loadSession();
    } else if (!sessionIdToLoad && referentielsData.length > 0 && trainersList.length > 0) { 
      resetFormTactic();
    }
  }, [sessionIdToLoad, hardwareLoaded, referentielsData, trainersList, resetFormTactic]); // AJOUTÉ: referentielsData et trainersList aux dépendances
  
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
    const dbParticipants: DBParticipantType[] = participants.map((p_form: FormParticipant) => ({
      nom: p_form.lastName,
      prenom: p_form.firstName,
      identificationCode: p_form.identificationCode,
      score: p_form.score,
      reussite: p_form.reussite,
      assignedGlobalDeviceId: p_form.assignedGlobalDeviceId,
      statusInSession: p_form.statusInSession, // Assurez-vous que statusInSession est dans FormParticipant
    }));
  
    let currentReferentielIdToSave: number | undefined = undefined;
  
    if (selectedReferentialId) {
      currentReferentielIdToSave = selectedReferentialId;
    } else if (selectedReferential) {
      const refObj = referentielsData.find(r => r.code === selectedReferential);
      if (refObj && refObj.id !== undefined) {
        currentReferentielIdToSave = refObj.id;
        // Il serait bon de synchroniser selectedReferentialId ici aussi, mais c'est mieux dans l'onChange du Select.
        // Exemple: si l'onChange du Select met à jour selectedReferential (code) ET selectedReferentialId (number)
        // alors cette branche else if ne serait nécessaire que si selectedReferentialId n'a pas été mis à jour ailleurs.
      } else {
        console.error(`Impossible de trouver l'ID pour le code référentiel: ${selectedReferential} lors de la préparation.`);
        // Gérer l'erreur : peut-être afficher un message à l'utilisateur via setImportSummary
        // et retourner null pour empêcher la sauvegarde si un référentiel est requis.
        // setImportSummary(`Erreur: Référentiel "${selectedReferential}" non valide.`);
        // return null; 
      }
    } else if (editingSessionData?.referentielId) {
      currentReferentielIdToSave = editingSessionData.referentielId;
    }
  
    const sessionToSave: DBSession = {
      id: currentSessionDbId || undefined,
      nomSession: sessionName.trim() || `Session du ${new Date().toLocaleDateString()}`,
      dateSession: sessionDate || new Date().toISOString().split('T')[0],
      referentielId: currentReferentielIdToSave, // Utilise l'ID numérique
      participants: dbParticipants,
      selectedBlocIds: editingSessionData?.selectedBlocIds || [],
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
  
    // Optionnel: Validation finale avant de retourner
    if (sessionToSave.referentielId === undefined && selectedReferential) {
        console.warn("Tentative de sauvegarde de session sans referentielId valide alors qu'un code était sélectionné.");
        // Vous pourriez vouloir retourner null ici si un référentiel est absolument requis.
        // setImportSummary("Le référentiel sélectionné est invalide ou n'a pas pu être identifié. Sauvegarde annulée.");
        // return null;
    }
  
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
            const newDisplayedBlockDetails: Array<{ themeName: string, blocName: string }> = [];
            if (reloadedSession && reloadedSession.selectedBlocIds && allBlocsData.length > 0 && allThemesData.length > 0) {
              for (const blocId of reloadedSession.selectedBlocIds) {
                const bloc = allBlocsData.find(b => b.id === blocId);
                if (bloc) {
                  const theme = allThemesData.find(t => t.id === bloc.theme_id);
                  newDisplayedBlockDetails.push({
                    themeName: theme ? `${theme.code_theme} - ${theme.nom_complet}` : `ID Thème: ${bloc.theme_id}`,
                    blocName: bloc.code_bloc
                  });
                } else {
                  newDisplayedBlockDetails.push({ themeName: 'N/A', blocName: `ID Bloc Inconnu: ${blocId}` });
                }
              }
            }
            setDisplayedBlockDetails(newDisplayedBlockDetails); // Met à jour l'état pour l'affichage des blocs

            // L'état selectedBlocksSummary est probablement obsolète et peut être supprimé.
            // Si vous le supprimez, supprimez aussi sa déclaration useState et sa fonction setSelectedBlocksSummary.
            // setSelectedBlocksSummary({}); // Supprimez ou commentez cette ligne.
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
    const refToUse = selectedReferential || editingSessionData?.referentielId;
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
    // let tempSelectedBlocksSummary: Record<string, string> = {}; // Remplacé par une liste d'IDs de blocs
    let selectedBlocIdsForSession: number[] = [];

    try {
      // 1. Obtenir l'objet Referential complet à partir du code.
      const referentielObject = await StorageManager.getReferentialByCode(refToUse as string);
      if (!referentielObject || !referentielObject.id) {
        setImportSummary(`Référentiel avec code "${refToUse}" non trouvé.`);
        setIsGeneratingOrs(false); return;
      }

      // 2. Obtenir les thèmes pour ce référentiel.
      const themesForReferential = await StorageManager.getThemesByReferentialId(referentielObject.id);
      if (!themesForReferential || themesForReferential.length === 0) {
        setImportSummary(`Aucun thème trouvé pour le référentiel "${refToUse}".`);
        setIsGeneratingOrs(false); return;
      }

      for (const theme of themesForReferential) {
        // 3. Pour chaque thème, obtenir ses blocs.
        const blocsForTheme = await StorageManager.getBlocsByThemeId(theme.id!);
        if (!blocsForTheme || blocsForTheme.length === 0) {
          console.warn(`Aucun bloc trouvé pour le thème "${theme.code_theme}" (ID: ${theme.id}).`);
          continue;
        }

        // 4. Filtrer les blocs pour ne garder que ceux se terminant par _A, _B, _C, _D, ou _E.
        const filteredBlocs = blocsForTheme.filter(bloc =>
          bloc.code_bloc.match(/_([A-E])$/i) // Case-insensitive match for _A to _E at the end
        );

        if (filteredBlocs.length === 0) {
          console.warn(`Aucun bloc de type _A à _E trouvé pour le thème "${theme.code_theme}". Le bloc _GEN ou d'autres pourraient exister mais ne sont pas sélectionnés aléatoirement ici.`);
          continue;
        }

        // 5. Choisir un bloc aléatoirement parmi les filtrés.
        const chosenBloc = filteredBlocs[Math.floor(Math.random() * filteredBlocs.length)];
        if (chosenBloc && chosenBloc.id) {
          selectedBlocIdsForSession.push(chosenBloc.id);
          // tempSelectedBlocksSummary[theme.code_theme] = chosenBloc.code_bloc; // Garder pour info si besoin, mais non stocké sur Session

          // 6. Récupérer les questions pour ce bloc choisi.
          const questionsFromBloc = await StorageManager.getQuestionsForBloc(chosenBloc.id);
          allSelectedQuestionsForPptx = allSelectedQuestionsForPptx.concat(questionsFromBloc);
          logger.info(`Thème: ${theme.code_theme}, Bloc choisi: ${chosenBloc.code_bloc}, Questions: ${questionsFromBloc.length}`);
        }
      }

      if (allSelectedQuestionsForPptx.length === 0) {
        setImportSummary("Aucune question sélectionnée après le processus de choix aléatoire des blocs. Vérifiez la configuration des thèmes et blocs.");
        setIsGeneratingOrs(false); return;
      }

      // Mettre à jour la session avec les IDs des blocs sélectionnés
      upToDateSessionData.selectedBlocIds = selectedBlocIdsForSession;
      if (referentielObject && referentielObject.id !== undefined) {
          upToDateSessionData.referentielId = referentielObject.id; // Assurez-vous que c'est l'ID numérique
      } else {
          // Gérer le cas où referentielObject.id n'est pas défini, si c'est possible ici
          console.error("L'ID du référentiel n'a pas pu être déterminé pour la mise à jour de upToDateSessionData.");
          setImportSummary("Erreur critique : l'ID du référentiel est manquant.");
          setIsGeneratingOrs(false);
          return; // Arrêter le processus
      }
   
// Optionnel mais recommandé : Persister ces changements en base de données immédiatement
// Cela mettra aussi à jour l'état editingSessionData si handleSaveSession est bien écrit.
try {
  await updateSession(currentSavedId, { 
      selectedBlocIds: upToDateSessionData.selectedBlocIds, 
      referentielId: upToDateSessionData.referentielId 
  });
  const reloadedSession = await getSessionById(currentSavedId);
  if (reloadedSession) setEditingSessionData(reloadedSession); // Mettre à jour l'état principal
} catch (error) {
  console.error("Erreur lors de la mise à jour de la session avec selectedBlocIds/referentielId avant génération PPTX", error);
  setImportSummary("Erreur sauvegarde session avant génération PPTX.");
  setIsGeneratingOrs(false);
  return;
}
      // Utiliser referentielObject.code qui est le code string (ex: "R489")
      const sessionInfoForPptx = { name: upToDateSessionData.nomSession, date: upToDateSessionData.dateSession, referential: referentielObject.code as CACESReferential };
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
        const { orsBlob, questionMappings, ignoredSlideGuids: newlyIgnoredSlideGuids } = generationOutput; // Récupérer ignoredSlideGuids
        try {
          // 1. Mettre à jour la session principale avec l'ORS, les mappings, et les ignoredSlideGuids
          await updateSession(currentSavedId, {
            donneesOrs: orsBlob,
            questionMappings: questionMappings,
            ignoredSlideGuids: newlyIgnoredSlideGuids || [],
            updatedAt: new Date().toISOString(),
            status: 'ready',
            selectedBlocIds: upToDateSessionData.selectedBlocIds, // Utiliser la nouvelle propriété
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
                // Pour retrouver le code du bloc pour SessionQuestion, il faut remonter depuis originalQuestion.blocId
                let blocCodeForSessionQuestion = 'N/A';
                if (originalQuestion.blocId) {
                    const blocDetails = await StorageManager.getAllBlocs().then(allBlocs => allBlocs.find(b => b.id === originalQuestion.blocId));
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
                  blockId: blocCodeForSessionQuestion, // Utiliser le code_bloc ici
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

          // Le testSlideGuid est maintenant géré via ignoredSlideGuids directement depuis generationOutput
          // et stocké lors de la première mise à jour de la session avec l'ORS.
          // Donc, plus besoin de logique spécifique ici pour un 'testQuestionDbId'.

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

      // Filtrer les questions ignorées (anciennement question test)
      const slideGuidsToIgnore = editingSessionData.ignoredSlideGuids;
      if (slideGuidsToIgnore && slideGuidsToIgnore.length > 0) {
        const countBeforeFilteringIgnored = extractedResultsFromXml.length;
        extractedResultsFromXml = extractedResultsFromXml.filter(
          (result) => !slideGuidsToIgnore.includes(result.questionSlideGuid)
        );
        const countAfterFilteringIgnored = extractedResultsFromXml.length;
        if (countBeforeFilteringIgnored > countAfterFilteringIgnored) {
          logger.info(`[Import Results] ${countBeforeFilteringIgnored - countAfterFilteringIgnored} réponses correspondant à ${slideGuidsToIgnore.length} GUID(s) ignoré(s) ont été filtrées.`);
        }
      }

      // Grouper les réponses par (serialNumber, slideGuid) et ne retenir que la dernière (timestamp le plus élevé)
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
      logger.info(`[Import Results] ${finalExtractedResults.length} réponses retenues après déduplication (conservation de la dernière réponse par timestamp).`);

      if (finalExtractedResults.length === 0 && !(editingSessionData.ignoredSlideGuids && editingSessionData.ignoredSlideGuids.length > 0 && extractedResultsFromXml.length === 0) ) {
        // Ajustement: s'il n'y a que des réponses ignorées à l'origine, extractedResultsFromXml sera vide aussi.
        // Si finalExtractedResults est vide MAIS que ce n'est PAS parce que TOUTES les réponses initiales étaient des réponses ignorées,
        // alors on affiche le message.
        // Le cas où extractedResultsFromXml est vide (donc toutes les réponses étaient ignorées) est géré au début du parsing.
        setImportSummary("Aucune réponse valide à importer après filtrage et déduplication.");
        return;
      }

      // Étape 1.1: Charger les données de référence de la session
      const sessionQuestionsFromDb = await getSessionQuestionsBySessionId(currentSessionDbId);
      const sessionBoitiers = await getSessionBoitiersBySessionId(currentSessionDbId);

      if (!sessionQuestionsFromDb || sessionQuestionsFromDb.length === 0) {
        setImportSummary("Erreur: Impossible de charger les questions de référence pour cette session. L'import ne peut continuer.");
        logger.error(`[Import Results] Impossible de charger sessionQuestions pour sessionId: ${currentSessionDbId}`);
        return;
      }
      // sessionBoitiers peut être vide, géré plus loin.
      if (!sessionBoitiers) {
           logger.warning(`[Import Results] Aucune information de boîtier (sessionBoitiers) trouvée pour sessionId: ${currentSessionDbId}. Les vérifications de boîtiers seront limitées.`);
      }


      const relevantSessionQuestions = editingSessionData.ignoredSlideGuids
        ? sessionQuestionsFromDb.filter(sq => !editingSessionData.ignoredSlideGuids!.includes(sq.slideGuid))
        : sessionQuestionsFromDb;

      const relevantSessionQuestionGuids = new Set(relevantSessionQuestions.map(sq => sq.slideGuid));
      const totalRelevantQuestionsCount = relevantSessionQuestionGuids.size;

      logger.info(`[Import Results] Nombre total de questions pertinentes pour la session (hors ignorées): ${totalRelevantQuestionsCount}`);

      // Étape 3.1: Vérification des questions (GUIDs)
      for (const result of finalExtractedResults) { // finalExtractedResults a déjà les réponses aux questions ignorées filtrées
        if (!relevantSessionQuestionGuids.has(result.questionSlideGuid)) {
          const errorMessage = `GUID de question importé (${result.questionSlideGuid}) n'est pas parmi les questions pertinentes de la session. Vérifiez le fichier ORS et la configuration des questions ignorées.`;
          setImportSummary(errorMessage);
          logger.error(`[Import Results - Anomaly] ${errorMessage}`, {
            importedGuid: result.questionSlideGuid,
            expectedGuids: Array.from(relevantSessionQuestionGuids)
          });
          return;
        }
      }
      logger.info("[Import Results] Vérification des GUID de questions terminée. Tous les GUID importés sont valides pour cette session.");

      // ***********************************************************************
      // NOUVELLE LOGIQUE POUR SOUS-TÂCHE 1.2 (et préparation pour 1.3)
      // ***********************************************************************
      const detectedAnomaliesData: DetectedAnomalies = { // Updated type from AnomalyResolutionModal
        expectedHavingIssues: [],
        unknownThatResponded: [],
      };
      const responsesFromExpectedDevices: ExtractedResultFromXml[] = [];
      // const allImportedSerialNumbers = new Set(finalExtractedResults.map(r => r.participantDeviceID)); // Sera utilisé pour les inconnus

      // Traiter les boîtiers attendus (sessionBoitiers)
      for (const boitierAttendu of (sessionBoitiers || [])) { // Assurer que sessionBoitiers n'est pas null
        const responsesForThisExpectedDevice = finalExtractedResults.filter(
          r => r.participantDeviceID === boitierAttendu.serialNumber
        );

        const respondedGuidsForThisExpected = new Set(responsesForThisExpectedDevice.map(r => r.questionSlideGuid));
        const missedGuidsForThisExpected: string[] = [];

        if (totalRelevantQuestionsCount > 0) {
          relevantSessionQuestionGuids.forEach(guid => {
            if (!respondedGuidsForThisExpected.has(guid)) {
              missedGuidsForThisExpected.push(guid);
            }
          });
        }

        if (missedGuidsForThisExpected.length > 0 && totalRelevantQuestionsCount > 0) {
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
      logger.info(`[Import Results] ${detectedAnomaliesData.expectedHavingIssues.length} boîtier(s) attendu(s) ont des réponses manquantes.`);

      // ***********************************************************************
      // NOUVELLE LOGIQUE POUR SOUS-TÂCHE 1.3 : Détection des inconnus
      // ***********************************************************************
      const expectedSerialNumbers = new Set((sessionBoitiers || []).map(b => b.serialNumber));
      const unknownSerialNumbersResponses: { [key: string]: ExtractedResultFromXml[] } = {};

      for (const result of finalExtractedResults) {
        if (!expectedSerialNumbers.has(result.participantDeviceID)) {
          if (!unknownSerialNumbersResponses[result.participantDeviceID]) {
            unknownSerialNumbersResponses[result.participantDeviceID] = [];
          }
          unknownSerialNumbersResponses[result.participantDeviceID].push(result);
        }
      }

      Object.entries(unknownSerialNumbersResponses).forEach(([serialNumber, responses]) => {
        detectedAnomaliesData.unknownThatResponded.push({
          serialNumber: serialNumber,
          responses: responses,
          // partialInfo et status pourraient être ajoutés ici si nécessaire,
          // mais pour l'instant, la définition de UnknownDeviceWithResponses ne les requiert pas.
        });
      });
      logger.info(`[Import Results] ${detectedAnomaliesData.unknownThatResponded.length} boîtier(s) inconnu(s) ont répondu.`);

      // Condition d'affichage de la modale (maintenant avec la détection correcte des inconnus)
      if (detectedAnomaliesData.expectedHavingIssues.length > 0 || detectedAnomaliesData.unknownThatResponded.length > 0) {
        setImportSummary(`Anomalies détectées: ${detectedAnomaliesData.expectedHavingIssues.length} boîtier(s) attendu(s) avec problèmes, ${detectedAnomaliesData.unknownThatResponded.length} boîtier(s) inconnu(s). Résolution nécessaire.`);
        // Utiliser directement detectedAnomaliesData qui est maintenant correctement typé et peuplé
        setDetectedAnomalies(detectedAnomaliesData);
        setPendingValidResults(responsesFromExpectedDevices); // Ceux-ci sont les réponses des attendus SANS problème
        setShowAnomalyResolutionUI(true);
        logger.info("[Import Results] Des anomalies de boîtiers ont été détectées. Affichage de l'interface de résolution.");
        return;
      }

      logger.info("[Import Results] Aucune anomalie de boîtier détectée. Procédure d'import direct.");
      setImportSummary(`${responsesFromExpectedDevices.length} réponses valides prêtes pour transformation et import...`);

      const currentQuestionMappings = editingSessionData.questionMappings;
      if (!currentQuestionMappings || currentQuestionMappings.length === 0) {
        setImportSummary("Erreur: Mappages de questions manquants pour la session (editingSessionData.questionMappings). Impossible de lier les résultats.");
        return;
      }

      // Utiliser reponsesDesAttendus car il ne contient que les réponses des boîtiers prévus et validés jusqu'ici
      const sessionResultsToSave = transformParsedResponsesToSessionResults(
        responsesFromExpectedDevices, // <--- CORRIGÉ ICI
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
                    // const deviceIdBySerialMap = new Map(hardwareDevices.map(hd => [hd.serialNumber, hd.id])); // Non utilisé actuellement

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
                      accept=".ors" // Changé de .zip à .ors pour l'expérience utilisateur
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

// Fonctions pour le modal de résolution d'anomalies
const handleResolveAnomalies = async (
    // Renommer pendingValidResultsFromModal en baseResultsToProcess pour plus de clarté
    baseResultsToProcess: ExtractedResultFromXml[],
    expectedResolutions: ExpectedIssueResolution[],     // Nouveau type
    unknownResolutions: UnknownDeviceResolution[]       // Nouveau type
    // Retiré: conflictResolutions car on ne les gère plus comme type distinct ici
  ) => {

    logger.info(`[AnomalyResolution] Début du traitement des résolutions.`);
    logger.info('[AnomalyResolution] Décisions pour les attendus:', expectedResolutions);
    logger.info('[AnomalyResolution] Décisions pour les inconnus:', unknownResolutions);

    setShowAnomalyResolutionUI(false);
    // Garder detectedAnomalies dans l'état jusqu'à la fin au cas où on en aurait besoin pour retrouver les réponses originales
    // setDetectedAnomalies(null); // Peut-être seulement à la fin
    // setPendingValidResults([]); // Idem

    if (!currentSessionDbId || !editingSessionData || !editingSessionData.questionMappings) {
      setImportSummary("Erreur critique : Données de session manquantes pour finaliser l'import après résolution.");
      logger.error("[AnomalyResolution] Données de session critiques manquantes pour finaliser l'import.");
      return;
    }

    let finalResultsToImport: ExtractedResultFromXml[] = [...baseResultsToProcess];
    let updatedParticipantsList: DBParticipantType[] = editingSessionData.participants ? [...editingSessionData.participants] : [];
    let participantsDataChanged = false;

    // Récupérer les détails des anomalies originales pour accéder aux réponses etc.
    const originalAnomalies = detectedAnomalies; // Accéder à l'état local
    if (!originalAnomalies) {
        setImportSummary("Erreur critique : Données d'anomalies originales non trouvées.");
        logger.error("[AnomalyResolution] Données d'anomalies originales (état detectedAnomalies) non trouvées.");
        return;
    }

    // 1. Traiter les résolutions des boîtiers attendus (expectedHavingIssues)
    for (const resolution of expectedResolutions) {
      const expectedDeviceData = originalAnomalies.expectedHavingIssues.find(
        e => e.serialNumber === resolution.serialNumber
      );
      if (!expectedDeviceData) continue;

      const participantIndex = updatedParticipantsList.findIndex(p => {
        const device = hardwareDevices.find(hd => hd.id === p.assignedGlobalDeviceId);
        return device?.serialNumber === resolution.serialNumber;
      });

      if (resolution.action === 'mark_absent' || resolution.action === 'ignore_device') {
        logger.info(`[AnomalyResolution] Traitement pour ${expectedDeviceData.participantName} (SN: ${resolution.serialNumber}): Action = ${resolution.action}.`);
        if (participantIndex !== -1) {
          // Marquer le participant comme absent
          const currentParticipant = updatedParticipantsList[participantIndex];
          updatedParticipantsList[participantIndex] = {
            ...currentParticipant,
            statusInSession: 'absent',
            score: 0, // Un participant absent a 0 points
            reussite: false // Et ne réussit pas
          };
          participantsDataChanged = true;
          logger.info(`[AnomalyResolution] Participant ${expectedDeviceData.participantName} marqué comme absent. Score et réussite mis à 0.`);
        } else {
          logger.warning(`[AnomalyResolution] Participant non trouvé dans la liste pour ${expectedDeviceData.participantName} (SN: ${resolution.serialNumber}) lors du marquage comme absent.`);
        }
      } else if (resolution.action === 'aggregate_with_unknown') {
        if (resolution.sourceUnknownSerialNumber) {
          const unknownSourceDeviceData = originalAnomalies.unknownThatResponded.find(
            u => u.serialNumber === resolution.sourceUnknownSerialNumber
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
            logger.warning(`[AnomalyResolution] Source inconnue SN: ${resolution.sourceUnknownSerialNumber} non trouvée pour agrégation avec ${resolution.serialNumber}. Les réponses partielles de l'attendu (si existent) sont conservées.`);
             finalResultsToImport.push(...expectedDeviceData.responseInfo.responsesProvidedByExpected.map(r => ({...r, participantDeviceID: resolution.serialNumber})));
          }
        } else {
           logger.warning(`[AnomalyResolution] Action 'aggregate_with_unknown' pour ${resolution.serialNumber} mais pas de sourceUnknownSerialNumber. Les réponses partielles de l'attendu (si existent) sont conservées.`);
           finalResultsToImport.push(...expectedDeviceData.responseInfo.responsesProvidedByExpected.map(r => ({...r, participantDeviceID: resolution.serialNumber})));
        }
      }
    }

    // 2. Traiter les résolutions des boîtiers inconnus
    for (const resolution of unknownResolutions) {
      const isUsedAsSource = expectedResolutions.some(
        expRes => expRes.action === 'aggregate_with_unknown' && expRes.sourceUnknownSerialNumber === resolution.serialNumber
      );

      if (isUsedAsSource) {
        logger.info(`[AnomalyResolution] Inconnu SN: ${resolution.serialNumber} a été utilisé pour une agrégation. Ses réponses individuelles ne sont pas traitées séparément.`);
        continue;
      }

      const unknownDeviceData = originalAnomalies.unknownThatResponded.find(
        u => u.serialNumber === resolution.serialNumber
      );
      if (!unknownDeviceData) continue;

      if (resolution.action === 'add_as_new_participant') {
        logger.info(`[AnomalyResolution] Ajout d'un nouveau participant pour inconnu SN: ${resolution.serialNumber} avec nom: ${resolution.newParticipantName}.`);
        finalResultsToImport.push(...unknownDeviceData.responses);

        const newParticipantName = resolution.newParticipantName || `Participant Inconnu ${resolution.serialNumber.slice(-4)}`;
        let assignedGlobalDeviceIdForNew: number | null = null;
        const existingHardwareDevice = hardwareDevices.find(hd => hd.serialNumber === resolution.serialNumber);
        if (existingHardwareDevice) {
            assignedGlobalDeviceIdForNew = existingHardwareDevice.id!;
        } else {
            logger.warning(`[AnomalyResolution] Aucun VotingDevice global trouvé pour SN ${resolution.serialNumber}. Le nouveau participant sera sans assignedGlobalDeviceId.`);
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

    // 3. Mettre à jour la session si les participants ont changé
    if (participantsDataChanged) {
        try {
            await updateSession(currentSessionDbId, { participants: updatedParticipantsList, updatedAt: new Date().toISOString() });
            const reloadedSessionForUI = await getSessionById(currentSessionDbId);
            if (reloadedSessionForUI) {
                setEditingSessionData(reloadedSessionForUI);
                const formParticipantsToUpdate: FormParticipant[] = reloadedSessionForUI.participants.map((p_db_updated, index) => {
                    const visualDeviceId = index + 1;
                    const currentFormParticipantState = participants.find(fp => fp.assignedGlobalDeviceId === p_db_updated.assignedGlobalDeviceId && fp.nom === p_db_updated.nom && fp.prenom === p_db_updated.prenom) || participants[index];
                    return {
                      ...p_db_updated,
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
            logger.info(`[AnomalyResolution] Liste des participants mise à jour dans la session ${currentSessionDbId}.`);
        } catch (error) {
            logger.error(`[AnomalyResolution] Erreur lors de la mise à jour des participants pour la session ${currentSessionDbId}.`, error);
            setImportSummary("Erreur lors de la mise à jour des participants après résolution. L'import est stoppé.");
            return;
        }
    }

    // 4. Transformer et Sauvegarder les résultats
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
                const participantsWithScores = finalSessionDataForScores.participants.map(p => {
                    const device = hardwareDevices.find(hd => hd.id === p.assignedGlobalDeviceId);
                    const participantSerialNumber = device ? device.serialNumber : p.identificationCode?.startsWith('NEW_') ? p.identificationCode.substring(4) : null;

                    if (!participantSerialNumber) return { ...p, score: p.score || 0, reussite: p.reussite || false };

                    const participantResults = allResultsForScoreCalc.filter(r => r.participantIdBoitier === participantSerialNumber);
                    const score = calculateParticipantScore(participantResults, questionsForScoreCalc);
                    const themeScores = calculateThemeScores(participantResults, questionsForScoreCalc);
                    const reussite = determineIndividualSuccess(score, themeScores);
                    return { ...p, score, reussite };
                });
                // Préparer l'objet d'audit des anomalies
                const anomaliesAuditData = {
                  expectedIssues: expectedResolutions,
                  unknownDevices: unknownResolutions,
                  resolvedAt: new Date().toISOString(),
                };

                // Mettre à jour la session avec le statut completed ET les données d'audit
                await updateSession(currentSessionDbId, {
                  participants: participantsWithScores,
                  status: 'completed',
                  resolvedImportAnomalies: anomaliesAuditData,
                  updatedAt: new Date().toISOString()
                });
                message += "\nScores et réussite calculés. Statut session: 'Terminée', Audit des anomalies sauvegardé.";

                // Logger les informations d'audit
                logger.info(`[AnomalyResolution] Anomalies résolues et auditées pour session ID ${currentSessionDbId}`, {
                  eventType: 'ANOMALIES_RESOLVED_AUDITED',
                  sessionId: currentSessionDbId,
                  sessionName: finalSessionDataForScores?.nomSession || editingSessionData.nomSession,
                  resolutions: anomaliesAuditData
                });

                const finalUpdatedSessionWithScores = await getSessionById(currentSessionDbId);
                 if (finalUpdatedSessionWithScores) {
                    setEditingSessionData(finalUpdatedSessionWithScores);
                    const formParticipantsToUpdate: FormParticipant[] = finalUpdatedSessionWithScores.participants.map((p_db_updated, index) => {
                        const visualDeviceId = index + 1;
                        const currentFormParticipantState = participants.find(fp => fp.assignedGlobalDeviceId === p_db_updated.assignedGlobalDeviceId && fp.nom === p_db_updated.nom && fp.prenom === p_db_updated.prenom) || participants[index];
                        return {
                          ...p_db_updated,
                          id: currentFormParticipantState?.id || `final-updated-${index}-${Date.now()}`,
                          firstName: p_db_updated.prenom,
                          lastName: p_db_updated.nom,
                          deviceId: visualDeviceId,
                          organization: currentFormParticipantState?.organization || (p_db_updated as any).organization || '',
                          hasSigned: currentFormParticipantState?.hasSigned || (p_db_updated as any).hasSigned || false,
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
    setDetectedAnomalies(null); // Nettoyer après traitement
  };

  const handleCancelAnomalyResolution = () => {
    setShowAnomalyResolutionUI(false);
    setDetectedAnomalies(null);
    setPendingValidResults([]);
    setImportSummary("Importation des résultats annulée par l'utilisateur en raison d'anomalies.");
    setResultsFile(null); // Effacer le fichier pour que l'utilisateur doive le resélectionner s'il veut réessayer
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
          pendingValidResults={pendingValidResults} // Changé de pendingValidResultsCount à pendingValidResults
          onResolve={handleResolveAnomalies}
          onCancel={handleCancelAnomalyResolution}
        />
      )}
    </div>
  );
};

export default SessionForm;
