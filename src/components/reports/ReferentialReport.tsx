import React, { useState, useEffect, useMemo } from 'react';
import Card from '../ui/Card';
// getQuestionsForSessionBlocks retiré, getAllQuestions retiré car non utilisé
import { getAllSessions, getAllResults, getAllThemes, getAllBlocs, getReferentialById } from '../../db'; // getAllQuestions removed
import { Session, SessionResult, Referential, Theme, Bloc, QuestionWithId, OverallThemeStats } from '../../types';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui/Table';
import { calculateSessionStats, calculateOverallThemeStats } from '../../utils/reportCalculators';
import Button from '../ui/Button';
import { ArrowLeft } from 'lucide-react'; // Eye retiré car le bouton a été retiré/modifié

type ReferentialReportProps = {
  startDate?: string;
  endDate?: string;
  referentialMap: Map<number | undefined, string | undefined>; // ID -> Code
};

const ReferentialReport: React.FC<ReferentialReportProps> = ({ startDate, endDate, referentialMap }) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [allResults, setAllResults] = useState<SessionResult[]>([]);
  const [allQuestions] = useState<QuestionWithId[]>([]); // setAllQuestions removed as it's unused
  const [allThemesDb, setAllThemesDb] = useState<Theme[]>([]); // Nouvel état
  const [allBlocsDb, setAllBlocsDb] = useState<Bloc[]>([]);   // Nouvel état
  const [selectedReferentialForThemeStats, setSelectedReferentialForThemeStats] = useState<Referential | null>(null); // Nouvel état

  useEffect(() => {
    const fetchData = async () => {
      const [
        fetchedSessions,
        fetchedResults,
        // fetchedQuestions, // Sera dérivé après le filtrage des sessions
        fetchedThemes,
        fetchedBlocs
      ] = await Promise.all([
        getAllSessions(),
        getAllResults(),
        // getAllQuestions(), // On ne charge pas toutes les questions ici, mais celles des blocs des sessions filtrées
        getAllThemes(),
        getAllBlocs()
      ]);
      setSessions(fetchedSessions);
      setAllResults(fetchedResults);
      setAllThemesDb(fetchedThemes);
      setAllBlocsDb(fetchedBlocs);
      // Les questions seront chargées dynamiquement ou après filtrage des sessions
    };
    fetchData();
  }, []);

  // relevantQuestions n'est plus utilisé, les questions sont filtrées dans overallThemeStatsForSelectedReferential
  // const relevantQuestions = useMemo(() => { ... });

  const statsByReferential = useMemo(() => {
    const filteredSessions = sessions.filter(session => {
      if (session.status !== 'completed') return false;
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
    console.log(`[ReferentialReport] Nombre de sessions après filtre date: ${filteredSessions.length} (Période: ${startDate} au ${endDate})`);

    const stats = new Map<string, { sessionCount: number; participantCount: number; totalSuccessRate: number }>();

    filteredSessions.forEach(session => {
      const key = String(session.referentielId);
      if (!stats.has(key)) {
        stats.set(key, { sessionCount: 0, participantCount: 0, totalSuccessRate: 0 });
      }
      const currentStats = stats.get(key)!;
      currentStats.sessionCount++;
      currentStats.participantCount += session.participants?.length || 0;

      if (session.id) {
        const sessionResults = allResults.filter(r => r.sessionId === session.id);
        // Filtrer les questions pertinentes pour cette session à partir de allQuestions
        const questionsForThisSession = allQuestions.filter(q => session.selectedBlocIds?.includes(q.blocId as number));
        const sessionStats = calculateSessionStats(session, sessionResults, questionsForThisSession);
        currentStats.totalSuccessRate += sessionStats.successRate;
      }
    });

    return Array.from(stats.entries()).map(([referentielId, data]) => ({ // referentielId au lieu de referentiel
      referentiel: referentielId, // Temporairement, sera remplacé par le nom du référentiel plus tard
      ...data,
      avgSuccessRate: data.sessionCount > 0 ? data.totalSuccessRate / data.sessionCount : 0,
    }));
  }, [sessions, startDate, endDate, allResults, allQuestions]); // Ajout de startDate, endDate

  const overallThemeStatsForSelectedReferential = useMemo((): OverallThemeStats[] => {
    if (!selectedReferentialForThemeStats || !selectedReferentialForThemeStats.id) return [];

    const sessionsForThisReferential = sessions.filter(s =>
      s.referentielId === selectedReferentialForThemeStats.id &&
      s.status === 'completed' &&
      (!startDate || new Date(s.dateSession) >= new Date(startDate)) &&
      (!endDate || new Date(s.dateSession) <= new Date(new Date(endDate).setHours(23,59,59,999)))
    );

    // Re-calculer les questions pertinentes pour ces sessions spécifiques si `allQuestions` n'est pas déjà globalement chargé et filtré
    // Pour l'instant, on utilise `relevantQuestions` qui est basé sur les sessions filtrées par date globalement.
    // Idéalement, on passerait les questions spécifiques à ces sessionsForThisReferential.
    // Ou, plus simple, on passe toutes les questions `allQuestions` si elles sont toutes chargées.
    // Le plus correct est de recalculer les questions pertinentes pour `sessionsForThisReferential`
    const blocIdsForSelectedRefSessions = Array.from(new Set(sessionsForThisReferential.flatMap(s => s.selectedBlocIds || []).filter(id => id != null)));
    const questionsForSelectedRefSessions = allQuestions.filter(q => q.blocId && blocIdsForSelectedRefSessions.includes(q.blocId));


    return calculateOverallThemeStats(
      sessionsForThisReferential,
      allResults,
      questionsForSelectedRefSessions, // Utiliser les questions filtrées pour le référentiel et la période
      allThemesDb,
      allBlocsDb
    );
  }, [selectedReferentialForThemeStats, sessions, allResults, allQuestions, allThemesDb, allBlocsDb, startDate, endDate]);

  // const handleSelectReferential = async (referentialIdString: string) => { // Unused
  //   const referentialId = Number(referentialIdString);
  //   // On doit récupérer l'objet Referential complet, pas juste le code de referentialMap
  //   // Pour cela, on pourrait avoir besoin de la liste complète des référentiels ici.
  //   // Ou alors, le parent (Reports.tsx) passe allReferentielsDb.
  //   // Pour l'instant, on va simuler la récupération par ID.
  //   const refObj = await getReferentialById(referentialId); // Assurez-vous que getReferentialById est importé
  //   if (refObj) {
  //     setSelectedReferentialForThemeStats(refObj);
  //   } else {
  //     console.warn("Référentiel non trouvé pour l'ID:", referentialId);
  //   }
  // };

  const handleBackToReferentialList = () => {
    setSelectedReferentialForThemeStats(null);
  };

  if (selectedReferentialForThemeStats) {
    return (
      <Card>
        <Button variant="outline" icon={<ArrowLeft size={16} />} onClick={handleBackToReferentialList} className="mb-4">
          Retour aux référentiels
        </Button>
        <h2 className="text-xl font-bold mb-1">
          Statistiques par Thème pour le Référentiel : {selectedReferentialForThemeStats.code}
        </h2>
        <p className="text-sm text-gray-600 mb-4">{selectedReferentialForThemeStats.nom_complet}</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code Thème</TableHead>
              <TableHead>Nom du Thème</TableHead>
              <TableHead className="text-center">Questions Répondues</TableHead>
              <TableHead className="text-center">Bonnes Réponses</TableHead>
              <TableHead className="text-center">Taux de Réussite</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {overallThemeStatsForSelectedReferential.map(stat => (
              <TableRow key={stat.themeId}>
                <TableCell>{stat.themeCode}</TableCell>
                <TableCell className="font-medium">{stat.themeName}</TableCell>
                <TableCell className="text-center">{stat.totalQuestionsAnswered}</TableCell>
                <TableCell className="text-center">{stat.totalCorrectAnswers}</TableCell>
                <TableCell className="text-center">{stat.successRate.toFixed(0)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="text-xl font-bold mb-4">Rapport par Référentiel</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Référentiel</TableHead>
            <TableHead className="text-center">Sessions</TableHead>
            <TableHead className="text-center">Participants</TableHead>
            <TableHead className="text-center">Taux de Réussite Moyen</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {statsByReferential.map(stat => {
            const referentialCode = referentialMap.get(Number(stat.referentiel)) || 'N/A';
            return (
              <TableRow key={stat.referentiel}>
                <TableCell className="font-medium">{referentialCode}</TableCell>
                <TableCell className="text-center">{stat.sessionCount}</TableCell>
                <TableCell className="text-center">{stat.participantCount}</TableCell>
                <TableCell className="text-center">{stat.avgSuccessRate.toFixed(0)}%</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
};

export default ReferentialReport;