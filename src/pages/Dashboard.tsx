import React, { useEffect, useState } from 'react';
import Layout from '../components/layout/Layout';
import DashboardCards from '../components/dashboard/DashboardCards';
import DashboardSessionsOverview from '../components/dashboard/DashboardSessionsOverview';
import AlertsNotifications from '../components/dashboard/AlertsNotifications'; // Ajout de l'import
// import QuickActions from '../components/dashboard/QuickActions'; // Supprimé
import Button from '../components/ui/Button';
import { Plus } from 'lucide-react';
// import { mockSessions } from '../data/mockData'; // Plus besoin des mocks ici directement
import { getAllSessions } from '../db';
import { Session } from '../types';

type DashboardProps = {
  activePage: string;
  onPageChange: (page: string, sessionId?: number) => void; // sessionId est optionnel
};

const Dashboard: React.FC<DashboardProps> = ({ activePage, onPageChange }) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSessions = async () => {
      setLoading(true);
      try {
        const allSessions = await getAllSessions();
        setSessions(allSessions);
      } catch (error) {
        console.error("Erreur lors de la récupération des sessions:", error);
        // Gérer l'erreur, par exemple afficher un message à l'utilisateur
      }
      setLoading(false);
    };

    fetchSessions();
  }, []);

  const headerActions = (
    <Button 
      variant="primary"
      icon={<Plus size={16} />}
      onClick={() => onPageChange('sessions')} // Reste pour créer une nouvelle session
    >
      Nouvelle session
    </Button>
  );

  // TODO: Trier et filtrer les sessions pour UpcomingSessions
  // Pour l'instant, passons toutes les sessions, UpcomingSessions devra filtrer
  // ou nous devrons le faire ici et passer des listes séparées.

  if (loading) {
    return (
      <Layout
        title="Tableau de bord"
        subtitle="Vue d'ensemble des activités" // MODIFIÉ
        // actions={headerActions} // SUPPRIMÉ
        activePage={activePage}
        onPageChange={onPageChange}
      >
        <p>Chargement des données du tableau de bord...</p>
      </Layout>
    );
  }

  return (
    <Layout
      title="Tableau de bord"
      subtitle="Vue d'ensemble des activités" // MODIFIÉ
      // actions={headerActions} // SUPPRIMÉ
      activePage={activePage}
      onPageChange={onPageChange}
    >
      <DashboardCards sessions={sessions} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2">
          <DashboardSessionsOverview sessions={sessions} onPageChange={onPageChange} />
        </div>
        <div className="lg:col-span-1">
          <AlertsNotifications />
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;