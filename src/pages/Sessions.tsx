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

import Input from '../components/ui/Input'; // Importer le composant Input

// import Input from '../components/ui/Input'; // Nettoyage du double import, déjà fait plus haut
import Select from '../components/ui/Select'; // Importer le composant Select pour les filtres de période

// --- Fonctions utilitaires pour les dates ---
// ... (les fonctions de date restent les mêmes)

const getTodayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const getThisWeekRange = () => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 (Dim) - 6 (Sam)
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Ajuster pour que Lundi soit le début

  const start = new Date(today);
  start.setDate(today.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const getThisMonthRange = () => {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0); // Le jour 0 du mois suivant = dernier jour du mois actuel
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const getThisYearRange = () => {
  const today = new Date();
  const start = new Date(today.getFullYear(), 0, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(today.getFullYear(), 11, 31);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const getNextWeekRange = () => {
  const thisWeek = getThisWeekRange();
  const start = new Date(thisWeek.start);
  start.setDate(thisWeek.start.getDate() + 7);
  const end = new Date(thisWeek.end);
  end.setDate(thisWeek.end.getDate() + 7);
  return { start, end };
};

const getNextMonthRange = () => {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(today.getFullYear(), today.getMonth() + 2, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const getLastWeekRange = () => {
  const thisWeek = getThisWeekRange();
  const start = new Date(thisWeek.start);
  start.setDate(thisWeek.start.getDate() - 7);
  const end = new Date(thisWeek.end);
  end.setDate(thisWeek.end.getDate() - 7);
  return { start, end };
};

const getLastMonthRange = () => {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(today.getFullYear(), today.getMonth(), 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};


const periodFilters = [
  { value: 'all', label: 'Toutes les périodes' },
  { value: 'today', label: 'Aujourd’hui', getDateRange: getTodayRange },
  { value: 'thisWeek', label: 'Cette semaine', getDateRange: getThisWeekRange },
  { value: 'thisMonth', label: 'Ce mois-ci', getDateRange: getThisMonthRange },
  { value: 'thisYear', label: 'Cette année', getDateRange: getThisYearRange },
  { value: 'nextWeek', label: 'Semaine prochaine', getDateRange: getNextWeekRange },
  { value: 'nextMonth', label: 'Mois prochain', getDateRange: getNextMonthRange },
  { value: 'lastWeek', label: 'Semaine passée', getDateRange: getLastWeekRange },
  { value: 'lastMonth', label: 'Mois passé', getDateRange: getLastMonthRange },
];

const Sessions: React.FC<SessionsProps> = ({ activePage, onPageChange, sessionId }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [managingSessionId, setManagingSessionId] = useState<number | null>(sessionId ?? null);
  const [rawSessions, setRawSessions] = useState<DBSession[]>([]); // Sessions brutes de la DB
  const [processedSessions, setProcessedSessions] = useState<DBSession[]>([]); // Sessions triées et filtrées
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');

  // Effet pour gérer le sessionId passé en prop (pour l'affichage direct d'un formulaire)
  useEffect(() => {
    if (sessionId !== undefined) {
      setManagingSessionId(sessionId);
      setIsCreating(false);
    }
  }, [sessionId]);

  // Fetcher les sessions brutes
  const fetchRawSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const sessionsFromDb = await getAllSessions();
      setRawSessions(sessionsFromDb);
    } catch (error) {
      console.error("Erreur lors de la récupération des sessions:", error);
      setRawSessions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Effet pour fetcher les sessions si on n'est pas en mode gestion/création, ou si la liste est vide
  useEffect(() => {
    if (!managingSessionId) { // Si on n'est pas en train de gérer une session spécifique
        fetchRawSessions();
    } else {
        // Si on gère une session spécifique, on pourrait vouloir charger les données de cette session
        // mais la liste complète n'est pas nécessaire immédiatement, donc on arrête le chargement de la liste.
        // Si rawSessions est vide, il faudrait peut-être la charger quand même pour le cas où l'utilisateur
        // annule la gestion et retourne à la liste.
        if(rawSessions.length === 0) fetchRawSessions();
        else setIsLoading(false);
    }
  }, [fetchRawSessions, managingSessionId]);


  // Effet pour trier et filtrer les sessions
  useEffect(() => {
    let sessionsToProcess = [...rawSessions];

    // 1. Tri
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    sessionsToProcess.sort((a, b) => {
      const dateA = new Date(a.dateSession); dateA.setHours(0, 0, 0, 0);
      const dateB = new Date(b.dateSession); dateB.setHours(0, 0, 0, 0);
      const getCategory = (session: DBSession, sessionDate: Date) => {
        if (session.status === 'in-progress' || ((session.status === 'planned' || session.status === 'ready') && sessionDate.getTime() === today.getTime())) return 1; // Jour
        if ((session.status === 'planned' || session.status === 'ready') && sessionDate.getTime() > today.getTime()) return 2; // Planifiées (futur)
        if (session.status === 'completed') return 3; // Terminées
        return 4; // Autres
      };
      const categoryA = getCategory(a, dateA);
      const categoryB = getCategory(b, dateB);
      if (categoryA !== categoryB) return categoryA - categoryB;
      switch (categoryA) {
        case 1: // Jour
          if (a.status === 'in-progress' && b.status !== 'in-progress') return -1;
          if (a.status !== 'in-progress' && b.status === 'in-progress') return 1;
          return a.nomSession.localeCompare(b.nomSession);
        case 2: // Planifiées
          if (dateA.getTime() !== dateB.getTime()) return dateA.getTime() - dateB.getTime();
          return a.nomSession.localeCompare(b.nomSession);
        case 3: // Terminées
          if (dateA.getTime() !== dateB.getTime()) return dateB.getTime() - dateA.getTime();
          return a.nomSession.localeCompare(b.nomSession);
        default: // Autres
          if (dateA.getTime() !== dateB.getTime()) return dateB.getTime() - dateA.getTime();
          return a.nomSession.localeCompare(b.nomSession);
      }
    });

    // 2. Filtrage par période
    if (selectedPeriod !== 'all' && sessionsToProcess.length > 0) {
      const filterOption = periodFilters.find(f => f.value === selectedPeriod);
      if (filterOption && filterOption.getDateRange) {
        const { start, end } = filterOption.getDateRange();
        sessionsToProcess = sessionsToProcess.filter(session => {
          if (!session.dateSession) return false;
          const sessionDate = new Date(session.dateSession);
          sessionDate.setHours(0,0,0,0);
          return sessionDate >= start && sessionDate <= end;
        });
      }
    }

    // 3. Filtrage par terme de recherche
    if (searchTerm && sessionsToProcess.length > 0) {
      const term = searchTerm.toLowerCase();
      sessionsToProcess = sessionsToProcess.filter(session =>
        session.nomSession.toLowerCase().includes(term) ||
        (session.referentiel as string).toLowerCase().includes(term)
      );
    }

    setProcessedSessions(sessionsToProcess);

  }, [rawSessions, searchTerm, selectedPeriod]);


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
        <>
          <div className="flex flex-wrap gap-4 mb-4">
            <Input
              type="text"
              placeholder="Rechercher par nom, référentiel..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-xs flex-grow"
            />
            <Select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="max-w-xs flex-grow"
            >
              {periodFilters.map(filter => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </Select>
          </div>
          <SessionsList
            sessions={processedSessions} // Utiliser les sessions traitées
            onManageSession={handleManageSession}
            onStartExam={handleStartExam}
          />
          {/* Ancien code de filtrage en ligne, maintenant géré dans useEffect
            sessions={dbSessions
              .filter(session => { // Filtre par période
                if (selectedPeriod === 'all' || !session.dateSession) return true;
                const filterOption = periodFilters.find(f => f.value === selectedPeriod);
                if (filterOption && filterOption.getDateRange) {
                  const { start, end } = filterOption.getDateRange();
                  const sessionDate = new Date(session.dateSession);
                  // Normaliser sessionDate à minuit pour comparer uniquement les jours
                  sessionDate.setHours(0,0,0,0);
                  // Les dates de début/fin de période sont déjà normalisées
                  return sessionDate >= start && sessionDate <= end;
                }
                return true;
              })
              .filter(session => { // Filtre par terme de recherche
                if (!searchTerm) return true;
                const term = searchTerm.toLowerCase();
                return (
                  session.nomSession.toLowerCase().includes(term) ||
                  (session.referentiel as string).toLowerCase().includes(term)
                );
              })}
            onManageSession={handleManageSession}
            onStartExam={handleStartExam}
          />
        </>
      ) : (
        // Passer managingSessionId (qui est un number ou null) à SessionForm
        <SessionForm sessionIdToLoad={managingSessionId ?? undefined} />
      )}
    </Layout>
  );
};

export default Sessions;