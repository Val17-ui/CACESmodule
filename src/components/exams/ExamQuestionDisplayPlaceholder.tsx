import React from 'react';
import { Question } from '../../types';
import Card from '../ui/Card';
import { AlertTriangle } from 'lucide-react';

interface ExamQuestionDisplayPlaceholderProps {
  question: Question | null;
  isSessionActive: boolean;
}

const ExamQuestionDisplayPlaceholder: React.FC<ExamQuestionDisplayPlaceholderProps> = ({ question, isSessionActive }) => {
  if (!question) {
    return (
      <Card>
        <div className="p-6 text-center">
          <AlertTriangle size={32} className="mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600">Aucune question à afficher.</p>
          {!isSessionActive && <p className="text-sm text-gray-500 mt-1">Démarrez l'examen pour voir la première question.</p>}
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Affichage de la Question (Placeholder)
        </h3>
        <p className="text-lg text-gray-800 mb-4">{question.text}</p>
        <div className="space-y-2">
          {question.options.map((option, index) => (
            <div key={index} className="p-3 border border-gray-200 rounded-md bg-gray-50">
              {String.fromCharCode(65 + index)}) {option.text || option}
            </div>
          ))}
        </div>
        {isSessionActive ? (
          <p className="mt-4 text-sm text-blue-600">
            La logique de vote et d'affichage des résultats pour cette question sera implémentée ici (dans OmbeaExamVoteDisplay.tsx).
          </p>
        ) : (
           <p className="mt-4 text-sm text-gray-500">
            L'examen n'est pas actif. Démarrez l'examen pour interagir.
          </p>
        )}
      </div>
    </Card>
  );
};

export default ExamQuestionDisplayPlaceholder;
