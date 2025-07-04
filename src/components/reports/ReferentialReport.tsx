import React, { useState, useEffect, useMemo } from 'react';
import Card from '../ui/Card';
import { getAllSessions, getAllResults, getQuestionsForSessionBlocks } from '../../db';
import { Session, CACESReferential, SessionResult, QuestionWithId } from '../../types';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui/Table';
import { calculateSessionStats } from '../../utils/reportCalculators';

const ReferentialReport = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [allResults, setAllResults] = useState<SessionResult[]>([]);
  const [allQuestions, setAllQuestions] = useState<QuestionWithId[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const fetchedSessions = await getAllSessions();
      setSessions(fetchedSessions);
      const fetchedResults = await getAllResults();
      setAllResults(fetchedResults);
      // Fetch all questions to be able to map them to blocks
      // This might need optimization if there are too many questions
      const allSessionBlocks = fetchedSessions.flatMap(s => s.selectionBlocs || []);
      const uniqueBlockQuestions = Array.from(new Set(allSessionBlocks.map(b => b.theme + b.blockId)))
        .map(blockId => {
          const block = allSessionBlocks.find(b => b.theme + b.blockId === blockId);
          return block;
        }).filter(Boolean);
      
      const fetchedQuestions = await getQuestionsForSessionBlocks(uniqueBlockQuestions as any);
      setAllQuestions(fetchedQuestions);
    };
    fetchData();
  }, []);

  const statsByReferential = useMemo(() => {
    const stats = new Map<string, { sessionCount: number; participantCount: number; totalSuccessRate: number }>();

    sessions.forEach(session => {
      if (session.status !== 'completed') return;

      const key = String(session.referentiel);
      if (!stats.has(key)) {
        stats.set(key, { sessionCount: 0, participantCount: 0, totalSuccessRate: 0 });
      }
      const currentStats = stats.get(key)!;
      currentStats.sessionCount++;
      currentStats.participantCount += session.participants?.length || 0;

      if (session.id) {
        const sessionResults = allResults.filter(r => r.sessionId === session.id);
        const sessionQuestions = allQuestions.filter(q => session.selectionBlocs?.some(b => q.theme === b.theme && q.slideGuid === b.blockId));
        const sessionStats = calculateSessionStats(session, sessionResults, sessionQuestions);
        currentStats.totalSuccessRate += sessionStats.successRate;
      }
    });

    return Array.from(stats.entries()).map(([referentiel, data]) => ({
      referentiel,
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
          {statsByReferential.map(stat => (
            <TableRow key={stat.referentiel}>
              <TableCell className="font-medium">{stat.referentiel}</TableCell>
              <TableCell className="text-center">{stat.sessionCount}</TableCell>
              <TableCell className="text-center">{stat.participantCount}</TableCell>
              <TableCell className="text-center">{stat.avgSuccessRate.toFixed(2)}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};

export default ReferentialReport;