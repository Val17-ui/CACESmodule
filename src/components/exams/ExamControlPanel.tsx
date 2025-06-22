import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Play, Pause, SkipForward, StopCircle, Usb, AlertTriangle, MonitorPlay, ZapOff, Loader2 } from 'lucide-react';
import { logger } from '../../utils/logger';
import { useOmbeaStore } from '../../stores/ombeaStore';

interface ExamControlPanelProps {
  onStartExam: () => void;
  onPauseExam: () => void; // Note: "Pause" functionality might need more definition with Ombea direct voting
  onNextQuestion: () => void;
  onStopExam: () => void;
  onToggleFullScreen: () => void;
  isRunning: boolean; // True if votingSession.isActive
  currentQuestionNumber: number;
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
  currentQuestionNumber,
  totalQuestions,
  isTestMode,
  onToggleTestMode,
}) => {
  const [showConfirmStop, setShowConfirmStop] = useState(false);
  const {
    isConnected: isOmbeaConnected,
    isConnecting: isOmbeaConnecting,
    connectionError: ombeaConnectionError,
    connect: connectOmbeaStore, // Renamed to avoid conflict if we had local connect
    disconnect: disconnectOmbeaStore // Renamed
  } = useOmbeaStore();

  const handleConnectDisconnectDevice = async () => {
    if (isOmbeaConnected) {
      logger.info('ExamControlPanel: User initiated Ombea disconnection from store.');
      disconnectOmbeaStore();
    } else if (!isOmbeaConnecting) {
      logger.info('ExamControlPanel: User initiated Ombea connection via store.');
      await connectOmbeaStore();
    }
  };

  const handleStopExamWithConfirm = () => {
    if (showConfirmStop) {
      logger.warning('ExamControlPanel: Arrêt de l\'examen confirmé.');
      onStopExam(); // This will call endVotingSession from Exams.tsx
      setShowConfirmStop(false);
    } else {
      setShowConfirmStop(true);
      logger.info('ExamControlPanel: Confirmation d\'arrêt demandée.');
    }
  };

  useEffect(() => {
    if (!isRunning && showConfirmStop) {
      setShowConfirmStop(false);
    }
  }, [isRunning, showConfirmStop]);

  // Timer display state (visual only, logic is in VoteDisplay component)
  // This is a placeholder, the actual timer will be managed by the voting display component.
  const [displayTime, setDisplayTime] = useState("--:--");
  const currentQuestionDetails = useOmbeaStore(state => state.votingSession.currentQuestion);
  useEffect(() => {
    if (isRunning && currentQuestionDetails?.timeLimit) {
        // This is just for a mock display, real timer is elsewhere
        // setDisplayTime(`00:${String(currentQuestionDetails.timeLimit).padStart(2, '0')}`);
    } else if (!isRunning) {
        // setDisplayTime("--:--");
    }
  }, [isRunning, currentQuestionDetails]);


  return (
    <Card title="Panneau de Contrôle de l'Examen" className="mb-6">
      <div className="flex flex-col space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              {totalQuestions > 0 ? `Question ${currentQuestionNumber} / ${totalQuestions}` : "Aucun questionnaire chargé"}
            </h3>
            <p className="text-sm text-gray-500">
              {isRunning ? 'Examen en cours (Vote Actif)' :
               (isOmbeaConnected ? 'Prêt à démarrer' :
               (isOmbeaConnecting ? 'Connexion OMBEA...' : 'OMBEA déconnecté'))}
            </p>
          </div>
          <div className="flex items-center space-x-2 mt-2 sm:mt-0">
            <Button
              variant={isOmbeaConnected ? 'successOutline' : (isOmbeaConnecting ? 'secondary' : 'outline')}
              icon={isOmbeaConnected ? <ZapOff size={16} /> : (isOmbeaConnecting ? <Loader2 size={16} className="animate-spin" /> : <Usb size={16} />)}
              onClick={handleConnectDisconnectDevice}
              disabled={isOmbeaConnecting}
              tooltip={isOmbeaConnected ? "Déconnecter OMBEA" : (isOmbeaConnecting ? "Connexion en cours..." : "Connecter OMBEA")}
            >
              {isOmbeaConnected ? 'OMBEA Connecté' : (isOmbeaConnecting ? 'Connexion...' : 'Connecter OMBEA')}
            </Button>
            <Button
              variant="outline"
              icon={<MonitorPlay size={16} />}
              onClick={onToggleFullScreen}
              tooltip="Passer en mode présentation"
            >
              Présentation
            </Button>
          </div>
        </div>

        <div className="flex items-center space-x-3 bg-gray-50 p-3 rounded-lg border">
          <input
            type="checkbox"
            id="examTestModeCtrl" // Unique ID
            checked={isTestMode}
            onChange={onToggleTestMode}
            className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            disabled={isRunning && isOmbeaConnected}
          />
          <label htmlFor="examTestModeCtrl" className="text-sm text-gray-700 cursor-pointer">
            Mode Test (simulation des réponses)
          </label>
        </div>

        {ombeaConnectionError && !isOmbeaConnected && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start text-red-700">
            <AlertTriangle size={20} className="mr-2 flex-shrink-0 mt-0.5" />
            <p className="text-sm">
              <strong>Erreur OMBEA:</strong> {ombeaConnectionError}.
            </p>
          </div>
        )}
        {!isOmbeaConnected && !isOmbeaConnecting && !ombeaConnectionError && totalQuestions > 0 && (
           <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start text-amber-700">
            <AlertTriangle size={20} className="mr-2 flex-shrink-0 mt-0.5" />
            <p className="text-sm">
              Connectez le système OMBEA pour démarrer.
            </p>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Button
            variant={isRunning ? 'warning' : 'primary'}
            icon={isRunning ? <Pause size={18} /> : <Play size={18} />}
            onClick={isRunning ? onPauseExam : onStartExam}
            disabled={!isOmbeaConnected || isOmbeaConnecting || totalQuestions === 0}
            className="w-full py-3 text-base"
            tooltip={isRunning ? "Mettre en pause le déroulement (fonction à définir)" : (totalQuestions === 0 ? "Chargez un questionnaire" : "Démarrer l'examen")}
          >
            {isRunning ? 'Pause Examen' : 'Démarrer Examen'}
          </Button>
          
          <Button
            variant="secondary"
            icon={<SkipForward size={18} />}
            onClick={onNextQuestion}
            disabled={!isRunning || currentQuestionNumber >= totalQuestions}
            className="w-full py-3 text-base"
            tooltip={!isRunning ? "Démarrez l'examen pour naviguer" : (currentQuestionNumber >= totalQuestions ? "Dernière question atteinte" : "Passer à la question suivante")}
          >
            Question Suivante
          </Button>
          
          <Button
            variant={showConfirmStop ? "danger" : "dangerOutline"}
            icon={<StopCircle size={18} />}
            onClick={handleStopExamWithConfirm}
            disabled={!isRunning && !showConfirmStop}
            className="w-full py-3 text-base"
            tooltip={showConfirmStop ? "Confirmer l'arrêt de l'examen" : "Terminer l'examen en cours"}
          >
            {showConfirmStop ? 'Confirmer Arrêt' : 'Terminer Examen'}
          </Button>
        </div>
        
        <div className="pt-3 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-1">Chronomètre (Question)</h4>
          <div className="bg-gray-100 rounded-lg p-3 text-center">
            <span className="text-3xl font-semibold text-gray-800">
              {displayTime} {/* This is a mock display */}
            </span>
            {/* Real progress bar will be in OmbeaExamVoteDisplay */}
             <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
              <div 
                className="bg-blue-500 h-1.5 rounded-full"
                style={{ width: isRunning ? '50%' : '0%' }} // Mock progress
              ></div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ExamControlPanel;