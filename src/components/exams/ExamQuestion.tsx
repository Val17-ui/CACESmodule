import React from 'react';
import Card from '../ui/Card';
import { Question } from '../../types';

type ExamQuestionProps = {
  question: Question;
  currentQuestionIndex: number;
  totalQuestions: number;
  isTestMode?: boolean;
  responseDistribution?: Record<string, number>;
};

const ExamQuestion: React.FC<ExamQuestionProps> = ({
  question,
  currentQuestionIndex,
  totalQuestions,
  isTestMode = false,
  responseDistribution = {},
}) => {
  const calculatePercentage = (option: string, index: number) => {
    const letter = String.fromCharCode(65 + index);
    const responses = Object.values(responseDistribution).reduce((sum, count) => sum + count, 0);
    if (responses === 0) return 0;
    return Math.round((responseDistribution[letter] || 0) / responses * 100);
  };

  return (
    <Card className="mb-6">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-xl font-semibold text-gray-900">
          Question {currentQuestionIndex + 1}/{totalQuestions}
        </h3>
        {question.isEliminatory && !isTestMode && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Éliminatoire
          </span>
        )}
      </div>
      
      <div className="mb-8">
        <p className="text-lg text-gray-800">{question.text}</p>
      </div>
      
      <div className="space-y-3">
        {question.options.map((option, index) => (
          <div 
            key={index}
            className="flex items-center p-4 border border-gray-200 rounded-xl hover:bg-gray-50"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-700 font-medium mr-3">
              {String.fromCharCode(65 + index)}
            </div>
            <span className="text-gray-800 flex-1">{option}</span>
            {isTestMode && (
              <div className="ml-4 flex items-center">
                <div className="w-16 h-2 bg-gray-200 rounded-full mr-2">
                  <div 
                    className="h-2 bg-blue-600 rounded-full transition-all duration-500"
                    style={{ width: `${calculatePercentage(option, index)}%` }}
                  />
                </div>
                <span className="text-sm text-gray-500 w-12 text-right">
                  {calculatePercentage(option, index)}%
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
      
      <div className="mt-6 pt-6 border-t border-gray-200 flex justify-between items-center">
        <span className="text-sm text-gray-500">
          Temps restant : <span className="font-medium">30 secondes</span>
        </span>
        <span className="text-sm text-gray-500">
          {isTestMode ? 'Mode test actif - Réponses anonymes' : 'Utilisez les boîtiers de vote pour répondre'}
        </span>
      </div>
    </Card>
  );
};

export default ExamQuestion;