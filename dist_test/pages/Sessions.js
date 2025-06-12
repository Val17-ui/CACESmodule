import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import Layout from '../components/layout/Layout';
import SessionsList from '../components/sessions/SessionsList';
import SessionForm from '../components/sessions/SessionForm';
import Button from '../components/ui/Button';
import { Plus } from 'lucide-react';
import { mockSessions } from '../data/mockData';
const Sessions = ({ activePage, onPageChange }) => {
    const [isCreating, setIsCreating] = useState(false);
    const [managingSessionId, setManagingSessionId] = useState(null);
    const handleCreateNew = () => {
        setIsCreating(true);
        setManagingSessionId(null);
    };
    const handleManageSession = (id) => {
        setManagingSessionId(id);
        setIsCreating(false);
    };
    const handleStartExam = (id) => {
        // Navigate to exam mode with this session
        onPageChange('exams');
    };
    const handleBackToList = () => {
        setIsCreating(false);
        setManagingSessionId(null);
    };
    const headerActions = (_jsxs("div", { className: "flex items-center space-x-3", children: [!isCreating && !managingSessionId && (_jsx(Button, { variant: "primary", icon: _jsx(Plus, { size: 16 }), onClick: handleCreateNew, children: "Nouvelle session" })), (isCreating || managingSessionId) && (_jsx(Button, { variant: "outline", onClick: handleBackToList, children: "Retour \u00E0 la liste" }))] }));
    const title = isCreating
        ? "Créer une session"
        : managingSessionId
            ? "Gestion des participants"
            : "Sessions";
    const subtitle = isCreating
        ? "Créez une nouvelle session de certification CACES"
        : managingSessionId
            ? "Gérez les participants et l'émargement"
            : "Gérez vos sessions de certification CACES";
    return (_jsx(Layout, { title: title, subtitle: subtitle, actions: headerActions, activePage: activePage, onPageChange: onPageChange, children: !isCreating && !managingSessionId ? (_jsx(SessionsList, { sessions: mockSessions, onManageSession: handleManageSession, onStartExam: handleStartExam })) : (_jsx(SessionForm, {})) }));
};
export default Sessions;
