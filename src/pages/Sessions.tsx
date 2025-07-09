import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/layout/Layout';
import SessionsList from '../components/sessions/SessionsList';
import SessionForm from '../components/sessions/SessionForm';
import Button from '../components/ui/Button';
import { Plus } from 'lucide-react';
import { getAllSessions, getSessionById } from '../db'; // Ajout de getSessionById
import { Session as DBSession } from '../types';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';

type SessionsProps = {
  activePage: string;
  onPageChange: (page: string, sessionId?: number) => void;
  sessionId?: number;
};

// Fonctions utilitaires pour les dates (inchangées)
const getTodayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const getThisWeekRange = () => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

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
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
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
  const [managingSessionId, setManagingSessionId] = useState<number | null>(null);
  const [managingSessionName, setManagingSessionName] = useState<string | null>(null); // Nouvel état pour le nom
  const [rawSessions, setRawSessions] = useState<DBSession[]>([]);
  const [processedSessions, setProcessedSessions] = useState<DBSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');

  useEffect(() => {
    if (sessionId !== undefined) {
      setManagingSessionId(sessionId);
      setIsCreating(false);
      // Charger le nom de la session pour le titre
      getSessionById(sessionId).then(session => {
        if (session) {
          setManagingSessionName(session.nomSession);
        } else {
          setManagingSessionName(null);
        }
      });
    } else {
      setManagingSessionId(null);
      setManagingSessionName(null); // Réinitialiser le nom
      setIsCreating(false);
    }
  }, [sessionId]);

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

  useEffect(() => {
    // Charger les sessions brutes si on n'est pas en train de gérer/créer une session spécifique
    // OU si la liste rawSessions est vide (ce qui peut arriver si on revient à la liste après une gestion)
    if (!managingSessionId && !isCreating) {
      fetchRawSessions();
    } else {
      // Si on est en mode gestion/création, on ne recharge pas la liste complète.
      // On peut considérer que les données de la session gérée sont chargées par SessionForm.
      // Ou si rawSessions est vide et qu'on annule pour revenir à la liste, il faudra re-fetch.
      // fetchRawSessions s'occupe de setIsLoading(false)
      if (rawSessions.length === 0 && (managingSessionId || isCreating)) {
          // Ce cas est pour si on arrive sur un formulaire directement et qu'on annule,
          // il faut que la liste soit chargée. fetchRawSessions est appelé par handleBackToList.
          // Donc ici, on peut juste s'assurer que isLoading est false si on a un ID.
          setIsLoading(false);
      }
    }
  }, [fetchRawSessions, managingSessionId, isCreating, rawSessions.length]);

  // Effet pour trier et filtrer les sessions
  useEffect(() => {
    let sessionsToProcess = [...rawSessions];

    // 1. Tri
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Pré-traitement pour normaliser le statut undefined en 'planned'
    const sessionsWithNormalizedStatus = rawSessions.map(session => ({
      ...session,
      status: session.status === undefined ? 'planned' : session.status,
    }));

    sessionsToProcess = [...sessionsWithNormalizedStatus];


    sessionsToProcess.sort((a, b) => {
      const dateA = new Date(a.dateSession); dateA.setHours(0, 0, 0, 0);
      const dateB = new Date(b.dateSession); dateB.setHours(0, 0, 0, 0);

      // La fonction getCategory utilise maintenant le statut normalisé
      const getCategory = (session: DBSession, sessionDate: Date) => {
        const status = session.status; // status est déjà 'planned' si undefined initialement

        // Catégorie 1: Sessions du jour (en cours, ou planifiées/prêtes pour aujourd'hui)
        if (status === 'in-progress' || ((status === 'planned' || status === 'ready') && sessionDate.getTime() === today.getTime())) return 1;
        // Catégorie 2: Sessions planifiées (planifiées/prêtes pour le futur)
        if ((status === 'planned' || status === 'ready') && sessionDate.getTime() > today.getTime()) return 2;
        // Catégorie 3: Sessions terminées
        if (status === 'completed') return 3;
        // Catégorie 4: Sessions annulées ou autres statuts non explicitement gérés ci-dessus
        return 4;
      };

      const categoryA = getCategory(a, dateA);
      const categoryB = getCategory(b, dateB);

      if (categoryA !== categoryB) return categoryA - categoryB;

      // Logique de tri à l'intérieur de chaque catégorie
      switch (categoryA) {
        case 1: // Sessions du Jour
          // Priorité aux sessions 'in-progress'
          if (a.status === 'in-progress' && b.status !== 'in-progress') return -1;
          if (a.status !== 'in-progress' && b.status === 'in-progress') return 1;
          // Ensuite, tri par nom de session
          return a.nomSession.localeCompare(b.nomSession);
        case 2: // Sessions Planifiées (futur)
          // Tri par date, puis par nom
          if (dateA.getTime() !== dateB.getTime()) return dateA.getTime() - dateB.getTime();
          return a.nomSession.localeCompare(b.nomSession);
        case 3: // Sessions Terminées
          // Tri par date (plus récentes d'abord), puis par nom
          if (dateA.getTime() !== dateB.getTime()) return dateB.getTime() - dateA.getTime();
          return a.nomSession.localeCompare(b.nomSession);
        default: // Autres (ex: Annulées)
          // Tri par date (plus récentes d'abord), puis par nom
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
          if (!session.dateSession) return false; // Ne pas traiter les sessions sans date
          const sessionDate = new Date(session.dateSession);
          sessionDate.setHours(0,0,0,0); // Normaliser pour comparer uniquement le jour
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

  const handleManageSession = (id: number) => {
    setManagingSessionId(id);
    setIsCreating(false);
    onPageChange(activePage, id); // S'assurer que App.tsx est au courant de la session gérée
  };

  const handleStartExam = (id: number) => {
    console.log(`Démarrage de l'examen pour la session ID: ${id}`);
    onPageChange('exams', id); // Navigue vers la page des examens avec l'ID de session
  };

  const handleBackToList = () => {
    setIsCreating(false);
    setManagingSessionId(null);
    onPageChange(activePage, undefined); // Notifier App.tsx qu'on n'est plus sur une session spécifique
    fetchRawSessions(); // Recharger la liste au cas où des modifs auraient été faites
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
    : managingSessionName
    ? `Gérer : ${managingSessionName}`
    : managingSessionId
    ? `Gérer la session (ID: ${managingSessionId})` // Fallback si le nom n'est pas encore chargé
    : "Liste des Sessions";

  const subtitle = isCreating
    ? "Remplissez les informations pour créer une nouvelle session."
    : managingSessionId
    ? "Modifiez les informations de la session, les participants, ou générez les fichiers."
    : "Consultez et gérez vos sessions enregistrées.";

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
              options={periodFilters} // Passé periodFilters à la prop options
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="max-w-xs flex-grow"
              placeholder="Filtrer par période" // Optionnel: ajouter un placeholder
            />
            {/* Les <option> enfants ne sont plus nécessaires ici car gérés par le composant Select via la prop options
              {periodFilters.map(filter => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            */}
          </div>
          <SessionsList
            sessions={processedSessions}
            onManageSession={handleManageSession}
            onStartExam={handleStartExam}
          />
        </>
      ) : (
        <SessionForm sessionIdToLoad={managingSessionId ?? undefined} />
      )}
    </Layout>
  );
};

export default Sessions;