import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { CalendarClock, ChevronRight } from 'lucide-react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
const UpcomingSessions = ({ sessions }) => {
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
    return (_jsxs(Card, { title: "Sessions \u00E0 venir", className: "mb-6", children: [_jsx("div", { className: "divide-y divide-gray-200", children: sessions.map((session) => (_jsx("div", { className: "py-3 first:pt-0 last:pb-0", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-start space-x-3", children: [_jsx("div", { className: "p-2 rounded-lg bg-blue-50 text-blue-600", children: _jsx(CalendarClock, { size: 20 }) }), _jsxs("div", { children: [_jsx("p", { className: "font-medium text-gray-900", children: session.name }), _jsxs("div", { className: "flex items-center mt-1 space-x-2", children: [_jsx("span", { className: "text-sm text-gray-500", children: formatDate(session.date) }), _jsx("span", { className: "text-gray-300", children: "\u2022" }), _jsx("span", { className: "text-sm text-gray-500", children: session.referential }), _jsx("span", { className: "text-gray-300", children: "\u2022" }), _jsxs("span", { className: "text-sm text-gray-500", children: [session.participantsCount, " participants"] })] })] })] }), _jsxs("div", { className: "flex items-center space-x-3", children: [getStatusBadge(session.status), _jsx("button", { className: "text-gray-400 hover:text-gray-500", children: _jsx(ChevronRight, { size: 20 }) })] })] }) }, session.id))) }), _jsx("div", { className: "mt-4 pt-4 border-t border-gray-200", children: _jsx("button", { className: "text-sm font-medium text-blue-600 hover:text-blue-700", children: "Voir toutes les sessions" }) })] }));
};
export default UpcomingSessions;
