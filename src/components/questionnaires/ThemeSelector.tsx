import React from 'react';
import Card from '../ui/Card';
import Input from '../ui/Input';
import { QuestionTheme, questionThemes } from '../../types';
import { logger } from '../../utils/logger';

interface ThemeSelectorProps {
  distribution: Record<QuestionTheme, number>;
  onDistributionChange: (theme: QuestionTheme, count: number) => void;
  totalQuestions: number;
}

const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  distribution,
  onDistributionChange,
  totalQuestions,
}) => {
  const handleThemeCountChange = (theme: QuestionTheme, value: string) => {
    const count = parseInt(value) || 0;
    logger.info(`Modification du nombre de questions pour le thème ${questionThemes[theme]}: ${count}`);
    onDistributionChange(theme, count);
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

        <div className="bg-blue-50 p-4 rounded-lg mt-4">
          <p className="text-sm text-blue-800">
            <strong>Recommandations Cnam :</strong>
            <ul className="mt-2 list-disc list-inside">
              <li>30-50 questions au total</li>
              <li>2-5 questions éliminatoires</li>
              <li>≥70% pour réussir l'examen</li>
              <li>≥50% par thème</li>
            </ul>
          </p>
        </div>
      </div>
    </Card>
  );
};

export default ThemeSelector;