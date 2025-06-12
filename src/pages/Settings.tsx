import React, { useState } from 'react';
import Layout from '../components/layout/Layout';
import DeviceSettings from '../components/settings/DeviceSettings';
import GeneralSettings from '../components/settings/GeneralSettings';
import SystemLogViewer from '../components/settings/SystemLogViewer';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Settings as SettingsIcon, Usb, Save, ScrollText } from 'lucide-react';

type SettingsProps = {
  activePage: string;
  onPageChange: (page: string) => void;
};

const Settings: React.FC<SettingsProps> = ({ activePage, onPageChange }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'devices' | 'system_log'>('general');

  const tabs = [
    { id: 'general', label: 'Paramètres généraux', icon: <SettingsIcon size={20} /> },
    { id: 'devices', label: 'Configuration des boîtiers', icon: <Usb size={20} /> },
    { id: 'system_log', label: 'Journal Système', icon: <ScrollText size={20} /> },
  ];

  const headerActions = (
    <Button variant="primary" icon={<Save size={16} />}>
      Enregistrer les modifications
    </Button>
  );

  return (
    <Layout
      title="Paramètres"
      subtitle="Configuration de l'application et des équipements"
      actions={headerActions}
      activePage={activePage}
      onPageChange={onPageChange}
    >
      <Card className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'general' | 'devices' | 'system_log')}
                className={`
                  flex items-center py-4 px-1 border-b-2 font-medium text-sm
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
          {activeTab === 'general' && <GeneralSettings />}
          {activeTab === 'devices' && <DeviceSettings />}
          {activeTab === 'system_log' && <SystemLogViewer />}
        </div>
      </Card>
    </Layout>
  );
};

export default Settings;