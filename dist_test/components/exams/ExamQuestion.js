import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import Card from '../ui/Card';
const ExamQuestion = ({ question, currentQuestionIndex, totalQuestions, isTestMode = false, responseDistribution = {}, }) => {
    const calculatePercentage = (option, index) => {
        const letter = String.fromCharCode(65 + index);
        const responses = Object.values(responseDistribution).reduce((sum, count) => sum + count, 0);
        if (responses === 0)
            return 0;
        return Math.round((responseDistribution[letter] || 0) / responses * 100);
    };
    return (_jsxs(Card, { className: "mb-6", children: [_jsxs("div", { className: "mb-6 flex items-center justify-between", children: [_jsxs("h3", { className: "text-xl font-semibold text-gray-900", children: ["Question ", currentQuestionIndex + 1, "/", totalQuestions] }), question.isEliminatory && !isTestMode && (_jsx("span", { className: "inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800", children: "\u00C9liminatoire" }))] }), _jsx("div", { className: "mb-8", children: _jsx("p", { className: "text-lg text-gray-800", children: question.text }) }), _jsx("div", { className: "space-y-3", children: question.options.map((option, index) => (_jsxs("div", { className: "flex items-center p-4 border border-gray-200 rounded-xl hover:bg-gray-50", children: [_jsx("div", { className: "flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-700 font-medium mr-3", children: String.fromCharCode(65 + index) }), _jsx("span", { className: "text-gray-800 flex-1", children: option }), isTestMode && (_jsxs("div", { className: "ml-4 flex items-center", children: [_jsx("div", { className: "w-16 h-2 bg-gray-200 rounded-full mr-2", children: _jsx("div", { className: "h-2 bg-blue-600 rounded-full transition-all duration-500", style: { width: `${calculatePercentage(option, index)}%` } }) }), _jsxs("span", { className: "text-sm text-gray-500 w-12 text-right", children: [calculatePercentage(option, index), "%"] })] }))] }, index))) }), _jsxs("div", { className: "mt-6 pt-6 border-t border-gray-200 flex justify-between items-center", children: [_jsxs("span", { className: "text-sm text-gray-500", children: ["Temps restant : ", _jsx("span", { className: "font-medium", children: "30 secondes" })] }), _jsx("span", { className: "text-sm text-gray-500", children: isTestMode ? 'Mode test actif - Réponses anonymes' : 'Utilisez les boîtiers de vote pour répondre' })] })] }));
};
export default ExamQuestion;
