import React from 'react';
import { CalendarClock, ChevronRight } from 'lucide-react';
import { Session } from '../../types';
import Card from '../ui/Card';
import Badge from '../ui/Badge';

type UpcomingSessionsProps = {
  sessions: Session[];
};

const UpcomingSessions: React.FC<UpcomingSessionsProps> = ({ sessions }) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
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
      default:
        return null;
    }
  };

  return (
    <Card title="Sessions à venir" className="mb-6">
      <div className="divide-y divide-gray-200">
        {sessions.map((session) => (
          <div key={session.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-center justify-between">
              <div className="flex items-start space-x-3">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                  <CalendarClock size={20} />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{session.nomSession}</p>
                  <div className="flex items-center mt-1 space-x-2">
                    <span className="text-sm text-gray-500">
                      {formatDate(session.dateSession)}
                    </span>
                    <span className="text-gray-300">•</span>
                    <span className="text-sm text-gray-500">
                      {session.referentiel}
                    </span>
                    <span className="text-gray-300">•</span>
                    <span className="text-sm text-gray-500">
                      {session.participants ? session.participants.length : 0} participants
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {getStatusBadge(session.status)}
                <button className="text-gray-400 hover:text-gray-500">
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-4 border-t border-gray-200">
        <button className="text-sm font-medium text-blue-600 hover:text-blue-700">
          Voir toutes les sessions
        </button>
      </div>
    </Card>
  );
};

export default UpcomingSessions;