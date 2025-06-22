import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Play, Pause, SkipForward, StopCircle, Usb, AlertTriangle, MonitorPlay, ZapOff, Loader2, CheckCircle } from 'lucide-react'; // Added CheckCircle
import { logger } from '../../utils/logger';
import { useOmbeaStore } from '../../stores/ombeaStore';

interface ExamControlPanelProps {
  onStartExam: () => void;
  onPauseExam: () => void;
  onNextQuestion: () => void;
  onStopExam: () => void;
  onToggleFullScreen: () => void;
  isRunning: boolean;
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
    isConnected: isOmbeaAuthAndLinksFetched, // Renamed for clarity: true if auth OK & links fetched
    isConnecting: isOmbeaConnecting,
    connectionError: ombeaConnectionError,
    connect: connectOmbeaStore,
    disconnect: disconnectOmbeaStore,
    devices, // Get the list of devices
    activeResponseLinkId // Get the active ResponseLink ID
  } = useOmbeaStore();

  const numberOfConnectedDevices = Object.values(devices || {}).filter(d => d.connected).length;
  const hasActiveResponseLink = !!activeResponseLinkId;
  // Exam can start if Ombea is "connected" (auth + links fetched) AND (an active RL is found OR test mode is enabled)
  const canStartExam = isOmbeaAuthAndLinksFetched && (hasActiveResponseLink || isTestMode) && totalQuestions > 0;


  const handleConnectDisconnectDevice = async () => {
    if (isOmbeaAuthAndLinksFetched) { // If already "connected" (auth+link fetch attempted), disconnect
      logger.info('ExamControlPanel: User initiated Ombea disconnection from store.');
      disconnectOmbeaStore();
    } else if (!isOmbeaConnecting) { // If not connecting, try to connect
      logger.info('ExamControlPanel: User initiated Ombea connection via store.');
      await connectOmbeaStore();
    }
  };

  const handleStopExamWithConfirm = () => {
    if (showConfirmStop) {
      logger.warning('ExamControlPanel: Arrêt de l\'examen confirmé.');
      onStopExam();
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

  const getStatusText = () => {
    if (isOmbeaConnecting) return "Connexion OMBEA...";
    if (!isOmbeaAuthAndLinksFetched && ombeaConnectionError) return "Erreur de connexion";
    if (!isOmbeaAuthAndLinksFetched) return "OMBEA déconnecté";
    // At this point, isOmbeaAuthAndLinksFetched is true (auth was ok, link fetch attempted)
    if (isRunning) return `Examen en cours (${numberOfConnectedDevices} boîtier(s))`;
    if (hasActiveResponseLink) return `Prêt (${numberOfConnectedDevices} boîtier(s) - Actif: ${activeResponseLinkId})`;
    if (numberOfConnectedDevices > 0 && !hasActiveResponseLink) return `Prêt (${numberOfConnectedDevices} boîtier(s) - Aucun actif)`; // Should not happen if logic is correct
    if (ombeaConnectionError) return `Connecté, mais: ${ombeaConnectionError}`; // e.g. "Aucun boîtier actif"
    return "OMBEA Connecté (aucun boîtier actif)";
  };


  return (
    <Card title="Panneau de Contrôle de l'Examen" className="mb-6">
      <div className="flex flex-col space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              {totalQuestions > 0 ? `Question ${currentQuestionNumber} / ${totalQuestions}` : "Aucun questionnaire chargé"}
            </h3>
            <p className="text-sm text-gray-500">
              {getStatusText()}
            </p>
          </div>
          <div className="flex items-center space-x-2 mt-2 sm:mt-0">
            <Button
              variant={isOmbeaAuthAndLinksFetched && hasActiveResponseLink ? 'successOutline' : (isOmbeaConnecting ? 'secondary' : 'outline')}
              icon={
                isOmbeaConnecting ? <Loader2 size={16} className="animate-spin" /> :
                isOmbeaAuthAndLinksFetched && hasActiveResponseLink ? <CheckCircle size={16} /> : // Changed icon for "fully" connected
                isOmbeaAuthAndLinksFetched && !hasActiveResponseLink ? <AlertTriangle size={16} /> : // Auth OK, but no active link
                <Usb size={16} />
              }
              onClick={handleConnectDisconnectDevice}
              disabled={isOmbeaConnecting}
              tooltip={
                isOmbeaConnecting ? "Connexion en cours..." :
                isOmbeaAuthAndLinksFetched ? "Rafraîchir la connexion / Déconnecter" :
                "Connecter OMBEA"
              }
            >
              {
                isOmbeaConnecting ? 'Connexion...' :
                isOmbeaAuthAndLinksFetched && hasActiveResponseLink ? `OMBEA Actif (${activeResponseLinkId})` :
                isOmbeaAuthAndLinksFetched ? 'OMBEA (Pas Actif)' :
                'Connecter OMBEA'
              }
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
            id="examTestModeCtrl"
            checked={isTestMode}
            onChange={onToggleTestMode}
            className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            disabled={isRunning && isOmbeaAuthAndLinksFetched}
          />
          <label htmlFor="examTestModeCtrl" className="text-sm text-gray-700 cursor-pointer">
            Mode Test (simulation des réponses)
          </label>
        </div>

        {ombeaConnectionError && !isOmbeaConnecting && ( // Show error if not connecting (to avoid showing auth error during link fetch error)
          <div className={`p-3 border rounded-lg flex items-start text-sm ${isOmbeaAuthAndLinksFetched ? 'bg-yellow-50 border-yellow-300 text-yellow-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            <AlertTriangle size={20} className="mr-2 flex-shrink-0 mt-0.5" />
            <p>
              <strong>{isOmbeaAuthAndLinksFetched ? "Avertissement OMBEA:" : "Erreur OMBEA:"}</strong> {ombeaConnectionError}.
            </p>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Button
            variant={isRunning ? 'warning' : 'primary'}
            icon={isRunning ? <Pause size={18} /> : <Play size={18} />}
            onClick={isRunning ? onPauseExam : onStartExam}
            disabled={isOmbeaConnecting || !canStartExam}
            className="w-full py-3 text-base"
            tooltip={
              isOmbeaConnecting ? "Connexion en cours..." :
              !isOmbeaAuthAndLinksFetched ? "Connectez OMBEA d'abord" :
              !hasActiveResponseLink && !isTestMode ? "Aucun boîtier OMBEA actif" :
              totalQuestions === 0 ? "Chargez un questionnaire" :
              isRunning ? "Mettre en pause le déroulement" :
              "Démarrer l'examen"
            }
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
        
        {/* Timer Display Placeholder - Actual timer is in OmbeaExamVoteDisplay */}
        <div className="pt-3 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-1">Chronomètre (Question Actuelle)</h4>
          <div className="bg-gray-100 rounded-lg p-3 text-center">
            <span className="text-3xl font-semibold text-gray-800">--:--</span>
            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
              <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: '0%' }}></div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ExamControlPanel;