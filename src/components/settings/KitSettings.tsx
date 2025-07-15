import React, { useState, useEffect, useCallback } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { Plus, Edit3, Trash2, CheckSquare } from 'lucide-react';
import {
  getAllDeviceKits, addDeviceKit, updateDeviceKit, deleteDeviceKit,
  setDefaultDeviceKit, getVotingDevicesForKit, assignDeviceToKit,
  removeDeviceFromKit, getAllVotingDevices, getDeviceKitById
} from '../../db';
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
      const allKits = await getAllDeviceKits();
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
      const allVotingDevices = await getAllVotingDevices();
      console.log('[KitSettings] Loaded availableDevices:', allVotingDevices);
      setAvailableDevices(allVotingDevices);
    } catch (err) {
      console.error("Error loading all voting devices:", err);
      setError("Erreur critique: Impossible de charger la liste des boîtiers disponibles pour l'assignation.");
    }
  };

  useEffect(() => {
    console.log('[KitSettings] Selected kit changed (in useEffect):', selectedKit);
    if (selectedKit && selectedKit.id) {
      loadDevicesForKit(selectedKit.id);
    } else {
      setKitDevices([]);
    }
  }, [selectedKit]);

  const loadDevicesForKit = async (kitId: number) => {
    try {
      const devices = await getVotingDevicesForKit(kitId);
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
    setSelectedKit(null); // Déselectionner un kit si on ouvre le formulaire de création
    setError(null);
  };

  const handleOpenEditKitForm = (kit: DeviceKit) => {
    setEditingKit(kit);
    setKitName(kit.name);
    setIsCreatingKit(false);
    setSelectedKit(null); // Déselectionner un kit si on ouvre le formulaire d'édition
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
        await updateDeviceKit(editingKit.id!, { name: kitName, isDefault: editingKit.isDefault });
      } else {
        const allKits = await getAllDeviceKits();
        const isFirstKit = allKits.length === 0;
        await addDeviceKit({ name: kitName, isDefault: isFirstKit ? 1 : 0 });
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
        await deleteDeviceKit(kitId);
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
      await setDefaultDeviceKit(kitId);
      await loadKits(); // Recharger tous les kits pour mettre à jour l'indicateur "Par défaut"

      if (selectedKit && selectedKit.id) {
          const updatedSelectedKit = await getDeviceKitById(selectedKit.id);
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
    if (!selectedKit || !selectedKit.id || devicesToAssign.length === 0) {
      console.warn('[KitSettings] handleAddSelectedDevicesToKit - Conditions non remplies:', {selectedKit, devicesToAssign});
      return;
    }

    const kitId = selectedKit.id;
    let successCount = 0;
    const errorMessages: string[] = [];
    const currentKitName = selectedKit.name;

    console.log(`[KitSettings] Début de l'ajout de ${devicesToAssign.length} boîtier(s) au kit "${currentKitName}" (ID: ${kitId})`);
    setError(null);

    for (const deviceId of devicesToAssign) {
      try {
        console.log(`[KitSettings] Assignation du boîtier ID ${deviceId} au kit ID ${kitId}`);
        await assignDeviceToKit(kitId, deviceId);
        successCount++;
      } catch (err: any) {
        console.error(`[KitSettings] Erreur lors de l'assignation du boîtier ${deviceId} au kit ${kitId} ("${currentKitName}"):`, err);
        let deviceName = availableDevices.find(d => d.id === deviceId)?.name || `ID ${deviceId}`;
        if (err.message && err.message.toLowerCase().includes('constraint')) {
          errorMessages.push(`Le boîtier "${deviceName}" est peut-être déjà assigné (erreur de contrainte).`);
        } else {
          errorMessages.push(`Échec de l'assignation pour "${deviceName}".`);
        }
      }
    }

    console.log(`[KitSettings] Fin de la boucle d'assignation. Succès: ${successCount}, Erreurs: ${errorMessages.length}`);
    setDevicesToAssign([]);
    await loadDevicesForKit(kitId);

    if (errorMessages.length > 0) {
      setError(`Erreurs lors de l'ajout au kit "${currentKitName}": ${errorMessages.join('; ')} (${successCount} boîtiers ajoutés avec succès).`);
    } else if (successCount > 0) {
      setError(null);
      console.log(`[KitSettings] ${successCount} boîtier(s) ajouté(s) avec succès au kit "${currentKitName}".`);
    } else {
      console.warn('[KitSettings] handleAddSelectedDevicesToKit - Terminé sans succès ni erreur explicite, devicesToAssign était:', devicesToAssign);
    }
  };

  const handleRemoveDeviceFromSelectedKit = async (votingDeviceId: number, deviceName: string) => {
    if (!selectedKit || !selectedKit.id) return;
    if (window.confirm(`Êtes-vous sûr de vouloir retirer le boîtier "${deviceName}" du kit "${selectedKit.name}" ?`)) {
      try {
        setError(null);
        await removeDeviceFromKit(selectedKit.id, votingDeviceId);
        loadDevicesForKit(selectedKit.id);
      } catch (err) {
        console.error(`Error removing device ${deviceName} from kit ${selectedKit.name}:`, err);
        setError(`Erreur lors du retrait du boîtier "${deviceName}" du kit.`);
      }
    }
  };

  if (isLoading && kits.length === 0) {
    return (
      <Card title="Gestion des Kits de Boîtiers">
        <p>Chargement des kits...</p>
      </Card>
    );
  }

  console.log('[KitSettings] Rendering. isLoading:', isLoading, 'Error state:', error, 'AvailableDevices count:', availableDevices.length, 'SelectedKit ID:', selectedKit?.id);


  return (
    <div className="space-y-6">
      {error && !selectedKit && !editingKit && !isCreatingKit && <p className="text-red-500 mb-2 p-3 bg-red-50 border border-red-200 rounded-md">{error}</p>}

      {!isCreatingKit && !editingKit && (
        <Card title="Liste des Kits de Boîtiers">
          <div className="mb-4">
            <Button onClick={handleOpenCreateKitForm} icon={<Plus size={16} />}>
              Nouveau Kit
            </Button>
          </div>
          {kits.length === 0 && !isLoading ? (
            <p className="text-sm text-gray-500 italic">Aucun kit configuré pour le moment.</p>
          ) : (
            <ul className="space-y-2">
              {kits.map(kit => (
                <li
                  key={kit.id}
                  className={`p-3 rounded-md border flex justify-between items-center cursor-pointer hover:bg-gray-50
                              ${selectedKit?.id === kit.id ? 'bg-blue-50 border-blue-300' : 'border-gray-200'}`}
                  onClick={() => {
                      console.log(`[KitSettings] Kit cliqué: ${kit.name} (ID: ${kit.id}). Actuellement isCreatingKit: ${isCreatingKit}, editingKit: ${!!editingKit}`);
                      if (isCreatingKit || !!editingKit) {
                        console.log('[KitSettings] Clic sur kit ignoré car isCreatingKit ou !!editingKit est vrai.');
                        return;
                      }
                      setSelectedKit(kit);
                      setDevicesToAssign([]);
                      setError(null); // Clear errors when selecting a kit
                  }}
                >
                  <div>
                    <span className="font-medium">{kit.name}</span>
                    {kit.isDefault === 1 && (
                      <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Par défaut</span>
                    )}
                  </div>
                  <div className="space-x-2">
                     <Button variant="outline" size="sm" onClick={(e: React.MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); handleOpenEditKitForm(kit); }} icon={<Edit3 size={14}/>} disabled={isCreatingKit || !!editingKit}>Modifier</Button>
                     <Button variant="danger" size="sm" onClick={(e: React.MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); handleDeleteKit(kit.id!, kit.name);}} icon={<Trash2 size={14}/>} disabled={isCreatingKit || !!editingKit}>Supprimer</Button>
                     {kit.isDefault !== 1 && (
                       <Button
                         variant="ghost"
                         size="sm"
                         onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                           e.stopPropagation();
                           handleSetDefaultKit(kit.id!);
                         }}
                         title="Définir comme kit par défaut"
                         disabled={isCreatingKit || !!editingKit}
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
          {error && <p className="text-red-500 mb-3 p-2 bg-red-50 border border-red-200 rounded-md">{error}</p>}
          <div className="space-y-4">
            <Input
              label="Nom du Kit *"
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
        <Card title={`Gérer les Boîtiers du Kit : ${selectedKit.name}`}>
           {error && <p className="text-red-500 mb-3 p-2 bg-red-50 border border-red-200 rounded-md">{error}</p>}
          <p className="mb-2 text-sm text-gray-700">Boîtiers actuellement dans ce kit :</p>
          {kitDevices.length === 0 ? (
            <p className="text-sm text-gray-500 italic mb-3">Aucun boîtier dans ce kit.</p>
          ) : (
            <ul className="space-y-1 mb-4">
              {kitDevices.map(device => (
                <li key={device.id} className="text-sm p-2 border-b flex justify-between items-center">
                  <span>{device.name} (S/N: {device.serialNumber})</span>
                  <Button
                    variant="ghost"
                    size="sm"
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
          <h4 className="text-md font-semibold mb-2">Ajouter des boîtiers au kit "{selectedKit.name}" :</h4>
          <p className="text-sm text-gray-600 mb-3">Cochez les boîtiers disponibles ci-dessous que vous souhaitez inclure dans ce kit. Les boîtiers déjà présents dans ce kit sont désactivés.</p>

          {availableDevices.length === 0 && !isLoading ? (
             <p className="text-sm text-gray-500 italic p-3 border rounded-md bg-gray-50">Aucun boîtier global n'est configuré dans l'application. Veuillez d'abord les ajouter via l'onglet "Gestion des Boîtiers".</p>
          ) : availableDevices.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto border p-3 rounded-md bg-gray-50">
              {availableDevices.map(device => {
                const isAssignedToCurrentKit = kitDevices.some(kd => kd.id === device.id);
                return (
                  <label
                    key={device.id}
                    className={`flex items-center p-2 rounded-md transition-colors
                                ${isAssignedToCurrentKit
                                  ? 'bg-gray-200 opacity-70 cursor-not-allowed'
                                  : devicesToAssign.includes(device.id!)
                                    ? 'bg-blue-100 hover:bg-blue-200 cursor-pointer'
                                    : 'hover:bg-gray-100 cursor-pointer'
                                }`}
                  >
                    <input
                      type="checkbox"
                      className="mr-3 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                      checked={devicesToAssign.includes(device.id!) || isAssignedToCurrentKit}
                      onChange={() => {
                        if(isAssignedToCurrentKit) return;
                        handleToggleDeviceToAssign(device.id!);
                      }}
                      disabled={isAssignedToCurrentKit}
                      id={`device-assign-${device.id}`}
                    />
                    <span className="flex-grow text-sm">
                      {device.name} <span className="text-xs text-gray-500">(S/N: {device.serialNumber})</span>
                    </span>
                    {isAssignedToCurrentKit && <span className="ml-auto text-xs text-green-700 font-semibold px-2 py-0.5 bg-green-100 rounded-full">Assigné</span>}
                  </label>
                );
              })}
            </div>
          ) : isLoading ? (
            <p className="text-sm text-gray-500 italic">Chargement des boîtiers disponibles...</p>
          ) : null}

          {availableDevices.length > 0 && (
            <Button
              onClick={handleAddSelectedDevicesToKit}
              className="mt-4"
              disabled={devicesToAssign.length === 0}
              icon={<Plus size={16}/>}
            >
              Ajouter {devicesToAssign.length > 0 ? `${devicesToAssign.length} ` : ''}boîtier(s) sélectionné(s) au kit
            </Button>
          )}
        </Card>
      )}
    </div>
  );
};

export default KitSettings;
