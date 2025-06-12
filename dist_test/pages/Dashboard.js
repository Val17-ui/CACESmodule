import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Layout from '../components/layout/Layout';
import DashboardCards from '../components/dashboard/DashboardCards';
import UpcomingSessions from '../components/dashboard/UpcomingSessions';
import QuickActions from '../components/dashboard/QuickActions';
import Button from '../components/ui/Button';
import { Plus } from 'lucide-react';
import { mockSessions } from '../data/mockData';
const Dashboard = ({ activePage, onPageChange }) => {
    const headerActions = (_jsx(Button, { variant: "primary", icon: _jsx(Plus, { size: 16 }), onClick: () => onPageChange('sessions'), children: "Nouvelle session" }));
    return (_jsxs(Layout, { title: "Tableau de bord", subtitle: "Vue d'ensemble des activit\u00E9s CACES", actions: headerActions, activePage: activePage, onPageChange: onPageChange, children: [_jsx(DashboardCards, {}), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-6", children: [_jsx("div", { className: "lg:col-span-2", children: _jsx(UpcomingSessions, { sessions: mockSessions }) }), _jsx("div", { children: _jsx(QuickActions, {}) })] })] }));
};
export default Dashboard;
