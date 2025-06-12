import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Card from '../ui/Card';
const ResponseMonitor = ({ totalParticipants, responsesReceived, responseDistribution, isTestMode = false, }) => {
    const responsePercentage = (responsesReceived / totalParticipants) * 100;
    const responseLetters = ['A', 'B', 'C', 'D'];
    return (_jsxs(Card, { title: isTestMode ? "Suivi des réponses (Mode test)" : "Suivi des réponses", children: [_jsxs("div", { className: "mb-4", children: [_jsx("h3", { className: "text-sm font-medium text-gray-700 mb-1", children: "Taux de r\u00E9ponse" }), _jsxs("div", { className: "flex items-center mb-2", children: [_jsx("div", { className: "flex-1 mr-4", children: _jsx("div", { className: "w-full bg-gray-200 rounded-full h-2.5", children: _jsx("div", { className: "bg-blue-600 h-2.5 rounded-full transition-all duration-500", style: { width: `${responsePercentage}%` } }) }) }), _jsxs("span", { className: "text-sm font-medium text-gray-900", children: [responsesReceived, "/", totalParticipants] })] }), _jsxs("p", { className: "text-xs text-gray-500", children: [responsePercentage.toFixed(0), "% des participants ont r\u00E9pondu"] })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-700 mb-2", children: "Distribution des r\u00E9ponses" }), _jsx("div", { className: "space-y-2", children: responseLetters.map((letter) => {
                            const count = responseDistribution[letter] || 0;
                            const percentage = (count / totalParticipants) * 100;
                            return (_jsxs("div", { className: "flex items-center", children: [_jsx("div", { className: "flex-shrink-0 w-4 text-sm font-medium text-gray-700 mr-2", children: letter }), _jsx("div", { className: "flex-1 mx-2", children: _jsx("div", { className: "w-full bg-gray-200 rounded-full h-2", children: _jsx("div", { className: "bg-blue-600 h-2 rounded-full transition-all duration-500", style: { width: `${percentage}%` } }) }) }), _jsxs("div", { className: "flex-shrink-0 w-16 text-right text-xs text-gray-500", children: [count, " (", percentage.toFixed(0), "%)"] })] }, letter));
                        }) })] }), _jsxs("div", { className: "mt-4 pt-4 border-t border-gray-200", children: [_jsx("h3", { className: "text-sm font-medium text-gray-700 mb-2", children: "\u00C9tat des bo\u00EEtiers" }), _jsx("div", { className: "grid grid-cols-10 gap-1", children: Array.from({ length: totalParticipants }).map((_, index) => {
                            const hasResponded = index < responsesReceived;
                            return (_jsx("div", { className: `
                  w-6 h-6 rounded-md flex items-center justify-center text-xs font-medium
                  transition-colors duration-300
                  ${hasResponded ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}
                `, children: index + 1 }, index));
                        }) }), isTestMode && (_jsx("p", { className: "mt-4 text-xs text-amber-600", children: "Mode test actif : Les r\u00E9ponses sont anonymes et ne seront pas enregistr\u00E9es" }))] })] }));
};
export default ResponseMonitor;
