import React, { useState, useEffect, useCallback } from 'react';
import { Question, QuestionType } from '../../types';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { Zap, XCircle, BarChart2, CheckCircle, Users, AlertTriangle, Info, Loader2 } from 'lucide-react';
import { useOmbeaStore } from '../../stores/ombeaStore';
import { logger } from '../../utils/logger';

interface OmbeaExamVoteDisplayProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
}

const OmbeaExamVoteDisplay: React.FC<OmbeaExamVoteDisplayProps> = ({ question, questionNumber, totalQuestions }) => {
  // No more local state for isLocalVoteActive or showLocalResults. This is driven by store's votingSession.
  const [timeLeft, setTimeLeft] = useState(question.timeLimit || 30);

  const {
    isApiAuthenticated,
    isConnecting,
    responses,
    isTestMode,
    // startSimulatedResponses, // Now called by openPollForCurrentQuestion in store if isTestMode
    // stopSimulatedResponses,   // Now called by closePollForCurrentQuestion or endExamSession in store
    votingSession,
    devices,
    openPollForCurrentQuestion,
    closePollForCurrentQuestion,
  } = useOmbeaStore();

  const totalParticipants = Object.keys(devices || {}).length || 0;
  const {
    isActive: isExamSessionActive,
    currentQuestion: currentStoreQuestion,
    currentPollId,
    isPollingActiveForQuestion, // This is the key state for this component's UI
    pollError
  } = votingSession;


  // Effect to reset timer when the question prop changes or polling state changes
  useEffect(() => {
    logger.debug(`OmbeaExamVoteDisplay: QID ${question?.id}, Polling: ${isPollingActiveForQuestion}. Resetting timer.`);
    setTimeLeft(question?.timeLimit || 30);
  }, [question, isPollingActiveForQuestion]); // Reset timer if question changes OR if polling starts/stops

  // Timer logic - only runs when polling is active for this question
  useEffect(() => {
    if (!isPollingActiveForQuestion) {
      // If timer is not already at full time for the question, reset it.
      // This handles cases where polling might have stopped prematurely.
      if (timeLeft !== (question?.timeLimit || 30)) {
         setTimeLeft(question?.timeLimit || 30);
      }
      return;
    }

    const timerInstance = setInterval(() => {
      setTimeLeft(prevTime => {
        if (prevTime <= 1) {
          clearInterval(timerInstance);
          // Automatically close poll when time is up
          if (isPollingActiveForQuestion) { // Check again, might have been closed by user
            logger.info(`OmbeaExamVoteDisplay: Timer ended for Q#${questionNumber}. Closing poll.`);
            closePollForCurrentQuestion().catch(err => logger.error("Error auto-closing poll", err));
          }
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);

    return () => clearInterval(timerInstance);
  }, [isPollingActiveForQuestion, question?.timeLimit, timeLeft, questionNumber, closePollForCurrentQuestion]);


  const handleOpenPoll = async () => {
    if (!isApiAuthenticated || !isExamSessionActive || currentStoreQuestion?.id !== question?.id) {
      logger.warn('OmbeaExamVoteDisplay: Conditions not met to open poll.');
      alert("Impossible d'ouvrir le vote. Vérifiez la connexion et la session d'examen.");
      return;
    }
    logger.info(`OmbeaExamVoteDisplay: User requesting to open poll for Q#${questionNumber} (${question?.id})`);
    await openPollForCurrentQuestion();
  };

  const handleClosePoll = async () => {
    if (!isPollingActiveForQuestion) return;
    logger.info(`OmbeaExamVoteDisplay: User requesting to close poll for Q#${questionNumber} (${question?.id})`);
    await closePollForCurrentQuestion();
  };

  const getAggregatedResults = useCallback(() => {
    if (!question || !question.options) return {};
    const initialResults: Record<string, number> = {};
    question.options.forEach(opt => initialResults[typeof opt === 'string' ? opt : opt.text] = 0);
    return Object.values(responses).reduce((acc, responseValue) => {
      let optionText = '';
      if (question.type === QuestionType.TrueFalse) {
        if (responseValue === 'A' && question.options[0]) optionText = typeof question.options[0] === 'string' ? question.options[0] : question.options[0].text;
        else if (responseValue === 'B' && question.options[1]) optionText = typeof question.options[1] === 'string' ? question.options[1] : question.options[1].text;
      } else if (question.type === QuestionType.QCM || question.type === QuestionType.QCU) {
        const optionIndex = responseValue.charCodeAt(0) - 'A'.charCodeAt(0);
        if (optionIndex >= 0 && optionIndex < question.options.length) {
          const opt = question.options[optionIndex];
          optionText = typeof opt === 'string' ? opt : opt.text;
        }
      }
      if (optionText && acc.hasOwnProperty(optionText)) acc[optionText]++;
      else if (optionText) acc[optionText] = 1;
      return acc;
    }, initialResults);
  }, [question, responses]);

  // Render conditions based on global session state from store
  if (!isExamSessionActive || !currentStoreQuestion || currentStoreQuestion.id !== question?.id) {
      return (
          <Card>
              <div className="p-6 text-center text-gray-500">
                  <Loader2 size={32} className="mx-auto mb-2 animate-spin" />
                  Chargement ou synchronisation de la question...
                  {!isExamSessionActive && <p className="text-xs mt-1">La session d'examen n'est pas active.</p>}
              </div>
          </Card>
      );
  }

  // Results are shown if polling is NOT active for the question AND a poll has been run (currentPollId exists)
  const showResults = !isPollingActiveForQuestion && !!currentPollId;
  const aggregatedResultsData = showResults ? getAggregatedResults() : {};
  const totalVotesForQuestion = Object.keys(responses).length;

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
          <Badge color={isPollingActiveForQuestion ? "green" : (showResults ? "blue" : "gray")} size="lg">
            {isPollingActiveForQuestion ? `Vote Actif... ${timeLeft}s` : (showResults ? "Résultats Prêts" : "Prêt à Voter")}
          </Badge>
        </div>

        <div className="bg-gray-50 p-6 rounded-lg shadow-inner mb-6 min-h-[120px]">
          <p className="text-lg text-gray-800">{question.text}</p>
        </div>

        <div className="space-y-3 mb-6">
          {question.options.map((option, index) => (
            <div
              key={typeof option === 'string' ? index : option.id || index}
              className="flex items-center p-3 border border-gray-200 rounded-lg bg-white"
            >
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-200 text-gray-700 font-semibold mr-3 text-sm">
                {String.fromCharCode(65 + index)}
              </div>
              <span className="text-gray-800 flex-1">{typeof option === 'string' ? option : option.text}</span>
            </div>
          ))}
        </div>

        {pollError && (
            <div className="my-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
                <AlertTriangle size={18} className="inline mr-2" /> Erreur de vote: {pollError}
            </div>
        )}

        <div className="flex flex-col sm:flex-row justify-center items-center gap-3 mb-6">
          {!isPollingActiveForQuestion && ( // Show "Open Vote" only if poll is not active
            <Button
              onClick={handleOpenPoll}
              icon={<Zap size={18} />}
              variant="primary"
              className="w-full sm:w-auto"
              disabled={!isApiAuthenticated || isConnecting || isPollingActiveForQuestion}
              tooltip={
                !isApiAuthenticated ? "OMBEA déconnecté/non authentifié" :
                isPollingActiveForQuestion ? "Vote déjà ouvert" :
                "Ouvrir le vote pour cette question"
              }
            >
              Ouvrir le Vote
            </Button>
          )}
          {isPollingActiveForQuestion && (
            <Button
              onClick={handleClosePoll}
              icon={<XCircle size={18} />}
              variant="danger"
              className="w-full sm:w-auto"
            >
              Clore le Vote
            </Button>
          )}
        </div>

        {showResults && ( // Results are shown if poll is not active AND a poll ID exists (meaning it has run)
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="text-lg font-medium text-gray-800 mb-3 flex items-center">
              <BarChart2 size={20} className="mr-2 text-indigo-600" /> Résultats
            </h4>
            {question.options && question.options.length > 0 ? (
              <ul className="space-y-3">
                {question.options.map((optionObj, index) => {
                  const optionText = typeof optionObj === 'string' ? optionObj : optionObj.text;
                  let isCorrect = false; // Default to false
                                    // Ensure question.correctAnswer is defined and not null before comparing
                                    if (question.correctAnswer !== undefined && question.correctAnswer !== null) {
                                        if (question.type === QuestionType.TrueFalse) {
                                            isCorrect = String(question.correctAnswer) === String(index);
                                        } else {
                                            isCorrect = String(question.correctAnswer) === String(index);
                                        }
                                    }
                  const votesCount = aggregatedResultsData[optionText] || 0;
                  const percentage = totalVotesForQuestion > 0 ? Math.round((votesCount / totalVotesForQuestion) * 100) : 0;

                  return (
                    <li key={typeof optionObj === 'string' ? index : optionObj.id || index} className="text-sm">
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
            ) : (<p className="text-gray-500 text-center">Aucune option.</p>)}
            {totalVotesForQuestion === 0 && <p className="text-center text-gray-500 mt-4">Aucun vote.</p>}
             <div className="mt-4 text-sm text-gray-600 flex items-center">
                <Users size={16} className="mr-2"/> Votes pour cette question: {totalVotesForQuestion} / {totalParticipants || 'N/A'}
            </div>
          </div>
        )}
         {!isApiAuthenticated && !isConnecting && (
             <div className="mt-4 p-3 bg-yellow-50 border border-yellow-300 rounded-md text-yellow-700 text-sm flex items-center">
                <AlertTriangle size={20} className="mr-2 flex-shrink-0" />
                <span>Système OMBEA déconnecté. Les votes réels ne seront pas enregistrés.</span>
            </div>
         )}
      </div>
    </Card>
  );
};

export default OmbeaExamVoteDisplay;
