import React, { useState, useEffect } from 'react';
import { Save, AlertTriangle, Shuffle } from 'lucide-react'; // Uncommented
import Card from '../ui/Card'; // Uncommented
import Button from '../ui/Button'; // Uncommented
import Input from '../ui/Input'; // Uncommented
import Select from '../ui/Select'; // Uncommented
// import ThemeSelector from './ThemeSelector'; // Temporarily commented out
import PPTXGenerator from './PPTXGenerator'; // Uncommented
import { ReferentialType, referentials, QuestionTheme, referentialLimits, Question, QuestionType, CACESReferential, questionThemes } from '../../types'; // Restored full type imports

import { StorageManager, StoredQuestionnaire, StoredQuestion } from '../../services/StorageManager';
import { logger } from '../../utils/logger';

interface QuestionnaireFormProps {
  editingId: string | null; // Changed to non-optional as per original diff
  onFormSubmit?: (success: boolean) => void;
  onBackToList?: () => void;
}

const QuestionnaireForm: React.FC<QuestionnaireFormProps> = ({
  editingId,
  onFormSubmit,
  onBackToList,
}) => {
  const [formData, setFormData] = useState({
    name: '', // Renamed from title
    referential: '' as ReferentialType,
    questionCount: 40,
    passingScore: 70,
    timeLimit: 30,
    shuffleQuestions: true,
    shuffleAnswers: true,
    showCorrectAnswers: true, // Restored as per original diff
    allowReview: true,
    themes: [] as QuestionTheme[],
  });

  // loadQuestionnaire, handlers are kept as they are in the current file (more complete)
  // ... (useEffect, loadQuestionnaire, handleInputChange, handleThemeChange, generateQuestions, handleSave are unchanged from current file content)

  // Conditional loading for editing - kept commented as per original "Step 2a" diff
  // if (isLoading && editingId) {
  //   return (
  //     <div className="flex items-center justify-center py-12">
  //       <div className="text-center">
  //         <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
  //         <p className="text-gray-600">Chargement du questionnaire...</p>
  //       </div>
  //     </div>
  //   );
  // }

  // loadQuestionnaire, handlers are kept as they are in the current file (more complete)
  // ... (useEffect, loadQuestionnaire, handleInputChange, handleThemeChange, generateQuestions, handleSave are unchanged from current file content)
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (editingId) {
      loadQuestionnaire(editingId);
    }
  }, [editingId]);

  const loadQuestionnaire = async (id: string) => {
    try {
      setIsLoading(true);
      const questionnaire = await StorageManager.getQuestionnaireById(Number(id));
      if (questionnaire) {
        setFormData({
          name: questionnaire.name,
          referential: questionnaire.referential,
          questionCount: questionnaire.questionCount,
          passingScore: questionnaire.passingScore,
          timeLimit: questionnaire.timeLimit,
          shuffleQuestions: questionnaire.shuffleQuestions,
          shuffleAnswers: questionnaire.shuffleAnswers,
          showCorrectAnswers: questionnaire.showCorrectAnswers,
          allowReview: questionnaire.allowReview,
          themes: questionnaire.themes,
        });
        setQuestions(questionnaire.questions || []);
      }
    } catch (err) {
      logger.error('Failed to load questionnaire', { error: err, questionnaireId: id });
      setError('Impossible de charger le questionnaire');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleThemeChange = (themes: QuestionTheme[]) => {
    setFormData(prev => ({
      ...prev,
      themes,
    }));
  };

  const generateQuestions = async () => {
    if (!formData.referential || formData.themes.length === 0) {
      setError('Veuillez sélectionner un référentiel et au moins un thème');
      return;
    }
    try {
      setIsGenerating(true);
      setError(null);
      const generatedQuestions: Question[] = [];
      const questionsPerTheme = Math.floor(formData.questionCount / formData.themes.length);
      for (const theme of formData.themes) {
        for (let i = 0; i < questionsPerTheme; i++) {
          generatedQuestions.push({
            id: `q_${Date.now()}_${i}`,
            type: 'multiple-choice' as QuestionType,
            theme,
            question: `Question ${i + 1} pour ${theme}`,
            answers: [
              { id: 'a1', text: 'Réponse A', isCorrect: true },
              { id: 'a2', text: 'Réponse B', isCorrect: false },
              { id: 'a3', text: 'Réponse C', isCorrect: false },
              { id: 'a4', text: 'Réponse D', isCorrect: false },
            ],
            explanation: 'Explication de la réponse correcte',
            difficulty: 'medium',
            points: 1,
          });
        }
      }
      setQuestions(generatedQuestions);
      logger.info('Questions generated successfully', { 
        count: generatedQuestions.length,
        referential: formData.referential,
        themes: formData.themes 
      });
    } catch (err) {
      logger.error('Failed to generate questions', { error: err });
      setError('Erreur lors de la génération des questions');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Le nom du questionnaire (titre) est obligatoire');
      return;
    }

    if (!formData.referential) {
      setError('Veuillez sélectionner un référentiel');
      return;
    }

    if (questions.length === 0) {
      setError('Veuillez générer des questions avant de sauvegarder');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const questionnaireData: Omit<StoredQuestionnaire, 'id' | 'createdAt' | 'updatedAt'> = {
        name: formData.name,
        referential: formData.referential,
        questionCount: formData.questionCount,
        passingScore: formData.passingScore,
        timeLimit: formData.timeLimit,
        shuffleQuestions: formData.shuffleQuestions,
        shuffleAnswers: formData.shuffleAnswers,
        showCorrectAnswers: formData.showCorrectAnswers,
        allowReview: formData.allowReview,
        themes: formData.themes,
        questions: questions,
      };

      if (editingId) {
        await StorageManager.updateQuestionnaire(Number(editingId), questionnaireData);
        logger.info('Questionnaire updated successfully', { id: editingId });
      } else {
        const id = await StorageManager.addQuestionnaire(questionnaireData);
        logger.info('Questionnaire created successfully', { id });
      }

      onFormSubmit?.(true);
      onBackToList?.();
    } catch (err) {
      logger.error('Failed to save questionnaire', { error: err });
      setError('Erreur lors de la sauvegarde');
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
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3">
          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {!(isLoading && editingId) && (
        <>
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Informations générales
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Titre du questionnaire"
              value={formData.name}
              onChange={(value) => handleInputChange('name', value)}
              placeholder="Ex: CACES R489 - Chariots élévateurs"
              required
            />

            <Select
              label="Référentiel"
              value={formData.referential}
              onChange={(value) => handleInputChange('referential', value)}
              options={referentials.map(ref => ({
                value: ref.id,
                label: `${ref.id} - ${ref.name}`
              }))}
              placeholder="Sélectionner un référentiel"
              required
            />

            <Input
              label="Nombre de questions"
              type="number"
              value={formData.questionCount}
              onChange={(value) => handleInputChange('questionCount', parseInt(value) || 40)}
              min={10}
              max={100}
            />

            <Input
              label="Score de réussite (%)"
              type="number"
              value={formData.passingScore}
              onChange={(value) => handleInputChange('passingScore', parseInt(value) || 70)}
              min={50}
              max={100}
            />

            <Input
              label="Durée limite (minutes)"
              type="number"
              value={formData.timeLimit}
              onChange={(value) => handleInputChange('timeLimit', parseInt(value) || 30)}
              min={10}
              max={180}
            />
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Options d'examen
          </h3>
          
          <div className="space-y-4">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={formData.shuffleQuestions}
                onChange={(e) => handleInputChange('shuffleQuestions', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-700">Mélanger l'ordre des questions</span>
            </label>

            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={formData.shuffleAnswers}
                onChange={(e) => handleInputChange('shuffleAnswers', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-700">Mélanger l'ordre des réponses</span>
            </label>

            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={formData.showCorrectAnswers}
                onChange={(e) => handleInputChange('showCorrectAnswers', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-700">Afficher les bonnes réponses à la fin</span>
            </label>

            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={formData.allowReview}
                onChange={(e) => handleInputChange('allowReview', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-700">Permettre la révision des réponses</span>
            </label>
          </div>
        </div>
      </Card>

      {/* {formData.referential && (
        <ThemeSelector
          referential={formData.referential}
          selectedThemes={formData.themes}
          onThemeChange={handleThemeChange}
        />
      )} */}

      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Questions ({questions.length})
            </h3>
            <Button
              variant="outline"
              icon={<Shuffle size={16} />}
              onClick={generateQuestions}
              disabled={isGenerating || !formData.referential || formData.themes.length === 0}
            >
              {isGenerating ? 'Génération...' : 'Générer les questions'}
            </Button>
          </div>

          {questions.length > 0 && (
            <div className="space-y-3">
              {questions.slice(0, 5).map((question, index) => (
                <div key={question.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {index + 1}. {question.question}
                      </p>
                      <div className="mt-2 space-y-1">
                        {question.answers.map((answer) => (
                          <div
                            key={answer.id}
                            className={`text-sm px-2 py-1 rounded ${
                              answer.isCorrect
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {answer.text}
                          </div>
                        ))}
                      </div>
                    </div>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {question.theme}
                    </span>
                  </div>
                </div>
              ))}
              
              {questions.length > 5 && (
                <p className="text-sm text-gray-500 text-center py-2">
                  ... et {questions.length - 5} autres questions
                </p>
              )}
            </div>
          )}

          {questions.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Shuffle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>Aucune question générée</p>
              <p className="text-sm">Sélectionnez un référentiel et des thèmes, puis cliquez sur "Générer les questions"</p>
            </div>
          )}
        </div>
      </Card>

      {questions.length > 0 && (
        <PPTXGenerator
          questionnaire={{
            name: formData.name,
            referential: formData.referential,
            questions: questions,
            themes: formData.themes,
          }}
        />
      )}

      <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
        <Button
          variant="outline"
          onClick={onBackToList}
        >
          Annuler
        </Button>
        <Button
          variant="primary"
          icon={<Save size={16} />}
          onClick={handleSave}
          disabled={isLoading || questions.length === 0}
        >
          {isLoading ? 'Sauvegarde...' : editingId ? 'Mettre à jour' : 'Créer le questionnaire'}
        </Button>
      </div>
      </>
      )}
    </div>
  );
};

export default QuestionnaireForm;