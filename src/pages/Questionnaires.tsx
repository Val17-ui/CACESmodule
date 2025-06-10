import React, { useState } from 'react';
import Layout from '../components/layout/Layout';
import QuestionnairesList from '../components/questionnaires/QuestionnairesList';
import QuestionnaireForm from '../components/questionnaires/QuestionnaireForm';
import Button from '../components/ui/Button';
import { Plus, FileUp, FileDown } from 'lucide-react';
import { mockQuestionnaires } from '../data/mockData';

type QuestionnairesProps = {
  activePage: string;
  onPageChange: (page: string) => void;
};

const Questionnaires: React.FC<QuestionnairesProps> = ({
  activePage,
  onPageChange,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleCreateNew = () => {
    setIsCreating(true);
    setEditingId(null);
  };

  const handleEditQuestionnaire = (id: string) => {
    setIsCreating(false);
    setEditingId(id);
  };

  const handleBackToList = () => {
    setIsCreating(false);
    setEditingId(null);
  };

  const headerActions = (
    <div className="flex items-center space-x-3">
      {!isCreating && !editingId && (
        <>
          <Button
            variant="outline"
            icon={<FileUp size={16} />}
          >
            Importer
          </Button>
          <Button
            variant="outline"
            icon={<FileDown size={16} />}
          >
            Exporter
          </Button>
          <Button
            variant="primary"
            icon={<Plus size={16} />}
            onClick={handleCreateNew}
          >
            Nouveau questionnaire
          </Button>
        </>
      )}
      {(isCreating || editingId) && (
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
    ? "Créer un questionnaire"
    : editingId
    ? "Modifier un questionnaire"
    : "Questionnaires";

  const subtitle = isCreating
    ? "Créez un nouveau questionnaire CACES"
    : editingId
    ? "Modifier les paramètres et questions"
    : "Gérez vos questionnaires d'examen CACES";

  return (
    <Layout
      title={title}
      subtitle={subtitle}
      actions={headerActions}
      activePage={activePage}
      onPageChange={onPageChange}
    >
      {!isCreating && !editingId ? (
        <QuestionnairesList
          questionnaires={mockQuestionnaires}
          onEditQuestionnaire={handleEditQuestionnaire}
        />
      ) : (
        <QuestionnaireForm />
      )}
    </Layout>
  );
};

export default Questionnaires;