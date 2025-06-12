import React, { useState, useEffect, useCallback } from 'react';
import { logger, LogEntry } from '../../utils/logger'; // Assurez-vous que ce chemin est correct

const AppLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>(logger.getLogs() || []);

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

  const getLogLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'INFO': return 'blue';
      case 'WARNING': return 'orange';
      case 'ERROR': return 'red';
      case 'SUCCESS': return 'green';
      default: return 'black';
    }
  };

  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, maxHeight: '200px', overflowY: 'auto', backgroundColor: '#f0f0f0', borderTop: '1px solid #ccc', padding: '10px', zIndex: 9999, textAlign: 'left' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
        <h4 style={{ margin: 0 }}>Application Logs</h4>
        <div>
          <button onClick={refreshLogs} style={{ marginRight: '5px' }}>Refresh Logs</button>
          <button onClick={clearLogs}>Clear Logs</button>
        </div>
      </div>
      <ul style={{ listStyleType: 'none', margin: 0, padding: 0, fontSize: '0.8em' }}>
        {logs.length === 0 && <li style={{ color: '#777' }}>No logs yet.</li>}
        {logs.map((log, index) => (
          <li key={index} style={{ marginBottom: '3px', borderBottom: '1px dotted #eee', paddingBottom: '3px' }}>
            <span style={{ color: getLogLevelColor(log.level), fontWeight: 'bold' }}>[{log.level}]</span>
            <span style={{ color: '#777', marginLeft: '5px', marginRight: '5px' }}>{log.timestamp}</span>
            <span>{log.message}</span>
            {log.details && typeof log.details === 'object' && log.details !== null && (
              <pre style={{ marginLeft: '10px', fontSize: '0.9em', backgroundColor: '#e0e0e0', padding: '2px' }}>
                {((): React.ReactNode => {
                  try {
                    return JSON.stringify(log.details, null, 2);
                  } catch (e) {
                    return 'Error: Unable to serialize details';
                  }
                })()}
              </pre>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AppLogViewer;