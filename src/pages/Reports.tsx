import React, { useState, useEffect, useMemo } from 'react';
import Layout from '../components/layout/Layout';
import GlobalStats from '../components/reports/GlobalStats';
import ReportTypeSelector, { ReportType } from '../components/reports/ReportTypeSelector';
import ReportsList from '../components/reports/ReportsList';
import ReportDetails from '../components/reports/ReportDetails';
import ParticipantReport from '../components/reports/ParticipantReport';
// import PeriodReport from '../components/reports/PeriodReport'; // Supprimé
import ReferentialReport from '../components/reports/ReferentialReport';
import BlockReport from '../components/reports/BlockReport';
import CustomReport from '../components/reports/CustomReport';
import Button from '../components/ui/Button';
import { ArrowLeft, Download, Printer, Search } from 'lucide-react';
import { getAllSessions, getSessionById, getAllTrainers, getAllReferentiels } from '../db'; // Ajout de getAllReferentiels
import { Session, Participant, Trainer, Referential } from '../types'; // Ajout de Referential, CACESReferential enlevé
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
  const [sessionParticipants, setSessionParticipants] = useState<Participant[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [referentialFilter, setReferentialFilter] = useState<string>('all');
  const [trainerFilter, setTrainerFilter] = useState<string>('all');
  const [trainersListForFilter, setTrainersListForFilter] = useState<Trainer[]>([]);
  const [allReferentielsDb, setAllReferentielsDb] = useState<Referential[]>([]);
  const [startDate, setStartDate] = useState<string>(''); // Nouvel état pour date de début
  const [endDate, setEndDate] = useState<string>('');     // Nouvel état pour date de fin

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
      const [fetchedSessions, fetchedTrainers, fetchedReferentiels] = await Promise.all([
        getAllSessions(),
        getAllTrainers(),
        getAllReferentiels()
      ]);

      setSessions(fetchedSessions.sort((a, b) => new Date(b.dateSession).getTime() - new Date(a.dateSession).getTime()));
      setTrainersListForFilter(fetchedTrainers.sort((a,b) => a.name.localeCompare(b.name)));
      setAllReferentielsDb(fetchedReferentiels.sort((a,b) => a.nom_complet.localeCompare(b.nom_complet)));
    };
    fetchInitialData();
  }, []);

  const handleSelectReport = (reportType: ReportType) => {
    setActiveReport(reportType);
  };

  const handleViewSessionReport = async (sessionId: string) => {
    const session = await getSessionById(Number(sessionId));
    if (session) {
      setSelectedSession(session);
      setSessionParticipants(session.participants || []);
    }
  };

  const handleBack = () => {
    if (selectedSession) {
      setSelectedSession(null);
      setSessionParticipants([]);
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
      return <ReportDetails session={selectedSession} participants={sessionParticipants} />;
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
                type="date"
                label="Date de début"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-1/4"
              />
              <Input
                type="date"
                label="Date de fin"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-1/4"
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
      case 'referential':
        return <ReferentialReport startDate={startDate} endDate={endDate} referentialMap={referentialCodeMap} />;
      case 'block':
        return <BlockReport startDate={startDate} endDate={endDate} />;
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
        referential: 'Rapports par Référentiel',
        block: 'Rapports par Bloc',
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
          <Button variant="outline" icon={<Download size={16} className="text-rouge-accent" />}>Exporter PDF</Button>
          <Button variant="outline" icon={<Printer size={16} className="text-rouge-accent" />}>Imprimer</Button>
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