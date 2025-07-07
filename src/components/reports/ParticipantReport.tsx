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
import { Session, Participant, SessionResult, QuestionWithId, Referential, VotingDevice, Theme, Bloc, ThemeScoreDetails } from '../../types';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui/Table';
import Input from '../ui/Input';
import { Search, ArrowLeft, HelpCircle, CheckCircle, XCircle } from 'lucide-react';
import Button from '../ui/Button';
import { calculateParticipantScore, calculateThemeScores, determineIndividualSuccess } from '../../utils/reportCalculators';
import Badge from '../ui/Badge';

interface EnrichedQuestionForParticipantReport extends QuestionWithId {
  resolvedThemeName?: string;
  participantAnswer?: string;
  pointsObtainedForAnswer?: number;
  isCorrectAnswer?: boolean;
}

interface ProcessedSessionDetails extends Session { // Renommé pour clarifier que c'est pour UNE session/participation
  participantRef: Participant; // Garder une référence au participant de cette participation
  participantScore?: number;
  participantSuccess?: boolean;
  themeScores?: { [theme: string]: ThemeScoreDetails }; // Utilise le nouveau type
  questionsForDisplay?: EnrichedQuestionForParticipantReport[];
}

interface SessionParticipation {
  key: string;
  participantDisplayId: string;
  participantRef: Participant;
  sessionName: string;
  sessionDate: string;
  referentialCode: string; // Changé pour code
  // Ajout des IDs pour pouvoir retrouver la session et le participant originaux
  originalSessionId: number;
  originalParticipantAssignedGlobalDeviceId?: number | null;
}

const ParticipantReport = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [allReferentiels, setAllReferentiels] = useState<Referential[]>([]);
  const [allVotingDevices, setAllVotingDevices] = useState<VotingDevice[]>([]);
  const [allThemesDb, setAllThemesDb] = useState<Theme[]>([]);
  const [allBlocsDb, setAllBlocsDb] = useState<Bloc[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState<string>(''); // Nouvel état
  const [endDate, setEndDate] = useState<string>('');     // Nouvel état
  const [detailedParticipation, setDetailedParticipation] = useState<ProcessedSessionDetails | null>(null);

  const referentialCodeMap = useMemo(() => {
    return new Map(allReferentiels.map(ref => [ref.id, ref.code]));
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

  // Ce useEffect n'est plus nécessaire pour peupler une liste d'historique,
  // la logique de traitement est maintenant dans handleSelectParticipation
  // useEffect(() => {
  // }, [detailedParticipation, sessions, deviceMap, allThemesDb, allBlocsDb]);

  const allSessionParticipations = useMemo(() => {
    const participations: SessionParticipation[] = [];
    const filteredSessionsByDate = sessions.filter(session => {
      if (!startDate && !endDate) return true;
      const sessionDate = new Date(session.dateSession);
      if (startDate && sessionDate < new Date(startDate)) return false;
      if (endDate) {
        const endOfDayEndDate = new Date(endDate);
        endOfDayEndDate.setHours(23, 59, 59, 999);
        if (sessionDate > endOfDayEndDate) return false;
      }
      return true;
    });

    filteredSessionsByDate.forEach(session => {
      if (!session.id) return;
      session.participants?.forEach((p, index) => {
        const participantKeyPart = p.assignedGlobalDeviceId ? p.assignedGlobalDeviceId.toString() : `paridx-${index}`;
        participations.push({
          key: `sess-${session.id}-part-${participantKeyPart}`,
          participantRef: p,
          participantDisplayId: p.identificationCode || `Boîtier ${deviceMap.get(p.assignedGlobalDeviceId) || 'N/A'}`,
          sessionName: session.nomSession,
          sessionDate: new Date(session.dateSession).toLocaleDateString('fr-FR'),
          referentialCode: session.referentielId ? (referentialCodeMap.get(session.referentielId) || 'N/A') : 'N/A',
          originalSessionId: session.id,
          originalParticipantAssignedGlobalDeviceId: p.assignedGlobalDeviceId,
        });
      });
    });
    return participations;
  }, [sessions, referentialCodeMap, deviceMap]);

  const filteredSessionParticipations = useMemo(() => {
    if (!searchTerm) return allSessionParticipations;
    return allSessionParticipations.filter(participation =>
      `${participation.participantRef.prenom} ${participation.participantRef.nom}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      participation.sessionName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      participation.referentialCode.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allSessionParticipations, searchTerm]);

  const handleSelectParticipation = async (participation: SessionParticipation) => {
    setDetailedParticipation(null);

    const targetSession = sessions.find(s => s.id === participation.originalSessionId);
    // Trouve le participant spécifique DANS la session cible, basé sur assignedGlobalDeviceId
    const targetParticipantRef = targetSession?.participants.find(p => p.assignedGlobalDeviceId === participation.originalParticipantAssignedGlobalDeviceId);

    if (!targetSession || !targetParticipantRef || targetParticipantRef.assignedGlobalDeviceId === undefined || !deviceMap.size || !allThemesDb.length || !allBlocsDb.length) {
      console.error("Données manquantes pour traiter la participation détaillée", {targetSession, targetParticipantRef, deviceMapSize: deviceMap.size, allThemesDbL: allThemesDb.length, allBlocsDbL: allBlocsDb.length});
      return;
    }

    const serialNumberOfSelectedParticipant = deviceMap.get(targetParticipantRef.assignedGlobalDeviceId);
    if (!serialNumberOfSelectedParticipant) {
      console.error("Numéro de série non trouvé pour le participant", targetParticipantRef);
      return;
    }

    const sessionResults = await getResultsForSession(targetSession.id!);
    const baseSessionQuestions = await getQuestionsForSessionBlocks(targetSession.selectedBlocIds || []);

    const enrichedSessionQuestions: EnrichedQuestionForParticipantReport[] = await Promise.all(
      baseSessionQuestions.map(async (question) => {
        let resolvedThemeName = 'Thème non spécifié';
        if (question.blocId) {
          const bloc = allBlocsDb.find(b => b.id === question.blocId);
          if (bloc && bloc.theme_id) {
            const theme = allThemesDb.find(t => t.id === bloc.theme_id);
            if (theme) resolvedThemeName = theme.nom_complet;
          }
        }
        const participantResult = sessionResults.find(
          sr => sr.participantIdBoitier === serialNumberOfSelectedParticipant && sr.questionId === question.id
        );
        return { ...question, resolvedThemeName, participantAnswer: participantResult?.answer, pointsObtainedForAnswer: participantResult?.pointsObtained, isCorrectAnswer: participantResult?.isCorrect };
      })
    );

    const currentParticipantSessionResults = sessionResults.filter(r => r.participantIdBoitier === serialNumberOfSelectedParticipant);
    const score = calculateParticipantScore(currentParticipantSessionResults, enrichedSessionQuestions);
    const themeScores = calculateThemeScores(currentParticipantSessionResults, enrichedSessionQuestions);
    const reussite = determineIndividualSuccess(score, themeScores);

    setDetailedParticipation({
      ...targetSession,
      participantRef: targetParticipantRef,
      participantScore: score,
      participantSuccess: reussite,
      themeScores,
      questionsForDisplay: enrichedSessionQuestions
    });
  };

  const handleBackToList = () => {
    setDetailedParticipation(null);
  };

  if (detailedParticipation) {
    const { participantRef, participantScore, participantSuccess, themeScores, questionsForDisplay } = detailedParticipation;

    const questionsByTheme: { [themeName: string]: EnrichedQuestionForParticipantReport[] } = {};
    if (questionsForDisplay) {
      questionsForDisplay.forEach(q => {
        const theme = q.resolvedThemeName || 'Thème non spécifié';
        if (!questionsByTheme[theme]) questionsByTheme[theme] = [];
        questionsByTheme[theme].push(q);
      });
    }

    return (
      <Card>
        <Button variant="outline" icon={<ArrowLeft size={16} />} onClick={handleBackToList} className="mb-4">
          Retour à la liste
        </Button>
        <h2 className="text-2xl font-bold mb-1">Détail de la participation</h2>
        <p className="text-lg mb-1">Participant : <span className="font-semibold">{participantRef.prenom} {participantRef.nom}</span></p>
        <p className="text-md mb-1">Session : <span className="font-semibold">{detailedParticipation.nomSession}</span> ({new Date(detailedParticipation.dateSession).toLocaleDateString('fr-FR')})</p>
        <p className="text-md mb-4">Référentiel : <Badge variant="secondary">{referentialCodeMap.get(detailedParticipation.referentielId) || 'N/A'}</Badge></p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-2">Performance Globale</h3>
            <p className={participantSuccess ? 'text-green-600 font-bold text-2xl' : 'text-red-600 font-bold text-2xl'}>
              {participantScore !== undefined ? `${participantScore.toFixed(0)} / 100` : 'N/A'}
            </p>
            {participantSuccess !== undefined ? (
              participantSuccess ? <Badge variant="success" size="lg">Réussi</Badge> : <Badge variant="danger" size="lg">Ajourné</Badge>
            ) : <Badge variant="warning" size="lg">En attente</Badge>}
          </Card>
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-2">Scores par Thème</h3>
            {themeScores && Object.entries(themeScores).length > 0 ? (
              Object.entries(themeScores).map(([themeName, themeScoreDetail]) => (
              <div key={themeName} className="mb-1 text-sm">
                <span className={themeScoreDetail.score < 50 ? 'text-red-500 font-semibold' : 'text-gray-700 font-semibold'}>
                  {themeName}: </span> {themeScoreDetail.score.toFixed(0)}% ({themeScoreDetail.correct}/{themeScoreDetail.total})
              </div>
            ))
            ) : (<p className="text-sm text-gray-500">Scores par thème non disponibles.</p>)}
          </Card>
        </div>

        <div>
          <h3 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">Détail des Questions par Thème</h3>
          {Object.entries(questionsByTheme).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
              {Object.entries(questionsByTheme).map(([themeName, questions]) => (
                <div key={themeName} className="mb-4 pt-2"> {/* Espace pour chaque bloc thème */}
                  <h4 className="text-md font-semibold text-gray-700 mb-3 pb-1 border-b border-gray-300">
                    {themeName}
                  </h4>
                  {questions.map((q, qIndex) => (
                    <div key={q.id || qIndex} className="text-sm mb-4 pb-3 border-b border-gray-200 last:border-b-0 last:pb-0 last:mb-0">
                      <p className="flex items-start font-medium text-gray-900 mb-1">
                        <HelpCircle size={16} className="mr-2 text-blue-600 flex-shrink-0 mt-0.5" />
                        <span>{q.text}</span>
                      </p>
                      <div className="pl-6 space-y-0.5">
                        <p>Votre réponse : <span className="font-semibold">{q.participantAnswer || 'Non répondu'}</span></p>
                        {q.isCorrectAnswer === false && q.participantAnswer !== undefined && (
                          <p className="text-orange-600">Bonne réponse : <span className="font-semibold">{q.correctAnswer}</span></p>
                        )}
                         <p className="flex items-center">
                            Points : <span className="font-semibold ml-1">{q.pointsObtainedForAnswer !== undefined ? q.pointsObtainedForAnswer : (q.isCorrectAnswer ? 1 : 0)}</span>
                            {q.isCorrectAnswer === true && <CheckCircle size={15} className="ml-2 text-green-500" />}
                            {q.isCorrectAnswer === false && q.participantAnswer !== undefined && <XCircle size={15} className="ml-2 text-red-500" />}
                          </p>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (<p className="mt-4 text-sm text-gray-500">Détail des questions non disponible.</p>)}
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="text-xl font-bold mb-4">Rapport par Participant (Participations aux Sessions)</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Input 
          placeholder="Rechercher..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="md:col-span-1"
          icon={<Search size={16} className="text-gray-400"/>}
        />
        <Input
          type="date"
          label="Date de début"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="" // La largeur sera gérée par la grille
        />
        <Input
          type="date"
          label="Date de fin"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="" // La largeur sera gérée par la grille
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
              onClick={() => handleSelectParticipation(participation)}
              className="cursor-pointer hover:bg-gray-50"
            >
              <TableCell>{participation.participantRef.prenom} {participation.participantRef.nom}</TableCell>
              <TableCell>{participation.sessionName}</TableCell>
              <TableCell>{participation.sessionDate}</TableCell>
              <TableCell>
                <Badge variant="secondary">{participation.referentialCode}</Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleSelectParticipation(participation); }}>
                  Voir détails participation
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
