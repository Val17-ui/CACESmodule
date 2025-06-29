import React from 'react';
import { CalendarClock, UserCheck, ClipboardList, Play, Download } from 'lucide-react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { Session as DBSession, CACESReferential } from '../../types'; // Importer DBSession

type SessionsListProps = {
  sessions: DBSession[]; // Utiliser DBSession
  onManageSession: (id: number) => void; // ID est maintenant number
  onStartExam: (id: number) => void; // ID est maintenant number
};

const SessionsList: React.FC<SessionsListProps> = ({
  sessions,
  onManageSession,
  onStartExam,
}) => {
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Date non définie';
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
    <Card title="Sessions de formation">
      <div className="overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Session
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Référentiel
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Participants
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Statut
              </th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sessions.map((session) => (
              <tr key={session.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 p-2 rounded-lg bg-blue-50 text-blue-600">
                      <CalendarClock size={20} />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {session.name}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(session.date)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge variant="primary">{session.referential}</Badge>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {session.participantsCount}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(session.status)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<UserCheck size={16} />}
                      onClick={() => onManageSession(session.id)}
                    >
                      Participants
                    </Button>
                    
                    {(session.status === 'planned' || session.status === 'in-progress') && (
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<Play size={16} />}
                        onClick={() => onStartExam(session.id)}
                      >
                        Démarrer
                      </Button>
                    )}
                    
                    {session.status === 'completed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<Download size={16} />}
                      >
                        Rapport
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default SessionsList;