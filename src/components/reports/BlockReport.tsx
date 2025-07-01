import React, { useState, useEffect, useMemo } from 'react';
import Card from '../ui/Card';
import { getAllSessions, getAllResults, getAllQuestions } from '../../db';
import { Session, SessionResult, QuestionWithId } from '../../types';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui/Table';
import { calculateBlockStats } from '../../utils/reportCalculators';

const BlockReport = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [allResults, setAllResults] = useState<SessionResult[]>([]);
  const [allQuestions, setAllQuestions] = useState<QuestionWithId[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const fetchedSessions = await getAllSessions();
      setSessions(fetchedSessions);
      const fetchedResults = await getAllResults();
      setAllResults(fetchedResults);
      const fetchedQuestions = await getAllQuestions();
      setAllQuestions(fetchedQuestions);
    };
    fetchData();
  }, []);

  const statsByBlock = useMemo(() => {
    const uniqueBlocks = new Map<string, { theme: string; blockId: string }>();
    sessions.forEach(session => {
      session.selectionBlocs?.forEach(block => {
        const key = `${block.theme}-${block.blockId}`;
        if (!uniqueBlocks.has(key)) {
          uniqueBlocks.set(key, block);
        }
      });
    });

    const calculatedStats: { block: string; useCount: number; avgSuccessRate: number; avgScore: number }[] = [];

    uniqueBlocks.forEach(block => {
      const stats = calculateBlockStats(block, sessions, allResults, allQuestions);
      calculatedStats.push({
        block: `${block.theme} - ${block.blockId}`,
        useCount: stats.usageCount,
        avgSuccessRate: stats.averageSuccessRate,
        avgScore: stats.averageScore,
      });
    });

    return calculatedStats;
  }, [sessions, allResults, allQuestions]);

  return (
    <Card>
      <h2 className="text-xl font-bold mb-4">Rapport par Bloc de Questions</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Bloc</TableHead>
            <TableHead className="text-center">Utilisations</TableHead>
            <TableHead className="text-center">Taux de réussite moyen</TableHead>
            <TableHead className="text-center">Note moyenne</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {statsByBlock.map(stat => (
            <TableRow key={stat.block}>
              <TableCell className="font-medium">{stat.block}</TableCell>
              <TableCell className="text-center">{stat.useCount}</TableCell>
              <TableCell className="text-center">{stat.avgSuccessRate.toFixed(2)}%</TableCell>
              <TableCell className="text-center">{stat.avgScore.toFixed(2)}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};

export default BlockReport;
