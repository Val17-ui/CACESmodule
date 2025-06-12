import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Timer, Users, ArrowLeft } from 'lucide-react';
import { logger } from '../../utils/logger';
import Button from '../ui/Button';
const ExamFullScreen = ({ question, currentQuestionIndex, totalQuestions, timeLimit, deviceCount, responses, isTestMode = false, onExitFullScreen, }) => {
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
        const stats = {};
        Object.values(responses).forEach((response) => {
            stats[response] = (stats[response] || 0) + 1;
        });
        return stats;
    };
    return (_jsxs("div", { className: "fixed inset-0 bg-gray-100 flex flex-col p-8", children: [_jsxs("div", { className: "flex justify-between items-center mb-8", children: [_jsxs("div", { className: "flex items-center space-x-4", children: [_jsx(Button, { variant: "outline", icon: _jsx(ArrowLeft, { size: 20 }), onClick: onExitFullScreen, children: "Retour" }), _jsxs("span", { className: "text-2xl font-bold", children: ["Question ", currentQuestionIndex + 1, "/", totalQuestions] }), question.isEliminatory && (_jsx("span", { className: "bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium", children: "Question \u00E9liminatoire" }))] }), _jsxs("div", { className: "flex items-center space-x-6", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Users, { className: "text-gray-500", size: 24 }), _jsxs("span", { className: "text-xl font-medium", children: [deviceCount, " bo\u00EEtiers"] })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Timer, { className: "text-gray-500", size: 24 }), _jsxs("span", { className: "text-xl font-medium", children: [timeLeft, "s"] })] })] })] }), _jsxs("div", { className: "flex-1 flex flex-col justify-center max-w-4xl mx-auto w-full", children: [_jsxs("div", { className: "text-center mb-12", children: [_jsx("h2", { className: "text-3xl font-bold mb-8", children: question.text }), question.image && (_jsx("div", { className: "mb-8", children: _jsx("img", { src: question.image, alt: "Illustration de la question", className: "max-w-2xl mx-auto rounded-lg shadow-md" }) })), _jsx("div", { className: "grid grid-cols-2 gap-6", children: question.options.map((option, index) => (_jsxs("div", { className: "bg-white p-6 rounded-xl shadow-sm border-2 border-gray-200", children: [_jsx("div", { className: "text-2xl font-bold mb-2 text-blue-600", children: String.fromCharCode(65 + index) }), _jsx("div", { className: "text-xl", children: option }), isTestMode && (_jsxs("div", { className: "mt-4 text-gray-500", children: [((getResponseStats()[String.fromCharCode(65 + index)] || 0) / deviceCount * 100).toFixed(0), "%"] }))] }, index))) })] }), _jsxs("div", { className: "bg-white rounded-xl p-6 shadow-sm", children: [_jsx("h3", { className: "text-lg font-medium mb-4", children: "\u00C9tat des bo\u00EEtiers" }), _jsx("div", { className: "grid grid-cols-10 gap-2", children: Array.from({ length: deviceCount }).map((_, index) => (_jsx("div", { className: `
                  w-12 h-12 rounded-lg flex items-center justify-center text-lg font-medium
                  ${responses[index + 1] ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}
                `, children: index + 1 }, index))) })] })] })] }));
};
export default ExamFullScreen;
