import React, { useState } from 'react';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import { Save, FileUp, UserPlus, Trash2, PackagePlus } from 'lucide-react';
import { CACESReferential, referentials, Participant } from '../../types';
import { StorageManager } from '../../services/StorageManager';
import { StoredQuestion } from '../../db';
import { generatePresentation, AdminPPTXSettings } from '../../utils/pptxProcessor';


const SessionForm: React.FC = () => {
  const [sessionName, setSessionName] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [selectedReferential, setSelectedReferential] = useState<CACESReferential | ''>('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [generatedQuestions, setGeneratedQuestions] = useState<StoredQuestion[]>([]); // For debug/display
  const [templateFile, setTemplateFile] = useState<File | null>(null);

  const referentialOptions = Object.entries(referentials).map(([value, label]) => ({
    value,
    label: `${value} - ${label}`,
  }));

  const handleAddParticipant = () => {
    const newParticipant: Participant = {
      id: Date.now().toString(),
      firstName: '',
      lastName: '',
      organization: '',
      identificationCode: '',
      deviceId: participants.length + 1,
      hasSigned: false
    };
    setParticipants([...participants, newParticipant]);
  };

  const handleRemoveParticipant = (id: string) => {
    const updatedParticipants = participants.filter(p => p.id !== id);
    // Reassign device IDs
    const reindexedParticipants = updatedParticipants.map((p, index) => ({
      ...p,
      deviceId: index + 1
    }));
    setParticipants(reindexedParticipants);
  };

  const handleParticipantChange = (id: string, field: keyof Participant, value: string) => {
    setParticipants(participants.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const handleGenerateQuestionnaire = async () => {
    if (!selectedReferential) {
      console.warn("Veuillez sélectionner un référentiel CACES.");
      alert("Veuillez sélectionner un référentiel CACES.");
      return;
    }
    if (!templateFile) {
      console.warn("Veuillez sélectionner un fichier modèle PPTX.");
      alert("Veuillez sélectionner un fichier modèle PPTX.");
      return;
    }
    console.log(`Génération du questionnaire pour le référentiel : ${selectedReferential} avec le modèle ${templateFile.name}`);
    setGeneratedQuestions([]); // Clear previous results

    console.log(`Génération du questionnaire pour le référentiel : ${selectedReferential} avec le modèle ${templateFile.name}`);
    setGeneratedQuestions([]);

    // Rassembler les informations de session
    const sessionInfo = {
      name: sessionName || "Session CACES", // Fournir une valeur par défaut si vide
      date: sessionDate || new Date().toISOString().slice(0,10),
      referential: selectedReferential
    };

    // Définir des AdminPPTXSettings par défaut (seront configurables plus tard)
    const adminSettings: AdminPPTXSettings = {
      defaultDuration: 30, // secondes
      pollTimeLimit: 30, // secondes pour les tags OMBEA
      answersBulletStyle: 'ppBulletAlphaUCPeriod', // A. B. C.
      // autres settings par défaut pour Val17ConfigOptions...
      pollStartMode: 'Automatic',
      chartValueLabelFormat: 'Response_Count',
      pollCountdownStartMode: 'Automatic',
      pollMultipleResponse: '1',
    };

    try {
      const baseThemes = await StorageManager.getAllBaseThemesForReferential(selectedReferential);
      if (baseThemes.length === 0) {
        console.warn(`Aucun thème trouvé pour le référentiel ${selectedReferential}. Vérifiez les données de la bibliothèque.`);
        alert(`Aucun thème trouvé pour le référentiel ${selectedReferential}.`);
        return;
      }
      console.log(`Thèmes de base trouvés pour ${selectedReferential}:`, baseThemes);

      let allSelectedQuestions: StoredQuestion[] = [];
      const selectedBlocksSummary: Record<string, string> = {};

      for (const baseTheme of baseThemes) {
        const blockIdentifiers = await StorageManager.getAllBlockIdentifiersForTheme(selectedReferential, baseTheme);
        if (blockIdentifiers.length === 0) {
          console.warn(`Aucun bloc trouvé pour le thème ${baseTheme} du référentiel ${selectedReferential}.`);
          // Selon la logique métier, on pourrait soit s'arrêter, soit continuer sans ce thème.
          // Pour l'instant, on continue, mais on logue un avertissement.
          continue;
        }

        // Choisir un blockIdentifier aléatoirement
        const randomIndex = Math.floor(Math.random() * blockIdentifiers.length);
        const chosenBlockIdentifier = blockIdentifiers[randomIndex];
        selectedBlocksSummary[baseTheme] = chosenBlockIdentifier;

        const questionsFromBlock = await StorageManager.getQuestionsForBlock(selectedReferential, baseTheme, chosenBlockIdentifier);
        if (questionsFromBlock.length > 0) {
          allSelectedQuestions = allSelectedQuestions.concat(questionsFromBlock);
        } else {
          console.warn(`Le bloc ${baseTheme}_${chosenBlockIdentifier} pour ${selectedReferential} est vide.`);
        }
      }

      setGeneratedQuestions(allSelectedQuestions);
      console.log("Résumé des blocs sélectionnés:", selectedBlocksSummary);
      console.log(`Questionnaire à générer avec ${allSelectedQuestions.length} questions.`);

      if (allSelectedQuestions.length === 0) {
        alert("Aucune question n'a pu être sélectionnée pour le questionnaire. Vérifiez la configuration des blocs.");
        return;
      }

      // Appel à la fonction principale de génération de présentation
      await generatePresentation(
        sessionInfo,
        participants,
        allSelectedQuestions,
        templateFile, // Le fichier modèle uploadé
        adminSettings
      );
      // generatePresentation gère le saveAs, donc pas besoin ici.
      // alert(`Génération du PPTX demandée avec ${allSelectedQuestions.length} questions.`);

    } catch (error) {
      console.error("Erreur lors de la préparation ou génération du questionnaire/PPTX:", error);
      alert("Une erreur est survenue. Vérifiez la console.");
    }
  };

  return (
    <div>
      <Card title="Informations de la session" className="mb-6">
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
          <Button variant="outline" icon={<Save size={16} />}>
            Enregistrer brouillon (Non fonctionnel)
          </Button>
          <Button
            variant="primary"
            icon={<PackagePlus size={16} />}
            onClick={handleGenerateQuestionnaire}
          >
            Générer questionnaire, .ors & PPTX
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SessionForm;