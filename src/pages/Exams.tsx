import React, { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import ExamControlPanel from '../components/exams/ExamControlPanel';
import ExamQuestion from '../components/exams/ExamQuestion';
import ExamFullScreen from '../components/exams/ExamFullScreen';
import ResponseMonitor from '../components/exams/ResponseMonitor';
import { mockQuestions } from '../data/mockData';
import { logger } from '../utils/logger';
import { useOmbeaStore } from '../stores/ombeaStore';
import { ombeaApi } from '../utils/ombeaApi';

type ExamsProps = {
  activePage: string;
  onPageChange: (page: string) => void;
};

const Exams: React.FC<ExamsProps> = ({ activePage, onPageChange }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const {
    isTestMode,
    setTestMode,
    responses,
    clearResponses,
    isConnected
  } = useOmbeaStore();

  // Start/stop simulated responses in test mode
  useEffect(() => {
    if (isTestMode && isRunning) {
      ombeaApi.startSimulatedResponses((deviceId, response) => {
        useOmbeaStore.getState().handleResponse(deviceId, response);
      });
    } else {
      ombeaApi.stopSimulatedResponses();
    }

    return () => ombeaApi.stopSimulatedResponses();
  }, [isTestMode, isRunning]);

  const handleStartExam = () => {
    setIsRunning(true);
    clearResponses();
    logger.info(`Démarrage de l'examen en mode ${isTestMode ? 'test' : 'officiel'}`);
  };

  const handlePauseExam = () => {
    setIsRunning(false);
    logger.info('Pause de l\'examen');
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < mockQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      clearResponses();
      logger.info(`Passage à la question ${currentQuestionIndex + 2}`);
    }
  };

  const handleStopExam = () => {
    setIsRunning(false);
    clearResponses();
    logger.warning('Arrêt de l\'examen');
  };

  const handleToggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
    logger.info(`Mode présentation ${!isFullScreen ? 'activé' : 'désactivé'}`);
  };

  const handleToggleTestMode = () => {
    setTestMode(!isTestMode);
  };

  // Calculate response statistics
  const getResponseDistribution = () => {
    const distribution: Record<string, number> = {};
    Object.values(responses).forEach(response => {
      distribution[response] = (distribution[response] || 0) + 1;
    });
    return distribution;
  };

  if (isFullScreen) {
    return (
      <ExamFullScreen
        question={mockQuestions[currentQuestionIndex]}
        currentQuestionIndex={currentQuestionIndex}
        totalQuestions={mockQuestions.length}
        timeLimit={30}
        deviceCount={15}
        responses={responses}
        isTestMode={isTestMode}
      />
    );
  }

  return (
    <Layout
      title="Mode examen"
      subtitle={`Session CACES R489 - Groupe Duval ${isTestMode ? '(Mode test)' : ''}`}
      activePage={activePage}
      onPageChange={onPageChange}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ExamControlPanel
            onStartExam={handleStartExam}
            onPauseExam={handlePauseExam}
            onNextQuestion={handleNextQuestion}
            onStopExam={handleStopExam}
            onToggleFullScreen={handleToggleFullScreen}
            isRunning={isRunning}
            currentQuestion={currentQuestionIndex + 1}
            totalQuestions={mockQuestions.length}
            isTestMode={isTestMode}
            onToggleTestMode={handleToggleTestMode}
          />
          <ExamQuestion
            question={mockQuestions[currentQuestionIndex]}
            currentQuestionIndex={currentQuestionIndex}
            totalQuestions={mockQuestions.length}
            isTestMode={isTestMode}
            responseDistribution={getResponseDistribution()}
          />
        </div>
        <div>
          <ResponseMonitor
            totalParticipants={15}
            responsesReceived={Object.keys(responses).length}
            responseDistribution={getResponseDistribution()}
            isTestMode={isTestMode}
          />
        </div>
      </div>
    </Layout>
  );
};

export default Exams;