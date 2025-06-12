import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Plus, Trash2, Save, AlertTriangle } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import ThemeSelector from './ThemeSelector';
import PPTXGenerator from './PPTXGenerator';
import { referentials, questionThemes, referentialLimits } from '../../types';
import { mockQuestions } from '../../data/mockData';
import { logger } from '../../utils/logger';
const QuestionnaireForm = () => {
    const [questionnaireName, setQuestionnaireName] = useState('');
    const [selectedReferential, setSelectedReferential] = useState('');
    const [totalQuestions, setTotalQuestions] = useState(40);
    const [showValidationWarning, setShowValidationWarning] = useState(false);
    const [isRandomized, setIsRandomized] = useState(false);
    const [eliminatoryCount, setEliminatoryCount] = useState(3);
    const [themeDistribution, setThemeDistribution] = useState({
        reglementation: 15,
        securite: 15,
        technique: 10
    });
    const referentialOptions = Object.entries(referentials).map(([value, label]) => ({
        value,
        label: `${value} - ${label}`,
    }));
    const handleReferentialChange = (e) => {
        const referential = e.target.value;
        setSelectedReferential(referential);
        logger.info(`Référentiel sélectionné: ${referential}`);
        // Update total questions based on referential limits
        if (referential && referentialLimits[referential]) {
            const defaultTotal = Math.min(40, referentialLimits[referential].max);
            setTotalQuestions(defaultTotal);
        }
        setShowValidationWarning(referential === 'R482');
    };
    const handleTotalQuestionsChange = (e) => {
        const value = parseInt(e.target.value) || 0;
        setTotalQuestions(value);
        // Check limits
        if (selectedReferential && referentialLimits[selectedReferential]) {
            const limits = referentialLimits[selectedReferential];
            if (value < limits.min || value > limits.max) {
                logger.warning(`Nombre de questions hors limites pour ${selectedReferential}: ${limits.min}-${limits.max}`);
            }
        }
    };
    const handleThemeDistributionChange = (theme, count) => {
        setThemeDistribution(prev => ({
            ...prev,
            [theme]: count
        }));
    };
    const handleRandomizeToggle = () => {
        setIsRandomized(!isRandomized);
        logger.info(`Mode aléatoire ${!isRandomized ? 'activé' : 'désactivé'}`);
    };
    const currentTotal = Object.values(themeDistribution).reduce((sum, count) => sum + count, 0);
    const isOverTotal = currentTotal > totalQuestions;
    const isUnderTotal = currentTotal < totalQuestions;
    // Générer les questions pour le PPTX (simulation basée sur la distribution)
    const generateQuestionsForPPTX = () => {
        if (!selectedReferential)
            return [];
        // Filtrer les questions par référentiel
        const availableQuestions = mockQuestions.filter(q => q.referential === selectedReferential);
        if (availableQuestions.length === 0)
            return [];
        const selectedQuestions = [];
        // Pour chaque thème, sélectionner le nombre de questions demandé
        Object.entries(themeDistribution).forEach(([theme, count]) => {
            const themeQuestions = availableQuestions.filter(q => q.theme === theme);
            for (let i = 0; i < count && i < themeQuestions.length; i++) {
                // Convertir en format Vrai/Faux pour OMBEA
                const originalQuestion = themeQuestions[i % themeQuestions.length];
                const convertedQuestion = {
                    ...originalQuestion,
                    type: 'true-false',
                    options: ['Vrai', 'Faux'],
                    correctAnswer: Math.random() > 0.5 ? 0 : 1 // Simulation aléatoire pour la démo
                };
                selectedQuestions.push(convertedQuestion);
            }
        });
        return selectedQuestions.slice(0, totalQuestions);
    };
    const getLimitsWarning = () => {
        if (!selectedReferential || !referentialLimits[selectedReferential]) {
            return null;
        }
        const limits = referentialLimits[selectedReferential];
        if (totalQuestions < limits.min || totalQuestions > limits.max) {
            return (_jsxs("div", { className: "mt-2 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start", children: [_jsx(AlertTriangle, { size: 20, className: "text-red-500 mr-2 flex-shrink-0 mt-0.5" }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-red-800", children: "Nombre de questions hors limites" }), _jsxs("p", { className: "text-sm text-red-700 mt-1", children: ["Pour le r\u00E9f\u00E9rentiel ", selectedReferential, ", le nombre de questions doit \u00EAtre entre ", limits.min, " et ", limits.max, "."] })] })] }));
        }
        return null;
    };
    // Vérifier si on peut générer le PPTX
    const canGeneratePPTX = questionnaireName.trim() && selectedReferential && currentTotal > 0;
    const generatedQuestions = canGeneratePPTX ? generateQuestionsForPPTX() : [];
    return (_jsxs("div", { children: [_jsxs(Card, { title: "Informations g\u00E9n\u00E9rales", className: "mb-6", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsx(Input, { label: "Nom du questionnaire", placeholder: "Ex: CACES R489 Standard", value: questionnaireName, onChange: (e) => setQuestionnaireName(e.target.value), required: true }), _jsx(Select, { label: "R\u00E9f\u00E9rentiel CACES", options: referentialOptions, value: selectedReferential, onChange: handleReferentialChange, placeholder: "S\u00E9lectionner un r\u00E9f\u00E9rentiel", required: true })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-6 mt-4", children: [_jsxs("div", { children: [_jsx(Input, { label: "Nombre total de questions", type: "number", value: totalQuestions, onChange: handleTotalQuestionsChange, min: 10, max: 60, required: true }), getLimitsWarning()] }), _jsx(Input, { label: "Seuil de r\u00E9ussite (%)", type: "number", placeholder: "Ex: 70", min: 0, max: 100, required: true }), _jsx(Input, { label: "Nombre de questions \u00E9liminatoires", type: "number", value: eliminatoryCount, onChange: (e) => setEliminatoryCount(parseInt(e.target.value) || 0), min: 2, max: 5, required: true })] }), _jsxs("div", { className: "mt-4 flex items-center space-x-2", children: [_jsx("input", { type: "checkbox", id: "randomize", checked: isRandomized, onChange: handleRandomizeToggle, className: "h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" }), _jsx("label", { htmlFor: "randomize", className: "text-sm text-gray-700", children: "G\u00E9n\u00E9ration al\u00E9atoire depuis la biblioth\u00E8que" })] }), showValidationWarning && (_jsxs("div", { className: "mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start", children: [_jsx(AlertTriangle, { size: 20, className: "text-amber-500 mr-2 flex-shrink-0 mt-0.5" }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-amber-800", children: "Attention : Version du r\u00E9f\u00E9rentiel" }), _jsx("p", { className: "text-sm text-amber-700 mt-1", children: "Le r\u00E9f\u00E9rentiel R482 a \u00E9t\u00E9 mis \u00E0 jour. Certaines questions pourraient ne plus \u00EAtre conformes \u00E0 la derni\u00E8re version r\u00E9glementaire." })] })] }))] }), _jsx(ThemeSelector, { distribution: themeDistribution, onDistributionChange: handleThemeDistributionChange, totalQuestions: totalQuestions, isRandomized: isRandomized, selectedReferential: selectedReferential }), canGeneratePPTX && (_jsx(PPTXGenerator, { questions: generatedQuestions, questionnaireName: questionnaireName, referential: selectedReferential })), !isRandomized && (_jsxs(Card, { title: "Questions manuelles", className: "mb-6", children: [_jsxs("div", { className: "mb-4 flex justify-between items-center", children: [_jsxs("h4", { className: "text-sm font-medium text-gray-700", children: ["Questions s\u00E9lectionn\u00E9es (", currentTotal, "/", totalQuestions, ")"] }), (isOverTotal || isUnderTotal) && (_jsx("span", { className: `text-sm ${isOverTotal ? 'text-red-600' : 'text-amber-600'}`, children: isOverTotal ? 'Trop de questions sélectionnées' : 'Questions manquantes' }))] }), _jsxs("div", { className: "mb-4 p-4 border border-gray-200 rounded-lg", children: [_jsxs("div", { className: "flex justify-between items-start mb-4", children: [_jsx("div", { className: "flex-1", children: _jsx(Input, { label: "Texte de la question", placeholder: "Entrez le texte de la question...", required: true }) }), _jsx("div", { className: "ml-4 mt-6", children: _jsx(Button, { variant: "outline", icon: _jsx(Trash2, { size: 16 }) }) })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4 mb-4", children: [_jsx(Select, { label: "Type de question", options: [
                                            { value: 'multiple-choice', label: 'Choix multiple' },
                                            { value: 'true-false', label: 'Vrai/Faux' },
                                        ], placeholder: "S\u00E9lectionner", required: true }), _jsx(Select, { label: "Th\u00E8me", options: Object.entries(questionThemes).map(([value, label]) => ({
                                            value,
                                            label
                                        })), placeholder: "S\u00E9lectionner", required: true }), _jsx(Input, { label: "Temps (secondes)", type: "number", placeholder: "Ex: 30", min: 5, required: true })] }), _jsxs("div", { className: "mb-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700", children: "Options de r\u00E9ponse" }), _jsx(Button, { variant: "ghost", size: "sm", icon: _jsx(Plus, { size: 16 }), className: "text-sm", children: "Ajouter option" })] }), _jsx("div", { className: "space-y-2", children: [1, 2, 3, 4].map((i) => (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "flex-shrink-0", children: _jsx("input", { type: "radio", name: "correctAnswer", className: "h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500" }) }), _jsx("div", { className: "flex-1", children: _jsx(Input, { placeholder: `Option ${i}`, className: "mb-0" }) }), _jsx("div", { className: "flex-shrink-0", children: _jsx(Button, { variant: "ghost", size: "sm", icon: _jsx(Trash2, { size: 16 }) }) })] }, i))) })] }), _jsxs("div", { className: "flex items-center", children: [_jsx("input", { type: "checkbox", id: "isEliminatoryQuestion", className: "h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" }), _jsx("label", { htmlFor: "isEliminatoryQuestion", className: "ml-2 block text-sm text-gray-700", children: "Question \u00E9liminatoire (s\u00E9curit\u00E9 critique)" })] })] }), _jsx(Button, { variant: "outline", icon: _jsx(Plus, { size: 16 }), className: "w-full", children: "Ajouter une question" })] })), _jsxs("div", { className: "flex justify-between items-center", children: [_jsx(Button, { variant: "outline", children: "Annuler" }), _jsxs("div", { className: "space-x-3", children: [_jsx(Button, { variant: "outline", icon: _jsx(Save, { size: 16 }), children: "Enregistrer brouillon" }), _jsx(Button, { variant: "primary", icon: _jsx(Save, { size: 16 }), children: "Valider et enregistrer" })] })] })] }));
};
export default QuestionnaireForm;
