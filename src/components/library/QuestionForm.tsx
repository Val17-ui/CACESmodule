import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Image as ImageIconLucide } from 'lucide-react'; // Removed Upload
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
// import Badge from '../ui/Badge'; // Removed Badge
// Removed Question, questionTypes
import { QuestionType, CACESReferential, QuestionTheme, referentials, questionThemes } from '../../types';
import { StorageManager, StoredQuestion } from '../../services/StorageManager';
import { logger } from '../../utils/logger';

interface QuestionFormProps {
  onSave: (question: StoredQuestion) => void;
  onCancel: () => void;
  questionId?: number | null;
  forcedReferential?: CACESReferential; // New prop
  initialData?: Partial<Omit<StoredQuestion, 'id'>>; // New prop for pre-filling
}

const QuestionForm: React.FC<QuestionFormProps> = ({
  onSave,
  onCancel,
  questionId,
  forcedReferential, // Destructure new prop
  initialData // Destructure new prop
}) => {
  const getInitialState = (): StoredQuestion => {
    // Default base state using string literal types as required by StoredQuestion
    let baseState: StoredQuestion = {
      text: '',
      type: 'multiple-choice',
      options: ['', '', '', ''],
      correctAnswer: '', // Default for 'multiple-choice' should be an index string e.g. "0"
      timeLimit: 30,
      isEliminatory: false,
      referential: CACESReferential.R489,
      theme: 'reglementation',
      image: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 0,
      correctResponseRate: 0
    };

    if (initialData) {
      const { type: initialDataType, ...restInitialData } = initialData;
      let mappedType = baseState.type; // Default to baseState's type

      if (initialDataType !== undefined) { // Check if type is actually provided in initialData
        if (initialDataType === QuestionType.QCM || initialDataType === QuestionType.QCU) {
          mappedType = 'multiple-choice';
        } else if (initialDataType === QuestionType.TrueFalse) { // Corrected enum member
          mappedType = 'true-false';
        } else {
          logger.info(`WARN: Initial data has unmapped or incompatible question type: ${initialDataType}. Using default type '${mappedType}'.`); // Changed logger
        }
      }
      baseState = { ...baseState, ...restInitialData, type: mappedType };
    }

    if (forcedReferential) { // `forcedReferential` overrides any other referential
      baseState.referential = forcedReferential;
    }
    return baseState;
  };

  const [question, setQuestion] = useState<StoredQuestion>(getInitialState);
  // Initialize hasImage, imageFile, imagePreview based on the 'question' state,
  // which is now correctly initialized by getInitialState().
  // This will be handled by the useEffect hook that depends on 'questionId' and 'initialData'
  // or might need a separate useEffect for 'question.image' if 'question' itself is the source of truth.
  // For now, let's rely on the main useEffect to set these up after 'question' state is stable.
  const [hasImage, setHasImage] = useState(false);
  const [imageFile, setImageFile] = useState<Blob | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const referentialOptions = Object.entries(referentials).map(([value, label]) => ({
    value,
    label: `${value} - ${label}`,
  }));

  const themeOptions = Object.entries(questionThemes).map(([value, label]) => ({
    value,
    label
  }));

  // Removed the first, older useEffect that was causing issues with 'initialQuestionState'

  // Effect to initialize/reset form based on questionId, initialData, and forcedReferential
  useEffect(() => {
    if (questionId) { // Editing existing question
      setIsLoading(true);
      StorageManager.getQuestionById(questionId)
        .then(existingQuestion => {
          if (existingQuestion) {
            // Ensure all fields from getInitialState() are present as defaults if not in existingQuestion
            let questionToSet = { ...getInitialState(), ...existingQuestion };
            if (forcedReferential) {
              questionToSet.referential = forcedReferential;
            }
            setQuestion(questionToSet);

            if (questionToSet.image instanceof Blob) {
              if (imagePreview) URL.revokeObjectURL(imagePreview);
              setHasImage(true);
              setImageFile(questionToSet.image);
              setImagePreview(URL.createObjectURL(questionToSet.image));
            } else {
              if (imagePreview) URL.revokeObjectURL(imagePreview);
              setHasImage(false);
              setImageFile(null);
              setImagePreview(null);
            }
          } else {
            logger.error(`Question with id ${questionId} not found. Resetting form.`);
            setQuestion(getInitialState());
            if (imagePreview) URL.revokeObjectURL(imagePreview);
            setHasImage(false); setImageFile(null); setImagePreview(null);
          }
        })
        .catch(error => {
          logger.error("Error fetching question: ", error);
          setQuestion(getInitialState());
          if (imagePreview) URL.revokeObjectURL(imagePreview);
          setHasImage(false); setImageFile(null); setImagePreview(null);
        })
        .finally(() => setIsLoading(false));
    } else { // Creating a new question or re-initializing
      const newInitialState = getInitialState(); // Recalculate initial state
      setQuestion(newInitialState);

      if (imagePreview) URL.revokeObjectURL(imagePreview); // Clean up previous preview

      if (newInitialState.image instanceof Blob) {
        setHasImage(true);
        setImageFile(newInitialState.image);
        setImagePreview(URL.createObjectURL(newInitialState.image));
      } else {
        setHasImage(false);
        setImageFile(null);
        setImagePreview(null);
      }
    }
  // Adding initialData to dependencies is tricky as it's an object.
  // getInitialState is stable due to useCallback or being defined outside if props don't change.
  // However, getInitialState itself depends on initialData and forcedReferential from the closure.
  // Keying the component or using a more sophisticated effect dependency management might be needed if initialData could change dynamically for an *open* form for a new question.
  // For now, assuming initialData is primarily for the *first* setup of a new question form.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId, forcedReferential]); // Note: initialData is not listed to avoid re-runs if its reference changes but content is same.

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    // Prevent changing referential if it's forced
    if (name === 'referential' && forcedReferential) {
      return;
    }
    setQuestion(prev => ({ ...prev, [name]: name === 'timeLimit' ? parseInt(value, 10) : value }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    if (name === 'isEliminatory') {
      setQuestion(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'hasImageToggle') {
      setHasImage(checked);
      if (!checked) {
        if (imagePreview) {
          URL.revokeObjectURL(imagePreview);
        }
        setImageFile(null);
        setImagePreview(null);
        setQuestion(prev => ({ ...prev, image: undefined }));
      }
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...(question.options || [])];
    newOptions[index] = value;
    setQuestion(prev => ({ ...prev, options: newOptions }));
  };

  const addOption = () => {
    if ((question.options?.length || 0) < 4) {
     setQuestion(prev => ({ ...prev, options: [...(prev.options || []), ''] }));
    }
  };

  const removeOption = (index: number) => {
    if ((question.options?.length || 0) > 2) {
      const newOptions = (question.options || []).filter((_, i) => i !== index);
      setQuestion(prev => ({ ...prev, options: newOptions }));
      if (Number(question.correctAnswer) === index) {
        setQuestion(prev => ({...prev, correctAnswer: '0'}));
      } else if (Number(question.correctAnswer) > index) {
         setQuestion(prev => ({...prev, correctAnswer: (Number(prev.correctAnswer) -1).toString()}));
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
      logger.info('WARN: Validation échouée', errors); // Changed logger
      return;
    }

    let imageToSave: Blob | undefined = undefined;
    if (hasImage && imageFile) {
      if (imageFile instanceof File) {
        imageToSave = new Blob([imageFile], { type: imageFile.type });
      } else {
        imageToSave = imageFile; // Already a Blob
      }
    }

    // Prepare data for saving, ensuring ID is handled correctly for add/update
    // The 'id' property should not be sent for new questions.
    // For existing questions, 'id' from question state is used for update.
    const { id: currentId, ...dataToSave } = question;

    const questionData: Omit<StoredQuestion, 'id'> & { id?: number } = {
      ...dataToSave,
      image: imageToSave,
      options: question.options?.map(opt => opt.toString()) || [],
      createdAt: currentId ? question.createdAt : new Date().toISOString(),
      correctAnswer: question.correctAnswer,
    };

    try {
      setIsLoading(true);
      let savedQuestionResult: StoredQuestion;

      if (questionId) { // Corresponds to editing an existing question
        // StorageManager.updateQuestion expects the ID and the partial data.
        // questionData here already has the full structure, which is fine for Dexie's update.
        // We must ensure 'id' is not in the 'updates' object itself if StorageManager.updateQuestion strictly forbids it.
        // However, our StorageManager.updateQuestion is implemented to handle this.
        await StorageManager.updateQuestion(questionId, questionData);
        logger.success('Question modifiée avec succès');
        // For onSave, we need the full question object, including the ID.
        savedQuestionResult = { ...questionData, id: questionId };
      } else {
        // For new questions, StorageManager.addQuestion expects data without an 'id'.
        // The 'questionData' object as constructed above (if currentId was undefined) will not have an 'id' property.
        const newId = await StorageManager.addQuestion(questionData); // questionData is Omit<StoredQuestion, 'id'> here
        logger.success(`Question créée avec succès avec l'ID: ${newId}`);
        if (newId === undefined) {
          throw new Error("Failed to create question, new ID is undefined.");
        }
        savedQuestionResult = { ...questionData, id: newId };
      }
      onSave(savedQuestionResult);
    } catch (error) {
      logger.error("Error saving question: ", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddOption = () => {
    addOption();
  };

  if (isLoading && questionId) {
    return <div>Chargement de la question...</div>;
  }

  return (
    <div>
      <Card title="Informations générales" className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Select
            label="Recommandation CACES"
            options={referentialOptions}
            value={question.referential} // This will be correctly set by getInitialState or useEffect
            onChange={handleInputChange} // Use existing handleInputChange which has protection
            name="referential" // Ensure name is set for handleInputChange
            placeholder="Sélectionner une recommandation"
            required
            disabled={!!forcedReferential} // Disable if referential is forced
          />
          <Select
            label="Thème"
            options={themeOptions}
            value={question.theme}
            onChange={(e) => setQuestion(prev => ({...prev, theme: e.target.value as QuestionTheme}))}
            placeholder="Sélectionner un thème"
            required
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <Input
            label="Temps limite (secondes)"
            type="number"
            name="timeLimit"
            value={question.timeLimit.toString()}
            onChange={handleInputChange}
            min={5}
            max={120}
          />
          <div className="flex items-center space-x-4 mt-6">
            <label htmlFor="isEliminatoryCheckbox" className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                id="isEliminatoryCheckbox"
                name="isEliminatory"
                checked={question.isEliminatory}
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
          {(question.options || []).map((option, index) => (
            <div key={index} className="flex items-center gap-4">
              <div className="flex-shrink-0">
                <input
                  type="radio"
                  name="correctAnswer" // This should be consistent for the radio group
                  value={index.toString()} // Value is the index
                  checked={question.correctAnswer === index.toString()} // Compare with index string
                  onChange={(e) => setQuestion(prev => ({...prev, correctAnswer: e.target.value}))}
                  className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1">
                <Input
                  placeholder={`Option ${String.fromCharCode(65 + index)}`}
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  className="mb-0"
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