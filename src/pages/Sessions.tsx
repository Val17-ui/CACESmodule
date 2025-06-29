import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/layout/Layout';
import SessionsList from '../components/sessions/SessionsList';
import SessionForm from '../components/sessions/SessionForm';
import Button from '../components/ui/Button';
import { Plus } from 'lucide-react';
// import { mockSessions } from '../data/mockData'; // Supprimer mockData
import { getAllSessions } from '../db'; // Importer la fonction de la DB
import { Session as DBSession } from '../types'; // Importer le type Session de la DB

type SessionsProps = {
  activePage: string;
  onPageChange: (page: string) => void;
};

const Sessions: React.FC<SessionsProps> = ({ activePage, onPageChange }) => {
  const [isCreating, setIsCreating] = useState(false);
  // managingSessionId sera maintenant un nombre (l'ID de la DB) ou null
  const [managingSessionId, setManagingSessionId] = useState<number | null>(null);
  const [dbSessions, setDbSessions] = useState<DBSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const sessionsFromDb = await getAllSessions();
      setDbSessions(sessionsFromDb);
    } catch (error) {
      console.error("Erreur lors de la récupération des sessions:", error);
      setDbSessions([]); // En cas d'erreur, afficher une liste vide
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleCreateNew = () => {
    setIsCreating(true);
    setManagingSessionId(null); // Pas d'ID pour une nouvelle session
  };

  // id est maintenant un nombre
  const handleManageSession = (id: number) => {
    setManagingSessionId(id);
    setIsCreating(false); // On n'est pas en mode création pure, mais en mode édition/gestion
  };

  // id est maintenant un nombre
  const handleStartExam = (id: number) => {
    console.log(`Démarrage de l'examen pour la session ID: ${id}`);
    // TODO: Logique pour démarrer l'examen, potentiellement passer l'ID de session à la page d'examen
    onPageChange('exams'); // Navigue vers la page des examens
  };

  const handleBackToList = () => {
    setIsCreating(false);
    setManagingSessionId(null);
    fetchSessions(); // Rafraîchir la liste des sessions après création/modification
  };

  const headerActions = (
    <div className="flex items-center space-x-3">
      {!isCreating && !managingSessionId && (
        <Button
          variant="primary"
          icon={<Plus size={16} />}
          onClick={handleCreateNew}
        >
          Nouvelle session
        </Button>
      )}
      {(isCreating || managingSessionId) && (
        <Button
          variant="outline"
          onClick={handleBackToList}
        >
          Retour à la liste
        </Button>
      )}
    </div>
  );

  const title = isCreating
    ? "Créer une nouvelle session"
    : managingSessionId
    ? `Gérer la session (ID: ${managingSessionId})`
    : "Liste des Sessions";

  const subtitle = isCreating
    ? "Remplissez les informations pour créer une nouvelle session de certification CACES."
    : managingSessionId
    ? "Modifiez les informations de la session, les participants, ou générez le fichier .ors."
    : "Consultez et gérez vos sessions de certification CACES enregistrées.";

  if (isLoading && !isCreating && !managingSessionId) {
    return (
      <Layout
        title="Sessions"
        subtitle="Chargement des sessions..."
        actions={headerActions}
        activePage={activePage}
        onPageChange={onPageChange}
      >
        <div className="text-center py-10">Chargement en cours...</div>
      </Layout>
    );
  }

  return (
    <Layout
      title={title}
      subtitle={subtitle}
      actions={headerActions}
      activePage={activePage}
      onPageChange={onPageChange}
    >
      {!isCreating && !managingSessionId ? (
        <SessionsList
          sessions={dbSessions} // Utiliser les sessions de la DB
          onManageSession={handleManageSession}
          onStartExam={handleStartExam}
        />
      ) : (
        // Passer managingSessionId (qui est un number ou null) à SessionForm
        <SessionForm sessionIdToLoad={managingSessionId ?? undefined} />
      )}
    </Layout>
  );
};

export default Sessions;