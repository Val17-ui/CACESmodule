import React, { useState } from 'react';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import { Save, FileUp, UserPlus } from 'lucide-react';
import { ReferentialType, referentials } from '../../types';

const SessionForm: React.FC = () => {
  const referentialOptions = Object.entries(referentials).map(([value, label]) => ({
    value,
    label: `${value} - ${label}`,
  }));

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
            Ajoutez les participants à cette session de certification.
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
                  Nom
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prénom
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Entreprise
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" colSpan={5}>
                  <div className="text-center py-4 text-gray-500">
                    Aucun participant ajouté. Utilisez les boutons ci-dessus pour ajouter des participants.
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
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