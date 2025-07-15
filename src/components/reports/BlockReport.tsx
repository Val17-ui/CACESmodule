import React, { useState, useEffect, useMemo } from 'react';
import Card from '../ui/Card';
import { getAllSessions, getAllResults, getAllQuestions, getAllReferentiels, getAllThemes, getAllBlocs } from '../../db';
import { Session, SessionResult, Referential, Theme, Bloc, QuestionWithId, CalculatedBlockOverallStats } from '../../types'; // QuestionWithId et CalculatedBlockOverallStats importés de types
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui/Table';
import { calculateBlockStats } from '../../utils/reportCalculators'; // calculateBlockStats est déjà la version refactorée

type BlockReportProps = {
  startDate?: string;
  endDate?: string;
  // Potentiellement passer les données déjà chargées par Reports.tsx pour optimiser
};

const BlockReport: React.FC<BlockReportProps> = ({ startDate, endDate }) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [allResults, setAllResults] = useState<SessionResult[]>([]);
  const [allQuestions, setAllQuestions] = useState<QuestionWithId[]>([]);
  const [allReferentielsDb, setAllReferentielsDb] = useState<Referential[]>([]);
  const [allThemesDb, setAllThemesDb] = useState<Theme[]>([]);
  const [allBlocsDb, setAllBlocsDb] = useState<Bloc[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [
        fetchedSessions,
        fetchedResults,
        fetchedQuestions,
        fetchedReferentiels,
        fetchedThemes,
        fetchedBlocs
      ] = await Promise.all([
        getAllSessions(),
        getAllResults(),
        getAllQuestions(),
        getAllReferentiels(),
        getAllThemes(),
        getAllBlocs()
      ]);
      setSessions(fetchedSessions);
      setAllResults(fetchedResults);
      setAllQuestions(fetchedQuestions);
      setAllReferentielsDb(fetchedReferentiels);
      setAllThemesDb(fetchedThemes);
      setAllBlocsDb(fetchedBlocs);
    };
    fetchData();
  }, []);

  const statsByBlock = useMemo(() => {
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
    console.log(`[BlockReport] Nombre de sessions après filtre date: ${filteredSessions.length} (Période: ${startDate} au ${endDate})`);

    const uniqueNumericBlocIds = Array.from(new Set(filteredSessions.flatMap(s => s.selectedBlocIds || []).filter(id => id != null))) as number[];

    const calculatedStats: CalculatedBlockOverallStats[] = [];

    uniqueNumericBlocIds.forEach(blocId => {
      const stats = calculateBlockStats(
        blocId,
        filteredSessions, // Utiliser les sessions filtrées par date
        allResults,
        allQuestions,
        allReferentielsDb,
        allThemesDb,
        allBlocsDb
      );
      if (stats) {
        calculatedStats.push(stats);
      }
    });
    // Trier par référentiel, puis thème, puis code de bloc
    return calculatedStats.sort((a, b) =>
      a.referentielCode.localeCompare(b.referentielCode) ||
      a.themeCode.localeCompare(b.themeCode) ||
      a.blocCode.localeCompare(b.blocCode)
    );
  }, [sessions, allResults, allQuestions, allReferentielsDb, allThemesDb, allBlocsDb, startDate, endDate]);

  return (
    <Card>
      <h2 className="text-xl font-bold mb-4">Rapport Général par Bloc de Questions</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Référentiel</TableHead>
            <TableHead>Thème</TableHead>
            <TableHead>Bloc</TableHead>
            <TableHead className="text-center">Utilisations</TableHead>
            <TableHead className="text-center">Taux de réussite moyen</TableHead>
            <TableHead className="text-center">Note moyenne</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {statsByBlock.map(stat => (
            <TableRow key={`${stat.referentielCode}-${stat.themeCode}-${stat.blocCode}`}>
              <TableCell>{stat.referentielCode}</TableCell>
              <TableCell>{stat.themeCode}</TableCell>
              <TableCell className="font-medium">{stat.blocCode}</TableCell>
              <TableCell className="text-center">{stat.usageCount}</TableCell>
              <TableCell className="text-center">{stat.averageSuccessRate.toFixed(0)}%</TableCell>
              <TableCell className="text-center">{stat.averageScore.toFixed(1)}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};

export default BlockReport;
