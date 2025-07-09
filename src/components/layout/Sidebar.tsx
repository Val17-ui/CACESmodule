import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  BarChart3, 
  Settings, 
} from 'lucide-react';

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
            ? 'bg-accent-neutre/20 text-accent-neutre'
            : 'text-texte-principal hover:bg-gris-moyen/20'
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
  // const { openLogViewer } = useLogStore(); // Non utilisé ici

  const menuItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: <LayoutDashboard size={20} /> },
    
    // { id: 'questionnaires', label: 'Questionnaires', icon: <ClipboardList size={20} /> }, // Supprimé
    { id: 'sessions', label: 'Sessions', icon: <Users size={20} /> },
    // { id: 'exams', label: 'Mode examen', icon: <FileSpreadsheet size={20} /> }, // Supprimé
    { id: 'reports', label: 'Rapports', icon: <BarChart3 size={20} /> },
  ];

  return (
    <div className="w-64 bg-fond-clair-principal h-full shadow-sm border-r border-gris-moyen/50 flex flex-col">
      <div className="p-6">
        <div className="flex items-center">
          <img src="https://static.wixstatic.com/media/76e58b_2c597a8efc3e4dd6a3658edec55ec801~mv2.png" alt="easy'certif Logo" className="h-10" />
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
      
      <div className="border-t border-gris-moyen/50 px-4 py-4">
        <ul className="space-y-1">
          {/* Lien "Journal système" retiré d'ici */}
          <SidebarItem
            icon={<Settings size={20} />}
            label="Paramètres"
            active={activePage === 'settings'}
            onClick={() => onPageChange('settings')}
          />
          {/* <SidebarItem
            icon={<LogOut size={20} />}
            label="Déconnexion"
            onClick={() => console.log('Logout clicked')}
          /> */}
        </ul>
      </div>
    </div>
  );
};

export default Sidebar;