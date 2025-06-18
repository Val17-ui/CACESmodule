import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, AlertTriangle, Edit2 } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import ThemeSelector from './ThemeSelector';
import PPTXGenerator from './PPTXGenerator';
import QuestionLibrary from './QuestionLibrary';
import { ReferentialType, referentials, QuestionTheme, questionThemes, referentialLimits, Question, QuestionType, CACESReferential, Questionnaire, StoredQuestion } from '../../types';
import { logger } from '../../utils/logger';
import { StorageManager, StoredQuestionnaire } from '../../services/StorageManager';

// Assuming QuestionForm is exported from QuestionLibrary module. Adjust if it's a direct import.
const SharedQuestionForm = QuestionLibrary.QuestionForm;


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
  const [isRandomized, setIsRandomized] = useState(!editingId);
  const [eliminatoryCount, setEliminatoryCount] = useState(3);
  const [themeDistribution, setThemeDistribution] = useState<Record<QuestionTheme, number>>({
    reglementation: 15,
    securite: 15,
    technique: 10,
  });
  const [manualQuestions, setManualQuestions] = useState<Question[]>([]);

  const [isQuestionDetailModalOpen, setIsQuestionDetailModalOpen] = useState(false);
  const [editingQuestionData, setEditingQuestionData] = useState<Question | null>(null);

  const [isQuestionLibModalOpen, setIsQuestionLibModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectQuestionsFromLib = async (selectedIds: string[]) => {
    if (selectedIds.length === 0) {
      setIsQuestionLibModalOpen(false);
      return;
    }
    setIsLoading(true);
    try {
      const newQuestions: Question[] = [];
      const existingManualQuestionIds = new Set(manualQuestions.map(q => q.id));
      for (const idStr of selectedIds) {
        if (!/^\d+$/.test(idStr)) {
          logger.warn(`Skipping non-numeric ID from selection: ${idStr}`);
          continue;
        }
        const numericId = Number(idStr);
        if (existingManualQuestionIds.has(idStr)) {
          logger.info(`Question with DB ID ${idStr} already in manualQuestions. Skipping.`);
          continue;
        }
        const questionFromStore: StoredQuestion | null = await StorageManager.getQuestionById(numericId);
        if (questionFromStore) {
          let formQuestionType = QuestionType.QCM;
           if (questionFromStore.type === 'multiple-choice') {
             formQuestionType = QuestionType.QCM;
           } else if (questionFromStore.type === 'true-false') {
             formQuestionType = QuestionType.TRUE_FALSE;
           } else {
             logger.warn(`Unmappable StoredQuestion type ${questionFromStore.type} during library import. Defaulting to QCM.`);
           }
          const questionToAdd: Question = {
            ...questionFromStore,
            id: String(questionFromStore.id),
            type: formQuestionType,
            usageCount: questionFromStore.usageCount !== undefined ? questionFromStore.usageCount : 0,
            correctResponseRate: questionFromStore.correctResponseRate !== undefined ? questionFromStore.correctResponseRate : 0,
            createdAt: questionFromStore.createdAt || new Date().toISOString(),
            updatedAt: questionFromStore.updatedAt || new Date().toISOString(),
            lastUsedAt: questionFromStore.lastUsedAt,
          };
          newQuestions.push(questionToAdd);
        } else {
          logger.warn(`Question with ID ${numericId} (string: ${idStr}) not found in storage.`);
        }
      }
      setManualQuestions(prev => [...prev, ...newQuestions].filter((q, index, self) =>
        index === self.findIndex((t) => t.id === q.id)
      ));
      setError(null);
    } catch (err) {
      logger.error('Failed to fetch selected questions from library', err);
      setError('Erreur lors de l’ajout des questions sélectionnées.');
    } finally {
      setIsQuestionLibModalOpen(false);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (editingId) {
      loadQuestionnaire(editingId);
    }
  }, [editingId]);

  useEffect(() => {
    if (!isRandomized) {
      setTotalQuestions(manualQuestions.length);
      setEliminatoryCount(manualQuestions.filter(q => q.isEliminatory).length);
    }
  }, [isRandomized, manualQuestions]);

  const loadQuestionnaire = async (id: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const questionnaire = await StorageManager.getQuestionnaireById(Number(id));
      if (questionnaire) {
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
          if (questionnaire.definedQuestions && questionnaire.definedQuestions.length > 0) {
            const loadedManualQuestions: Question[] = questionnaire.definedQuestions.map(dbQuestion => {
              let formQuestionType = QuestionType.QCM;
              if (dbQuestion.type === 'multiple-choice') formQuestionType = QuestionType.QCM;
              else if (dbQuestion.type === 'true-false') formQuestionType = QuestionType.TRUE_FALSE;
              else logger.warn(`Unmappable StoredQuestion type ${dbQuestion.type} during questionnaire load. Defaulting to QCM.`);
              return ({
                ...dbQuestion,
                id: String(dbQuestion.id),
                type: formQuestionType,
                usageCount: dbQuestion.usageCount !== undefined ? dbQuestion.usageCount : 0,
                correctResponseRate: dbQuestion.correctResponseRate !== undefined ? dbQuestion.correctResponseRate : 0,
                createdAt: dbQuestion.createdAt || new Date().toISOString(),
                updatedAt: dbQuestion.updatedAt || new Date().toISOString(),
              });
            });
            setManualQuestions(loadedManualQuestions);
          } else {
            setManualQuestions([]);
          }
          setThemeDistribution({ reglementation: 0, securite: 0, technique: 0 });
        }
      } else {
        setError("Questionnaire non trouvé.");
      }
    } catch (err) {
      logger.error('Failed to load questionnaire', { error: err, questionnaireId: id });
      setError('Impossible de charger le questionnaire');
    } finally {
      setIsLoading(false);
    }
  };

  const referentialOptions = Object.entries(referentials).map(([value, label]) => ({ value, label: `${value} - ${label}` }));

  const handleReferentialChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const referential = e.target.value as ReferentialType;
    setSelectedReferential(referential);
    if (referential && referentialLimits[referential] && isRandomized) {
      setTotalQuestions(Math.min(40, referentialLimits[referential].max));
    }
    setShowValidationWarning(referential === 'R482');
  };

  const handleTotalQuestionsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTotalQuestions(parseInt(e.target.value) || 0);
  };

  const handleThemeDistributionChange = (theme: QuestionTheme, count: number) => {
    setThemeDistribution(prev => ({ ...prev, [theme]: count }));
  };

  const handleModeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const wantsManualMode = event.target.checked;
    setIsRandomized(!wantsManualMode);
  };

  const handleSaveManualQuestionFromSharedForm = (savedDbQuestion: StoredQuestion) => {
    logger.info("Question saved/updated via shared form (DB representation):", savedDbQuestion);
    let formQuestionType: QuestionType;
    if (savedDbQuestion.type === 'multiple-choice') formQuestionType = QuestionType.QCM;
    else if (savedDbQuestion.type === 'true-false') formQuestionType = QuestionType.TRUE_FALSE;
    else {
      logger.warn(`Received unmappable question type from DB: "${savedDbQuestion.type}". Defaulting to QCM.`);
      formQuestionType = QuestionType.QCM;
    }

    const newOrUpdatedQuestion: Question = {
      text: savedDbQuestion.text, options: savedDbQuestion.options || [], correctAnswer: savedDbQuestion.correctAnswer,
      theme: savedDbQuestion.theme, referential: savedDbQuestion.referential, isEliminatory: savedDbQuestion.isEliminatory,
      id: String(savedDbQuestion.id), type: formQuestionType,
      usageCount: savedDbQuestion.usageCount !== undefined ? savedDbQuestion.usageCount : 0,
      correctResponseRate: savedDbQuestion.correctResponseRate !== undefined ? savedDbQuestion.correctResponseRate : 0,
      createdAt: savedDbQuestion.createdAt || new Date().toISOString(),
      updatedAt: savedDbQuestion.updatedAt || new Date().toISOString(),
      lastUsedAt: savedDbQuestion.lastUsedAt, timeLimit: savedDbQuestion.timeLimit,
    };
    setManualQuestions(prevManualQuestions => {
      const idToUpdate = editingQuestionData?.id || newOrUpdatedQuestion.id;
      const existingQuestionIndex = prevManualQuestions.findIndex(q => q.id === idToUpdate);
      if (existingQuestionIndex !== -1) {
        const updatedManualQuestions = [...prevManualQuestions];
        updatedManualQuestions[existingQuestionIndex] = newOrUpdatedQuestion;
        return updatedManualQuestions;
      } else {
        return [...prevManualQuestions, newOrUpdatedQuestion];
      }
    });
    setIsQuestionDetailModalOpen(false); setEditingQuestionData(null);
  };

  const handleDeleteManualQuestion = (id: string) => {
    setManualQuestions(prev => prev.filter(q => q.id !== id));
  };

  const getLimitsWarning = () => {
    if (!selectedReferential || !referentialLimits[selectedReferential as ReferentialType]) return null;
    const limits = referentialLimits[selectedReferential as ReferentialType];
    if (isRandomized && (totalQuestions < limits.min || totalQuestions > limits.max)) {
      return (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
          <AlertTriangle size={20} className="text-red-500 mr-2 flex-shrink-0 mt-0.5" />
          <div><p className="text-sm font-medium text-red-800">Nombre de questions hors limites</p><p className="text-sm text-red-700 mt-1">Pour le référentiel {selectedReferential}, le nombre de questions doit être entre {limits.min} et {limits.max}.</p></div>
        </div>);
    }
    return null;
  };

  const canShowManualPPTXGenerator = !isRandomized && manualQuestions.length > 0 && questionnaireName.trim() !== '' && selectedReferential !== '';

  const handleSave = async () => {
    if (!questionnaireName.trim()) { setError("Le nom du questionnaire est requis."); return; }
    if (!selectedReferential) { setError("Le référentiel est requis."); return; }
    if (!isRandomized && manualQuestions.length === 0) { setError("Ajoutez au moins une question en mode manuel."); return; }

    const now = new Date().toISOString();
    let questionnaireDataToSave: Omit<StoredQuestionnaire, 'id'>;
    setIsLoading(true); setError(null);

    try {
      if (isRandomized) {
        questionnaireDataToSave = {
          name: questionnaireName, referential: selectedReferential as CACESReferential, isRandomized: true,
          passingThreshold: passingThreshold, themeDistribution: themeDistribution, totalQuestions: totalQuestions,
          eliminatoryCount: eliminatoryCount, questionIds: [], definedQuestions: [], createdAt: now, updatedAt: now,
        };
      } else {
        // Manual questions are now assumed to have valid DB IDs (stringified)
        // because they are saved via library/QuestionForm which calls StorageManager.addQuestion/updateQuestion.
        // The old logic for saving "custom-" questions on the fly here is removed.
        const definedQuestionsForDb: StoredQuestion[] = manualQuestions.map(q => {
          const { id, type: formQuestionType, ...rest } = q;
          let dbQuestionType: StoredQuestion['type'];
          if (formQuestionType === QuestionType.QCM || formQuestionType === QuestionType.QCU) dbQuestionType = 'multiple-choice';
          else if (formQuestionType === QuestionType.TRUE_FALSE) dbQuestionType = 'true-false';
          else {
            logger.error(`Unsupported QuestionType in manualQuestions during save: ${formQuestionType} for QID ${id}`);
            throw new Error("Type de question manuel non supporté pour la sauvegarde du questionnaire.");
          }
          return { ...rest, id: Number(id), type: dbQuestionType } as StoredQuestion; // Ensure StoredQuestion structure
        });
        questionnaireDataToSave = {
          name: questionnaireName, referential: selectedReferential as CACESReferential, isRandomized: false,
          passingThreshold: passingThreshold, themeDistribution: { reglementation: 0, securite: 0, technique: 0 },
          totalQuestions: manualQuestions.length, eliminatoryCount: manualQuestions.filter(q => q.isEliminatory).length,
          definedQuestions: definedQuestionsForDb, questionIds: [], createdAt: now, updatedAt: now,
        };
      }
      if (editingId) {
        await StorageManager.updateQuestionnaire(Number(editingId), questionnaireDataToSave);
      } else {
        await StorageManager.addQuestionnaire(questionnaireDataToSave);
      }
      onFormSubmit?.(true);
      if (onBackToList) onBackToList();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error('Failed to save questionnaire', { error: err, savedDataAttempt: questionnaireDataToSave });
      setError(`Échec: ${errorMsg}`);
      onFormSubmit?.(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && editingId) {
    return (<div className="flex items-center justify-center py-12"><div className="text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div><p className="text-gray-600">Chargement du questionnaire...</p></div></div>);
  }

  return (
    <div>
      {error && (<div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center space-x-2"><AlertTriangle size={20} className="flex-shrink-0" /><span>{error}</span></div>)}
      <Card title="Informations générales" className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input label="Nom du questionnaire" placeholder="Ex: CACES R489 Standard" value={questionnaireName} onChange={(e) => setQuestionnaireName(e.target.value)} required />
          <Select label="Référentiel CACES" options={referentialOptions} value={selectedReferential} onChange={handleReferentialChange} placeholder="Sélectionner un référentiel" required />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
          <div>
            <Input label="Nombre total de questions" type="number" value={totalQuestions} onChange={handleTotalQuestionsChange} min={isRandomized ? (referentialLimits[selectedReferential as ReferentialType]?.min || 10) : 0} max={isRandomized ? (referentialLimits[selectedReferential as ReferentialType]?.max || 60) : undefined} required disabled={!isRandomized} />
            {!isRandomized && (<p className="mt-1 text-xs text-gray-500">Automatiquement calculé d'après le nombre de questions manuelles ajoutées.</p>)}
            {isRandomized && getLimitsWarning()}
          </div>
          <Input label="Seuil de réussite (%)" type="number" placeholder="Ex: 70" min={0} max={100} value={passingThreshold} onChange={(e) => setPassingThreshold(parseInt(e.target.value) || 70)} required />
          <div>
            <Input label="Nombre de questions éliminatoires" type="number" value={eliminatoryCount} onChange={(e) => setEliminatoryCount(parseInt(e.target.value) || 0)} min={isRandomized ? 2 : 0} max={isRandomized ? 5 : undefined} required disabled={!isRandomized} />
            {!isRandomized && (<p className="mt-1 text-xs text-gray-500">Automatiquement calculé d'après les questions manuelles marquées comme éliminatoires.</p>)}
          </div>
        </div>
        <div className="mt-4 flex items-center space-x-2">
          <input type="checkbox" id="manualModeToggle" checked={!isRandomized} onChange={handleModeChange} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
          <label htmlFor="manualModeToggle" className="text-sm text-gray-700">Ajouter des questions manuellement (désactive la génération aléatoire)</label>
        </div>
        {showValidationWarning && (<div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start"><AlertTriangle size={20} className="text-amber-500 mr-2 flex-shrink-0 mt-0.5" /><div><p className="text-sm font-medium text-amber-800">Attention : Version du référentiel</p><p className="text-sm text-amber-700 mt-1">Le référentiel R482 a été mis à jour. Certaines questions pourraient ne plus être conformes à la dernière version réglementaire.</p></div></div>)}
      </Card>

      {isRandomized && (<ThemeSelector distribution={themeDistribution} onDistributionChange={handleThemeDistributionChange} totalQuestions={totalQuestions} isRandomized={isRandomized} selectedReferential={selectedReferential} />)}
      {canShowManualPPTXGenerator && (<PPTXGenerator questions={manualQuestions} questionnaireName={questionnaireName} referential={selectedReferential} />)}

      {!isRandomized && (
        <Card title="Questions manuelles" className="mb-6">
          <div className="mb-4 flex justify-between items-center">
            <h4 className="text-sm font-medium text-gray-700">Questions sélectionnées ({manualQuestions.length})</h4>
            <div>
              <Button variant="outline" size="sm" onClick={() => { setEditingQuestionData(null); setIsQuestionDetailModalOpen(true); }} className="mr-2">Ajouter question personnalisée</Button>
              <Button variant="outline" size="sm" onClick={() => setIsQuestionLibModalOpen(true)}>Ajouter depuis la bibliothèque</Button>
            </div>
          </div>
          {manualQuestions.length === 0 && (<p className="text-sm text-gray-500 py-4 text-center">Aucune question manuelle ajoutée.</p>)}
          <div className="space-y-3">
            {manualQuestions.map((q, index) => (
              <div key={q.id} className="p-3 border rounded-lg bg-gray-50">
                <div className="flex justify-between items-start">
                  <p className="font-medium text-sm text-gray-800 flex-1 break-words mr-2">{index + 1}. {q.text}</p>
                  <div className="flex space-x-2 flex-shrink-0">
                    <Button variant="outline" size="sm" icon={<Edit2 size={14} />} onClick={() => { setEditingQuestionData(q); setIsQuestionDetailModalOpen(true); }} aria-label="Modifier la question">Modifier</Button>
                    <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} aria-label="Supprimer la question" onClick={() => handleDeleteManualQuestion(q.id)} />
                  </div>
                </div>
                <p className="text-xs text-gray-600 mt-1">Type: {q.type} | Thème: {q.theme} | Réf: {q.referential} {q.isEliminatory ? "| Éliminatoire" : ""}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {isQuestionLibModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative p-8 border w-full max-w-4xl shadow-lg rounded-md bg-white">
            <div className="absolute top-0 right-0 pt-4 pr-4">
              <button onClick={() => setIsQuestionLibModalOpen(false)} className="text-gray-400 hover:text-gray-600" aria-label="Close modal"><svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Sélectionner des questions depuis la bibliothèque</h3>
            <QuestionLibrary isSelectionMode={true} onQuestionsSelected={handleSelectQuestionsFromLib} />
            <div className="mt-6 flex justify-end">
              <Button variant="outline" onClick={() => setIsQuestionLibModalOpen(false)}>Fermer</Button>
            </div>
          </div>
        </div>
      )}

      {isQuestionDetailModalOpen && (
         <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative p-6 border w-full max-w-3xl shadow-lg rounded-md bg-white">
            <div className="absolute top-0 right-0 pt-4 pr-4">
              <button onClick={() => { setIsQuestionDetailModalOpen(false); setEditingQuestionData(null); }} className="text-gray-400 hover:text-gray-600" aria-label="Close modal"><svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <h3 className="text-xl font-semibold leading-6 text-gray-900 mb-6">
              {editingQuestionData?.id && !editingQuestionData.id.startsWith('custom-') ? 'Modifier la question manuelle existante' : (editingQuestionData?.id ? 'Modifier la question personnalisée' : 'Ajouter une nouvelle question personnalisée')}
            </h3>
            <SharedQuestionForm
              key={editingQuestionData?.id || 'new-manual-q'}
              questionId={(editingQuestionData && /^\d+$/.test(editingQuestionData.id)) ? Number(editingQuestionData.id) : undefined}
              initialData={editingQuestionData ? { ...editingQuestionData, type: editingQuestionData.type, } : { referential: selectedReferential as CACESReferential, type: QuestionType.QCM }}
              forcedReferential={selectedReferential as CACESReferential}
              onSave={handleSaveManualQuestionFromSharedForm}
              onCancel={() => { setIsQuestionDetailModalOpen(false); setEditingQuestionData(null); }}
            />
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={onBackToList}>Annuler</Button>
        <div className="space-x-3">
          <Button variant="outline" icon={<Save size={16} />}>Enregistrer brouillon</Button>
          <Button variant="primary" icon={<Save size={16} />} onClick={handleSave} disabled={isLoading}>Valider et enregistrer</Button>
        </div>
      </div>
    </div>
  );
};
export default QuestionnaireForm;
