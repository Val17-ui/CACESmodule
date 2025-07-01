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
import { getAllSessions, getSessionById, getResultsForSession } from '../db';
import { Session, Participant, CACESReferential } from '../types';
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

  useEffect(() => {
    const fetchSessions = async () => {
      const allSessions = await getAllSessions();
      setSessions(allSessions);
    };
    fetchSessions();
  }, []);

  const handleSelectReport = (reportType: ReportType) => {
    setActiveReport(reportType);
  };

  const handleViewSessionReport = async (sessionId: string) => {
    const session = await getSessionById(Number(sessionId));
    if (session) {
      setSelectedSession(session);
      const results = await getResultsForSession(Number(sessionId));
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
        session.nomSession.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [sessions, searchTerm, referentialFilter]);

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
                className="w-1/3"
                icon={<Search size={16} className="text-gray-400"/>}
              />
              <Select
                value={referentialFilter}
                onChange={(e) => setReferentialFilter(e.target.value)}
                className="w-1/4"
              >
                <option value="all">Tous les référentiels</option>
                {Object.values(CACESReferential).map(ref => (
                  <option key={ref} value={ref}>{ref}</option>
                ))}
              </Select>
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
    </Layout
  );
};

export default Reports;