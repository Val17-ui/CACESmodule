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
  onPageChange: (page: string, sessionId?: number) => void; // sessionId est optionnel ici aussi
  sessionId?: number; // Reçu de App.tsx
};

const Sessions: React.FC<SessionsProps> = ({ activePage, onPageChange, sessionId }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [managingSessionId, setManagingSessionId] = useState<number | null>(sessionId ?? null);
  const [dbSessions, setDbSessions] = useState<DBSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Effet pour gérer le sessionId passé en prop
  useEffect(() => {
    if (sessionId !== undefined) {
      setManagingSessionId(sessionId);
      setIsCreating(false); // On n'est pas en création si un ID est fourni
    } else {
      // Si aucun sessionId n'est fourni (par exemple, navigation directe vers la page 'sessions')
      // on s'assure de ne pas être en mode édition sauf si l'utilisateur clique explicitement sur "créer"
      // ou sur une session de la liste.
      // Si on veut que la page Sessions réinitialise sa vue (liste) quand on navigue vers elle sans ID,
      // il faudrait peut-être aussi réinitialiser managingSessionId ici.
      // setManagingSessionId(null); // Décommenter si on veut toujours afficher la liste par défaut sans ID
    }
  }, [sessionId]);


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
    // Ne fetcher les sessions que si on n'est pas en train de charger un formulaire directement via sessionId
    if (!managingSessionId || dbSessions.length === 0 ) { // fetch si pas d'ID de gestion ou si la liste est vide
        fetchSessions();
    } else {
        setIsLoading(false); // On a déjà un ID, on ne charge pas la liste complète
    }
  }, [fetchSessions, managingSessionId, dbSessions.length]);

  const handleCreateNew = () => {
    setIsCreating(true);
    setManagingSessionId(null);
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
    // fetchSessions(); // Rafraîchir la liste des sessions après création/modification - fetchSessions est déjà dans un useEffect dépendant de managingSessionId
    // Notifier App.tsx qu'on n'est plus sur une session spécifique
    onPageChange(activePage, undefined); // ou onPageChange('sessions', undefined) si on veut forcer la page sessions
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