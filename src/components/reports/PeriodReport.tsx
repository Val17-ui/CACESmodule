import React, { useState, useEffect, useMemo } from 'react';
import Card from '../ui/Card';
import { getAllSessions } from '../../db';
import { Session } from '../../types';
import Input from '../ui/Input';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui/Table';

const PeriodReport = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const fetchSessions = async () => {
      const allSessions = await getAllSessions();
      setSessions(allSessions);
    };
    fetchSessions();
  }, []);

  const filteredSessions = useMemo(() => {
    if (!startDate && !endDate) {
      return sessions;
    }
    return sessions.filter(session => {
      const sessionDate = new Date(session.dateSession);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      if (start && sessionDate < start) return false;
      if (end && sessionDate > end) return false;
      return true;
    });
  }, [sessions, startDate, endDate]);

  return (
    <Card>
      <h2 className="text-xl font-bold mb-4">Rapport par Période</h2>
      <div className="flex space-x-4 mb-4">
        <Input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-1/4"
        />
        <Input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="w-1/4"
        />
      </div>
      
      {/* TODO: Add charts and summary stats */}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Session</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Référentiel</TableHead>
            <TableHead>Participants</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredSessions.map(session => (
            <TableRow key={session.id}>
              <TableCell>{session.nomSession}</TableCell>
              <TableCell>{new Date(session.dateSession).toLocaleDateString('fr-FR')}</TableCell>
              <TableCell>{session.referentiel}</TableCell>
              <TableCell>{session.participants?.length || 0}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};

export default PeriodReport;
