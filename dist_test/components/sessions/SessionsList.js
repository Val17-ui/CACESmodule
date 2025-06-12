import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { CalendarClock, UserCheck, Play, Download } from 'lucide-react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
const SessionsList = ({ sessions, onManageSession, onStartExam, }) => {
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(date);
    };
    const getStatusBadge = (status) => {
        switch (status) {
            case 'planned':
                return _jsx(Badge, { variant: "primary", children: "Planifi\u00E9e" });
            case 'in-progress':
                return _jsx(Badge, { variant: "warning", children: "En cours" });
            case 'completed':
                return _jsx(Badge, { variant: "success", children: "Termin\u00E9e" });
            case 'cancelled':
                return _jsx(Badge, { variant: "danger", children: "Annul\u00E9e" });
            default:
                return null;
        }
    };
    return (_jsx(Card, { title: "Sessions de formation", children: _jsx("div", { className: "overflow-hidden", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Session" }), _jsx("th", { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Date" }), _jsx("th", { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "R\u00E9f\u00E9rentiel" }), _jsx("th", { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Participants" }), _jsx("th", { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Statut" }), _jsx("th", { scope: "col", className: "relative px-6 py-3", children: _jsx("span", { className: "sr-only", children: "Actions" }) })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: sessions.map((session) => (_jsxs("tr", { className: "hover:bg-gray-50", children: [_jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsxs("div", { className: "flex items-center", children: [_jsx("div", { className: "flex-shrink-0 p-2 rounded-lg bg-blue-50 text-blue-600", children: _jsx(CalendarClock, { size: 20 }) }), _jsx("div", { className: "ml-4", children: _jsx("div", { className: "text-sm font-medium text-gray-900", children: session.name }) })] }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", children: formatDate(session.date) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx(Badge, { variant: "primary", children: session.referential }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", children: session.participantsCount }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: getStatusBadge(session.status) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-right text-sm font-medium", children: _jsxs("div", { className: "flex justify-end space-x-2", children: [_jsx(Button, { variant: "ghost", size: "sm", icon: _jsx(UserCheck, { size: 16 }), onClick: () => onManageSession(session.id), children: "Participants" }), (session.status === 'planned' || session.status === 'in-progress') && (_jsx(Button, { variant: "primary", size: "sm", icon: _jsx(Play, { size: 16 }), onClick: () => onStartExam(session.id), children: "D\u00E9marrer" })), session.status === 'completed' && (_jsx(Button, { variant: "outline", size: "sm", icon: _jsx(Download, { size: 16 }), children: "Rapport" }))] }) })] }, session.id))) })] }) }) }));
};
export default SessionsList;
