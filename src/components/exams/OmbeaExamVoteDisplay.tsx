import React, { useState, useEffect, useCallback } from 'react';
import { Question } from '../../types';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { Zap, XCircle, BarChart2, CheckCircle, Users, AlertTriangle, Info, Loader2 } from 'lucide-react';
import { useOmbeaStore } from '../../stores/ombeaStore';
import { logger } from '../../utils/logger';

interface OmbeaExamVoteDisplayProps {
  question: Question; // The current question to display and vote on
  questionNumber: number; // e.g., 1
  totalQuestions: number; // e.g., 10
}

const OmbeaExamVoteDisplay: React.FC<OmbeaExamVoteDisplayProps> = ({ question, questionNumber, totalQuestions }) => {
  const [isVotingActiveForQuestion, setIsVotingActiveForQuestion] = useState(false);
  const [showResultsForQuestion, setShowResultsForQuestion] = useState(false);
  const [timeLeft, setTimeLeft] = useState(question.timeLimit || 30);

  const {
    isOmbeaConnected,
    isOmbeaConnecting, // To show loading/disabled states if Ombea is trying to connect
    responses,
    clearResponses,
    isTestMode,
    startSimulatedResponses,
    stopSimulatedResponses,
    votingSession, // To ensure we only operate if the overall exam session is active
    devices, // For participant count
  } = useOmbeaStore();

  const totalParticipants = Object.keys(devices || {}).length || 0;

  // Effect to reset state when the question prop changes
  useEffect(() => {
    logger.debug(`OmbeaExamVoteDisplay: Question changed to ID ${question.id}. Resetting local vote state.`);
    setIsVotingActiveForQuestion(false);
    setShowResultsForQuestion(false);
    setTimeLeft(question.timeLimit || 30);
    // Responses for the new question are cleared by setCurrentQuestionForVoting in the store
    // or should be cleared when starting a new poll for this question.
    // clearResponses(); // This might be too aggressive if called here directly.
  }, [question]);

  // Timer logic
  useEffect(() => {
    if (!isVotingActiveForQuestion) {
      // Ensure timer is reset or reflects full time if voting is not active
      if (timeLeft !== (question.timeLimit || 30)) {
        setTimeLeft(question.timeLimit || 30);
      }
      return;
    }

    // If voting is active, and timeLeft is already 0 (e.g. from previous run), reset it.
    // This case should be handled by the reset effect when question changes.
    // if (timeLeft === 0 && isVotingActiveForQuestion) {
    //     setTimeLeft(question.timeLimit || 30);
    // }

    const timer = setInterval(() => {
      setTimeLeft(prevTime => {
        if (prevTime <= 1) {
          clearInterval(timer);
          handleStopVote(); // Automatically stop voting when time is up
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isVotingActiveForQuestion, question.timeLimit, timeLeft]); // Added timeLeft here

  const handleStartVote = useCallback(() => {
    if (!isOmbeaConnected || !votingSession.isActive || votingSession.currentQuestion?.id !== question.id) {
      logger.warn('OmbeaExamVoteDisplay: Cannot start vote. Ombea not connected, exam session not active, or mismatched question.');
      alert("Impossible de démarrer le vote. Vérifiez la connexion OMBEA et que la session d'examen est active pour cette question.");
      return;
    }
    logger.info(`OmbeaExamVoteDisplay: Starting vote for Q#${questionNumber} (${question.id})`);
    clearResponses(); // Clear any previous responses for this question poll
    setIsVotingActiveForQuestion(true);
    setShowResultsForQuestion(false);
    setTimeLeft(question.timeLimit || 30); // Explicitly reset timer

    if (isTestMode) {
      logger.info("OmbeaExamVoteDisplay: Test mode active, starting simulated responses.");
      startSimulatedResponses(question.type, question.options?.length || 2);
    }
    // TODO: Actual Ombea API call to open polling for this question
  }, [isOmbeaConnected, votingSession.isActive, votingSession.currentQuestion, question, questionNumber, clearResponses, isTestMode, startSimulatedResponses, question.timeLimit]);

  const handleStopVote = useCallback(() => {
    if (!isVotingActiveForQuestion) return;
    logger.info(`OmbeaExamVoteDisplay: Stopping vote for Q#${questionNumber} (${question.id})`);
    setIsVotingActiveForQuestion(false);
    setShowResultsForQuestion(true);
    if (isTestMode) {
      logger.info("OmbeaExamVoteDisplay: Test mode active, stopping simulated responses.");
      stopSimulatedResponses();
    }
    // TODO: Actual Ombea API call to close polling
  }, [isVotingActiveForQuestion, questionNumber, question.id, isTestMode, stopSimulatedResponses]);

  const getAggregatedResults = useCallback(() => {
    if (!question || !question.options) return {};

    const initialResults: Record<string, number> = {};
    question.options.forEach(opt => initialResults[opt.text || String(opt)] = 0); // Handle if options are just strings

    return Object.values(responses).reduce((acc, responseValue) => {
      let optionText = '';
      if (question.type === 'true-false') {
        if (responseValue === 'A' && question.options[0]) optionText = question.options[0].text || String(question.options[0]);
        else if (responseValue === 'B' && question.options[1]) optionText = question.options[1].text || String(question.options[1]);
      } else if (question.type === 'multiple-choice') {
        const optionIndex = responseValue.charCodeAt(0) - 'A'.charCodeAt(0);
        if (optionIndex >= 0 && optionIndex < question.options.length) {
          optionText = question.options[optionIndex].text || String(question.options[optionIndex]);
        }
      }

      if (optionText && acc.hasOwnProperty(optionText)) {
        acc[optionText]++;
      } else if (optionText) { // Should not happen if initialResults is set correctly
        acc[optionText] = 1;
      }
      return acc;
    }, initialResults);
  }, [question, responses]);

  if (!votingSession.isActive) {
      return (
          <Card>
              <div className="p-6 text-center text-gray-500">
                  <Info size={32} className="mx-auto mb-2" />
                  L'examen n'est pas en cours. Démarrez l'examen depuis le panneau de contrôle.
              </div>
          </Card>
      )
  }

  if (votingSession.currentQuestion?.id !== question.id) {
    return (
        <Card>
            <div className="p-6 text-center text-gray-500">
                <Loader2 size={32} className="mx-auto mb-2 animate-spin" />
                Chargement de la question...
            </div>
        </Card>
    )
  }

  const aggregatedResultsData = showResultsForQuestion ? getAggregatedResults() : {};
  const totalVotesForQuestion = Object.values(responses).length;

  return (
    <Card className="mb-6">
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-900">
            Question {questionNumber}/{totalQuestions}
            {question.isEliminatory && !isTestMode && (
              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                Éliminatoire
              </span>
            )}
          </h3>
          <Badge color={isVotingActiveForQuestion ? "green" : (showResultsForQuestion ? "blue" : "gray")} size="lg">
            {isVotingActiveForQuestion ? `Vote en cours... ${timeLeft}s` : (showResultsForQuestion ? "Résultats" : "Prêt à voter")}
          </Badge>
        </div>

        <div className="bg-gray-50 p-6 rounded-lg shadow-inner mb-6 min-h-[120px]">
          <p className="text-lg text-gray-800">{question.text}</p>
        </div>

        <div className="space-y-3 mb-6">
          {question.options.map((option, index) => (
            <div
              key={option.id || index} // Use option.id if available, otherwise index
              className="flex items-center p-3 border border-gray-200 rounded-lg bg-white"
            >
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-200 text-gray-700 font-semibold mr-3 text-sm">
                {String.fromCharCode(65 + index)}
              </div>
              <span className="text-gray-800 flex-1">{option.text || String(option)}</span> {/* Handle if option is just string */}
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row justify-center items-center gap-3 mb-6">
          {!isVotingActiveForQuestion && !showResultsForQuestion && (
            <Button
              onClick={handleStartVote}
              icon={<Zap size={18} />}
              variant="primary"
              className="w-full sm:w-auto"
              disabled={!isOmbeaConnected || isOmbeaConnecting}
              tooltip={!isOmbeaConnected ? "OMBEA déconnecté" : ""}
            >
              Ouvrir le Vote
            </Button>
          )}
          {isVotingActiveForQuestion && (
            <Button
              onClick={handleStopVote}
              icon={<XCircle size={18} />}
              variant="danger"
              className="w-full sm:w-auto"
            >
              Clore le Vote
            </Button>
          )}
        </div>

        {showResultsForQuestion && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="text-lg font-medium text-gray-800 mb-3 flex items-center">
              <BarChart2 size={20} className="mr-2 text-indigo-600" /> Résultats pour cette question
            </h4>
            {question.options && question.options.length > 0 ? (
              <ul className="space-y-3">
                {question.options.map((option, index) => {
                  const optionText = option.text || String(option);
                  const isCorrect = question.type === 'true-false'
                      ? (question.correctAnswer === 0 && index === 0) || (question.correctAnswer === 1 && index === 1)
                      : option.isCorrect;
                  const votesCount = aggregatedResultsData[optionText] || 0;
                  const percentage = totalVotesForQuestion > 0 ? Math.round((votesCount / totalVotesForQuestion) * 100) : 0;

                  return (
                    <li key={option.id || index} className="text-sm">
                      <div className="flex justify-between items-center mb-1">
                        <span className={`font-medium ${isCorrect ? 'text-green-600' : 'text-gray-700'}`}>
                          {String.fromCharCode(65 + index)}) {optionText}
                          {isCorrect && <CheckCircle size={16} className="inline ml-2 text-green-500" />}
                        </span>
                        <span className="font-semibold text-gray-600">{votesCount} vote(s) ({percentage}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 overflow-hidden">
                        <div
                          className={`h-2.5 rounded-full ${isCorrect ? 'bg-green-500' : 'bg-indigo-500'}`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-gray-500 text-center">Aucune option n'était définie pour cette question.</p>
            )}
            {totalVotesForQuestion === 0 && <p className="text-center text-gray-500 mt-4">Aucun vote enregistré.</p>}
             <div className="mt-4 text-sm text-gray-600 flex items-center">
                <Users size={16} className="mr-2"/> Total de participants ayant voté sur cette question : {totalVotesForQuestion} / {totalParticipants}
            </div>
          </div>
        )}
         {!isOmbeaConnected && !isOmbeaConnecting && (
             <div className="mt-4 p-3 bg-yellow-50 border border-yellow-300 rounded-md text-yellow-700 text-sm flex items-center">
                <AlertTriangle size={20} className="mr-2 flex-shrink-0" />
                <span>Le système OMBEA est déconnecté. Les votes ne peuvent pas être enregistrés.</span>
            </div>
         )}
      </div>
    </Card>
  );
};

export default OmbeaExamVoteDisplay;
