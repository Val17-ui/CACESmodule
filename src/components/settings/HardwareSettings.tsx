import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { Plus, Upload, Trash2, Edit, Save, X } from 'lucide-react';
import { VotingDevice, getAllVotingDevices, addVotingDevice, updateVotingDevice, deleteVotingDevice, bulkAddVotingDevices } from '../../db';
import * as XLSX from 'xlsx';

const HardwareSettings: React.FC = () => {
  const [devices, setDevices] = useState<VotingDevice[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    const allDevices = await getAllVotingDevices();
    setDevices(allDevices);
  };

  const handleAddDevice = async () => {
    const physicalId = prompt('Entrez l\'ID physique du nouveau boîtier:');
    if (physicalId) {
      await addVotingDevice({ physicalId });
      loadDevices();
    }
  };

  const handleEdit = (device: VotingDevice) => {
    setEditingId(device.id!);
    setEditingValue(device.physicalId);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingValue('');
  };

  const handleSaveEdit = async (id: number) => {
    if (editingValue) {
      await updateVotingDevice(id, { physicalId: editingValue });
      setEditingId(null);
      setEditingValue('');
      loadDevices();
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce boîtier ?')) {
      await deleteVotingDevice(id);
      loadDevices();
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      // Supposons que l'ID est dans la première colonne
      const newDevices: VotingDevice[] = json
        .slice(1) // Ignorer l'en-tête
        .map(row => ({ physicalId: row[0]?.toString().trim() }))
        .filter(d => d.physicalId);

      if (newDevices.length > 0) {
        await bulkAddVotingDevices(newDevices);
        loadDevices();
        alert(`${newDevices.length} boîtiers importés avec succès.`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <Card title="Gestion des Boîtiers de Vote">
      <p className="text-sm text-gray-600 mb-4">Ajoutez, modifiez ou importez la liste de vos boîtiers.</p>
      <div className="flex justify-end space-x-2 mb-4">
        <Button variant="outline" onClick={handleAddDevice} icon={<Plus size={16}/>}>Ajouter manuellement</Button>
        <label htmlFor="excel-import" className="inline-flex">
          <Button variant="outline" icon={<Upload size={16}/>} onClick={() => document.getElementById('excel-import')?.click()} type="button">
            Importer (.xlsx)
          </Button>
        </label>
        <input type="file" id="excel-import" accept=".xlsx" className="hidden" onChange={handleImport} />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID Physique du Boîtier</th>
              <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {devices.map(device => (
              <tr key={device.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingId === device.id ? (
                    <Input
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      // autoFocus prop is passed directly to the underlying HTML input if the Input component spreads props
                      // Assuming Input component handles passing props like autoFocus correctly.
                      // If not, the Input component itself would need modification.
                      // For now, we ensure the prop name is correct as per HTML standard.
                      autoFocus={true}
                    />
                  ) : (
                    device.physicalId
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  {editingId === device.id ? (
                    <>
                      <Button size="sm" onClick={() => handleSaveEdit(device.id!)} icon={<Save size={16}/>}>Enregistrer</Button>
                      <Button size="sm" variant="ghost" onClick={handleCancelEdit} icon={<X size={16}/>}></Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => handleEdit(device)} icon={<Edit size={16}/>}>Modifier</Button>
                      <Button size="sm" variant="danger" onClick={() => handleDelete(device.id!)} icon={<Trash2 size={16}/>}>Supprimer</Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default HardwareSettings;
