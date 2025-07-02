import React, { useRef, useEffect, useState } from 'react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { AlertTriangle, BarChart, UserCheck, Calendar, Download } from 'lucide-react';
import { Session, Participant, SessionResult, QuestionWithId } from '../../types';
import Button from '../ui/Button';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { getResultsForSession, getQuestionsByIds, getAllSessions, getAllResults, getAllQuestions } from '../../db';
import { calculateParticipantScore, calculateThemeScores, determineIndividualSuccess, calculateQuestionSuccessRate } from '../../utils/reportCalculators';

type ReportDetailsProps = {
  session: Session;
  participants: Participant[];
};

const ReportDetails: React.FC<ReportDetailsProps> = ({ session, participants }) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [sessionResults, setSessionResults] = useState<SessionResult[]>([]);
  const [sessionQuestions, setSessionQuestions] = useState<QuestionWithId[]>([]);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [allResults, setAllResults] = useState<SessionResult[]>([]);
  const [allQuestions, setAllQuestions] = useState<QuestionWithId[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (session.id) {
        const results = await getResultsForSession(session.id);
        setSessionResults(results);
        if (session.questionMappings && session.questionMappings.length > 0) {
          const questionIds = session.questionMappings.map(q => q.dbQuestionId).filter((id): id is number => id !== null && id !== undefined);
          if (questionIds.length > 0) {
            const questions = await getQuestionsByIds(questionIds);
            setSessionQuestions(questions);
          }
        }
      }
      const fetchedAllSessions = await getAllSessions();
      setAllSessions(fetchedAllSessions);
      const fetchedAllResults = await getAllResults();
      setAllResults(fetchedAllResults);
      const fetchedAllQuestions = await getAllQuestions();
      setAllQuestions(fetchedAllQuestions);
    };
    fetchData();
  }, [session]);

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
    const score = calculateParticipantScore(participantResults, sessionQuestions);
    const themeScores = calculateThemeScores(participantResults, sessionQuestions);
    const reussite = determineIndividualSuccess(score, themeScores);
    return { ...p, score, reussite };
  });

  const passedCount = participantCalculatedData.filter(p => p.reussite).length;
  const passRate = participants.length > 0 ? (passedCount / participants.length) * 100 : 0;
  const averageScore = participants.length > 0 ? participantCalculatedData.reduce((sum, p) => sum + (p.score || 0), 0) / participants.length : 0;

  const questionSuccessRates = sessionQuestions.map(q => ({
    question: q,
    successRate: calculateQuestionSuccessRate(q.id!, allSessions, allResults, allQuestions),
  }));

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
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Participant</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
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
                          {participant.score.toFixed(0)}
                        </div>
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div className={`h-2 rounded-full ${participant.reussite ? 'bg-green-600' : 'bg-red-600'}`} style={{ width: `${participant.score}%` }}></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {participant.reussite ? <Badge variant="success">Certifié</Badge> : <Badge variant="danger">Ajourné</Badge>}
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
            {questionSuccessRates.map((qStat, i) => {
              const isLow = qStat.successRate < 70;
              
              return (
                <div key={qStat.question.id} className="flex items-center">
                  <div className="w-16 flex-shrink-0 text-sm text-gray-700">
                    Q{i + 1}
                  </div>
                  <div className="flex-1 mx-2">
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className={`h-2.5 rounded-full ${isLow ? 'bg-amber-500' : 'bg-blue-600'}`}
                        style={{ width: `${qStat.successRate}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="w-16 flex-shrink-0 text-right">
                    <span className={`text-sm font-medium ${isLow ? 'text-amber-600' : 'text-blue-600'}`}>
                      {qStat.successRate.toFixed(0)}%
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
    </div>
  );
};

export default ReportDetails;