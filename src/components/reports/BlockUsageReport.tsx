import React, { useState, useEffect } from 'react';
import { BlockUsage, calculateBlockUsage } from '../../db'; // Ajuster le chemin si besoin
import { CACESReferential } from '../../types'; // Ajuster le chemin si besoin

// Importer les composants UI réutilisables (supposons qu'ils existent)
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table';
import { ArrowUpDown } from 'lucide-react';

// Options pour le filtre Référentiel (similaire à votre exemple)
// Idéalement, cela viendrait de vos types ou d'une constante partagée
const referentialOptions = [
  { value: '', label: 'Tous les référentiels' },
  { value: 'R482', label: 'R482 - Engins de chantier' },
  { value: 'R484', label: 'R484 - Ponts roulants' },
  { value: 'R485', label: 'R485 - Gerbeurs à conducteur accompagnant' },
  { value: 'R486', label: 'R486 - PEMP' },
  { value: 'R489', label: 'R489 - Chariots de manutention' },
  { value: 'R490', label: 'R490 - Grues de chargement' },
  // Ajouter d'autres si nécessaire
];

type SortKey = keyof BlockUsage | '';
type SortDirection = 'asc' | 'desc';

const BlockUsageReport: React.FC = () => {
  const [blockUsageData, setBlockUsageData] = useState<BlockUsage[]>([]);
  const [filteredData, setFilteredData] = useState<BlockUsage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filtres
  const [selectedReferentiel, setSelectedReferentiel] = useState<CACESReferential | string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Tri
  const [sortKey, setSortKey] = useState<SortKey>('usageCount');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const fetchData = async () => {
    setLoading(true);
    try {
      // La fonction calculateBlockUsage est appelée sans arguments initiaux pour charger toutes les données
      // ou avec les dates si elles sont définies.
      // Le filtrage par référentiel se fera côté client après récupération pour ce composant.
      const data = await calculateBlockUsage(
        startDate || undefined,
        endDate || undefined
      );
      setBlockUsageData(data);
    } catch (error) {
      console.error("Erreur lors de la récupération des données d'utilisation des blocs:", error);
      setBlockUsageData([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []); // Charger les données initialement

  // Application des filtres et du tri
  useEffect(() => {
    let dataToFilter = [...blockUsageData];

    if (selectedReferentiel) {
      dataToFilter = dataToFilter.filter(item => item.referentiel === selectedReferentiel);
    }

    // Le filtrage par date est déjà géré par fetchData si startDate/endDate sont passés à calculateBlockUsage.
    // Si calculateBlockUsage ne gérait pas les dates, il faudrait filtrer ici aussi.

    if (sortKey) {
      dataToFilter.sort((a, b) => {
        const valA = a[sortKey];
        const valB = b[sortKey];

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        }
        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return 0;
      });
    }
    setFilteredData(dataToFilter);
  }, [blockUsageData, selectedReferentiel, startDate, endDate, sortKey, sortDirection]);


  const handleFilter = () => {
    // Re-déclenche le calcul avec les nouvelles dates.
    // Le filtrage par référentiel est appliqué dans le useEffect ci-dessus.
    fetchData();
  };

  const handleSort = (key: SortKey) => {
    if (!key) return;
    if (sortKey === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const renderSortArrow = (key: SortKey) => {
    if (sortKey === key) {
      return sortDirection === 'asc' ? <ArrowUpDown className="ml-2 h-4 w-4 inline" /> : <ArrowUpDown className="ml-2 h-4 w-4 inline transform rotate-180" />;
    }
    return <ArrowUpDown className="ml-2 h-4 w-4 inline opacity-50" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rapport d'utilisation des blocs de questions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4 mb-6 p-4 border rounded-lg">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="referentiel-filter" className="block text-sm font-medium text-gray-700 mb-1">Référentiel</label>
            <Select value={selectedReferentiel} onValueChange={(value: string) => setSelectedReferentiel(value as CACESReferential | string)}>
              <SelectTrigger id="referentiel-filter">
                <SelectValue placeholder="Tous les référentiels" />
              </SelectTrigger>
              <SelectContent>
                {referentialOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label htmlFor="start-date-filter" className="block text-sm font-medium text-gray-700 mb-1">Date de début</label>
            <Input
              type="date"
              id="start-date-filter"
              value={startDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="flex-1 min-w-[200px]">
            <label htmlFor="end-date-filter" className="block text-sm font-medium text-gray-700 mb-1">Date de fin</label>
            <Input
              type="date"
              id="end-date-filter"
              value={endDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={handleFilter} className="w-full sm:w-auto">
              Appliquer les filtres
            </Button>
          </div>
        </div>

        {loading ? (
          <p>Chargement des données...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead onClick={() => handleSort('referentiel')} className="cursor-pointer">
                  Référentiel {renderSortArrow('referentiel')}
                </TableHead>
                <TableHead onClick={() => handleSort('theme')} className="cursor-pointer">
                  Thème {renderSortArrow('theme')}
                </TableHead>
                <TableHead onClick={() => handleSort('blockId')} className="cursor-pointer">
                  Bloc ID {renderSortArrow('blockId')}
                </TableHead>
                <TableHead onClick={() => handleSort('usageCount')} className="cursor-pointer text-right">
                  Utilisations {renderSortArrow('usageCount')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.length > 0 ? (
                filteredData.map((item, index) => (
                  <TableRow key={`${item.referentiel}-${item.theme}-${item.blockId}-${index}`}>
                    <TableCell>{item.referentiel}</TableCell>
                    <TableCell>{item.theme}</TableCell>
                    <TableCell>{item.blockId}</TableCell>
                    <TableCell className="text-right">{item.usageCount}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">Aucune donnée à afficher.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default BlockUsageReport;
