import React, { useState, useEffect } from 'react';
import { StoredQuestion } from '../../types'; // Question, CACESReferential, QuestionTheme are not directly used here
import { StorageManager } from '../../services/StorageManager';
import { logger } from '../../utils/logger';
import Button from '../ui/Button';
import Checkbox from '../ui/Checkbox';

interface QuestionLibraryProps {
  isSelectionMode?: boolean;
  onQuestionsSelected?: (selectedIds: string[]) => void;
  // Future props: filters, pagination callbacks, etc.
}

const QuestionLibrary: React.FC<QuestionLibraryProps> = ({
  isSelectionMode = false,
  onQuestionsSelected,
}) => {
  const [questions, setQuestions] = useState<StoredQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchQuestions = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const allQuestions = await StorageManager.getAllQuestions();
        if (allQuestions && allQuestions.length > 0) {
          // Ensure all question IDs are strings for consistency within this component's selection logic
          const questionsWithStringIds = allQuestions.map(q => ({ ...q, id: String(q.id) }));
          setQuestions(questionsWithStringIds);
        } else if (allQuestions) { // It's an empty array
          setQuestions([]); // Set to empty array, no error
          logger.info("No questions found in the library.");
        }
        // If allQuestions is null or undefined (though StorageManager.getAllQuestions() is expected to return StoredQuestion[]),
        // it would ideally be handled by an error or empty state.
        // The current structure will lead to an error caught by the catch block if getAllQuestions is not a function.
      } catch (err) {
        logger.error('Failed to fetch questions from library', { error: err });
        setError('Impossible de charger les questions de la bibliothèque.');
        setQuestions([]); // Clear questions on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuestions();
  }, []);

  const handleToggleSelection = (questionId: string) => {
    if (!isSelectionMode) return;

    setSelectedQuestionIds(prevSelectedIds => {
      const newSelectedIds = new Set(prevSelectedIds);
      if (newSelectedIds.has(questionId)) {
        newSelectedIds.delete(questionId);
      } else {
        newSelectedIds.add(questionId);
      }
      return newSelectedIds;
    });
  };

  const handleConfirmSelection = () => {
    if (onQuestionsSelected) {
      onQuestionsSelected(Array.from(selectedQuestionIds));
    }
    setSelectedQuestionIds(new Set()); // Clear selection after confirming
  };

  if (isLoading) {
    return <div className="text-center p-4">Chargement des questions...</div>;
  }

  if (error) {
    return <div className="p-4 my-4 text-sm text-red-700 bg-red-100 rounded-lg" role="alert">{error}</div>;
  }

  if (questions.length === 0) {
    return <div className="text-center p-4 text-gray-500">Aucune question disponible dans la bibliothèque.</div>;
  }

  return (
    <div className="space-y-4">
      {/* TODO: Add filtering UI here */}
      <div className="max-h-96 overflow-y-auto border rounded-md">
        <ul className="divide-y divide-gray-200">
          {questions.map((q) => (
            <li key={q.id} className={`p-4 ${isSelectionMode ? 'hover:bg-gray-50 cursor-pointer' : ''}`} onClick={() => isSelectionMode && handleToggleSelection(String(q.id))}>
              <div className="flex items-start space-x-3">
                {isSelectionMode && (
                  <Checkbox
                    // Ensure id prop for Checkbox is unique and valid, question IDs can be numbers from DB
                    id={`select-question-${q.id}`}
                    checked={selectedQuestionIds.has(String(q.id))}
                    onChange={() => handleToggleSelection(String(q.id))}
                    aria-label={`Sélectionner la question: ${q.text}`}
                  />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{q.text}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Thème: {q.theme} | Réf: {q.referential} {q.isEliminatory ? '| Éliminatoire' : ''} | Type: {q.type} {q.id}
                  </p>
                  {/* Displaying q.id for debugging during development, can be removed later */}
                  {/* <p className="text-xs text-gray-400">ID: {q.id}</p> */}
                </div>
                {!isSelectionMode && (
                  <div className="flex space-x-2">
                    {/* Placeholder for future actions */}
                    <Button size="sm" variant="outline" disabled>Modifier</Button>
                    <Button size="sm" variant="ghost" disabled className="text-red-600 hover:text-red-700">Supprimer</Button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
      {isSelectionMode && (
        <div className="mt-6 flex justify-end">
          <Button
            variant="primary"
            onClick={handleConfirmSelection}
            disabled={selectedQuestionIds.size === 0}
          >
            Ajouter les {selectedQuestionIds.size} questions sélectionnées
          </Button>
        </div>
      )}
    </div>
  );
};

export default QuestionLibrary;
