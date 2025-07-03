import React, { useState, useEffect, useCallback } from 'react';
import { Trainer } from '../../types';
import { getAllTrainers, addTrainer, updateTrainer, deleteTrainer, setDefaultTrainer } from '../../db';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { Plus, Trash2, Star } from 'lucide-react';

const TrainerSettings: React.FC = () => {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [newTrainerName, setNewTrainerName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrainers = useCallback(async () => {
    setIsLoading(true);
    try {
      const allTrainers = await getAllTrainers();
      setTrainers(allTrainers.sort((a,b) => a.name.localeCompare(b.name)));
    } catch (err) {
      setError('Erreur lors de la récupération des formateurs.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrainers();
  }, [fetchTrainers]);

  const handleAddTrainer = async () => {
    if (!newTrainerName.trim()) {
      setError('Le nom du formateur ne peut pas être vide.');
      return;
    }
    setError(null);
    try {
      // Si c'est le premier formateur, le définir par défaut
      const isFirstTrainer = trainers.length === 0;
      await addTrainer({ name: newTrainerName.trim(), isDefault: isFirstTrainer });
      setNewTrainerName('');
      fetchTrainers(); // Recharger la liste
    } catch (err) {
      setError('Erreur lors de l\'ajout du formateur.');
      console.error(err);
    }
  };

  const handleDeleteTrainer = async (id: number) => {
    setError(null);
    // TODO: Ajouter une confirmation avant suppression
    // TODO: Gérer la suppression du formateur par défaut (ex: choisir un autre par défaut si possible)
    const trainerToDelete = trainers.find(t => t.id === id);
    if (trainerToDelete && trainerToDelete.isDefault && trainers.length > 1) {
        alert("Vous ne pouvez pas supprimer le formateur par défaut s'il en existe d'autres. Veuillez d'abord désigner un autre formateur par défaut.");
        return;
    }

    try {
      await deleteTrainer(id);
      fetchTrainers();
    } catch (err) {
      setError('Erreur lors de la suppression du formateur.');
      console.error(err);
    }
  };

  const handleSetDefaultTrainer = async (id: number) => {
    setError(null);
    try {
      await setDefaultTrainer(id);
      fetchTrainers();
    } catch (err) {
      setError('Erreur lors de la définition du formateur par défaut.');
      console.error(err);
    }
  };

  const handleNameChange = async (id: number, newName: string) => {
    if (!newName.trim()) {
        alert("Le nom du formateur ne peut pas être vide.");
        fetchTrainers(); // Pour rafraîchir et annuler l'édition en cours dans l'UI
        return;
    }
    try {
        await updateTrainer(id, { name: newName.trim() });
        fetchTrainers(); // Recharger pour refléter le changement
    } catch (err) {
        console.error("Erreur lors de la mise à jour du nom du formateur:", err);
        alert("Erreur lors de la mise à jour du nom.");
    }
  };


  if (isLoading) {
    return <p>Chargement des formateurs...</p>;
  }

  return (
    <Card title="Gestion des Formateurs">
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-800 mb-2">Ajouter un nouveau formateur</h3>
        <div className="flex items-center gap-3">
          <Input
            type="text"
            placeholder="Nom du formateur"
            value={newTrainerName}
            onChange={(e) => setNewTrainerName(e.target.value)}
            className="flex-grow"
          />
          <Button onClick={handleAddTrainer} icon={<Plus size={16}/>}>
            Ajouter
          </Button>
        </div>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-800 mb-3">Liste des formateurs</h3>
        {trainers.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun formateur enregistré.</p>
        ) : (
          <ul className="space-y-3">
            {trainers.map((trainer) => (
              <li key={trainer.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                <Input
                    type="text"
                    defaultValue={trainer.name} // Utiliser defaultValue pour l'édition initiale
                    onBlur={(e) => {
                        if (trainer.id && e.target.value !== trainer.name) {
                           handleNameChange(trainer.id, e.target.value);
                        }
                    }}
                    className="mb-0 text-sm font-medium text-gray-900 border-0 focus:ring-2 focus:ring-blue-500 rounded flex-grow mr-2"
                />
                <div className="flex items-center space-x-2">
                  {trainer.isDefault ? (
                    <Badge variant="success" className="cursor-default">
                      <Star size={14} className="mr-1 inline-block" /> Par défaut
                    </Badge>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => trainer.id && handleSetDefaultTrainer(trainer.id)}
                      title="Définir comme formateur par défaut"
                    >
                      <Star size={14} />
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<Trash2 size={14} />}
                    onClick={() => trainer.id && handleDeleteTrainer(trainer.id)}
                    title="Supprimer le formateur"
                  >
                    {/* Optionnel: texte pour petits écrans <span className="hidden sm:inline ml-1">Supprimer</span> */}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
};

export default TrainerSettings;
