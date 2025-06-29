import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import { Save, FileUp, UserPlus, Trash2, PackagePlus } from 'lucide-react';
import {
  CACESReferential,
  referentials,
  Participant as FormParticipant, // Renommer pour éviter confusion avec DBParticipant
  Session as DBSession,
  Participant as DBParticipant,
  SelectedBlock as DBSelectedBlock,
  CACESReferential as DBCACESReferential
} from '../../types';
import { StorageManager } from '../../services/StorageManager';
// StoredQuestion est l'équivalent de QuestionWithId dans db.ts
// Nous utiliserons QuestionWithId directement pour clarifier que c'est l'objet DB.
import { QuestionWithId as StoredQuestion, addSession, updateSession, getSessionById, getQuestionsForSessionBlocks, addBulkSessionResults, getQuestionById } from '../../db';
import { generatePresentation, AdminPPTXSettings } from '../../utils/pptxOrchestrator';
import { parseOmbeaResultsXml, ExtractedResultFromXml, transformParsedResponsesToSessionResults } from '../../utils/resultsParser'; // Importer le parser, ExtractedResultFromXml et transformParsedResponsesToSessionResults
import JSZip from 'jszip'; // Importer JSZip


// Interface pour les props du composant, si on veut charger une session existante
interface SessionFormProps {
  sessionIdToLoad?: number; // ID de la session à charger pour édition
}

const SessionForm: React.FC<SessionFormProps> = ({ sessionIdToLoad }) => {
  const [currentSessionDbId, setCurrentSessionDbId] = useState<number | null>(sessionIdToLoad || null);
  const [sessionName, setSessionName] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [selectedReferential, setSelectedReferential] = useState<CACESReferential | ''>('');
  const [location, setLocation] = useState(''); // Ajouté pour correspondre au plan
  const [notes, setNotes] = useState('');
  // Utiliser FormParticipant pour l'état local du formulaire
  const [participants, setParticipants] = useState<FormParticipant[]>([]);
  const [generatedQuestions, setGeneratedQuestions] = useState<StoredQuestion[]>([]);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [selectedBlocksSummary, setSelectedBlocksSummary] = useState<Record<string, string>>({});
  const [resultsFile, setResultsFile] = useState<File | null>(null);
  const [importSummary, setImportSummary] = useState<string | null>(null); // État pour le résumé de l'import


  useEffect(() => {
    if (sessionIdToLoad) {
      const loadSession = async () => {
        const sessionData = await getSessionById(sessionIdToLoad);
        if (sessionData) {
          setCurrentSessionDbId(sessionData.id ?? null);
          setSessionName(sessionData.nomSession);
          setSessionDate(sessionData.dateSession.split('T')[0]); // Format YYYY-MM-DD pour input date
          setSelectedReferential((sessionData.referentiel as CACESReferential) || '');
          setLocation(sessionData.location || ''); // Charger location
          // setNotes(sessionData.notes || ''); // Si notes est ajoutée à DBSession

          // Mapper DBParticipant vers FormParticipant
          const formParticipants: FormParticipant[] = sessionData.participants.map((p, index) => ({
            id: `loaded-${index}-${p.idBoitier}`, // Créer un ID unique pour le formulaire
            firstName: p.prenom,
            lastName: p.nom,
            identificationCode: p.identificationCode,
            deviceId: parseInt(p.idBoitier, 10), // Assumer idBoitier est un nombre stringifiable
            hasSigned: false, // Ou charger depuis DB si ce champ est ajouté
            // organization: p.organization || '', // Si ajouté à DBParticipant
          }));
          setParticipants(formParticipants);

          const summary: Record<string, string> = {};
          sessionData.selectionBlocs.forEach(sb => {
            summary[sb.theme] = sb.blockId;
          });
          setSelectedBlocksSummary(summary);
          // Le fichier .ors (Blob) et templateFile ne sont pas rechargés directement ici
          // L'utilisateur devrait re-sélectionner le template si regénération.
        } else {
          console.warn(`Session avec ID ${sessionIdToLoad} non trouvée.`);
          // Gérer le cas où la session n'est pas trouvée (ex: rediriger, afficher message)
        }
      };
      loadSession();
    }
  }, [sessionIdToLoad]);


  const referentialOptions = Object.entries(referentials).map(([value, label]) => ({
    value,
    label: `${value} - ${label}`,
  }));

  const handleAddParticipant = () => {
    // Utilisation de FormParticipant
    const newParticipant: FormParticipant = {
      id: Date.now().toString(), // ID unique pour la gestion du formulaire
      firstName: '',
      lastName: '',
      // organization: '', // Décommenter si ajouté à FormParticipant
      identificationCode: '',
      deviceId: participants.length + 1, // Attribuer un deviceId séquentiel
      hasSigned: false,
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

  // S'assurer que field est bien une clé de FormParticipant
  const handleParticipantChange = (id: string, field: keyof FormParticipant, value: string | number | boolean) => {
    setParticipants(participants.map(p =>
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const prepareSessionDataForDb = async (includeOrsBlob: Blob | null = null): Promise<DBSession | null> => {
    if (!selectedReferential) {
      alert("Veuillez sélectionner un référentiel CACES.");
      return null;
    }

    const dbParticipants: DBParticipant[] = participants.map(p => ({
      idBoitier: p.deviceId.toString(),
      nom: p.lastName,
      prenom: p.firstName,
      identificationCode: p.identificationCode,
    }));

    let currentSelectedBlocksSummary = selectedBlocksSummary;
    // Si selectedBlocksSummary est vide (ex: sauvegarde brouillon avant génération questions)
    // et que nous avons un référentiel, on pourrait tenter de le peupler ici
    // ou laisser vide et le remplir seulement lors de la génération de questionnaire.
    // Pour l'instant, on utilise ce qui est dans l'état.
    if (Object.keys(currentSelectedBlocksSummary).length === 0 && selectedReferential) {
        // Logique pour sélectionner les blocs si non fait (optionnel pour brouillon)
        // Pour l'instant, on le laisse potentiellement vide pour un brouillon simple.
        console.log("Aucun bloc sélectionné, sauvegarde de session sans sélection de blocs détaillée.");
    }


    const dbSelectedBlocks: DBSelectedBlock[] = Object.entries(currentSelectedBlocksSummary).map(([theme, blockId]) => ({
      theme: theme,
      blockId: blockId,
    }));

    const sessionToSave: DBSession = {
      id: currentSessionDbId || undefined,
      nomSession: sessionName || `Session du ${new Date().toLocaleDateString()}`,
      dateSession: sessionDate || new Date().toISOString().split('T')[0],
      referentiel: selectedReferential as DBCACESReferential,
      participants: dbParticipants,
      selectionBlocs: dbSelectedBlocks,
      donneesOrs: includeOrsBlob,
      location: location,
      status: currentSessionDbId ? (sessionDataFromDb?.status || 'planned') : 'planned', // Statut par défaut à 'planned' pour nouvelle session
      // notes: notes,
      createdAt: currentSessionDbId ? undefined : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    // Si on met à jour, on ne veut pas écraser le statut existant avec 'planned' sauf si non défini
    if (currentSessionDbId && sessionDataFromDb?.status) {
      sessionToSave.status = sessionDataFromDb.status;
    }
    // Si includeOrsBlob est présent et qu'on n'a pas déjà un statut final, on peut le mettre à 'ready'
    if (includeOrsBlob && sessionToSave.status !== 'completed' && sessionToSave.status !== 'in-progress' && sessionToSave.status !== 'cancelled') {
        // This logic is now primarily in handleGenerateQuestionnaireAndOrs
        // but if prepareSessionDataForDb is called directly with a blob, it could apply here.
        // For now, 'ready' status is set explicitly after successful ORS update.
    }

    return sessionToSave;
  };

  // Variable pour stocker les données de la session chargée pour la modification du statut
  let sessionDataFromDb: DBSession | null = null;
  useEffect(() => {
    if (sessionIdToLoad) {
      const loadSessionData = async () => {
        sessionDataFromDb = await getSessionById(sessionIdToLoad);
      }
      loadSessionData();
    }
  }, [sessionIdToLoad]);


  const handleSaveSession = async (sessionData: DBSession | null) => {
    if (!sessionData) return null;

    try {
      if (sessionData.id) { // Mise à jour d'une session existante
        await updateSession(sessionData.id, sessionData);
        alert(`Session (ID: ${sessionData.id}) mise à jour avec succès !`);
        return sessionData.id;
      } else { // Création d'une nouvelle session
        const newId = await addSession(sessionData);
        if (newId) {
          setCurrentSessionDbId(newId);
          alert(`Session sauvegardée avec succès (ID: ${newId}) !`);
          return newId;
        } else {
          alert("Erreur lors de la sauvegarde de la session.");
          return null;
        }
      }
    } catch (error) {
      console.error("Erreur lors de la sauvegarde de la session:", error);
      alert("Une erreur est survenue lors de la sauvegarde.");
      return null;
    }
  };

  const handleSaveDraft = async () => {
    const sessionData = await prepareSessionDataForDb();
    if (sessionData) {
      await handleSaveSession(sessionData);
    }
  };

  const handleGenerateQuestionnaireAndOrs = async () => {
    if (!selectedReferential) {
      alert("Veuillez sélectionner un référentiel CACES.");
      return;
    }
    if (!templateFile) {
      alert("Veuillez sélectionner un fichier modèle PPTX.");
      return;
    }

    console.log(`Génération du questionnaire pour : ${selectedReferential} avec ${templateFile.name}`);
    setGeneratedQuestions([]);

    // Logique de sélection des questions (reprise et adaptée)
    let allSelectedQuestionsForPptx: StoredQuestion[] = [];
    let tempSelectedBlocksSummary: Record<string, string> = {};

    try {
      const baseThemes = await StorageManager.getAllBaseThemesForReferential(selectedReferential);
      if (baseThemes.length === 0) {
        alert(`Aucun thème trouvé pour ${selectedReferential}.`);
        return;
      }

      for (const baseTheme of baseThemes) {
        const blockIdentifiers = await StorageManager.getAllBlockIdentifiersForTheme(selectedReferential, baseTheme);
        if (blockIdentifiers.length === 0) {
          console.warn(`Aucun bloc pour ${baseTheme} dans ${selectedReferential}.`);
          continue;
        }
        const chosenBlockIdentifier = blockIdentifiers[Math.floor(Math.random() * blockIdentifiers.length)];
        tempSelectedBlocksSummary[baseTheme] = chosenBlockIdentifier;
        const questionsFromBlock = await StorageManager.getQuestionsForBlock(selectedReferential, baseTheme, chosenBlockIdentifier);
        allSelectedQuestionsForPptx = allSelectedQuestionsForPptx.concat(questionsFromBlock);
      }

      setGeneratedQuestions(allSelectedQuestionsForPptx); // Pour affichage/debug
      setSelectedBlocksSummary(tempSelectedBlocksSummary); // Mettre à jour l'état avec les blocs réellement sélectionnés
      console.log("Blocs sélectionnés:", tempSelectedBlocksSummary);
      console.log(`${allSelectedQuestionsForPptx.length} questions pour le questionnaire.`);

      if (allSelectedQuestionsForPptx.length === 0) {
        alert("Aucune question sélectionnée. Vérifiez la bibliothèque.");
        return;
      }

      // Préparer les données de session MAIS sans le Blob ORS pour l'instant
      // On sauvegarde la session avec les blocs sélectionnés avant de générer le .ors
      let sessionDataForDb = await prepareSessionDataForDb(null);
      if (!sessionDataForDb) return;

      // Mettre à jour selectionBlocs avec ceux réellement utilisés pour cette génération
      sessionDataForDb.selectionBlocs = Object.entries(tempSelectedBlocksSummary).map(([theme, blockId]) => ({
        theme: theme,
        blockId: blockId,
      }));

      const savedSessionId = await handleSaveSession(sessionDataForDb);
      if (!savedSessionId) {
        alert("La session n'a pas pu être sauvegardée avant la génération du .ors.");
        return;
      }
      // S'assurer que currentSessionDbId est à jour pour la suite
      if(!currentSessionDbId) setCurrentSessionDbId(savedSessionId);


      const sessionInfoForPptx = {
        name: sessionDataForDb.nomSession,
        date: sessionDataForDb.dateSession,
        referential: sessionDataForDb.referentiel as CACESReferential,
      };

      const adminSettings: AdminPPTXSettings = {
        defaultDuration: 30, pollTimeLimit: 30, answersBulletStyle: 'ppBulletAlphaUCPeriod',
        pollStartMode: 'Automatic', chartValueLabelFormat: 'Response_Count',
        pollCountdownStartMode: 'Automatic', pollMultipleResponse: '1',
      };

      // generatePresentation retourne maintenant { orsBlob, questionMappings }
      const generationOutput = await generatePresentation(
        sessionInfoForPptx,
        participants,
        allSelectedQuestionsForPptx,
        templateFile,
        adminSettings
      );

      console.log("Retour de generatePresentation:", generationOutput);

      if (generationOutput && generationOutput.orsBlob instanceof Blob && generationOutput.questionMappings) {
        const { orsBlob, questionMappings } = generationOutput;
        console.log("Blob .ors reçu, taille:", orsBlob.size, "type:", orsBlob.type);
        console.log("QuestionMappings reçus:", questionMappings);
        try {
          await updateSession(savedSessionId, {
            donneesOrs: orsBlob,
            questionMappings: questionMappings, // Sauvegarder les mappings
            updatedAt: new Date().toISOString(),
            status: 'ready'
          });
          console.log(`Session (ID: ${savedSessionId}) mise à jour avec le Blob .ors et les questionMappings.`);
          alert(`Questionnaire, .ors générés et session (ID: ${savedSessionId}) mise à jour avec le fichier .ors et les mappages de questions! Statut mis à Prête.`);
        } catch (e) {
          console.error("Erreur lors de updateSession avec le Blob .ors et questionMappings:", e);
          alert("Erreur lors de la sauvegarde du fichier .ors ou des mappages dans la session. Vérifiez la console.");
        }
      } else {
        let errorMsg = "generatePresentation n'a pas retourné toutes les données nécessaires.";
        if (!generationOutput?.orsBlob) errorMsg += " Le Blob .ors est manquant.";
        if (!generationOutput?.questionMappings) errorMsg += " Les questionMappings sont manquants.";
        console.warn(errorMsg, "Type de orsBlob reçu:", typeof generationOutput?.orsBlob, "QuestionMappings:", generationOutput?.questionMappings);
        alert("Génération PPTX terminée, mais le fichier .ors ou les données de mappage n'ont pas pu être sauvegardés dans la base de données de session.");
      }

    } catch (error) {
      console.error("Erreur lors de la génération questionnaire/PPTX ou sauvegarde:", error);
      alert("Une erreur est survenue. Vérifiez la console.");
    }
  };

  const handleResultsFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setResultsFile(file);
      setImportSummary(null); // Réinitialiser le résumé si un nouveau fichier est sélectionné
      console.log("Fichier de résultats sélectionné:", file.name);
    } else {
      setResultsFile(null);
      setImportSummary(null);
    }
  };

  const handleImportResults = async () => {
    if (!resultsFile) {
      alert("Veuillez d'abord sélectionner un fichier de résultats.");
      return;
    }
    if (!currentSessionDbId) {
      alert("Aucune session active pour associer les résultats. Ceci ne devrait pas arriver.");
      return;
    }

    console.log(`Importation des résultats depuis le fichier .ors: ${resultsFile.name} pour la session ID: ${currentSessionDbId}`);
    setImportSummary("Lecture du fichier .ors en cours...");

    try {
      const arrayBuffer = await resultsFile.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      const orSessionXmlFile = zip.file("ORSession.xml"); // Nom exact du fichier XML dans l'archive .ors

      if (!orSessionXmlFile) {
        setImportSummary("Erreur : Le fichier 'ORSession.xml' est introuvable dans l'archive .ors fournie.");
        return;
      }

      const xmlString = await orSessionXmlFile.async("string");
      console.log("Contenu de ORSession.xml extrait:", xmlString.substring(0, 1000) + "...");
      setImportSummary("ORSession.xml extrait, parsing des réponses...");

      const extractedResults: ExtractedResultFromXml[] = parseOmbeaResultsXml(xmlString);

      if (extractedResults.length === 0) {
        setImportSummary("Aucune réponse brute n'a pu être extraite du fichier ORSession.xml. Vérifiez le contenu du fichier ou les logs console.");
        return;
      }
      console.log("Résultats bruts extraits du XML:", extractedResults);
      setImportSummary(`${extractedResults.length} réponses brutes extraites. Transformation en cours...`);

      // Récupérer les détails de la session actuelle pour obtenir questionMappings
      const currentSessionData = await getSessionById(currentSessionDbId);
      if (!currentSessionData || !currentSessionData.questionMappings) {
        setImportSummary("Erreur : Impossible de récupérer les mappages de questions pour la session actuelle. L'import ne peut continuer.");
        console.error("currentSessionData ou currentSessionData.questionMappings est manquant/vide", currentSessionData);
        return;
      }

      // Récupérer les QuestionWithId correspondant aux dbQuestionId dans les questionMappings
      // Cela est nécessaire pour avoir les détails complets des questions (ex: texte, options, etc.) si besoin pour la transformation,
      // bien que transformParsedResponsesToSessionResults utilise principalement les IDs pour le mappage.
      // On pourrait optimiser cela si seuls les IDs sont nécessaires pour la transformation.
      const questionIdsFromMappings = currentSessionData.questionMappings.map(qm => qm.dbQuestionId);
      const questionsInSession: StoredQuestion[] = [];
      for (const id of questionIdsFromMappings) {
        const q = await getQuestionById(id); // Assurez-vous que getQuestionById existe et fonctionne
        if (q) questionsInSession.push(q);
      }
       if (questionsInSession.length !== questionIdsFromMappings.length) {
        console.warn("Certaines questions mappées n'ont pas pu être récupérées de la DB.");
      }


      const sessionResultsToSave = transformParsedResponsesToSessionResults(
        extractedResults,
        questionsInSession, // questionsInSession contient maintenant les QuestionWithId complètes
        currentSessionDbId
      );

      if (sessionResultsToSave.length > 0) {
        console.log("SessionResults à sauvegarder:", sessionResultsToSave);
        try {
          const savedResultIds = await addBulkSessionResults(sessionResultsToSave);
          if (savedResultIds && savedResultIds.length > 0) {
            let message = `${savedResultIds.length} résultats de session ont été sauvegardés avec succès !`;
            try {
              if (currentSessionDbId) { // S'assurer que currentSessionDbId est bien disponible
                await updateSession(currentSessionDbId, { status: 'completed', updatedAt: new Date().toISOString() });
                message += "\nLe statut de la session a été mis à jour à 'Terminée'.";
                // Mettre à jour l'état local si nécessaire pour refléter immédiatement le changement de statut si le form reste affiché
                // ou si sessionDataFromDb est utilisé pour afficher le statut dans ce composant.
              }
            } catch (statusUpdateError) {
              console.error("Erreur lors de la mise à jour du statut de la session:", statusUpdateError);
              message += "\nErreur lors de la mise à jour du statut de la session.";
            }
            setImportSummary(message); // Afficher le message de succès/erreur
            setResultsFile(null); // Réinitialiser le champ fichier après import
          } else {
            setImportSummary("La sauvegarde des résultats de session semble avoir échoué (aucun ID retourné).");
          }
        } catch (dbError: any) {
          console.error("Erreur lors de la sauvegarde des résultats en base de données:", dbError);
          setImportSummary(`Une erreur est survenue lors de la sauvegarde des résultats en base de données: ${dbError.message}`);
        }
      } else {
        setImportSummary("Aucun résultat de session n'a pu être transformé ou n'était disponible pour la sauvegarde. Vérifiez les logs pour les erreurs de mappage de question.");
      }

    } catch (error: any) {
      console.error("Erreur lors du traitement du fichier de résultats:", error);
      setImportSummary(`Erreur lors du traitement du fichier: ${error.message}`);
    }
  };


  return (
    <div>
      <Card title={currentSessionDbId ? `Modification de la session (ID: ${currentSessionDbId})` : "Nouvelle session"} className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label="Nom de la session"
            placeholder="Ex: Formation CACES R489 - Groupe A"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            required
          />
          
          <Input
            label="Date de la session"
            type="date"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            required
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
          />
          
          {/* Le champ "Questionnaire associé" a été supprimé car la création de session
              implique maintenant la génération dynamique d'un questionnaire. */}
        </div>
        
        <div className="mt-4">
          <Input
            label="Lieu de formation"
            placeholder="Ex: Centre de formation Paris Nord"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
          />
        </div>
        
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes ou instructions spécifiques
          </label>
          <textarea
            rows={3}
            className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="Informations complémentaires pour cette session..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="mt-6">
          <label htmlFor="templateFileInput" className="block text-sm font-medium text-gray-700 mb-1">
            Modèle PPTX (template)
          </label>
          <Input
            id="templateFileInput"
            type="file"
            accept=".pptx"
            onChange={(e) => setTemplateFile(e.target.files ? e.target.files[0] : null)}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {templateFile && <p className="mt-1 text-xs text-green-600">Fichier sélectionné : {templateFile.name}</p>}
        </div>

        {currentSessionDbId && selectedBlocksSummary && Object.keys(selectedBlocksSummary).length > 0 && (
          <div className="mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50 mb-6"> {/* Ajout de mb-6 */}
            <h4 className="text-md font-semibold text-gray-700 mb-2">Blocs thématiques sélectionnés pour cette session :</h4>
            <ul className="list-disc list-inside pl-2 space-y-1">
              {Object.entries(selectedBlocksSummary).map(([theme, blockId]) => (
                <li key={theme} className="text-sm text-gray-600">
                  <span className="font-medium">{theme}:</span> Bloc {blockId}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
      
      {/* Section d'import des résultats - visible uniquement si currentSessionDbId existe */}
      {currentSessionDbId && (
        <Card title="Résultats de la Session (Import)" className="mb-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="resultsFileInput" className="block text-sm font-medium text-gray-700 mb-1">
                Fichier de résultats (.xml, .json)
              </label>
              <Input
                id="resultsFileInput"
                type="file"
                accept=".xml,.json"
                onChange={handleResultsFileSelect}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
              {resultsFile && <p className="mt-1 text-xs text-green-600">Fichier sélectionné : {resultsFile.name}</p>}
            </div>
            <Button
              variant="secondary"
              icon={<FileUp size={16} />}
              onClick={handleImportResults}
              disabled={!resultsFile}
            >
              Importer les Résultats
            </Button>
            <p className="text-xs text-gray-500">
              Importez le fichier de résultats fourni par le système de boîtiers de vote OMBEA pour cette session.
            </p>
            {importSummary && (
              <div className={`mt-4 p-3 rounded-md text-sm ${importSummary.toLowerCase().includes("erreur") || importSummary.toLowerCase().includes("échoué") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                <p style={{ whiteSpace: 'pre-wrap' }}>{importSummary}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card title="Participants" className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Ajoutez les participants à cette session de certification. Le boîtier est automatiquement attribué selon l'ordre de la liste.
          </p>
          <div className="flex space-x-3">
            <Button 
              variant="outline" 
              icon={<FileUp size={16} />}
            >
              Importer CSV
            </Button>
            <Button 
              variant="outline" 
              icon={<UserPlus size={16} />}
              onClick={handleAddParticipant}
            >
              Ajouter participant
            </Button>
          </div>
        </div>
        
        <div className="border rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Boîtier
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prénom
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nom
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Organisation
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Code d'identification
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {participants.length === 0 ? (
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500\" colSpan={6}>
                    <div className="text-center py-4 text-gray-500">
                      Aucun participant ajouté. Utilisez le bouton "Ajouter participant" pour commencer.
                    </div>
                  </td>
                </tr>
              ) : (
                participants.map((participant) => (
                  <tr key={participant.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-800 font-medium">
                        {participant.deviceId}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Input
                        value={participant.firstName}
                        onChange={(e) => handleParticipantChange(participant.id, 'firstName', e.target.value)}
                        placeholder="Prénom"
                        className="mb-0"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Input
                        value={participant.lastName}
                        onChange={(e) => handleParticipantChange(participant.id, 'lastName', e.target.value)}
                        placeholder="Nom"
                        className="mb-0"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Input
                        value={participant.organization || ''}
                        onChange={(e) => handleParticipantChange(participant.id, 'organization', e.target.value)}
                        placeholder="Organisation (optionnel)"
                        className="mb-0"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Input
                        value={participant.identificationCode || ''}
                        onChange={(e) => handleParticipantChange(participant.id, 'identificationCode', e.target.value)}
                        placeholder="Code (optionnel)"
                        className="mb-0"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Trash2 size={16} />}
                        onClick={() => handleRemoveParticipant(participant.id)}
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
              <strong>Attribution automatique des boîtiers :</strong> Le premier participant de la liste utilisera le boîtier 1, le second le boîtier 2, etc.
            </p>
          </div>
        )}
      </Card>
      
      <div className="flex justify-between items-center">
        <Button variant="outline">
          Annuler
        </Button>
        <div className="space-x-3">
          <Button
            variant="outline"
            icon={<Save size={16} />}
            onClick={handleSaveDraft}
          >
            Enregistrer la session
          </Button>
          <Button
            variant="primary"
            icon={<PackagePlus size={16} />}
            onClick={handleGenerateQuestionnaireAndOrs}
          >
            Générer questionnaire, .ors & PPTX
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SessionForm;