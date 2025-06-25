import React from 'react';
import { 
  LayoutDashboard, 
  ClipboardList, 
  Users, 
  FileSpreadsheet, 
  BarChart3, 
  Settings, 
  LogOut,
  HardHat,
  FileText,
  BookOpen
} from 'lucide-react';
import { useLogStore } from '../../stores/logStore';

type SidebarItemProps = {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
};

const SidebarItem: React.FC<SidebarItemProps> = ({ 
  icon, 
  label, 
  active = false, 
  onClick 
}) => {
  return (
    <li>
      <button
        onClick={onClick}
        className={`
          w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg
          transition-colors duration-150 ease-in-out
          ${active 
            ? 'bg-blue-100 text-blue-700' 
            : 'text-gray-700 hover:bg-gray-100'
          }
        `}
      >
        <span className="mr-3">{icon}</span>
        {label}
      </button>
    </li>
  );
};

type SidebarProps = {
  activePage: string;
  onPageChange: (page: string) => void;
};

const Sidebar: React.FC<SidebarProps> = ({ activePage, onPageChange }) => {
  const { openLogViewer } = useLogStore();

  const menuItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: <LayoutDashboard size={20} /> },
    { id: 'library', label: 'Bibliothèque', icon: <BookOpen size={20} /> },
    // { id: 'questionnaires', label: 'Questionnaires', icon: <ClipboardList size={20} /> }, // Supprimé
    { id: 'sessions', label: 'Sessions', icon: <Users size={20} /> },
    { id: 'exams', label: 'Mode examen', icon: <FileSpreadsheet size={20} /> },
    { id: 'reports', label: 'Rapports', icon: <BarChart3 size={20} /> },
  ];

  return (
    <div className="w-64 bg-white h-full shadow-sm border-r border-gray-200 flex flex-col">
      <div className="p-6">
        <div className="flex items-center">
          <HardHat size={32} className="text-blue-600 mr-2" />
          <h1 className="text-xl font-bold text-gray-900">CACES Manager</h1>
        </div>
      </div>
      
      <nav className="flex-1 px-4 pb-4">
        <ul className="space-y-1">
          {menuItems.map((item) => (
            <SidebarItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={activePage === item.id}
              onClick={() => onPageChange(item.id)}
            />
          ))}
        </ul>
      </nav>
      
      <div className="border-t border-gray-200 px-4 py-4">
        <ul className="space-y-1">
          <SidebarItem
            icon={<FileText size={20} />}
            label="Journal système"
            onClick={openLogViewer}
          />
          <SidebarItem
            icon={<Settings size={20} />}
            label="Paramètres"
            active={activePage === 'settings'}
            onClick={() => onPageChange('settings')}
          />
          <SidebarItem
            icon={<LogOut size={20} />}
            label="Déconnexion"
            onClick={() => console.log('Logout clicked')}
          />
        </ul>
      </div>
    </div>
  );
};

export default Sidebar;