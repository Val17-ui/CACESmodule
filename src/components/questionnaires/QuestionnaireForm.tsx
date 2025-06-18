import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, AlertTriangle } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import ThemeSelector from './ThemeSelector';
import PPTXGenerator from './PPTXGenerator';
import QuestionLibrary from './QuestionLibrary'; // Import QuestionLibrary
import { ReferentialType, referentials, QuestionTheme, questionThemes, referentialLimits, Question, QuestionType, CACESReferential, Questionnaire, StoredQuestion } from '../../types';
import { logger } from '../../utils/logger';
import { StorageManager, StoredQuestionnaire } from '../../services/StorageManager';

interface QuestionnaireFormProps {
  editingId?: string | null;
  onFormSubmit?: (success: boolean) => void;
  onBackToList?: () => void;
}

const QuestionnaireForm: React.FC<QuestionnaireFormProps> = ({
  editingId,
  onFormSubmit,
  onBackToList,
}) => {
  const [questionnaireName, setQuestionnaireName] = useState('');
  const [selectedReferential, setSelectedReferential] = useState<string>('');
  const [totalQuestions, setTotalQuestions] = useState(40);
  const [passingThreshold, setPassingThreshold] = useState(70);
  const [showValidationWarning, setShowValidationWarning] = useState(false);
  const [isRandomized, setIsRandomized] = useState(false);
  const [eliminatoryCount, setEliminatoryCount] = useState(3);
  const [themeDistribution, setThemeDistribution] = useState<Record<QuestionTheme, number>>({
    reglementation: 15,
    securite: 15,
    technique: 10,
  });
  const [manualQuestions, setManualQuestions] = useState<Question[]>([]);
  const [showAddManualQuestionForm, setShowAddManualQuestionForm] = useState(false);
  const [newManualQuestion, setNewManualQuestion] = useState<Partial<Question>>({
    text: '',
    type: QuestionType.QCM,
    options: ['', '', '', ''],
    correctAnswer: '',
    theme: undefined,
    referential: selectedReferential as CACESReferential || undefined, // Initialize with parent form's referential
    isEliminatory: false,
  });
  const [isQuestionLibModalOpen, setIsQuestionLibModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  // Handler for when questions are selected from the library
  const handleSelectQuestionsFromLib = async (selectedIds: string[]) => {
    if (selectedIds.length === 0) {
      setIsQuestionLibModalOpen(false);
      return;
    }
    setIsLoading(true); // Optional: show loading state on main form
    try {
      const newQuestions: Question[] = [];
      const existingManualQuestionIds = new Set(manualQuestions.map(q => q.id));

      for (const idStr of selectedIds) {
        // Filter out non-numeric IDs (e.g., "custom-xxxx") before fetching
        // and ensure we only process IDs that came from the database via QuestionLibrary.
        // The QuestionLibrary now sends stringified numeric IDs.
        if (!/^\d+$/.test(idStr)) {
          logger.warn(`Skipping non-numeric ID from selection: ${idStr}`);
          continue;
        }

        const numericId = Number(idStr);

        // Check if this DB ID (now as string) is already in manualQuestions
        // This check is important if a DB question was somehow added manually before
        // or if the same question is selected multiple times in one go (though Set in QuestionLibrary should prevent latter for a single selection batch)
        if (existingManualQuestionIds.has(idStr)) {
          logger.info(`Question with DB ID ${idStr} already in manualQuestions. Skipping.`);
          continue;
        }

        const questionFromStore: StoredQuestion | null = await StorageManager.getQuestionById(numericId);

        if (questionFromStore) {
          // Convert StoredQuestion (with id: number) to Question (with id: string)
          const questionToAdd: Question = {
            ...questionFromStore,
            id: String(questionFromStore.id), // Convert numeric ID back to string for consistency
            // Ensure any specific fields for 'Question' not in 'StoredQuestion' are added, or defaults used
            // e.g. usageCount and correctResponseRate might not be on StoredQuestion but are on Question
            // However, looking at StoredQuestion and Question types, they seem very aligned.
            // If StoredQuestion has all Question fields (except id type), this spread is fine.
            // Let's ensure all defined fields in Question are covered:
            text: questionFromStore.text,
            type: questionFromStore.type,
            options: questionFromStore.options,
            correctAnswer: questionFromStore.correctAnswer,
            theme: questionFromStore.theme,
            referential: questionFromStore.referential,
            isEliminatory: questionFromStore.isEliminatory,
            // Fields specific to Question type that might not be on StoredQuestion
            // or need defaulting if not from library question.
            // For library questions, these should come from questionFromStore:
            usageCount: questionFromStore.usageCount !== undefined ? questionFromStore.usageCount : 0,
            correctResponseRate: questionFromStore.correctResponseRate !== undefined ? questionFromStore.correctResponseRate : 0,
            createdAt: questionFromStore.createdAt || new Date().toISOString(), // Should exist on StoredQuestion
            updatedAt: questionFromStore.updatedAt || new Date().toISOString(), // Should exist on StoredQuestion
            lastUsedAt: questionFromStore.lastUsedAt, // Optional field
          };
          newQuestions.push(questionToAdd);
        } else {
          logger.warn(`Question with ID ${numericId} (string: ${idStr}) not found in storage.`);
        }
      }
      setManualQuestions(prev => [...prev, ...newQuestions].filter((q, index, self) =>
        index === self.findIndex((t) => t.id === q.id)
      )); // Additional safeguard for uniqueness, though prior checks should handle most.
      setError(null); // Clear any previous error
    } catch (err) {
      logger.error('Failed to fetch selected questions from library', err);
      setError('Erreur lors de l’ajout des questions sélectionnées.');
    } finally {
      setIsQuestionLibModalOpen(false);
      setIsLoading(false); // Clear loading state
    }
  };

  useEffect(() => {
    if (editingId) {
      loadQuestionnaire(editingId);
    }
  }, [editingId]);

  // Effect to handle changes when switching between Automatic and Manual mode
  useEffect(() => {
    if (!isRandomized) {
      // Switched to Manual Mode
      setTotalQuestions(manualQuestions.length);
      setEliminatoryCount(manualQuestions.filter(q => q.isEliminatory).length);
      // ThemeDistribution is not used in manual mode, can be left as is or cleared.
      // For now, we'll leave it as is, as ThemeSelector is hidden.
    } else {
      // Switched to Automatic Mode
      // Values for totalQuestions and eliminatoryCount are managed by their respective
      // input handlers or when loading a questionnaire.
      // We might want to restore previous automatic values if we stored them,
      // or reset to defaults if that's the desired behavior.
      // For now, we assume existing logic handles this.
      // Example: Reset to some default if not loaded from an existing questionnaire
      // if (!editingId) { // Only reset if it's a new form
      //   setTotalQuestions(40); // Default total questions
      //   setEliminatoryCount(3);  // Default eliminatory count
      //   setThemeDistribution({ reglementation: 15, securite: 15, technique: 10 }); // Default theme distribution
      // }
    }
  }, [isRandomized, manualQuestions]);

  const loadQuestionnaire = async (id: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const questionnaire = await StorageManager.getQuestionnaireById(Number(id));
      if (questionnaire) {
        logger.info("Loading questionnaire for editing:", questionnaire);
        setQuestionnaireName(questionnaire.name);
        setSelectedReferential(questionnaire.referential as string);
        setIsRandomized(questionnaire.isRandomized);
        setPassingThreshold(questionnaire.passingThreshold || 70);

        if (questionnaire.isRandomized) {
          setThemeDistribution(questionnaire.themeDistribution || { reglementation: 15, securite: 15, technique: 10 });
          setTotalQuestions(questionnaire.totalQuestions || 40);
          setEliminatoryCount(questionnaire.eliminatoryCount || 3);
          setManualQuestions([]); // Clear manual questions if switching to randomized
        } else {
          // Manual mode
          // Actual questions will need to be fetched using questionnaire.questionIds
          // For now, we assume manualQuestions will be populated by a subsequent fetch if needed.
          // The useEffect hook [isRandomized, manualQuestions] will update totalQuestions and eliminatoryCount.
          logger.info("Manual mode: Questionnaire uses questionIds. Actual questions need to be fetched or are already loaded.", questionnaire.questionIds);
          // If manualQuestions are loaded elsewhere, total and eliminatory counts will be set by the useEffect.
          // If not, and we only have IDs, we can set totalQuestions based on IDs length.
          // However, eliminatoryCount cannot be determined without full question objects.
          if (questionnaire.definedQuestions && questionnaire.definedQuestions.length > 0) {
            const loadedManualQuestions: Question[] = questionnaire.definedQuestions.map(dbQuestion => ({
              ...dbQuestion, // Spread all fields from QuestionWithId (DB version)
              id: String(dbQuestion.id), // Convert numeric ID from DB to string for form state
              // Ensure all Question type fields are present; StoredQuestion/QuestionWithId should be similar to Question
              // Defaulting fields if they are somehow missing from dbQuestion but required by Question type
              usageCount: dbQuestion.usageCount !== undefined ? dbQuestion.usageCount : 0,
              correctResponseRate: dbQuestion.correctResponseRate !== undefined ? dbQuestion.correctResponseRate : 0,
              createdAt: dbQuestion.createdAt || new Date().toISOString(),
              updatedAt: dbQuestion.updatedAt || new Date().toISOString(),
              // lastUsedAt is optional in Question, so it's fine if not present on dbQuestion
            }));
            setManualQuestions(loadedManualQuestions);
          } else {
            setManualQuestions([]);
          }
          // totalQuestions and eliminatoryCount will be set by the useEffect based on manualQuestions.
          setThemeDistribution({ reglementation: 0, securite: 0, technique: 0 }); // Clear theme distribution for manual
        }
      } else {
        logger.error(`Questionnaire with ID ${id} not found for editing.`);
        setError("Questionnaire non trouvé.");
      }
    } catch (err) {
      logger.error('Failed to load questionnaire', { error: err, questionnaireId: id });
      setError('Impossible de charger le questionnaire');
    } finally {
      setIsLoading(false);
    }
  };

  const referentialOptions = Object.entries(referentials).map(([value, label]) => ({
    value,
    label: `${value} - ${label}`,
  }));

  const handleReferentialChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    // Note: If Select passes value directly, update to: (value: string) => { const referential = value as ReferentialType; ... }
    const referential = e.target.value as ReferentialType;
    setSelectedReferential(referential);
    logger.info(`Référentiel sélectionné: ${referential}`);

    if (referential && referentialLimits[referential]) {
      const defaultTotal = Math.min(40, referentialLimits[referential].max);
      setTotalQuestions(defaultTotal);
    }

    setShowValidationWarning(referential === 'R482');
  };

  const handleTotalQuestionsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    setTotalQuestions(value);

    if (selectedReferential && referentialLimits[selectedReferential as ReferentialType]) {
      const limits = referentialLimits[selectedReferential as ReferentialType];
      if (value < limits.min || value > limits.max) {
        logger.warning(`Nombre de questions hors limites pour ${selectedReferential}: ${limits.min}-${limits.max}`);
      }
    }
  };

  const handleThemeDistributionChange = (theme: QuestionTheme, count: number) => {
    setThemeDistribution(prev => ({
      ...prev,
      [theme]: count,
    }));
  };

  const handleRandomizeToggle = () => {
    const newIsRandomized = !isRandomized;
    setIsRandomized(newIsRandomized);
    logger.info(`Mode aléatoire ${newIsRandomized ? 'activé' : 'désactivé'}`);
    // The useEffect hook for [isRandomized, manualQuestions] will handle updating
    // totalQuestions and eliminatoryCount based on the new mode.
  };

  const handleNewManualQuestionChange = (field: keyof Question, value: any) => {
    setNewManualQuestion(prev => ({ ...prev, [field]: value }));
  };

  const handleOptionChange = (index: number, value: string) => {
    const updatedOptions = [...(newManualQuestion.options || [])];
    updatedOptions[index] = value;
    setNewManualQuestion(prev => ({ ...prev, options: updatedOptions }));
  };

  const handleAddOption = () => {
    setNewManualQuestion(prev => ({ ...prev, options: [...(prev.options || []), ''] }));
  };

  const handleRemoveOption = (index: number) => {
    setNewManualQuestion(prev => ({ ...prev, options: prev.options?.filter((_, i) => i !== index) }));
  };

  const handleSaveNewManualQuestion = () => {
    const { text, type, options, correctAnswer, theme, referential: questionReferential } = newManualQuestion;

    if (!text?.trim() || !theme || !questionReferential) {
      logger.error("Validation failed for new manual question: text, theme, or referential missing.");
      setError("Veuillez remplir le texte, le thème et le référentiel de la question.");
      return;
    }

    if (type === QuestionType.QCM || type === QuestionType.QCU) {
      if (!options || options.length === 0 || options.some(opt => opt.trim() === '')) {
        logger.error("Validation failed: Options cannot be empty for QCM/QCU.");
        setError("Pour les questions QCM/QCU, veuillez fournir toutes les options de réponse non vides.");
        return;
      }
      if (!correctAnswer?.trim()) {
        logger.error("Validation failed: Correct answer is required for QCM/QCU.");
        setError("Pour les questions QCM/QCU, la bonne réponse est requise.");
        return;
      }
      // Optional: Check if correctAnswer is one of the options if it's index-based or exact match
    }


    const questionToAdd: Question = {
      id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      text: newManualQuestion.text,
      type: newManualQuestion.type || QuestionType.QCM,
      options: newManualQuestion.options?.filter(opt => opt.trim() !== '') || [],
      correctAnswer: newManualQuestion.correctAnswer || '',
      theme: newManualQuestion.theme as QuestionTheme,
      referential: questionReferential as CACESReferential,
      isEliminatory: newManualQuestion.isEliminatory || false,
      usageCount: 0,
      correctResponseRate: 0,
      createdAt: new Date().toISOString(),
    };

    setManualQuestions(prev => [...prev, questionToAdd]);
    setNewManualQuestion({
      text: '',
      type: QuestionType.QCM,
      options: ['', '', '', ''],
      correctAnswer: '',
      theme: undefined,
      referential: selectedReferential as CACESReferential || undefined, // Reset with main form's referential
      isEliminatory: false,
    });
    setShowAddManualQuestionForm(false);
    setError(null);
    logger.info("New manual question added", questionToAdd);
  };

  const handleDeleteManualQuestion = (id: string) => {
    setManualQuestions(prev => prev.filter(q => q.id !== id));
    logger.info(`Manual question deleted: ${id}`);
  };

  const getLimitsWarning = () => {
    if (!selectedReferential || !referentialLimits[selectedReferential as ReferentialType]) {
      return null;
    }
    const limits = referentialLimits[selectedReferential as ReferentialType];
    if (isRandomized && (totalQuestions < limits.min || totalQuestions > limits.max)) {
      return (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
          <AlertTriangle size={20} className="text-red-500 mr-2 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Nombre de questions hors limites</p>
            <p className="text-sm text-red-700 mt-1">
              Pour le référentiel {selectedReferential}, le nombre de questions doit être entre {limits.min} et {limits.max}.
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const canShowManualPPTXGenerator = !isRandomized &&
                                    manualQuestions.length > 0 &&
                                    questionnaireName.trim() !== '' &&
                                    selectedReferential !== '';

  const handleSave = async () => {
    if (!questionnaireName.trim()) {
      logger.error("Validation failed: Questionnaire name is required.");
      setError("Le nom du questionnaire est requis.");
      return;
    }
    if (!selectedReferential) {
      logger.error("Validation failed: Referential is required.");
      setError("Le référentiel est requis.");
      return;
    }
    if (!isRandomized && manualQuestions.length === 0) {
      logger.error("Validation failed: Manual mode requires at least one question.");
      setError("Ajoutez au moins une question en mode manuel.");
      return;
    }
    const now = new Date().toISOString();
    let questionnaireDataToSave: Omit<StoredQuestionnaire, 'id'>;

    setIsLoading(true);
    setError(null);

    try {
      if (isRandomized) {
        questionnaireDataToSave = {
          name: questionnaireName,
          referential: selectedReferential as CACESReferential,
          isRandomized: true,
          passingThreshold: passingThreshold,
          themeDistribution: themeDistribution,
          totalQuestions: totalQuestions,
          eliminatoryCount: eliminatoryCount,
          questionIds: [], // No specific question IDs for automatic template
          definedQuestions: [], // No defined questions for automatic template
          createdAt: now,
          updatedAt: now,
        };
      } else {
        // Manual mode:
        // 1. Save any new custom questions from manualQuestions to the main questions table
        const processedManualQuestions = [...manualQuestions]; // Clone to modify IDs after saving

        for (let i = 0; i < processedManualQuestions.length; i++) {
          const question = processedManualQuestions[i];
          if (question.id.startsWith('custom-')) {
            // This is a new custom question, save it to the main library
            const { id, createdAt, updatedAt, usageCount, correctResponseRate, lastUsedAt, ...questionDataForDb } = question; // Omit form-specific or runtime fields not in StoredQuestion's Omit<X, 'id'>

            // Ensure questionDataForDb matches Omit<StoredQuestion, 'id'>
            // StoredQuestion (QuestionWithId) has id?: number.
            // StorageManager.addQuestion expects Omit<StoredQuestion, 'id'>
            // The 'type' field in QuestionWithId is more restrictive ('multiple-choice' | 'true-false')
            // than QuestionType (string enum). This needs careful mapping if they differ significantly.
            // Assuming QuestionType values (QCM, QCU, Text) map to ('multiple-choice', 'true-false', or other if schema was updated)
            // For now, let's assume types are compatible or Question's type fits QuestionWithId's expectations.
            // A direct cast might be too optimistic if types diverge.
            // Example: if QuestionType.QCM needs to become "multiple-choice"
            // let dbQuestionType = questionDataForDb.type as QuestionWithId['type']; // This is risky
            // A safer mapping function might be needed if QuestionType and QuestionWithId['type'] are not interchangeable.
            // For this step, we'll assume direct compatibility of type field for simplicity.
            // REVISED: Implement type mapping
            const { type: formQuestionType, ...otherQuestionData } = questionDataForDb;

            let dbQuestionType: StoredQuestion['type']; // StoredQuestion['type'] is QuestionWithId['type']
            if (formQuestionType === QuestionType.QCM || formQuestionType === QuestionType.QCU) {
              dbQuestionType = 'multiple-choice';
            } else if (formQuestionType === QuestionType.TRUE_FALSE) { // Assuming QuestionType has TRUE_FALSE
              dbQuestionType = 'true-false';
            } else {
              // If QuestionType.TEXT or others are present and unmappable to DB 'multiple-choice' | 'true-false'
              logger.error(`Unsupported question type for DB storage: ${formQuestionType}. Question text: ${question.text}`);
              throw new Error(`Type de question "${formQuestionType}" non supporté pour l'enregistrement centralisé.`);
            }

            const questionPayloadForDb = { ...otherQuestionData, type: dbQuestionType };

            const newDbQuestionId = await StorageManager.addQuestion(questionPayloadForDb as Omit<StoredQuestion, 'id'>);
            if (newDbQuestionId) {
              processedManualQuestions[i] = { ...question, id: String(newDbQuestionId) }; // Update with new stringified DB ID
            } else {
              throw new Error(`Échec de la sauvegarde de la nouvelle question personnalisée: ${question.text}`);
            }
          }
        }

        // 2. Prepare definedQuestions for the questionnaire
        const definedQuestionsForDb: StoredQuestion[] = processedManualQuestions.map(q => {
          const { id, ...rest } = q;
          // All IDs in processedManualQuestions should now be string versions of numeric DB IDs
          return {
            ...rest,
            id: Number(id), // Convert string ID back to number for DB foreign key
          } as StoredQuestion; // StoredQuestion is QuestionWithId, which has id: number
        });

        questionnaireDataToSave = {
          name: questionnaireName,
          referential: selectedReferential as CACESReferential,
          isRandomized: false,
          passingThreshold: passingThreshold,
          themeDistribution: { reglementation: 0, securite: 0, technique: 0 }, // Or specific if needed
          totalQuestions: processedManualQuestions.length,
          eliminatoryCount: processedManualQuestions.filter(q => q.isEliminatory).length,
          definedQuestions: definedQuestionsForDb,
          questionIds: [], // Not used for manual questionnaires with definedQuestions
          createdAt: now,
          updatedAt: now,
        };
      }

      // Proceed with saving the questionnaire (either new or update)
      if (editingId) {
        await StorageManager.updateQuestionnaire(Number(editingId), questionnaireDataToSave);
        logger.info('Questionnaire updated successfully', { id: editingId, data: questionnaireDataToSave });
      } else {
        await StorageManager.addQuestionnaire(questionnaireDataToSave);
        logger.info('Questionnaire created successfully', { data: questionnaireDataToSave });
      }
      onFormSubmit?.(true);
      if (onBackToList) onBackToList(); // Ensure onBackToList is called only if it exists
    } catch (err) {
      logger.error('Failed to save questionnaire', { error: err, savedDataAttempt: questionnaireDataToSave });
      // Check if err is an instance of Error to satisfy TypeScript
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Échec de l’enregistrement du questionnaire: ${errorMessage}`);
      onFormSubmit?.(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && editingId) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement du questionnaire...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center space-x-2">
          <AlertTriangle size={20} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <Card title="Informations générales" className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label="Nom du questionnaire"
            placeholder="Ex: CACES R489 Standard"
            value={questionnaireName}
            onChange={(e) => setQuestionnaireName(e.target.value)}
            required
          />
          <Select
            label="Référentiel CACES"
            options={referentialOptions}
            value={selectedReferential}
            onChange={handleReferentialChange}
            placeholder="Sélectionner un référentiel"
            required
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
          <div>
            <Input
              label="Nombre total de questions"
              type="number"
              value={totalQuestions}
              onChange={handleTotalQuestionsChange}
              min={isRandomized ? (referentialLimits[selectedReferential as ReferentialType]?.min || 10) : 0}
              max={isRandomized ? (referentialLimits[selectedReferential as ReferentialType]?.max || 60) : undefined}
              required
              disabled={!isRandomized}
            />
            {!isRandomized && (
              <p className="mt-1 text-xs text-gray-500">
                Automatiquement calculé d'après le nombre de questions manuelles ajoutées.
              </p>
            )}
            {/* Show limits warning only in randomized mode */}
            {isRandomized && getLimitsWarning()}
          </div>
          <Input
            label="Seuil de réussite (%)"
            type="number"
            placeholder="Ex: 70"
            min={0}
            max={100}
            value={passingThreshold}
            onChange={(e) => setPassingThreshold(parseInt(e.target.value) || 70)}
            required
          />
          <Input
            label="Nombre de questions éliminatoires"
            type="number"
            value={eliminatoryCount}
            onChange={(e) => setEliminatoryCount(parseInt(e.target.value) || 0)}
            min={isRandomized ? 2 : 0} // Min can be 0 in manual if no eliminatory questions
            max={isRandomized ? 5 : undefined} // No specific max in manual from form perspective
            required
            disabled={!isRandomized}
          />
          {!isRandomized && (
            <p className="mt-1 text-xs text-gray-500">
              Automatiquement calculé d'après les questions manuelles marquées comme éliminatoires.
            </p>
          )}
        </div>
        <div className="mt-4 flex items-center space-x-2">
          <input
            type="checkbox"
            id="randomize"
            checked={isRandomized}
            onChange={handleRandomizeToggle}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="randomize" className="text-sm text-gray-700">
            Génération aléatoire depuis la bibliothèque
          </label>
        </div>
        {showValidationWarning && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start">
            <AlertTriangle size={20} className="text-amber-500 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">Attention : Version du référentiel</p>
              <p className="text-sm text-amber-700 mt-1">
                Le référentiel R482 a été mis à jour. Certaines questions pourraient ne plus être conformes à la dernière version réglementaire.
              </p>
            </div>
          </div>
        )}
      </Card>

      {isRandomized && (
        <ThemeSelector
          distribution={themeDistribution}
          onDistributionChange={handleThemeDistributionChange}
          totalQuestions={totalQuestions}
          isRandomized={isRandomized}
          selectedReferential={selectedReferential}
        />
      )}

      {canShowManualPPTXGenerator && (
        <PPTXGenerator
          questions={manualQuestions}
          questionnaireName={questionnaireName}
          referential={selectedReferential}
        />
      )}

      {!isRandomized && (
        <Card title="Questions manuelles" className="mb-6">
          <div className="mb-4 flex justify-between items-center">
            <h4 className="text-sm font-medium text-gray-700">
              Questions sélectionnées ({manualQuestions.length})
            </h4>
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddManualQuestionForm(true)}
                className="mr-2"
              >
                Ajouter question personnalisée
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsQuestionLibModalOpen(true)} // Open modal
              >
                Ajouter depuis la bibliothèque
              </Button>
            </div>
          </div>
          {manualQuestions.length === 0 && !showAddManualQuestionForm && (
            <p className="text-sm text-gray-500 py-4 text-center">Aucune question manuelle ajoutée.</p>
          )}
          <div className="space-y-3">
            {manualQuestions.map((q, index) => (
              <div key={q.id} className="p-3 border rounded-lg bg-gray-50">
                <div className="flex justify-between items-start">
                  <p className="font-medium text-sm text-gray-800">{index + 1}. {q.text}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 size={14} />}
                    aria-label="Supprimer la question"
                    onClick={() => handleDeleteManualQuestion(q.id)}
                  />
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Type: {q.type} | Thème: {q.theme} | Réf: {q.referential} {q.isEliminatory ? "| Éliminatoire" : ""}
                </p>
              </div>
            ))}
          </div>
          {showAddManualQuestionForm && (
            <div className="mt-4 p-4 border border-blue-200 rounded-lg bg-blue-50">
              <h5 className="text-md font-semibold text-blue-800 mb-3">Nouvelle question personnalisée</h5>
              <Input
                label="Texte de la question"
                value={newManualQuestion.text || ''}
                onChange={(e) => handleNewManualQuestionChange('text', e.target.value)}
                placeholder="Entrez le texte de la question..."
                className="mb-3"
                required
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                <Select
                  label="Type de question"
                  value={newManualQuestion.type || QuestionType.QCM}
                  onChange={(e) => handleNewManualQuestionChange('type', e.target.value as QuestionType)}
                  options={Object.values(QuestionType).map(qt => ({ value: qt, label: qt }))}
                  required
                />
                <Select
                  label="Thème"
                  value={newManualQuestion.theme || ''}
                  onChange={(e) => handleNewManualQuestionChange('theme', e.target.value as QuestionTheme)}
                  options={Object.entries(questionThemes).map(([val, lab]) => ({ value: val, label: lab }))}
                  placeholder="Sélectionner un thème"
                  required
                />
              </div>
              <Select
                label="Référentiel (pour cette question)"
                value={newManualQuestion.referential || selectedReferential || ''}
                onChange={(e) => handleNewManualQuestionChange('referential', e.target.value as CACESReferential)}
                options={referentialOptions}
                placeholder="Sélectionner un référentiel"
                className="mb-3"
                required
              />
              {(newManualQuestion.type === QuestionType.QCM || newManualQuestion.type === QuestionType.QCU) && (
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Options de réponse</label>
                  {(newManualQuestion.options || []).map((option, index) => (
                    <div key={`option-${index}`} className="flex items-center gap-2 mb-1">
                      <Input
                        value={option}
                        onChange={(e) => handleOptionChange(index, e.target.value)}
                        placeholder={`Option ${index + 1}`}
                        className="flex-grow"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Trash2 size={14} />}
                        aria-label="Supprimer l'option"
                        onClick={() => handleRemoveOption(index)}
                      />
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddOption}
                    icon={<Plus size={14} />}
                    className="mt-1"
                  >
                    Ajouter option
                  </Button>
                </div>
              )}
              <Input
                label="Bonne réponse"
                value={newManualQuestion.correctAnswer || ''}
                onChange={(e) => handleNewManualQuestionChange('correctAnswer', e.target.value)}
                placeholder="Indiquer la bonne réponse (ex: index de l'option, ou texte)"
                className="mb-3"
                required
              />
              <label className="flex items-center space-x-2 mb-4">
                <input
                  type="checkbox"
                  checked={newManualQuestion.isEliminatory || false}
                  onChange={(e) => handleNewManualQuestionChange('isEliminatory', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Question éliminatoire</span>
              </label>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowAddManualQuestionForm(false)}>
                  Annuler
                </Button>
                <Button variant="primary" onClick={handleSaveNewManualQuestion}>
                  Ajouter cette question
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Modal for Question Library - Part B */}
      {isQuestionLibModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative p-8 border w-full max-w-4xl shadow-lg rounded-md bg-white">
            <div className="absolute top-0 right-0 pt-4 pr-4">
              <button
                onClick={() => setIsQuestionLibModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close modal"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
              Sélectionner des questions depuis la bibliothèque
            </h3>
            <QuestionLibrary
              isSelectionMode={true}
              onQuestionsSelected={handleSelectQuestionsFromLib}
            />
            {/* The QuestionLibrary component now has its own "Add Selected" button */}
            {/* We might want a general "Cancel" or "Close" button for the modal itself, handled by the X icon or an explicit button if needed */}
            {/* The current modal structure has a close X icon. A "Fermer" button is also good UX. */}
            {/* The QuestionLibrary's "Add..." button calls onQuestionsSelected which then closes the modal.*/}
            {/* Adding an explicit close button to the modal footer for clarity: */}
            <div className="mt-6 flex justify-end">
              <Button variant="outline" onClick={() => setIsQuestionLibModalOpen(false)}>
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={onBackToList}>
          Annuler
        </Button>
        <div className="space-x-3">
          <Button variant="outline" icon={<Save size={16} />}>
            Enregistrer brouillon
          </Button>
          <Button
            variant="primary"
            icon={<Save size={16} />}
            onClick={handleSave}
            disabled={isLoading}
          >
            Valider et enregistrer
          </Button>
        </div>
      </div>
    </div>
  );
};

export default QuestionnaireForm;
