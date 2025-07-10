import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Trash2, Save, Image as ImageIconLucide } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import { QuestionType, CACESReferential, Referential, Theme, Bloc, StoredQuestion } from '../../types';
import { StorageManager } from '../../services/StorageManager';
import { logger } from '../../utils/logger';

interface QuestionFormProps {
  onSave: (question: StoredQuestion) => void;
  onCancel: () => void;
  questionId?: number | null;
  forcedReferential?: CACESReferential; // This represents the CACES code e.g. "R489"
  initialData?: Partial<Omit<StoredQuestion, 'id'>>;
}

const QuestionForm: React.FC<QuestionFormProps> = ({
  onSave,
  onCancel,
  questionId,
  forcedReferential,
  initialData
}) => {
  const getInitialState = useCallback((): StoredQuestion => {
    let baseState: Omit<StoredQuestion, 'referential' | 'theme'> & { blocId?: number | undefined } = {
      text: '',
      type: 'multiple-choice',
      options: ['', '', '', ''],
      correctAnswer: '',
      timeLimit: 30,
      isEliminatory: false,
      image: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 0,
      correctResponseRate: 0,
      blocId: undefined,
    };

    if (initialData) {
      const { type: initialDataType, blocId: initialBlocId, ...restInitialData } = initialData;
      let mappedType = baseState.type;

      if (initialDataType !== undefined) {
        if (initialDataType === QuestionType.QCM || initialDataType === QuestionType.QCU) {
          mappedType = 'multiple-choice';
        } else if (initialDataType === QuestionType.TrueFalse) {
          mappedType = 'true-false';
        } else {
          logger.info(`WARN: Initial data has unmapped or incompatible question type: ${initialDataType}. Using default type '${mappedType}'.`);
        }
      }
      const { referential, theme, ...validRestInitialData } = restInitialData as any;

      baseState = { ...baseState, ...validRestInitialData, type: mappedType, blocId: initialBlocId };
    }
    return baseState as StoredQuestion;
  }, [initialData]);

  const [question, setQuestion] = useState<StoredQuestion>(getInitialState);
  const [hasImage, setHasImage] = useState(false);
  const [imageFile, setImageFile] = useState<Blob | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const [availableReferentiels, setAvailableReferentiels] = useState<Referential[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [blocs, setBlocs] = useState<Bloc[]>([]);

  const [selectedReferentialId, setSelectedReferentialId] = useState<string>('');
  const [selectedThemeId, setSelectedThemeId] = useState<string>('');
  const [selectedBlocId, setSelectedBlocId] = useState<string>('');

  useEffect(() => {
    StorageManager.getAllReferentiels().then(data => {
      setAvailableReferentiels(data);
      if (forcedReferential) {
        const forcedRefObject = data.find(r => r.code === forcedReferential);
        if (forcedRefObject && forcedRefObject.id !== undefined) {
          setSelectedReferentialId(forcedRefObject.id.toString());
        }
      }
    });
  }, [forcedReferential]);

  const referentialOptions = useMemo(() => {
    return availableReferentiels.map(r => ({
      value: r.id!.toString(),
      label: r.code
    }));
  }, [availableReferentiels]);

  useEffect(() => {
    if (selectedReferentialId) {
      StorageManager.getThemesByReferentialId(parseInt(selectedReferentialId, 10)).then(data => {
        setThemes(data);
        setSelectedThemeId('');
        setBlocs([]);
        setSelectedBlocId('');
      });
    } else {
      setThemes([]);
      setBlocs([]);
      setSelectedThemeId('');
      setSelectedBlocId('');
    }
  }, [selectedReferentialId]);

  useEffect(() => {
    if (selectedThemeId) {
      StorageManager.getBlocsByThemeId(parseInt(selectedThemeId, 10)).then(data => {
        setBlocs(data);
        setSelectedBlocId('');
      });
    } else {
      setBlocs([]);
      setSelectedBlocId('');
    }
  }, [selectedThemeId]);

  useEffect(() => {
    setQuestion((prev: StoredQuestion) => ({ ...prev, blocId: selectedBlocId ? parseInt(selectedBlocId, 10) : undefined }));
  }, [selectedBlocId]);

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  // Effect to initialize/reset form based on questionId or initialData
  useEffect(() => {
    const loadQuestionData = async () => {
      if (questionId) { // Editing existing question
        setIsLoading(true);
        try {
          const existingQuestion = await StorageManager.getQuestionById(questionId);
          if (existingQuestion) {
            setQuestion(existingQuestion); // This is StoredQuestion, so it has blocId

            if (existingQuestion.blocId) {
              const bloc = await StorageManager.getBlocById(existingQuestion.blocId);
              if (bloc && bloc.theme_id) {
                const theme = await StorageManager.getThemeById(bloc.theme_id);
                if (theme && theme.referentiel_id) {
                  setSelectedReferentialId(theme.referentiel_id.toString());
                  sessionStorage.setItem('pendingThemeIdForEdit', theme.id!.toString());
                  sessionStorage.setItem('pendingBlocIdForEdit', bloc.id!.toString());
                }
              }
            } else {
                if (!forcedReferential) setSelectedReferentialId('');
                setSelectedThemeId('');
                setSelectedBlocId('');
            }

            if (existingQuestion.image instanceof Blob) {
              if (imagePreview) URL.revokeObjectURL(imagePreview);
              setHasImage(true);
              setImageFile(existingQuestion.image);
              setImagePreview(URL.createObjectURL(existingQuestion.image));
            } else {
              if (imagePreview) URL.revokeObjectURL(imagePreview);
              setHasImage(false); setImageFile(null); setImagePreview(null);
            }
          } else {
            logger.error(`Question with id ${questionId} not found. Resetting form.`);
            setQuestion(getInitialState()); // Reset to new initial state
            setSelectedReferentialId(''); setSelectedThemeId(''); setSelectedBlocId('');
            if (imagePreview) URL.revokeObjectURL(imagePreview);
            setHasImage(false); setImageFile(null); setImagePreview(null);
          }
        } catch (error) {
          logger.error("Error fetching question: ", error);
          setQuestion(getInitialState());
          setSelectedReferentialId(''); setSelectedThemeId(''); setSelectedBlocId('');
          if (imagePreview) URL.revokeObjectURL(imagePreview);
          setHasImage(false); setImageFile(null); setImagePreview(null);
        } finally {
          setIsLoading(false);
        }
      } else { // Creating a new question or re-initializing
        const newInitialState = getInitialState();
        setQuestion(newInitialState);
        // Reset selections unless forcedReferential dictates the first one
        if (!forcedReferential) {
            setSelectedReferentialId('');
        }
        setSelectedThemeId('');
        setSelectedBlocId('');


        if (imagePreview) URL.revokeObjectURL(imagePreview);

        if (newInitialState.image instanceof Blob) {
          setHasImage(true); setImageFile(newInitialState.image); setImagePreview(URL.createObjectURL(newInitialState.image));
        } else {
          setHasImage(false); setImageFile(null); setImagePreview(null);
        }
      }
    };
    loadQuestionData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId, getInitialState]); // forcedReferential is handled by referential load effect

  useEffect(() => {
    if (themes.length > 0 && questionId) {
        const pendingThemeId = sessionStorage.getItem('pendingThemeIdForEdit');
        if (pendingThemeId && themes.some(t => t.id?.toString() === pendingThemeId)) {
            setSelectedThemeId(pendingThemeId);
            sessionStorage.removeItem('pendingThemeIdForEdit');
        }
    }
  }, [themes, questionId]);

  useEffect(() => {
    if (blocs.length > 0 && questionId) {
        const pendingBlocId = sessionStorage.getItem('pendingBlocIdForEdit');
        if (pendingBlocId && blocs.some(b => b.id?.toString() === pendingBlocId)) {
            setSelectedBlocId(pendingBlocId);
            sessionStorage.removeItem('pendingBlocIdForEdit');
        }
    }
  }, [blocs, questionId]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setQuestion((prev: StoredQuestion) => ({ ...prev, [name]: name === 'timeLimit' ? parseInt(value, 10) : value }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    if (name === 'isEliminatory') {
      setQuestion((prev: StoredQuestion) => ({ ...prev, [name]: checked }));
    } else if (name === 'hasImageToggle') {
      setHasImage(checked);
      if (!checked) {
        if (imagePreview) {
          URL.revokeObjectURL(imagePreview);
        }
        setImageFile(null);
        setImagePreview(null);
        setQuestion((prev: StoredQuestion) => ({ ...prev, image: undefined }));
      }
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...(question.options || [])];
    newOptions[index] = value;
    setQuestion((prev: StoredQuestion) => ({ ...prev, options: newOptions }));
  };

  const addOption = () => {
    if ((question.options?.length || 0) < 4) {
     setQuestion((prev: StoredQuestion) => ({ ...prev, options: [...(prev.options || []), ''] }));
    }
  };

  const removeOption = (index: number) => {
    if ((question.options?.length || 0) > 2) {
      const newOptions = (question.options || []).filter((_: string, i: number) => i !== index);
      setQuestion((prev: StoredQuestion) => ({ ...prev, options: newOptions }));
      if (Number(question.correctAnswer) === index) {
        setQuestion((prev: StoredQuestion) => ({...prev, correctAnswer: '0'}));
      } else if (Number(question.correctAnswer) > index) {
         setQuestion((prev: StoredQuestion) => ({...prev, correctAnswer: (Number(prev.correctAnswer) -1).toString()}));
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
      setImageFile(file); // Store as File object
      setImagePreview(URL.createObjectURL(file));
      setHasImage(true);
    }
  };

  const removeImage = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(null);
    setImagePreview(null);
    setHasImage(false);
    const fileInput = document.getElementById('image-upload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const validateForm = (): boolean => {
    logger.info('validateForm called. Current theme value:', question.theme);
    const newErrors: Record<string, string> = {};
    if (!question.text.trim()) newErrors.text = 'Le texte de la question est requis.';
    // question.type is now 'multiple-choice' or 'true-false'
    if (question.type === 'multiple-choice') {
      if (!question.options || question.options.length < 2 || question.options.some(opt => !(opt || "").trim())) {
        newErrors.options = 'Au moins deux options sont requises et toutes les options doivent être remplies.';
      }
      const correctIndex = parseInt(question.correctAnswer, 10);
      if (isNaN(correctIndex) || correctIndex < 0 || correctIndex >= (question.options?.length || 0) || !question.options?.[correctIndex]?.trim()) {
         newErrors.correctAnswer = 'La réponse correcte doit être l\'une des options valides et non vide.';
      }
    }
    // For 'true-false', correctAnswer might be "true" or "false" string, or "0" / "1". Validation might be needed if specific.
    // Current validation for correctAnswer is tied to options index, so it's implicitly for 'multiple-choice'.

    // timeLimit is guaranteed to be a number by getInitialState and handleInputChange (though it might become NaN if input is bad before blur)
    // parseInt(value, 10) in handleInputChange can result in NaN.
    // Let's ensure timeLimit is always a valid number for this check.
    if (typeof question.timeLimit !== 'number' || isNaN(question.timeLimit) || question.timeLimit <= 0) {
        newErrors.timeLimit = 'Le temps limite doit être un nombre positif.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      logger.warn('Validation échouée', errors);
      return;
    }

    const finalBlocId = selectedBlocId ? parseInt(selectedBlocId, 10) : undefined;
    if (!finalBlocId) {
        setErrors(prev => ({...prev, bloc: 'Un bloc de compétences doit être sélectionné.'}));
        logger.warn('Validation échouée: Bloc de compétences non sélectionné.');
        return;
    }

    let imageToSave: Blob | undefined = undefined;
    if (hasImage && imageFile) {
      imageToSave = imageFile instanceof File ? new Blob([imageFile], { type: imageFile.type }) : imageFile;
    }

    const { referential, theme, id: currentId, ...dataToSave } = question;

    const questionDataForSave: Omit<StoredQuestion, 'id' | 'referential' | 'theme'> & { id?: number, blocId: number } = {
      ...dataToSave,
      blocId: finalBlocId,
      image: imageToSave,
      options: question.options?.map((opt: string) => opt.toString()) || [],
      createdAt: currentId ? question.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      correctAnswer: question.correctAnswer,
    };

    logger.info("Data prepared for saving in handleSave:", questionDataForSave);

    try {
      setIsLoading(true);
      let savedQuestionResult: StoredQuestion;

      if (questionId) {
        logger.info(`Calling StorageManager.updateQuestion for ID ${questionId}`);
        await StorageManager.updateQuestion(questionId, questionDataForSave);
        logger.success('Question modifiée avec succès');
        savedQuestionResult = { ...questionDataForSave, id: questionId };
      } else {
        logger.info(`Calling StorageManager.addQuestion`);
        const newId = await StorageManager.addQuestion(questionDataForSave as Omit<StoredQuestion, 'id'>);
        logger.success(`Question créée avec succès avec l'ID: ${newId}`);
        if (newId === undefined) {
          throw new Error("Failed to create question, new ID is undefined.");
        }
        savedQuestionResult = { ...questionDataForSave, id: newId };
      }
      onSave(savedQuestionResult);
    } catch (error) {
      logger.error("Error saving question in handleSave: ", error);
      setErrors((prev: Record<string, string>) => ({...prev, form: `Erreur lors de la sauvegarde: ${error instanceof Error ? error.message : String(error)}`}));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddOption = () => {
    addOption();
  };

  // Define useMemo hooks at the top level of the component body
  const themeOptions = useMemo(() => {
    return themes.map(t => ({ value: t.id!.toString(), label: t.name }));
  }, [themes]);

  const blocOptions = useMemo(() => {
    return blocs.map(b => ({ value: b.id!.toString(), label: b.name }));
  }, [blocs]);

  // Single conditional return for loading state
  if (isLoading && questionId) {
    return <div className="p-4">Chargement de la question...</div>;
  }

  // Main component return
  return (
    <div>
      <Card title="Informations générales" className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Select
            label="Recommandation CACES *"
            options={referentialOptions}
            value={selectedReferentialId}
            onChange={(e) => setSelectedReferentialId(e.target.value)}
            name="selectedReferentialId"
            placeholder="Sélectionner une recommandation"
            required
            disabled={!!forcedReferential || isLoading}
            error={errors.referential}
          />
          <Select
            label="Thème *"
            options={themeOptions}
            value={selectedThemeId}
            onChange={(e) => setSelectedThemeId(e.target.value)}
            name="selectedThemeId"
            placeholder={selectedReferentialId ? "Sélectionner un thème" : "Choisir d'abord une recommandation"}
            required
            disabled={!selectedReferentialId || isLoading}
            error={errors.theme}
          />
          <Select
            label="Bloc de compétences *"
            options={blocOptions}
            value={selectedBlocId}
            onChange={(e) => setSelectedBlocId(e.target.value)}
            name="selectedBlocId"
            placeholder={selectedThemeId ? "Sélectionner un bloc" : "Choisir d'abord un thème"}
            required
            disabled={!selectedThemeId || isLoading}
            error={errors.bloc}
          />
        </div>
        {errors.form && <p className="text-red-500 text-xs mt-2">{errors.form}</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <Input
            label="Temps limite (secondes)"
            type="number"
            name="timeLimit"
            value={(question.timeLimit ?? 30).toString()}
            onChange={handleInputChange}
            min={5}
            max={120}
            error={errors.timeLimit}
          />
          <div className="flex items-center space-x-4 mt-6">
            <label htmlFor="isEliminatoryCheckbox" className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                id="isEliminatoryCheckbox"
                name="isEliminatory"
                checked={!!question.isEliminatory}
                onChange={handleCheckboxChange}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Question éliminatoire</span>
            </label>
          </div>
        </div>
      </Card>

      <Card title="Contenu de la question" className="mb-6">
        <div className="mb-6">
          <label htmlFor="questionTextarea" className="block text-sm font-medium text-gray-700 mb-2">
            Texte de la question *
          </label>
          <textarea
            id="questionTextarea"
            name="text"
            rows={4}
            value={question.text}
            onChange={handleInputChange}
            className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="Entrez le texte de la question..."
            required
          />
           {errors.text && <p className="text-red-500 text-xs mt-1">{errors.text}</p>}
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <label className="block text-sm font-medium text-gray-700">
              Image associée (optionnel)
            </label>
            <label htmlFor="hasImageToggleCheckbox" className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                id="hasImageToggleCheckbox"
                name="hasImageToggle"
                checked={hasImage}
                onChange={handleCheckboxChange}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Ajouter une image</span>
            </label>
          </div>

          {hasImage && (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
              <div className="text-center">
                <ImageIconLucide className="mx-auto h-12 w-12 text-gray-400" />
                <div className="mt-4">
                  <label htmlFor="image-upload" className="cursor-pointer">
                    <span className="mt-2 block text-sm font-medium text-gray-900">
                      {imagePreview ? "Changer l'image" : "Sélectionner une image"}
                    </span>
                    <input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="sr-only"
                    />
                  </label>
                  <p className="mt-1 text-xs text-gray-500">
                    PNG, JPG, GIF jusqu'à 10MB
                  </p>
                </div>
                {imagePreview && (
                   <div className="mt-2 relative group inline-block">
                    <img src={imagePreview} alt="Prévisualisation" className="max-h-40 rounded" />
                    <Button
                      variant="danger"
                      size="sm"
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100"
                      onClick={removeImage}
                      type="button"
                    >
                      <Trash2 size={16}/>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card title="Options de réponse" className="mb-6">
        <div className="space-y-4">
          {(question.options || []).map((option: string, index: number) => (
            <div key={index} className="flex items-center gap-4">
              <div className="flex-shrink-0">
                <input
                  type="radio"
                  name={`correctAnswerRadio`} // Common name for the radio group
                  value={index.toString()}
                  checked={question.correctAnswer === index.toString()}
                  onChange={(e) => setQuestion((prev: StoredQuestion) => ({ ...prev, correctAnswer: e.target.value }))}
                  className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1">
                <Input
                  placeholder={`Option ${String.fromCharCode(65 + index)}`}
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  className="mb-0" // Ensure styles are applied if this class is functional
                />
              </div>
              <div className="flex-shrink-0">
                { (question.options?.length || 0) > 2 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 size={16} />}
                    onClick={() => removeOption(index)}
                    type="button"
                  />
                )}
              </div>
            </div>
          ))}
           {errors.options && <p className="text-red-500 text-xs mt-1">{errors.options}</p>}
           {errors.correctAnswer && <p className="text-red-500 text-xs mt-1">{errors.correctAnswer}</p>}
        </div>

        { (question.options?.length || 0) < 4 && (
          <div className="mt-4">
            <Button
              variant="outline"
              icon={<Plus size={16} />}
              onClick={handleAddOption}
              type="button"
            >
              Ajouter une option
            </Button>
          </div>
        )}

        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Réponse correcte :</strong> Option {question.correctAnswer ? String.fromCharCode(65 + parseInt(question.correctAnswer,10)) : 'N/A'}
          </p>
        </div>
      </Card>

      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={onCancel} type="button">
          Annuler
        </Button>
        <Button variant="primary" icon={<Save size={16} />} onClick={handleSave} type="button" disabled={isLoading}>
          {isLoading ? 'Sauvegarde...' : (questionId ? 'Modifier la question' : 'Créer la question')}
        </Button>
      </div>
    </div>
  );
};

export default QuestionForm;