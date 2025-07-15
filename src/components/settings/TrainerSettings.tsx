import React, { useState, useEffect, useCallback } from 'react';
import { Trainer } from '../../types';
import { getAllTrainers, addTrainer, updateTrainer, deleteTrainer, setDefaultTrainer, db } from '../../db';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { Plus, Trash2, Star } from 'lucide-react';
import Badge from '../ui/Badge';

const TrainerSettings: React.FC = () => {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [newTrainerName, setNewTrainerName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchTrainers = useCallback(async () => {
    setIsLoading(true);
    try {
      const allTrainers = await getAllTrainers();
      setTrainers(allTrainers.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      setError('Erreur lors de la récupération des formateurs.');
      console.error('Erreur fetchTrainers:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Vérifier la version de la base de données
    const checkDbVersion = () => { // Plus besoin d'async ici si db.verno est utilisé après ouverture
      if (db.isOpen()) {
        const version = db.verno;
        console.log(`Version de la base de données : ${version}`);
        if (version < 10) {
          setError('La base de données n\'est pas à la dernière version (10). La version actuelle est '+ version +'. Essayez de vider le cache et de rafraîchir l\'application, ou contactez le support si le problème persiste.');
        }
      } else {
        // La base de données n'est pas encore ouverte, on pourrait attendre l'événement "ready"
        // ou simplement supposer qu'elle s'ouvrira correctement.
        // Pour ce log, il est préférable qu'elle soit ouverte.
        db.on('ready', () => {
          const version = db.verno;
          console.log(`Version de la base de données (après ready event) : ${version}`);
          if (version < 10) {
             setError('La base de données n\'est pas à la dernière version (10). La version actuelle est '+ version +'. Essayez de vider le cache et de rafraîchir l\'application, ou contactez le support si le problème persiste.');
          }
        });
      }
    };
    checkDbVersion();
    fetchTrainers();
  }, [fetchTrainers]);

  const handleAddTrainer = async (e: React.FormEvent) => {
    e.preventDefault(); // Empêche le rechargement de la page
    if (!newTrainerName.trim()) {
      setError('Le nom du formateur ne peut pas être vide.');
      setSuccess(null);
      return;
    }
    if (newTrainerName.length > 100) {
      setError('Le nom du formateur ne peut pas dépasser 100 caractères.');
      setSuccess(null);
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      // Convertir l'état booléen de la case à cocher en 0 ou 1
      const trainerPayload: Omit<Trainer, 'id'> = {
        name: newTrainerName.trim(),
        isDefault: isDefault ? 1 : 0,
      };
      const id = await addTrainer(trainerPayload);
      if (id !== undefined) {
        setSuccess(`Formateur "${newTrainerName}" ajouté avec succès.`);
        setNewTrainerName('');
        setIsDefault(false);
        await fetchTrainers();
      } else {
        setError('Échec de l\'ajout du formateur. Vérifiez la console pour plus de détails.');
      }
    } catch (err: any) {
      console.error('Erreur lors de l\'ajout du formateur:', err.message, err.stack);
      setError(`Erreur lors de l'ajout du formateur : ${err.message}`);
    }
  };

  const handleDeleteTrainer = async (id: number) => {
    setError(null);
    setSuccess(null);
    const trainerToDelete = trainers.find(t => t.id === id);
    // Utiliser === 1 pour vérifier si le formateur est par défaut
    if (trainerToDelete && trainerToDelete.isDefault === 1 && trainers.length > 1) {
      setError('Vous ne pouvez pas supprimer le formateur par défaut s\'il en existe d\'autres. Veuillez d\'abord désigner un autre formateur par défaut.');
      return;
    }
    if (!window.confirm(`Voulez-vous vraiment supprimer le formateur "${trainerToDelete?.name}" ?`)) {
      return;
    }
    try {
      await deleteTrainer(id);
      setSuccess('Formateur supprimé avec succès.');
      await fetchTrainers();
      // Si le formateur supprimé était par défaut et qu'il reste d'autres formateurs, définir le premier comme par défaut
      // Cette logique est un peu simplifiée, car "le premier" après un filtre peut ne pas être idéal.
      // Il faudrait s'assurer que `trainers` est à jour avant de choisir.
      // Une meilleure approche serait de re-fetcher la liste, puis de vérifier.
      // Cependant, `fetchTrainers` est déjà appelé, donc `trainers` sera la liste mise à jour *après* suppression.
      const currentTrainers = await getAllTrainers(); // Re-fetch pour la logique de défaut
      // Utiliser === 1 pour la condition
      if (trainerToDelete?.isDefault === 1 && currentTrainers.length > 0) {
         const defaultCandidate = currentTrainers.sort((a,b) => (a.id ?? 0) - (b.id ?? 0))[0];
         if(defaultCandidate.id) { // s'assurer que defaultCandidate.id est défini
            await setDefaultTrainer(defaultCandidate.id); // setDefaultTrainer gère déjà les 0/1 en interne
            await fetchTrainers(); // Re-fetch final pour UI
         }
      } else if (currentTrainers.length === 0) {
        // S'il n'y a plus de formateurs, rien à faire pour le défaut.
      }

    } catch (err: any) {
      console.error('Erreur lors de la suppression du formateur:', err.message, err.stack);
      setError(`Erreur lors de la suppression du formateur : ${err.message}`);
    }
  };

  const handleSetDefaultTrainer = async (id: number) => {
    setError(null);
    setSuccess(null);
    try {
      const result = await setDefaultTrainer(id);
      if (result !== undefined) {
        setSuccess('Formateur défini comme par défaut.');
        await fetchTrainers();
      } else {
        setError('Échec de la définition du formateur par défaut.');
      }
    } catch (err: any) {
      console.error('Erreur lors de la définition du formateur par défaut:', err.message, err.stack);
      setError(`Erreur lors de la définition du formateur par défaut : ${err.message}`);
    }
  };

  const handleNameChange = async (id: number, newName: string) => {
    setError(null);
    setSuccess(null);
    if (!newName.trim()) {
      setError('Le nom du formateur ne peut pas être vide.');
      await fetchTrainers(); // Recharger pour annuler l'édition en UI si le nom est vide
      return;
    }
    if (newName.length > 100) {
      setError('Le nom du formateur ne peut pas dépasser 100 caractères.');
      await fetchTrainers(); // Recharger
      return;
    }
    try {
      // Récupérer le formateur actuel pour conserver son statut isDefault
      const trainerToUpdate = trainers.find(t => t.id === id);
      if (!trainerToUpdate) {
          setError("Formateur non trouvé pour la mise à jour.");
          return;
      }
      // Assurer que trainerToUpdate.isDefault est bien 0 ou 1. Le type Trainer le garantit déjà.
      // updateTrainer s'attend à 0 | 1 | undefined pour isDefault.
      await updateTrainer(id, { name: newName.trim(), isDefault: trainerToUpdate.isDefault });
      setSuccess('Nom du formateur mis à jour avec succès.');
      await fetchTrainers();
    } catch (err: any) {
      console.error('Erreur lors de la mise à jour du nom du formateur:', err.message, err.stack);
      setError(`Erreur lors de la mise à jour du nom : ${err.message}`);
    }
  };

  if (isLoading) {
    return <p>Chargement des formateurs...</p>;
  }

  return (
    <Card title="Gestion des Formateurs">
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-800 mb-2">Ajouter un nouveau formateur</h3>
        <form onSubmit={handleAddTrainer}>
          <div className="flex items-center gap-3">
            <Input
              type="text"
              placeholder="Nom du formateur"
              value={newTrainerName}
              onChange={(e) => setNewTrainerName(e.target.value)}
              className="flex-grow"
            />
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                className="form-checkbox h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
              />
              <span className="text-sm text-gray-700">Par défaut</span>
            </label>
            <Button type="submit" icon={<Plus size={16} />}>
              Ajouter
            </Button>
          </div>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          {success && <p className="text-green-500 text-sm mt-2">{success}</p>}
        </form>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-800 mb-3">Liste des formateurs</h3>
        {trainers.length === 0 && !isLoading ? (
          <p className="text-sm text-gray-500">Aucun formateur enregistré.</p>
        ) : (
          <ul className="space-y-3">
            {trainers.map((trainer) => (
              <li
                key={trainer.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg shadow-sm hover:shadow-md transition-shadow"
              >
                <Input
                  type="text"
                  defaultValue={trainer.name}
                  onBlur={(e) => {
                    if (trainer.id && e.target.value !== trainer.name) {
                      handleNameChange(trainer.id, e.target.value);
                    }
                  }}
                  className="mb-0 text-sm font-medium text-gray-900 border-0 focus:ring-2 focus:ring-blue-500 rounded flex-grow mr-2"
                  // Note: Pour éviter les problèmes de curseur, on pourrait utiliser un état contrôlé
                  // ou une clé unique pour forcer le re-render de l'input si la valeur par défaut change.
                  // Pour l'instant, defaultValue est utilisé.
                />
                <div className="flex items-center space-x-2">
                  {trainer.isDefault === 1 ? ( // Comparer avec 1
                    <Badge variant="success" className="cursor-default">
                      <Star size={14} className="mr-1 inline-block" /> Par défaut
                    </Badge>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => trainer.id && handleSetDefaultTrainer(trainer.id)}
                      title="Définir comme formateur par défaut"
                      disabled={!trainer.id} // Désactiver si l'ID est undefined
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
                    disabled={!trainer.id} // Désactiver si l'ID est undefined
                  />
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
