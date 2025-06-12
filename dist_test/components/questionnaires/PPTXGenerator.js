import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { FileText, Download, AlertTriangle, CheckCircle } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { generatePPTX } from '../../utils/pptxGenerator';
import { logger } from '../../utils/logger';
const PPTXGenerator = ({ questions, questionnaireName, referential }) => {
    const [templateFile, setTemplateFile] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [status, setStatus] = useState(null);
    // Convertir les questions de la plateforme au format PPTX
    const convertQuestionsForPPTX = (platformQuestions) => {
        return platformQuestions.map(q => ({
            question: q.text,
            correctAnswer: q.type === 'true-false' ? (q.correctAnswer === 0) : true, // Pour Vrai/Faux: 0=Vrai, 1=Faux
            duration: q.timeLimit || 30,
            imagePath: q.image || undefined
        }));
    };
    const handleTemplateUpload = (event) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
                setTemplateFile(file);
                setStatus({ message: 'Template PPTX chargé avec succès', type: 'success' });
                logger.info(`Template PPTX chargé: ${file.name}`);
            }
            else {
                setStatus({ message: 'Veuillez sélectionner un fichier PPTX valide', type: 'error' });
            }
        }
    };
    const handleGeneratePPTX = async () => {
        if (!templateFile) {
            setStatus({ message: 'Veuillez d\'abord charger un template PPTX', type: 'error' });
            return;
        }
        if (questions.length === 0) {
            setStatus({ message: 'Aucune question disponible pour la génération', type: 'error' });
            return;
        }
        setIsGenerating(true);
        setStatus({ message: 'Génération du PPTX interactif en cours...', type: 'info' });
        try {
            const pptxQuestions = convertQuestionsForPPTX(questions);
            const fileName = `${questionnaireName.replace(/[^a-zA-Z0-9]/g, '_')}_${referential}_OMBEA.pptx`;
            await generatePPTX(templateFile, pptxQuestions, { fileName });
            setStatus({
                message: `PPTX interactif généré avec succès! (${questions.length} questions)`,
                type: 'success'
            });
            logger.success(`PPTX OMBEA généré: ${fileName} avec ${questions.length} questions`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
            setStatus({ message: `Erreur lors de la génération: ${errorMessage}`, type: 'error' });
            logger.error('Échec de la génération PPTX OMBEA', error);
        }
        finally {
            setIsGenerating(false);
        }
    };
    const canGenerate = templateFile && questions.length > 0 && !isGenerating;
    return (_jsx(Card, { title: "G\u00E9n\u00E9ration PPTX OMBEA", className: "mb-6", children: _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-blue-50 p-4 rounded-lg", children: [_jsx("h4", { className: "text-sm font-medium text-blue-900 mb-2", children: "Questionnaire s\u00E9lectionn\u00E9" }), _jsxs("div", { className: "text-sm text-blue-800", children: [_jsxs("p", { children: [_jsx("strong", { children: "Nom :" }), " ", questionnaireName] }), _jsxs("p", { children: [_jsx("strong", { children: "R\u00E9f\u00E9rentiel :" }), " ", referential] }), _jsxs("p", { children: [_jsx("strong", { children: "Questions disponibles :" }), " ", questions.length] }), _jsxs("p", { children: [_jsx("strong", { children: "Format :" }), " Questions Vrai/Faux pour bo\u00EEtiers OMBEA"] })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "1. Ajouter votre template PPTX" }), _jsxs("div", { className: "flex items-center space-x-4", children: [_jsx("div", { className: "flex-1", children: _jsx("input", { type: "file", accept: ".pptx", onChange: handleTemplateUpload, className: "block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" }) }), templateFile && (_jsxs("div", { className: "flex items-center text-green-600", children: [_jsx(CheckCircle, { size: 16, className: "mr-1" }), _jsx("span", { className: "text-sm", children: templateFile.name })] }))] }), _jsx("p", { className: "mt-1 text-xs text-gray-500", children: "S\u00E9lectionnez un fichier PowerPoint (.pptx) qui servira de base pour votre pr\u00E9sentation OMBEA" })] }), _jsx("div", { children: _jsx(Button, { variant: "primary", icon: isGenerating ? undefined : _jsx(Download, { size: 16 }), onClick: handleGeneratePPTX, disabled: !canGenerate, className: "w-full", children: isGenerating ? 'Génération en cours...' : 'Générer le PPTX interactif' }) }), status && (_jsxs("div", { className: `rounded-lg p-4 flex items-start ${status.type === 'success' ? 'bg-green-100 text-green-800' :
                        status.type === 'error' ? 'bg-red-100 text-red-800' :
                            'bg-blue-100 text-blue-800'}`, children: [status.type === 'success' ? (_jsx(CheckCircle, { className: "w-5 h-5 mr-3 flex-shrink-0" })) : status.type === 'error' ? (_jsx(AlertTriangle, { className: "w-5 h-5 mr-3 flex-shrink-0" })) : (_jsx(FileText, { className: "w-5 h-5 mr-3 flex-shrink-0" })), _jsx("p", { className: "text-sm", children: status.message })] })), _jsxs("div", { className: "bg-amber-50 p-4 rounded-lg", children: [_jsxs("h4", { className: "text-sm font-medium text-amber-900 mb-2", children: [_jsx(AlertTriangle, { size: 16, className: "inline mr-1" }), "Format des questions"] }), _jsxs("div", { className: "text-sm text-amber-800", children: [_jsxs("p", { className: "mb-2", children: [_jsx("strong", { children: "Important :" }), " Le syst\u00E8me g\u00E9n\u00E8re actuellement des questions au format Vrai/Faux uniquement."] }), _jsxs("ul", { className: "list-disc list-inside space-y-1", children: [_jsx("li", { children: "Les questions \u00E0 choix multiples sont converties en Vrai/Faux" }), _jsx("li", { children: "La premi\u00E8re option est consid\u00E9r\u00E9e comme \"Vrai\"" }), _jsx("li", { children: "Les autres options sont consid\u00E9r\u00E9es comme \"Faux\"" }), _jsx("li", { children: "Le temps limite de chaque question est respect\u00E9" }), _jsx("li", { children: "Les images associ\u00E9es aux questions sont prises en compte" })] })] })] }), _jsxs("div", { className: "bg-gray-50 p-4 rounded-lg", children: [_jsx("h4", { className: "text-sm font-medium text-gray-900 mb-2", children: "Instructions d'utilisation" }), _jsxs("ol", { className: "text-sm text-gray-700 list-decimal list-inside space-y-1", children: [_jsx("li", { children: "Chargez votre template PowerPoint (.pptx)" }), _jsx("li", { children: "V\u00E9rifiez que votre questionnaire contient des questions" }), _jsx("li", { children: "Cliquez sur \"G\u00E9n\u00E9rer le PPTX interactif\"" }), _jsx("li", { children: "Le fichier sera t\u00E9l\u00E9charg\u00E9 automatiquement" }), _jsx("li", { children: "Ouvrez le fichier dans PowerPoint avec les bo\u00EEtiers OMBEA connect\u00E9s" })] })] })] }) }));
};
export default PPTXGenerator;
