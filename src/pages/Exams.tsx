import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/layout/Layout';
import ExamControlPanel from '../components/exams/ExamControlPanel';
import OmbeaExamVoteDisplay from '../components/exams/OmbeaExamVoteDisplay'; // Import the new component
// import ExamQuestionDisplayPlaceholder from '../components/exams/ExamQuestionDisplayPlaceholder'; // Placeholder for now
import OmbeaExamVoteDisplay from '../components/exams/OmbeaExamVoteDisplay'; // Now using the real component
import ExamFullScreen from '../components/exams/ExamFullScreen';
import ResponseMonitor from '../components/exams/ResponseMonitor';
// import { mockQuestions } from '../data/mockData'; // Removed direct import of mockQuestions
import { Question as QuestionType } from '../types';
import { logger } from '../utils/logger';
import { useOmbeaStore } from '../stores/ombeaStore';

type ExamsProps = {
  activePage: string;
  onPageChange: (page: string) => void;
};

const Exams: React.FC<ExamsProps> = ({ activePage, onPageChange }) => {
  const [localCurrentQuestionIndex, setLocalCurrentQuestionIndex] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  // examQuestions will now be loaded dynamically (simulated for now)
  const [examQuestions, setExamQuestions] = useState<QuestionType[]>([]);
  const [isLoadingQuestionnaire, setIsLoadingQuestionnaire] = useState(true); // For loading state

  const {
    isConnected: isOmbeaConnected,
    isConnecting: isOmbeaConnecting,
    connectionError: ombeaConnectionError,
    isTestMode,
    setTestMode,
    responses,
    // clearResponses, // Store clears responses on new question or session end
    votingSession,
    startVotingSession,
    setCurrentQuestionForVoting,
    endVotingSession,
    // connect: connectOmbea, // connect/disconnect are now handled by ExamControlPanel directly using store actions
    // disconnect: disconnectOmbea,
    devices
  } = useOmbeaStore();

  useEffect(() => {
    return () => {
      if (votingSession.isActive) {
        logger.info("Exams.tsx: Unmounting, ensuring voting session is ended.");
        endVotingSession();
      }
    };
  }, [votingSession.isActive, endVotingSession]);

  useEffect(() => {
    if (votingSession.isActive && votingSession.currentQuestion) {
      const storeQuestionId = votingSession.currentQuestion.id;
      const newIndex = examQuestions.findIndex(q => q.id === storeQuestionId);
      if (newIndex !== -1 && newIndex !== localCurrentQuestionIndex) {
        setLocalCurrentQuestionIndex(newIndex);
      }
    } else if (!votingSession.isActive) {
        // If session ended, reset index or handle as per desired UX
        // For now, keeping current index might be fine if user wants to review last question.
    }
  }, [votingSession.currentQuestion, votingSession.isActive, examQuestions, localCurrentQuestionIndex]);

  const handleLoadQuestionnaire = (questions: QuestionType[]) => {
    // TODO: This should eventually fetch or select a questionnaire
    // For now, we can use this to set mock questions or a specific set for testing
    setExamQuestions(questions);
    setLocalCurrentQuestionIndex(0);
    if (votingSession.isActive) { // If an exam is active, restart it with new questions
        if (questions.length > 0) {
            startVotingSession(questions[0]);
        } else {
            endVotingSession(); // No questions, end session
        }
    }
    logger.info(`Exams: Questionnaire chargé avec ${questions.length} questions.`);
  };

  // Example: Load mock questions on mount
  useEffect(() => {
    // --- START: LOGIC FOR DYNAMIC QUESTIONNAIRE LOADING ---
    // This is where you would implement the logic to:
    // 1. Get a session ID or questionnaire ID (e.g., from route, user selection, or global state).
    // 2. Fetch the questionnaire data using StorageManager.getQuestionnaireById(id) or an API call.
    // 3. Update the examQuestions state with the fetched questions.
    // For demonstration, we'll simulate a fetch of mockQuestions after a delay.

    setIsLoadingQuestionnaire(true);
    logger.info("Exams: Simulating questionnaire load...");
    const simulateLoad = async () => {
      try {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        // In a real app, replace this with actual data fetching:
        // const questionnaireId = getQuestionnaireIdFromSomewhere();
        // const questionnaireData = await StorageManager.getQuestionnaireById(questionnaireId);
        // if (questionnaireData && questionnaireData.questions) {
        //   handleLoadQuestionnaire(questionnaireData.questions);
        // } else {
        //   logger.error("Exams: Questionnaire non trouvé ou vide.");
        //   handleLoadQuestionnaire([]); // Load empty to show error or selection prompt
        // }

        // Using a copy of mockQuestions to simulate fetching
        const { mockQuestions: loadedMockQuestions } = await import('../data/mockData');
        handleLoadQuestionnaire(loadedMockQuestions);
        logger.info("Exams: Mock questionnaire chargé avec succès.");
      } catch (error) {
        logger.error("Exams: Erreur lors du chargement simulé du questionnaire.", error);
        handleLoadQuestionnaire([]); // Load empty on error
      } finally {
        setIsLoadingQuestionnaire(false);
      }
    };
    simulateLoad();
    // --- END: LOGIC FOR DYNAMIC QUESTIONNAIRE LOADING ---
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Load once on mount

  const handleStartExam = useCallback(() => {
    if (isLoadingQuestionnaire) {
      alert("Le questionnaire est en cours de chargement. Veuillez patienter.");
      return;
    }
    if (!isOmbeaConnected) {
      logger.error("Exams: Impossible de démarrer l'examen, OMBEA non connecté.");
      alert("OMBEA n'est pas connecté. Veuillez connecter le système OMBEA via le panneau de contrôle.");
      return;
    }
    if (examQuestions.length === 0) {
      logger.error("Exams: Impossible de démarrer l'examen, aucune question chargée.");
      alert("Aucune question dans le questionnaire actuel. Veuillez charger un questionnaire.");
      return;
    }
    logger.info(`Exams: Démarrage de l'examen ${isTestMode ? '(Mode Test)' : ''}`);
    setLocalCurrentQuestionIndex(0); // Ensure we start from the first question locally
    startVotingSession(examQuestions[0]);
  }, [isOmbeaConnected, examQuestions, startVotingSession, isTestMode]);

  const handleNextQuestion = useCallback(() => {
    if (!votingSession.isActive) {
      logger.warn("Exams: Impossible de passer à la question suivante, aucune session de vote active.");
      return;
    }
    const nextIndex = localCurrentQuestionIndex + 1;
    if (nextIndex < examQuestions.length) {
      logger.info(`Exams: Passage à la question ${nextIndex + 1}`);
      setCurrentQuestionForVoting(examQuestions[nextIndex]);
      // localCurrentQuestionIndex will be updated by the useEffect watching votingSession.currentQuestion
    } else {
      logger.info("Exams: Fin du questionnaire atteinte. L'examen peut être terminé.");
      // Consider auto-ending or showing a summary. For now, user must click "Terminer Examen".
    }
  }, [localCurrentQuestionIndex, examQuestions, votingSession.isActive, setCurrentQuestionForVoting]);

  const handleStopExam = useCallback(() => {
    logger.warning('Exams: Arrêt de l\'examen demandé.');
    endVotingSession();
    // setLocalCurrentQuestionIndex(0); // Optionally reset index, or leave for review
  }, [endVotingSession]);

  const handleToggleFullScreen = () => {
    setIsFullScreen(prev => !prev);
    logger.info(`Exams: Mode présentation ${!isFullScreen ? 'activé' : 'désactivé'}`);
  };

  const handleToggleTestMode = () => {
    // The store's setTestMode will handle stopping/starting simulation if needed
    setTestMode(!isTestMode);
  };

  const currentQuestionForDisplay = votingSession.isActive && votingSession.currentQuestion
                                   ? votingSession.currentQuestion
                                   : examQuestions[localCurrentQuestionIndex] || null; // Fallback to null if undefined

  const totalParticipants = Object.keys(devices || {}).length || 0; // Use 0 if devices is undefined

  if (isFullScreen && currentQuestionForDisplay) {
    return (
      <ExamFullScreen
        question={currentQuestionForDisplay}
        currentQuestionIndex={localCurrentQuestionIndex}
        totalQuestions={examQuestions.length}
        timeLimit={currentQuestionForDisplay.timeLimit || 30}
        deviceCount={totalParticipants} // Use calculated totalParticipants
        responses={responses}
        isTestMode={isTestMode}
      />
    );
  }

  return (
    <Layout
      title="Mode Examen en Direct avec OMBEA"
      subtitle={votingSession.isActive ? `Question ${localCurrentQuestionIndex + 1}/${examQuestions.length}` : "Préparez et gérez votre session d'examen"}
      activePage={activePage}
      onPageChange={onPageChange}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ExamControlPanel
            onStartExam={handleStartExam}
            onPauseExam={() => logger.info("Exams: Fonction 'Pause Examen' cliquée - à définir.")} // Placeholder
            onNextQuestion={handleNextQuestion}
            onStopExam={handleStopExam}
            onToggleFullScreen={handleToggleFullScreen}
            isRunning={votingSession.isActive}
            currentQuestionNumber={localCurrentQuestionIndex + 1}
            totalQuestions={examQuestions.length}
            isTestMode={isTestMode}
            onToggleTestMode={handleToggleTestMode}
            // Ombea states (isConnected, isConnecting, connectionError) are read by ExamControlPanel from the store
          />

          {currentQuestionForDisplay && votingSession.isActive ? (
            <OmbeaExamVoteDisplay
              question={currentQuestionForDisplay}
              questionNumber={localCurrentQuestionIndex + 1}
              totalQuestions={examQuestions.length}
            />
          ) : currentQuestionForDisplay && !votingSession.isActive ? (
            // Display basic question info if session is not active (e.g., for review before starting)
            <Card className="mb-6">
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Question {localCurrentQuestionIndex + 1}/{examQuestions.length} (Aperçu)
                </h3>
                <p className="text-lg text-gray-800 mb-4">{currentQuestionForDisplay.text}</p>
                <div className="space-y-2">
                  {currentQuestionForDisplay.options.map((option, index) => (
                    <div key={option.id || index} className="p-3 border border-gray-200 rounded-md bg-gray-50">
                      {String.fromCharCode(65 + index)}) {option.text || String(option)}
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-sm text-gray-500">
                  L'examen n'est pas actif. Démarrez l'examen depuis le panneau de contrôle pour commencer le vote.
                </p>
              </div>
            </Card>
          ) : (
            <div className="p-6 bg-white rounded-lg shadow text-center">
              <p className="text-gray-600">
                {isLoadingQuestionnaire ? "Chargement du questionnaire..." :
                 (examQuestions.length === 0 ? "Aucun questionnaire n'a pu être chargé pour cet examen." :
                 "Prêt à démarrer. Sélectionnez 'Démarrer Examen' dans le panneau de contrôle.")}
              </p>
              {!isLoadingQuestionnaire && examQuestions.length === 0 && (
                  <Button onClick={() => window.location.reload()} variant="outline" className="mt-4">Recharger la page</Button>
                  // TODO: Replace reload with a proper questionnaire selection/retry mechanism
              )}
            </div>
          )}
        </div>
        <div>
          <ResponseMonitor
            totalParticipants={totalParticipants}
            responsesReceived={Object.keys(responses).length}
            responseDistribution={responses} // ResponseMonitor might need to be adapted to aggregate this if it expects counts per option
            isTestMode={isTestMode}
          />
        </div>
      </div>
    </Layout>
  );
};

export default Exams;