import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import Layout from '../components/layout/Layout';
import ReportsList from '../components/reports/ReportsList';
import ReportDetails from '../components/reports/ReportDetails';
import Button from '../components/ui/Button';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import { mockSessions, mockParticipants } from '../data/mockData';
const Reports = ({ activePage, onPageChange }) => {
    const [selectedReportId, setSelectedReportId] = useState(null);
    const handleViewReport = (id) => {
        setSelectedReportId(id);
    };
    const handleBackToList = () => {
        setSelectedReportId(null);
    };
    const selectedSession = selectedReportId
        ? mockSessions.find((s) => s.id === selectedReportId)
        : null;
    const headerActions = (_jsx("div", { className: "flex items-center space-x-3", children: selectedReportId && (_jsxs(_Fragment, { children: [_jsx(Button, { variant: "outline", icon: _jsx(ArrowLeft, { size: 16 }), onClick: handleBackToList, children: "Retour \u00E0 la liste" }), _jsx(Button, { variant: "outline", icon: _jsx(Download, { size: 16 }), children: "Exporter PDF" }), _jsx(Button, { variant: "outline", icon: _jsx(Printer, { size: 16 }), children: "Imprimer" })] })) }));
    const title = selectedReportId
        ? `Rapport de session: ${selectedSession?.name}`
        : "Rapports";
    const subtitle = selectedReportId
        ? `Résultats détaillés et analyses pour la session du ${new Date(selectedSession?.date || '').toLocaleDateString('fr-FR')}`
        : "Consultez et générez les rapports de certification";
    return (_jsx(Layout, { title: title, subtitle: subtitle, actions: headerActions, activePage: activePage, onPageChange: onPageChange, children: !selectedReportId ? (_jsx(ReportsList, { sessions: mockSessions, onViewReport: handleViewReport })) : (selectedSession && (_jsx(ReportDetails, { session: selectedSession, participants: mockParticipants }))) }));
};
export default Reports;
