import React from 'react';
import { CACESReferential, Referential, Trainer } from '@common/types';
import Card from '../../ui/Card';
import Input from '../../ui/Input';
import Select from '../../ui/Select';
import { SessionFormData } from '../SessionForm';

interface SessionDetailsFormProps {
  formData: SessionFormData;
  handleDataChange: (field: keyof SessionFormData, value: any) => void;
  isReadOnly: boolean;
  referentielsData: Referential[];
  editingSessionData: any;
  trainersList: Trainer[];
  setParticipantAssignments: (assignments: any) => void;
  displayedBlockDetails: Array<{ themeName: string, blocName: string }>;
}

const SessionDetailsForm: React.FC<SessionDetailsFormProps> = ({
  formData,
  handleDataChange,
  isReadOnly,
  referentielsData,
  editingSessionData,
  trainersList,
  setParticipantAssignments,
  displayedBlockDetails
}) => {

  const referentialOptionsFromData = referentielsData.map((r: Referential) => ({
    value: r.code,
    label: `${r.code} - ${r.nom_complet}`,
  }));

  return (
    <Card title="Informations générales" className="mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          label="Nom de la session"
          placeholder="Ex: Formation CACES R489 - Groupe A"
          value={formData.sessionName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleDataChange('sessionName', e.target.value)}
          required
          disabled={isReadOnly}
        />
        <Input
          label="Date de la session"
          type="date"
          value={formData.sessionDate}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleDataChange('sessionDate', e.target.value)}
          required
          disabled={isReadOnly}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
        <Select
          label="Référentiel"
          options={referentialOptionsFromData}
          value={formData.selectedReferential}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
            const newSelectedCode = e.target.value as CACESReferential | '';
            handleDataChange('selectedReferential', newSelectedCode);
            if (newSelectedCode) {
              const refObj = referentielsData.find(r => r.code === newSelectedCode);
              handleDataChange('selectedReferentialId', refObj?.id || null);
            } else {
              handleDataChange('selectedReferentialId', null);
            }
          }}
          placeholder="Sélectionner un référentiel"
          required
          disabled={!!editingSessionData?.questionMappings || isReadOnly}
        />
        <Select
          label="Formateur"
          options={trainersList.map((t: Trainer) => ({ value: t.id?.toString() || '', label: t.name }))}
          value={formData.selectedTrainerId?.toString() || ''}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleDataChange('selectedTrainerId', e.target.value ? parseInt(e.target.value, 10) : null)}
          placeholder="Sélectionner un formateur"
          disabled={isReadOnly}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
        <Input
          label="Numéro de session"
          placeholder="Ex: 2024-001"
          value={formData.numSession}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleDataChange('numSession', e.target.value)}
          disabled={isReadOnly}
        />
        <Input
          label="Numéro de stage"
          placeholder="Ex: CACES-2024-A"
          value={formData.numStage}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleDataChange('numStage', e.target.value)}
          disabled={isReadOnly}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
        <Input
          label="Lieu de formation"
          placeholder="Ex: Centre de formation Paris Nord"
          value={formData.location}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleDataChange('location', e.target.value)}
          disabled={isReadOnly}
        />
        <Input
          label="Nombre d’itérations"
          type="number"
          min={1}
          value={formData.iterationCount}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const count = parseInt(e.target.value, 10);
            if (count > 0) {
              handleDataChange('iterationCount', count);
              const newIterationNames = Array.from({ length: count }, (_, i) => `Session_${i + 1}`);
              handleDataChange('iterationNames', newIterationNames);
              setParticipantAssignments((prev: any) => {
                const newAssignments: Record<number, { id: string; assignedGlobalDeviceId: number | null }[]> = {};
                for (let i = 0; i < count; i++) {
                  if (prev[i]) {
                    newAssignments[i] = prev[i];
                  } else {
                    newAssignments[i] = [];
                  }
                }
                return newAssignments;
              });
            }
          }}
          disabled={isReadOnly}
        />
      </div>
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          rows={3}
          className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          placeholder="Informations complémentaires..."
          value={formData.notes}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleDataChange('notes', e.target.value)}
          readOnly={isReadOnly}
        />
      </div>
      {displayedBlockDetails.length > 0 && (
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
};

export default SessionDetailsForm;
