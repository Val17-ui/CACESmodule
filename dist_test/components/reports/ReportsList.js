import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Download, Eye, Printer, FileText } from 'lucide-react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
const ReportsList = ({ sessions, onViewReport }) => {
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(date);
    };
    // Only completed sessions can have reports
    const completedSessions = sessions.filter(s => s.status === 'completed');
    return (_jsx(Card, { title: "Rapports disponibles", children: _jsx("div", { className: "overflow-hidden", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Session" }), _jsx("th", { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Date" }), _jsx("th", { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "R\u00E9f\u00E9rentiel" }), _jsx("th", { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Participants" }), _jsx("th", { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Taux de r\u00E9ussite" }), _jsx("th", { scope: "col", className: "relative px-6 py-3", children: _jsx("span", { className: "sr-only", children: "Actions" }) })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: completedSessions.length === 0 ? (_jsx("tr", { children: _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", colSpan: 6, children: _jsx("div", { className: "text-center py-4 text-gray-500", children: "Aucun rapport disponible. Compl\u00E9tez une session pour g\u00E9n\u00E9rer des rapports." }) }) })) : (completedSessions.map((session) => (_jsxs("tr", { className: "hover:bg-gray-50", children: [_jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsxs("div", { className: "flex items-center", children: [_jsx("div", { className: "flex-shrink-0 p-2 rounded-lg bg-green-50 text-green-600", children: _jsx(FileText, { size: 20 }) }), _jsx("div", { className: "ml-4", children: _jsx("div", { className: "text-sm font-medium text-gray-900", children: session.name }) })] }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", children: formatDate(session.date) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx(Badge, { variant: "primary", children: session.referential }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", children: session.participantsCount }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", children: "78%" }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-right text-sm font-medium", children: _jsxs("div", { className: "flex justify-end space-x-2", children: [_jsx(Button, { variant: "ghost", size: "sm", icon: _jsx(Eye, { size: 16 }), onClick: () => onViewReport(session.id), children: "Voir" }), _jsx(Button, { variant: "ghost", size: "sm", icon: _jsx(Download, { size: 16 }), children: "PDF" }), _jsx(Button, { variant: "ghost", size: "sm", icon: _jsx(Printer, { size: 16 }), children: "Imprimer" })] }) })] }, session.id)))) })] }) }) }));
};
export default ReportsList;
