import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Shuffle } from 'lucide-react';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { questionThemes } from '../../types';
import { logger } from '../../utils/logger';
const ThemeSelector = ({ distribution, onDistributionChange, totalQuestions, isRandomized = false, selectedReferential = '' }) => {
    const handleThemeCountChange = (theme, value) => {
        const count = parseInt(value) || 0;
        logger.info(`Modification du nombre de questions pour le thème ${questionThemes[theme]}: ${count}`);
        onDistributionChange(theme, count);
    };
    const handleGenerateRandom = () => {
        if (!selectedReferential) {
            logger.warning('Veuillez sélectionner un référentiel avant la génération aléatoire');
            return;
        }
        logger.info(`Génération aléatoire de ${totalQuestions} questions pour ${selectedReferential}`);
        // Here we would implement the actual random generation from the library
    };
    const currentTotal = Object.values(distribution).reduce((sum, count) => sum + count, 0);
    const isOverTotal = currentTotal > totalQuestions;
    return (_jsx(Card, { title: "Distribution par th\u00E8me", className: "mb-6", children: _jsxs("div", { className: "space-y-4", children: [Object.entries(questionThemes).map(([theme, label]) => (_jsx("div", { className: "flex items-center space-x-4", children: _jsxs("div", { className: "flex-1", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: label }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Input, { type: "number", value: distribution[theme], onChange: (e) => handleThemeCountChange(theme, e.target.value), min: 0, max: totalQuestions, className: "w-24", disabled: isRandomized }), _jsx("div", { className: "flex-1", children: _jsx("div", { className: "w-full bg-gray-200 rounded-full h-2", children: _jsx("div", { className: "bg-blue-600 h-2 rounded-full transition-all", style: {
                                                    width: `${(distribution[theme] / totalQuestions) * 100}%`,
                                                } }) }) }), _jsxs("span", { className: "text-sm text-gray-500 w-16 text-right", children: [((distribution[theme] / totalQuestions) * 100).toFixed(0), "%"] })] })] }) }, theme))), _jsx("div", { className: "pt-4 border-t border-gray-200", children: _jsxs("div", { className: "flex justify-between items-center text-sm", children: [_jsxs("span", { className: "font-medium text-gray-700", children: ["Total s\u00E9lectionn\u00E9 : ", currentTotal, " / ", totalQuestions] }), isOverTotal && (_jsx("span", { className: "text-red-600", children: "Le nombre total de questions d\u00E9passe la limite" }))] }) }), isRandomized && (_jsx("div", { className: "pt-4 border-t border-gray-200", children: _jsxs("div", { className: "bg-blue-50 p-4 rounded-lg", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("h4", { className: "text-sm font-medium text-blue-900", children: "G\u00E9n\u00E9ration al\u00E9atoire activ\u00E9e" }), _jsx(Button, { variant: "outline", size: "sm", icon: _jsx(Shuffle, { size: 16 }), onClick: handleGenerateRandom, disabled: !selectedReferential, children: "G\u00E9n\u00E9rer" })] }), _jsx("p", { className: "text-sm text-blue-800", children: "Les questions seront s\u00E9lectionn\u00E9es automatiquement depuis la biblioth\u00E8que selon la distribution d\u00E9finie ci-dessus." }), !selectedReferential && (_jsx("p", { className: "text-sm text-amber-700 mt-2", children: "Veuillez d'abord s\u00E9lectionner un r\u00E9f\u00E9rentiel." }))] }) })), _jsx("div", { className: "bg-blue-50 p-4 rounded-lg mt-4", children: _jsxs("p", { className: "text-sm text-blue-800", children: [_jsx("strong", { children: "Recommandations Cnam :" }), _jsxs("ul", { className: "mt-2 list-disc list-inside", children: [_jsx("li", { children: "20-50 questions au total selon le r\u00E9f\u00E9rentiel" }), _jsx("li", { children: "2-5 questions \u00E9liminatoires" }), _jsx("li", { children: "\u226570% pour r\u00E9ussir l'examen" }), _jsx("li", { children: "\u226550% par th\u00E8me" })] })] }) })] }) }));
};
export default ThemeSelector;
