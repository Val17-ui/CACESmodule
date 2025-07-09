import React, { useEffect } from 'react';
import { useLogStore } from '../../stores/logStore';
import { LogEntry } from '../../utils/logger';
import Button from '../ui/Button'; // Assuming a Button component exists
import { RefreshCw, Trash2 } from 'lucide-react'; // Icons for buttons

const SystemLogViewer: React.FC = () => {
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

  const getLogLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'INFO': return 'text-blue-600';
      case 'WARNING': return 'text-yellow-600';
      case 'ERROR': return 'text-red-600';
      case 'SUCCESS': return 'text-green-600';
      default: return 'text-gray-800';
    }
  };

  return (
    <div className="p-4 bg-white shadow rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">Journal des événements système</h3>
        <div className="space-x-2">
          <Button variant="outline" onClick={handleRefreshLogs} icon={<RefreshCw size={16} />}>
            Rafraîchir
          </Button>
          <Button variant="danger" onClick={handleClearLogs} icon={<Trash2 size={16} />}> {/* Changed "destructive" to "danger" */}
            Effacer les logs
          </Button>
        </div>
      </div>
      <div className="max-h-96 overflow-y-auto border border-gray-200 rounded p-2 bg-gray-50">
        {logs.length === 0 ? (
          <p className="text-gray-500 text-center py-4">Aucun log disponible.</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {[...logs].reverse().map((log, index) => ( // Inverser l'ordre des logs ici
              <li key={index} className="py-2 px-1 text-sm">
                <span className={`font-semibold ${getLogLevelColor(log.level)}`}>[{log.level}]</span>
                <span className="text-gray-500 ml-2 mr-2">{log.timestamp}</span>
                <span>{log.message}</span>
                {log.details && typeof log.details === 'object' && log.details !== null && (
                  <pre className="ml-4 mt-1 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                    {String((() => { // Ensure the result is explicitly cast to string
                      try {
                        return JSON.stringify(log.details, null, 2);
                      } catch (_e) { // Parameter 'e' was unused
                        // Ensure the error message is also a string, though it already is.
                        return String('Error: Unable to serialize details');
                      }
                    })())}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default SystemLogViewer;
