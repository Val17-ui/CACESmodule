import React, { useState, useEffect, useCallback } from 'react';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { Save, FileUp, UserPlus, Trash2, PackagePlus, AlertTriangle } from 'lucide-react'; // Ajout AlertTriangle
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
import * as XLSX from 'xlsx';

interface FormParticipant extends DBParticipantType {
  id: string;
  firstName: string;
  lastName: string;
  organization?: string;
  deviceId: number | null; // Modifié pour accepter null (non assigné)
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
    setModifiedAfterOrsGeneration(false);
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
          setModifiedAfterOrsGeneration(false); // Réinitialiser lors du chargement
          const formParticipants: FormParticipant[] = sessionData.participants.map((p_db, loopIndex) => {
            let logicalDeviceId: number | null = null; // Modifié pour accepter null
            const physicalIdIndex = hardwareDevices.findIndex(hd => hd.physicalId === p_db.idBoitier);
            if (physicalIdIndex !== -1) {
              logicalDeviceId = physicalIdIndex + 1;
            } else if (p_db.idBoitier && p_db.idBoitier.trim() !== '') { // S'il y avait un idBoitier mais qu'il ne mappe plus
              console.warn( `L'ID boîtier physique "${p_db.idBoitier}" pour ${p_db.prenom} ${p_db.nom} n'est plus mappé à un boîtier physique actuel. Veuillez réassigner.`);
              // logicalDeviceId reste null pour forcer une nouvelle assignation
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
    if (editingSessionData?.donneesOrs) { setModifiedAfterOrsGeneration(true); }
    const newParticipant: FormParticipant = {
      id: Date.now().toString(), idBoitier: '', nom: '', prenom: '',
      firstName: '', lastName: '', organization: '', identificationCode: '',
      deviceId: null, // Initialiser à null pour forcer une sélection
      hasSigned: false, score: undefined, reussite: undefined,
    };
    setParticipants([...participants, newParticipant]);
  };

  const handleRemoveParticipant = (id: string) => {
    if (editingSessionData?.donneesOrs) { setModifiedAfterOrsGeneration(true); }
    const updatedParticipants = participants.filter(p => p.id !== id);
    // Pas besoin de réindexer deviceId ici, car ils sont logiques et liés à l'ordre d'affichage/hardware.
    // Si on supprime, les suivants ne devraient pas changer leur deviceId assigné automatiquement.
    setParticipants(updatedParticipants);
  };

  const handleParticipantChange = (id: string, field: keyof FormParticipant, value: string | number | boolean | null) => {
    // Ne pas marquer comme modifié si seul deviceId change AVANT génération ORS,
    // ou si le champ deviceId est modifié alors que l'ORS est déjà généré (car il sera bloqué)
    if (editingSessionData?.donneesOrs && field !== 'deviceId') {
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

  const prepareSessionDataForDb = async (includeOrsBlob?: Blob | null): Promise<DBSession | null> => {
    const dbParticipants: DBParticipantType[] = participants.map((p_form) => {
      let assignedPhysicalId = '';
      const logicalDeviceId = p_form.deviceId;
      if (logicalDeviceId && logicalDeviceId > 0 && logicalDeviceId <= hardwareDevices.length) {
        assignedPhysicalId = hardwareDevices[logicalDeviceId - 1].physicalId;
      } else if (p_form.idBoitier && p_form.deviceId === null) {
         // Cas où un idBoitier existait, mais l'utilisateur a vidé le champ deviceId (donc null)
         // On pourrait choisir de conserver l'ancien idBoitier ou de le vider. Pour l'instant, on le vide.
         console.warn( `Participant ${p_form.lastName} (${p_form.firstName}) n'a plus de boîtier assigné.`);
      } else if (logicalDeviceId) { // logicalDeviceId est non null, non 0, mais hors limites
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
            setModifiedAfterOrsGeneration(false); // Reset flag après sauvegarde réussie
            const formParticipants: FormParticipant[] = reloadedSession.participants.map((p_db, index) => {
              let logicalDeviceId: number | null = null;
              const physicalIdIndex = hardwareDevices.findIndex(hd => hd.physicalId === p_db.idBoitier);
              if (physicalIdIndex !== -1) { logicalDeviceId = physicalIdIndex + 1; }
              else if (p_db.idBoitier && p_db.idBoitier.trim() !== '') { console.warn(`[handleSaveSession] ID boîtier "${p_db.idBoitier}" non trouvé pour ${p_db.prenom} ${p_db.nom}.`); }
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
      if (savedId) {
        setImportSummary(`Session (ID: ${savedId}) sauvegardée avec succès !`);
        // setModifiedAfterOrsGeneration(false); // Fait dans handleSaveSession
      }
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

    // Sauvegarder l'état actuel pour s'assurer que les données des participants (avec idBoitier mappés) sont à jour
    let sessionDataForDb = await prepareSessionDataForDb(editingSessionData?.donneesOrs); // Conserver l'ORS existant s'il y en a un
    if (!sessionDataForDb) { setImportSummary("Erreur préparation données session pour vérification."); setIsGeneratingOrs(false); return; }

    const currentSavedId = await handleSaveSession(sessionDataForDb);
    if (!currentSavedId) {
        setImportSummary("Erreur lors de la sauvegarde de la session avant génération ORS.");
        setIsGeneratingOrs(false); return;
    }
    // Recharger les données après sauvegarde pour avoir les idBoitiers les plus à jour
    const upToDateSessionData = await getSessionById(currentSavedId);
    if (!upToDateSessionData) { setImportSummary("Erreur rechargement session après sauvegarde."); setIsGeneratingOrs(false); return; }

    const participantsWithoutIdBoitier = upToDateSessionData.participants.filter(p => !p.idBoitier || p.idBoitier.trim() === '');
    if (participantsWithoutIdBoitier.length > 0) {
      const participantNames = participantsWithoutIdBoitier.map(p => `${p.prenom} ${p.nom}`).join(', ');
      setImportSummary(`Erreur: Participants sans ID de boîtier valide: ${participantNames}. Configurez les boîtiers et assignez-les.`);
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
      // setSelectedBlocksSummary(tempSelectedBlocksSummary); // Fait par handleSaveSession via prepareSessionDataForDb
      if (allSelectedQuestionsForPptx.length === 0) { setImportSummary("Aucune question sélectionnée."); setIsGeneratingOrs(false); return; }

      // Utiliser upToDateSessionData qui a les blocs et participants à jour
      upToDateSessionData.selectionBlocs = Object.entries(tempSelectedBlocksSummary).map(([theme, blockId]) => ({ theme, blockId }));
      // Le statut sera mis à 'ready' après génération réussie de l'ORS

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
      const participantsForGenerator: DBParticipantType[] = upToDateSessionData.participants.map(p_db => ({
        idBoitier: p_db.idBoitier, nom: p_db.nom, prenom: p_db.prenom, identificationCode: p_db.identificationCode,
      }));

      console.log('[SessionForm Gen .ors] Participants sent to generatePresentation:', participantsForGenerator);
      const generationOutput = await generatePresentation(sessionInfoForPptx, participantsForGenerator, allSelectedQuestionsForPptx, globalPptxTemplate, adminSettings);
      if (generationOutput && generationOutput.orsBlob && generationOutput.questionMappings) {
        const { orsBlob, questionMappings } = generationOutput;
        try {
          await updateSession(currentSavedId, { // Utiliser currentSavedId ici
            donneesOrs: orsBlob, questionMappings: questionMappings,
            updatedAt: new Date().toISOString(), status: 'ready',
            selectionBlocs: upToDateSessionData.selectionBlocs // S'assurer que les blocs sélectionnés sont aussi sauvegardés
          });
          setEditingSessionData(await getSessionById(currentSavedId) || null);
          setImportSummary(`Session (ID: ${currentSavedId}) .ors et mappings générés. Statut: Prête.`);
          setModifiedAfterOrsGeneration(false); // Reset flag après génération réussie
        } catch (e: any) { setImportSummary(`Erreur sauvegarde .ors/mappings: ${e.message}`); console.error("Erreur sauvegarde .ors/mappings:", e); }
      } else { setImportSummary("Erreur génération .ors/mappings."); console.error("Erreur génération .ors/mappings. Output:", generationOutput); }
    } catch (error: any) { setImportSummary(`Erreur majeure génération: ${error.message}`); console.error("Erreur majeure génération:", error); }
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
      if (!orSessionXmlFile) { setImportSummary("Erreur: ORSession.xml introuvable dans le .zip."); return; } // Modifié pour .zip
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
                        let logicalDeviceId: number | null = null;
                        const currentParticipantState = participants[index];
                        const physicalIdIndex = hardwareDevices.findIndex(hd => hd.physicalId === p_db.idBoitier);
                        if (physicalIdIndex !== -1) { logicalDeviceId = physicalIdIndex + 1; }
                        else if (p_db.idBoitier && p_db.idBoitier.trim() !== '') { console.warn(`[ImportRésultats] ID Boîtier "${p_db.idBoitier}" non trouvé.`); }
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
    const isReadOnly = editingSessionData?.status === 'completed';
    const isOrsGenerated = !!editingSessionData?.donneesOrs;

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
                readOnly={isReadOnly}
              />
              <Input
                label="Date de la session"
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                required
                readOnly={isReadOnly}
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
                readOnly={isReadOnly}
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
                  disabled={isOrsGenerated || isReadOnly}
                  onClick={() => document.getElementById('participant-file-input')?.click()}
                  title={isOrsGenerated ? "L'import est bloqué car l'ORS a été généré." : "Importer une liste de participants"}
                >
                  Importer Participants
                </Button>
                <Button
                  variant="outline"
                  icon={<UserPlus size={16} />}
                  onClick={handleAddParticipant}
                  disabled={isOrsGenerated || isReadOnly}
                  title={isOrsGenerated ? "L'ajout est bloqué car l'ORS a été généré." : "Ajouter un participant"}
                />
              </div>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Boîtier (Logique)</th>
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
                            value={participant.deviceId === null ? '' : participant.deviceId?.toString()}
                            onChange={(e) => handleParticipantChange(participant.id, 'deviceId', e.target.value === '' ? null : (parseInt(e.target.value,10) || null))}
                            className="mb-0 w-24 text-center"
                            placeholder="N/A"
                            readOnly={isOrsGenerated || isReadOnly}
                          />
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <Input value={participant.firstName} onChange={(e) => handleParticipantChange(participant.id, 'firstName', e.target.value)} placeholder="Prénom" className="mb-0" readOnly={isReadOnly} />
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <Input value={participant.lastName} onChange={(e) => handleParticipantChange(participant.id, 'lastName', e.target.value)} placeholder="Nom" className="mb-0" readOnly={isReadOnly} />
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <Input value={participant.organization || ''} onChange={(e) => handleParticipantChange(participant.id, 'organization', e.target.value)} placeholder="Organisation" className="mb-0" readOnly={isReadOnly} />
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <Input value={participant.identificationCode || ''} onChange={(e) => handleParticipantChange(participant.id, 'identificationCode', e.target.value)} placeholder="Code" className="mb-0" readOnly={isReadOnly} />
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
                            disabled={isOrsGenerated || isReadOnly}
                            size="sm"
                            icon={<Trash2 size={16} />}
                            onClick={() => handleRemoveParticipant(participant.id)}
                            title={isOrsGenerated ? "Suppression bloquée car l'ORS a été généré." : "Supprimer participant"}
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
                      disabled={!editingSessionData?.donneesOrs || isReadOnly} // Désactivé si pas d'ORS ou session terminée
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
                  {isReadOnly && ( // Si la session est terminée
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
                  {modifiedAfterOrsGeneration && isOrsGenerated && !isReadOnly && (
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