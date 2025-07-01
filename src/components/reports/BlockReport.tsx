import React, { useState, useEffect, useMemo } from 'react';
import Card from '../ui/Card';
import { getAllSessions } from '../../db';
import { Session } from '../../types';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui/Table';

const BlockReport = () => {
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    const fetchSessions = async () => {
      const allSessions = await getAllSessions();
      setSessions(allSessions);
    };
    fetchSessions();
  }, []);

  const statsByBlock = useMemo(() => {
    const stats = new Map<string, { useCount: number; successRateSum: number }>();

    sessions.forEach(session => {
      if (session.status !== 'completed' || !session.selectionBlocs) return;

      session.selectionBlocs.forEach(block => {
        const key = `${session.referentiel} - ${block.theme} - ${block.blockId}`;
        if (!stats.has(key)) {
          stats.set(key, { useCount: 0, successRateSum: 0 });
        }
        const currentStats = stats.get(key)!;
        currentStats.useCount++;
        // TODO: Replace with real success rate for the block
        currentStats.successRateSum += 75; 
      });
    });

    return Array.from(stats.entries()).map(([block, data]) => ({
      block,
      ...data,
      avgSuccessRate: data.useCount > 0 ? data.successRateSum / data.useCount : 0,
    }));
  }, [sessions]);

  return (
    <Card>
      <h2 className="text-xl font-bold mb-4">Rapport par Bloc de Questions</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Bloc</TableHead>
            <TableHead className="text-center">Utilisations</TableHead>
            <TableHead className="text-center">Taux de réussite moyen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {statsByBlock.map(stat => (
            <TableRow key={stat.block}>
              <TableCell className="font-medium">{stat.block}</TableCell>
              <TableCell className="text-center">{stat.useCount}</TableCell>
              <TableCell className="text-center">{stat.avgSuccessRate.toFixed(2)}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};

export default BlockReport;
