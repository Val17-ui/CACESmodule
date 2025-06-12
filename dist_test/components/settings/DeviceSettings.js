import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Plus, Trash2, CheckCircle, XCircle } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
const DeviceSettings = () => {
    const [maxDevices, setMaxDevices] = useState(20);
    const [deviceMappings, setDeviceMappings] = useState([
        { deviceId: 1, hardwareId: 'OMBEA001', isActive: true },
        { deviceId: 2, hardwareId: 'OMBEA002', isActive: true },
        { deviceId: 3, hardwareId: 'OMBEA003', isActive: false },
    ]);
    const handleAddDevice = () => {
        const newDevice = {
            deviceId: deviceMappings.length + 1,
            hardwareId: '',
            isActive: false
        };
        setDeviceMappings([...deviceMappings, newDevice]);
    };
    const handleRemoveDevice = (deviceId) => {
        setDeviceMappings(deviceMappings.filter(d => d.deviceId !== deviceId));
    };
    const handleDeviceChange = (deviceId, field, value) => {
        setDeviceMappings(deviceMappings.map(d => d.deviceId === deviceId ? { ...d, [field]: value } : d));
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-lg font-medium text-gray-900 mb-4", children: "Configuration g\u00E9n\u00E9rale" }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: _jsx(Input, { label: "Nombre maximum de bo\u00EEtiers", type: "number", value: maxDevices, onChange: (e) => setMaxDevices(parseInt(e.target.value) || 20), min: 1, max: 50 }) })] }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900", children: "Mapping des bo\u00EEtiers" }), _jsx(Button, { variant: "outline", icon: _jsx(Plus, { size: 16 }), onClick: handleAddDevice, children: "Ajouter un bo\u00EEtier" })] }), _jsx("div", { className: "bg-gray-50 p-4 rounded-lg mb-4", children: _jsxs("p", { className: "text-sm text-gray-700", children: [_jsx("strong", { children: "Configuration des bo\u00EEtiers OMBEA :" }), " Associez chaque num\u00E9ro de bo\u00EEtier (1, 2, 3...) \u00E0 son identifiant mat\u00E9riel unique. Cette configuration est fixe et change rarement."] }) }), _jsx("div", { className: "border rounded-lg overflow-hidden", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Num\u00E9ro" }), _jsx("th", { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "ID Mat\u00E9riel" }), _jsx("th", { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Statut" }), _jsx("th", { scope: "col", className: "relative px-6 py-3", children: _jsx("span", { className: "sr-only", children: "Actions" }) })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: deviceMappings.map((device) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsxs("div", { className: "flex items-center", children: [_jsx("div", { className: "flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-800 font-medium mr-3", children: device.deviceId }), _jsxs("span", { className: "text-sm font-medium text-gray-900", children: ["Bo\u00EEtier ", device.deviceId] })] }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx(Input, { value: device.hardwareId, onChange: (e) => handleDeviceChange(device.deviceId, 'hardwareId', e.target.value), placeholder: "Ex: OMBEA001", className: "mb-0" }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsxs("div", { className: "flex items-center", children: [_jsx("input", { type: "checkbox", checked: device.isActive, onChange: (e) => handleDeviceChange(device.deviceId, 'isActive', e.target.checked), className: "h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2" }), _jsx("span", { className: `flex items-center text-sm ${device.isActive ? 'text-green-600' : 'text-gray-500'}`, children: device.isActive ? (_jsxs(_Fragment, { children: [_jsx(CheckCircle, { size: 16, className: "mr-1" }), "Actif"] })) : (_jsxs(_Fragment, { children: [_jsx(XCircle, { size: 16, className: "mr-1" }), "Inactif"] })) })] }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-right text-sm font-medium", children: _jsx(Button, { variant: "ghost", size: "sm", icon: _jsx(Trash2, { size: 16 }), onClick: () => handleRemoveDevice(device.deviceId) }) })] }, device.deviceId))) })] }) })] }), _jsxs("div", { className: "bg-blue-50 p-4 rounded-lg", children: [_jsx("h4", { className: "text-sm font-medium text-blue-900 mb-2", children: "Instructions de configuration" }), _jsxs("ul", { className: "text-sm text-blue-800 space-y-1", children: [_jsx("li", { children: "\u2022 Connectez les bo\u00EEtiers OMBEA via USB" }), _jsx("li", { children: "\u2022 Notez l'ID mat\u00E9riel de chaque bo\u00EEtier (visible sur l'\u00E9tiquette)" }), _jsx("li", { children: "\u2022 Associez chaque ID \u00E0 un num\u00E9ro de bo\u00EEtier (1, 2, 3...)" }), _jsx("li", { children: "\u2022 Activez uniquement les bo\u00EEtiers que vous utilisez" }), _jsx("li", { children: "\u2022 Cette configuration est sauvegard\u00E9e automatiquement" })] })] })] }));
};
export default DeviceSettings;
