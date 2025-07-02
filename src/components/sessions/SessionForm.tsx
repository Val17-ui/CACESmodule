import React, { useState, useEffect, useCallback, ChangeEvent } from 'react';
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
  getAllVotingDevices, // Import function to get voting devices
  VotingDevice,      // Import type for VotingDevice
  db
} from '../../db';
import { generatePresentation, AdminPPTXSettings, QuestionMapping } from '../../utils/pptxOrchestrator';
import { parseOmbeaResultsXml, ExtractedResultFromXml, transformParsedResponsesToSessionResults } from '../../utils/resultsParser';
import { calculateParticipantScore, calculateThemeScores, determineIndividualSuccess } from '../../utils/reportCalculators';
import JSZip from 'jszip';

// const OMBEA_DEVICE_IDS: string[] = [ ... ]; // REMOVED - Will fetch from DB

interface FormParticipant extends DBParticipantType {
  id: string; // Unique ID for React key prop
  firstName: string; // Corresponds to DBParticipantType.prenom
  lastName: string; // Corresponds to DBParticipantType.nom
  organization?: string;
  deviceId: number; // Logical 1-based order/number of the device in the UI (e.g., 1, 2, 3)
  // idBoitier in DBParticipantType will store the physical Ombea ID
  hasSigned?: boolean;
}

interface SessionFormProps {
  sessionIdToLoad?: number;
}

const SessionForm: React.FC<SessionFormProps> = ({ sessionIdToLoad }) => {
  const [currentSessionDbId, setCurrentSessionDbId] = useState<number | null>(sessionIdToLoad || null);
  const [sessionName, setSessionName] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [selectedReferential, setSelectedReferential] = useState<CACESReferential | ''>('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [participants, setParticipants] = useState<FormParticipant[]>([]);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [selectedBlocksSummary, setSelectedBlocksSummary] = useState<Record<string, string>>({});
  const [resultsFile, setResultsFile] = useState<File | null>(null);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [editingSessionData, setEditingSessionData] = useState<DBSession | null>(null);
  const [hardwareDevices, setHardwareDevices] = useState<VotingDevice[]>([]); // State for hardware devices

  useEffect(() => { // Effect to load hardware devices on component mount
    const fetchHardwareDevices = async () => {
      const devicesFromDb = await getAllVotingDevices();
      // Sort by ID to ensure consistent order, similar to HardwareSettings
      setHardwareDevices(devicesFromDb.sort((a, b) => (a.id ?? 0) - (b.id ?? 0)));
    };
    fetchHardwareDevices();
  }, []);

  const resetFormState = useCallback(() => {
    setCurrentSessionDbId(null);
    setSessionName('');
    setSessionDate('');
    setSelectedReferential('');
    setLocation('');
    setNotes('');
    setParticipants([]);
    setTemplateFile(null);
    setSelectedBlocksSummary({});
    setResultsFile(null);
    setImportSummary(null);
    setEditingSessionData(null);
  }, []);

  useEffect(() => {
    if (sessionIdToLoad) {
      const loadSession = async () => {
        const sessionData = await getSessionById(sessionIdToLoad); // Reverted to getSessionById
        setEditingSessionData(sessionData || null);
        if (sessionData) {
          setCurrentSessionDbId(sessionData.id ?? null);
          setSessionName(sessionData.nomSession);
          setSessionDate(sessionData.dateSession ? sessionData.dateSession.split('T')[0] : '');
          setSelectedReferential((sessionData.referentiel as CACESReferential) || '');
          setLocation(sessionData.location || '');
          setNotes(sessionData.notes || '');

          // p_db.idBoitier now stores the PHYSICAL Ombea ID
          const formParticipants: FormParticipant[] = sessionData.participants.map((p_db, loopIndex) => {
            let logicalDeviceId = 0; // Default to 0 if not found, indicating an issue or unassigned
            const physicalIdIndex = hardwareDevices.findIndex(hd => hd.physicalId === p_db.idBoitier);

            if (physicalIdIndex !== -1) {
              logicalDeviceId = physicalIdIndex + 1; // 1-based logical ID from the current hardware config
            } else if (p_db.idBoitier) {
              // If the stored physical ID is not in the current hardware list
              console.warn(
                `L'ID boîtier physique "${p_db.idBoitier}" pour ${p_db.prenom} ${p_db.nom} ` +
                `n'a pas été trouvé dans la configuration matérielle actuelle. Le boîtier logique sera 0.`
              );
              // Keep p_db.idBoitier as is (it's the stored physical ID)
              // logicalDeviceId remains 0, user might need to re-assign or be alerted.
            } else {
              // No physical ID was stored for this participant. Assign based on loop order if needed,
              // but this scenario should ideally be less common with proper assignment.
              // For now, this might mean the participant didn't have a device.
              logicalDeviceId = 0; // Or handle as unassigned
               console.log(`Participant ${p_db.prenom} ${p_db.nom} n'avait pas d'ID boîtier physique stocké.`);
            }

            return {
              ...p_db, // Spreads nom, prenom, score, reussite, identificationCode, and PHYSICAL idBoitier (p_db.idBoitier)
              id: `loaded-${loopIndex}-${p_db.idBoitier}`, // Unique key for React
              firstName: p_db.prenom,
              lastName: p_db.nom,
              deviceId: logicalDeviceId, // Logical number for the form input
              organization: (p_db as any).organization || '',
              hasSigned: (p_db as any).hasSigned || false,
            };
          });
          setParticipants(formParticipants);

          const summary: Record<string, string> = {};
          if(sessionData.selectionBlocs){
            sessionData.selectionBlocs.forEach(sb => {
              summary[sb.theme] = sb.blockId;
            });
          }
          setSelectedBlocksSummary(summary);
        } else {
          console.warn(`Session avec ID ${sessionIdToLoad} non trouvée.`);
          resetFormState();
        }
      };
      loadSession();
    } else {
      resetFormState();
    }
  }, [sessionIdToLoad, resetFormState]);

  const referentialOptions = Object.entries(referentials).map(([value, label]) => ({
    value,
    label: `${value} - ${label}`,
  }));

  const handleAddParticipant = () => {
    const newParticipant: FormParticipant = {
      id: Date.now().toString(),
      idBoitier: (participants.length + 1).toString(),
      nom: '',
      prenom: '',
      firstName: '',
      lastName: '',
      organization: '',
      identificationCode: '',
      deviceId: participants.length + 1,
      hasSigned: false,
      score: undefined,
      reussite: undefined,
    };
    setParticipants([...participants, newParticipant]);
  };

  const handleRemoveParticipant = (id: string) => {
    const updatedParticipants = participants.filter(p => p.id !== id);
    const reindexedParticipants = updatedParticipants.map((p, index) => ({
      ...p,
      deviceId: index + 1,
    }));
    setParticipants(reindexedParticipants);
  };

  const handleParticipantChange = (id: string, field: keyof FormParticipant, value: string | number | boolean) => {
    setParticipants(participants.map(p => {
      if (p.id === id) {
        const updatedP = { ...p, [field]: value };
        if (field === 'firstName') updatedP.prenom = value as string;
        if (field === 'lastName') updatedP.nom = value as string;
        if (field === 'deviceId' && typeof value === 'number') {
            updatedP.idBoitier = value.toString();
        }
        if (field === 'idBoitier' && typeof value === 'string') {
            const numDeviceId = parseInt(value, 10);
            if(!isNaN(numDeviceId)) updatedP.deviceId = numDeviceId;
        }
        return updatedP;
      }
      return p;
    }));
  };

  const prepareSessionDataForDb = async (includeOrsBlob?: Blob | null): Promise<DBSession | null> => {
    if (!selectedReferential && !currentSessionDbId) {
      alert("Veuillez sélectionner un référentiel CACES pour une nouvelle session.");
      return null;
    }

    const dbParticipants: DBParticipantType[] = participants.map((p_form) => {
      let assignedPhysicalId = ''; // Initialize with empty string

      // p_form.deviceId is the logical 1-based number selected by the user in the form.
      const logicalDeviceId = p_form.deviceId;

      if (logicalDeviceId > 0 && logicalDeviceId <= hardwareDevices.length) {
        // The logicalDeviceId is 1-based, so subtract 1 for 0-based array index.
        assignedPhysicalId = hardwareDevices[logicalDeviceId - 1].physicalId;
      } else if (logicalDeviceId !== 0) { // If 0, it means unassigned, so physical ID remains empty.
        // This case means the logicalDeviceId is out of bounds of the current hardware config
        console.warn(
          `Participant ${p_form.lastName} (${p_form.firstName}) a un deviceId logique (${logicalDeviceId}) ` +
          `qui est hors limites par rapport à la configuration matérielle actuelle (taille: ${hardwareDevices.length}). ` +
          `Aucun ID physique ne sera assigné.`
        );
        // assignedPhysicalId remains '', indicating no valid physical device is linked.
        // The application might need further logic to handle participants without a valid assigned device.
      }
      // If logicalDeviceId is 0 (or invalid), assignedPhysicalId remains '', meaning no device is assigned.
      // p_form.idBoitier (from loaded data) isn't directly used here for re-assignment
      // as the source of truth for mapping is now hardwareDevices and p_form.deviceId (logical choice).

      return {
        idBoitier: assignedPhysicalId, // This is the PHYSICAL Ombea ID from hardwareDevices
        nom: p_form.lastName,
        prenom: p_form.firstName,
        identificationCode: p_form.identificationCode,
        score: p_form.score, // Score and reussite are calculated after results import
        reussite: p_form.reussite,
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
      location: location,
      status: sessionToUpdate?.status || 'planned',
      questionMappings: sessionToUpdate?.questionMappings,
      notes: notes,
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
        await updateSession(sessionData.id, sessionData); // Reverted to updateSession
        savedId = sessionData.id;
      } else {
        const newId = await addSession(sessionData); // Reverted to addSession
        if (newId) {
          setCurrentSessionDbId(newId);
          savedId = newId;
        } else {
          setImportSummary("Erreur critique : La nouvelle session n'a pas pu être créée.");
          return null;
        }
      }
      if (savedId) {
         const reloadedSession = await getSessionById(savedId); // Reverted to getSessionById
         setEditingSessionData(reloadedSession || null);
         if (reloadedSession) {
            const formParticipants: FormParticipant[] = reloadedSession.participants.map((p_db, index) => {
              let logicalDeviceId = 0; // Default if mapping fails
              const physicalIdIndex = hardwareDevices.findIndex(hd => hd.physicalId === p_db.idBoitier);
              if (physicalIdIndex !== -1) {
                logicalDeviceId = physicalIdIndex + 1; // 1-based
              } else if (p_db.idBoitier) {
                console.warn(`[handleSaveSession] L'ID boîtier physique "${p_db.idBoitier}" pour ${p_db.prenom} ${p_db.nom} n'est pas dans la config matériel. Boîtier logique sera 0.`);
              }
              return {
                ...p_db,
                id: participants[index]?.id || `form-${index}-${p_db.idBoitier}`, // Preserve React key if possible
                firstName: p_db.prenom,
                lastName: p_db.nom,
                deviceId: logicalDeviceId, // Logical device ID based on current hardware config
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
      }
    }
  };

  const handleGenerateQuestionnaireAndOrs = async () => {
    if (!selectedReferential) { setImportSummary("Veuillez sélectionner un référentiel."); return; }
    if (!templateFile) { setImportSummary("Veuillez sélectionner un fichier modèle PPTX."); return; }

    setImportSummary("Génération .ors...");
    let allSelectedQuestionsForPptx: StoredQuestion[] = [];
    let tempSelectedBlocksSummary: Record<string, string> = {};

    try {
      const baseThemes = await StorageManager.getAllBaseThemesForReferential(selectedReferential);
      if (baseThemes.length === 0) {
        setImportSummary(`Aucun thème trouvé pour ${selectedReferential}.`); return;
      }
      for (const baseTheme of baseThemes) {
        const blockIdentifiers = await StorageManager.getAllBlockIdentifiersForTheme(selectedReferential, baseTheme);
        if (blockIdentifiers.length === 0) { console.warn(`Aucun bloc pour ${baseTheme}`); continue; }
        const chosenBlockIdentifier = blockIdentifiers[Math.floor(Math.random() * blockIdentifiers.length)];
        tempSelectedBlocksSummary[baseTheme] = chosenBlockIdentifier;
        const questionsFromBlock = await StorageManager.getQuestionsForBlock(selectedReferential, baseTheme, chosenBlockIdentifier);
        allSelectedQuestionsForPptx = allSelectedQuestionsForPptx.concat(questionsFromBlock);
      }
      setSelectedBlocksSummary(tempSelectedBlocksSummary);
      if (allSelectedQuestionsForPptx.length === 0) { setImportSummary("Aucune question sélectionnée."); return; }

      let sessionDataForDb = await prepareSessionDataForDb(null);
      if (!sessionDataForDb) { setImportSummary("Erreur préparation données session."); return; }

      sessionDataForDb.selectionBlocs = Object.entries(tempSelectedBlocksSummary).map(([theme, blockId]) => ({ theme, blockId }));
      sessionDataForDb.status = 'planned';

      const savedSessionId = await handleSaveSession(sessionDataForDb);
      if (!savedSessionId) { return; }

      const sessionInfoForPptx = { name: sessionDataForDb.nomSession, date: sessionDataForDb.dateSession, referentiel: sessionDataForDb.referentiel as CACESReferential };
      const adminSettings: AdminPPTXSettings = { defaultDuration: 30, pollTimeLimit: 30, answersBulletStyle: 'ppBulletAlphaUCPeriod', pollStartMode: 'Automatic', chartValueLabelFormat: 'Response_Count', pollCountdownStartMode: 'Automatic', pollMultipleResponse: '1' };

      const participantsForGenerator: DBParticipantType[] = participants.map((p_form, index) => {
        let physicalId = ''; // Initialize with empty string
        // p_form.deviceId is the 1-based logical order from the form
        const logicalDeviceId = p_form.deviceId;

        if (logicalDeviceId > 0 && logicalDeviceId <= hardwareDevices.length) {
          // The logicalDeviceId is 1-based, so subtract 1 for 0-based array index.
          physicalId = hardwareDevices[logicalDeviceId - 1].physicalId;
        } else if (logicalDeviceId !== 0) { // If 0, it means unassigned, so physical ID remains empty.
          console.warn(
            `[SessionForm Gen .ors] Participant ${p_form.lastName} (${p_form.firstName}) ` +
            `a un deviceId logique (${logicalDeviceId}) invalide pour le mapping vers un ID physique (config actuelle: ${hardwareDevices.length} boîtiers). ` +
            `L'ID physique sera vide pour ce participant dans le .ors.`
          );
          // physicalId remains '', as no valid mapping found.
          // The .ors generation might need to handle or skip participants without a physicalId.
        }
        // If logicalDeviceId is 0, physicalId also remains '', meaning no device assigned.

        return {
          idBoitier: physicalId, // This is the PHYSICAL Ombea ID from hardwareDevices
          nom: p_form.lastName,
          prenom: p_form.firstName,
          identificationCode: p_form.identificationCode,
          // score and reussite are not needed for .ors generation itself
        };
      });

      console.log('[SessionForm Gen .ors] Participants being sent to generatePresentation:', participantsForGenerator);

      const generationOutput = await generatePresentation(sessionInfoForPptx, participantsForGenerator, allSelectedQuestionsForPptx, templateFile, adminSettings);

      if (generationOutput && generationOutput.orsBlob && generationOutput.questionMappings) {
        const { orsBlob, questionMappings } = generationOutput;
        try {
          await updateSession(savedSessionId, { // Reverted to updateSession
            donneesOrs: orsBlob,
            questionMappings: questionMappings,
            updatedAt: new Date().toISOString(), status: 'ready'
          });
          setEditingSessionData(await getSessionById(savedSessionId) || null); // Reverted to getSessionById
          setImportSummary(`Session (ID: ${savedSessionId}) .ors et mappings générés. Statut: Prête.`);
        } catch (e: any) { setImportSummary(`Erreur sauvegarde .ors/mappings: ${e.message}`); }
      } else { setImportSummary("Erreur génération .ors/mappings. Données manquantes."); }
    } catch (error: any) { setImportSummary(`Erreur majeure génération: ${error.message}`); }
  };


  const handleResultsFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setResultsFile(file || null);
    setImportSummary(null);
    if(file) console.log("Fichier résultats sélectionné:", file.name);
  };

  const handleImportResults = async () => {
    if (!resultsFile) { setImportSummary("Veuillez sélectionner un fichier de résultats."); return; }
    if (!currentSessionDbId || !editingSessionData) { setImportSummary("Aucune session active ou données de session non chargées."); return; }

    setImportSummary("Lecture .ors...");
    try {
      const arrayBuffer = await resultsFile.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      const orSessionXmlFile = zip.file("ORSession.xml");
      if (!orSessionXmlFile) { setImportSummary("Erreur: ORSession.xml introuvable."); return; }
      const xmlString = await orSessionXmlFile.async("string");
      setImportSummary("Parsing XML...");

      const extractedResults: ExtractedResultFromXml[] = parseOmbeaResultsXml(xmlString);
      // console.log("[SessionForm Import Log] Extracted Results from XML:", extractedResults.slice(0, 5)); // DEBUG
      if (extractedResults.length === 0) { setImportSummary("Aucune réponse extraite."); return; }
      setImportSummary(`${extractedResults.length} réponses extraites. Transformation...`);

      const currentQuestionMappings = editingSessionData.questionMappings;
      // console.log("[SessionForm Import Log] Current Question Mappings for transformation:", currentQuestionMappings); // DEBUG
      if (!currentQuestionMappings || currentQuestionMappings.length === 0) { setImportSummary("Erreur: Mappages questions manquants."); return; }

      const sessionResultsToSave = transformParsedResponsesToSessionResults(extractedResults, currentQuestionMappings, currentSessionDbId);
      // console.log("[SessionForm Import Log] SessionResults to Save (first 5):", sessionResultsToSave.slice(0,5)); // DEBUG

      if (sessionResultsToSave.length > 0) {
        try {
          const savedResultIds = await addBulkSessionResults(sessionResultsToSave); // Reverted to addBulkSessionResults
          // console.log("[SessionForm Import Log] Saved Result IDs from DB:", savedResultIds); // DEBUG
          if (savedResultIds && savedResultIds.length > 0) {
            let message = `${savedResultIds.length} résultats sauvegardés !`;
            let sessionProcessError: string | null = null;
            try {
              if (currentSessionDbId) {
                await updateSession(currentSessionDbId, { status: 'completed', updatedAt: new Date().toISOString() }); // Reverted to updateSession
                message += "\nStatut session: 'Terminée'.";

                const sessionResultsForScore: SessionResult[] = await getResultsForSession(currentSessionDbId); // Reverted to getResultsForSession
                // console.log("[SessionForm Import Log] Fetched SessionResults for score calculation (first 5):", sessionResultsForScore.slice(0,5)); // DEBUG
                let sessionDataForScores = await getSessionById(currentSessionDbId); // Reverted to getSessionById
                // console.log("[SessionForm Import Log] SessionData for score calculation:", sessionDataForScores); // DEBUG

                if (sessionDataForScores && sessionDataForScores.questionMappings && sessionResultsForScore.length > 0) {
                  const questionIds = sessionDataForScores.questionMappings.map(q => q.dbQuestionId).filter((id): id is number => id !== null && id !== undefined);
                  const sessionQuestions = await getQuestionsByIds(questionIds);
                  // console.log("[SessionForm Import Log] SessionQuestions for score calculation (first 5):", sessionQuestions.slice(0,5)); // DEBUG

                  if (sessionQuestions.length > 0) {
                    const updatedParticipants = sessionDataForScores.participants.map((p, pIndex) => {
                      /* DEBUG Start
                      if (pIndex < 2) {
                        console.log(`[SessionForm ScoreCalc Debug] Participant p (index ${pIndex}):`, JSON.stringify(p));
                        console.log(`[SessionForm ScoreCalc Debug] Valeur de p.idBoitier pour ce participant: ${p.idBoitier}`);
                        console.log(`[SessionForm ScoreCalc Debug] Comparaison : r.participantIdBoitier (ex: ${sessionResultsForScore[0]?.participantIdBoitier}) vs p.idBoitier (${p.idBoitier})`);
                      }
                      DEBUG End */
                      const participantResults = sessionResultsForScore.filter(r => r.participantIdBoitier === p.idBoitier);
                      /* DEBUG Start
                      if (pIndex < 2) { // Log for first 2 participants
                        console.log(`[SessionForm Import Log] For participant ${p.idBoitier} (${p.nom}), their results for scoring (first 5):`, participantResults.slice(0,5));
                        console.log(`[SessionForm Import Log] All sessionQuestions for ${p.idBoitier} (${p.nom}) scoring (first 5):`, sessionQuestions.slice(0,5));
                      }
                      DEBUG End */
                      const score = calculateParticipantScore(participantResults, sessionQuestions);
                      const themeScores = calculateThemeScores(participantResults, sessionQuestions);
                      const reussite = determineIndividualSuccess(score, themeScores);
                      /* DEBUG Start
                       if (pIndex < 2) {
                        console.log(`[SessionForm Import Log] Participant ${p.idBoitier} (${p.nom}) - Calculated Score: ${score}, Reussite: ${reussite}, ThemeScores:`, themeScores);
                      }
                      DEBUG End */
                      return { ...p, score, reussite };
                    });
                    // console.log("[SessionForm Import Log] UpdatedParticipants with scores (first 2):", updatedParticipants.slice(0,2)); // DEBUG

                    await updateSession(currentSessionDbId, { participants: updatedParticipants, updatedAt: new Date().toISOString() }); // Reverted to updateSession
                    message += "\nScores et réussite calculés et mis à jour.";

                    const finalUpdatedSession = await getSessionById(currentSessionDbId); // Reverted to getSessionById
                    // console.log("[SessionForm Import Log] Final reloaded session data after score update:", finalUpdatedSession); // DEBUG
                    if (finalUpdatedSession) {
                      setEditingSessionData(finalUpdatedSession);
                      // console.log("[SessionForm Import Log] Participants from final reloaded session (first 2):", finalUpdatedSession.participants.slice(0,2)); // DEBUG
                      const formParticipantsToUpdate: FormParticipant[] = finalUpdatedSession.participants.map((p_db, index) => {
                        let logicalDeviceId = 0; // Default if mapping fails
                        const currentParticipantState = participants[index]; // For preserving non-DB state like 'organization'
                        const physicalIdIndex = hardwareDevices.findIndex(hd => hd.physicalId === p_db.idBoitier);

                        if (physicalIdIndex !== -1) {
                          logicalDeviceId = physicalIdIndex + 1; // 1-based
                        } else if (p_db.idBoitier) {
                          console.warn(`[handleImportResults] L'ID boîtier physique "${p_db.idBoitier}" pour ${p_db.prenom} ${p_db.nom} (après import résultats) n'est pas dans la config matériel. Boîtier logique sera 0.`);
                        }
                        return {
                          ...p_db,
                          id: currentParticipantState?.id || `updated-${index}-${p_db.idBoitier}`,
                          firstName: p_db.prenom,
                          lastName: p_db.nom,
                          deviceId: logicalDeviceId,
                          organization: currentParticipantState?.organization || (p_db as any).organization,
                          hasSigned: currentParticipantState?.hasSigned || (p_db as any).hasSigned,
                        };
                      });
                      setParticipants(formParticipantsToUpdate);
                    }
                  } else { message += "\nImpossible de charger les questions pour le calcul des scores."; }
                } else { message += "\nImpossible de calculer les scores (données de session ou résultats manquants)."; }
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

  const handleBackToList = () => {
    if (!sessionIdToLoad && !currentSessionDbId) {
        resetFormState();
    }
  };

  const commonInputProps = (isCompletedOrReadOnly: boolean) => ({
    readOnly: isCompletedOrReadOnly,
  });
  const fileInputProps = (isDisabled: boolean) => ({
    disabled: isDisabled,
  });

  return (
    <div>
      <Card title={currentSessionDbId ? `Modification Session (ID: ${currentSessionDbId}) - Statut: ${editingSessionData?.status || 'N/A'}` : "Nouvelle session"} className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* @ts-ignore */}
          <Input
            label="Nom de la session"
            placeholder="Ex: Formation CACES R489 - Groupe A"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            required
            {...commonInputProps(editingSessionData?.status === 'completed')}
          />
          {/* @ts-ignore */}
          <Input
            label="Date de la session"
            type="date"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            required
            {...commonInputProps(editingSessionData?.status === 'completed')}
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
          {/* @ts-ignore */}
          <Input
            label="Lieu de formation"
            placeholder="Ex: Centre de formation Paris Nord"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            {...commonInputProps(editingSessionData?.status === 'completed')}
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
        <div className="mt-6">
          <label htmlFor="templateFileInput" className="block text-sm font-medium text-gray-700 mb-1">Modèle PPTX</label>
          {/* @ts-ignore */}
          <Input
            id="templateFileInput"
            type="file"
            accept=".pptx"
            onChange={(e: ChangeEvent<HTMLInputElement>) => setTemplateFile(e.target.files ? e.target.files[0] : null)}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            {...fileInputProps(!!editingSessionData?.donneesOrs || editingSessionData?.status === 'completed')}
          />
          {templateFile && <p className="mt-1 text-xs text-green-600">Fichier: {templateFile.name}</p>}
          {editingSessionData?.donneesOrs && !templateFile && (
            <p className="mt-1 text-xs text-blue-600">Un .ors a déjà été généré. Pour le régénérer, sélectionnez un nouveau modèle.</p>
          )}
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

      {currentSessionDbId && (
        <Card title="Résultats de la Session (Import)" className="mb-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="resultsFileInput" className="block text-sm font-medium text-gray-700 mb-1">Fichier résultats (.ors)</label>
              {/* @ts-ignore */}
              <Input
                id="resultsFileInput"
                type="file"
                accept=".ors"
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
            <p className="text-xs text-gray-500">Importez le fichier .ors après le vote.</p>
            {importSummary && (
              <div className={`mt-4 p-3 rounded-md text-sm ${importSummary.toLowerCase().includes("erreur") || importSummary.toLowerCase().includes("échoué") || importSummary.toLowerCase().includes("impossible") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                <p style={{ whiteSpace: 'pre-wrap' }}>{importSummary}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card title="Participants" className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-gray-500">Gérez la liste des participants.</p>
          <div className="flex space-x-3">
            <Button variant="outline" icon={<FileUp size={16} />} disabled={editingSessionData?.status === 'completed'}>Importer CSV</Button>
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
                      {/* @ts-ignore */}
                      <Input
                        type="number"
                        value={participant.deviceId?.toString() || ''}
                        onChange={(e) => handleParticipantChange(participant.id, 'deviceId', parseInt(e.target.value,10) || 0)}
                        className="mb-0 w-20 text-center"
                        {...commonInputProps(editingSessionData?.status === 'completed')}
                      />
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {/* @ts-ignore */}
                      <Input value={participant.firstName} onChange={(e) => handleParticipantChange(participant.id, 'firstName', e.target.value)} placeholder="Prénom" className="mb-0" {...commonInputProps(editingSessionData?.status === 'completed')} />
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {/* @ts-ignore */}
                      <Input value={participant.lastName} onChange={(e) => handleParticipantChange(participant.id, 'lastName', e.target.value)} placeholder="Nom" className="mb-0" {...commonInputProps(editingSessionData?.status === 'completed')} />
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {/* @ts-ignore */}
                      <Input value={participant.organization || ''} onChange={(e) => handleParticipantChange(participant.id, 'organization', e.target.value)} placeholder="Organisation" className="mb-0" {...commonInputProps(editingSessionData?.status === 'completed')} />
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {/* @ts-ignore */}
                      <Input value={participant.identificationCode || ''} onChange={(e) => handleParticipantChange(participant.id, 'identificationCode', e.target.value)} placeholder="Code" className="mb-0" {...commonInputProps(editingSessionData?.status === 'completed')} />
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700 text-center">
                      {participant.score !== undefined ? participant.score : '-'}
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

      <div className="flex justify-between items-center mt-8">
        <Button variant="outline" onClick={handleBackToList}>
            Retour à la liste
        </Button>
        <div className="space-x-3">
          <Button variant="outline" icon={<Save size={16} />} onClick={handleSaveDraft} disabled={editingSessionData?.status === 'completed'}>
            Enregistrer Brouillon
          </Button>
          <Button variant="primary" icon={<PackagePlus size={16} />} onClick={handleGenerateQuestionnaireAndOrs} disabled={!!editingSessionData?.donneesOrs || editingSessionData?.status === 'completed'}>
            {editingSessionData?.donneesOrs ? "Régénérer .ors" : "Générer .ors & PPTX"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SessionForm;