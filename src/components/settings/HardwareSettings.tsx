import React, { useState, useEffect, ChangeEvent } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { Plus, Upload, Trash2, Save, AlertCircle } from 'lucide-react';
import { VotingDevice, getAllVotingDevices, addVotingDevice, updateVotingDevice, deleteVotingDevice, bulkAddVotingDevices } from '../../db';
import * as XLSX from 'xlsx';

interface EditableVotingDevice extends VotingDevice {
  isEditing?: boolean;
  currentPhysicalIdValue?: string; // Used for temporary input value during edit
}

const HardwareSettings: React.FC = () => {
  const [devices, setDevices] = useState<EditableVotingDevice[]>([]);
  const [newDevicePhysicalId, setNewDevicePhysicalId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    const allDevices = await getAllVotingDevices();
    // Sort devices by their database ID to maintain a consistent order for "Numéro de boîtier"
    const sortedDevices = allDevices.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
    setDevices(sortedDevices.map(d => ({ ...d, isEditing: false, currentPhysicalIdValue: d.physicalId })));
    setError(null);
  };

  const handleAddNewDeviceInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setNewDevicePhysicalId(e.target.value);
  };

  const handleAddDevice = async () => {
    if (!newDevicePhysicalId.trim()) {
      setError("L'ID boîtier OMBEA ne peut pas être vide.");
      return;
    }
    // Check for duplicates before adding
    if (devices.some(d => d.physicalId === newDevicePhysicalId.trim())) {
      setError("Cet ID boîtier OMBEA existe déjà.");
      return;
    }
    try {
      await addVotingDevice({ physicalId: newDevicePhysicalId.trim() });
      setNewDevicePhysicalId('');
      loadDevices();
    } catch (e: any) {
      console.error("Erreur ajout boîtier:", e);
      setError(e.message || "Erreur lors de l'ajout du boîtier.");
    }
  };

  const handleEditDeviceChange = (id: number, value: string) => {
    setDevices(devices.map(d => d.id === id ? { ...d, currentPhysicalIdValue: value } : d));
  };

  const toggleEditMode = (id: number) => {
    setDevices(devices.map(d => {
      if (d.id === id) {
        return { ...d, isEditing: !d.isEditing, currentPhysicalIdValue: d.physicalId }; // Reset temp value on toggle
      }
      return { ...d, isEditing: false }; // Close other editors
    }));
    setError(null);
  };


  const handleSaveEdit = async (id: number) => {
    const deviceToSave = devices.find(d => d.id === id);
    if (!deviceToSave || !deviceToSave.currentPhysicalIdValue?.trim()) {
      setError("L'ID boîtier OMBEA ne peut pas être vide pour la sauvegarde.");
      return;
    }
    // Check for duplicates, excluding the current device being edited
    if (devices.some(d => d.id !== id && d.physicalId === deviceToSave.currentPhysicalIdValue?.trim())) {
      setError("Cet ID boîtier OMBEA existe déjà.");
      return;
    }

    try {
      await updateVotingDevice(id, { physicalId: deviceToSave.currentPhysicalIdValue.trim() });
      loadDevices(); // Reload to reflect changes and exit edit mode
    } catch (e: any) {
      console.error("Erreur sauvegarde boîtier:", e);
      setError(e.message || "Erreur lors de la sauvegarde du boîtier.");
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce boîtier ? Cette action est irréversible et peut affecter les sessions passées si ce boîtier y était référencé.')) {
      try {
        await deleteVotingDevice(id);
        loadDevices();
      } catch (e: any) {
        console.error("Erreur suppression boîtier:", e);
        setError(e.message || "Erreur lors de la suppression du boîtier.");
      }
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        const existingPhysicalIds = new Set(devices.map(d => d.physicalId));
        const devicesFromFile: { physicalId: string }[] = json
          .slice(1) // Ignorer l'en-tête
          .map(row => ({ physicalId: row[0]?.toString().trim() }))
          .filter(d => d.physicalId && d.physicalId.length > 0);

        if (devicesFromFile.length === 0) {
          setError("Aucun boîtier valide trouvé dans le fichier.");
          return;
        }

        const newDevicesToAdd = devicesFromFile.filter(d => !existingPhysicalIds.has(d.physicalId));
        const duplicateCount = devicesFromFile.length - newDevicesToAdd.length;

        if (newDevicesToAdd.length > 0) {
          await bulkAddVotingDevices(newDevicesToAdd.map(d => ({physicalId: d.physicalId}))); // Ensure correct structure for DB
          loadDevices();
          let importMessage = `${newDevicesToAdd.length} nouveaux boîtiers importés avec succès.`;
          if (duplicateCount > 0) {
            importMessage += ` ${duplicateCount} boîtiers du fichier étaient déjà présents et ont été ignorés.`;
          }
          alert(importMessage);
        } else {
          setError(`Aucun nouveau boîtier à importer. ${duplicateCount > 0 ? `${duplicateCount} boîtiers du fichier sont déjà présents.` : ''}`);
        }
      } catch (err: any) {
        console.error("Erreur import:", err);
        setError(err.message || "Erreur lors de l'importation du fichier Excel.");
      }
    };
    reader.onerror = () => {
      setError("Erreur de lecture du fichier.");
    };
    reader.readAsArrayBuffer(file);
    event.target.value = ''; // Reset file input
  };

  return (
    <Card title="Matériel - Gestion des Boîtiers de Vote">
      <p className="text-sm text-gray-600 mb-4">
        Gérez la liste de vos boîtiers de vote OMBEA. Le "Numéro de boîtier" est généré automatiquement et utilisé pour l'attribution dans les sessions.
        L'"ID boîtier OMBEA" est l'identifiant physique unique de chaque boîtier OMBEA.
      </p>
      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-100 text-red-700 flex items-center">
          <AlertCircle size={20} className="mr-2" />
          {error}
        </div>
      )}
      <div className="mb-6 p-4 border border-gray-200 rounded-lg">
        <h3 className="text-lg font-medium text-gray-800 mb-2">Ajouter un nouveau boîtier</h3>
        <div className="flex items-center space-x-2">
          {/* @ts-ignore */}
          <Input
            placeholder="ID boîtier OMBEA du nouveau boîtier"
            value={newDevicePhysicalId}
            onChange={handleAddNewDeviceInputChange}
            className="flex-grow"
          />
          <Button onClick={handleAddDevice} icon={<Plus size={16}/>}>Ajouter</Button>
        </div>
      </div>

      <div className="flex justify-end space-x-2 mb-4">
        <label htmlFor="excel-import" className="inline-flex">
          <Button variant="outline" icon={<Upload size={16}/>} onClick={() => document.getElementById('excel-import')?.click()} type="button">
            Importer IDs boîtier OMBEA (.xlsx)
          </Button>
        </label>
        <input type="file" id="excel-import" accept=".xlsx, .csv" className="hidden" onChange={handleImport} />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">Numéro de boîtier</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID boîtier OMBEA</th>
              <th className="relative px-4 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {devices.length === 0 ? (
              <tr><td className="px-4 py-4 text-center text-sm text-gray-500" colSpan={3}>Aucun boîtier configuré.</td></tr>
            ) : (
              devices.map((device, index) => (
                <tr key={device.id}>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
                    {index + 1}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {device.isEditing && device.id ? (
                      // @ts-ignore
                      <Input
                        value={device.currentPhysicalIdValue || ''}
                        onChange={(e) => handleEditDeviceChange(device.id!, e.target.value)}
                        autoFocus
                        className="mb-0"
                      />
                    ) : (
                      device.physicalId
                    )}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    {device.isEditing && device.id ? (
                      <>
                        <Button size="sm" onClick={() => handleSaveEdit(device.id!)} icon={<Save size={16}/>}>Enregistrer</Button>
                        <Button size="sm" variant="ghost" onClick={() => toggleEditMode(device.id!)}>Annuler</Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" onClick={() => toggleEditMode(device.id!)}>Modifier</Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleDelete(device.id!)}
                          icon={<Trash2 size={16}/>}
                          disabled={index !== devices.length - 1}
                          title={index !== devices.length - 1 ? "Seul le dernier boîtier de la liste peut être supprimé" : "Supprimer le boîtier"}
                        >
                          Supprimer
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Important:</strong> La suppression d'un boîtier est définitive (seul le dernier boîtier de la liste peut être supprimé).
          Si vous souhaitez simplement changer l'ID boîtier OMBEA d'un boîtier numéroté, utilisez la fonction "Modifier".
          L'ordre des boîtiers (Numéro de boîtier) est basé sur leur ordre d'ajout.
        </p>
      </div>
    </Card>
  );
};

export default HardwareSettings;
