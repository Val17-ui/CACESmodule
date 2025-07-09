import React, { useState } from 'react';
import { Plus, Trash2, CheckCircle, XCircle } from 'lucide-react'; // Usb removed
// import Card from '../ui/Card'; // Card removed
import Button from '../ui/Button';
import Input from '../ui/Input';
import { DeviceMapping } from '../../types';

const DeviceSettings: React.FC = () => {
  const [maxDevices, setMaxDevices] = useState(20);
  const [deviceMappings, setDeviceMappings] = useState<DeviceMapping[]>([
    { deviceId: 1, hardwareId: 'OMBEA001', isActive: true },
    { deviceId: 2, hardwareId: 'OMBEA002', isActive: true },
    { deviceId: 3, hardwareId: 'OMBEA003', isActive: false },
  ]);

  const handleAddDevice = () => {
    const newDevice: DeviceMapping = {
      deviceId: deviceMappings.length + 1,
      hardwareId: '',
      isActive: false
    };
    setDeviceMappings([...deviceMappings, newDevice]);
  };

  const handleRemoveDevice = (deviceId: number) => {
    setDeviceMappings(deviceMappings.filter(d => d.deviceId !== deviceId));
  };

  const handleDeviceChange = (deviceId: number, field: keyof DeviceMapping, value: string | boolean) => {
    setDeviceMappings(deviceMappings.map(d => 
      d.deviceId === deviceId ? { ...d, [field]: value } : d
    ));
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Configuration générale</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label="Nombre maximum de boîtiers"
            type="number"
            value={maxDevices}
            onChange={(e) => setMaxDevices(parseInt(e.target.value) || 20)}
            min={1}
            max={50}
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Mapping des boîtiers</h3>
          <Button
            variant="outline"
            icon={<Plus size={16} />}
            onClick={handleAddDevice}
          >
            Ajouter un boîtier
          </Button>
        </div>
        
        <div className="bg-gray-50 p-4 rounded-lg mb-4">
          <p className="text-sm text-gray-700">
            <strong>Configuration des boîtiers OMBEA :</strong> Associez chaque numéro de boîtier (1, 2, 3...) 
            à son identifiant matériel unique. Cette configuration est fixe et change rarement.
          </p>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Numéro
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID Matériel
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {deviceMappings.map((device) => (
                <tr key={device.deviceId}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-800 font-medium mr-3">
                        {device.deviceId}
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        Boîtier {device.deviceId}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Input
                      value={device.hardwareId}
                      onChange={(e) => handleDeviceChange(device.deviceId, 'hardwareId', e.target.value)}
                      placeholder="Ex: OMBEA001"
                      className="mb-0"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={device.isActive}
                        onChange={(e) => handleDeviceChange(device.deviceId, 'isActive', e.target.checked)}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
                      />
                      <span className={`flex items-center text-sm ${device.isActive ? 'text-green-600' : 'text-gray-500'}`}>
                        {device.isActive ? (
                          <>
                            <CheckCircle size={16} className="mr-1" />
                            Actif
                          </>
                        ) : (
                          <>
                            <XCircle size={16} className="mr-1" />
                            Inactif
                          </>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Trash2 size={16} />}
                      onClick={() => handleRemoveDevice(device.deviceId)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded-lg">
        <h4 className="text-sm font-medium text-blue-900 mb-2">
          Instructions de configuration
        </h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Connectez les boîtiers OMBEA via USB</li>
          <li>• Notez l'ID matériel de chaque boîtier (visible sur l'étiquette)</li>
          <li>• Associez chaque ID à un numéro de boîtier (1, 2, 3...)</li>
          <li>• Activez uniquement les boîtiers que vous utilisez</li>
          <li>• Cette configuration est sauvegardée automatiquement</li>
        </ul>
      </div>
    </div>
  );
};

export default DeviceSettings;