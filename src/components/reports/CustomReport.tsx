import React, { useState, useEffect, useMemo } from 'react';
import Card from '../ui/Card';
import { getAllSessions, getAllReferentiels } from '../../db'; // Ajout de getAllReferentiels
import { Session, Referential } from '../../types'; // Ajout de Referential, CACESReferential enlevé
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

// CustomReport.tsx
// ... (imports existants)
// Assurez-vous que Referential et CACESReferential (si utilisé pour les options statiques) sont importés
// import { Referential, CACESReferential } from '../../types';
// import { getAllReferentiels } from '../../db'; // Si vous chargez dynamiquement les options de référentiel

const CustomReport = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [allReferentielsDb, setAllReferentielsDb] = useState<Referential[]>([]); // Ajouté
  const [filters, setFilters] = useState({
    referentialId: 'all', // Changé pour referentialId, stockera l'ID (string) ou 'all'
    startDate: '',
    endDate: '',
    status: 'all',
  });

  // Map pour obtenir le code du référentiel par son ID pour l'affichage
  const referentialCodeMap = useMemo(() => {
    return new Map(allReferentielsDb.map(ref => [ref.id, ref.code]));
  }, [allReferentielsDb]);

  // Options pour le Select, maintenant basées sur les ID et affichant les codes
  const referentialOptionsForFilter = useMemo(() => {
    return [
      { value: 'all', label: 'Tous les référentiels' },
      ...allReferentielsDb.map(ref => ({
        value: String(ref.id), // Le filtre se fera sur l'ID
        label: ref.code        // On affiche le code
      }))
    ];
  }, [allReferentielsDb]);

  useEffect(() => {
    const loadData = async () => {
      const [fetchedSessions, fetchedReferentiels] = await Promise.all([
        getAllSessions(),
        getAllReferentiels(),
      ]);
      setSessions(fetchedSessions);
      setAllReferentielsDb(fetchedReferentiels.sort((a, b) => a.code.localeCompare(b.code)));
    };
    loadData();
  }, []);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const filteredSessions = useMemo(() => {
    return sessions.filter(session => {
      // Filtre par référentiel basé sur l'ID
      if (filters.referentialId !== 'all' && String(session.referentielId) !== filters.referentialId) return false;

      if (filters.status !== 'all' && session.status !== filters.status) return false;

      const sessionDate = new Date(session.dateSession);
      if (filters.startDate && sessionDate < new Date(filters.startDate)) return false;
      if (filters.endDate) {
        const endOfDay = new Date(filters.endDate);
        endOfDay.setHours(23, 59, 59, 999);
        if (sessionDate > endOfDay) return false;
      }
      return true;
    });
  }, [sessions, filters]); // referentialCodeMap n'est pas nécessaire ici car on filtre par ID

  return (
    <Card>
      <h2 className="text-xl font-bold mb-4">Rapport Personnalisé</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 p-4 border rounded-lg">
        <Select
          name="referentialId" // Changé pour correspondre à l'état du filtre
          label="Référentiel"
          value={filters.referentialId}
          onChange={handleFilterChange}
          options={referentialOptionsForFilter} // Utilise les options dynamiques
        />
        <Select
          name="status"
          label="Statut"
          value={filters.status}
          onChange={handleFilterChange}
          options={[
            { value: 'all', label: 'Tous les statuts' },
            { value: 'planned', label: 'Planifié' },
            { value: 'in-progress', label: 'En cours' },
            { value: 'completed', label: 'Terminé' },
            { value: 'cancelled', label: 'Annulé' }
          ]}
        />
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
              {/* Afficher le code du référentiel en utilisant la map */}
              <TableCell>{session.referentielId ? referentialCodeMap.get(session.referentielId) : 'N/A'}</TableCell>
              <TableCell>{session.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};

export default CustomReport;
