import React, { useState, useEffect, useCallback } from 'react';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { Save, FileUp, UserPlus, Trash2, PackagePlus } from 'lucide-react';
import {
  CACESReferential,
  referentials,
  Session as DBSession,
  Participant as DBParticipantType,
  SessionResult
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
  getAdminSetting
} from '../../db';
import { generatePresentation, AdminPPTXSettings } from '../../utils/pptxOrchestrator';
import { parseOmbeaResultsXml, ExtractedResultFromXml, transformParsedResponsesToSessionResults } from '../../utils/resultsParser';
import { calculateParticipantScore, calculateThemeScores, determineIndividualSuccess } from '../../utils/reportCalculators';
import JSZip from 'jszip';
import * as XLSX from 'xlsx'; // Ajout de l'import pour XLSX

interface FormParticipant extends DBParticipantType {
  id: string;
  firstName: string;
  lastName: string;
  organization?: string;
  deviceId: number;
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

  useEffect(() => {
    const fetchHardwareDevices = async () => {
      const devicesFromDb = await getAllVotingDevices();
      setHardwareDevices(devicesFromDb.sort((a, b) => (a.id ?? 0) - (b.id ?? 0)));
      setHardwareLoaded(true);
    };
    fetchHardwareDevices();
  }, []);

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
  }, []);

  useEffect(() => {
    if (sessionIdToLoad && hardwareLoaded) {
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
          const formParticipants: FormParticipant[] = sessionData.participants.map((p_db, loopIndex) => {
            let logicalDeviceId = 0;
            const physicalIdIndex = hardwareDevices.findIndex(hd => hd.physicalId === p_db.idBoitier);
            if (physicalIdIndex !== -1) {
              logicalDeviceId = physicalIdIndex + 1;
            } else if (p_db.idBoitier) {
              console.warn( `L'ID boîtier physique "${p_db.idBoitier}" pour ${p_db.prenom} ${p_db.nom} n'a pas été trouvé.`);
            }
            return {
              ...p_db, id: `loaded-${loopIndex}-${p_db.idBoitier || Date.now()}`, firstName: p_db.prenom, lastName: p_db.nom,
              deviceId: logicalDeviceId, organization: (p_db as any).organization || '', hasSigned: (p_db as any).hasSigned || false,
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
  }, [sessionIdToLoad, hardwareLoaded, hardwareDevices, resetFormTactic]);

  const referentialOptions = Object.entries(referentials).map(([value, label]) => ({
    value,
    label: `${value} - ${label}`,
  }));

  const handleAddParticipant = () => {
    const newParticipant: FormParticipant = {
      id: Date.now().toString(), idBoitier: '', nom: '', prenom: '',
      firstName: '', lastName: '', organization: '', identificationCode: '',
      deviceId: participants.length + 1, hasSigned: false, score: undefined, reussite: undefined,
    };
    setParticipants([...participants, newParticipant]);
  };

  const handleRemoveParticipant = (id: string) => {
    const updatedParticipants = participants.filter(p => p.id !== id);
    const reindexedParticipants = updatedParticipants.map((p, index) => ({ ...p, deviceId: index + 1, }));
    setParticipants(reindexedParticipants);
  };

  const handleParticipantChange = (id: string, field: keyof FormParticipant, value: string | number | boolean) => {
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

  const prepareSessionDataForDb = async (includeOrsBlob?: Blob | null): Promise<DBSession | null> => {
    // Validation du référentiel déplacée à la génération ORS si nouvelle session
    // if (!selectedReferential && !currentSessionDbId) {
    //   alert("Veuillez sélectionner un référentiel CACES pour une nouvelle session.");
    //   return null;
    // }
    const dbParticipants: DBParticipantType[] = participants.map((p_form) => {
      let assignedPhysicalId = '';
      const logicalDeviceId = p_form.deviceId;
      if (logicalDeviceId > 0 && logicalDeviceId <= hardwareDevices.length) {
        assignedPhysicalId = hardwareDevices[logicalDeviceId - 1].physicalId;
      } else if (logicalDeviceId !== 0 && p_form.idBoitier) {
         assignedPhysicalId = p_form.idBoitier;
         console.warn( `Participant ${p_form.lastName} (${p_form.firstName}) deviceId logique (${logicalDeviceId}) ne correspond plus. Ancien ID physique ${p_form.idBoitier} conservé.`);
      } else if (logicalDeviceId !== 0) {
         console.warn( `Participant ${p_form.lastName} (${p_form.firstName}) deviceId logique (${logicalDeviceId}) hors limites.`);
      }
      return {
        idBoitier: assignedPhysicalId, nom: p_form.lastName, prenom: p_form.firstName,
        identificationCode: p_form.identificationCode, score: p_form.score, reussite: p_form.reussite,
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
            const formParticipants: FormParticipant[] = reloadedSession.participants.map((p_db, index) => {
              let logicalDeviceId = 0;
              const physicalIdIndex = hardwareDevices.findIndex(hd => hd.physicalId === p_db.idBoitier);
              if (physicalIdIndex !== -1) { logicalDeviceId = physicalIdIndex + 1; }
              else if (p_db.idBoitier) { console.warn(`[handleSaveSession] ID boîtier "${p_db.idBoitier}" non trouvé.`); }
              return {
                ...p_db, id: participants[index]?.id || `form-${index}-${Date.now()}`,
                firstName: p_db.prenom, lastName: p_db.nom, deviceId: logicalDeviceId,
                organization: (participants[index] as any)?.organization || '',
                hasSigned: (participants[index] as any)?.hasSigned || false,
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
      setSelectedBlocksSummary(tempSelectedBlocksSummary);
      if (allSelectedQuestionsForPptx.length === 0) { setImportSummary("Aucune question sélectionnée."); setIsGeneratingOrs(false); return; }

      let sessionDataForDb = await prepareSessionDataForDb(null);
      if (!sessionDataForDb) { setImportSummary("Erreur préparation données session."); setIsGeneratingOrs(false); return; }

      // Vérification des idBoitier des participants
      const participantsWithoutIdBoitier = sessionDataForDb.participants.filter(p => !p.idBoitier || p.idBoitier.trim() === '');
      if (participantsWithoutIdBoitier.length > 0) {
        const participantNames = participantsWithoutIdBoitier.map(p => `${p.prenom} ${p.nom}`).join(', ');
        setImportSummary(`Erreur: Les participants suivants n'ont pas d'ID de boîtier valide assigné (vérifiez la configuration matérielle et l'assignation des boîtiers aux participants) : ${participantNames}. L'ORS ne peut pas être généré.`);
        setIsGeneratingOrs(false);
        return;
      }

      sessionDataForDb.selectionBlocs = Object.entries(tempSelectedBlocksSummary).map(([theme, blockId]) => ({ theme, blockId }));
      sessionDataForDb.status = 'planned';

      const savedSessionId = await handleSaveSession(sessionDataForDb);
      if (!savedSessionId) { setIsGeneratingOrs(false); return; }

      const currentSessionData = await getSessionById(savedSessionId);
      if (!currentSessionData) { setImportSummary("Erreur: session non trouvée après sauvegarde."); setIsGeneratingOrs(false); return; }

      // Re-vérifier les idBoitiers sur currentSessionData au cas où handleSaveSession les aurait modifiés de manière inattendue
      // Normalement, ils devraient être les mêmes que dans sessionDataForDb.participants
      const finalParticipantsWithoutIdBoitier = currentSessionData.participants.filter(p => !p.idBoitier || p.idBoitier.trim() === '');
      if (finalParticipantsWithoutIdBoitier.length > 0) {
        const participantNames = finalParticipantsWithoutIdBoitier.map(p => `${p.prenom} ${p.nom}`).join(', ');
        setImportSummary(`Erreur (post-sauvegarde): Les participants suivants n'ont pas d'ID de boîtier valide : ${participantNames}. L'ORS ne peut pas être généré.`);
        setIsGeneratingOrs(false);
        return;
      }

      const sessionInfoForPptx = { name: currentSessionData.nomSession, date: currentSessionData.dateSession, referential: currentSessionData.referentiel as CACESReferential };
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
      const participantsForGenerator: DBParticipantType[] = currentSessionData.participants.map(p_db => ({
        idBoitier: p_db.idBoitier, nom: p_db.nom, prenom: p_db.prenom, identificationCode: p_db.identificationCode,
      }));

      console.log('[SessionForm Gen .ors] Participants sent to generatePresentation:', participantsForGenerator);
      const generationOutput = await generatePresentation(sessionInfoForPptx, participantsForGenerator, allSelectedQuestionsForPptx, globalPptxTemplate, adminSettings);
      if (generationOutput && generationOutput.orsBlob && generationOutput.questionMappings) {
        const { orsBlob, questionMappings } = generationOutput;
        try {
          await updateSession(savedSessionId, {
            donneesOrs: orsBlob, questionMappings: questionMappings,
            updatedAt: new Date().toISOString(), status: 'ready'
          });
          setEditingSessionData(await getSessionById(savedSessionId) || null);
          setImportSummary(`Session (ID: ${savedSessionId}) .ors et mappings générés. Statut: Prête.`);
        } catch (e: any) { setImportSummary(`Erreur sauvegarde .ors/mappings: ${e.message}`); console.error("Erreur sauvegarde .ors/mappings:", e); }
      } else { setImportSummary("Erreur génération .ors/mappings."); console.error("Erreur génération .ors/mappings. Output:", generationOutput); }
    } catch (error: any) { setImportSummary(`Erreur majeure génération: ${error.message}`); console.error("Erreur majeure génération:", error); }
    finally { setIsGeneratingOrs(false); }
  };

  // --- Début Logique Import Participants ---

  const parseCsvParticipants = (fileContent: string): Omit<FormParticipant, 'id' | 'deviceId' | 'idBoitier' | 'score' | 'reussite' | 'hasSigned'>[] => {
    const newParticipants: Omit<FormParticipant, 'id' | 'deviceId' | 'idBoitier' | 'score' | 'reussite' | 'hasSigned'>[] = [];
    const lines = fileContent.split(/\r\n|\n/);
    lines.forEach(line => {
      if (line.trim() === '') return;
      const values = line.split(','); // Supposer un séparateur virgule simple
      if (values.length >= 2) { // Au moins Prénom et Nom
        newParticipants.push({
          firstName: values[0]?.trim() || '',
          lastName: values[1]?.trim() || '',
          prenom: values[0]?.trim() || '', // Duplication pour DBParticipantType
          nom: values[1]?.trim() || '',    // Duplication pour DBParticipantType
          organization: values[2]?.trim() || '',
          identificationCode: values[3]?.trim() || '',
        });
      }
    });
    return newParticipants;
  };

  const parseExcelParticipants = (data: Uint8Array): Omit<FormParticipant, 'id' | 'deviceId' | 'idBoitier' | 'score' | 'reussite' | 'hasSigned'>[] => {
    const newParticipants: Omit<FormParticipant, 'id' | 'deviceId' | 'idBoitier' | 'score' | 'reussite' | 'hasSigned'>[] = [];
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    // Tenter de détecter les en-têtes ou utiliser un ordre fixe
    // Pour cet exemple, on utilise sheet_to_json avec header: 1 pour obtenir un tableau de tableaux
    // et on suppose que les en-têtes sont "Prénom", "Nom", "Organisation", "Code Identification" (ou ordre fixe)
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];

    if (jsonData.length === 0) return newParticipants;

    let headers: string[] = [];
    let dataStartIndex = 0;

    // Simple détection d'en-tête (peut être améliorée)
    const potentialHeaders = jsonData[0].map(h => h.toLowerCase());
    const hasPrenom = potentialHeaders.includes('prénom') || potentialHeaders.includes('prenom');
    const hasNom = potentialHeaders.includes('nom');

    if (hasPrenom && hasNom) {
      headers = potentialHeaders;
      dataStartIndex = 1;
    } else {
      // Pas d'en-têtes détectés, on suppose un ordre fixe: Prénom, Nom, Organisation, Code
      headers = ['prénom', 'nom', 'organisation', 'code identification'];
      dataStartIndex = 0;
    }

    const prenomIndex = headers.findIndex(h => h === 'prénom' || h === 'prenom');
    const nomIndex = headers.findIndex(h => h === 'nom');
    const orgIndex = headers.findIndex(h => h === 'organisation');
    const codeIndex = headers.findIndex(h => h === 'code identification' || h === 'code');


    for (let i = dataStartIndex; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (row.some(cell => cell && cell.trim() !== '')) { // Si la ligne n'est pas vide
        const firstName = prenomIndex !== -1 ? row[prenomIndex]?.trim() || '' : row[0]?.trim() || '';
        const lastName = nomIndex !== -1 ? row[nomIndex]?.trim() || '' : row[1]?.trim() || '';

        if (firstName || lastName) { // Au moins un prénom ou un nom
            newParticipants.push({
            firstName,
            lastName,
            prenom: firstName,
            nom: lastName,
            organization: orgIndex !== -1 ? row[orgIndex]?.trim() || '' : row[2]?.trim() || '',
            identificationCode: codeIndex !== -1 ? row[codeIndex]?.trim() || '' : row[3]?.trim() || '',
            });
        }
      }
    }
    return newParticipants;
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
      } else if (file.name.endsWith('.xlsx') || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.type === 'application/vnd.ms-excel') {
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
      // Réinitialiser l'input file pour permettre la re-sélection du même fichier
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const addImportedParticipants = (
    parsedData: Omit<FormParticipant, 'id' | 'deviceId' | 'idBoitier' | 'score' | 'reussite' | 'hasSigned'>[],
    fileName: string
  ) => {
    if (parsedData.length > 0) {
      const newFormParticipants = parsedData.map((p, index) => ({
        ...p,
        id: `imported-${Date.now()}-${index}`,
        deviceId: participants.length + index + 1, // Attribuer un deviceId logique séquentiel
        idBoitier: '', // Sera mappé au hardware lors de la sauvegarde
        score: undefined,
        reussite: undefined,
        hasSigned: false,
      }));
      setParticipants(prev => [...prev, ...newFormParticipants]);
      setImportSummary(`${parsedData.length} participants importés depuis ${fileName}. Veuillez vérifier et assigner les boîtiers si nécessaire.`);
    } else {
      setImportSummary(`Aucun participant valide trouvé dans ${fileName}.`);
    }
  };


  // --- Fin Logique Import Participants ---


  const handleResultsFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setResultsFile(file || null);
    setImportSummary(null);
    if(file) console.log("Fichier résultats sélectionné:", file.name);
  };

  const handleImportResults = async () => {
    if (!resultsFile) { setImportSummary("Veuillez sélectionner un fichier de résultats."); return; }
    if (!currentSessionDbId || !editingSessionData) { setImportSummary("Aucune session active."); return; }
    setImportSummary("Lecture .ors...");
    try {
      const arrayBuffer = await resultsFile.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      const orSessionXmlFile = zip.file("ORSession.xml");
      if (!orSessionXmlFile) { setImportSummary("Erreur: ORSession.xml introuvable."); return; }
      const xmlString = await orSessionXmlFile.async("string");
      setImportSummary("Parsing XML...");
      const extractedResults: ExtractedResultFromXml[] = parseOmbeaResultsXml(xmlString);
      if (extractedResults.length === 0) { setImportSummary("Aucune réponse extraite."); return; }
      setImportSummary(`${extractedResults.length} réponses extraites. Transformation...`);
      const currentQuestionMappings = editingSessionData.questionMappings;
      if (!currentQuestionMappings || currentQuestionMappings.length === 0) { setImportSummary("Erreur: Mappages questions manquants."); return; }
      const sessionResultsToSave = transformParsedResponsesToSessionResults(extractedResults, currentQuestionMappings, currentSessionDbId);
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
                  const sessionQuestions = await getQuestionsByIds(questionIds);
                  if (sessionQuestions.length > 0) {
                    const updatedParticipants = sessionDataForScores.participants.map((p) => {
                      const participantResults = sessionResultsForScore.filter(r => r.participantIdBoitier === p.idBoitier);
                      const score = calculateParticipantScore(participantResults, sessionQuestions);
                      const themeScores = calculateThemeScores(participantResults, sessionQuestions);
                      const reussite = determineIndividualSuccess(score, themeScores);
                      return { ...p, score, reussite };
                    });
                    await updateSession(currentSessionDbId, { participants: updatedParticipants, updatedAt: new Date().toISOString() });
                    message += "\nScores et réussite calculés et mis à jour.";
                    const finalUpdatedSession = await getSessionById(currentSessionDbId);
                    if (finalUpdatedSession) {
                      setEditingSessionData(finalUpdatedSession);
                      const formParticipantsToUpdate: FormParticipant[] = finalUpdatedSession.participants.map((p_db, index) => {
                        let logicalDeviceId = 0;
                        const currentParticipantState = participants[index];
                        const physicalIdIndex = hardwareDevices.findIndex(hd => hd.physicalId === p_db.idBoitier);
                        if (physicalIdIndex !== -1) { logicalDeviceId = physicalIdIndex + 1; }
                        else if (p_db.idBoitier) { console.warn(`[ImportRésultats] ID Boîtier "${p_db.idBoitier}" non trouvé.`); }
                        return {
                          ...p_db, id: currentParticipantState?.id || `updated-${index}-${Date.now()}`,
                          firstName: p_db.prenom, lastName: p_db.nom, deviceId: logicalDeviceId,
                          organization: currentParticipantState?.organization || (p_db as any).organization,
                          hasSigned: currentParticipantState?.hasSigned || (p_db as any).hasSigned,
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
          } else { setImportSummary("Echec sauvegarde résultats."); }
        } catch (dbError: any) { setImportSummary(`Erreur DB sauvegarde résultats: ${dbError.message}`);}
      } else { setImportSummary("Aucun résultat transformé."); }
    } catch (error: any) { setImportSummary(`Erreur traitement fichier: ${error.message}`); }
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
                readOnly={editingSessionData?.status === 'completed'}
              />
              <Input
                label="Date de la session"
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                required
                readOnly={editingSessionData?.status === 'completed'}
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
                disabled={!!editingSessionData?.questionMappings || editingSessionData?.status === 'completed'}
              />
            </div>
            <div className="mt-4">
              <Input
                label="Lieu de formation"
                placeholder="Ex: Centre de formation Paris Nord"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                readOnly={editingSessionData?.status === 'completed'}
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
                readOnly={editingSessionData?.status === 'completed'}
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
                  disabled={editingSessionData?.status === 'completed'}
                  onClick={() => document.getElementById('participant-file-input')?.click()}
                >
                  Importer Participants
                </Button>
                <Button variant="outline" icon={<UserPlus size={16} />} onClick={handleAddParticipant} disabled={editingSessionData?.status === 'completed'}>Ajouter</Button>
              </div>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Boîtier</th>
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
                    <tr><td className="px-4 py-4 text-center text-sm text-gray-500" colSpan={8}>Aucun participant.</td></tr>
                  ) : (
                    participants.map((participant) => (
                      <tr key={participant.id}>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <Input
                            type="number"
                            value={participant.deviceId?.toString() || ''}
                            onChange={(e) => handleParticipantChange(participant.id, 'deviceId', parseInt(e.target.value,10) || 0)}
                            className="mb-0 w-20 text-center"
                            readOnly={editingSessionData?.status === 'completed'}
                          />
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <Input value={participant.firstName} onChange={(e) => handleParticipantChange(participant.id, 'firstName', e.target.value)} placeholder="Prénom" className="mb-0" readOnly={editingSessionData?.status === 'completed'} />
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <Input value={participant.lastName} onChange={(e) => handleParticipantChange(participant.id, 'lastName', e.target.value)} placeholder="Nom" className="mb-0" readOnly={editingSessionData?.status === 'completed'} />
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <Input value={participant.organization || ''} onChange={(e) => handleParticipantChange(participant.id, 'organization', e.target.value)} placeholder="Organisation" className="mb-0" readOnly={editingSessionData?.status === 'completed'} />
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <Input value={participant.identificationCode || ''} onChange={(e) => handleParticipantChange(participant.id, 'identificationCode', e.target.value)} placeholder="Code" className="mb-0" readOnly={editingSessionData?.status === 'completed'} />
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
                          <Button variant="ghost" disabled={editingSessionData?.status === 'completed'} size="sm" icon={<Trash2 size={16} />} onClick={() => handleRemoveParticipant(participant.id)} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {participants.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg"><p className="text-sm text-blue-800"><strong>Attribution boîtiers :</strong> Le numéro de boîtier est utilisé pour identifier les participants lors de l'import des résultats.</p></div>
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
                    />
                    {resultsFile && <p className="mt-1 text-xs text-green-600">Fichier: {resultsFile.name}</p>}
                  </div>
                  <Button
                    variant="secondary"
                    icon={<FileUp size={16} />}
                    onClick={handleImportResults}
                    disabled={!resultsFile || !editingSessionData?.questionMappings || editingSessionData?.status === 'completed'}
                  >
                    Importer les Résultats
                  </Button>
                  {editingSessionData?.status === 'completed' && (
                       <p className="text-sm text-yellow-700 bg-yellow-100 p-2 rounded-md">Résultats déjà importés (session terminée).</p>
                  )}
                  {editingSessionData && !editingSessionData.questionMappings && editingSessionData.status !== 'completed' && (
                       <p className="text-sm text-yellow-700 bg-yellow-100 p-2 rounded-md">Générez d'abord le .ors pour cette session.</p>
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
                    disabled={isGeneratingOrs || (!selectedReferential && !currentSessionDbId && !editingSessionData?.referentiel) || (!!editingSessionData?.donneesOrs && editingSessionData?.status !== 'planned' && editingSessionData?.status !== 'ready') || editingSessionData?.status === 'completed'}
                    title={(!selectedReferential && !currentSessionDbId && !editingSessionData?.referentiel) ? "Veuillez d'abord sélectionner un référentiel" :
                           (!!editingSessionData?.donneesOrs && editingSessionData?.status !== 'planned' && editingSessionData?.status !== 'ready') ? "Un .ors a déjà été généré et la session n'est plus en attente de démarrage" :
                           editingSessionData?.status === 'completed' ? "La session est terminée" :
                           "Générer le questionnaire .ors et le fichier PPTX"}
                  >
                    {isGeneratingOrs ? "Génération..." : (editingSessionData?.donneesOrs ? "Régénérer .ors & PPTX" : "Générer .ors & PPTX")}
                  </Button>
                  {editingSessionData?.status === 'completed' && (
                     <p className="mt-2 text-sm text-yellow-700">La session est terminée, la génération de l'ORS est bloquée.</p>
                  )}
                   {(!selectedReferential && !currentSessionDbId && !editingSessionData?.referentiel) && (
                     <p className="mt-2 text-sm text-yellow-700">Veuillez sélectionner un référentiel pour activer la génération.</p>
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