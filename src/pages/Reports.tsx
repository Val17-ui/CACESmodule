import React, { useState, useEffect, useMemo } from 'react';
import Layout from '../components/layout/Layout';
import GlobalStats from '../components/reports/GlobalStats';
import ReportTypeSelector, { ReportType } from '../components/reports/ReportTypeSelector';
import ReportsList from '../components/reports/ReportsList';
import ReportDetails from '../components/reports/ReportDetails';
import ParticipantReport from '../components/reports/ParticipantReport';
// import PeriodReport from '../components/reports/PeriodReport'; // Supprimé
// import ReferentialReport from '../components/reports/ReferentialReport';
import BlockReport from '../components/reports/BlockReport';
import CustomReport from '../components/reports/CustomReport';
import Button from '../components/ui/Button';
import { ArrowLeft, Download, Printer, Search } from 'lucide-react';
// import { getAllSessions, getSessionById, getAllTrainers, getAllReferentiels } from '../db'; // Supprimé
import { Session, Trainer, Referential } from '@common/types'; // Ajout de Referential, CACESReferential enlevé
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';

type ReportsProps = {
  activePage: string;
  onPageChange: (page: string) => void;
};

const Reports: React.FC<ReportsProps> = ({ activePage, onPageChange }) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeReport, setActiveReport] = useState<ReportType | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [referentialFilter, setReferentialFilter] = useState<string>('all');
  const [trainerFilter, setTrainerFilter] = useState<string>('all');
  const [trainersListForFilter, setTrainersListForFilter] = useState<Trainer[]>([]);
  const [allReferentielsDb, setAllReferentielsDb] = useState<Referential[]>([]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [yearFilter, setYearFilter] = useState('');

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const year = e.target.value;
    setYearFilter(year);
    if (year && /^\d{4}$/.test(year)) {
      setStartDate(`${year}-01-01`);
      setEndDate(`${year}-12-31`);
    } else if (year === '') {
      setStartDate('');
      setEndDate('');
    }
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStartDate(e.target.value);
    setYearFilter('');
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEndDate(e.target.value);
    setYearFilter('');
  };

  const referentialCodeMap = useMemo(() => {
    return new Map(allReferentielsDb.map(ref => [ref.id, ref.code]));
  }, [allReferentielsDb]);

  const referentialOptionsForFilter = useMemo(() => {
    return [
      { value: 'all', label: 'Tous les référentiels' },
      ...allReferentielsDb.map(ref => ({
        value: String(ref.id),
        label: ref.code
      }))
    ];
  }, [allReferentielsDb]);


  useEffect(() => {
    const fetchInitialData = async () => {
      if (!window.dbAPI ||
          !window.dbAPI.getAllSessions ||
          !window.dbAPI.getAllTrainers ||
          !window.dbAPI.getAllReferentiels) {
        console.error("[Reports Page] dbAPI or required functions are not available on window object.");
        // Gérer l'erreur, par exemple en affichant un message à l'utilisateur ou en ne chargeant pas les données
        return;
      }
      try {
        const [fetchedSessions, fetchedTrainers, fetchedReferentiels] = await Promise.all([
          window.dbAPI.getAllSessions(),
          window.dbAPI.getAllTrainers(),
          window.dbAPI.getAllReferentiels()
        ]);

        setSessions(fetchedSessions.sort((a: Session, b: Session) => new Date(b.dateSession).getTime() - new Date(a.dateSession).getTime()));
        setTrainersListForFilter(fetchedTrainers.sort((a: Trainer, b: Trainer) => a.name.localeCompare(b.name)));
        setAllReferentielsDb(fetchedReferentiels.sort((a: Referential, b: Referential) => a.nom_complet.localeCompare(b.nom_complet)));
      } catch (error) {
        console.error("[Reports Page] Error fetching initial data via IPC:", error);
        // Gérer l'erreur pour l'utilisateur
      }
    };
    fetchInitialData();
  }, []);

  const handleSelectReport = (reportType: ReportType) => {
    setActiveReport(reportType);
  };

  const handleViewSessionReport = async (sessionId: string) => {
    if (!window.dbAPI?.getSessionById) {
      console.error("[Reports Page] dbAPI.getSessionById is not available on window object.");
      // Gérer l'erreur pour l'utilisateur
      return;
    }
    try {
      const session = await window.dbAPI.getSessionById(Number(sessionId));
      if (session) {
        setSelectedSession(session);
      } else {
        console.warn(`[Reports Page] Session with ID ${sessionId} not found via IPC.`);
        // Gérer le cas où la session n'est pas trouvée
      }
    } catch (error) {
      console.error(`[Reports Page] Error fetching session ${sessionId} via IPC:`, error);
      // Gérer l'erreur pour l'utilisateur
    }
  };

  const handleBack = () => {
    if (selectedSession) {
      setSelectedSession(null);
    } else {
      setActiveReport(null);
    }
  };

  const filteredSessions = useMemo(() => {
    return sessions
      .filter(session => 
        referentialFilter === 'all' || (session.referentielId !== undefined && session.referentielId?.toString() === referentialFilter)
      )
      .filter(session =>
        trainerFilter === 'all' || (session.trainerId !== undefined && session.trainerId?.toString() === trainerFilter)
      )
      .filter(session => 
        session.nomSession.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .filter(session => {
        if (!startDate && !endDate) return true;
        const sessionDate = new Date(session.dateSession);
        if (startDate && sessionDate < new Date(startDate)) return false;
        if (endDate) {
          const endOfDayEndDate = new Date(endDate);
          endOfDayEndDate.setHours(23, 59, 59, 999); // Inclure toute la journée de la date de fin
          if (sessionDate > endOfDayEndDate) return false;
        }
        return true;
      });
  }, [sessions, searchTerm, referentialFilter, trainerFilter, startDate, endDate]);

  const renderContent = () => {
    if (selectedSession) {
      return <ReportDetails session={selectedSession} />;
    }

    switch (activeReport) {
      case 'session':
        return (
          <div>
            <div className="mb-4 flex space-x-4">
              <Input 
                placeholder="Rechercher par nom..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-2/5"
                 icon={<Search size={16} className="text-rouge-accent"/>}
              />
              <Select
                value={referentialFilter}
                onChange={(e) => setReferentialFilter(e.target.value)}
                className="w-1/4"
                options={referentialOptionsForFilter} // Utiliser les options dynamiques
              />
              <Select
                value={trainerFilter}
                onChange={(e) => setTrainerFilter(e.target.value)}
                className="w-1/4"
                options={[
                  { value: 'all', label: 'Tous les formateurs' },
                  ...trainersListForFilter.map(trainer => ({ value: trainer.id?.toString() || '', label: trainer.name }))
                ]}
                disabled={trainersListForFilter.length === 0}
              />
            </div>
            <div className="mb-4 flex space-x-4">
              <Input
                type="number"
                label="Année"
                placeholder="YYYY"
                value={yearFilter}
                onChange={handleYearChange}
                className="w-1/5"
              />
              <Input
                type="date"
                label="Date de début"
                value={startDate}
                onChange={handleStartDateChange}
                className="w-1/3"
              />
              <Input
                type="date"
                label="Date de fin"
                value={endDate}
                onChange={handleEndDateChange}
                className="w-1/3"
              />
            </div>
            <ReportsList
              sessions={filteredSessions}
              onViewReport={handleViewSessionReport}
              referentialMap={referentialCodeMap} // Passer la nouvelle map de codes
            />
          </div>
        );
      case 'participant':
        // ParticipantReport pourrait aussi avoir besoin de referentialMap si on affiche le nom du réf. dans sa liste
        return <ParticipantReport />;
      // case 'period': // Supprimé
      // return <PeriodReport />;
      // case 'referential':
        // return <ReferentialReport startDate={startDate} endDate={endDate} referentialMap={referentialCodeMap} />;
      case 'block':
        return (
          <div>
            <div className="mb-4 flex space-x-4 items-end bg-gray-50 p-4 rounded-lg">
                <div className="flex-1">
                    <label htmlFor="referentiel-filter-block" className="block text-sm font-medium text-gray-700 mb-1">Référentiel</label>
                    <Select
                      id="referentiel-filter-block"
                      value={referentialFilter}
                      onChange={(e) => setReferentialFilter(e.target.value)}
                      className="w-full"
                      options={referentialOptionsForFilter}
                    />
                </div>
                <div className="flex-1">
                  <Input
                    type="number"
                    label="Année"
                    placeholder="YYYY"
                    value={yearFilter}
                    onChange={handleYearChange}
                  />
                </div>
                <div className="text-center pb-2 mx-2 text-gray-500">ou</div>
                <div className="flex-1">
                  <Input
                    type="date"
                    label="Date de début"
                    value={startDate}
                    onChange={handleStartDateChange}
                  />
                </div>
                <div className="flex-1">
                  <Input
                    type="date"
                    label="Date de fin"
                    value={endDate}
                    onChange={handleEndDateChange}
                  />
                </div>
            </div>
            <BlockReport startDate={startDate} endDate={endDate} referentialFilter={referentialFilter} />
          </div>
        );
      case 'custom':
        return <CustomReport />;
      default:
        return (
          <>
            {/* GlobalStats pourrait avoir besoin de referentialMap si on y affiche des stats par référentiel */}
            <GlobalStats sessions={filteredSessions} />
            <ReportTypeSelector onSelectReport={handleSelectReport} />
          </>
        );
    }
  };

  const getTitle = () => {
    if (selectedSession) return `Rapport: ${selectedSession.nomSession}`;
    if (activeReport) {
      const reportTitles: { [key in ReportType]?: string } = { // S'assurer que ReportType est à jour
        session: 'Rapports par Session',
        participant: 'Rapports par Participant',
        // period: 'Rapports par Période', // Supprimé
        // referential: 'Rapports par Référentiel',
        block: 'Rapport des tirages',
        custom: 'Rapport Personnalisé',
      };
      return reportTitles[activeReport] || 'Rapports'; // Fallback au cas où
    }
    return 'Rapports et Statistiques';
  };

  const getSubtitle = () => {
    if (selectedSession) return `Analyse détaillée de la session du ${new Date(selectedSession.dateSession).toLocaleDateString('fr-FR')}`;
    if (activeReport) return 'Sélectionnez un élément pour voir les détails';
    return 'Visualisez les données de performance et de certification';
  };

  const headerActions = (
    <div className="flex items-center space-x-3">
      {activeReport && (
        <Button variant="outline" icon={<ArrowLeft size={16} className="text-rouge-accent" />} onClick={handleBack}>
          Retour
        </Button>
      )}
      {selectedSession && (
        <>
          {/* Les boutons ont été déplacés dans ReportDetails.tsx */}
        </>
      )}
    </div>
  );

  return (
    <Layout
      title={getTitle()}
      subtitle={getSubtitle()}
      actions={headerActions}
      activePage={activePage}
      onPageChange={onPageChange}
    >
      {renderContent()}
    </Layout>
  );
};

export default Reports;