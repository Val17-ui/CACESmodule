import React, { useState, useEffect, useMemo } from 'react';
import Layout from '../components/layout/Layout';
import GlobalStats from '../components/reports/GlobalStats';
import ReportTypeSelector, { ReportType } from '../components/reports/ReportTypeSelector';
import ReportsList from '../components/reports/ReportsList';
import ReportDetails from '../components/reports/ReportDetails';
import ParticipantReport from '../components/reports/ParticipantReport';
import PeriodReport from '../components/reports/PeriodReport';
import ReferentialReport from '../components/reports/ReferentialReport';
import BlockReport from '../components/reports/BlockReport';
import CustomReport from '../components/reports/CustomReport';
import Button from '../components/ui/Button';
import { ArrowLeft, Download, Printer, Search } from 'lucide-react';
import { getAllSessions, getSessionById, getAllTrainers } from '../db'; // Ajout de getAllTrainers
import { Session, Participant, CACESReferential, Trainer } from '../types'; // Ajout de Trainer
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
  const [trainerFilter, setTrainerFilter] = useState<string>('all'); // Nouvel état pour le filtre formateur
  const [trainersListForFilter, setTrainersListForFilter] = useState<Trainer[]>([]); // Nouvel état pour la liste des formateurs

  useEffect(() => {
    const fetchInitialData = async () => {
      const allSessions = await getAllSessions();
      setSessions(allSessions.sort((a, b) => new Date(b.dateSession).getTime() - new Date(a.dateSession).getTime()));

      const allTrainers = await getAllTrainers(); // Charger les formateurs
      setTrainersListForFilter(allTrainers.sort((a,b) => a.name.localeCompare(b.name)));
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
        referentialFilter === 'all' || session.referentiel === referentialFilter
      )
      .filter(session =>
        trainerFilter === 'all' || (session.trainerId !== undefined && session.trainerId?.toString() === trainerFilter)
      )
      .filter(session => 
        session.nomSession.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [sessions, searchTerm, referentialFilter, trainerFilter]);

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
                icon={<Search size={16} className="text-gray-400"/>}
              />
              <Select
                value={referentialFilter}
                onChange={(e) => setReferentialFilter(e.target.value)}
                className="w-1/4"
                options={[
                  { value: 'all', label: 'Tous les référentiels' },
                  ...Object.values(CACESReferential).map(ref => ({ value: ref, label: ref }))
                ]}
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
            <ReportsList sessions={filteredSessions} onViewReport={handleViewSessionReport} />
          </div>
        );
      case 'participant':
        return <ParticipantReport />;
      case 'period':
        return <PeriodReport />;
      case 'referential':
        return <ReferentialReport />;
      case 'block':
        return <BlockReport />;
      case 'custom':
        return <CustomReport />;
      default:
        return (
          <>
            <GlobalStats sessions={filteredSessions} />
            <ReportTypeSelector onSelectReport={handleSelectReport} />
          </>
        );
    }
  };

  const getTitle = () => {
    if (selectedSession) return `Rapport: ${selectedSession.nomSession}`;
    if (activeReport) {
      const reportTitles = {
        session: 'Rapports par Session',
        participant: 'Rapports par Participant',
        period: 'Rapports par Période',
        referential: 'Rapports par Référentiel',
        block: 'Rapports par Bloc',
        custom: 'Rapport Personnalisé',
      };
      return reportTitles[activeReport];
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
        <Button variant="outline" icon={<ArrowLeft size={16} />} onClick={handleBack}>
          Retour
        </Button>
      )}
      {selectedSession && (
        <>
          <Button variant="outline" icon={<Download size={16} />}>Exporter PDF</Button>
          <Button variant="outline" icon={<Printer size={16} />}>Imprimer</Button>
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