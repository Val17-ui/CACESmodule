import React, { useRef, useEffect, useState } from 'react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { AlertTriangle, BarChart, UserCheck, Calendar, Download, Layers } from 'lucide-react'; // Ajout de Layers
import { Session, Participant, SessionResult, QuestionWithId, QuestionMapping } from '../../types'; // Ajout de QuestionMapping
import Button from '../ui/Button';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { getResultsForSession, getQuestionsByIds } from '../../db'; // getAllSessions, getAllResults, getAllQuestions sont retires si non utilises pour stats par bloc de session
import {
  calculateParticipantScore,
  calculateThemeScores,
  determineIndividualSuccess,
  // calculateQuestionSuccessRate, // Retiré
  calculateBlockPerformanceForSession, // Ajouté
  BlockPerformanceStats // Ajouté
} from '../../utils/reportCalculators';

type ReportDetailsProps = {
  session: Session;
  // participants n'est plus directement une prop, car session.participants sera utilisé
};

const ReportDetails: React.FC<ReportDetailsProps> = ({ session }) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [sessionResults, setSessionResults] = useState<SessionResult[]>([]);
  const [questionsForThisSession, setQuestionsForThisSession] = useState<QuestionWithId[]>([]);
  const [blockStats, setBlockStats] = useState<BlockPerformanceStats[]>([]);

  // Utiliser session.participants directement
  const participants = session.participants || [];

  useEffect(() => {
    const fetchData = async () => {
      if (session.id) {
        const results = await getResultsForSession(session.id);
        setSessionResults(results);

        if (session.questionMappings && session.questionMappings.length > 0) {
          const questionIds = session.questionMappings
            .map(q => q.dbQuestionId)
            .filter((id): id is number => id !== null && id !== undefined);

          if (questionIds.length > 0) {
            const questions = await getQuestionsByIds(questionIds);
            setQuestionsForThisSession(questions);
          } else {
            setQuestionsForThisSession([]);
          }
        } else {
          setQuestionsForThisSession([]);
        }
      } else {
        setSessionResults([]);
        setQuestionsForThisSession([]);
      }
    };
    fetchData();
  }, [session]);

  useEffect(() => {
    // Calculer les stats par bloc une fois que session, sessionResults et questionsForThisSession sont disponibles
    if (session && session.selectionBlocs && sessionResults.length > 0 && questionsForThisSession.length > 0) {
      const calculatedBlockStats: BlockPerformanceStats[] = [];
      session.selectionBlocs.forEach(blockSelection => {
        // Note: calculateBlockPerformanceForSession attend `allQuestions` pour le mapping.
        // Ici, `questionsForThisSession` contient déjà les questions pertinentes pour la session.
        // Si `calculateBlockPerformanceForSession` a besoin de ALL questions de la DB pour une raison X,
        // il faudrait les charger. Mais pour les stats DANS la session, `questionsForThisSession` devrait suffire
        // si la logique interne de `calculateBlockPerformanceForSession` est adaptée.
        // Pour l'instant, on passe `questionsForThisSession` comme équivalent de `allQuestions` pour ce contexte.
        // La fonction `calculateBlockPerformanceForSession` a été écrite pour prendre `allQuestions`
        // mais elle filtre ensuite par `questionIdsInSession`. Donc c'est ok.
        const stats = calculateBlockPerformanceForSession(blockSelection, session, sessionResults);
        if (stats) {
          calculatedBlockStats.push(stats);
        }
      });
      setBlockStats(calculatedBlockStats);
    } else {
      setBlockStats([]);
    }
  }, [session, sessionResults, questionsForThisSession]);


  const handleExportPDF = () => {
    if (reportRef.current) {
      html2canvas(reportRef.current).then((canvas: HTMLCanvasElement) => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`rapport_${session.nomSession}.pdf`);
      });
    }
  };

  const formatDate = (dateString: string | undefined | null): string => {
    if (!dateString) return 'Date non spécifiée';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Date invalide';
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  };

  const participantCalculatedData = participants.map(p => {
    const participantResults = sessionResults.filter(r => r.participantIdBoitier === p.idBoitier);
    // Utiliser questionsForThisSession au lieu de sessionQuestions
    const score = calculateParticipantScore(participantResults, questionsForThisSession);
    const themeScores = calculateThemeScores(participantResults, questionsForThisSession);
    const reussite = determineIndividualSuccess(score, themeScores);
    return { ...p, score, reussite };
  });

  const passedCount = participantCalculatedData.filter(p => p.reussite).length;
  const passRate = participants.length > 0 ? (passedCount / participants.length) * 100 : 0;
  const averageScoreOverall = participants.length > 0
    ? participantCalculatedData.reduce((sum, p) => sum + (p.score || 0), 0) / participants.length
    : 0;


  // La section pour questionSuccessRates est supprimée et remplacée par blockStats plus bas

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={handleExportPDF} icon={<Download size={16}/>}>Exporter en PDF</Button>
      </div>
      <div ref={reportRef} className="p-4">
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
                  <span>Participants : {session.participants?.length || 0}</span>
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
                    {averageScoreOverall.toFixed(0)}/100
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
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Participant</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score Global Session</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut Session</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {participantCalculatedData.map((participant) => (
                  <tr key={participant.idBoitier} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{participant.nom} {participant.prenom}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 ${participant.reussite ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {participant.score !== undefined ? participant.score.toFixed(0) : '-'}
                        </div>
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${participant.reussite ? 'bg-green-600' : 'bg-red-600'}`}
                            style={{ width: `${participant.score || 0}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {participant.reussite === true && <Badge variant="success">Certifié</Badge>}
                      {participant.reussite === false && <Badge variant="danger">Ajourné</Badge>}
                      {participant.reussite === undefined && <Badge variant="neutral">-</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {blockStats.length > 0 && (
          <Card title="Performances par Bloc de Questions (pour cette session)" className="mb-6">
            <div className="flex items-center mb-3 text-gray-600">
                <Layers size={18} className="mr-2" />
                <h3 className="text-md font-semibold">
                Détail par bloc utilisé dans cette session
                </h3>
            </div>
            <div className="space-y-4">
              {blockStats.map(bs => (
                <div key={`${bs.blockTheme}-${bs.blockId}`} className="p-3 border border-gray-200 rounded-lg bg-gray-50">
                  <h4 className="text-sm font-semibold text-gray-800 mb-1">
                    Thème: <span className="font-normal">{bs.blockTheme}</span> - Bloc: <span className="font-normal">{bs.blockId}</span>
                    <span className="text-xs text-gray-500 ml-2">({bs.questionsInBlockCount} questions)</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div>
                        <span className="text-gray-500">Score moyen sur bloc:</span>
                        <strong className="ml-1 text-gray-700">{bs.averageScoreStringOnBlock}</strong>
                    </div>
                    <div>
                        <span className="text-gray-500">Taux de réussite du bloc:</span>
                        <strong className="ml-1 text-gray-700">{bs.successRateOnBlock.toFixed(0)}%</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
             <div className="mt-4 bg-blue-50 p-3 rounded-lg">
                <p className="text-xs text-blue-700">
                <strong>Note :</strong> Le "Taux de réussite du bloc" indique le pourcentage de participants ayant obtenu au moins 50% de bonnes réponses aux questions de ce bloc spécifique (par exemple, au moins {Math.ceil(bs.questionsInBlockCount * 0.5)} bonnes réponses sur {bs.questionsInBlockCount} questions pour le dernier bloc listé).
                </p>
            </div>
          </Card>
        )}

      </div>
    </div>
  );
};

export default ReportDetails;