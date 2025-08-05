import React from 'react';
import { FileUp, Trash2, UserPlus } from 'lucide-react';
import Button from '../../ui/Button';
import Card from '../../ui/Card';
import Input from '../../ui/Input';
import Select from '../../ui/Select';
import { useSessionContext } from '../context/SessionContext';
import { useParticipantManager } from '../hooks/useParticipantManager';
import { FormParticipant } from '@common/types';

interface ParticipantManagerProps {
  isReadOnly: boolean;
}

const ParticipantManager: React.FC<ParticipantManagerProps> = ({ isReadOnly }) => {
  const { state, dispatch } = useSessionContext();
  const {
    participants,
    participantAssignments,
    handleAddParticipant,
    handleRemoveParticipant,
    handleParticipantChange,
    handleParticipantIterationChange,
    handleParticipantFileSelect,
  } = useParticipantManager({
    initialParticipants: state.participants,
    initialAssignments: state.participantAssignments,
    editingSessionData: state.editingSessionData,
    selectedKitIdState: state.selectedKitIdState,
    votingDevicesInSelectedKit: state.votingDevicesInSelectedKit,
  });

  // Update context when local state changes
  React.useEffect(() => {
    dispatch({ type: 'SET_PARTICIPANTS', payload: participants });
  }, [participants, dispatch]);

  React.useEffect(() => {
    dispatch({ type: 'SET_ASSIGNMENTS', payload: participantAssignments });
  }, [participantAssignments, dispatch]);

  return (
    <Card title="Participants et Kits" className="mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Select
          label="Kit de boîtiers"
          options={state.deviceKitsList.map(kit => ({ value: kit.id!.toString(), label: kit.name }))}
          value={state.selectedKitIdState?.toString() || ''}
          onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'selectedKitIdState', payload: e.target.value ? parseInt(e.target.value, 10) : null })}
          placeholder="Sélectionner un kit"
          disabled={state.isLoadingKits || isReadOnly}
        />
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Actions</h4>
          <div className="flex space-x-2">
            <Button onClick={handleAddParticipant} icon={<UserPlus size={16} />} disabled={isReadOnly}>Ajouter</Button>
            <label className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer">
              <FileUp size={16} className="-ml-1 mr-2 h-5 w-5" />
              Importer
              <input type="file" className="hidden" onChange={handleParticipantFileSelect} accept=".csv, .xlsx, .xls" disabled={isReadOnly} />
            </label>
          </div>
        </div>
      </div>

      <h3 className="text-xl font-semibold mb-4">Liste Globale des Participants</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {state.iterationCount > 1 && <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Itération</th>}
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Prénom</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Organisation</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Code Identification</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Boîtier</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {participants.map((p) => {
              const assignedIteration = Object.keys(participantAssignments).find(iterIndex => participantAssignments[parseInt(iterIndex)].some(pa => pa.id === p.uiId));
              return (
                <tr key={p.uiId}>
                  {state.iterationCount > 1 && (
                    <td className="px-4 py-2">
                      <Select
                        value={assignedIteration || ''}
                        onChange={(e) => handleParticipantIterationChange(p.uiId, parseInt(e.target.value, 10))}
                        options={state.iterationNames.map((name, index) => ({ value: index.toString(), label: name }))}
                        placeholder="N/A"
                        disabled={isReadOnly}
                      />
                    </td>
                  )}
                  <td className="px-4 py-2"><Input value={p.firstName} onChange={(e) => handleParticipantChange(p.uiId, 'firstName', e.target.value)} disabled={isReadOnly} /></td>
                  <td className="px-4 py-2"><Input value={p.lastName} onChange={(e) => handleParticipantChange(p.uiId, 'lastName', e.target.value)} disabled={isReadOnly} /></td>
                  <td className="px-4 py-2"><Input value={p.organization || ''} onChange={(e) => handleParticipantChange(p.uiId, 'organization', e.target.value)} disabled={isReadOnly} /></td>
                  <td className="px-4 py-2"><Input value={p.identificationCode || ''} onChange={(e) => handleParticipantChange(p.uiId, 'identificationCode', e.target.value)} disabled={isReadOnly} /></td>
                  <td className="px-4 py-2">
                    <Select
                      value={p.assignedGlobalDeviceId?.toString() || ''}
                      onChange={(e) => handleParticipantChange(p.uiId, 'assignedGlobalDeviceId', e.target.value ? parseInt(e.target.value, 10) : null)}
                      options={state.votingDevicesInSelectedKit.map(d => ({ value: d.id!.toString(), label: `${d.name} (${d.serialNumber})`, disabled: participants.some(participant => participant.uiId !== p.uiId && participant.assignedGlobalDeviceId === d.id) }))}
                      placeholder="N/A"
                      disabled={isReadOnly}
                    />
                  </td>
                  <td className="px-4 py-2"><Button variant="danger" size="sm" onClick={() => handleRemoveParticipant(p.uiId)} disabled={isReadOnly}><Trash2 size={14} /></Button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default ParticipantManager;
