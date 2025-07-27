import React from 'react';
import { FileUp, Trash2, UserPlus } from 'lucide-react';
import { FormParticipant, VotingDevice, DeviceKit } from '../../../types';
import Button from '../../ui/Button';
import Card from '../../ui/Card';
import Input from '../../ui/Input';
import Select from '../../ui/Select';

interface ParticipantManagerProps {
  isReadOnly: boolean;
  participants: FormParticipant[];
  setParticipants: React.Dispatch<React.SetStateAction<FormParticipant[]>>;
  handleParticipantChange: (id: string, field: keyof FormParticipant, value: any) => void;
  handleRemoveParticipant: (id: string) => void;
  handleAddParticipant: () => void;
  handleParticipantFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  iterationCount: number;
  iterationNames: string[];
  participantAssignments: Record<number, { id: string; assignedGlobalDeviceId: number | null }[]>;
  handleParticipantIterationChange: (participantId: string, newIterationIndex: number) => void;
  deviceKitsList: DeviceKit[];
  selectedKitIdState: number | null;
  setSelectedKitIdState: (id: number | null) => void;
  votingDevicesInSelectedKit: VotingDevice[];
  isLoadingKits: boolean;
}

const ParticipantManager: React.FC<ParticipantManagerProps> = ({
  isReadOnly,
  participants,
  handleParticipantChange,
  handleRemoveParticipant,
  handleAddParticipant,
  handleParticipantFileSelect,
  iterationCount,
  iterationNames,
  participantAssignments,
  handleParticipantIterationChange,
  deviceKitsList,
  selectedKitIdState,
  setSelectedKitIdState,
  votingDevicesInSelectedKit,
  isLoadingKits,
}) => {
  return (
    <Card title="Participants et Kits" className="mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Select
          label="Kit de boîtiers"
          options={deviceKitsList.map(kit => ({ value: kit.id!.toString(), label: kit.name }))}
          value={selectedKitIdState?.toString() || ''}
          onChange={(e) => setSelectedKitIdState(e.target.value ? parseInt(e.target.value, 10) : null)}
          placeholder="Sélectionner un kit"
          disabled={isLoadingKits || isReadOnly}
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
              {iterationCount > 1 && <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Itération</th>}
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
              const assignedIteration = Object.keys(participantAssignments).find(iterIndex => participantAssignments[parseInt(iterIndex)].some(pa => pa.id === p.id));
              return (
                <tr key={p.id}>
                  {iterationCount > 1 && (
                    <td className="px-4 py-2">
                      <Select
                        value={assignedIteration || ''}
                        onChange={(e) => handleParticipantIterationChange(p.id, parseInt(e.target.value, 10))}
                        options={iterationNames.map((name, index) => ({ value: index.toString(), label: name }))}
                        placeholder="N/A"
                        disabled={isReadOnly}
                      />
                    </td>
                  )}
                  <td className="px-4 py-2"><Input value={p.firstName} onChange={(e) => handleParticipantChange(p.id, 'firstName', e.target.value)} disabled={isReadOnly} /></td>
                  <td className="px-4 py-2"><Input value={p.lastName} onChange={(e) => handleParticipantChange(p.id, 'lastName', e.target.value)} disabled={isReadOnly} /></td>
                  <td className="px-4 py-2"><Input value={p.organization || ''} onChange={(e) => handleParticipantChange(p.id, 'organization', e.target.value)} disabled={isReadOnly} /></td>
                  <td className="px-4 py-2"><Input value={p.identificationCode || ''} onChange={(e) => handleParticipantChange(p.id, 'identificationCode', e.target.value)} disabled={isReadOnly} /></td>
                  <td className="px-4 py-2">
                    <Select
                      value={p.assignedGlobalDeviceId?.toString() || ''}
                      onChange={(e) => handleParticipantChange(p.id, 'assignedGlobalDeviceId', e.target.value ? parseInt(e.target.value, 10) : null)}
                      options={votingDevicesInSelectedKit.map(d => ({ value: d.id!.toString(), label: `${d.name} (${d.serialNumber})`, disabled: participants.some(participant => participant.id !== p.id && participant.assignedGlobalDeviceId === d.id) }))}
                      placeholder="N/A"
                      disabled={isReadOnly}
                    />
                  </td>
                  <td className="px-4 py-2"><Button variant="danger" size="sm" onClick={() => handleRemoveParticipant(p.id)} disabled={isReadOnly}><Trash2 size={14} /></Button></td>
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
