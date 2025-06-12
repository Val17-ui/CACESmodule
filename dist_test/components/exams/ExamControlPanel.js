import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Play, Pause, SkipForward, StopCircle, Usb, AlertTriangle, MonitorPlay } from 'lucide-react';
import { logger } from '../../utils/logger';
import { useOmbeaStore } from '../../stores/ombeaStore';
import { ombeaApi } from '../../utils/ombeaApi';
const ExamControlPanel = ({ onStartExam, onPauseExam, onNextQuestion, onStopExam, onToggleFullScreen, isRunning, currentQuestion, totalQuestions, isTestMode, onToggleTestMode, }) => {
    const [showConfirmStop, setShowConfirmStop] = useState(false);
    const { isConnected, connect, disconnect } = useOmbeaStore();
    const handleConnectDevice = async () => {
        try {
            logger.info('Tentative de connexion des boîtiers OMBEA');
            await ombeaApi.connect();
            await connect();
        }
        catch (error) {
            logger.error('Échec de la connexion des boîtiers', error);
        }
    };
    const handleStopExam = () => {
        if (showConfirmStop) {
            logger.warning('Arrêt de l\'examen demandé');
            onStopExam();
            setShowConfirmStop(false);
        }
        else {
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
    return (_jsx(Card, { title: "Panneau de contr\u00F4le", className: "mb-6", children: _jsxs("div", { className: "flex flex-col space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsxs("h3", { className: "text-lg font-medium text-gray-900", children: ["Question ", currentQuestion, " / ", totalQuestions] }), _jsx("p", { className: "text-sm text-gray-500", children: isRunning ? 'Examen en cours' : 'Examen en pause' })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Button, { variant: isConnected ? 'success' : 'outline', icon: _jsx(Usb, { size: 16 }), onClick: handleConnectDevice, disabled: isConnected, children: isConnected ? 'Boîtier connecté' : 'Connecter boîtier' }), _jsx(Button, { variant: "outline", icon: _jsx(MonitorPlay, { size: 16 }), onClick: onToggleFullScreen, children: "Mode pr\u00E9sentation" })] })] }), _jsxs("div", { className: "flex items-center space-x-4 bg-gray-50 p-4 rounded-lg", children: [_jsx("input", { type: "checkbox", id: "testMode", checked: isTestMode, onChange: onToggleTestMode, className: "h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" }), _jsx("label", { htmlFor: "testMode", className: "text-sm text-gray-700", children: "Mode test (r\u00E9ponses anonymes, pas de rapport)" })] }), !isConnected && (_jsxs("div", { className: "p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start", children: [_jsx(AlertTriangle, { size: 20, className: "text-amber-500 mr-2 flex-shrink-0 mt-0.5" }), _jsx("p", { className: "text-sm text-amber-700", children: "Veuillez connecter le bo\u00EEtier OMBEA ResponseLink pour d\u00E9marrer l'examen." })] })), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-3", children: [_jsx(Button, { variant: isRunning ? 'warning' : 'primary', icon: isRunning ? _jsx(Pause, { size: 16 }) : _jsx(Play, { size: 16 }), onClick: isRunning ? onPauseExam : onStartExam, disabled: !isConnected, className: "w-full", children: isRunning ? 'Pause' : 'Démarrer' }), _jsx(Button, { variant: "outline", icon: _jsx(SkipForward, { size: 16 }), onClick: onNextQuestion, disabled: !isRunning || currentQuestion >= totalQuestions, className: "w-full", children: "Question suivante" }), _jsx(Button, { variant: "danger", icon: _jsx(StopCircle, { size: 16 }), onClick: handleStopExam, disabled: !isRunning, className: "w-full", children: showConfirmStop ? 'Confirmer l\'arrêt' : 'Terminer l\'examen' })] }), _jsxs("div", { className: "pt-3 border-t border-gray-200", children: [_jsx("h4", { className: "text-sm font-medium text-gray-700 mb-2", children: "Chronom\u00E8tre" }), _jsxs("div", { className: "bg-gray-100 rounded-lg p-4 text-center", children: [_jsx("span", { className: "text-2xl font-semibold text-gray-900", children: "00:30" }), _jsx("div", { className: "w-full bg-gray-200 rounded-full h-2.5 mt-2", children: _jsx("div", { className: "bg-blue-600 h-2.5 rounded-full", style: { width: '60%' } }) })] })] })] }) }));
};
export default ExamControlPanel;
