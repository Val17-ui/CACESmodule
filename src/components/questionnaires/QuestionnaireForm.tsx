import React, { useState } from 'react';
import { Plus, Trash2, Save, AlertTriangle, Shuffle } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import ThemeSelector from './ThemeSelector';
import PPTXGenerator from './PPTXGenerator';
import { ReferentialType, referentials, QuestionTheme, questionThemes, referentialLimits, Question, QuestionType, CACESReferential } from '../../types'; // Added QuestionType, CACESReferential
import { mockQuestions } from '../../data/mockData';
import { logger } from '../../utils/logger';

const QuestionnaireForm: React.FC = () => {
  const [questionnaireName, setQuestionnaireName] = useState('');
  const [selectedReferential, setSelectedReferential] = useState<string>('');
  const [totalQuestions, setTotalQuestions] = useState(40);
  const [showValidationWarning, setShowValidationWarning] = useState(false);
  const [isRandomized, setIsRandomized] = useState(false);
  const [eliminatoryCount, setEliminatoryCount] = useState(3);
  const [themeDistribution, setThemeDistribution] = useState<Record<QuestionTheme, number>>({
    reglementation: 15,
    securite: 15,
    technique: 10
  });

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

  const currentTotal = Object.values(themeDistribution).reduce((sum, count) => sum + count, 0);
  const isOverTotal = currentTotal > totalQuestions;
  const isUnderTotal = currentTotal < totalQuestions;

  // Générer les questions pour le PPTX (simulation basée sur la distribution)
  const generateQuestionsForPPTX = (): Question[] => {
    if (!selectedReferential) return [];

    // Filtrer les questions par référentiel
    const availableQuestions = mockQuestions.filter(q => q.referential === selectedReferential);

    if (availableQuestions.length === 0) return [];

    const selectedQuestions: Question[] = [];

    // Pour chaque thème, sélectionner le nombre de questions demandé
    Object.entries(themeDistribution).forEach(([theme, count]) => {
      const themeQuestions = availableQuestions.filter(q => q.theme === theme);

      for (let i = 0; i < count && i < themeQuestions.length; i++) {
        // Convertir en format Vrai/Faux pour OMBEA
        const originalQuestion = themeQuestions[i % themeQuestions.length];
        const convertedQuestion: Question = {
          ...originalQuestion,
          type: QuestionType.TrueFalse, // Use enum
          options: ['Vrai', 'Faux'],
          correctAnswer: Math.random() > 0.5 ? '0' : '1',
          isEliminatory: originalQuestion.isEliminatory,
          referential: originalQuestion.referential as CACESReferential, // Cast for now
          theme: originalQuestion.theme as QuestionTheme, // Cast for now
          id: originalQuestion.id,
          text: originalQuestion.text,
        };
        selectedQuestions.push(convertedQuestion);
      }
    });

    return selectedQuestions.slice(0, totalQuestions);
  };

  const getLimitsWarning = () => {
    if (!selectedReferential || !referentialLimits[selectedReferential as ReferentialType]) {
      return null;
    }

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
    return null;
  };

  const canGeneratePPTX = questionnaireName.trim() && selectedReferential && currentTotal > 0;
  const generatedQuestions = canGeneratePPTX ? generateQuestionsForPPTX() : [];

  return (
    <div>
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
            />
            {getLimitsWarning()}
          </div>

          <Input
            label="Seuil de réussite (%)"
            type="number"
            placeholder="Ex: 70"
            min={0}
            max={100}
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

      <ThemeSelector
        distribution={themeDistribution}
        onDistributionChange={handleThemeDistributionChange}
        totalQuestions={totalQuestions}
        isRandomized={isRandomized}
        selectedReferential={selectedReferential}
      />

      {canGeneratePPTX && (
        <PPTXGenerator
          questions={generatedQuestions}
          questionnaireName={questionnaireName}
          referential={selectedReferential}
        />
      )}

      {!isRandomized && (
        <Card title="Questions manuelles" className="mb-6">
          <div className="mb-4 flex justify-between items-center">
            <h4 className="text-sm font-medium text-gray-700">
              Questions sélectionnées ({currentTotal}/{totalQuestions})
            </h4>
            {(isOverTotal || isUnderTotal) && (
              <span className={`text-sm ${isOverTotal ? 'text-red-600' : 'text-amber-600'}`}>
                {isOverTotal ? 'Trop de questions sélectionnées' : 'Questions manquantes'}
              </span>
            )}
          </div>

          <div className="mb-4 p-4 border border-gray-200 rounded-lg">
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
          <Button variant="primary" icon={<Save size={16} />}>
            Valider et enregistrer
          </Button>
        </div>
      </div>
    </div>
  );
};

export default QuestionnaireForm;