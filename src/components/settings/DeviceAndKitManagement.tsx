import React, { useState } from 'react';
import HardwareSettings from './HardwareSettings';
import KitSettings from './KitSettings';
import Button from '../ui/Button'; // Assurez-vous que le chemin est correct

type ActiveView = 'devices' | 'kits';

const DeviceAndKitManagement: React.FC = () => {
  const [activeView, setActiveView] = useState<ActiveView>('devices');

  return (
    <div className="space-y-6">
      <div className="flex space-x-2 border-b border-gray-200 pb-2 mb-4">
        <Button
          variant={activeView === 'devices' ? 'primary' : 'outline'}
          onClick={() => setActiveView('devices')}
          size="sm"
        >
          Gestion des Boîtiers
        </Button>
        <Button
          variant={activeView === 'kits' ? 'primary' : 'outline'}
          onClick={() => setActiveView('kits')}
          size="sm"
        >
          Gestion des Kits
        </Button>
      </div>

      <div>
        {activeView === 'devices' && <HardwareSettings />}
        {activeView === 'kits' && <KitSettings />}
      </div>
    </div>
  );
};

export default DeviceAndKitManagement;
