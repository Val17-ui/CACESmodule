import React from 'react';
import { Plus, Upload, FileText, Settings } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Session } from '@common/types';

type QuickLinksProps = {
  onPageChange: (page: string, sessionId?: number) => void;
  sessions: Session[];
};

const QuickLinks: React.FC<QuickLinksProps> = ({ onPageChange, sessions }) => {
  const handleNewSession = () => {
    // This should trigger the same logic as the "Nouvelle session" button in the Sessions page
    onPageChange('sessions');
    // The Sessions page should handle the creation state.
    // We might need to pass a specific state to onPageChange if not.
    // For now, just navigating to the sessions page seems reasonable.
    // A more specific implementation might be onPageChange('sessions', { action: 'new' })
  };

  const handleImportSession = () => {
    // This should trigger the same logic as the "Importer une session" button in the Sessions page
    onPageChange('sessions');
    // Similar to new session, the Sessions page should handle the import trigger.
  };

  const handleOpenReport = (sessionId: number) => {
    onPageChange('reports', sessionId);
  };

  const handleGoToSettings = () => {
    onPageChange('settings');
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const completedTodaySessions = sessions.filter(s => {
    const sessionDate = new Date(s.dateSession);
    sessionDate.setHours(0, 0, 0, 0);
    return s.status === 'completed' && sessionDate.getTime() === today.getTime();
  });

  return (
    <Card className="mb-6">
      <h3 className="text-lg font-medium text-texte-principal mb-4">Liens rapides</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Button variant="outline" onClick={() => onPageChange('sessions', undefined)}>
          <Plus size={16} className="mr-2" />
          Nouvelle session
        </Button>
        <Button variant="outline" onClick={() => onPageChange('sessions', undefined)}>
          <Upload size={16} className="mr-2" />
          Importer une session
        </Button>
        <Button variant="outline" onClick={handleGoToSettings}>
          <Settings size={16} className="mr-2" />
          Paramètres
        </Button>

        {completedTodaySessions.map(session => (
          <Button
            key={session.id}
            variant="outline"
            onClick={() => handleOpenReport(session.id!)}
          >
            <FileText size={16} className="mr-2" />
            Rapport: {session.nomSession}
          </Button>
        ))}
      </div>
    </Card>
  );
};

export default QuickLinks;
