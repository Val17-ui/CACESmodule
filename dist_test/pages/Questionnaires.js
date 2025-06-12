import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import Layout from '../components/layout/Layout';
import QuestionnairesList from '../components/questionnaires/QuestionnairesList';
import QuestionnaireForm from '../components/questionnaires/QuestionnaireForm';
import Button from '../components/ui/Button';
import { Plus, FileUp, FileDown } from 'lucide-react';
import { mockQuestionnaires } from '../data/mockData';
const Questionnaires = ({ activePage, onPageChange, }) => {
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const handleCreateNew = () => {
        setIsCreating(true);
        setEditingId(null);
    };
    const handleEditQuestionnaire = (id) => {
        setIsCreating(false);
        setEditingId(id);
    };
    const handleBackToList = () => {
        setIsCreating(false);
        setEditingId(null);
    };
    const headerActions = (_jsxs("div", { className: "flex items-center space-x-3", children: [!isCreating && !editingId && (_jsxs(_Fragment, { children: [_jsx(Button, { variant: "outline", icon: _jsx(FileUp, { size: 16 }), children: "Importer" }), _jsx(Button, { variant: "outline", icon: _jsx(FileDown, { size: 16 }), children: "Exporter" }), _jsx(Button, { variant: "primary", icon: _jsx(Plus, { size: 16 }), onClick: handleCreateNew, children: "Nouveau questionnaire" })] })), (isCreating || editingId) && (_jsx(Button, { variant: "outline", onClick: handleBackToList, children: "Retour \u00E0 la liste" }))] }));
    const title = isCreating
        ? "Créer un questionnaire"
        : editingId
            ? "Modifier un questionnaire"
            : "Questionnaires";
    const subtitle = isCreating
        ? "Créez un nouveau questionnaire CACES"
        : editingId
            ? "Modifier les paramètres et questions"
            : "Gérez vos questionnaires d'examen CACES";
    return (_jsx(Layout, { title: title, subtitle: subtitle, actions: headerActions, activePage: activePage, onPageChange: onPageChange, children: !isCreating && !editingId ? (_jsx(QuestionnairesList, { questionnaires: mockQuestionnaires, onEditQuestionnaire: handleEditQuestionnaire })) : (_jsx(QuestionnaireForm, {})) }));
};
export default Questionnaires;
