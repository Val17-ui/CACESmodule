import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import Layout from '../components/layout/Layout';
import DeviceSettings from '../components/settings/DeviceSettings';
import GeneralSettings from '../components/settings/GeneralSettings';
import SystemLogViewer from '../components/settings/SystemLogViewer';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Settings as SettingsIcon, Usb, Save, ScrollText } from 'lucide-react';
const Settings = ({ activePage, onPageChange }) => {
    const [activeTab, setActiveTab] = useState('general');
    const tabs = [
        { id: 'general', label: 'Paramètres généraux', icon: _jsx(SettingsIcon, { size: 20 }) },
        { id: 'devices', label: 'Configuration des boîtiers', icon: _jsx(Usb, { size: 20 }) },
        { id: 'system_log', label: 'Journal Système', icon: _jsx(ScrollText, { size: 20 }) },
    ];
    const headerActions = (_jsx(Button, { variant: "primary", icon: _jsx(Save, { size: 16 }), children: "Enregistrer les modifications" }));
    return (_jsx(Layout, { title: "Param\u00E8tres", subtitle: "Configuration de l'application et des \u00E9quipements", actions: headerActions, activePage: activePage, onPageChange: onPageChange, children: _jsxs(Card, { className: "mb-6", children: [_jsx("div", { className: "border-b border-gray-200", children: _jsx("nav", { className: "-mb-px flex space-x-8", children: tabs.map((tab) => (_jsxs("button", { onClick: () => setActiveTab(tab.id), className: `
                  flex items-center py-4 px-1 border-b-2 font-medium text-sm
                  ${activeTab === tab.id
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                `, children: [_jsx("span", { className: "mr-2", children: tab.icon }), tab.label] }, tab.id))) }) }), _jsxs("div", { className: "mt-6", children: [activeTab === 'general' && _jsx(GeneralSettings, {}), activeTab === 'devices' && _jsx(DeviceSettings, {}), activeTab === 'system_log' && _jsx(SystemLogViewer, {})] })] }) }));
};
export default Settings;
