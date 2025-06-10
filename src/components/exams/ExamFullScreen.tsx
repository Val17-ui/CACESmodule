import React, { useState, useEffect } from 'react';
import { Timer, Users } from 'lucide-react';
import { Question } from '../../types';
import { logger } from '../../utils/logger';

interface ExamFullScreenProps {
  question: Question;
  currentQuestionIndex: number;
  totalQuestions: number;
  timeLimit: number;
  deviceCount: number;
  responses: Record<number, string>;
  isTestMode?: boolean;
}

const ExamFullScreen: React.FC<ExamFullScreenProps> = ({
  question,
  currentQuestionIndex,
  totalQuestions,
  timeLimit,
  deviceCount,
  responses,
  isTestMode = false,
}) => {
  const [timeLeft, setTimeLeft] = useState(timeLimit);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) {
          clearInterval(timer);
          logger.info('Temps écoulé pour la question');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLimit]);

  const getResponseStats = () => {
    const stats: Record<string, number> = {};
    Object.values(responses).forEach((response) => {
      stats[response] = (stats[response] || 0) + 1;
    });
    return stats;
  };

  return (
    <div className="fixed inset-0 bg-gray-100 flex flex-col p-8">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center space-x-4">
          <span className="text-2xl font-bold">
            Question {currentQuestionIndex + 1}/{totalQuestions}
          </span>
          {question.isEliminatory && (
            <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
              Question éliminatoire
            </span>
          )}
        </div>
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <Users className="text-gray-500" size={24} />
            <span className="text-xl font-medium">{deviceCount} boîtiers</span>
          </div>
          <div className="flex items-center space-x-2">
            <Timer className="text-gray-500" size={24} />
            <span className="text-xl font-medium">{timeLeft}s</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center max-w-4xl mx-auto w-full">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-8">{question.text}</h2>
          <div className="grid grid-cols-2 gap-6">
            {question.options.map((option, index) => (
              <div
                key={index}
                className="bg-white p-6 rounded-xl shadow-sm border-2 border-gray-200"
              >
                <div className="text-2xl font-bold mb-2 text-blue-600">
                  {String.fromCharCode(65 + index)}
                </div>
                <div className="text-xl">{option}</div>
                {isTestMode && (
                  <div className="mt-4 text-gray-500">
                    {((getResponseStats()[String.fromCharCode(65 + index)] || 0) / deviceCount * 100).toFixed(0)}%
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-medium mb-4">État des boîtiers</h3>
          <div className="grid grid-cols-10 gap-2">
            {Array.from({ length: deviceCount }).map((_, index) => (
              <div
                key={index}
                className={`
                  w-12 h-12 rounded-lg flex items-center justify-center text-lg font-medium
                  ${responses[index + 1] ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}
                `}
              >
                {index + 1}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamFullScreen;