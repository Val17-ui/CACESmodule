import React from 'react';
import { Shuffle } from 'lucide-react';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { QuestionTheme, questionThemes } from '../../types';
import { logger } from '../../utils/logger';

interface ThemeSelectorProps {
  distribution: Record<QuestionTheme, number>;
  onDistributionChange: (theme: QuestionTheme, count: number) => void;
  totalQuestions: number;
  isRandomized?: boolean;
  selectedReferential?: string;
}

const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  distribution,
  onDistributionChange,
  totalQuestions,
  isRandomized = false,
  selectedReferential = ''
}) => {
  const handleThemeCountChange = (theme: QuestionTheme, value: string) => {
    const count = parseInt(value) || 0;
    logger.info(`Modification du nombre de questions pour le thème ${questionThemes[theme]}: ${count}`);
    onDistributionChange(theme, count);
  };

  const handleGenerateRandom = () => {
    if (!selectedReferential) {
      logger.warning('Veuillez sélectionner un référentiel avant la génération aléatoire');
      return;
    }
    
    logger.info(`Génération aléatoire de ${totalQuestions} questions pour ${selectedReferential}`);
    // Here we would implement the actual random generation from the library
  };

  const currentTotal = Object.values(distribution).reduce((sum, count) => sum + count, 0);
  const isOverTotal = currentTotal > totalQuestions;

  return (
    <Card title="Distribution par thème" className="mb-6">
      <div className="space-y-4">
        {Object.entries(questionThemes).map(([theme, label]) => (
          <div key={theme} className="flex items-center space-x-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {label}
              </label>
              <div className="flex items-center space-x-2">
                <Input
                  type="number"
                  value={distribution[theme as QuestionTheme]}
                  onChange={(e) => handleThemeCountChange(theme as QuestionTheme, e.target.value)}
                  min={0}
                  max={totalQuestions}
                  className="w-24"
                  disabled={isRandomized}
                />
                <div className="flex-1">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{
                        width: `${(distribution[theme as QuestionTheme] / totalQuestions) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <span className="text-sm text-gray-500 w-16 text-right">
                  {((distribution[theme as QuestionTheme] / totalQuestions) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        ))}

        <div className="pt-4 border-t border-gray-200">
          <div className="flex justify-between items-center text-sm">
            <span className="font-medium text-gray-700">
              Total sélectionné : {currentTotal} / {totalQuestions}
            </span>
            {isOverTotal && (
              <span className="text-red-600">
                Le nombre total de questions dépasse la limite
              </span>
            )}
          </div>
        </div>

        {isRandomized && (
          <div className="pt-4 border-t border-gray-200">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-blue-900">
                  Génération aléatoire activée
                </h4>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Shuffle size={16} />}
                  onClick={handleGenerateRandom}
                  disabled={!selectedReferential}
                >
                  Générer
                </Button>
              </div>
              <p className="text-sm text-blue-800">
                Les questions seront sélectionnées automatiquement depuis la bibliothèque selon la distribution définie ci-dessus.
              </p>
              {!selectedReferential && (
                <p className="text-sm text-amber-700 mt-2">
                  Veuillez d'abord sélectionner un référentiel.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="bg-blue-50 p-4 rounded-lg mt-4">
          <div className="text-sm text-blue-800"> {/* Changed p to div */}
            <strong>Recommandations Cnam :</strong>
            <ul className="mt-2 list-disc list-inside">
              <li>20-50 questions au total selon le référentiel</li>
              <li>2-5 questions éliminatoires</li>
              <li>≥70% pour réussir l'examen</li>
              <li>≥50% par thème</li>
            </ul>
          </div> {/* Changed p to div */}
        </div>
      </div>
    </Card>
  );
};

export default ThemeSelector;