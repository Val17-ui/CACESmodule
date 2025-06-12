import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { LayoutDashboard, ClipboardList, Users, FileSpreadsheet, BarChart3, Settings, LogOut, HardHat, FileText, BookOpen } from 'lucide-react';
import { useLogStore } from '../../stores/logStore';
const SidebarItem = ({ icon, label, active = false, onClick }) => {
    return (_jsx("li", { children: _jsxs("button", { onClick: onClick, className: `
          w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg
          transition-colors duration-150 ease-in-out
          ${active
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-700 hover:bg-gray-100'}
        `, children: [_jsx("span", { className: "mr-3", children: icon }), label] }) }));
};
const Sidebar = ({ activePage, onPageChange }) => {
    const { openLogViewer } = useLogStore();
    const menuItems = [
        { id: 'dashboard', label: 'Tableau de bord', icon: _jsx(LayoutDashboard, { size: 20 }) },
        { id: 'library', label: 'Bibliothèque', icon: _jsx(BookOpen, { size: 20 }) },
        { id: 'questionnaires', label: 'Questionnaires', icon: _jsx(ClipboardList, { size: 20 }) },
        { id: 'sessions', label: 'Sessions', icon: _jsx(Users, { size: 20 }) },
        { id: 'exams', label: 'Mode examen', icon: _jsx(FileSpreadsheet, { size: 20 }) },
        { id: 'reports', label: 'Rapports', icon: _jsx(BarChart3, { size: 20 }) },
    ];
    return (_jsxs("div", { className: "w-64 bg-white h-full shadow-sm border-r border-gray-200 flex flex-col", children: [_jsx("div", { className: "p-6", children: _jsxs("div", { className: "flex items-center", children: [_jsx(HardHat, { size: 32, className: "text-blue-600 mr-2" }), _jsx("h1", { className: "text-xl font-bold text-gray-900", children: "CACES Manager" })] }) }), _jsx("nav", { className: "flex-1 px-4 pb-4", children: _jsx("ul", { className: "space-y-1", children: menuItems.map((item) => (_jsx(SidebarItem, { icon: item.icon, label: item.label, active: activePage === item.id, onClick: () => onPageChange(item.id) }, item.id))) }) }), _jsx("div", { className: "border-t border-gray-200 px-4 py-4", children: _jsxs("ul", { className: "space-y-1", children: [_jsx(SidebarItem, { icon: _jsx(FileText, { size: 20 }), label: "Journal syst\u00E8me", onClick: openLogViewer }), _jsx(SidebarItem, { icon: _jsx(Settings, { size: 20 }), label: "Param\u00E8tres", active: activePage === 'settings', onClick: () => onPageChange('settings') }), _jsx(SidebarItem, { icon: _jsx(LogOut, { size: 20 }), label: "D\u00E9connexion", onClick: () => console.log('Logout clicked') })] }) })] }));
};
export default Sidebar;
