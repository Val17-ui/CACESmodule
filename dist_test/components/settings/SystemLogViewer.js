import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { useLogStore } from '../../stores/logStore';
import Button from '../ui/Button'; // Assuming a Button component exists
import { RefreshCw, Trash2 } from 'lucide-react'; // Icons for buttons
const SystemLogViewer = () => {
    const { logs, fetchLogs, clearLogs } = useLogStore();
    useEffect(() => {
        fetchLogs(); // Initial fetch of logs when component mounts
    }, [fetchLogs]);
    const handleRefreshLogs = () => {
        fetchLogs();
    };
    const handleClearLogs = () => {
        clearLogs();
        // fetchLogs(); // logStore.clearLogs() already clears and fetches
    };
    const getLogLevelColor = (level) => {
        switch (level) {
            case 'INFO': return 'text-blue-600';
            case 'WARNING': return 'text-yellow-600';
            case 'ERROR': return 'text-red-600';
            case 'SUCCESS': return 'text-green-600';
            default: return 'text-gray-800';
        }
    };
    return (_jsxs("div", { className: "p-4 bg-white shadow rounded-lg", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900", children: "Journal des \u00E9v\u00E9nements syst\u00E8me" }), _jsxs("div", { className: "space-x-2", children: [_jsx(Button, { variant: "outline", onClick: handleRefreshLogs, icon: _jsx(RefreshCw, { size: 16 }), children: "Rafra\u00EEchir" }), _jsx(Button, { variant: "destructive", onClick: handleClearLogs, icon: _jsx(Trash2, { size: 16 }), children: "Effacer les logs" })] })] }), _jsx("div", { className: "max-h-96 overflow-y-auto border border-gray-200 rounded p-2 bg-gray-50", children: logs.length === 0 ? (_jsx("p", { className: "text-gray-500 text-center py-4", children: "Aucun log disponible." })) : (_jsx("ul", { className: "divide-y divide-gray-200", children: logs.map((log, index) => (_jsxs("li", { className: "py-2 px-1 text-sm", children: [_jsxs("span", { className: `font-semibold ${getLogLevelColor(log.level)}`, children: ["[", log.level, "]"] }), _jsx("span", { className: "text-gray-500 ml-2 mr-2", children: log.timestamp }), _jsx("span", { children: log.message }), log.details && typeof log.details === 'object' && log.details !== null && (_jsx("pre", { className: "ml-4 mt-1 text-xs bg-gray-100 p-2 rounded overflow-x-auto", children: (() => {
                                    try {
                                        return JSON.stringify(log.details, null, 2);
                                    }
                                    catch (e) {
                                        return 'Error: Unable to serialize details';
                                    }
                                })() }))] }, index))) })) })] }));
};
export default SystemLogViewer;
