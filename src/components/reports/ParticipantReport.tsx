import React, { useState, useEffect, useMemo } from 'react';
import Card from '../ui/Card';
import {
  getAllSessions,
  getResultsForSession,
  getQuestionsForSessionBlocks,
  getAllReferentiels,
  // getReferentialById, // Moins utile ici car on a referentialMap
  getAllVotingDevices,
  getAllThemes,
  getAllBlocs,
  getBlocById,
  getThemeById
} from '../../db';
import { Session, Participant, SessionResult, QuestionWithId, Referential, VotingDevice, Theme, Bloc } from '../../types';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui/Table';
import Input from '../ui/Input';
import { Search, ArrowLeft, ChevronDown, ChevronRight, HelpCircle, CheckCircle, XCircle } from 'lucide-react';
import Button from '../ui/Button';
import { calculateParticipantScore, calculateThemeScores, determineIndividualSuccess } from '../../utils/reportCalculators';
import Badge from '../ui/Badge';

// Interface pour les questions enrichies localement
interface EnrichedQuestionForParticipantReport extends QuestionWithId {
  resolvedThemeName?: string;
  participantAnswer?: string;
  pointsObtainedForAnswer?: number;
  isCorrectAnswer?: boolean;
}

// Étend Session pour inclure les données traitées pour l'affichage du participant
interface ProcessedSession extends Session {
  participantScore?: number;
  participantSuccess?: boolean;
  themeScores?: { [theme: string]: number };
  questionsForDisplay?: EnrichedQuestionForParticipantReport[];
}

// Pour la liste principale des participations
interface SessionParticipation {
  key: string;
  participantDisplayId: string;
  participantRef: Participant;
  sessionName: string;
  sessionDate: string;
  referentialName: string; // Ici, on utilisera le code du référentiel
}

const ParticipantReport = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [allReferentiels, setAllReferentiels] = useState<Referential[]>([]);
  const [allVotingDevices, setAllVotingDevices] = useState<VotingDevice[]>([]);
  const [allThemesDb, setAllThemesDb] = useState<Theme[]>([]);
  const [allBlocsDb, setAllBlocsDb] = useState<Bloc[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [processedParticipantSessions, setProcessedParticipantSessions] = useState<ProcessedSession[]>([]);
  const [expandedSessions, setExpandedSessions] = useState<Set<number>>(new Set());

  const referentialCodeMap = useMemo(() => {
    return new Map(allReferentiels.map(ref => [ref.id, ref.code])); // id -> code
  }, [allReferentiels]);

  const deviceMap = useMemo(() => {
    return new Map(allVotingDevices.map(device => [device.id, device.serialNumber]));
  }, [allVotingDevices]);

  useEffect(() => {
    const fetchInitialData = async () => {
      const [
        fetchedSessions,
        fetchedReferentiels,
        fetchedVotingDevices,
        fetchedThemes,
        fetchedBlocs
      ] = await Promise.all([
        getAllSessions(),
        getAllReferentiels(),
        getAllVotingDevices(),
        getAllThemes(),
        getAllBlocs()
      ]);
      setSessions(fetchedSessions.sort((a, b) => new Date(b.dateSession).getTime() - new Date(a.dateSession).getTime()));
      setAllReferentiels(fetchedReferentiels);
      setAllVotingDevices(fetchedVotingDevices);
      setAllThemesDb(fetchedThemes);
      setAllBlocsDb(fetchedBlocs);
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    const processSessions = async () => {
      // console.log('[ParticipantReport DEBUG] processSessions triggered. SP:', selectedParticipant);
      // console.log('[ParticipantReport DEBUG] Values at start of processSessions: deviceMap type =', typeof deviceMap, 'deviceMap keys =', deviceMap ? Array.from(deviceMap.keys()) : 'undefined', 'allThemesDb length =', allThemesDb?.length, 'allBlocsDb length =', allBlocsDb?.length);

      if (selectedParticipant && selectedParticipant.assignedGlobalDeviceId !== undefined) {
        // console.log('[ParticipantReport DEBUG] Participant selected. Checking maps/arrays...');
        try {
          if (deviceMap && typeof deviceMap.get === 'function' && deviceMap.size > 0 && allThemesDb && allThemesDb.length > 0 && allBlocsDb && allBlocsDb.length > 0) {
            // console.log('[ParticipantReport DEBUG] All maps/arrays seem populated. Proceeding with logic.');
            const serialNumberOfSelectedParticipant = deviceMap.get(selectedParticipant.assignedGlobalDeviceId);
            // console.log('[ParticipantReport DEBUG] Serial for SP:', serialNumberOfSelectedParticipant);

            if (!serialNumberOfSelectedParticipant) {
              setProcessedParticipantSessions([]);
              // console.log('[ParticipantReport DEBUG] No serial number for selected participant, clearing processed sessions.');
              return;
            }

            const participantSessions = sessions.filter(s =>
              s.participants?.some(p => p.assignedGlobalDeviceId === selectedParticipant.assignedGlobalDeviceId)
            );
            // console.log('[ParticipantReport DEBUG] Number of sessions found for participant:', participantSessions.length);

            if (participantSessions.length === 0) {
                setProcessedParticipantSessions([]);
                // console.log('[ParticipantReport DEBUG] No sessions found for this participant in the main sessions list.');
                return;
            }

            const processed: ProcessedSession[] = [];

            for (const sessionInstance of participantSessions) {
              // console.log(`[ParticipantReport DEBUG] Processing session ID: ${sessionInstance.id}`);
              if (sessionInstance.id) {
                const sessionResults = await getResultsForSession(sessionInstance.id);
                // console.log(`[ParticipantReport DEBUG] Session ${sessionInstance.id}: Found ${sessionResults.length} results.`);

                const baseSessionQuestions = await getQuestionsForSessionBlocks(sessionInstance.selectedBlocIds || []);
                // console.log(`[ParticipantReport DEBUG] Session ${sessionInstance.id}: Found ${baseSessionQuestions.length} base questions for selected blocs.`);

                // console.log(`[ParticipantReport DEBUG] Session ${sessionInstance.id}: Starting Promise.all for enriching ${baseSessionQuestions.length} questions...`);
                const enrichedSessionQuestions: EnrichedQuestionForParticipantReport[] = await Promise.all(
                  baseSessionQuestions.map(async (question, index) => {
                    try {
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
                    } catch (error) {
                      console.error(`[ParticipantReport] Error enriching question ID ${question.id} (index ${index}):`, error); // Garder ce log d'erreur important
                      return {
                        ...question,
                        resolvedThemeName: 'Erreur chargement thème',
                        participantAnswer: 'Erreur',
                        pointsObtainedForAnswer: 0,
                        isCorrectAnswer: false
                      };
                    }
                  })
                );
                // console.log(`[ParticipantReport DEBUG] Session ${sessionInstance.id}: Finished Promise.all. Enriched ${enrichedSessionQuestions.length} questions.`);

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
                // console.log(`[ParticipantReport DEBUG] Session ${sessionInstance.id}: Pushed to processed. Current total: ${processed.length}`);
              }
            }
            // console.log('[ParticipantReport DEBUG] Processed sessions for participant (final count):', processed.length, processed);
            setProcessedParticipantSessions(processed.sort((a,b) => new Date(b.dateSession).getTime() - new Date(a.dateSession).getTime()));
          } else {
            // console.log('[ParticipantReport DEBUG] processSessions: DID NOT RUN main logic. Conditions not met. deviceMap type:', typeof deviceMap, 'deviceMap size:', deviceMap?.size, 'themes:', allThemesDb?.length, 'blocs:', allBlocsDb?.length);
            setProcessedParticipantSessions([]);
          }
        } catch (e: any) {
          console.error('[ParticipantReport] Error in processSessions try-catch block:', e); // Garder ce log
          if (e instanceof ReferenceError) {
            console.error("[ParticipantReport] Caught ReferenceError in processSessions:", e.message, e.stack);  // Garder ce log
          }
          setProcessedParticipantSessions([]);
        }
      } else {
        // console.log('[ParticipantReport DEBUG] No selected participant or missing assignedGlobalDeviceId. Clearing processed sessions.');
        setProcessedParticipantSessions([]);
      }
    };
    processSessions();
  }, [selectedParticipant, sessions, deviceMap, allThemesDb, allBlocsDb]);

  const allSessionParticipations = useMemo(() => {
    const participations: SessionParticipation[] = [];
    sessions.forEach(session => {
      if (!session.id) return;
      session.participants?.forEach((p, index) => {
        const participantKeyPart = p.assignedGlobalDeviceId ? p.assignedGlobalDeviceId.toString() : `idx-${index}`;
        participations.push({
          key: `session-${session.id}-participant-${participantKeyPart}`,
          participantRef: p,
          participantDisplayId: p.identificationCode || `Boîtier ID ${p.assignedGlobalDeviceId || 'N/A'}`,
          sessionName: session.nomSession,
          sessionDate: new Date(session.dateSession).toLocaleDateString('fr-FR'),
          referentialName: session.referentielId ? (referentialCodeMap.get(session.referentielId) || 'N/A') : 'N/A',
        });
      });
    });
    return participations;
  }, [sessions, referentialCodeMap]);

  const filteredSessionParticipations = useMemo(() => {
    if (!searchTerm) return allSessionParticipations;
    return allSessionParticipations.filter(participation =>
      `${participation.participantRef.prenom} ${participation.participantRef.nom}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      participation.sessionName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      participation.referentialName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allSessionParticipations, searchTerm]);

  const handleSelectParticipant = (participant: Participant) => {
    setSelectedParticipant(participant);
    setExpandedSessions(new Set());
  };

  const handleBack = () => {
    setSelectedParticipant(null);
    setProcessedParticipantSessions([]);
    setExpandedSessions(new Set());
  };

  if (selectedParticipant) {
    return (
      <Card>
        <Button variant="outline" icon={<ArrowLeft size={16} />} onClick={handleBack} className="mb-4">
          Retour à la liste
        </Button>
        <h2 className="text-2xl font-bold mb-2">{selectedParticipant.prenom} {selectedParticipant.nom}</h2>
        <p className="text-gray-500 mb-6">
          ID Boîtier : {selectedParticipant.assignedGlobalDeviceId ? (deviceMap.get(selectedParticipant.assignedGlobalDeviceId) || 'N/A') : 'Non assigné'}
        </p>
        
        <h3 className="text-xl font-semibold mb-4">Historique des sessions</h3>
        {processedParticipantSessions.length === 0 && (
          <p className="text-gray-500">Aucune session traitée à afficher pour ce participant (ou données en cours de chargement).</p>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Session</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Score Global</TableHead>
              <TableHead>Résultat Global</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {processedParticipantSessions.map(session => {
              const isExpanded = session.id !== undefined && expandedSessions.has(session.id);
              const toggleExpansion = () => {
                if (session.id === undefined) return;
                setExpandedSessions(prev => {
                  const next = new Set(prev);
                  if (next.has(session.id!)) next.delete(session.id!);
                  else next.add(session.id!);
                  return next;
                });
              };

              const questionsByTheme: { [themeName: string]: EnrichedQuestionForParticipantReport[] } = {};
              if (session.questionsForDisplay) {
                session.questionsForDisplay.forEach(q => {
                  const theme = q.resolvedThemeName || 'Thème non spécifié';
                  if (!questionsByTheme[theme]) questionsByTheme[theme] = [];
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
                    <TableCell className={session.participantSuccess === true ? 'text-green-600 font-semibold' : session.participantSuccess === false ? 'text-red-600 font-semibold' : ''}>
                      {session.participantScore !== undefined ? `${session.participantScore.toFixed(0)} / 100` : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {session.participantSuccess !== undefined ? (
                        session.participantSuccess ? <Badge variant="success">Réussi</Badge> : <Badge variant="danger">Ajourné</Badge>
                      ) : <Badge variant="warning">En attente</Badge>}
                    </TableCell>
                  </TableRow>
                  {isExpanded && session.id !== undefined && (
                    <TableRow>
                      <TableCell colSpan={4} className="p-0 bg-slate-50">
                        <div className="p-4 ">
                          <h4 className="text-md font-semibold mb-3 text-gray-800">Détail des scores par thème :</h4>
                          {session.themeScores && Object.entries(session.themeScores).length > 0 ? (
                            Object.entries(session.themeScores).map(([themeName, themeScore]) => (
                            <div key={themeName} className="mb-1 text-sm">
                              <span className={themeScore < 50 ? 'text-red-500 font-semibold' : 'text-gray-700 font-semibold'}>
                                {themeName}: </span> {themeScore.toFixed(0)} / 100
                            </div>
                          ))
                          ) : (<p className="text-xs text-gray-500">Scores par thème non disponibles.</p>)}

                          {Object.entries(questionsByTheme).length > 0 ? (
                            Object.entries(questionsByTheme).map(([themeName, questions]) => (
                            <div key={themeName} className="mt-4">
                              <h5 className="text-sm font-semibold text-gray-700 mb-2 border-b border-gray-300 pb-1">Thème : {themeName}</h5>
                              {questions.map((q, qIndex) => (
                                <div key={q.id || qIndex} className="text-xs mb-3 pb-2 border-b border-gray-200 last:border-b-0 last:pb-0 last:mb-0">
                                  <p className="flex items-center font-medium text-gray-800">
                                    <HelpCircle size={14} className="mr-1.5 text-blue-600 flex-shrink-0" />
                                    {q.text}
                                  </p>
                                  <p className="ml-5 mt-0.5">Votre réponse : <span className="font-semibold text-gray-700">{q.participantAnswer || 'Non répondu'}</span></p>
                                  {q.isCorrectAnswer === false && (
                                    <p className="ml-5 mt-0.5 text-orange-700">Bonne réponse : <span className="font-semibold">{q.correctAnswer}</span></p>
                                  )}
                                  <p className="ml-5 mt-0.5 flex items-center">
                                    Points : <span className="font-semibold text-gray-700 ml-1">{q.pointsObtainedForAnswer !== undefined ? q.pointsObtainedForAnswer : (q.isCorrectAnswer ? 1 : 0)}</span>
                                    {q.isCorrectAnswer === true && <CheckCircle size={14} className="ml-2 text-green-500" />}
                                    {q.isCorrectAnswer === false && q.participantAnswer !== undefined && <XCircle size={14} className="ml-2 text-red-500" />}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ))
                          ) : (<p className="mt-4 text-xs text-gray-500">Détail des questions non disponible.</p>)}
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
          placeholder="Rechercher un participant, une session..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full md:w-1/2 lg:w-1/3"
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
