import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import { Save, FileUp, UserPlus, Trash2 } from 'lucide-react';
import { referentials } from '../../types';
const SessionForm = () => {
    const [participants, setParticipants] = useState([]);
    const referentialOptions = Object.entries(referentials).map(([value, label]) => ({
        value,
        label: `${value} - ${label}`,
    }));
    const handleAddParticipant = () => {
        const newParticipant = {
            id: Date.now().toString(),
            firstName: '',
            lastName: '',
            organization: '',
            identificationCode: '',
            deviceId: participants.length + 1,
            hasSigned: false
        };
        setParticipants([...participants, newParticipant]);
    };
    const handleRemoveParticipant = (id) => {
        const updatedParticipants = participants.filter(p => p.id !== id);
        // Reassign device IDs
        const reindexedParticipants = updatedParticipants.map((p, index) => ({
            ...p,
            deviceId: index + 1
        }));
        setParticipants(reindexedParticipants);
    };
    const handleParticipantChange = (id, field, value) => {
        setParticipants(participants.map(p => p.id === id ? { ...p, [field]: value } : p));
    };
    return (_jsxs("div", { children: [_jsxs(Card, { title: "Informations de la session", className: "mb-6", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsx(Input, { label: "Nom de la session", placeholder: "Ex: Formation CACES R489 - Groupe A", required: true }), _jsx(Input, { label: "Date de la session", type: "date", required: true })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6 mt-4", children: [_jsx(Select, { label: "R\u00E9f\u00E9rentiel CACES", options: referentialOptions, placeholder: "S\u00E9lectionner un r\u00E9f\u00E9rentiel", required: true }), _jsx(Select, { label: "Questionnaire associ\u00E9", options: [
                                    { value: '1', label: 'CACES R489 - Questionnaire standard' },
                                    { value: '2', label: 'CACES R486 - PEMP' },
                                ], placeholder: "S\u00E9lectionner un questionnaire", required: true })] }), _jsx("div", { className: "mt-4", children: _jsx(Input, { label: "Lieu de formation", placeholder: "Ex: Centre de formation Paris Nord", required: true }) }), _jsxs("div", { className: "mt-4", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Notes ou instructions sp\u00E9cifiques" }), _jsx("textarea", { rows: 3, className: "block w-full rounded-xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm", placeholder: "Informations compl\u00E9mentaires pour cette session..." })] })] }), _jsxs(Card, { title: "Participants", className: "mb-6", children: [_jsxs("div", { className: "mb-4 flex items-center justify-between", children: [_jsx("p", { className: "text-sm text-gray-500", children: "Ajoutez les participants \u00E0 cette session de certification. Le bo\u00EEtier est automatiquement attribu\u00E9 selon l'ordre de la liste." }), _jsxs("div", { className: "flex space-x-3", children: [_jsx(Button, { variant: "outline", icon: _jsx(FileUp, { size: 16 }), children: "Importer CSV" }), _jsx(Button, { variant: "outline", icon: _jsx(UserPlus, { size: 16 }), onClick: handleAddParticipant, children: "Ajouter participant" })] })] }), _jsx("div", { className: "border rounded-lg overflow-hidden", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Bo\u00EEtier" }), _jsx("th", { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Pr\u00E9nom" }), _jsx("th", { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Nom" }), _jsx("th", { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Organisation" }), _jsx("th", { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Code d'identification" }), _jsx("th", { scope: "col", className: "relative px-6 py-3", children: _jsx("span", { className: "sr-only", children: "Actions" }) })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: participants.length === 0 ? (_jsx("tr", { children: _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500\\", colSpan: 6, children: _jsx("div", { className: "text-center py-4 text-gray-500", children: "Aucun participant ajout\u00E9. Utilisez le bouton \"Ajouter participant\" pour commencer." }) }) })) : (participants.map((participant) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("div", { className: "flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-800 font-medium", children: participant.deviceId }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx(Input, { value: participant.firstName, onChange: (e) => handleParticipantChange(participant.id, 'firstName', e.target.value), placeholder: "Pr\u00E9nom", className: "mb-0" }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx(Input, { value: participant.lastName, onChange: (e) => handleParticipantChange(participant.id, 'lastName', e.target.value), placeholder: "Nom", className: "mb-0" }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx(Input, { value: participant.organization || '', onChange: (e) => handleParticipantChange(participant.id, 'organization', e.target.value), placeholder: "Organisation (optionnel)", className: "mb-0" }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx(Input, { value: participant.identificationCode || '', onChange: (e) => handleParticipantChange(participant.id, 'identificationCode', e.target.value), placeholder: "Code (optionnel)", className: "mb-0" }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-right text-sm font-medium", children: _jsx(Button, { variant: "ghost", size: "sm", icon: _jsx(Trash2, { size: 16 }), onClick: () => handleRemoveParticipant(participant.id) }) })] }, participant.id)))) })] }) }), participants.length > 0 && (_jsx("div", { className: "mt-4 p-3 bg-blue-50 rounded-lg", children: _jsxs("p", { className: "text-sm text-blue-800", children: [_jsx("strong", { children: "Attribution automatique des bo\u00EEtiers :" }), " Le premier participant de la liste utilisera le bo\u00EEtier 1, le second le bo\u00EEtier 2, etc."] }) }))] }), _jsxs("div", { className: "flex justify-between items-center", children: [_jsx(Button, { variant: "outline", children: "Annuler" }), _jsxs("div", { className: "space-x-3", children: [_jsx(Button, { variant: "outline", icon: _jsx(Save, { size: 16 }), children: "Enregistrer brouillon" }), _jsx(Button, { variant: "primary", icon: _jsx(Save, { size: 16 }), children: "Cr\u00E9er la session" })] })] })] }));
};
export default SessionForm;
