import React, { useState, useEffect, useMemo } from 'react';
import Card from '../ui/Card';
import { getAllSessions } from '../../db';
import { Session, CACESReferential } from '../../types';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui/Table';

const ReferentialReport = () => {
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    const fetchSessions = async () => {
      const allSessions = await getAllSessions();
      setSessions(allSessions);
    };
    fetchSessions();
  }, []);

  const statsByReferential = useMemo(() => {
    const stats = new Map<string, { sessionCount: number; participantCount: number; successRateSum: number }>();

    sessions.forEach(session => {
      if (session.status !== 'completed') return;

      const key = String(session.referentiel);
      if (!stats.has(key)) {
        stats.set(key, { sessionCount: 0, participantCount: 0, successRateSum: 0 });
      }
      const currentStats = stats.get(key)!;
      currentStats.sessionCount++;
      currentStats.participantCount += session.participants?.length || 0;
      // TODO: Replace with real success rate
      currentStats.successRateSum += 78; 
    });

    return Array.from(stats.entries()).map(([referentiel, data]) => ({
      referentiel,
      ...data,
      avgSuccessRate: data.sessionCount > 0 ? data.successRateSum / data.sessionCount : 0,
    }));
  }, [sessions]);

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
