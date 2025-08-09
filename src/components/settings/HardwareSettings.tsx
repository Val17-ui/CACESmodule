import React, { useState, useEffect } from 'react'; // ChangeEvent removed
import Card from '../ui/Card';
import Button from '../ui/Button';
import Tooltip from '../ui/Tooltip';
import Input from '../ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table';
import { Plus, Upload, Trash2, Save, AlertCircle } from 'lucide-react';
import { VotingDevice } from '@common/types'; // VotingDevice importé depuis types
import { StorageManager } from '../../services/StorageManager';
import * as XLSX from 'xlsx';

interface EditableVotingDevice extends VotingDevice {
  isEditing?: boolean;
  currentNameValue?: string;
  currentSerialNumberValue?: string;
}

const HardwareSettings: React.FC = () => {
  const [devices, setDevices] = useState<EditableVotingDevice[]>([]);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDeviceSerialNumber, setNewDeviceSerialNumber] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    const allDevices = await StorageManager.getAllVotingDevices();
    const sortedDevices = allDevices.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
    setDevices(sortedDevices.map(d => ({
      ...d,
      isEditing: false,
      currentNameValue: d.name,
      currentSerialNumberValue: d.serialNumber
    })));
    setError(null);
  };

  // Remplacé par des setters directs dans les Inputs onChange

  const handleAddDevice = async () => {
    if (!newDeviceSerialNumber.trim()) {
      setError("Le numéro de série ne peut pas être vide.");
      return;
    }
    if (!newDeviceName.trim()) {
      setError("Le nom du boîtier ne peut pas être vide.");
      return;
    }
    if (devices.some(d => d.serialNumber === newDeviceSerialNumber.trim())) {
      setError("Ce numéro de série existe déjà.");
      return;
    }
    try {
      await StorageManager.addVotingDevice({ name: newDeviceName.trim(), serialNumber: newDeviceSerialNumber.trim() });
      setNewDeviceName('');
      setNewDeviceSerialNumber('');
      loadDevices();
    } catch (e: any) {
      console.error("Erreur ajout boîtier:", e);
      setError(e.message || "Erreur lors de l'ajout du boîtier.");
    }
  };

  const handleEditDeviceChange = (id: number, field: 'name' | 'serialNumber', value: string) => {
    setDevices(devices.map(d => {
      if (d.id === id) {
        if (field === 'name') return { ...d, currentNameValue: value };
        if (field === 'serialNumber') return { ...d, currentSerialNumberValue: value };
      }
      return d;
    }));
  };

  const toggleEditMode = (id: number) => {
    setDevices(devices.map(d => {
      if (d.id === id) {
        // Reset temp values to actual values from device when entering edit mode
        return { ...d, isEditing: !d.isEditing, currentNameValue: d.name, currentSerialNumberValue: d.serialNumber };
      }
      // Ensure other devices are not in edit mode
      return { ...d, isEditing: false };
    }));
    setError(null);
  };


  const handleSaveEdit = async (id: number) => {
    const deviceToSave = devices.find(d => d.id === id);
    if (!deviceToSave || !deviceToSave.currentSerialNumberValue?.trim()) {
      setError("Le numéro de série ne peut pas être vide pour la sauvegarde.");
      return;
    }
    if (!deviceToSave.currentNameValue?.trim()) {
      setError("Le nom du boîtier ne peut pas être vide pour la sauvegarde.");
      return;
    }
    if (devices.some(d => d.id !== id && d.serialNumber === deviceToSave.currentSerialNumberValue?.trim())) {
      setError("Ce numéro de série existe déjà.");
      return;
    }

    try {
      await StorageManager.updateVotingDevice(id, {
        name: deviceToSave.currentNameValue.trim(),
        serialNumber: deviceToSave.currentSerialNumberValue.trim()
      });
      loadDevices();
    } catch (e: any) {
      console.error("Erreur sauvegarde boîtier:", e);
      setError(e.message || "Erreur lors de la sauvegarde du boîtier.");
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce boîtier ? Cette action est irréversible et peut affecter les sessions passées si ce boîtier y était référencé.')) {
      try {
        await StorageManager.deleteVotingDevice(id);
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
        // Assume header: Name (optional), SerialNumber
        const json: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (json.length < 2) { // At least one data row
          setError("Le fichier est vide ou ne contient que des en-têtes.");
          return;
        }

        const headerRow = json[0].map(h => h.toString().toLowerCase());
        const serialNumberIndex = headerRow.findIndex(h => h.includes('serial') || h.includes('série') || h.includes('id'));
        const nameIndex = headerRow.findIndex(h => h.includes('name') || h.includes('nom'));

        if (serialNumberIndex === -1) {
          setError("Colonne 'Numéro de Série' (ou 'ID') introuvable dans l'en-tête du fichier Excel.");
          return;
        }

        const existingSerialNumbers = new Set(devices.map(d => d.serialNumber));
        const devicesFromFile: { name: string; serialNumber: string }[] = json
          .slice(1) // Ignorer l'en-tête
          .map((row, idx) => {
            const serial = row[serialNumberIndex]?.toString().trim();
            let name = nameIndex !== -1 ? row[nameIndex]?.toString().trim() : '';
            if (!name && serial) {
              name = `Boîtier Importé #${idx + 1} (${serial.slice(0,5)}...)`; // Default name if not provided
            }
            return { name, serialNumber: serial };
          })
          .filter(d => d.serialNumber && d.serialNumber.length > 0 && d.name);

        if (devicesFromFile.length === 0) {
          setError("Aucun boîtier valide (avec numéro de série et nom) trouvé dans le fichier après filtrage.");
          return;
        }

        const newDevicesToAdd = devicesFromFile.filter(d => !existingSerialNumbers.has(d.serialNumber));
        const duplicateCount = devicesFromFile.length - newDevicesToAdd.length;

        if (newDevicesToAdd.length > 0) {
          await StorageManager.bulkAddVotingDevices(newDevicesToAdd.map(d => ({name: d.name, serialNumber: d.serialNumber})));
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <Input
            label="Nom du boîtier"
            placeholder="Ex: Boîtier Salle A - #1"
            value={newDeviceName}
            onChange={(e) => setNewDeviceName(e.target.value)}
            className="flex-grow"
          />
          <Input
            label="Numéro de Série (ID OMBEA)"
            placeholder="ID physique du boîtier"
            value={newDeviceSerialNumber}
            onChange={(e) => setNewDeviceSerialNumber(e.target.value)}
            className="flex-grow"
          />
          <Button onClick={handleAddDevice} icon={<Plus size={16}/>} className="md:mt-auto h-10">Ajouter Boîtier</Button>
        </div>
      </div>

      <div className="flex justify-end space-x-2 mb-4">
        <Tooltip
          content={
            <div className="text-left">
              <p className="font-bold">Format attendu (.xlsx):</p>
              <ul className="list-disc list-inside">
                <li>Colonne 1: Nom (Optionnel)</li>
                <li>Colonne 2: Numéro de Série (ID)</li>
              </ul>
              <p className="mt-2 font-bold">Exemple:</p>
              <p>Nom | Numéro de Série</p>
              <p>Boîtier 01 | F01A5B</p>
            </div>
          }
          position="top"
        >
          <label htmlFor="excel-import" className="inline-flex">
            <Button variant="outline" icon={<Upload size={16}/>} onClick={() => document.getElementById('excel-import')?.click()} type="button">
              Importer IDs boîtier OMBEA (.xlsx)
            </Button>
          </label>
        </Tooltip>
        <input type="file" id="excel-import" accept=".xlsx, .csv" className="hidden" onChange={handleImport} />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <TableRow>
              <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">#</TableHead>
              <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/6">Nom du boîtier</TableHead>
              <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/6">Numéro de Série (ID OMBEA)</TableHead>
              <TableHead className="relative px-4 py-3 w-1/6"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </thead>
          <TableBody className="bg-white divide-y divide-gray-200">
            {devices.length === 0 ? (
              <TableRow><TableCell className="px-4 py-4 text-center text-sm text-gray-500" colSpan={4}>Aucun boîtier configuré.</TableCell></TableRow>
            ) : (
              devices.map((device, index) => (
                <TableRow key={device.id}>
                  <TableCell className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
                    {index + 1}
                  </TableCell>
                  <TableCell className="px-4 py-2 whitespace-nowrap">
                    {device.isEditing && device.id ? (
                      <Input
                        value={device.currentNameValue || ''}
                        onChange={(e) => handleEditDeviceChange(device.id!, 'name', e.target.value)}
                        autoFocus
                        className="mb-0"
                        placeholder="Nom du boîtier"
                      />
                    ) : (
                      device.name
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2 whitespace-nowrap">
                    {device.isEditing && device.id ? (
                      <Input
                        value={device.currentSerialNumberValue || ''}
                        onChange={(e) => handleEditDeviceChange(device.id!, 'serialNumber', e.target.value)}
                        className="mb-0"
                        placeholder="Numéro de série"
                      />
                    ) : (
                      device.serialNumber
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2 whitespace-nowrap text-right text-sm font-medium space-x-2">
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
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
