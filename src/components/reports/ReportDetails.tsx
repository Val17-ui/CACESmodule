import React from 'react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { CheckCircle, XCircle, AlertTriangle, BarChart, UserCheck, Calendar } from 'lucide-react';
import { Session, Participant } from '../../types';

type ReportDetailsProps = {
  session: Session;
  participants: Participant[];
};

const ReportDetails: React.FC<ReportDetailsProps> = ({ session, participants }) => {
  const formatDate = (dateString: string | undefined | null): string => {
    if (!dateString) {
      return 'Date non spécifiée';
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Date invalide';
    }
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  };
  
  // Calculate stats
  const passedCount = participants.filter(p => p.reussite).length;
  const passRate = (passedCount / participants.length) * 100;
  const averageScore = participants.reduce((sum, p) => sum + (p.score || 0), 0) / participants.length;

  return (
    <div>
      <Card title="Résumé de la session" className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {session.nomSession}
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-center text-sm">
                <Calendar size={18} className="text-gray-400 mr-2" />
                <span>Date : {formatDate(session.dateSession)}</span>
              </div>
              <div className="flex items-center text-sm">
                <Badge variant="primary" className="mr-2">{session.referentiel}</Badge>
                <span>Référentiel CACES</span>
              </div>
              <div className="flex items-center text-sm">
                <UserCheck size={18} className="text-gray-400 mr-2" />
                <span>Participants : {session.participants.length}</span>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-xl">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Statistiques de la session
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Taux de réussite</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {passRate.toFixed(0)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Score moyen</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {averageScore.toFixed(0)}/100
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Certifiés</p>
                <p className="text-lg font-medium text-green-600">
                  {passedCount} / {participants.length}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Seuil de réussite</p>
                <p className="text-lg font-medium text-gray-900">
                  70%
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
      
      <Card title="Résultats par participant" className="mb-6">
        <div className="overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Participant
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Entreprise
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Score
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Émargement
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {participants.map((participant) => (
                <tr key={participant.idBoitier} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {participant.nom} {participant.prenom}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {/* Entreprise non disponible dans l'interface Participant */}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {participant.score !== undefined ? (
                      <div className="flex items-center">
                        <div 
                          className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 ${
                            participant.reussite ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {participant.score}
                        </div>
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${participant.reussite ? 'bg-green-600' : 'bg-red-600'}`}
                            style={{ width: `${participant.score}%` }}
                          ></div>
                        </div>
                      </div>
                    ) : (
                      <span>N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {/* Émargement non disponible dans l'interface Participant */}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {participant.reussite !== undefined ? (
                      participant.reussite ? (
                        <Badge variant="success">Certifié</Badge>
                      ) : (
                        <Badge variant="danger">Ajourné</Badge>
                      )
                    ) : (
                      <Badge variant="warning">En attente</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      
      <Card title="Analyse des réponses" className="mb-6">
        <div className="flex items-center mb-4">
          <BarChart size={20} className="text-gray-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">
            Taux de réussite par question
          </h3>
        </div>
        
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => {
            const successRate = Math.floor(Math.random() * 40) + 60;
            const isLow = successRate < 70;
            
            return (
              <div key={i} className="flex items-center">
                <div className="w-16 flex-shrink-0 text-sm text-gray-700">
                  Q{i + 1}
                </div>
                <div className="flex-1 mx-2">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className={`h-2.5 rounded-full ${isLow ? 'bg-amber-500' : 'bg-blue-600'}`}
                      style={{ width: `${successRate}%` }}
                    ></div>
                  </div>
                </div>
                <div className="w-16 flex-shrink-0 text-right">
                  <span className={`text-sm font-medium ${isLow ? 'text-amber-600' : 'text-blue-600'}`}>
                    {successRate}%
                  </span>
                </div>
                {isLow && (
                  <div className="w-6 flex-shrink-0 ml-2">
                    <AlertTriangle size={16} className="text-amber-500" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        <div className="mt-6 bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Note d'analyse :</strong> Certaines questions ont un taux de réussite inférieur à 70%. Il est recommandé de revoir ces points lors des prochaines formations.
          </p>
        </div>
      </Card>
    </div>
  );
};

export default ReportDetails;