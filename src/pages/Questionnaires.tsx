import React, { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import QuestionnairesList from '../components/questionnaires/QuestionnairesList';
import QuestionnaireForm from '../components/questionnaires/QuestionnaireForm';
import Button from '../components/ui/Button';
import { Plus, FileUp, FileDown } from 'lucide-react';
// Cache bust comment
import { logger } from '../utils/logger';

import { StorageManager, StoredQuestionnaire } from '../services/StorageManager';

type QuestionnairesProps = {
  activePage: string;
  onPageChange: (page: string) => void;
};

const Questionnaires: React.FC<QuestionnairesProps> = ({
  activePage,
  onPageChange,
}) => {
  const [questionnaires, setQuestionnaires] = useState<StoredQuestionnaire[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchQuestionnaires = async () => {
      try {
        setIsLoading(true);
        const data = await StorageManager.getAllQuestionnaires();
        setQuestionnaires(data);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch questionnaires:", err);
        setError("Impossible de charger les questionnaires.");
        setQuestionnaires([]); // Set to empty array on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuestionnaires();
  }, []);

  const handleCreateNew = () => {
    setIsCreating(true);
    setEditingId(null);
  };

  const handleExportQuestionnaire = async (id: string) => {
    try {
      logger.info(`Attempting to export questionnaire with ID: ${id}`);
      const questionnaire = await StorageManager.getQuestionnaireById(Number(id)); // Corrected method and ensure id is number
      if (!questionnaire) {
        logger.error(`Questionnaire not found for export: ${id}`);
        setError(`Impossible d'exporter: questionnaire non trouvé.`);
        return;
      }

      const questionnaireJson = JSON.stringify(questionnaire, null, 2);
      const blob = new Blob([questionnaireJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Sanitize title for filename - This will be addressed in the name vs title step
      const safeName = questionnaire.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      a.download = `questionnaire_${safeName}_${id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      logger.info(`Questionnaire ${id} exported successfully as ${a.download}`);
    } catch (err) {
      logger.error('Failed to export questionnaire:', { error: err, questionnaireId: id });
      setError("Erreur lors de l'exportation du questionnaire.");
    }
  };

  const handleImportQuestionnaire = () => {
    logger.info('Import questionnaire process started.');
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) {
        logger.warning('No file selected for import.'); // Corrected logger method
        setError('Aucun fichier sélectionné.');
        return;
      }

      logger.info(`File selected for import: ${file.name}`);
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const jsonText = event.target?.result as string;
          const importedData = JSON.parse(jsonText);
          logger.info('File parsed successfully.');

          // Basic validation (can be more thorough)
          if (!importedData.name || !importedData.referential || !Array.isArray(importedData.questions)) { // Check for name
            logger.error('Invalid questionnaire structure.', importedData);
            setError('Fichier de questionnaire invalide ou corrompu.');
            return;
          }

          // Prepare data for saving: remove old ID, createdAt, updatedAt
          const { id, createdAt, updatedAt, ...questionnaireToSave } = importedData as StoredQuestionnaire;

          // Ensure all necessary fields for Omit<StoredQuestionnaire, 'id' | 'createdAt' | 'updatedAt'> are present
          // For example, if StoredQuestionnaire has more fields than just title, referential, questions,
          // ensure they are handled or defaults are provided if not in questionnaireToSave

          await StorageManager.addQuestionnaire(questionnaireToSave);
          logger.info(`Questionnaire "${questionnaireToSave.name}" imported successfully.`); // Use name

          // Refresh list
          const data = await StorageManager.getAllQuestionnaires();
          setQuestionnaires(data);
          setError(null); // Clear any previous error
          // Optionally, display a success message to the user here

        } catch (err) {
          logger.error('Failed to import questionnaire:', { error: err });
          setError("Erreur lors de l'importation du questionnaire. Le fichier est peut-être corrompu ou mal formaté.");
        }
      };
      reader.onerror = () => {
        logger.error('Error reading file for import.');
        setError('Erreur lors de la lecture du fichier.');
      };
      reader.readAsText(file);
    };
    input.click();
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
            onClick={handleImportQuestionnaire} // Wire up the import button
          >
            Importer
          </Button>
          <Button
            variant="outline"
            icon={<FileDown size={16} />} // This button might be for "export all" or batch, can be kept or removed
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
        isLoading ? (
          <p>Chargement des questionnaires...</p>
        ) : error ? (
          <p>{error}</p>
        ) : (
          <QuestionnairesList
            questionnaires={questionnaires}
            onEditQuestionnaire={handleEditQuestionnaire}
            onExportQuestionnaire={handleExportQuestionnaire} // Pass the handler
          />
        )
      ) : (
        // Render the new QuestionnaireForm. It does not take props like editingId, onFormSubmit, onBackToList yet.
        // The onBackToList for the parent page's "Retour à la liste" button will still work.
        // We will later integrate props and handlers into the new form.
        <QuestionnaireForm />
      )}
    </Layout>
  );
};

export default Questionnaires;