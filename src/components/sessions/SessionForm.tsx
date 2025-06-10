import React, { useState } from 'react';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import { Save, FileUp, UserPlus, Trash2 } from 'lucide-react';
import { ReferentialType, referentials, Participant } from '../../types';

const SessionForm: React.FC = () => {
  const [participants, setParticipants] = useState<Participant[]>([]);

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

  return (
    <div>
      <Card title="Informations de la session" className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label="Nom de la session"
            placeholder="Ex: Formation CACES R489 - Groupe A"
            required
          />
          
          <Input
            label="Date de la session"
            type="date"
            required
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <Select
            label="Référentiel CACES"
            options={referentialOptions}
            placeholder="Sélectionner un référentiel"
            required
          />
          
          <Select
            label="Questionnaire associé"
            options={[
              { value: '1', label: 'CACES R489 - Questionnaire standard' },
              { value: '2', label: 'CACES R486 - PEMP' },
            ]}
            placeholder="Sélectionner un questionnaire"
            required
          />
        </div>
        
        <div className="mt-4">
          <Input
            label="Lieu de formation"
            placeholder="Ex: Centre de formation Paris Nord"
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
          />
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
            Enregistrer brouillon
          </Button>
          <Button variant="primary" icon={<Save size={16} />}>
            Créer la session
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SessionForm;