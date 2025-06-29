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
import { QuestionWithId as StoredQuestion, addSession, updateSession, getSessionById } from '../../db';
import { generatePresentation, AdminPPTXSettings } from '../../utils/pptxOrchestrator';


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
      id: currentSessionDbId || undefined, // Utiliser l'ID existant si mise à jour
      nomSession: sessionName || `Session du ${new Date().toLocaleDateString()}`,
      dateSession: sessionDate || new Date().toISOString().split('T')[0],
      referentiel: selectedReferential as DBCACESReferential,
      participants: dbParticipants,
      selectionBlocs: dbSelectedBlocks,
      donneesOrs: includeOrsBlob,
      location: location, // Inclure location
      // notes: notes, // A ajouter à DBSession si besoin
      createdAt: currentSessionDbId ? undefined : new Date().toISOString(), // Seulement à la création
      updatedAt: new Date().toISOString(),
    };
    return sessionToSave;
  };

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

      // Supposons que generatePresentation retourne le Blob du .ors
      const orsBlob = await generatePresentation(
        sessionInfoForPptx,
        participants, // Utilise FormParticipant, ajuster si generatePresentation attend DBParticipant
        allSelectedQuestionsForPptx,
        templateFile,
        adminSettings
      );

      if (orsBlob instanceof Blob) {
        // Mettre à jour la session existante avec le Blob
        const finalSessionData = await prepareSessionDataForDb(orsBlob);
        if (finalSessionData && savedSessionId) {
            finalSessionData.id = savedSessionId; // Assurer que l'ID est bien celui de la session qu'on update
            await updateSession(savedSessionId, { donneesOrs: orsBlob, updatedAt: new Date().toISOString() });
            alert(`Questionnaire, .ors générés et session (ID: ${savedSessionId}) mise à jour avec le fichier .ors!`);
        }
      } else {
        console.warn("generatePresentation n'a pas retourné un Blob. Le .ors n'est pas en DB.");
        alert("Génération PPTX terminée, mais le .ors n'a pas été sauvegardé en DB.");
      }

    } catch (error) {
      console.error("Erreur lors de la génération questionnaire/PPTX ou sauvegarde:", error);
      alert("Une erreur est survenue. Vérifiez la console.");
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
      </Card>
      
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