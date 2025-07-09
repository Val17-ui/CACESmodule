import React from 'react';
import { CalendarClock, ChevronRight } from 'lucide-react'; // AlertTriangle supprimé
import { Session } from '../../types';
import Card from '../ui/Card';
import Badge from '../ui/Badge';

type DashboardSessionsOverviewProps = {
  sessions: Session[];
  onPageChange: (page: string, sessionId?: number) => void;
};

const formatDate = (dateString: string | undefined | null): string => {
  if (!dateString) {
    return 'Date non spécifiée';
  }
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Date invalide';
    }
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  } catch (e) {
    console.error("Erreur de formatage de date pour:", dateString, e);
    return 'Date erronée';
  }
};

const getStatusBadge = (status: Session['status']) => {
  switch (status) {
    case 'planned':
      return <Badge variant="primary">Planifiée</Badge>;
    case 'in-progress':
      return <Badge variant="warning">En cours</Badge>;
    case 'completed':
      return <Badge variant="success">Terminée</Badge>;
    case 'cancelled':
      return <Badge variant="danger">Annulée</Badge>;
    case 'ready':
        return <Badge variant="primary">Prête</Badge>; // Modifié: info -> primary
    default:
      return null;
  }
};

const SessionRow: React.FC<{session: Session, onPageChange: (page: string, sessionId?: number) => void}> = ({ session, onPageChange }) => {
  const handleSessionClick = () => {
    if (session.id) {
      // Pour les sessions planifiées ou en cours, on va à la page de gestion de session.
      // Pour les sessions terminées, on pourrait aller vers un rapport de session.
      // Pour l'instant, toutes pointent vers la page 'sessions' avec l'ID.
      onPageChange('sessions', session.id);
    }
  };

  return (
    <div
      key={session.id}
      className="py-3 first:pt-0 last:pb-0 cursor-pointer hover:bg-gris-moyen/10"
      onClick={handleSessionClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-start space-x-3">
          <div className={`p-2 rounded-lg ${session.status === 'in-progress' ? 'bg-yellow-50 text-yellow-600' : 'bg-accent-neutre/10 text-accent-neutre'}`}>
            <CalendarClock size={20} />
          </div>
          <div>
            <p className="font-medium text-texte-principal">{session.nomSession}</p>
            <div className="flex items-center mt-1 space-x-2 flex-wrap">
              <span className="text-sm text-texte-principal/80">
                {formatDate(session.dateSession)}
              </span>
              <span className="text-gris-moyen hidden sm:inline">•</span>
              <span className="text-sm text-texte-principal/80 block sm:inline mt-1 sm:mt-0">
                {session.referentiel}
              </span>
              <span className="text-gris-moyen hidden sm:inline">•</span>
              <span className="text-sm text-texte-principal/80 block sm:inline mt-1 sm:mt-0">
                {session.participants ? session.participants.length : 0} participant(s)
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {getStatusBadge(session.status)}
          <ChevronRight size={20} className="text-gris-moyen" />
        </div>
      </div>
    </div>
  );
};


const DashboardSessionsOverview: React.FC<DashboardSessionsOverviewProps> = ({ sessions, onPageChange }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normaliser à minuit pour la comparaison de dates

  const sessionsDuJour = sessions.filter(s => {
    const sessionDate = new Date(s.dateSession);
    sessionDate.setHours(0, 0, 0, 0);
    return (s.status === 'in-progress') || (s.status === 'planned' && sessionDate.getTime() === today.getTime()) || (s.status === 'ready' && sessionDate.getTime() === today.getTime());
  });

  const sessionsPlanifiees = sessions.filter(s => {
    const sessionDate = new Date(s.dateSession);
    sessionDate.setHours(0, 0, 0, 0);
    // Exclure les sessions du jour déjà comptées
    const isPlannedForToday = (s.status === 'planned' || s.status === 'ready') && sessionDate.getTime() === today.getTime();
    return (s.status === 'planned' || s.status === 'ready') && sessionDate.getTime() >= today.getTime() && !isPlannedForToday;
  }).sort((a, b) => new Date(a.dateSession).getTime() - new Date(b.dateSession).getTime());

  const sessionsTerminees = sessions.filter(s => s.status === 'completed')
    .sort((a, b) => new Date(b.dateSession).getTime() - new Date(a.dateSession).getTime()) // Plus récentes en premier
    .slice(0, 5); // Limiter aux 5 plus récentes par exemple

  const renderSection = (title: string, sessionList: Session[], emptyMessage: string) => (
    <div className="mb-6">
      <h3 className="text-lg font-medium text-texte-principal mb-2">{title}</h3>
      {sessionList.length > 0 ? (
        <div className="divide-y divide-gris-moyen/50">
          {sessionList.map(session => (
            <SessionRow key={session.id} session={session} onPageChange={onPageChange} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-texte-principal/70 italic">{emptyMessage}</p>
      )}
    </div>
  );

  return (
    <Card className="mb-6">
      {renderSection("Sessions du jour", sessionsDuJour, "Aucune session prévue ou en cours pour aujourd'hui.")}
      {renderSection("Prochaines sessions planifiées", sessionsPlanifiees, "Aucune autre session planifiée pour le moment.")}
      {renderSection("Dernières sessions terminées", sessionsTerminees, "Aucune session terminée récemment.")}

      <div className="mt-4 pt-4 border-t border-gris-moyen/50">
        <button
          onClick={() => onPageChange('sessions')}
          className="text-sm font-medium text-rouge-accent hover:text-rouge-accent/80"
        >
          Voir toutes les sessions
        </button>
      </div>
    </Card>
  );
};

export default DashboardSessionsOverview;