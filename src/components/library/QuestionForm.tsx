import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Image as ImageIconLucide, Upload } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Badge from '../ui/Badge';
import { Question, QuestionType, CACESReferential, QuestionTheme, questionTypes, referentials, questionThemes } from '../../types';
import { addQuestion, updateQuestion, getQuestionById, QuestionWithId } from '../../db';
import { logger } from '../../utils/logger';

interface QuestionFormProps {
  onSave: (question: QuestionWithId) => void;
  onCancel: () => void;
  questionId?: number | null;
}

const QuestionForm: React.FC<QuestionFormProps> = ({ onSave, onCancel, questionId }) => {
  const initialQuestionState: QuestionWithId = {
    text: '',
    type: QuestionType.QCM,
    options: ['', '', '', ''],
    correctAnswer: '',
    timeLimit: 30,
    isEliminatory: false,
    referential: CACESReferential.R489,
    theme: QuestionTheme.Rules,
    image: undefined,
    createdAt: new Date().toISOString(),
    usageCount: 0,
    correctResponseRate: 0
  };

  const [question, setQuestion] = useState<QuestionWithId>(initialQuestionState);
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

  useEffect(() => {
    if (questionId) {
      setIsLoading(true);
      const fetchQuestion = async () => {
        try {
          const existingQuestion = await getQuestionById(questionId);
          if (existingQuestion) {
            setQuestion(existingQuestion);
            if (existingQuestion.image instanceof Blob) {
              // Ensure previous object URL is revoked before creating a new one
              if (imagePreview) {
                URL.revokeObjectURL(imagePreview);
              }
              setHasImage(true);
              setImageFile(existingQuestion.image);
              setImagePreview(URL.createObjectURL(existingQuestion.image));
            } else {
              if (imagePreview) {
                URL.revokeObjectURL(imagePreview);
              }
              setHasImage(false);
              setImageFile(null);
              setImagePreview(null);
            }
          } else {
            logger.error(`Question with id ${questionId} not found.`);
            if (imagePreview) {
              URL.revokeObjectURL(imagePreview);
            }
            setQuestion(initialQuestionState); // Reset form
            setHasImage(false);
            setImageFile(null);
            setImagePreview(null);
          }
        } catch (error) {
          logger.error("Error fetching question: ", error);
        } finally {
          setIsLoading(false);
        }
      };
      fetchQuestion();
    } else {
      // Reset form and cleanup preview if navigating to create new question form
      setQuestion(initialQuestionState);
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
      setHasImage(false);
      setImageFile(null);
      setImagePreview(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId]); // imagePreview is intentionally omitted to prevent re-fetch loops; its cleanup is handled by its own useEffect

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
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
    if (question.type === QuestionType.QCM || question.type === QuestionType.QCU) {
      if (!question.options || question.options.length < 2 || question.options.some(opt => !(opt || "").trim())) {
        newErrors.options = 'Au moins deux options sont requises et toutes les options doivent être remplies.';
      }
      // Validate correctAnswer based on it being an index string
      const correctIndex = parseInt(question.correctAnswer, 10);
      if (isNaN(correctIndex) || correctIndex < 0 || correctIndex >= (question.options?.length || 0) || !question.options?.[correctIndex]?.trim()) {
         newErrors.correctAnswer = 'La réponse correcte doit être l\'une des options valides et non vide.';
      }
    }
    if (question.timeLimit <= 0) newErrors.timeLimit = 'Le temps limite doit être positif.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      logger.warning('Validation échouée', errors);
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

    const questionData: QuestionWithId = {
      ...question,
      image: imageToSave,
      options: question.options?.map(opt => opt.toString()) || [],
      createdAt: question.id ? question.createdAt : new Date().toISOString(),
      // correctAnswer is already an index string from the radio button values
      correctAnswer: question.correctAnswer,
    };

    if (!questionId) {
        delete questionData.id; // Let Dexie auto-increment ID for new questions
    }

    try {
      setIsLoading(true);
      let savedQuestionResult = { ...questionData }; // Initialize with current data

      if (questionId) {
        await updateQuestion(questionId, questionData);
        logger.success('Question modifiée avec succès');
        savedQuestionResult.id = questionId;
      } else {
        const newId = await addQuestion(questionData);
        logger.success(`Question créée avec succès avec l'ID: ${newId}`);
        if (newId !== undefined) savedQuestionResult.id = newId;
      }
      onSave(savedQuestionResult);
    } catch (error) {
      logger.error("Error saving question: ", error);
    } finally {
      setIsLoading(false);
    }
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
            value={question.referential}
            onChange={(e) => setQuestion(prev => ({...prev, referential: e.target.value as CACESReferential}))}
            placeholder="Sélectionner une recommandation"
            required
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