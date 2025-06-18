import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, AlertTriangle } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import ThemeSelector from './ThemeSelector';
import PPTXGenerator from './PPTXGenerator';
import { ReferentialType, referentials, QuestionTheme, questionThemes, referentialLimits, Question, QuestionType, CACESReferential, Questionnaire } from '../../types';
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
    referential: undefined,
    isEliminatory: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingId) {
      loadQuestionnaire(editingId);
    }
  }, [editingId]);

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
          setManualQuestions([]);
        } else {
          // Manual mode
          setManualQuestions([]); // Placeholder: Actual questions will need to be fetched using questionnaire.questionIds
          logger.info("Manual mode: Questionnaire uses questionIds. Actual questions need to be fetched.", questionnaire.questionIds);
          setTotalQuestions(questionnaire.questionIds?.length || 0); // Total is based on number of IDs
          setEliminatoryCount(0); // Placeholder: Cannot determine this without fetching full questions yet.
          logger.info("Manual mode: Eliminatory count requires fetching full questions based on questionIds.");
          setThemeDistribution({ reglementation: 0, securite: 0, technique: 0 });
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
    setIsRandomized(!isRandomized);
    logger.info(`Mode aléatoire ${!isRandomized ? 'activé' : 'désactivé'}`);
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
    if (!newManualQuestion.text?.trim() || !newManualQuestion.theme || !newManualQuestion.referential) {
      logger.error("Validation failed for new manual question: text, theme, or referential missing.");
      setError("Veuillez remplir le texte, le thème et le référentiel de la question.");
      return;
    }

    const questionToAdd: Question = {
      id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      text: newManualQuestion.text,
      type: newManualQuestion.type || QuestionType.QCM,
      options: newManualQuestion.options?.filter(opt => opt.trim() !== '') || [],
      correctAnswer: newManualQuestion.correctAnswer || '',
      theme: newManualQuestion.theme as QuestionTheme,
      referential: newManualQuestion.referential as CACESReferential,
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
      referential: selectedReferential as CACESReferential || undefined,
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

    if (isRandomized) {
      questionnaireDataToSave = {
        name: questionnaireName,
        referential: selectedReferential as CACESReferential,
        isRandomized: true,
        passingThreshold: passingThreshold,
        themeDistribution: themeDistribution,
        totalQuestions: totalQuestions,
        eliminatoryCount: eliminatoryCount,
        questionIds: [], // ADDED/MODIFIED
        createdAt: now,    // ADDED
        updatedAt: now,    // ADDED
      };
    } else {
      questionnaireDataToSave = {
        name: questionnaireName,
        referential: selectedReferential as CACESReferential,
        isRandomized: false,
        passingThreshold: passingThreshold,
        themeDistribution: { reglementation: 0, securite: 0, technique: 0 },
        totalQuestions: manualQuestions.length,
        eliminatoryCount: manualQuestions.filter(q => q.isEliminatory).length,
        questionIds: [], // ADDED/MODIFIED
        createdAt: now,    // ADDED
        updatedAt: now,    // ADDED
      };
    }

    try {
      setIsLoading(true);
      setError(null);
      if (editingId) {
        await StorageManager.updateQuestionnaire(Number(editingId), questionnaireDataToSave);
        logger.info('Questionnaire updated successfully', { id: editingId, data: questionnaireDataToSave });
      } else {
        await StorageManager.addQuestionnaire(questionnaireDataToSave);
        logger.info('Questionnaire created successfully', { data: questionnaireDataToSave });
      }
      onFormSubmit?.(true);
      onBackToList?.();
    } catch (err) {
      logger.error('Failed to save questionnaire', { error: err, data: questionnaireDataToSave });
      setError('Échec de l’enregistrement du questionnaire.');
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
              min={10}
              max={60}
              required
              disabled={!isRandomized} // Disable in manual mode as it's informational
            />
            {/* Show limits warning only in randomized mode */}
            {getLimitsWarning()}
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
            min={2}
            max={5}
            required
            disabled={!isRandomized} // Disable in manual mode as it's informational
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
              <Button variant="outline" size="sm" disabled>
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
