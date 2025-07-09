import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { Plus, Edit3, Trash2, CheckSquare } from 'lucide-react'; // Square retiré
import {
  getAllDeviceKits, addDeviceKit, updateDeviceKit, deleteDeviceKit,
  setDefaultDeviceKit, getVotingDevicesForKit, assignDeviceToKit,
  removeDeviceFromKit, getAllVotingDevices, getDeviceKitById
} from '../../db'; // Fonctions DB importées directement
import { DeviceKit, VotingDevice } from '../../types';

const KitSettings: React.FC = () => {
  const [kits, setKits] = useState<DeviceKit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreatingKit, setIsCreatingKit] = useState(false);
  const [editingKit, setEditingKit] = useState<DeviceKit | null>(null);
  const [kitName, setKitName] = useState('');

  const [selectedKit, setSelectedKit] = useState<DeviceKit | null>(null);
  const [availableDevices, setAvailableDevices] = useState<VotingDevice[]>([]);
  const [kitDevices, setKitDevices] = useState<VotingDevice[]>([]);
  const [devicesToAssign, setDevicesToAssign] = useState<number[]>([]);

  useEffect(() => {
    loadKits();
    loadAllVotingDevices();
  }, []);

  const loadKits = async () => {
    setIsLoading(true);
    try {
      const allKits = await getAllDeviceKits(); // Corrigé
      setKits(allKits);
      setError(null);
    } catch (err) {
      console.error("Error loading kits:", err);
      setError("Erreur lors du chargement des kits.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadAllVotingDevices = async () => {
    try {
      const allVotingDevices = await getAllVotingDevices(); // Corrigé
      setAvailableDevices(allVotingDevices);
    } catch (err) {
      console.error("Error loading all voting devices:", err);
    }
  };

  useEffect(() => {
    if (selectedKit && selectedKit.id) {
      loadDevicesForKit(selectedKit.id);
    } else {
      setKitDevices([]);
    }
  }, [selectedKit]);

  const loadDevicesForKit = async (kitId: number) => {
    try {
      const devices = await getVotingDevicesForKit(kitId); // Corrigé
      setKitDevices(devices);
    } catch (err) {
      console.error(`Error loading devices for kit ${kitId}:`, err);
      setError(`Erreur lors du chargement des boîtiers pour le kit ${selectedKit?.name}.`);
    }
  };

  const handleOpenCreateKitForm = () => {
    setIsCreatingKit(true);
    setEditingKit(null);
    setKitName('');
    setSelectedKit(null);
    setError(null);
  };

  const handleOpenEditKitForm = (kit: DeviceKit) => {
    setEditingKit(kit);
    setKitName(kit.name);
    setIsCreatingKit(false);
    setSelectedKit(null);
    setError(null);
  };

  const handleCancelForm = () => {
    setIsCreatingKit(false);
    setEditingKit(null);
    setKitName('');
    setError(null);
  };

  const handleSaveKit = async () => {
    if (!kitName.trim()) {
      setError("Le nom du kit ne peut pas être vide.");
      return;
    }
    try {
      setError(null);
      if (editingKit) {
        await updateDeviceKit(editingKit.id!, { name: kitName, isDefault: editingKit.isDefault }); // Corrigé
      } else {
        const allKits = await getAllDeviceKits(); // Corrigé
        const isFirstKit = allKits.length === 0;
        await addDeviceKit({ name: kitName, isDefault: isFirstKit ? 1 : 0 }); // Corrigé
      }
      handleCancelForm();
      loadKits();
    } catch (err: any) {
      console.error("Error saving kit:", err);
      if (err.message && err.message.toLowerCase().includes('constraint')) {
        setError("Un kit avec ce nom existe déjà, ou une autre contrainte a été violée.");
      } else {
        setError("Erreur lors de la sauvegarde du kit.");
      }
    }
  };

  const handleDeleteKit = async (kitId: number, kitNameParam: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le kit "${kitNameParam}" ? Toutes les assignations de boîtiers à ce kit seront également perdues.`)) {
      try {
        setError(null);
        await deleteDeviceKit(kitId); // Corrigé
        loadKits();
        if (selectedKit?.id === kitId) {
          setSelectedKit(null);
        }
      } catch (err) {
        console.error(`Error deleting kit ${kitNameParam}:`, err);
        setError(`Erreur lors de la suppression du kit "${kitNameParam}".`);
      }
    }
  };

  const handleSetDefaultKit = async (kitId: number) => {
    try {
      setError(null);
      await setDefaultDeviceKit(kitId); // Corrigé
      await loadKits();

      if (selectedKit && selectedKit.id) {
          const updatedSelectedKit = await getDeviceKitById(selectedKit.id); // Corrigé
          if (updatedSelectedKit) {
            setSelectedKit(updatedSelectedKit);
          } else {
            setSelectedKit(null);
          }
      }
    } catch (err) {
      console.error(`Error setting kit ${kitId} as default:`, err);
      setError("Erreur lors de la définition du kit par défaut.");
    }
  };

  const handleToggleDeviceToAssign = (deviceId: number) => {
    setDevicesToAssign(prev =>
      prev.includes(deviceId)
        ? prev.filter(id => id !== deviceId)
        : [...prev, deviceId]
    );
  };

  const handleAddSelectedDevicesToKit = async () => {
    if (!selectedKit || !selectedKit.id || devicesToAssign.length === 0) return;
    try {
      setError(null);
      for (const deviceId of devicesToAssign) {
        await assignDeviceToKit(selectedKit.id, deviceId); // Corrigé
      }
      setDevicesToAssign([]);
      loadDevicesForKit(selectedKit.id);
    } catch (err) {
      console.error("Error adding devices to kit:", err);
      setError("Erreur lors de l'ajout des boîtiers au kit.");
    }
  };

  const handleRemoveDeviceFromSelectedKit = async (votingDeviceId: number, deviceName: string) => {
    if (!selectedKit || !selectedKit.id) return;
    if (window.confirm(`Êtes-vous sûr de vouloir retirer le boîtier "${deviceName}" du kit "${selectedKit.name}" ?`)) {
      try {
        setError(null);
        await removeDeviceFromKit(selectedKit.id, votingDeviceId); // Corrigé
        loadDevicesForKit(selectedKit.id);
      } catch (err) {
        console.error(`Error removing device ${deviceName} from kit ${selectedKit.name}:`, err);
        setError(`Erreur lors du retrait du boîtier "${deviceName}" du kit.`);
      }
    }
  };

  if (isLoading) {
    return (
      <Card title="Gestion des Kits de Boîtiers">
        <p>Chargement des kits...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {!isCreatingKit && !editingKit && (
        <Card title="Liste des Kits de Boîtiers">
          <div className="mb-4">
            <Button onClick={handleOpenCreateKitForm} icon={<Plus size={16} />}>
              Nouveau Kit
            </Button>
          </div>
          {error && !selectedKit && <p className="text-red-500 mb-2">{error}</p> }
          {kits.length === 0 ? (
            <p className="text-sm text-gray-500 italic">Aucun kit configuré pour le moment.</p>
          ) : (
            <ul className="space-y-2">
              {kits.map(kit => (
                <li
                  key={kit.id}
                  className={`p-3 rounded-md border flex justify-between items-center cursor-pointer hover:bg-gray-50
                              ${selectedKit?.id === kit.id ? 'bg-blue-50 border-blue-300' : 'border-gray-200'}`}
                  onClick={() => {
                      if (isCreatingKit || editingKit) return;
                      setSelectedKit(kit);
                      setDevicesToAssign([]);
                      setError(null);
                  }}
                >
                  <div>
                    <span className="font-medium">{kit.name}</span>
                    {kit.isDefault === 1 && (
                      <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Par défaut</span>
                    )}
                  </div>
                  <div className="space-x-2">
                     <Button variant="outline" size="sm" onClick={(e: React.MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); handleOpenEditKitForm(kit); }} icon={<Edit3 size={14}/>} disabled={isCreatingKit || editingKit}>Modifier</Button>
                     <Button variant="danger" size="sm" onClick={(e: React.MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); handleDeleteKit(kit.id!, kit.name);}} icon={<Trash2 size={14}/>} disabled={isCreatingKit || editingKit}>Supprimer</Button>
                     {kit.isDefault !== 1 && (
                       <Button
                         variant="ghost"
                         size="sm"
                         onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                           e.stopPropagation();
                           handleSetDefaultKit(kit.id!);
                         }}
                         title="Définir comme kit par défaut"
                         disabled={isCreatingKit || editingKit}
                       >
                         <CheckSquare size={16} />
                       </Button>
                     )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {isCreatingKit || editingKit ? (
        <Card title={editingKit ? `Modifier le Kit : ${editingKit.name}` : "Créer un Nouveau Kit"}>
          {error && <p className="text-red-500 mb-2">{error}</p>}
          <div className="space-y-4">
            <Input
              label="Nom du Kit"
              value={kitName}
              onChange={(e) => setKitName(e.target.value)}
              placeholder="Ex: Boîtiers Salle A"
              autoFocus
            />
            <div className="mt-4 flex space-x-2">
              <Button onClick={handleSaveKit}>
                {editingKit ? "Sauvegarder les Modifications" : "Créer le Kit"}
              </Button>
              <Button variant="outline" onClick={handleCancelForm}>Annuler</Button>
            </div>
          </div>
        </Card>
      ) : null}

      {selectedKit && !isCreatingKit && !editingKit && (
        <Card title={`Boîtiers dans le Kit : ${selectedKit.name}`}>
           {error && <p className="text-red-500 mb-2">{error}</p>}
          <p className="mb-2 text-sm text-gray-700">Boîtiers actuellement dans ce kit :</p>
          {kitDevices.length === 0 ? (
            <p className="text-sm text-gray-500 italic">Aucun boîtier dans ce kit.</p>
          ) : (
            <ul className="space-y-1 mb-4">
              {kitDevices.map(device => (
                <li key={device.id} className="text-sm p-2 border-b flex justify-between items-center">
                  <span>{device.name} (S/N: {device.serialNumber})</span>
                  <Button
                    variant="ghost"
                    size="sm" // Modifié de "icon" à "sm"
                    title="Retirer du kit"
                    onClick={() => handleRemoveDeviceFromSelectedKit(device.id!, device.name)}
                  >
                    <Trash2 size={14} className="text-red-500"/>
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <hr className="my-4"/>
          <h4 className="text-md font-semibold mb-2">Ajouter des boîtiers à "{selectedKit.name}" :</h4>
          <p className="text-sm text-gray-600 mb-3">Cochez les boîtiers disponibles ci-dessous que vous souhaitez inclure dans ce kit.</p>
          {availableDevices.length === 0 ? (
             <p className="text-sm text-gray-500 italic">Aucun boîtier global n'est configuré. Veuillez les ajouter dans "Matériel Principal" d'abord.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto border p-3 rounded-md bg-gray-50/50">
              {availableDevices.map(device => {
                const isAssignedToCurrentKit = kitDevices.some(kd => kd.id === device.id);
                return (
                  <label
                    key={device.id}
                    className={`flex items-center p-2 rounded hover:bg-gray-100
                                ${isAssignedToCurrentKit ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <input
                      type="checkbox"
                      className="mr-3 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      checked={devicesToAssign.includes(device.id!)}
                      onChange={() => {
                        if(isAssignedToCurrentKit) return;
                        handleToggleDeviceToAssign(device.id!);
                      }}
                      disabled={isAssignedToCurrentKit}
                    />
                    <span className="flex-grow">{device.name} <span className="text-xs text-gray-500">(S/N: {device.serialNumber})</span></span>
                    {isAssignedToCurrentKit && <span className="ml-auto text-xs text-green-600 font-medium">Déjà dans ce kit</span>}
                  </label>
                );
              })}
            </div>
          )}
          <Button
            onClick={handleAddSelectedDevicesToKit}
            className="mt-4"
            disabled={devicesToAssign.length === 0}
            icon={<Plus size={16}/>}
          >
            Ajouter les {devicesToAssign.length || ''} boîtier(s) sélectionné(s)
          </Button>
        </Card>
      )}
    </div>
  );
};

export default KitSettings;
