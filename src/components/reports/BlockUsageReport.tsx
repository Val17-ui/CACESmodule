import React, { useState, useEffect, useMemo } from 'react';
import { BlockUsage, calculateBlockUsage, getAllReferentiels } from '../../db';
import { Referential } from '../../types'; // Removed CACESReferential

// Importer les composants UI réutilisables
import Card from '../ui/Card';
import Select from '../ui/Select'; // Updated import
import Input from '../ui/Input';
import Button from '../ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table';
import { ArrowUpDown } from 'lucide-react';

// Options pour le filtre Référentiel (similaire à votre exemple)
// Les referentialOptions seront maintenant dynamiques

type SortKey = keyof BlockUsage | '';
type SortDirection = 'asc' | 'desc';

const BlockUsageReport: React.FC = () => {
  const [blockUsageData, setBlockUsageData] = useState<BlockUsage[]>([]);
  const [filteredData, setFilteredData] = useState<BlockUsage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [allReferentielsDb, setAllReferentielsDb] = useState<Referential[]>([]);

  // Filtres
  const [selectedReferentiel, setSelectedReferentiel] = useState<string>(''); // ID du référentiel (string car value de Select)
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
    const loadReferentiels = async () => {
      const refs = await getAllReferentiels();
      setAllReferentielsDb(refs.sort((a,b) => a.code.localeCompare(b.code)));
    };
    loadReferentiels();
    fetchData(); // Charger les données d'utilisation des blocs
  }, []); // Charger les données initialement

  const dynamicReferentialOptions = useMemo(() => {
    return [
      { value: '', label: 'Tous les référentiels' }, // L'value ici est string vide pour "tous"
      ...allReferentielsDb.map(ref => ({
        value: ref.code, // On filtre sur le code du référentiel (ex: "R489") car BlockUsage.referentiel est un code
        label: ref.code // Afficher juste le code
      }))
    ];
  }, [allReferentielsDb]);

  // Application des filtres et du tri
  useEffect(() => {
    let dataToFilter = [...blockUsageData];

    // Le champ `item.referentiel` dans `BlockUsage` est le code du référentiel (string)
    if (selectedReferentiel) { // selectedReferentiel est le code (string)
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
    <Card title="Rapport d'utilisation des blocs de questions">
      {/* CardHeader, CardTitle, and CardContent removed, content moved directly under Card */}
      <div className="flex flex-wrap gap-4 mb-6 p-4 border rounded-lg">
        <div className="flex-1 min-w-[200px]">
          {/* <label htmlFor="referentiel-filter" className="block text-sm font-medium text-gray-700 mb-1">Référentiel</label> */}
          {/* The simple Select component has its own label prop */}
          <Select
            id="referentiel-filter"
            label="Référentiel"
            options={dynamicReferentialOptions} // Utiliser les options dynamiques
            value={selectedReferentiel} // value est maintenant le code string
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedReferentiel(e.target.value)}
            placeholder="Tous les référentiels"
            className="w-full"
          />
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
      {/* End of CardContent equivalent */}
    </Card>
  );
};

export default BlockUsageReport;
