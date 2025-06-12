import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Users, Calendar, CheckCircle, Clock } from 'lucide-react';
import Card from '../ui/Card';
const DashboardCards = () => {
    const cards = [
        {
            title: 'Sessions à venir',
            value: '5',
            icon: _jsx(Calendar, { size: 24, className: "text-blue-600" }),
            change: '+2 cette semaine'
        },
        {
            title: 'Participants',
            value: '42',
            icon: _jsx(Users, { size: 24, className: "text-green-600" }),
            change: '+15 ce mois'
        },
        {
            title: 'Taux de réussite',
            value: '78%',
            icon: _jsx(CheckCircle, { size: 24, className: "text-amber-500" }),
            change: '+5% vs. mois dernier'
        },
        {
            title: 'Certifications',
            value: '124',
            icon: _jsx(Clock, { size: 24, className: "text-purple-600" }),
            change: '30 en attente'
        },
    ];
    return (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6", children: cards.map((card, index) => (_jsx(Card, { className: "border border-gray-200", children: _jsxs("div", { className: "flex justify-between items-start", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-gray-500", children: card.title }), _jsx("p", { className: "mt-1 text-3xl font-semibold text-gray-900", children: card.value }), _jsx("p", { className: "mt-2 text-xs text-gray-500", children: card.change })] }), _jsx("div", { className: "p-2 rounded-lg bg-gray-50", children: card.icon })] }) }, index))) }));
};
export default DashboardCards;
