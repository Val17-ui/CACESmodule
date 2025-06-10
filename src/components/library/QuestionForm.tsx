import React, { useState } from 'react';
import { Plus, Trash2, Save, Image, Upload } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import { ReferentialType, referentials, QuestionTheme, questionThemes } from '../../types';
import { logger } from '../../utils/logger';

interface QuestionFormProps {
  questionId?: string | null;
  onSave: () => void;
}

const QuestionForm: React.FC<QuestionFormProps> = ({ questionId, onSave }) => {
  const [selectedReferential, setSelectedReferential] = useState<string>('');
  const [selectedTheme, setSelectedTheme] = useState<string>('');
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState<number>(0);
  const [isEliminatory, setIsEliminatory] = useState(false);
  const [timeLimit, setTimeLimit] = useState(30);
  const [hasImage, setHasImage] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const referentialOptions = Object.entries(referentials).map(([value, label]) => ({
    value,
    label: `${value} - ${label}`,
  }));

  const themeOptions = Object.entries(questionThemes).map(([value, label]) => ({
    value,
    label
  }));

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleAddOption = () => {
    if (options.length < 6) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      const newOptions = options.filter((_, i) => i !== index);
      setOptions(newOptions);
      if (correctAnswer >= newOptions.length) {
        setCorrectAnswer(0);
      }
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      setHasImage(true);
      logger.info(`Image sélectionnée: ${file.name}`);
    }
  };

  const handleSave = () => {
    if (!questionText.trim() || !selectedReferential || !selectedTheme) {
      logger.warning('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (options.some(opt => !opt.trim())) {
      logger.warning('Veuillez remplir toutes les options de réponse');
      return;
    }

    const questionData = {
      text: questionText,
      referential: selectedReferential,
      theme: selectedTheme,
      options: options.filter(opt => opt.trim()),
      correctAnswer,
      isEliminatory,
      timeLimit,
      hasImage,
      imageFile
    };

    logger.success(questionId ? 'Question modifiée avec succès' : 'Question créée avec succès');
    onSave();
  };

  return (
    <div>
      <Card title="Informations générales" className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Select
            label="Recommandation CACES"
            options={referentialOptions}
            value={selectedReferential}
            onChange={(e) => setSelectedReferential(e.target.value)}
            placeholder="Sélectionner une recommandation"
            required
          />
          
          <Select
            label="Thème"
            options={themeOptions}
            value={selectedTheme}
            onChange={(e) => setSelectedTheme(e.target.value)}
            placeholder="Sélectionner un thème"
            required
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <Input
            label="Temps limite (secondes)"
            type="number"
            value={timeLimit}
            onChange={(e) => setTimeLimit(parseInt(e.target.value) || 30)}
            min={5}
            max={120}
            required
          />
          
          <div className="flex items-center space-x-4 mt-6">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isEliminatory"
                checked={isEliminatory}
                onChange={(e) => setIsEliminatory(e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="isEliminatory" className="ml-2 text-sm text-gray-700">
                Question éliminatoire
              </label>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Contenu de la question" className="mb-6">
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Texte de la question *
          </label>
          <textarea
            rows={4}
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="Entrez le texte de la question..."
            required
          />
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <label className="block text-sm font-medium text-gray-700">
              Image associée (optionnel)
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="hasImage"
                checked={hasImage}
                onChange={(e) => setHasImage(e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="hasImage" className="text-sm text-gray-700">
                Ajouter une image
              </label>
            </div>
          </div>
          
          {hasImage && (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
              <div className="text-center">
                <Image className="mx-auto h-12 w-12 text-gray-400" />
                <div className="mt-4">
                  <label htmlFor="image-upload" className="cursor-pointer">
                    <span className="mt-2 block text-sm font-medium text-gray-900">
                      Sélectionner une image
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
                {imageFile && (
                  <p className="mt-2 text-sm text-green-600">
                    Image sélectionnée: {imageFile.name}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card title="Options de réponse" className="mb-6">
        <div className="space-y-4">
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-4">
              <div className="flex-shrink-0">
                <input
                  type="radio"
                  name="correctAnswer"
                  checked={correctAnswer === index}
                  onChange={() => setCorrectAnswer(index)}
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
                {options.length > 2 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    icon={<Trash2 size={16} />}
                    onClick={() => handleRemoveOption(index)}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
        
        {options.length < 6 && (
          <div className="mt-4">
            <Button 
              variant="outline" 
              icon={<Plus size={16} />}
              onClick={handleAddOption}
            >
              Ajouter une option
            </Button>
          </div>
        )}
        
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Réponse correcte :</strong> Option {String.fromCharCode(65 + correctAnswer)}
          </p>
        </div>
      </Card>
      
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={onSave}>
          Annuler
        </Button>
        <Button variant="primary" icon={<Save size={16} />} onClick={handleSave}>
          {questionId ? 'Modifier la question' : 'Créer la question'}
        </Button>
      </div>
    </div>
  );
};

export default QuestionForm;