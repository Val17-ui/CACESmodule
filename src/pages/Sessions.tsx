import React, { useState } from 'react';
import Layout from '../components/layout/Layout';
import SessionsList from '../components/sessions/SessionsList';
import SessionForm from '../components/sessions/SessionForm';
import Button from '../components/ui/Button';
import { Plus } from 'lucide-react';
import { mockSessions } from '../data/mockData';

type SessionsProps = {
  activePage: string;
  onPageChange: (page: string) => void;
};

const Sessions: React.FC<SessionsProps> = ({ activePage, onPageChange }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [managingSessionId, setManagingSessionId] = useState<string | null>(null);

  const handleCreateNew = () => {
    setIsCreating(true);
    setManagingSessionId(null);
  };

  const handleManageSession = (id: string) => {
    setManagingSessionId(id);
    setIsCreating(false);
  };

  const handleStartExam = (id: string) => {
    // Navigate to exam mode with this session
    onPageChange('exams');
  };

  const handleBackToList = () => {
    setIsCreating(false);
    setManagingSessionId(null);
  };

  const headerActions = (
    <div className="flex items-center space-x-3">
      {!isCreating && !managingSessionId && (
        <Button
          variant="primary"
          icon={<Plus size={16} />}
          onClick={handleCreateNew}
        >
          Nouvelle session
        </Button>
      )}
      {(isCreating || managingSessionId) && (
        <Button
          variant="outline"
          onClick={handleBackToList}
        >
          Retour à la liste
        </Button>
      )}
    </div>
  );

  const title = isCreating
    ? "Créer une session"
    : managingSessionId
    ? "Gestion des participants"
    : "Sessions";

  const subtitle = isCreating
    ? "Créez une nouvelle session de certification CACES"
    : managingSessionId
    ? "Gérez les participants et l'émargement"
    : "Gérez vos sessions de certification CACES";

  return (
    <Layout
      title={title}
      subtitle={subtitle}
      actions={headerActions}
      activePage={activePage}
      onPageChange={onPageChange}
    >
      {!isCreating && !managingSessionId ? (
        <SessionsList
          sessions={mockSessions}
          onManageSession={handleManageSession}
          onStartExam={handleStartExam}
        />
      ) : (
        <SessionForm />
      )}
    </Layout>
  );
};

export default Sessions;