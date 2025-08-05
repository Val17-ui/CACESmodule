import React, { useEffect, useState } from 'react';
import Layout from '../components/layout/Layout';
import DashboardSessionsOverview from '../components/dashboard/DashboardSessionsOverview';
import AlertsNotifications from '../components/dashboard/AlertsNotifications';
import QuickLinks from '../components/dashboard/QuickLinks';
import { Session, Referential } from '@common/types';

type DashboardProps = {
  activePage: string;
  onPageChange: (page: string, sessionId?: number) => void; // sessionId est optionnel
};

const Dashboard: React.FC<DashboardProps> = ({ activePage, onPageChange }) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [referentiels, setReferentiels] = useState<Referential[]>([]);

  useEffect(() => {
    const fetchSessionsAndReferentiels = async () => {
      setLoading(true);
      try {
        if (window.dbAPI?.getAllSessions && window.dbAPI?.getAllReferentiels) {
          const [allSessions, allReferentiels] = await Promise.all([
            window.dbAPI.getAllSessions(),
            window.dbAPI.getAllReferentiels(),
          ]);
          setSessions(allSessions);
          setReferentiels(allReferentiels);
        } else {
          console.error("[Dashboard Page] dbAPI.getAllSessions or getAllReferentiels is not available on window object.");
        }
      } catch (error) {
        console.error("Erreur lors de la récupération des données via IPC:", error);
      }
      setLoading(false);
    };

    fetchSessionsAndReferentiels();
  }, []);

  

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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <DashboardSessionsOverview sessions={sessions} onPageChange={onPageChange} referentiels={referentiels} />
        </div>
        <div className="lg:col-span-1 space-y-6">
          <QuickLinks onPageChange={onPageChange} sessions={sessions} />
          <AlertsNotifications />
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;