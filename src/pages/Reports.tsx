import React, { useState } from 'react';
import Layout from '../components/layout/Layout';
import ReportsList from '../components/reports/ReportsList';
import ReportDetails from '../components/reports/ReportDetails';
import Button from '../components/ui/Button';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import { mockSessions, mockParticipants } from '../data/mockData';

type ReportsProps = {
  activePage: string;
  onPageChange: (page: string) => void;
};

const Reports: React.FC<ReportsProps> = ({ activePage, onPageChange }) => {
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const handleViewReport = (id: string) => {
    setSelectedReportId(id);
  };

  const handleBackToList = () => {
    setSelectedReportId(null);
  };

  const selectedSession = selectedReportId
    ? mockSessions.find((s) => s.id === selectedReportId)
    : null;

  const headerActions = (
    <div className="flex items-center space-x-3">
      {selectedReportId && (
        <>
          <Button
            variant="outline"
            icon={<ArrowLeft size={16} />}
            onClick={handleBackToList}
          >
            Retour à la liste
          </Button>
          <Button
            variant="outline"
            icon={<Download size={16} />}
          >
            Exporter PDF
          </Button>
          <Button
            variant="outline"
            icon={<Printer size={16} />}
          >
            Imprimer
          </Button>
        </>
      )}
    </div>
  );

  const title = selectedReportId
    ? `Rapport de session: ${selectedSession?.name}`
    : "Rapports";

  const subtitle = selectedReportId
    ? `Résultats détaillés et analyses pour la session du ${
        new Date(selectedSession?.date || '').toLocaleDateString('fr-FR')
      }`
    : "Consultez et générez les rapports de certification";

  return (
    <Layout
      title={title}
      subtitle={subtitle}
      actions={headerActions}
      activePage={activePage}
      onPageChange={onPageChange}
    >
      {!selectedReportId ? (
        <ReportsList 
          sessions={mockSessions}
          onViewReport={handleViewReport}
        />
      ) : (
        selectedSession && (
          <ReportDetails 
            session={selectedSession}
            participants={mockParticipants}
          />
        )
      )}
    </Layout>
  );
};

export default Reports;