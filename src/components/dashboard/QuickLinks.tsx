import React from 'react';
import { Plus, Upload, FileText } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Session } from '@common/types';
import { useSessionStore } from '../../stores/sessionStore';

type QuickLinksProps = {
  onPageChange: (page: string, sessionId?: number) => void;
  sessions: Session[];
};

const QuickLinks: React.FC<QuickLinksProps> = ({ onPageChange, sessions }) => {
  const { startCreating, startImporting } = useSessionStore();

  const handleNewSession = () => {
    startCreating();
    onPageChange('sessions');
  };

  const handleImportSession = async () => {
    if (window.dbAPI) {
      const result = await window.dbAPI.openExcelFileDialog();
      if (!result.canceled && result.fileBuffer) {
        const blob = new Blob([Buffer.from(result.fileBuffer, 'base64')], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const file = new File([blob], result.fileName!, { type: blob.type });
        startImporting(file);
        onPageChange('sessions');
      }
    }
  };

  const handleOpenReport = (sessionId: number) => {
    onPageChange('reports', sessionId);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const completedTodaySessions = sessions.filter(s => {
    const sessionDate = new Date(s.dateSession);
    sessionDate.setHours(0, 0, 0, 0);
    return s.status === 'completed' && sessionDate.getTime() === today.getTime();
  }).sort((a, b) => new Date(b.resultsImportedAt!).getTime() - new Date(a.resultsImportedAt!).getTime());

  const latestReportSession = completedTodaySessions.length > 0 ? completedTodaySessions[0] : null;

  return (
    <Card>
      <h3 className="text-lg font-medium text-texte-principal mb-4">Liens rapides</h3>
      <div className="space-y-2">
        <Button variant="outline" onClick={handleNewSession} className="w-full justify-start">
          <Plus size={16} className="mr-2" />
          Nouvelle session
        </Button>
        <Button variant="outline" onClick={handleImportSession} className="w-full justify-start">
          <Upload size={16} className="mr-2" />
          Importer une session
        </Button>
        {latestReportSession && (
          <Button
            variant="outline"
            onClick={() => handleOpenReport(latestReportSession.id!)}
            className="w-full justify-start"
          >
            <FileText size={16} className="mr-2" />
            Rapport: {latestReportSession.nomSession}
          </Button>
        )}
      </div>
    </Card>
  );
};

export default QuickLinks;
