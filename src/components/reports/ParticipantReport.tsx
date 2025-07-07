import React, { useState, useEffect, useMemo } from 'react';
import Card from '../ui/Card';
import {
  getAllSessions,
  getResultsForSession,
  getQuestionsForSessionBlocks,
  getAllReferentiels,
  getReferentialById,
  getAllVotingDevices, // Ajouté
  getAllThemes,        // Ajouté
  getAllBlocs,         // Ajouté
  getBlocById,         // Ajouté pour enrichissement questions
  getThemeById         // Ajouté pour enrichissement questions
} from '../../db';
import { Session, Participant, SessionResult, QuestionWithId, Referential, VotingDevice, Theme, Bloc } from '../../types'; // Ajout de VotingDevice, Theme, Bloc
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui/Table';
import Input from '../ui/Input';
import { Search, ArrowLeft, ChevronDown, ChevronRight, HelpCircle, CheckCircle, XCircle } from 'lucide-react'; // Ajout d'icônes
import Button from '../ui/Button';
import { calculateParticipantScore, calculateThemeScores, determineIndividualSuccess } from '../../utils/reportCalculators';
import Badge from '../ui/Badge';
// Ajout d'un type pour le mapping des réponses (si nécessaire, pour l'instant string)
// type AnswerOption = { id: string; text: string }; // Exemple

// Interface pour les questions enrichies localement dans ce composant
interface EnrichedQuestionForParticipantReport extends QuestionWithId {
  resolvedThemeName?: string;
  participantAnswer?: string;
  pointsObtainedForAnswer?: number;
  isCorrectAnswer?: boolean;
}

interface ProcessedSession extends Session {
  participantScore?: number;
  participantSuccess?: boolean;
  themeScores?: { [theme: string]: number };
  questionsForDisplay?: EnrichedQuestionForParticipantReport[];
}

interface SessionParticipation {
  key: string; // Clé unique pour la ligne, ex: `session-${sessionId}-participant-${participantRef.assignedGlobalDeviceId}`
  participantDisplayId: string; // Pour l'affichage, si idBoitier n'est pas sur Participant
  participantRef: Participant;
  sessionName: string;
  sessionDate: string;
  referentialName: string;
}

const ParticipantReport = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [allReferentiels, setAllReferentiels] = useState<Referential[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [processedParticipantSessions, setProcessedParticipantSessions] = useState<ProcessedSession[]>([]);
  const [expandedSessions, setExpandedSessions] = useState<Set<number>>(new Set()); // Pour gérer les détails dépliés

  const referentialMap = useMemo(() => {
    return new Map(allReferentiels.map(ref => [ref.id, ref.nom_complet]));
  }, [allReferentiels]);

  useEffect(() => {
    const fetchInitialData = async () => {
      const [fetchedSessions, fetchedReferentiels] = await Promise.all([
        getAllSessions(),
        getAllReferentiels()
      ]);
      setSessions(fetchedSessions.sort((a, b) => new Date(b.dateSession).getTime() - new Date(a.dateSession).getTime()));
      setAllReferentiels(fetchedReferentiels);
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    const processSessions = async () => {
      if (selectedParticipant && selectedParticipant.assignedGlobalDeviceId !== undefined && deviceMap.size > 0 && allThemesDb.length > 0 && allBlocsDb.length > 0) {
        const serialNumberOfSelectedParticipant = deviceMap.get(selectedParticipant.assignedGlobalDeviceId);

        if (!serialNumberOfSelectedParticipant) {
          setProcessedParticipantSessions([]);
          return;
        }

        const participantSessions = sessions.filter(s =>
          s.participants?.some(p => p.assignedGlobalDeviceId === selectedParticipant.assignedGlobalDeviceId)
        );
        const processed: ProcessedSession[] = [];

        for (const sessionInstance of participantSessions) {
          if (sessionInstance.id) {
            const sessionResults = await getResultsForSession(sessionInstance.id);

            // 1. Récupérer les questions de base pour les selectedBlocIds de la session
            const baseSessionQuestions = await getQuestionsForSessionBlocks(sessionInstance.selectedBlocIds || []);

            // 2. Enrichir ces questions avec resolvedThemeName
            const enrichedSessionQuestions: EnrichedQuestionForParticipantReport[] = await Promise.all(
              baseSessionQuestions.map(async (question) => {
                let resolvedThemeName = 'Thème non spécifié';
                if (question.blocId) {
                  const bloc = allBlocsDb.find(b => b.id === question.blocId);
                  if (bloc && bloc.theme_id) {
                    const theme = allThemesDb.find(t => t.id === bloc.theme_id);
                    if (theme) {
                      resolvedThemeName = theme.nom_complet;
                    }
                  }
                }
                // Trouver la réponse du participant et les points
                const participantResult = sessionResults.find(
                  sr => sr.participantIdBoitier === serialNumberOfSelectedParticipant && sr.questionId === question.id
                );
                return {
                  ...question,
                  resolvedThemeName,
                  participantAnswer: participantResult?.answer,
                  pointsObtainedForAnswer: participantResult?.pointsObtained,
                  isCorrectAnswer: participantResult?.isCorrect
                };
              })
            );

            const currentParticipantSessionResults = sessionResults.filter(
              r => r.participantIdBoitier === serialNumberOfSelectedParticipant
            );

            const score = calculateParticipantScore(currentParticipantSessionResults, enrichedSessionQuestions);
            const themeScores = calculateThemeScores(currentParticipantSessionResults, enrichedSessionQuestions);
            const reussite = determineIndividualSuccess(score, themeScores);

            processed.push({
              ...sessionInstance,
              participantScore: score,
              participantSuccess: reussite,
              themeScores,
              questionsForDisplay: enrichedSessionQuestions
            });
          }
        }
        setProcessedParticipantSessions(processed.sort((a,b) => new Date(b.dateSession).getTime() - new Date(a.dateSession).getTime()));
      } else {
        setProcessedParticipantSessions([]);
      }
    };
    processSessions();
  }, [selectedParticipant, sessions, deviceMap, allThemesDb, allBlocsDb]);

  const allSessionParticipations = useMemo(() => {
    const participations: SessionParticipation[] = [];
    sessions.forEach(session => {
      if (!session.id) return; // Assurer que la session a un ID
      session.participants?.forEach((p, index) => {
        // Utiliser assignedGlobalDeviceId ou un index pour la clé si assignedGlobalDeviceId est null
        const participantKeyPart = p.assignedGlobalDeviceId ? p.assignedGlobalDeviceId.toString() : `idx-${index}`;
        participations.push({
          key: `session-${session.id}-participant-${participantKeyPart}`,
          participantRef: p,
          participantDisplayId: p.identificationCode || `Boîtier ID ${p.assignedGlobalDeviceId || 'N/A'}`, // Exemple d'ID affichable
          sessionName: session.nomSession,
          sessionDate: new Date(session.dateSession).toLocaleDateString('fr-FR'),
          referentialName: session.referentielId ? (referentialMap.get(session.referentielId) || 'N/A') : 'N/A',
        });
      });
    });
    return participations;
  }, [sessions, referentialMap]);

  const filteredSessionParticipations = useMemo(() => {
    if (!searchTerm) {
      return allSessionParticipations;
    }
    return allSessionParticipations.filter(participation =>
      participation.participantRef.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      participation.participantRef.prenom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      participation.sessionName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      participation.referentialName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allSessionParticipations, searchTerm]);

  const handleSelectParticipant = (participant: Participant) => {
    // La sélection d'un participant pour voir ses détails reste basée sur l'objet Participant
    setSelectedParticipant(participant);
  };

  const handleBack = () => {
    setSelectedParticipant(null);
    setProcessedParticipantSessions([]);
  };

  if (selectedParticipant) {
    const totalScore = processedParticipantSessions.reduce((sum, s) => sum + (s.participantScore || 0), 0);
    const avgScore = processedParticipantSessions.length > 0 ? totalScore / processedParticipantSessions.length : 0;
    const totalSuccess = processedParticipantSessions.filter(s => s.participantSuccess).length;
    const successRate = processedParticipantSessions.length > 0 ? (totalSuccess / processedParticipantSessions.length) * 100 : 0;

    return (
      <Card>
        <Button variant="outline" icon={<ArrowLeft size={16} />} onClick={handleBack} className="mb-4">
          Retour à la liste
        </Button>
        <h2 className="text-2xl font-bold mb-2">{selectedParticipant.prenom} {selectedParticipant.nom}</h2>
        <p className="text-gray-500 mb-6">ID Boîtier: {selectedParticipant.idBoitier}</p>
        
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-xs text-gray-500">Score moyen global</p>
            <p className="text-2xl font-semibold text-gray-900">{avgScore.toFixed(0)}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Taux de réussite global</p>
            <p className="text-2xl font-semibold text-gray-900">{successRate.toFixed(0)}%</p>
          </div>
        </div>

        <h3 className="text-xl font-semibold mb-4">Historique des sessions</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Session</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Résultat</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {processedParticipantSessions.map(session => {
              const isExpanded = session.id !== undefined && expandedSessions.has(session.id);
              const toggleExpansion = () => {
                if (session.id === undefined) return;
                setExpandedSessions(prev => {
                  const next = new Set(prev);
                  if (next.has(session.id!)) {
                    next.delete(session.id!);
                  } else {
                    next.add(session.id!);
                  }
                  return next;
                });
              };

              // Grouper les questions par thème résolu pour l'affichage
              const questionsByTheme: { [themeName: string]: EnrichedQuestionForParticipantReport[] } = {};
              if (session.questionsForDisplay) {
                session.questionsForDisplay.forEach(q => {
                  const theme = q.resolvedThemeName || 'Thème non spécifié';
                  if (!questionsByTheme[theme]) {
                    questionsByTheme[theme] = [];
                  }
                  questionsByTheme[theme].push(q);
                });
              }

              return (
                <React.Fragment key={session.id}>
                  <TableRow onClick={toggleExpansion} className="cursor-pointer hover:bg-gray-100">
                    <TableCell className="font-medium">
                      {isExpanded ? <ChevronDown size={16} className="inline mr-1" /> : <ChevronRight size={16} className="inline mr-1" />}
                      {session.nomSession}
                    </TableCell>
                    <TableCell>{new Date(session.dateSession).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell className={session.participantSuccess ? 'text-green-600' : 'text-red-600'}>
                      {session.participantScore !== undefined ? `${session.participantScore.toFixed(0)} / 100` : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {session.participantSuccess !== undefined ? (
                        session.participantSuccess ? (
                          <Badge variant="success">Réussi</Badge>
                        ) : (
                          <Badge variant="danger">Ajourné</Badge>
                        )
                      ) : (
                        <Badge variant="warning">En attente</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                  {isExpanded && session.id !== undefined && (
                    <TableRow>
                      <TableCell colSpan={4} className="p-0"> {/* p-0 pour que la sous-carte prenne toute la place */}
                        <div className="p-4 bg-gray-50">
                          <h4 className="text-md font-semibold mb-3">Détail des scores par thème :</h4>
                          {session.themeScores && Object.entries(session.themeScores).map(([themeName, themeScore]) => (
                            <div key={themeName} className="mb-2">
                              <span className={themeScore < 50 ? 'text-red-500 font-semibold' : 'font-semibold'}>
                                {themeName}: {themeScore.toFixed(0)} / 100
                              </span>
                            </div>
                          ))}

                          {Object.entries(questionsByTheme).map(([themeName, questions]) => (
                            <div key={themeName} className="mt-4">
                              <h5 className="text-sm font-semibold text-gray-700 mb-2 border-b pb-1">Thème : {themeName}</h5>
                              {questions.map((q, qIndex) => (
                                <div key={q.id || qIndex} className="text-xs mb-3 pb-2 border-b border-gray-200 last:border-b-0 last:pb-0 last:mb-0">
                                  <p className="flex items-center">
                                    <HelpCircle size={14} className="mr-1 text-blue-500" />
                                    <strong>{q.text}</strong>
                                  </p>
                                  <p className="ml-5">Votre réponse : <span className="font-medium">{q.participantAnswer || 'Non répondu'}</span></p>
                                  {q.isCorrectAnswer === false && ( // Afficher correction seulement si réponse fausse
                                    <p className="ml-5 text-orange-600">Bonne réponse : <span className="font-medium">{q.correctAnswer}</span></p>
                                  )}
                                  <p className="ml-5 flex items-center">
                                    Points obtenus : <span className="font-medium ml-1">{q.pointsObtainedForAnswer !== undefined ? q.pointsObtainedForAnswer : (q.isCorrectAnswer ? 1 : 0)}</span>
                                    {q.isCorrectAnswer === true && <CheckCircle size={14} className="ml-2 text-green-500" />}
                                    {q.isCorrectAnswer === false && <XCircle size={14} className="ml-2 text-red-500" />}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="text-xl font-bold mb-4">Rapport par Participant</h2>
      <div className="mb-4">
        <Input 
          placeholder="Rechercher par nom..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-1/3"
          icon={<Search size={16} className="text-gray-400"/>}
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Participant</TableHead>
            <TableHead>Session</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Référentiel</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredSessionParticipations.map((participation) => (
            <TableRow
              key={participation.key}
              onClick={() => handleSelectParticipant(participation.participantRef)}
              className="cursor-pointer hover:bg-gray-50"
            >
              <TableCell>{participation.participantRef.prenom} {participation.participantRef.nom}</TableCell>
              <TableCell>{participation.sessionName}</TableCell>
              <TableCell>{participation.sessionDate}</TableCell>
              <TableCell>
                <Badge variant="secondary">{participation.referentialName}</Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleSelectParticipant(participation.participantRef); }}>
                  Voir l'historique du participant
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};

export default ParticipantReport;
