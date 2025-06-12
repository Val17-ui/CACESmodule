import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { PlusCircle, FilePlus, FileSpreadsheet, Download } from 'lucide-react';
import Card from '../ui/Card';
const ActionItem = ({ icon, title, description, onClick, }) => {
    return (_jsxs("button", { onClick: onClick, className: "flex items-start p-4 rounded-lg hover:bg-gray-50 transition-colors w-full text-left", children: [_jsx("div", { className: "mr-4 p-2 rounded-lg bg-blue-50 text-blue-600", children: icon }), _jsxs("div", { children: [_jsx("h3", { className: "font-medium text-gray-900", children: title }), _jsx("p", { className: "mt-1 text-sm text-gray-500", children: description })] })] }));
};
const QuickActions = () => {
    const actions = [
        {
            icon: _jsx(PlusCircle, { size: 20 }),
            title: 'Nouvelle session',
            description: 'Planifier une nouvelle session CACES',
            onClick: () => console.log('New session clicked'),
        },
        {
            icon: _jsx(FilePlus, { size: 20 }),
            title: 'Créer questionnaire',
            description: 'Créer ou modifier un questionnaire',
            onClick: () => console.log('Create questionnaire clicked'),
        },
        {
            icon: _jsx(FileSpreadsheet, { size: 20 }),
            title: 'Démarrer examen',
            description: 'Lancer une session d\'examen',
            onClick: () => console.log('Start exam clicked'),
        },
        {
            icon: _jsx(Download, { size: 20 }),
            title: 'Exporter rapport',
            description: 'Générer un rapport d\'activité',
            onClick: () => console.log('Export report clicked'),
        },
    ];
    return (_jsx(Card, { title: "Actions rapides", className: "mb-6", children: _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-2", children: actions.map((action, index) => (_jsx(ActionItem, { icon: action.icon, title: action.title, description: action.description, onClick: action.onClick }, index))) }) }));
};
export default QuickActions;
