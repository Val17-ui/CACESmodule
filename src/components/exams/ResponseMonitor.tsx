import React from 'react';
import Card from '../ui/Card';
import { useOmbeaStore } from '../../stores/ombeaStore'; // Import the store
import { OmbeaDevice } from '../../stores/ombeaStore'; // Import the type for clarity

// Props are now mostly derived from the store, but can be overridden if needed for flexibility
type ResponseMonitorProps = {
  // totalParticipants?: number; // Now from store: Object.keys(devices).length
  // responsesReceived?: number; // Now from store: Object.keys(responses).length
  // responseDistribution?: Record<string, number>; // Now from store: responses, needs aggregation
  isTestMode?: boolean; // Can still be passed or read from store
};

const ResponseMonitor: React.FC<ResponseMonitorProps> = (props) => {
  // Get necessary state from OmbeaStore
  const {
    devices,
    responses,
    isTestMode: storeIsTestMode,
    isConnected: isOmbeaConnected, // To know if we should expect real devices
    activeResponseLinkId
  } = useOmbeaStore();

  const isTestMode = props.isTestMode !== undefined ? props.isTestMode : storeIsTestMode;

  // Calculate total participants from the devices list in the store
  // Only count devices that are marked as 'connected' if that information is reliable from API
  // For now, just count all devices returned by the API as potential participants.
  const totalParticipants = Object.keys(devices || {}).length;

  // Responses received for the current question poll
  const responsesReceived = Object.keys(responses || {}).length;

  // Aggregate responseDistribution from the raw responses for the current question
  const aggregateResponseDistribution = (): Record<string, number> => {
    if (!responses) return {};
    return Object.values(responses).reduce((acc, responseValue) => {
      acc[responseValue] = (acc[responseValue] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  };
  const responseDistribution = aggregateResponseDistribution();

  const responsePercentage = totalParticipants > 0 ? (responsesReceived / totalParticipants) * 100 : 0;
  
  // Determine possible response letters dynamically or use a fixed set
  // For now, using a fixed set; could be derived from question options in a more advanced version
  const responseLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']; // Max 8 for typical MCQ
  
  // Create a list of device IDs that have responded for the "État des boîtiers" display
  const respondedDeviceIds = new Set(Object.keys(responses || {}));

  return (
    <Card title={isTestMode ? "Suivi des Réponses (Mode Test)" : "Suivi des Réponses En Direct"}>
      <div className="p-4 space-y-4">
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-1">
            Taux de Participation (Question Actuelle)
          </h3>
          <div className="flex items-center mb-1">
            <div className="flex-1 mr-3">
              <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${responsePercentage}%` }}
                ></div>
              </div>
            </div>
            <span className="text-sm font-semibold text-gray-800">
              {responsesReceived} / {totalParticipants > 0 ? totalParticipants : '-'}
            </span>
          </div>
          {totalParticipants > 0 && (
            <p className="text-xs text-gray-500">
              {responsePercentage.toFixed(0)}% des boîtiers actifs ont répondu.
            </p>
          )}
           {!isOmbeaConnected && (
             <p className="text-xs text-yellow-600 mt-1">OMBEA déconnecté. Le suivi est inactif.</p>
           )}
           {isOmbeaConnected && totalParticipants === 0 && !isTestMode && (
             <p className="text-xs text-yellow-600 mt-1">Aucun boîtier OMBEA actif détecté.</p>
           )}
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Distribution des Réponses (Question Actuelle)
          </h3>
          <div className="space-y-1.5">
            {responseLetters.map((letter) => {
              const count = responseDistribution[letter] || 0;
              // Calculate percentage based on responses received for this question, not total participants
              const percentageOfReceived = responsesReceived > 0 ? (count / responsesReceived) * 100 : 0;

              if (count === 0 && responsesReceived === 0) return null; // Don't show empty options if no votes yet

              return (
                <div key={letter} className="flex items-center text-xs">
                  <div className="w-5 text-center font-medium text-gray-700 mr-2">{letter}</div>
                  <div className="flex-1 mx-1">
                    <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-600">
                      <div
                        className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${percentageOfReceived}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="w-16 text-right text-gray-600">
                    {count} ({percentageOfReceived.toFixed(0)}%)
                  </div>
                </div>
              );
            })}
            {responsesReceived === 0 && <p className="text-xs text-gray-400 text-center">Aucune réponse pour l'instant.</p>}
          </div>
        </div>

        {isOmbeaConnected && totalParticipants > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              État des Boîtiers Connectés ({totalParticipants})
            </h3>
            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-1.5">
              {Object.values(devices).map((device: OmbeaDevice) => {
                const hasRespondedThisPoll = respondedDeviceIds.has(device.id);
                return (
                  <div
                    key={device.id}
                    title={`Boîtier ID: ${device.id}${device.name ? ` (${device.name})` : ''}${hasRespondedThisPoll ? ` - Réponse: ${responses[device.id]}` : ''}`}
                    className={`
                      p-1 aspect-square rounded flex items-center justify-center text-xs font-medium border
                      transition-colors duration-200
                      ${hasRespondedThisPoll ? 'bg-green-500 text-white border-green-600' : 'bg-gray-100 text-gray-600 border-gray-300'}
                    `}
                  >
                    {/* Display device ID or a shorter name/number if available */}
                    {device.name ? device.name.split('-').pop() : device.id.slice(-2) }
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {isTestMode && (
          <p className="mt-3 text-xs text-purple-600 bg-purple-50 p-2 rounded-md border border-purple-200">
            Mode Test actif : Les réponses affichées sont simulées et ne correspondent pas à des boîtiers réels.
          </p>
        )}
      </div>
    </Card>
  );
};

export default ResponseMonitor;