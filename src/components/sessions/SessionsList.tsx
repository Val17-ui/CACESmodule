import React from 'react';
import { CalendarClock, ClipboardList, Play, Download, AlertTriangle } from 'lucide-react'; // Ajout AlertTriangle pour erreurs
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { Session as DBSession, CACESReferential } from '../../types';
import { saveAs } from 'file-saver'; // Assurer que file-saver est installé et importé

type SessionsListProps = {
  sessions: DBSession[];
  onManageSession: (id: number) => void;
  onStartExam: (id: number) => void;
};

const SessionsList: React.FC<SessionsListProps> = ({
  sessions,
  onManageSession,
  onStartExam,
}) => {
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Date non définie';
    try {
      const date = new Date(dateString);
      // Vérifier si la date est valide
      if (isNaN(date.getTime())) {
        return 'Date invalide';
      }
      return new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(date);
    } catch (error) {
      console.error("Error formatting date:", dateString, error);
      return 'Date invalide';
    }
  };

  const getStatusBadge = (status?: DBSession['status']) => {
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
        return <Badge variant="secondary">Non défini</Badge>;
    }
  };

  const handleDownloadOrs = (session: DBSession) => {
    if (session.donneesOrs instanceof Blob) {
      const orsFileName = `Session_${session.nomSession.replace(/[^a-z0-9]/gi, '_')}_${session.id || 'id'}.ors`;
      saveAs(session.donneesOrs, orsFileName);
    } else {
      alert("Fichier .ors non disponible ou format incorrect pour le téléchargement.");
      console.warn("Tentative de téléchargement d'un .ors non-Blob:", session.donneesOrs);
    }
  };

  return (
    <Card title="Sessions de formation enregistrées">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nom de la Session
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Référentiel
              </th>
              <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nb. Part.
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Statut
              </th>
              <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                .ORS Généré
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sessions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500">
                  <div className="flex flex-col items-center">
                    <AlertTriangle size={48} className="text-gray-400 mb-3" />
                    Aucune session enregistrée pour le moment.
                    <br />
                    Cliquez sur "Nouvelle session" pour commencer.
                  </div>
                </td>
              </tr>
            ) : (
              sessions.map((session) => (
                <tr key={session.id} className="hover:bg-gray-50 transition-colors duration-150 ease-in-out">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 p-2 rounded-lg bg-blue-100 text-blue-700">
                        <CalendarClock size={20} />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-semibold text-gray-900">
                          {session.nomSession || 'Session sans nom'}
                        </div>
                        <div className="text-xs text-gray-500">ID: {session.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {formatDate(session.dateSession)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant="info">{session.referentiel as CACESReferential || 'N/A'}</Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-center">
                    {session.participants?.length ?? 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(session.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {session.donneesOrs instanceof Blob ?
                      <Badge variant="success" className="cursor-default" title={`Taille: ${Math.round(session.donneesOrs.size / 1024)} Ko`}>Oui</Badge> :
                      <Badge variant="default">Non</Badge>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<ClipboardList size={16} />}
                        onClick={() => session.id && onManageSession(session.id)}
                        title="Gérer la session (modifier les détails, participants, etc.)"
                      >
                        Gérer
                      </Button>

                      {session.donneesOrs instanceof Blob && (
                         <Button
                          variant="outline"
                          size="sm"
                          icon={<Download size={16} />}
                          onClick={() => handleDownloadOrs(session)}
                          title="Télécharger le fichier .ors"
                        >
                          .ORS
                        </Button>
                      )}

                      {(session.status === 'planned' || !session.status) && session.donneesOrs instanceof Blob && (
                        <Button
                          variant="primary"
                          size="sm"
                          icon={<Play size={16} />}
                          onClick={() => session.id && onStartExam(session.id)}
                          title="Démarrer l'examen pour cette session"
                        >
                          Démarrer Examen
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default SessionsList;