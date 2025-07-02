import React, { useState } from 'react';
import Layout from '../components/layout/Layout';
import Card from '../components/ui/Card';
// Button from '../components/ui/Button'; // Supprimé car non utilisé
import { File, HardDrive, User, BookOpen, Database, Wrench } from 'lucide-react'; // SettingsIcon supprimé

// Import des nouveaux composants
import FileModelSettings from '../components/settings/FileModelSettings';
import HardwareSettings from '../components/settings/HardwareSettings';
import UserPreferences from '../components/settings/UserPreferences';
import QuestionLibrary from '../components/library/QuestionLibrary'; // Réutilisation comme demandé
import BackupRestore from '../components/settings/BackupRestore';
import TechnicalSettings from '../components/settings/TechnicalSettings';

type SettingsProps = {
  activePage: string;
  onPageChange: (page: string) => void;
};

type AdminTab = 'files' | 'hardware' | 'preferences' | 'library' | 'backup' | 'technical';

const Settings: React.FC<SettingsProps> = ({ activePage, onPageChange }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('files');

  const handleEditQuestion = (id: string) => {
    // TODO: Implement actual navigation or modal opening for question editing
    console.log("Edit question requested for ID:", id);
    // For now, we can switch to a specific tab or show a notification
    // Or, if you have a dedicated page/modal for editing, navigate/open it here
  };

  const tabs: { id: AdminTab; label: string; icon: JSX.Element }[] = [
    { id: 'files', label: 'Fichiers et Modèles', icon: <File size={20} /> },
    { id: 'hardware', label: 'Matériel', icon: <HardDrive size={20} /> },
    { id: 'preferences', label: 'Préférences', icon: <User size={20} /> },
    { id: 'library', label: 'Bibliothèque', icon: <BookOpen size={20} /> },
    { id: 'backup', label: 'Sauvegarde & Restauration', icon: <Database size={20} /> },
    { id: 'technical', label: 'Paramètres Techniques', icon: <Wrench size={20} /> },
  ];

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'files': return <FileModelSettings />;
      case 'hardware': return <HardwareSettings />;
      case 'preferences': return <UserPreferences />;
      case 'library': return <QuestionLibrary onEditQuestion={handleEditQuestion} />;
      case 'backup': return <BackupRestore />;
      case 'technical': return <TechnicalSettings />;
      default: return null;
    }
  };

  return (
    <Layout
      title="Administration"
      subtitle="Gestion globale de l'application"
      activePage={activePage}
      onPageChange={onPageChange}
    >
      <Card>
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
        
        <div className="mt-6">
          {renderActiveTab()}
        </div>
      </Card>
    </Layout>
  );
};

export default Settings;