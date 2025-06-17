import React, { useState, useEffect } from 'react';
import { Save, AlertTriangle, Shuffle } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import ThemeSelector from './ThemeSelector';
import PPTXGenerator from './PPTXGenerator';
import { ReferentialType, referentials, questionThemes, referentialLimits, Question } from '../../types';
import { StorageManager, StoredQuestionnaire, StoredQuestion } from '../../services/StorageManager';
import { logger } from '../../utils/logger';
import { ReferentialType, referentials, questionThemes, referentialLimits, Question, QuestionType } from '../../types';

interface QuestionnaireFormProps {
  editingId?: string | null; // Changed from string | null to string | undefined for consistency
  onFormSubmit?: (success: boolean) => void; // Callback for when form is submitted
  onBackToList?: () => void; // Callback to go back to list view
}

const QuestionnaireForm: React.FC<QuestionnaireFormProps> = ({
  editingId,
  onFormSubmit,
  onBackToList,
}) => {
  const [questionnaireName, setQuestionnaireName] = useState('');
  const [selectedReferential, setSelectedReferential] = useState<ReferentialType | ''>('');
  const [totalQuestions, setTotalQuestions] = useState(40); // Target total for randomized, or sum of selected for manual
  const [passingThreshold, setPassingThreshold] = useState(70); // New state
  const [showValidationWarning, setShowValidationWarning] = useState(false);
  const [isRandomized, setIsRandomized] = useState(false);
  const [eliminatoryCount, setEliminatoryCount] = useState(3);
  const [themeDistribution, setThemeDistribution] = useState<Record<QuestionTheme, number>>({
    reglementation: 15,
    securite: 15,
    technique: 10,
  });

  const [editingQuestionnaire, setEditingQuestionnaire] = useState<StoredQuestionnaire | null>(null);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<number[]>([]);
  const [allDbQuestions, setAllDbQuestions] = useState<StoredQuestion[]>([]);

  const [isLoading, setIsLoading] = useState(true); // For initial data loading
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false); // For save operations
  const [preparedPptxQuestions, setPreparedPptxQuestions] = useState<Question[]>([]);

// Helper function to ensure all theme keys are present
const ensureFullThemeDistribution = (dist: Partial<Record<QuestionTheme, number>>): Record<QuestionTheme, number> => {
  // Option 1 : Initialiser directement avec les valeurs par défaut
  const fullDist: Record<QuestionTheme, number> = {
    reglementation: dist.reglementation || 0,
    securite: dist.securite || 0,
    technique: dist.technique || 0,
  };
  
  return fullDist;
};

  const handleSave = async (isDraft: boolean) => {
    logger.info(`handleSave called. isDraft: ${isDraft}`);
    if (!selectedReferential) {
      setError("Veuillez sélectionner un référentiel.");
      return;
    }
    if (!questionnaireName.trim()) {
      setError("Veuillez donner un nom au questionnaire.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    const now = new Date().toISOString();

    const finalTotalQuestions = isRandomized ? totalQuestions : selectedQuestionIds.length;
    const fullThemeDistribution = ensureFullThemeDistribution(themeDistribution);

    const questionnaireData = {
      name: questionnaireName,
      referential: selectedReferential as ReferentialType,
      passingThreshold,
      themeDistribution: fullThemeDistribution,
      isRandomized,
      eliminatoryCount,
      totalQuestions: finalTotalQuestions,
      questionIds: selectedQuestionIds,
      // status: isDraft ? 'draft' : 'final', // TODO: consider adding a status field to StoredQuestionnaire
    };

    try {
      if (editingQuestionnaire && editingQuestionnaire.id !== undefined) {
        // Ensure 'id' is not part of the payload for an update
        const updatePayload = { ...questionnaireData, updatedAt: now };
        await StorageManager.updateQuestionnaire(editingQuestionnaire.id, updatePayload);
        logger.info(`Questionnaire ${editingQuestionnaire.id} updated.`);
      } else {
        const addPayload = { ...questionnaireData, createdAt: now, updatedAt: now };
        const newId = await StorageManager.addQuestionnaire(addPayload);
        logger.info(`New questionnaire added with ID: ${newId}`);
      }
      if (onFormSubmit) onFormSubmit(true);
      if (onBackToList) onBackToList();
    } catch (err) {
      logger.error("Failed to save questionnaire:", err);
      setError("Erreur lors de l'enregistrement du questionnaire.");
      if (onFormSubmit) onFormSubmit(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fetch all questions from DB on mount
  useEffect(() => {
    const fetchAllQuestions = async () => {
      try {
        const questions = await StorageManager.getAllQuestions();
        setAllDbQuestions(questions);
      } catch (err) {
        logger.error("Failed to fetch all questions:", err);
        // This error is not critical for form display, but might affect question selection
        setError("Erreur lors du chargement de la bibliothèque de questions.");
      }
    };
    fetchAllQuestions();
  }, []);

  // Load existing questionnaire data if editingId is provided
  useEffect(() => {
    if (editingId) {
      setIsLoading(true);
      const loadQuestionnaire = async () => {
        try {
          const id = parseInt(editingId);
          const questionnaire = await StorageManager.getQuestionnaireById(id);
          if (questionnaire) {
            setEditingQuestionnaire(questionnaire);
            setQuestionnaireName(questionnaire.name);
            setSelectedReferential(questionnaire.referential as ReferentialType);
            setTotalQuestions(questionnaire.totalQuestions);
            setPassingThreshold(questionnaire.passingThreshold);
            setEliminatoryCount(questionnaire.eliminatoryCount);
            setThemeDistribution(ensureFullThemeDistribution(questionnaire.themeDistribution));
            setIsRandomized(questionnaire.isRandomized);
            setSelectedQuestionIds(questionnaire.questionIds || []);
            setError(null);
          } else {
            setError(`Questionnaire avec ID ${id} non trouvé.`);
            if (onBackToList) onBackToList(); // Navigate back if not found
          }
        } catch (err) {
          logger.error("Failed to load questionnaire:", err);
          setError("Impossible de charger le questionnaire pour modification.");
        } finally {
          setIsLoading(false);
        }
      };
      loadQuestionnaire();
    } else {
      setIsLoading(false); // Not loading anything if no ID
      // Reset form for new questionnaire
      setQuestionnaireName('');
      setSelectedReferential('');
      setTotalQuestions(40);
      setPassingThreshold(70);
      setEliminatoryCount(3);
      setThemeDistribution(ensureFullThemeDistribution({ reglementation: 15, securite: 15, technique: 10 }));
      setIsRandomized(false);
      setSelectedQuestionIds([]);
      setEditingQuestionnaire(null);
    }
  }, [editingId, onBackToList]);
  
  const referentialOptions = Object.entries(referentials).map(([value, label]) => ({
    value,
    label: `${value} - ${label}`,
  }));

  const handleReferentialChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const referential = e.target.value as ReferentialType;
    setSelectedReferential(referential);
    logger.info(`Référentiel sélectionné: ${referential}`);
    
    if (referential && referentialLimits[referential]) {
      const defaultTotal = Math.min(40, referentialLimits[referential].max);
      // Only update totalQuestions if it's not already set by an editing questionnaire
      if (!editingId) {
        setTotalQuestions(defaultTotal);
      }
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
    setThemeDistribution(prev => ensureFullThemeDistribution({ // Ensure it's always complete
      ...prev,
      [theme]: count
    }));
  };

  const handleRandomizeToggle = () => {
    const newIsRandomized = !isRandomized;
    setIsRandomized(newIsRandomized);
    logger.info(`Mode aléatoire ${newIsRandomized ? 'activé' : 'désactivé'}`);
    if (!newIsRandomized) {
      // If switching to manual, actual total questions is length of selected IDs
      setTotalQuestions(selectedQuestionIds.length);
    } else {
      // If switching to random, reset totalQuestions to a default or a sum of theme distribution.
      // For now, let's make it sum of current theme distribution, or a default like 40 if sum is 0.
      const sumOfThemes = Object.values(themeDistribution).reduce((s, c) => s + c, 0);
      setTotalQuestions(sumOfThemes > 0 ? sumOfThemes : 40);
    }
  };

  // currentTotalForDisplay is used for UI warnings and info.
  // If randomized, it's the sum of theme distribution.
  // If manual, it's the count of selected questions.
  const currentTotalForDisplay = isRandomized
    ? Object.values(themeDistribution).reduce((s, c) => s + c, 0)
    : selectedQuestionIds.length;

  // This state indicates if the sum of theme distribution matches the target totalQuestions in randomized mode.
  const themeDistributionMatchesTotal = isRandomized ? currentTotalForDisplay === totalQuestions : true;

  const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  const handleRandomizedSelection = async () => {
    if (!isRandomized || !selectedReferential || !themeDistributionMatchesTotal) {
      logger.warning("Conditions for randomized selection not met.", { isRandomized, selectedReferential, themeDistributionMatchesTotal });
      setError("Veuillez sélectionner un référentiel et vous assurer que la distribution par thème correspond au total de questions visé.");
      return;
    }

    logger.info("Starting randomized question selection...");
    setError(null); // Clear previous errors

    const questionsOfReferential = allDbQuestions.filter(q => q.referential === selectedReferential);
    if (questionsOfReferential.length === 0) {
      logger.warning(`No questions found for referential ${selectedReferential}.`);
      setError(`Aucune question disponible dans la bibliothèque pour le référentiel ${selectedReferential}.`);
      setSelectedQuestionIds([]);
      return;
    }

    let newSelectedIds: number[] = [];
    let unmetThemes: string[] = [];

    for (const [themeStr, count] of Object.entries(themeDistribution)) {
      const theme = themeStr as QuestionTheme;
      if (count === 0) continue;

      const questionsOfTheme = questionsOfReferential.filter(q => q.theme === theme);
      const shuffledThemeQuestions = shuffleArray(questionsOfTheme);

      const selectedForTheme = shuffledThemeQuestions.slice(0, count).map(q => q.id!);
      newSelectedIds.push(...selectedForTheme);

      if (selectedForTheme.length < count) {
        logger.warning(`Not enough questions for theme ${theme}. Wanted ${count}, got ${selectedForTheme.length}.`);
        unmetThemes.push(`${theme} (demandé: ${count}, trouvé: ${selectedForTheme.length})`);
      }
    }
    
    // Remove duplicates that could arise if a question somehow fits multiple specified theme entries (though unlikely with current enum)
    newSelectedIds = [...new Set(newSelectedIds)];

    // Ensure the total count does not exceed totalQuestions, though themeDistributionMatchesTotal should prevent this.
    // This is more of a safeguard or if logic changes.
    if (newSelectedIds.length > totalQuestions) {
        logger.info(`Random selection exceeded target of ${totalQuestions}, truncating to ${totalQuestions} questions.`);
        // This truncation should ideally be smart, e.g. proportionally from themes, but simple slice for now.
        newSelectedIds = shuffleArray(newSelectedIds).slice(0, totalQuestions);
    }
    
    setSelectedQuestionIds(newSelectedIds);
    logger.info("Randomized selection complete. Selected IDs:", newSelectedIds);

    if (unmetThemes.length > 0) {
      setError(`Certains thèmes n'ont pas pu être remplis: ${unmetThemes.join(', ')}. Total sélectionné: ${newSelectedIds.length}.`);
    } else if (newSelectedIds.length < totalQuestions) {
      setError(`Moins de questions sélectionnées (${newSelectedIds.length}) que le total visé (${totalQuestions}) dû à un manque de questions disponibles.`);
    }
  };


  // TODO: Rewrite generateQuestionsForPPTX -> prepareQuestionsForPPTX (async)
  // REMOVE old generateQuestionsForPPTX placeholder
  // const generateQuestionsForPPTX = (): Question[] => {
  // logger.warning("generateQuestionsForPPTX is using mock/outdated logic and needs to be updated.");
  // if (!selectedReferential) return [];
  // return [];
  // };

  const prepareQuestionsForPPTX = async (currentQuestionIds: number[]): Promise<Question[]> => {
    if (!selectedReferential || currentQuestionIds.length === 0) {
      return [];
    }
    
    logger.info("Preparing questions for PPTX generation from IDs:", currentQuestionIds);

    try {
      const questionPromises = currentQuestionIds.map(id => StorageManager.getQuestionById(id));
      const fetchedStoredQuestions = await Promise.all(questionPromises);

      const validStoredQuestions = fetchedStoredQuestions.filter(q => q !== undefined) as StoredQuestion[];
      
      const mappedQuestions: Question[] = validStoredQuestions.map(sq => {
        // Mapper le type string vers QuestionType
        let questionType: QuestionType;
        if (sq.type === 'multiple-choice') {
          questionType = QuestionType.QCM; // ou QCU selon la logique
        } else if (sq.type === 'true-false') {
          questionType = QuestionType.TrueFalse;
        } else {
          questionType = QuestionType.QCM; // valeur par défaut
        }
      
        return {
          id: sq.id!.toString(),
          text: sq.text,
          type: questionType, // Utiliser le type mappé
          options: sq.options,
          correctAnswer: /* votre logique existante */,
          timeLimit: sq.timeLimit,
          isEliminatory: sq.isEliminatory,
          referential: sq.referential,
          theme: sq.theme,
          image: sq.image,
          createdAt: sq.createdAt,
          usageCount: sq.usageCount,
          correctResponseRate: sq.correctResponseRate
        };
      });

      logger.info("Successfully prepared questions for PPTX:", mappedQuestions);
      return mappedQuestions;

    } catch (err) {
      logger.error("Error preparing questions for PPTX:", err);
      setError("Erreur lors de la préparation des questions pour l'export PPTX.");
      return [];
    }
  };

  // Effect to update PPTX questions when selectedQuestionIds changes
  useEffect(() => {
    if (selectedQuestionIds.length > 0) {
      prepareQuestionsForPPTX(selectedQuestionIds).then(setPreparedPptxQuestions);
    } else {
      setPreparedPptxQuestions([]);
    }
  }, [selectedQuestionIds, selectedReferential]); // Re-run if referential also changes, as it might affect question validity


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

  // Vérifier si on peut générer le PPTX
  // Use preparedPptxQuestions.length and selectedReferential for condition
  const canGeneratePPTX = questionnaireName.trim() !== '' && selectedReferential !== '' && preparedPptxQuestions.length > 0;
  // REMOVE: const generatedQuestions = canGeneratePPTX ? generateQuestionsForPPTX() : [];

  return (
    <div>
      {/* Display loading state for the whole form if initial questionnaire data is loading */}
      {editingId && isLoading && <p className="text-center my-4">Chargement des données du questionnaire...</p>}
      {/* Display error if initial loading failed AND not currently submitting */}
      {error && !isSubmitting && <p className="text-red-500 mb-4 p-3 bg-red-100 border border-red-400 rounded">{error}</p>}

      {!isLoading && (
      <>
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
              value={isRandomized ? totalQuestions : selectedQuestionIds.length}
              onChange={handleTotalQuestionsChange}
              min={isRandomized ? (referentialLimits[selectedReferential as ReferentialType]?.min || 10) : 0}
              max={isRandomized ? (referentialLimits[selectedReferential as ReferentialType]?.max || 60) : undefined} // No max in manual based on selection
              required
              disabled={!isRandomized}
            />
            {isRandomized && getLimitsWarning()} {/* Show limits warning only in randomized mode */}
          </div>
          
          <Input
            label="Seuil de réussite (%)"
            type="number"
            placeholder="Ex: 70"
            value={passingThreshold}
            onChange={(e) => setPassingThreshold(parseInt(e.target.value) || 0)}
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

      {/* Générateur PPTX - Affiché seulement si conditions are met and questions are prepared */}
      {canGeneratePPTX && (
        <PPTXGenerator
          questions={preparedPptxQuestions} // USE THE NEW STATE HERE
          questionnaireName={questionnaireName}
          referential={selectedReferential}
        />
      )}
      
      {/* Section for selecting questions - UI to be implemented based on isRandomized */}
      {isRandomized ? (
        <Card title="Configuration de la randomisation" className="mb-6">
          <p className="text-sm text-gray-600">
            Les questions seront sélectionnées aléatoirement depuis la bibliothèque
            en fonction du référentiel et de la distribution par thème ci-dessus.
            Le nombre total de questions visé est de {totalQuestions}.
            Actuellement, la distribution par thème totalise {currentTotalForDisplay}.
          </p>
          {!themeDistributionMatchesTotal && (
            <p className="text-sm text-amber-600 mt-2">
              Attention : La somme de la distribution par thème ({currentTotalForDisplay})
              ne correspond pas au nombre total de questions visé ({totalQuestions}). Veuillez ajuster.
            </p>
          )}
          <Button
            variant="outline"
            icon={<Shuffle size={16}/>}
            className="mt-4"
            onClick={handleRandomizedSelection} // Implement this function
            disabled={!selectedReferential || !themeDistributionMatchesTotal}
            title={!selectedReferential ? "Sélectionnez d'abord un référentiel" : !themeDistributionMatchesTotal ? "Ajustez la distribution ou le total" : "Générer la sélection"}
          >
            Générer/Rafraîchir la sélection aléatoire ({selectedQuestionIds.length} questions actuellement)
          </Button>
           {selectedQuestionIds.length > 0 && isRandomized && (
              <div className="mt-2 text-xs">
                IDs générés: {selectedQuestionIds.join(', ')}
              </div>
            )}
        </Card>
      ) : (
        // Manual selection section
        <Card title="Sélection manuelle des questions" className="mb-6">
          <div className="mb-4 flex justify-between items-center">
            <h4 className="text-sm font-medium text-gray-700">
              Questions sélectionnées ({selectedQuestionIds.length})
            </h4>
            {/* Input for total questions might be disabled or hidden in manual mode */}
            <Input
              label="Objectif (optionnel)"
              type="number"
              value={totalQuestions} // This is the "target" for manual, distinct from the auto-calculated total
              onChange={handleTotalQuestionsChange}
              className="w-1/4 text-sm"
              disabled={isRandomized} // Only enable if not randomized
              min={0}
              title={isRandomized ? "Non applicable en mode aléatoire" : "Objectif optionnel pour la sélection manuelle"}
            />
          </div>
          {/* Placeholder for manual question selection UI */}
          <div className="p-4 border border-dashed border-gray-300 rounded-lg text-center">
            <p className="text-sm text-gray-500">
              Interface de sélection manuelle des questions à implémenter ici.
              <br />
              Afficher les questions de `allDbQuestions` (filtrées par référentiel: {selectedReferential || 'aucun'}) et permettre la sélection.
              <br />
              Nombre de questions dans la bibliothèque pour ce référentiel: {allDbQuestions.filter(q => q.referential === selectedReferential).length}
            </p>
            {/* Example: List selected question IDs */}
            {selectedQuestionIds.length > 0 && (
              <div className="mt-2 text-xs text-gray-500">
                IDs des questions sélectionnées: {selectedQuestionIds.join(', ')}
              </div>
            )}
            <div className="mt-4 max-h-96 overflow-y-auto border border-gray-200 rounded-md">
              {allDbQuestions.filter(q => q.referential === selectedReferential).length === 0 && selectedReferential && (
                <p className="p-4 text-sm text-gray-500">Aucune question disponible pour le référentiel "{selectedReferential}" dans la bibliothèque.</p>
              )}
              {allDbQuestions.filter(q => q.referential === selectedReferential).map(question => (
                <div key={question.id} className="flex items-center justify-between p-3 border-b border-gray-100 hover:bg-gray-50">
                  <div className="text-sm">
                    <span className="font-medium text-gray-800">{question.text.substring(0, 100)}{question.text.length > 100 ? '...' : ''}</span>
                    <span className="ml-2 text-xs text-gray-500">({question.theme} - ID: {question.id})</span>
                  </div>
                  <Button
                    size="sm"
                    variant={selectedQuestionIds.includes(question.id!) ? "danger" : "outline"}
                    onClick={() => {
                      setSelectedQuestionIds(prevIds =>
                        prevIds.includes(question.id!)
                          ? prevIds.filter(id => id !== question.id!)
                          : [...prevIds, question.id!]
                      );
                    }}
                  >
                    {selectedQuestionIds.includes(question.id!) ? "Retirer" : "Ajouter"}
                  </Button>
                </div>
              ))}
              {!selectedReferential && (
                 <p className="p-4 text-sm text-gray-500">Veuillez d'abord sélectionner un référentiel pour voir les questions disponibles.</p>
              )}
            </div>
          </div>
        </Card>
      )}
      
      <div className="flex justify-between items-center mt-8">
        <Button variant="outline" onClick={onBackToList} disabled={isSubmitting || isLoading}>
          {editingId ? "Annuler les modifications" : "Annuler"}
        </Button>
        <div className="space-x-3">
          <Button variant="outline" icon={<Save size={16} />} disabled={isSubmitting || isLoading} onClick={() => handleSave(true)} >
            Enregistrer brouillon
          </Button>
          <Button
            variant="primary"
            icon={<Save size={16} />}
            disabled={isSubmitting || isLoading || (isRandomized && !themeDistributionMatchesTotal) || (isRandomized && selectedQuestionIds.length !== totalQuestions) }
            onClick={() => handleSave(false)}
            title={ (isRandomized && !themeDistributionMatchesTotal) ? "La distribution par thème ne correspond pas au total visé." : (isRandomized && selectedQuestionIds.length !== totalQuestions) ? `La sélection aléatoire (${selectedQuestionIds.length}) ne correspond pas au total visé (${totalQuestions}). Regénérez.` : ""}
          >
            {editingQuestionnaire ? "Mettre à jour" : "Valider et enregistrer"}
          </Button>
        </div>
      </div>
      {/* {isLoading && <p className="text-center my-4">Chargement du formulaire...</p>} */}
      {isSubmitting && <p className="text-center my-4">Enregistrement en cours...</p>}
      {/* Error display is now at the top when not submitting */}
      </>
      )}
    </div>
  );
};

// REMOVE THESE FUNCTIONS FROM HERE - THEY ARE NOW INSIDE THE COMPONENT
// const ensureFullThemeDistribution = ...
// const handleSave = ...

export default QuestionnaireForm;
export type QuestionTheme = 
  | 'reglementation'
  | 'securite'
  | 'technique';