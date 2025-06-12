import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import Input from '../ui/Input';
import Select from '../ui/Select';
const GeneralSettings = () => {
    const [organizationName, setOrganizationName] = useState('');
    const [defaultLanguage, setDefaultLanguage] = useState('fr');
    const [autoSaveInterval, setAutoSaveInterval] = useState(5);
    const [logLevel, setLogLevel] = useState('INFO');
    const languageOptions = [
        { value: 'fr', label: 'Français' },
        { value: 'en', label: 'English' },
    ];
    const logLevelOptions = [
        { value: 'ERROR', label: 'Erreurs uniquement' },
        { value: 'WARNING', label: 'Avertissements et erreurs' },
        { value: 'INFO', label: 'Informations, avertissements et erreurs' },
        { value: 'SUCCESS', label: 'Tous les événements' },
    ];
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-lg font-medium text-gray-900 mb-4", children: "Informations de l'organisation" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsx(Input, { label: "Nom de l'organisation", value: organizationName, onChange: (e) => setOrganizationName(e.target.value), placeholder: "Ex: Centre de Formation CACES" }), _jsx(Select, { label: "Langue par d\u00E9faut", options: languageOptions, value: defaultLanguage, onChange: (e) => setDefaultLanguage(e.target.value) })] })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-lg font-medium text-gray-900 mb-4", children: "Pr\u00E9f\u00E9rences de l'application" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsx(Input, { label: "Intervalle de sauvegarde automatique (minutes)", type: "number", value: autoSaveInterval, onChange: (e) => setAutoSaveInterval(parseInt(e.target.value) || 5), min: 1, max: 60 }), _jsx(Select, { label: "Niveau de journalisation", options: logLevelOptions, value: logLevel, onChange: (e) => setLogLevel(e.target.value) })] })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-lg font-medium text-gray-900 mb-4", children: "Conformit\u00E9 CACES" }), _jsxs("div", { className: "bg-blue-50 p-4 rounded-lg", children: [_jsx("h4", { className: "text-sm font-medium text-blue-900 mb-2", children: "Exigences r\u00E9glementaires" }), _jsxs("ul", { className: "text-sm text-blue-800 space-y-1", children: [_jsx("li", { children: "\u2022 Conservation des rapports : 5 ans minimum" }), _jsx("li", { children: "\u2022 Tra\u00E7abilit\u00E9 compl\u00E8te des examens" }), _jsx("li", { children: "\u2022 Respect des recommandations Cnam" }), _jsx("li", { children: "\u2022 Archivage automatique des donn\u00E9es" })] })] })] })] }));
};
export default GeneralSettings;
