import React, { useState } from 'react';
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
import { ArrowLeft, Download, Printer } from 'lucide-react';
import { mockSessions, mockParticipants } from '../data/mockData';

type ReportsProps = {
  activePage: string;
  onPageChange: (page: string) => void;
};

const Reports: React.FC<ReportsProps> = ({ activePage, onPageChange }) => {
  const [activeReport, setActiveReport] = useState<ReportType | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const handleSelectReport = (reportType: ReportType) => {
    setActiveReport(reportType);
  };

  const handleViewSessionReport = (sessionId: string) => {
    setSelectedSessionId(sessionId);
  };

  const handleBack = () => {
    if (selectedSessionId) {
      setSelectedSessionId(null);
    } else {
      setActiveReport(null);
    }
  };

  const selectedSession = selectedSessionId
    ? mockSessions.find((s) => s.id != null && String(s.id) === selectedSessionId)
    : null;

  const renderContent = () => {
    if (selectedSession) {
      return <ReportDetails session={selectedSession} participants={mockParticipants} />;
    }

    switch (activeReport) {
      case 'session':
        return <ReportsList sessions={mockSessions} onViewReport={handleViewSessionReport} />;
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
            <GlobalStats />
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