import React, { useState } from 'react';
import Layout from '../components/layout/Layout';
import QuestionLibrary from '../components/library/QuestionLibrary';
import QuestionForm from '../components/library/QuestionForm';
import QuestionStatistics from '../components/library/QuestionStatistics';
import Button from '../components/ui/Button';
import { Plus, FileUp, FileDown, BarChart3 } from 'lucide-react';

type LibraryProps = {
  activePage: string;
  onPageChange: (page: string) => void;
};

const Library: React.FC<LibraryProps> = ({ activePage, onPageChange }) => {
  const [activeView, setActiveView] = useState<'library' | 'form' | 'statistics'>('library');
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  const handleCreateNew = () => {
    setActiveView('form');
    setEditingQuestionId(null);
  };

  const handleEditQuestion = (id: string) => {
    setActiveView('form');
    setEditingQuestionId(id);
  };

  const handleViewStatistics = () => {
    setActiveView('statistics');
  };

  const handleBackToLibrary = () => {
    setActiveView('library');
    setEditingQuestionId(null);
  };

  const getHeaderActions = () => {
    switch (activeView) {
      case 'library':
        return (
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              icon={<FileUp size={16} />}
            >
              Importer CSV
            </Button>
            <Button
              variant="outline"
              icon={<FileDown size={16} />}
            >
              Exporter CSV
            </Button>
            <Button
              variant="outline"
              icon={<BarChart3 size={16} />}
              onClick={handleViewStatistics}
            >
              Statistiques
            </Button>
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={handleCreateNew}
            >
              Nouvelle question
            </Button>
          </div>
        );
      case 'form':
      case 'statistics':
        return (
          <Button
            variant="outline"
            onClick={handleBackToLibrary}
          >
            Retour à la bibliothèque
          </Button>
        );
      default:
        return null;
    }
  };

  const getTitle = () => {
    switch (activeView) {
      case 'form':
        return editingQuestionId ? 'Modifier une question' : 'Créer une question';
      case 'statistics':
        return 'Statistiques des questions';
      default:
        return 'Bibliothèque de questions';
    }
  };

  const getSubtitle = () => {
    switch (activeView) {
      case 'form':
        return editingQuestionId 
          ? 'Modifiez les paramètres et le contenu de la question'
          : 'Créez une nouvelle question pour la bibliothèque CACES';
      case 'statistics':
        return 'Analysez l\'utilisation et les performances des questions';
      default:
        return 'Gérez votre bibliothèque de questions CACES par recommandation';
    }
  };

  const renderContent = () => {
    switch (activeView) {
      case 'form':
        return <QuestionForm questionId={editingQuestionId} onSave={handleBackToLibrary} />;
      case 'statistics':
        return <QuestionStatistics />;
      default:
        return <QuestionLibrary onEditQuestion={handleEditQuestion} />;
    }
  };

  return (
    <Layout
      title={getTitle()}
      subtitle={getSubtitle()}
      actions={getHeaderActions()}
      activePage={activePage}
      onPageChange={onPageChange}
    >
      {renderContent()}
    </Layout>
  );
};

export default Library;