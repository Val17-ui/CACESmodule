import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { logger } from '../../utils/logger'; // Assurez-vous que ce chemin est correct
const AppLogViewer = () => {
    const [logs, setLogs] = useState(logger.getLogs() || []);
    const refreshLogs = useCallback(() => {
        setLogs([...logger.getLogs()]);
    }, []);
    const clearLogs = () => {
        logger.clearLogs();
        refreshLogs();
    };
    useEffect(() => {
        const intervalId = setInterval(refreshLogs, 2000);
        return () => clearInterval(intervalId);
    }, [refreshLogs]);
    const getLogLevelColor = (level) => {
        switch (level) {
            case 'INFO': return 'blue';
            case 'WARNING': return 'orange';
            case 'ERROR': return 'red';
            case 'SUCCESS': return 'green';
            default: return 'black';
        }
    };
    return (_jsxs("div", { style: { position: 'fixed', bottom: 0, left: 0, right: 0, maxHeight: '200px', overflowY: 'auto', backgroundColor: '#f0f0f0', borderTop: '1px solid #ccc', padding: '10px', zIndex: 9999, textAlign: 'left' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }, children: [_jsx("h4", { style: { margin: 0 }, children: "Application Logs" }), _jsxs("div", { children: [_jsx("button", { onClick: refreshLogs, style: { marginRight: '5px' }, children: "Refresh Logs" }), _jsx("button", { onClick: clearLogs, children: "Clear Logs" })] })] }), _jsxs("ul", { style: { listStyleType: 'none', margin: 0, padding: 0, fontSize: '0.8em' }, children: [logs.length === 0 && _jsx("li", { style: { color: '#777' }, children: "No logs yet." }), logs.map((log, index) => (_jsxs("li", { style: { marginBottom: '3px', borderBottom: '1px dotted #eee', paddingBottom: '3px' }, children: [_jsxs("span", { style: { color: getLogLevelColor(log.level), fontWeight: 'bold' }, children: ["[", log.level, "]"] }), _jsx("span", { style: { color: '#777', marginLeft: '5px', marginRight: '5px' }, children: log.timestamp }), _jsx("span", { children: log.message }), log.details && typeof log.details === 'object' && log.details !== null && (_jsx("pre", { style: { marginLeft: '10px', fontSize: '0.9em', backgroundColor: '#e0e0e0', padding: '2px' }, children: (() => {
                                    try {
                                        return JSON.stringify(log.details, null, 2);
                                    }
                                    catch (e) {
                                        return 'Error: Unable to serialize details';
                                    }
                                })() }))] }, index)))] })] }));
};
export default AppLogViewer;
