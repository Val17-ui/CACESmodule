import React, { useState } from 'react';
import { Plus, Trash2, Save, AlertTriangle } from 'lucide-react'; // Removed Shuffle
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import ThemeSelector from './ThemeSelector';
import PPTXGenerator from './PPTXGenerator';
import { ReferentialType, referentials, QuestionTheme, questionThemes, referentialLimits, Question, QuestionType, CACESReferential, StoredQuestionnaire as StoredQuestionnaireType } from '../../types'; // Added StoredQuestionnaireType
import { mockQuestions } from '../../data/mockData';
import { logger } from '../../utils/logger';

// Define props for QuestionnaireForm
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
  const [passingThreshold, setPassingThreshold] = useState(70); // Added state for passingThreshold
  const [showValidationWarning, setShowValidationWarning] = useState(false);
  const [isRandomized, setIsRandomized] = useState(false);
  const [eliminatoryCount, setEliminatoryCount] = useState(3);
  const [themeDistribution, setThemeDistribution] = useState<Record<QuestionTheme, number>>({
    reglementation: 15,
    securite: 15,
    technique: 10
  });
  const [manualQuestions, setManualQuestions] = useState<Question[]>([]); // New state for manual questions
  const [showAddManualQuestionForm, setShowAddManualQuestionForm] = useState(false);
  const [newManualQuestion, setNewManualQuestion] = useState<Partial<Question>>({
    text: '',
    type: QuestionType.QCM, // Default type
    options: ['', '', '', ''], // Default 4 options for QCM
    correctAnswer: '',
    theme: undefined, // User must select
    referential: undefined,
    isEliminatory: false,
    // id will be generated upon adding
  });

  const [isLoading, setIsLoading] = useState(false); // Added isLoading state
  const [error, setError] = useState<string | null>(null); // Added error state

  useEffect(() => {
    if (editingId) {
      loadQuestionnaire(editingId);
    }
  }, [editingId]); // Note: If loadQuestionnaire used onBackToList or onFormSubmit, they'd need to be in deps or useCallback.

  const loadQuestionnaire = async (id: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const questionnaire = await StorageManager.getQuestionnaireById(Number(id)); // id is string from prop
      if (questionnaire) {
        logger.info("Loading questionnaire for editing:", questionnaire);
        setQuestionnaireName(questionnaire.name);
        setSelectedReferential(questionnaire.referential as string); // Cast enum to string for state
        setIsRandomized(questionnaire.isRandomized);
        setPassingThreshold(questionnaire.passingThreshold || 70); // Default if undefined

        if (questionnaire.isRandomized) {
          // Automatic mode
          setThemeDistribution(questionnaire.themeDistribution || { reglementation: 15, securite: 15, technique: 10 }); // Default if null/undefined
          setTotalQuestions(questionnaire.totalQuestions || 40); // Default if null/undefined
          setEliminatoryCount(questionnaire.eliminatoryCount || 3); // Default if null/undefined
          setManualQuestions([]); // Clear manual questions if switching to automatic
        } else {
          // Manual mode
          setManualQuestions(questionnaire.questions || []);
          // Optionally, set informational states for automatic mode fields if they are still visible
          setTotalQuestions(questionnaire.questions?.length || 0); // Informational total
          setEliminatoryCount(questionnaire.questions?.filter(q => q.isEliminatory).length || 0); // Informational count
          setThemeDistribution({ reglementation: 0, securite: 0, technique: 0 }); // Reset or make informational
        }
      } else {
        logger.error(`Questionnaire with ID ${id} not found for editing.`);
        setError("Questionnaire non trouvé.");
        // Optionally call onBackToList or handle error more gracefully
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
    const referential = e.target.value as ReferentialType;
    setSelectedReferential(referential);
    logger.info(`Référentiel sélectionné: ${referential}`);

    // Update total questions based on referential limits
    if (referential && referentialLimits[referential]) {
      const defaultTotal = Math.min(40, referentialLimits[referential].max);
      setTotalQuestions(defaultTotal);
    }

    setShowValidationWarning(referential === 'R482');
  };

  const handleTotalQuestionsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    setTotalQuestions(value);

    // Check limits
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
      [theme]: count
    }));
  };

  const handleRandomizeToggle = () => {
    setIsRandomized(!isRandomized);
    logger.info(`Mode aléatoire ${!isRandomized ? 'activé' : 'désactivé'}`);
  };

  // const currentTotal = Object.values(themeDistribution).reduce((sum, count) => sum + count, 0); // Related to themeDistribution, less relevant for manual mode's PPTX

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
    if (!newManualQuestion.text?.trim() || !newManualQuestion.theme || !newManualQuestion.referential) {
      // Basic validation
      logger.error("Validation failed for new manual question: text, theme, or referential missing.");
      // TODO: Set an error message for the user
      return;
    }

    const questionToAdd: Question = {
      id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, // Simple unique ID
      text: newManualQuestion.text,
      type: newManualQuestion.type || QuestionType.QCM,
      options: newManualQuestion.options?.filter(opt => opt.trim() !== '') || [], // Filter out empty options
      correctAnswer: newManualQuestion.correctAnswer || '',
      theme: newManualQuestion.theme as QuestionTheme, // Assert type
      referential: newManualQuestion.referential as CACESReferential, // Assert type
      isEliminatory: newManualQuestion.isEliminatory || false,
      // Fill in other required Question fields if any, or ensure they are optional
      usageCount: 0,
      correctResponseRate: 0,
      createdAt: new Date().toISOString(),
    };

    setManualQuestions(prev => [...prev, questionToAdd]);
    setNewManualQuestion({ // Reset form
      text: '', type: QuestionType.QCM, options: ['', '', '', ''], correctAnswer: '',
      theme: undefined, referential: selectedReferential as CACESReferential || undefined, isEliminatory: false, // Default referential to form's selected
    });
    setShowAddManualQuestionForm(false);
    logger.info("New manual question added", questionToAdd);
  };

  const handleDeleteManualQuestion = (id: string) => {
    setManualQuestions(prev => prev.filter(q => q.id !== id));
    logger.info(`Manual question deleted: ${id}`);
  };

  // Update currentTotal for manual questions display
  const manualQuestionsCount = manualQuestions.length;
  // The 'totalQuestions' in manual mode is informational, driven by manualQuestionsCount
  // So, the display `({currentTotal}/{totalQuestions})` in manual section header should use manualQuestionsCount.
  // `currentTotal` from themeDistribution is not relevant here.

  const getLimitsWarning = () => {
    if (!selectedReferential || !referentialLimits[selectedReferential as ReferentialType]) {
      return null;
    }
    // This warning is more relevant for Automatic mode's totalQuestions target
    if (isRandomized && referentialLimits[selectedReferential as ReferentialType]) {
      const limits = referentialLimits[selectedReferential as ReferentialType];
      if (totalQuestions < limits.min || totalQuestions > limits.max) {
        return (
          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
            <AlertTriangle size={20} className="text-red-500 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">
                Nombre de questions hors limites
              </p>
              <p className="text-sm text-red-700 mt-1">
                Pour le référentiel {selectedReferential}, le nombre de questions doit être entre {limits.min} et {limits.max}.
              </p>
            </div>
          </div>
        );
      }
    }
    // const limits = referentialLimits[selectedReferential as ReferentialType];
    // if (totalQuestions < limits.min || totalQuestions > limits.max) {
      return (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
          <AlertTriangle size={20} className="text-red-500 mr-2 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">
              Nombre de questions hors limites
            </p>
            <p className="text-sm text-red-700 mt-1">
              Pour le référentiel {selectedReferential}, le nombre de questions doit être entre {limits.min} et {limits.max}.
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  // Update currentTotal for manual questions display
  // const manualQuestionsCount = manualQuestions.length; // Already defined above
  // The 'totalQuestions' in manual mode is informational, driven by manualQuestionsCount
  // So, the display `({currentTotal}/{totalQuestions})` in manual section header should use manualQuestionsCount.
  // `currentTotal` from themeDistribution is not relevant here.

  // const canGeneratePPTX = questionnaireName.trim() && selectedReferential && currentTotal > 0; // Old logic based on themeDistribution currentTotal
  // const generatedQuestions = canGeneratePPTX ? generateQuestionsForPPTX() : []; // Old logic

  // Condition for showing PPTX Generator in Manual Mode
  const canShowManualPPTXGenerator = !isRandomized &&
                                     manualQuestions.length > 0 &&
                                     questionnaireName.trim() !== '' &&
                                     selectedReferential !== '';

  const handleSave = async () => {
    if (!questionnaireName.trim()) {
      logger.error("Validation failed: Questionnaire name is required.");
      // TODO: Set user-facing error
      return;
    }
    if (!selectedReferential) {
      logger.error("Validation failed: Referential is required.");
      // TODO: Set user-facing error
      return;
    }

    let questionnaireDataToSave: Omit<StoredQuestionnaireType, 'id' | 'createdAt' | 'updatedAt'>;

    if (isRandomized) { // Automatic Mode
      questionnaireDataToSave = {
        name: questionnaireName,
        referential: selectedReferential as CACESReferential,
        isRandomized: true,
        passingThreshold: passingThreshold,
        themeDistribution: themeDistribution,
        totalQuestions: totalQuestions,
        eliminatoryCount: eliminatoryCount,
        questions: [], // No specific questions saved for automatic template
      };
    } else { // Manual Mode
      if (manualQuestions.length === 0) {
        logger.error("Validation failed: Manual mode requires at least one question.");
        // TODO: Set user-facing error
        return;
      }
      questionnaireDataToSave = {
        name: questionnaireName,
        referential: selectedReferential as CACESReferential,
        isRandomized: false,
        passingThreshold: passingThreshold,
        questions: manualQuestions, // Embed full manual questions for now
        // Fields for automatic mode are not primary, can be omitted or nulled if schema allows
        themeDistribution: null,
        totalQuestions: manualQuestions.length, // Actual total based on manual input
        eliminatoryCount: manualQuestions.filter(q => q.isEliminatory).length, // Actual count
      };
    }

    try {
      // setIsLoading(true); // Consider adding isLoading state if not already managed elsewhere for save
      if (editingId) {
        await StorageManager.updateQuestionnaire(Number(editingId), questionnaireDataToSave);
        logger.info('Questionnaire updated successfully', { id: editingId, data: questionnaireDataToSave });
      } else {
        await StorageManager.addQuestionnaire(questionnaireDataToSave);
        logger.info('Questionnaire created successfully', { data: questionnaireDataToSave });
      }
      onFormSubmit?.(true); // Call if props are connected
      onBackToList?.();     // Call if props are connected
    } catch (err) {
      logger.error('Failed to save questionnaire', { error: err, data: questionnaireDataToSave });
      // TODO: Set user-facing error
      onFormSubmit?.(false); // Call if props are connected
    } finally {
      // setIsLoading(false); // Consider adding isLoading state
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
              min={10}
              max={60}
              required
              // In Manual mode, this could be informational. For now, always visible/editable.
              // Or, conditionally disable/style if isRandomized is false and it becomes informational.
            />
            {/* TODO: If !isRandomized, consider making totalQuestions informational or hiding it, as per user feedback */}
            {/* For now, only show limits warning if in randomized mode */}
            {getLimitsWarning()}
          </div>

          <Input
            label="Seuil de réussite (%)"
            type="number"
            placeholder="Ex: 70"
            min={0}
            max={100}
            value={passingThreshold} // Bind to state
            onChange={(e) => setPassingThreshold(parseInt(e.target.value) || 70)} // Handle change
            required
            />

          <Input
            label="Nombre de questions éliminatoires"
            // In Manual mode, this is informational. For now, always visible/editable.
            // Or, conditionally disable/style if isRandomized is false.
            type="number"
            value={eliminatoryCount}
            onChange={(e) => setEliminatoryCount(parseInt(e.target.value) || 0)}
            min={2}
            max={5}
            required
            // TODO: If !isRandomized, consider making eliminatoryCount informational or hiding it.
          />
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
              <p className="text-sm font-medium text-amber-800">
                Attention : Version du référentiel
              </p>
              <p className="text-sm text-amber-700 mt-1">
                Le référentiel R482 a été mis à jour. Certaines questions pourraient ne plus être conformes à la dernière version réglementaire.
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* ThemeSelector: Only for Automatic mode */}
      {isRandomized && (
        <ThemeSelector
          distribution={themeDistribution}
          onDistributionChange={handleThemeDistributionChange}
          totalQuestions={totalQuestions}
          isRandomized={isRandomized} // Pass this to allow ThemeSelector to adapt if needed
          selectedReferential={selectedReferential}
        />
      )}

      {/* PPTXGenerator: Only for Manual mode and if manual questions exist */}
      {canShowManualPPTXGenerator && (
        <PPTXGenerator
          questions={manualQuestions} // Use actual manualQuestions
          questionnaireName={questionnaireName}
          referential={selectedReferential}
        />
      )}

      {!isRandomized && (
        <Card title="Questions manuelles" className="mb-6">
          <div className="mb-4 flex justify-between items-center">
            <h4 className="text-sm font-medium text-gray-700">
              Questions sélectionnées ({manualQuestions.length}) {/* Simplified count display for manual mode */}
            </h4>
            <div>
              <Button variant="outline" size="sm" onClick={() => setShowAddManualQuestionForm(true)} className="mr-2">
                Ajouter question personnalisée
              </Button>
              <Button variant="outline" size="sm" disabled> {/* Placeholder */}
                Ajouter depuis la bibliothèque
              </Button>
            </div>
          </div>

          {/* Display existing manual questions */}
          {manualQuestions.length === 0 && !showAddManualQuestionForm && (
            <p className="text-sm text-gray-500 py-4 text-center">Aucune question manuelle ajoutée.</p>
          )}
          <div className="space-y-3">
            {manualQuestions.map((q, index) => (
              <div key={q.id} className="p-3 border rounded-lg bg-gray-50">
                <div className="flex justify-between items-start">
                  <p className="font-medium text-sm text-gray-800">{index + 1}. {q.text}</p>
                  <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => handleDeleteManualQuestion(q.id)} />
                </div>
                <p className="text-xs text-gray-600 mt-1">Type: {q.type} | Thème: {q.theme} | Réf: {q.referential} {q.isEliminatory ? "| Éliminatoire" : ""}</p>
                {/* TODO: Add Edit button/functionality */}
              </div>
            ))}
          </div>

          {/* Form for adding a new manual question */}
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
                  options={Object.values(QuestionType).map(qt => ({ value: qt, label: qt }))} // Assuming QuestionType enum values are user-friendly
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
                options={referentialOptions} // Use existing referentialOptions
                placeholder="Sélectionner un référentiel"
                className="mb-3"
                required
              />

              {/* Options for QCM/QCU */}
              {(newManualQuestion.type === QuestionType.QCM || newManualQuestion.type === QuestionType.QCU) && (
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Options de réponse</label>
                  {(newManualQuestion.options || []).map((option, index) => (
                    <div key={index} className="flex items-center gap-2 mb-1">
                      <Input
                        value={option}
                        onChange={(e) => handleOptionChange(index, e.target.value)}
                        placeholder={`Option ${index + 1}`}
                        className="flex-grow"
                      />
                      <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => handleRemoveOption(index)} />
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={handleAddOption} icon={<Plus size={14}/>} className="mt-1">Ajouter option</Button>
                </div>
              )}

              {/* Correct Answer Input - simplified for now */}
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
                <Button variant="outline" onClick={() => setShowAddManualQuestionForm(false)}>Annuler</Button>
                <Button variant="primary" onClick={handleSaveNewManualQuestion}>Ajouter cette question</Button>
              </div>
            </div>
          )}
          {/* Original content of manual questions card (add question button, etc.) was here. Now replaced by the form toggle. */}
          {/*
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <Input
                  label="Texte de la question"
                  placeholder="Entrez le texte de la question..."
                  required
                />
              </div>
              <div className="ml-4 mt-6">
                <Button variant="outline" icon={<Trash2 size={16} />} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <Select
                label="Type de question"
                options={[
                  { value: 'multiple-choice', label: 'Choix multiple' },
                  { value: 'true-false', label: 'Vrai/Faux' },
                ]}
                placeholder="Sélectionner"
                required
              />

              <Select
                label="Thème"
                options={Object.entries(questionThemes).map(([value, label]) => ({
                  value,
                  label
                }))}
                placeholder="Sélectionner"
                required
              />

              <Input
                label="Temps (secondes)"
                type="number"
                placeholder="Ex: 30"
                min={5}
                required
              />
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Options de réponse
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Plus size={16} />}
                  className="text-sm"
                >
                  Ajouter option
                </Button>
              </div>

              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex-shrink-0">
                      <input
                        type="radio"
                        name="correctAnswer"
                        className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex-1">
                      <Input
                        placeholder={`Option ${i}`}
                        className="mb-0"
                      />
                    </div>
                    <div className="flex-shrink-0">
                      <Button variant="ghost" size="sm" icon={<Trash2 size={16} />} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isEliminatoryQuestion"
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="isEliminatoryQuestion" className="ml-2 block text-sm text-gray-700">
                Question éliminatoire (sécurité critique)
              </label>
            </div>
          </div>

          <Button
            variant="outline"
            icon={<Plus size={16} />}
            className="w-full"
          >
            Ajouter une question
          </Button>
        </Card>
      )}

      <div className="flex justify-between items-center">
        <Button variant="outline"> {/* This Annuler button might need wiring up */}
          Annuler
        </Button>
        <div className="space-x-3">
          <Button variant="outline" icon={<Save size={16} />}>
            Enregistrer brouillon
          </Button>
          <Button variant="primary" icon={<Save size={16} />} onClick={handleSave}>
            Valider et enregistrer
          </Button>
        </div>
      </div>
    </div>
  );
};

export default QuestionnaireForm;