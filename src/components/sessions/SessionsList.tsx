import React, { useState, useEffect } from 'react'; // Ajout useState, useEffect
import { CalendarClock, ClipboardList, Play, Download, AlertTriangle } from 'lucide-react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { Session as DBSession, Referential } from '../../types'; // Ajout Referential
import { saveAs } from 'file-saver';
import { StorageManager } from '../../services/StorageManager'; // Ajout StorageManager

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
  const [referentielsData, setReferentielsData] = useState<Referential[]>([]);

  useEffect(() => {
    const loadReferentiels = async () => {
      try {
        const refs = await StorageManager.getAllReferentiels();
        setReferentielsData(refs);
      } catch (error) {
        console.error("Erreur chargement des référentiels pour SessionsList:", error);
      }
    };
    loadReferentiels();
  }, []);

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Date non définie';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Date invalide';
      return new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      }).format(date);
    } catch (error) {
      console.error("Error formatting date:", dateString, error);
      return 'Date invalide';
    }
  };

  const getStatusBadge = (status?: DBSession['status']) => {
    // Le statut 'undefined' est déjà normalisé en 'planned' dans Sessions.tsx
    // donc ce 'default' cas ne devrait plus afficher "Non défini" pour des sessions valides.
    switch (status) {
      case 'planned': return <Badge variant="primary">Planifiée</Badge>;
      case 'in-progress': return <Badge variant="warning">En cours</Badge>;
      case 'completed': return <Badge variant="success">Terminée</Badge>;
      case 'cancelled': return <Badge variant="danger">Annulée</Badge>;
      case 'ready': return <Badge variant="info">Prête</Badge>; // Ajout pour "ready"
      default: return <Badge variant="default">Non défini</Badge>;
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

  const renderSessionTable = (filteredSessions: DBSession[], title: string) => {
    if (filteredSessions.length === 0) {
      return (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-3 text-gray-700">{title}</h2>
          <p className="text-sm text-gray-500">Aucune session dans cette catégorie.</p>
        </div>
      );
    }

    return (
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-3 text-gray-700">{title}</h2>
        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Référentiel</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Nb. Part.</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">.ORS</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSessions.map((session) => (
                <tr key={session.id} className="hover:bg-gray-50 transition-colors duration-150 ease-in-out">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 p-2 rounded-lg bg-accent-neutre/10 text-accent-neutre"><CalendarClock size={20} /></div>
                      <div className="ml-4">
                        <div className="text-sm font-semibold text-gray-900">{session.nomSession || 'Session sans nom'}</div>
                        <div className="text-xs text-gray-500">ID: {session.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatDate(session.dateSession)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {(() => {
                      if (session.referentielId && referentielsData.length > 0) {
                        const refObj = referentielsData.find(r => r.id === session.referentielId);
                        return <Badge variant="primary">{refObj ? refObj.code : `ID: ${session.referentielId}`}</Badge>;
                      }
                      if ((session as any).referentiel) { return <Badge variant="default">{(session as any).referentiel}</Badge>; }
                      return <Badge variant="default">N/A</Badge>;
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-center">{session.participants?.length ?? 0}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(session.status)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {session.donneesOrs instanceof Blob ? <Badge variant="success">Oui</Badge> : <Badge variant="default">Non</Badge>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" size="sm" icon={<ClipboardList size={16} />} onClick={() => session.id && onManageSession(session.id)} title="Gérer la session">Gérer</Button>
                      {session.donneesOrs instanceof Blob && (
                        <Button variant="primary" size="sm" icon={<Download size={16} />} onClick={() => handleDownloadOrs(session)} title="Télécharger .ors">.ORS</Button>
                      )}
                      {/* Le statut est déjà normalisé, donc !session.status n'est plus nécessaire pour 'planned' */}
                      {/* {(session.status === 'planned' || session.status === 'ready') && session.donneesOrs instanceof Blob && (
                        <Button variant="primary" size="sm" icon={<Play size={16} />} onClick={() => session.id && onStartExam(session.id)} title="Démarrer l'examen">Démarrer Examen</Button>
                      )} */}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sessionsDuJour = sessions.filter(session => {
    const sessionDate = new Date(session.dateSession);
    sessionDate.setHours(0, 0, 0, 0);
    return sessionDate.getTime() === today.getTime() &&
           (session.status === 'in-progress' || session.status === 'planned' || session.status === 'ready');
  });

  const sessionsPlanifiees = sessions.filter(session => {
    const sessionDate = new Date(session.dateSession);
    sessionDate.setHours(0, 0, 0, 0);
    return sessionDate.getTime() > today.getTime() &&
           (session.status === 'planned' || session.status === 'ready');
  });

  const sessionsTerminees = sessions.filter(session => session.status === 'completed');

  // Optionnel: sessions restantes (ex: annulées ou autres)
  // const sessionsAutres = sessions.filter(session =>
  //   !sessionsDuJour.includes(session) &&
  //   !sessionsPlanifiees.includes(session) &&
  //   !sessionsTerminees.includes(session)
  // );

  if (sessions.length === 0) {
    return (
      <Card title="Sessions de formation">
        <div className="px-6 py-12 text-center text-sm text-gray-500">
          <div className="flex flex-col items-center">
            <AlertTriangle size={48} className="text-gray-400 mb-3" />
            Aucune session enregistrée pour le moment.
            <br />
            Cliquez sur "Nouvelle session" pour commencer.
          </div>
        </div>
      </Card>
    );
  }

  return (
    // Le Card title est maintenant plus générique, les titres spécifiques sont dans renderSessionTable
    <Card title="Aperçu des Sessions">
      {renderSessionTable(sessionsDuJour, "Sessions du jour")}
      {renderSessionTable(sessionsPlanifiees, "Sessions planifiées")}
      {renderSessionTable(sessionsTerminees, "Sessions terminées")}
      {/* Si vous voulez afficher les autres sessions (ex: annulées)
      {renderSessionTable(sessionsAutres, "Autres sessions")}
      */}
    </Card>
  );
};

export default SessionsList;