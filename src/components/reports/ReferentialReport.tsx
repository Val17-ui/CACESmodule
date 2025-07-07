import React, { useState, useEffect, useMemo } from 'react';
import Card from '../ui/Card';
import { getAllSessions, getAllResults, getQuestionsForSessionBlocks } from '../../db';
import { Session, SessionResult, QuestionWithId, Referential } from '../../types'; // Ajout de Referential
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui/Table';
import { calculateSessionStats } from '../../utils/reportCalculators';

type ReferentialReportProps = {
  startDate?: string;
  endDate?: string;
  referentialMap: Map<number | undefined, string | undefined>; // ID -> Code
  // sessions: Session[]; // Les sessions seront fetchées ici ou passées en props filtrées
  // allResults: SessionResult[]; // Idem
  // allQuestions: QuestionWithId[]; // Idem
};

const ReferentialReport: React.FC<ReferentialReportProps> = ({ startDate, endDate, referentialMap }) => {
  // Les données sont chargées en interne pour ce composant pour l'instant
  // Pour une optimisation, elles pourraient être passées en props si déjà chargées par le parent (Reports.tsx)
  const [sessions, setSessions] = useState<Session[]>([]);
  const [allResults, setAllResults] = useState<SessionResult[]>([]);
  const [allQuestions, setAllQuestions] = useState<QuestionWithId[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const fetchedSessions = await getAllSessions();
      setSessions(fetchedSessions); // Pas de tri par date ici, le filtre s'en chargera
      const fetchedResults = await getAllResults();
      setAllResults(fetchedResults);
      const allUniqueBlocIds = Array.from(new Set(fetchedSessions.flatMap(s => s.selectedBlocIds || []).filter(id => id != null)));
      const fetchedQuestions = await getQuestionsForSessionBlocks(allUniqueBlocIds as number[]);
      setAllQuestions(fetchedQuestions);
    };
    fetchData();
  }, []); // Se charge une fois

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
  }, [sessions, allResults, allQuestions]);

  return (
    <Card>
      <h2 className="text-xl font-bold mb-4">Rapport par Référentiel</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Référentiel</TableHead>
            <TableHead className="text-center">Sessions</TableHead>
            <TableHead className="text-center">Participants</TableHead>
            <TableHead className="text-center">Taux de réussite moyen</TableHead>
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