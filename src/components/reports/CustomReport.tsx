import React, { useState, useEffect, useMemo } from 'react';
import Card from '../ui/Card';
import { getAllSessions } from '../../db';
import { Session, CACESReferential } from '../../types';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui/Table';
import { Download } from 'lucide-react';

const CustomReport = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [filters, setFilters] = useState({
    referentiel: 'all',
    startDate: '',
    endDate: '',
    status: 'all',
  });

  useEffect(() => {
    const fetchSessions = async () => {
      const allSessions = await getAllSessions();
      setSessions(allSessions);
    };
    fetchSessions();
  }, []);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const filteredSessions = useMemo(() => {
    return sessions.filter(session => {
      if (filters.referentiel !== 'all' && session.referentiel !== filters.referentiel) return false;
      if (filters.status !== 'all' && session.status !== filters.status) return false;
      const sessionDate = new Date(session.dateSession);
      if (filters.startDate && sessionDate < new Date(filters.startDate)) return false;
      if (filters.endDate && sessionDate > new Date(filters.endDate)) return false;
      return true;
    });
  }, [sessions, filters]);

  return (
    <Card>
      <h2 className="text-xl font-bold mb-4">Rapport Personnalisé</h2>
      <div className="grid grid-cols-4 gap-4 mb-4 p-4 border rounded-lg">
        <Select name="referentiel" value={filters.referentiel} onChange={handleFilterChange}>
          <option value="all">Tous les référentiels</option>
          {Object.values(CACESReferential).map(ref => (
            <option key={ref} value={ref}>{ref}</option>
          ))}
        </Select>
        <Select name="status" value={filters.status} onChange={handleFilterChange}>
          <option value="all">Tous les statuts</option>
          <option value="planned">Planifié</option>
          <option value="in-progress">En cours</option>
          <option value="completed">Terminé</option>
          <option value="cancelled">Annulé</option>
        </Select>
        <Input name="startDate" type="date" value={filters.startDate} onChange={handleFilterChange} />
        <Input name="endDate" type="date" value={filters.endDate} onChange={handleFilterChange} />
      </div>

      <div className="flex justify-end mb-4">
        <Button variant="outline" icon={<Download size={16}/>}>Exporter cette vue</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Session</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Référentiel</TableHead>
            <TableHead>Statut</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredSessions.map(session => (
            <TableRow key={session.id}>
              <TableCell>{session.nomSession}</TableCell>
              <TableCell>{new Date(session.dateSession).toLocaleDateString('fr-FR')}</TableCell>
              <TableCell>{session.referentiel}</TableCell>
              <TableCell>{session.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};

export default CustomReport;
