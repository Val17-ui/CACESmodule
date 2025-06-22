import React from 'react';
import Card from '../ui/Card';
import { useOmbeaStore } from '../../stores/ombeaStore';
import { OmbeaDevice } from '../../stores/ombeaStore';
import { CheckCircle, XCircle, HelpCircle } from 'lucide-react'; // For device status icons

type ResponseMonitorProps = {
  // Props are now mostly derived from the store
  isTestModeOverride?: boolean; // Optional override for test mode display
};

const ResponseMonitor: React.FC<ResponseMonitorProps> = ({ isTestModeOverride }) => {
  const {
    devices,
    responses,
    isTestMode: storeIsTestMode,
    isReadyForSession, // Used to determine if we should expect devices
    votingSession,
  } = useOmbeaStore();

  const isTestMode = isTestModeOverride !== undefined ? isTestModeOverride : storeIsTestMode;
  const examIsActive = votingSession.isActive;
  const pollIsActive = votingSession.isPollingActiveForQuestion;

  const connectedDevices = Object.values(devices || {}).filter(d => d.connected);
  const totalParticipants = connectedDevices.length;

  const responsesReceived = Object.keys(responses || {}).length;

  const aggregateResponseDistribution = (): Record<string, number> => {
    if (!responses) return {};
    return Object.values(responses).reduce((acc, responseValue) => {
      acc[responseValue] = (acc[responseValue] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  };
  const responseDistribution = aggregateResponseDistribution();

  const responsePercentage = totalParticipants > 0 ? (responsesReceived / totalParticipants) * 100 : 0;
  
  const responseLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  
  const respondedDeviceIdsInPoll = new Set(Object.keys(responses || {}));

  return (
    <Card title={isTestMode ? "Suivi des Réponses (Mode Test)" : "Suivi des Réponses En Direct"}>
      <div className="p-4 space-y-4">
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-1">
            Participation ({pollIsActive ? "Vote en cours" : (examIsActive ? "Prêt pour prochain vote" : "Examen non actif")})
          </h3>
          <div className="flex items-center mb-1">
            <div className="flex-1 mr-3">
              <div className={`w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700 ${!examIsActive && 'opacity-50'}`}>
                <div
                  className={`h-3 rounded-full transition-all duration-300 ease-out ${pollIsActive ? 'bg-blue-600 animate-pulse' : 'bg-blue-400'}`}
                  style={{ width: `${responsePercentage}%` }}
                ></div>
              </div>
            </div>
            <span className="text-sm font-semibold text-gray-800">
              {responsesReceived} / {totalParticipants > 0 ? totalParticipants : (isReadyForSession ? '0' : '-')}
            </span>
          </div>
          {isReadyForSession && totalParticipants > 0 && examIsActive && (
            <p className="text-xs text-gray-500">
              {responsePercentage.toFixed(0)}% des boîtiers connectés ont répondu à cette question.
            </p>
          )}
           {!isReadyForSession && !isTestMode && (
             <p className="text-xs text-yellow-600 mt-1">OMBEA non prêt ou aucun boîtier actif.</p>
           )}
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Distribution des Réponses (Question Actuelle)
          </h3>
          {(pollIsActive || responsesReceived > 0) ? (
            <div className="space-y-1.5">
              {responseLetters.map((letter) => {
                const count = responseDistribution[letter] || 0;
                const percentageOfReceived = responsesReceived > 0 ? (count / responsesReceived) * 100 : 0;

                if (count === 0 && !pollIsActive) return null;

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
              {responsesReceived === 0 && pollIsActive && <p className="text-xs text-gray-400 text-center">En attente de réponses...</p>}
            </div>
          ) : (
             <p className="text-xs text-gray-400 text-center">{!examIsActive ? "L'examen n'est pas actif." : "Aucun vote ouvert pour le moment."}</p>
          )}
        </div>

        {(isReadyForSession || isTestMode) && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              État des Boîtiers {isTestMode && !totalParticipants ? '(Simulés: 10)' : `(Connectés: ${totalParticipants})`}
            </h3>
            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-1.5">
              {(totalParticipants > 0 ? Object.values(devices) : (isTestMode ? Array.from({length:10}, (_,i)=>({id:`sim-${i+1}`, name:`Sim ${i+1}`, connected:true})) : [])).map((device: OmbeaDevice | {id:string, name:string, connected:boolean}) => {
                const hasRespondedThisPoll = respondedDeviceIdsInPoll.has(device.id);
                let statusIcon = <HelpCircle size={12} className="text-gray-400" />;
                let bgColor = 'bg-gray-100';
                let textColor = 'text-gray-600';
                let borderColor = 'border-gray-300';
                let title = `Boîtier ID: ${device.id}${device.name ? ` (${device.name})` : ''}`;

                if (device.connected) {
                    if (hasRespondedThisPoll) {
                        statusIcon = <CheckCircle size={12} className="text-white" />;
                        bgColor = 'bg-green-500';
                        textColor = 'text-white';
                        borderColor = 'border-green-600';
                        title += ` - Réponse: ${responses[device.id]}`;
                    } else if (pollIsActive) {
                        statusIcon = <HelpCircle size={12} className="text-blue-500" />; // Waiting for response
                        bgColor = 'bg-blue-50';
                        textColor = 'text-blue-700';
                        borderColor = 'border-blue-300';
                        title += ` - En attente`;
                    } else { // Connected but poll not active or hasn't responded
                        statusIcon = <CheckCircle size={12} className="text-green-500" />;
                        bgColor = 'bg-green-50';
                        textColor = 'text-green-700';
                        borderColor = 'border-green-300';
                        title += ` - Connecté`;
                    }
                } else { // Not connected
                    statusIcon = <XCircle size={12} className="text-red-500" />;
                    bgColor = 'bg-red-50';
                    textColor = 'text-red-700';
                    borderColor = 'border-red-300';
                    title += ` - Déconnecté`;
                }

                return (
                  <div
                    key={device.id}
                    title={title}
                    className={`p-1 aspect-square rounded flex flex-col items-center justify-center text-xs font-medium border ${bgColor} ${textColor} ${borderColor} transition-colors duration-200`}
                  >
                    <span className="block truncate text-center text-[10px] leading-tight"> {device.name ? device.name.replace("ResponseLink-", "RL-") : device.id.slice(-3)}</span>
                    {statusIcon}
                  </div>
                );
              })}
            </div>
             {totalParticipants === 0 && !isTestMode && isReadyForSession && <p className="text-xs text-center text-gray-500 mt-2">Aucun boîtier détecté.</p>}
          </div>
        )}

        {isTestMode && (
          <p className="mt-3 text-xs text-purple-600 bg-purple-50 p-2 rounded-md border border-purple-200">
            Mode Test actif : Les réponses et l'état des boîtiers sont simulés.
          </p>
        )}
      </div>
    </Card>
  );
};

export default ResponseMonitor;