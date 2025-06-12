import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Download, FileSpreadsheet } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Select from '../ui/Select';
import Badge from '../ui/Badge';
import { referentials, questionThemes } from '../../types';
import { mockQuestions } from '../../data/mockData';
const QuestionStatistics = () => {
    const [selectedReferential, setSelectedReferential] = useState('');
    const [selectedTheme, setSelectedTheme] = useState('');
    const [sortBy, setSortBy] = useState('usage');
    const referentialOptions = [
        { value: '', label: 'Toutes les recommandations' },
        ...Object.entries(referentials).map(([value, label]) => ({
            value,
            label: `${value} - ${label}`,
        }))
    ];
    const themeOptions = [
        { value: '', label: 'Tous les thèmes' },
        ...Object.entries(questionThemes).map(([value, label]) => ({
            value,
            label
        }))
    ];
    const sortOptions = [
        { value: 'usage', label: 'Plus utilisées' },
        { value: 'success-rate', label: 'Taux de réussite' },
        { value: 'failure-rate', label: 'Taux d\'échec' },
        { value: 'recent', label: 'Plus récentes' }
    ];
    const filteredQuestions = mockQuestions.filter(question => {
        const matchesReferential = !selectedReferential || question.referential === selectedReferential;
        const matchesTheme = !selectedTheme || question.theme === selectedTheme;
        return matchesReferential && matchesTheme;
    });
    const sortedQuestions = [...filteredQuestions].sort((a, b) => {
        switch (sortBy) {
            case 'usage':
                return (b.usageCount || 0) - (a.usageCount || 0);
            case 'success-rate':
                return (b.correctResponseRate || 0) - (a.correctResponseRate || 0);
            case 'failure-rate':
                return (a.correctResponseRate || 100) - (b.correctResponseRate || 100);
            case 'recent':
            default:
                return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
        }
    });
    const totalQuestions = filteredQuestions.length;
    const totalUsage = filteredQuestions.reduce((sum, q) => sum + (q.usageCount || 0), 0);
    const averageSuccessRate = filteredQuestions.reduce((sum, q) => sum + (q.correctResponseRate || 0), 0) / totalQuestions;
    const getSuccessRateColor = (rate) => {
        if (rate >= 75)
            return 'text-green-600';
        if (rate >= 50)
            return 'text-amber-600';
        return 'text-red-600';
    };
    const getSuccessRateIcon = (rate) => {
        if (rate >= 75)
            return _jsx(TrendingUp, { size: 16, className: "text-green-600" });
        if (rate <= 50)
            return _jsx(TrendingDown, { size: 16, className: "text-red-600" });
        return null;
    };
    return (_jsxs("div", { children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-6 mb-6", children: [_jsx(Card, { className: "border border-gray-200", children: _jsxs("div", { className: "flex justify-between items-start", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-gray-500", children: "Questions totales" }), _jsx("p", { className: "mt-1 text-3xl font-semibold text-gray-900", children: totalQuestions })] }), _jsx("div", { className: "p-2 rounded-lg bg-blue-50", children: _jsx(BarChart3, { size: 24, className: "text-blue-600" }) })] }) }), _jsx(Card, { className: "border border-gray-200", children: _jsxs("div", { className: "flex justify-between items-start", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-gray-500", children: "Utilisations totales" }), _jsx("p", { className: "mt-1 text-3xl font-semibold text-gray-900", children: totalUsage })] }), _jsx("div", { className: "p-2 rounded-lg bg-green-50", children: _jsx(TrendingUp, { size: 24, className: "text-green-600" }) })] }) }), _jsx(Card, { className: "border border-gray-200", children: _jsxs("div", { className: "flex justify-between items-start", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-gray-500", children: "Taux moyen de r\u00E9ussite" }), _jsxs("p", { className: "mt-1 text-3xl font-semibold text-gray-900", children: [averageSuccessRate.toFixed(0), "%"] })] }), _jsx("div", { className: "p-2 rounded-lg bg-amber-50", children: _jsx(BarChart3, { size: 24, className: "text-amber-600" }) })] }) }), _jsx(Card, { className: "border border-gray-200", children: _jsxs("div", { className: "flex justify-between items-start", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-gray-500", children: "Questions probl\u00E9matiques" }), _jsx("p", { className: "mt-1 text-3xl font-semibold text-gray-900", children: filteredQuestions.filter(q => (q.correctResponseRate || 0) < 50).length })] }), _jsx("div", { className: "p-2 rounded-lg bg-red-50", children: _jsx(TrendingDown, { size: 24, className: "text-red-600" }) })] }) })] }), _jsxs(Card, { title: "Filtres et export", className: "mb-6", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4 mb-4", children: [_jsx(Select, { label: "Recommandation", options: referentialOptions, value: selectedReferential, onChange: (e) => setSelectedReferential(e.target.value) }), _jsx(Select, { label: "Th\u00E8me", options: themeOptions, value: selectedTheme, onChange: (e) => setSelectedTheme(e.target.value) }), _jsx(Select, { label: "Trier par", options: sortOptions, value: sortBy, onChange: (e) => setSortBy(e.target.value) })] }), _jsxs("div", { className: "flex space-x-3", children: [_jsx(Button, { variant: "outline", icon: _jsx(Download, { size: 16 }), children: "Exporter PDF" }), _jsx(Button, { variant: "outline", icon: _jsx(FileSpreadsheet, { size: 16 }), children: "Exporter Excel" })] })] }), _jsx(Card, { title: `Statistiques détaillées (${sortedQuestions.length} questions)`, children: _jsx("div", { className: "overflow-hidden", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Question" }), _jsx("th", { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Recommandation" }), _jsx("th", { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Th\u00E8me" }), _jsx("th", { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Utilisations" }), _jsx("th", { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Taux de r\u00E9ussite" }), _jsx("th", { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Derni\u00E8re utilisation" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: sortedQuestions.map((question) => (_jsxs("tr", { className: "hover:bg-gray-50", children: [_jsxs("td", { className: "px-6 py-4", children: [_jsx("div", { className: "text-sm font-medium text-gray-900 mb-1", children: question.text.length > 60
                                                        ? `${question.text.substring(0, 60)}...`
                                                        : question.text }), question.isEliminatory && (_jsx(Badge, { variant: "danger", children: "\u00C9liminatoire" }))] }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx(Badge, { variant: "primary", children: question.referential }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", children: questionThemes[question.theme] }), _jsxs("td", { className: "px-6 py-4 whitespace-nowrap", children: [_jsxs("div", { className: "text-sm font-medium text-gray-900", children: [question.usageCount || 0, " fois"] }), _jsx("div", { className: "text-xs text-gray-500", children: "en 2025" })] }), _jsxs("td", { className: "px-6 py-4 whitespace-nowrap", children: [_jsxs("div", { className: "flex items-center", children: [_jsxs("span", { className: `text-sm font-medium mr-2 ${getSuccessRateColor(question.correctResponseRate || 0)}`, children: [question.correctResponseRate || 0, "%"] }), getSuccessRateIcon(question.correctResponseRate || 0)] }), _jsx("div", { className: "w-16 bg-gray-200 rounded-full h-1.5 mt-1", children: _jsx("div", { className: `h-1.5 rounded-full ${(question.correctResponseRate || 0) >= 75 ? 'bg-green-600' :
                                                            (question.correctResponseRate || 0) >= 50 ? 'bg-amber-500' : 'bg-red-600'}`, style: { width: `${question.correctResponseRate || 0}%` } }) })] }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", children: question.usageCount && question.usageCount > 0 ? '15/01/2025' : 'Jamais' })] }, question.id))) })] }) }) })] }));
};
export default QuestionStatistics;
