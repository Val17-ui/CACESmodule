import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useMemo } from 'react';
import { FileText, Edit, Trash2, Copy, Image, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Select from '../ui/Select';
import Input from '../ui/Input';
import { referentials, questionThemes } from '../../types';
import { getAllQuestions } from '../../db';
const QuestionLibrary = ({ onEditQuestion }) => {
    const [selectedReferential, setSelectedReferential] = useState('');
    const [selectedTheme, setSelectedTheme] = useState('');
    const [selectedEliminatory, setSelectedEliminatory] = useState('');
    const [searchText, setSearchText] = useState('');
    const [sortBy, setSortBy] = useState('recent');
    const [questions, setQuestions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        const fetchQuestions = async () => {
            setIsLoading(true);
            try {
                const fetchedQuestions = await getAllQuestions();
                setQuestions(fetchedQuestions);
                setError(null);
            }
            catch (err) {
                console.error("Error fetching questions: ", err);
                setError("Failed to load questions.");
                setQuestions([]); // Ensure questions is an empty array on error
            }
            finally {
                setIsLoading(false);
            }
        };
        fetchQuestions();
    }, []);
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
    const eliminatoryOptions = [
        { value: '', label: 'Toutes les questions' },
        { value: 'true', label: 'Éliminatoires uniquement' },
        { value: 'false', label: 'Non éliminatoires uniquement' }
    ];
    const sortOptions = [
        { value: 'recent', label: 'Plus récentes' },
        { value: 'usage', label: 'Plus utilisées' },
        { value: 'success-rate', label: 'Taux de réussite' },
        { value: 'failure-rate', label: 'Taux d\'échec' }
    ];
    const filteredQuestions = useMemo(() => {
        return questions.filter(question => {
            const matchesReferential = !selectedReferential || question.referential === selectedReferential;
            const matchesTheme = !selectedTheme || question.theme === selectedTheme;
            const matchesEliminatory = !selectedEliminatory ||
                (selectedEliminatory === 'true' && question.isEliminatory) ||
                (selectedEliminatory === 'false' && !question.isEliminatory);
            const matchesSearch = !searchText ||
                question.text.toLowerCase().includes(searchText.toLowerCase());
            return matchesReferential && matchesTheme && matchesEliminatory && matchesSearch;
        });
    }, [questions, selectedReferential, selectedTheme, selectedEliminatory, searchText]);
    const sortedQuestions = useMemo(() => {
        let sortableItems = [...filteredQuestions];
        sortableItems.sort((a, b) => {
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
        return sortableItems;
    }, [filteredQuestions, sortBy]);
    const formatDate = (dateString) => {
        if (!dateString)
            return 'N/A';
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(new Date(dateString));
    };
    const getSuccessRateIcon = (rate) => {
        if (rate == null)
            return null;
        if (rate >= 75)
            return _jsx(TrendingUp, { size: 16, className: "text-green-600" });
        if (rate <= 50)
            return _jsx(TrendingDown, { size: 16, className: "text-red-600" });
        return null;
    };
    if (isLoading) {
        return _jsx("div", { className: "container mx-auto p-4", children: "Loading..." });
    }
    if (error) {
        return _jsx("div", { className: "container mx-auto p-4 text-red-500", children: error });
    }
    return (_jsxs("div", { children: [_jsxs(Card, { title: "Filtres et recherche", className: "mb-6", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4", children: [_jsx(Select, { label: "Recommandation", options: referentialOptions, value: selectedReferential, onChange: (e) => setSelectedReferential(e.target.value) }), _jsx(Select, { label: "Th\u00E8me", options: themeOptions, value: selectedTheme, onChange: (e) => setSelectedTheme(e.target.value) }), _jsx(Select, { label: "Type", options: eliminatoryOptions, value: selectedEliminatory, onChange: (e) => setSelectedEliminatory(e.target.value) }), _jsx(Select, { label: "Trier par", options: sortOptions, value: sortBy, onChange: (e) => setSortBy(e.target.value) })] }), _jsx(Input, { label: "Recherche dans le texte", placeholder: "Rechercher une question...", value: searchText, onChange: (e) => setSearchText(e.target.value) })] }), _jsx(Card, { title: `Questions (${sortedQuestions.length})`, children: _jsx("div", { className: "overflow-hidden", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Question" }), _jsx("th", { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Recommandation" }), _jsx("th", { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Th\u00E8me" }), _jsx("th", { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Utilisation" }), _jsx("th", { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Taux de r\u00E9ussite" }), _jsx("th", { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Cr\u00E9\u00E9e le" }), _jsx("th", { scope: "col", className: "relative px-6 py-3", children: _jsx("span", { className: "sr-only", children: "Actions" }) })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: sortedQuestions.map((question) => (_jsxs("tr", { className: "hover:bg-gray-50", children: [_jsx("td", { className: "px-6 py-4", children: _jsxs("div", { className: "flex items-start", children: [_jsx("div", { className: "flex-shrink-0 p-2 rounded-lg bg-blue-50 text-blue-600 mr-3", children: _jsx(FileText, { size: 20 }) }), _jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "text-sm font-medium text-gray-900 mb-1", children: question.text.length > 80
                                                                    ? `${question.text.substring(0, 80)}...`
                                                                    : question.text }), _jsxs("div", { className: "flex items-center space-x-2", children: [question.isEliminatory && (_jsxs(Badge, { variant: "danger", children: [_jsx(AlertTriangle, { size: 12, className: "mr-1" }), "\u00C9liminatoire"] })), question.image instanceof Blob && (_jsxs(_Fragment, { children: [_jsxs(Badge, { variant: "default", children: [_jsx(Image, { size: 12, className: "mr-1" }), "Image"] }), _jsx("img", { src: URL.createObjectURL(question.image), alt: "Question image", style: { maxWidth: '50px', maxHeight: '50px', marginTop: '4px', borderRadius: '4px' } })] }))] })] })] }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx(Badge, { variant: "primary", children: question.referential }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", children: question.theme ? questionThemes[question.theme] : 'N/A' }), _jsxs("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", children: [question.usageCount || 0, " fois"] }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsxs("div", { className: "flex items-center", children: [_jsx("span", { className: "text-sm text-gray-900 mr-2", children: question.correctResponseRate != null ? `${question.correctResponseRate}%` : 'N/A' }), getSuccessRateIcon(question.correctResponseRate)] }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", children: formatDate(question.createdAt) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-right text-sm font-medium", children: _jsxs("div", { className: "flex justify-end space-x-2", children: [_jsx(Button, { variant: "ghost", size: "sm", icon: _jsx(Edit, { size: 16 }), onClick: () => question.id && onEditQuestion(question.id.toString()), children: "Modifier" }), _jsx(Button, { variant: "ghost", size: "sm", icon: _jsx(Copy, { size: 16 }), children: "Dupliquer" }), _jsx(Button, { variant: "ghost", size: "sm", icon: _jsx(Trash2, { size: 16 }), children: "Supprimer" })] }) })] }, question.id))) })] }) }) })] }));
};
export default QuestionLibrary;
