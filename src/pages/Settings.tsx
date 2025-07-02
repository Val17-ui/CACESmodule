import React, { useState, useEffect } from 'react'; // Consolidated import, added useEffect
import Layout from '../components/layout/Layout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button'; // Added missing import for Button
import { File, HardDrive, User, BookOpen, Database, Wrench, Plus } from 'lucide-react'; // SettingsIcon supprimé, Added Plus

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

// Removed duplicate import of React, useState, useEffect
// import React, { useState, useEffect } from 'react';
// // ... other imports
// import TechnicalSettings from '../components/settings/TechnicalSettings'; // This import is fine if not duplicated

const Settings: React.FC<SettingsProps> = ({ activePage, onPageChange }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('files');
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null); // For QuestionForm

  // Effect to reset editingQuestionId when activeTab changes to something other than 'library'
  useEffect(() => {
    if (activeTab !== 'library') {
      setEditingQuestionId(null);
    }
  }, [activeTab]);

  const handleEditQuestion = (id: string) => {
    setEditingQuestionId(id);
    // setActiveTab('library'); // Ensure the library tab is active to show the form
    // No, we want to show the form INSTEAD of the library list when editing.
    // The renderActiveTab logic for 'library' will handle showing form or list.
    console.log("Settings: Edit question requested for ID:", id);
  };

  const handleFormSaveOrCancel = () => {
    setEditingQuestionId(null);
    // Potentially refresh question list data if needed, though QuestionLibrary fetches on mount.
    // If QuestionLibrary is always mounted and hidden, it might not refetch.
    // For now, simply clearing ID will make QuestionLibrary reappear.
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
      case 'files':
        // setEditingQuestionId(null); // REMOVED - Handled by useEffect
        return <FileModelSettings />;
      case 'hardware':
        // setEditingQuestionId(null); // REMOVED
        return <HardwareSettings />;
      case 'preferences':
        // setEditingQuestionId(null); // REMOVED
        return <UserPreferences />;
      case 'library':
        if (editingQuestionId === 'new') { // Handle creation
          return <QuestionForm
                    questionId={null} // Pass null for creation
                    onSave={handleFormSaveOrCancel}
                    onCancel={handleFormSaveOrCancel}
                 />;
        } else if (editingQuestionId) { // Handle editing
          return <QuestionForm
                    questionId={Number(editingQuestionId)}
                    onSave={handleFormSaveOrCancel}
                    onCancel={handleFormSaveOrCancel}
                 />;
        }
        // Display QuestionLibrary list and "Add Question" button
        return (
          <>
            <div className="mb-4 flex justify-end">
              <Button onClick={() => setEditingQuestionId('new')} icon={<Plus size={16} />}>
                Ajouter une question
              </Button>
            </div>
            <QuestionLibrary onEditQuestion={handleEditQuestion} />
          </>
        );
      case 'backup':
        // setEditingQuestionId(null); // REMOVED
        return <BackupRestore />;
      case 'technical':
        // setEditingQuestionId(null); // REMOVED
        return <TechnicalSettings />;
      default:
        // setEditingQuestionId(null); // REMOVED
        return null;
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