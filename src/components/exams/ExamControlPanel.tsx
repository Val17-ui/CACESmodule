import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Play, Pause, SkipForward, StopCircle, Usb, AlertTriangle, MonitorPlay } from 'lucide-react';
import { logger } from '../../utils/logger';
import { useOmbeaStore } from '../../stores/ombeaStore';
import { ombeaApi } from '../../utils/ombeaApi';

interface ExamControlPanelProps {
  onStartExam: () => void;
  onPauseExam: () => void;
  onNextQuestion: () => void;
  onStopExam: () => void;
  onToggleFullScreen: () => void;
  isRunning: boolean;
  currentQuestion: number;
  totalQuestions: number;
  isTestMode: boolean;
  onToggleTestMode: () => void;
}

const ExamControlPanel: React.FC<ExamControlPanelProps> = ({
  onStartExam,
  onPauseExam,
  onNextQuestion,
  onStopExam,
  onToggleFullScreen,
  isRunning,
  currentQuestion,
  totalQuestions,
  isTestMode,
  onToggleTestMode,
}) => {
  const [showConfirmStop, setShowConfirmStop] = useState(false);
  const { isConnected, connect, disconnect } = useOmbeaStore();

  const handleConnectDevice = async () => {
    try {
      logger.info('Tentative de connexion des boîtiers OMBEA');
      await ombeaApi.connect();
      await connect();
    } catch (error) {
      logger.error('Échec de la connexion des boîtiers', error);
    }
  };

  const handleStopExam = () => {
    if (showConfirmStop) {
      logger.warning('Arrêt de l\'examen demandé');
      onStopExam();
      setShowConfirmStop(false);
    } else {
      setShowConfirmStop(true);
    }
  };

  useEffect(() => {
    return () => {
      if (isConnected) {
        disconnect();
        ombeaApi.disconnect();
      }
    };
  }, [isConnected, disconnect]);

  return (
    <Card title="Panneau de contrôle" className="mb-6">
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              Question {currentQuestion} / {totalQuestions}
            </h3>
            <p className="text-sm text-gray-500">
              {isRunning ? 'Examen en cours' : 'Examen en pause'}
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant={isConnected ? 'success' : 'outline'}
              icon={<Usb size={16} />}
              onClick={handleConnectDevice}
              disabled={isConnected}
            >
              {isConnected ? 'Boîtier connecté' : 'Connecter boîtier'}
            </Button>
            
            <Button
              variant="outline"
              icon={<MonitorPlay size={16} />}
              onClick={onToggleFullScreen}
            >
              Mode présentation
            </Button>
          </div>
        </div>
        
        <div className="flex items-center space-x-4 bg-gray-50 p-4 rounded-lg">
          <input
            type="checkbox"
            id="testMode"
            checked={isTestMode}
            onChange={onToggleTestMode}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="testMode" className="text-sm text-gray-700">
            Mode test (réponses anonymes, pas de rapport)
          </label>
        </div>

        {!isConnected && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start">
            <AlertTriangle size={20} className="text-amber-500 mr-2 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700">
              Veuillez connecter le boîtier OMBEA ResponseLink pour démarrer l'examen.
            </p>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Button
            variant={isRunning ? 'warning' : 'primary'}
            icon={isRunning ? <Pause size={16} /> : <Play size={16} />}
            onClick={isRunning ? onPauseExam : onStartExam}
            disabled={!isConnected}
            className="w-full"
          >
            {isRunning ? 'Pause' : 'Démarrer'}
          </Button>
          
          <Button
            variant="outline"
            icon={<SkipForward size={16} />}
            onClick={onNextQuestion}
            disabled={!isRunning || currentQuestion >= totalQuestions}
            className="w-full"
          >
            Question suivante
          </Button>
          
          <Button
            variant="danger"
            icon={<StopCircle size={16} />}
            onClick={handleStopExam}
            disabled={!isRunning}
            className="w-full"
          >
            {showConfirmStop ? 'Confirmer l\'arrêt' : 'Terminer l\'examen'}
          </Button>
        </div>
        
        <div className="pt-3 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Chronomètre</h4>
          <div className="bg-gray-100 rounded-lg p-4 text-center">
            <span className="text-2xl font-semibold text-gray-900">
              00:30
            </span>
            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
              <div 
                className="bg-blue-600 h-2.5 rounded-full" 
                style={{ width: '60%' }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ExamControlPanel;