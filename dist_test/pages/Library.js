import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState } from 'react';
import Layout from '../components/layout/Layout';
import QuestionLibrary from '../components/library/QuestionLibrary';
import QuestionForm from '../components/library/QuestionForm';
import QuestionStatistics from '../components/library/QuestionStatistics';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card'; // Import Card for feedback display
import { Plus, FileUp, FileDown, BarChart3 } from 'lucide-react';
import { exportQuestionsToCsv, parseQuestionsCsv } from '../utils/csvProcessor';
import { mockQuestions } from '../data/mockData'; // Using mockQuestions as a placeholder for actual data
import { referentials, questionThemes } from '../types';
// Helper for ID generation
const generateQuestionId = () => {
    return `q_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 9)}`;
};
const Library = ({ activePage, onPageChange }) => {
    const [activeView, setActiveView] = useState('library');
    const [editingQuestionId, setEditingQuestionId] = useState(null);
    const [importFeedback, setImportFeedback] = useState([]);
    const fileInputRef = React.useRef(null);
    const handleCreateNew = () => {
        setActiveView('form');
        setEditingQuestionId(null);
    };
    const handleEditQuestion = (id) => {
        setActiveView('form');
        setEditingQuestionId(id);
    };
    const handleViewStatistics = () => {
        setActiveView('statistics');
    };
    const handleBackToLibrary = () => {
        setActiveView('library');
        setEditingQuestionId(null);
    };
    const handleExportCsv = () => {
        // TODO: Replace mockQuestions with actual questions from state/store when available
        const questionsToExport = mockQuestions;
        if (questionsToExport.length === 0) {
            // Optionally, inform the user that there's nothing to export
            console.log("No questions to export."); // Or use a logger/toast
            return;
        }
        const csvString = exportQuestionsToCsv(questionsToExport);
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) { // feature detection
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', 'questions_export.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
        else {
            // Handle cases where download attribute is not supported (e.g., older browsers)
            // This might involve opening the CSV in a new window or other fallbacks.
            // For now, a console log will suffice for this fallback.
            console.error("CSV download not supported by this browser.");
        }
    };
    const handleImportCsvClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.value = ""; // Reset file input
            fileInputRef.current.click();
        }
    };
    const handleFileSelected = async (event) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        setImportFeedback(["Traitement du fichier..."]);
        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target?.result;
            if (!text) {
                setImportFeedback(["Erreur: Impossible de lire le fichier."]);
                return;
            }
            const { data: rawQuestions, errors: parsingErrors, columnHeaders } = parseQuestionsCsv(text);
            if (parsingErrors.length > 0) {
                setImportFeedback([
                    "Erreurs lors du parsing CSV:",
                    ...parsingErrors,
                    `En-têtes détectés: ${columnHeaders.join(', ')}`
                ]);
                return;
            }
            if (rawQuestions.length === 0) {
                setImportFeedback(["Aucune donnée trouvée dans le fichier CSV."]);
                return;
            }
            processImportedQuestions(rawQuestions);
        };
        reader.onerror = () => {
            setImportFeedback([`Erreur de lecture du fichier: ${reader.error?.message || 'Unknown error'}`]);
        };
        reader.readAsText(file);
    };
    const processImportedQuestions = (rawQuestions) => {
        const newQuestions = [];
        const feedback = [`${rawQuestions.length} lignes trouvées dans le CSV.`];
        let importedCount = 0;
        rawQuestions.forEach((rawQ, index) => {
            const rowNum = index + 2; // CSV data starts from row 2 (after header)
            const errorsForRow = [];
            if (!rawQ.text)
                errorsForRow.push("Le champ 'text' est manquant.");
            if (!rawQ.referential)
                errorsForRow.push("Le champ 'referential' est manquant.");
            if (!rawQ.theme)
                errorsForRow.push("Le champ 'theme' est manquant.");
            if (!rawQ.optionA)
                errorsForRow.push("Le champ 'optionA' est manquant.");
            if (!rawQ.optionB)
                errorsForRow.push("Le champ 'optionB' est manquant.");
            if (!rawQ.correctAnswer)
                errorsForRow.push("Le champ 'correctAnswer' est manquant.");
            if (rawQ.isEliminatory === undefined || rawQ.isEliminatory === null || rawQ.isEliminatory.trim() === '') {
                errorsForRow.push("Le champ 'isEliminatory' est manquant.");
            }
            if (rawQ.referential && !Object.keys(referentials).includes(rawQ.referential)) {
                errorsForRow.push(`Referentiel '${rawQ.referential}' invalide.`);
            }
            if (rawQ.theme && !Object.keys(questionThemes).includes(rawQ.theme)) {
                errorsForRow.push(`Thème '${rawQ.theme}' invalide.`);
            }
            const options = [];
            if (rawQ.optionA)
                options.push(rawQ.optionA);
            if (rawQ.optionB)
                options.push(rawQ.optionB);
            if (rawQ.optionC)
                options.push(rawQ.optionC); // Will be undefined if not present, filtered later
            if (rawQ.optionD)
                options.push(rawQ.optionD); // Will be undefined if not present, filtered later
            const definedOptions = options.filter(opt => opt !== undefined && opt !== null).map(opt => opt.trim());
            if (definedOptions.length < 2)
                errorsForRow.push("Au moins 2 options (A et B) avec du contenu sont requises.");
            let correctAnswerIndex = -1;
            const caLetter = rawQ.correctAnswer?.trim().toUpperCase();
            if (caLetter === 'A')
                correctAnswerIndex = 0;
            else if (caLetter === 'B')
                correctAnswerIndex = 1;
            else if (caLetter === 'C')
                correctAnswerIndex = 2;
            else if (caLetter === 'D')
                correctAnswerIndex = 3;
            else
                errorsForRow.push(`Valeur de 'correctAnswer' (${rawQ.correctAnswer}) invalide. Doit être A, B, C, ou D.`);
            if (correctAnswerIndex !== -1 && correctAnswerIndex >= definedOptions.length) {
                errorsForRow.push(`'correctAnswer' (${caLetter}) pointe vers une option non définie ou vide.`);
            }
            let isEliminatoryBool = undefined;
            if (rawQ.isEliminatory !== undefined && rawQ.isEliminatory !== null) {
                const elimVal = rawQ.isEliminatory.trim().toUpperCase();
                if (elimVal === 'TRUE' || elimVal === '1')
                    isEliminatoryBool = true;
                else if (elimVal === 'FALSE' || elimVal === '0')
                    isEliminatoryBool = false;
                else
                    errorsForRow.push(`Valeur de 'isEliminatory' (${rawQ.isEliminatory}) invalide. Doit être TRUE, FALSE, 1, ou 0.`);
            }
            if (errorsForRow.length > 0) {
                feedback.push(`Ligne ${rowNum}: Erreurs - ${errorsForRow.join('; ')}`);
            }
            else {
                const questionTimeLimit = rawQ.timeLimit ? parseInt(rawQ.timeLimit, 10) : undefined;
                const newQuestion = {
                    id: generateQuestionId(),
                    text: rawQ.text,
                    referential: rawQ.referential,
                    theme: rawQ.theme,
                    options: definedOptions,
                    correctAnswer: correctAnswerIndex,
                    isEliminatory: isEliminatoryBool,
                    timeLimit: (questionTimeLimit !== undefined && !isNaN(questionTimeLimit)) ? questionTimeLimit : undefined,
                    image: rawQ.imageName || undefined,
                    type: rawQ.type || 'multiple-choice',
                };
                newQuestions.push(newQuestion);
                importedCount++;
            }
        });
        feedback.push(`${importedCount} questions importées avec succès.`);
        setImportFeedback(feedback);
        console.log("Questions importées (prêtes à être ajoutées) :", newQuestions);
        if (newQuestions.length > 0) {
            alert(`Simulating: ${newQuestions.length} questions would be added. Check console for details.`);
        }
    };
    const getHeaderActions = () => {
        switch (activeView) {
            case 'library':
                return (_jsxs("div", { className: "flex items-center space-x-3", children: [_jsx(Button, { variant: "outline", icon: _jsx(FileUp, { size: 16 }), onClick: handleImportCsvClick, children: "Importer CSV" }), _jsx(Button, { variant: "outline", icon: _jsx(FileDown, { size: 16 }), onClick: handleExportCsv, children: "Exporter CSV" }), _jsx(Button, { variant: "outline", icon: _jsx(BarChart3, { size: 16 }), onClick: handleViewStatistics, children: "Statistiques" }), _jsx(Button, { variant: "primary", icon: _jsx(Plus, { size: 16 }), onClick: handleCreateNew, children: "Nouvelle question" })] }));
            case 'form':
            case 'statistics':
                return (_jsx(Button, { variant: "outline", onClick: handleBackToLibrary, children: "Retour \u00E0 la biblioth\u00E8que" }));
            default:
                return null;
        }
    };
    const getTitle = () => {
        switch (activeView) {
            case 'form':
                return editingQuestionId ? 'Modifier une question' : 'Créer une question';
            case 'statistics':
                return 'Statistiques des questions';
            default:
                return 'Bibliothèque de questions';
        }
    };
    const getSubtitle = () => {
        switch (activeView) {
            case 'form':
                return editingQuestionId
                    ? 'Modifiez les paramètres et le contenu de la question'
                    : 'Créez une nouvelle question pour la bibliothèque CACES';
            case 'statistics':
                return 'Analysez l\'utilisation et les performances des questions';
            default:
                return 'Gérez votre bibliothèque de questions CACES par recommandation';
        }
    };
    const renderContent = () => {
        switch (activeView) {
            case 'form':
                return _jsx(QuestionForm, { questionId: editingQuestionId, onSave: handleBackToLibrary });
            case 'statistics':
                return _jsx(QuestionStatistics, {});
            default:
                return _jsx(QuestionLibrary, { onEditQuestion: handleEditQuestion });
        }
    };
    return (_jsxs(Layout, { title: getTitle(), subtitle: getSubtitle(), actions: getHeaderActions(), activePage: activePage, onPageChange: onPageChange, children: [_jsx("input", { type: "file", ref: fileInputRef, onChange: handleFileSelected, accept: ".csv", style: { display: 'none' } }), importFeedback.length > 0 && (_jsx(Card, { title: "R\u00E9sultat de l'importation CSV", className: "mb-4", children: _jsx("div", { className: "p-4 space-y-1 text-sm max-h-40 overflow-y-auto", children: importFeedback.map((msg, idx) => (_jsx("p", { className: msg.toLowerCase().includes("erreur") || msg.toLowerCase().includes("errors") ? "text-red-600" : "", children: msg }, idx))) }) })), renderContent()] }));
};
export default Library;
