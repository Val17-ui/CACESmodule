import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { Plus, Edit3, Trash2, CheckSquare, Square } from 'lucide-react';
import { db } from '../../db';
import { DeviceKit, VotingDevice } from '../../types';

const KitSettings: React.FC = () => {
  const [kits, setKits] = useState<DeviceKit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // États pour la création/édition de kit
  const [isCreatingKit, setIsCreatingKit] = useState(false);
  const [editingKit, setEditingKit] = useState<DeviceKit | null>(null);
  const [kitName, setKitName] = useState('');

  // États pour la gestion des boîtiers dans un kit sélectionné
  const [selectedKit, setSelectedKit] = useState<DeviceKit | null>(null);
  const [availableDevices, setAvailableDevices] = useState<VotingDevice[]>([]);
  const [kitDevices, setKitDevices] = useState<VotingDevice[]>([]);
  const [devicesToAssign, setDevicesToAssign] = useState<number[]>([]); // IDs des VotingDevice à assigner

  useEffect(() => {
    loadKits();
    loadAllVotingDevices(); // Charger tous les boîtiers pour la sélection
  }, []);

  const loadKits = async () => {
    setIsLoading(true);
    try {
      const allKits = await db.getAllDeviceKits();
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
      const allVotingDevices = await db.getAllVotingDevices();
      setAvailableDevices(allVotingDevices);
    } catch (err) {
      console.error("Error loading all voting devices:", err);
      // Gérer l'erreur si nécessaire, peut-être un message à l'utilisateur
    }
  };

  useEffect(() => {
    if (selectedKit) {
      loadDevicesForKit(selectedKit.id!);
    } else {
      setKitDevices([]);
    }
  }, [selectedKit]);

  const loadDevicesForKit = async (kitId: number) => {
    try {
      const devices = await db.getVotingDevicesForKit(kitId);
      setKitDevices(devices);
    } catch (err) {
      console.error(`Error loading devices for kit ${kitId}:`, err);
      setError(`Erreur lors du chargement des boîtiers pour le kit ${selectedKit?.name}.`);
    }
  };

  // --- Gestion des Kits (Création, Édition, Suppression, Défaut) ---
  // À implémenter dans les étapes suivantes du plan

  // --- Gestion des Boîtiers dans un Kit ---
  // À implémenter dans les étapes suivantes du plan


  if (isLoading) {
    return (
      <Card title="Gestion des Kits de Boîtiers">
        <p>Chargement des kits...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="Gestion des Kits de Boîtiers">
        <p className="text-red-500">{error}</p>
        <Button onClick={loadKits} className="mt-2">Réessayer</Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card title="Liste des Kits de Boîtiers">
        <div className="mb-4">
          <Button onClick={() => { setIsCreatingKit(true); setEditingKit(null); setKitName(''); }} icon={<Plus size={16} />}>
            Nouveau Kit
          </Button>
        </div>
        {kits.length === 0 ? (
          <p className="text-sm text-gray-500 italic">Aucun kit configuré pour le moment.</p>
        ) : (
          <ul className="space-y-2">
            {kits.map(kit => (
              <li
                key={kit.id}
                className={`p-3 rounded-md border flex justify-between items-center cursor-pointer hover:bg-gray-50 ${selectedKit?.id === kit.id ? 'bg-blue-50 border-blue-300' : 'border-gray-200'}`}
                onClick={() => setSelectedKit(kit)}
              >
                <div>
                  <span className="font-medium">{kit.name}</span>
                  {kit.isDefault === 1 && (
                    <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Par défaut</span>
                  )}
                </div>
                <div className="space-x-2">
                  {/* Boutons Modifier, Supprimer, Défaut (seront implémentés plus tard) */}
                   <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); /* TODO: logique edit */ alert(`Modifier kit ${kit.name}`); }} icon={<Edit3 size={14}/>}>Modifier</Button>
                   <Button variant="danger" size="sm" onClick={(e) => { e.stopPropagation(); /* TODO: logique delete */ alert(`Supprimer kit ${kit.name}`);}} icon={<Trash2 size={14}/>}>Supprimer</Button>
                   {kit.isDefault !== 1 && (
                     <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); /* TODO: logique set default */ alert(`Définir ${kit.name} par défaut`);}} title="Définir comme kit par défaut">
                       <CheckSquare size={16} />
                     </Button>
                   )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {isCreatingKit || editingKit ? (
        <Card title={editingKit ? "Modifier le Kit" : "Créer un Nouveau Kit"}>
          {/* Formulaire de création/modification de kit (sera implémenté) */}
          <p>Formulaire de création/modification de kit ici...</p>
          <Input
            label="Nom du Kit"
            value={kitName}
            onChange={(e) => setKitName(e.target.value)}
            placeholder="Ex: Salle de conférence A"
          />
          <div className="mt-4 flex space-x-2">
            <Button onClick={() => alert('Sauvegarder kit (TODO)')}>Sauvegarder</Button>
            <Button variant="outline" onClick={() => { setIsCreatingKit(false); setEditingKit(null); }}>Annuler</Button>
          </div>
        </Card>
      ) : null}

      {selectedKit && !isCreatingKit && !editingKit && (
        <Card title={`Boîtiers dans le Kit : ${selectedKit.name}`}>
          {/* Gestion des boîtiers pour le kit sélectionné (sera implémenté) */}
          <p className="mb-2">Boîtiers actuellement dans ce kit :</p>
          {kitDevices.length === 0 ? (
            <p className="text-sm text-gray-500 italic">Aucun boîtier dans ce kit.</p>
          ) : (
            <ul className="space-y-1 mb-4">
              {kitDevices.map(device => (
                <li key={device.id} className="text-sm p-2 border-b flex justify-between items-center">
                  <span>{device.name} (S/N: {device.serialNumber})</span>
                  <Button variant="ghost" size="icon" title="Retirer du kit" onClick={() => alert(`Retirer ${device.name} (TODO)`)}>
                    <Trash2 size={14} className="text-red-500"/>
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <hr className="my-4"/>
          <h4 className="text-md font-semibold mb-2">Ajouter des boîtiers à ce kit :</h4>
          <p className="text-sm text-gray-600 mb-2">Sélectionnez les boîtiers disponibles à ajouter à "{selectedKit.name}".</p>
          {availableDevices.length === 0 ? (
             <p className="text-sm text-gray-500 italic">Aucun boîtier global n'est configuré. Veuillez les ajouter dans "Matériel Principal" d'abord.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto border p-2 rounded-md">
              {availableDevices.map(device => {
                const isAssigned = kitDevices.some(kd => kd.id === device.id);
                return (
                  <label key={device.id} className={`flex items-center p-2 rounded hover:bg-gray-100 ${isAssigned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                    <input
                      type="checkbox"
                      className="mr-2 h-4 w-4"
                      checked={devicesToAssign.includes(device.id!)}
                      onChange={() => {
                        if(isAssigned) return;
                        setDevicesToAssign(prev =>
                          prev.includes(device.id!) ? prev.filter(id => id !== device.id) : [...prev, device.id!]
                        );
                      }}
                      disabled={isAssigned}
                    />
                    {device.name} (S/N: {device.serialNumber})
                    {isAssigned && <span className="ml-auto text-xs text-gray-400">(Déjà dans ce kit)</span>}
                  </label>
                );
              })}
            </div>
          )}
          <Button
            onClick={() => alert(`Ajouter boîtiers sélectionnés (TODO): ${devicesToAssign.join(', ')}`)}
            className="mt-4"
            disabled={devicesToAssign.length === 0}
          >
            Ajouter les boîtiers sélectionnés au kit
          </Button>
        </Card>
      )}
    </div>
  );
};

export default KitSettings;
