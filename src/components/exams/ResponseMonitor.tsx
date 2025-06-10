import React from 'react';
import Card from '../ui/Card';

type ResponseMonitorProps = {
  totalParticipants: number;
  responsesReceived: number;
  responseDistribution: Record<string, number>;
  isTestMode?: boolean;
};

const ResponseMonitor: React.FC<ResponseMonitorProps> = ({
  totalParticipants,
  responsesReceived,
  responseDistribution,
  isTestMode = false,
}) => {
  const responsePercentage = (responsesReceived / totalParticipants) * 100;
  
  const responseLetters = ['A', 'B', 'C', 'D'];
  
  return (
    <Card title={isTestMode ? "Suivi des réponses (Mode test)" : "Suivi des réponses"}>
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-700 mb-1">
          Taux de réponse
        </h3>
        <div className="flex items-center mb-2">
          <div className="flex-1 mr-4">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" 
                style={{ width: `${responsePercentage}%` }}
              ></div>
            </div>
          </div>
          <span className="text-sm font-medium text-gray-900">
            {responsesReceived}/{totalParticipants}
          </span>
        </div>
        <p className="text-xs text-gray-500">
          {responsePercentage.toFixed(0)}% des participants ont répondu
        </p>
      </div>
      
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">
          Distribution des réponses
        </h3>
        <div className="space-y-2">
          {responseLetters.map((letter) => {
            const count = responseDistribution[letter] || 0;
            const percentage = (count / totalParticipants) * 100;
            
            return (
              <div key={letter} className="flex items-center">
                <div className="flex-shrink-0 w-4 text-sm font-medium text-gray-700 mr-2">
                  {letter}
                </div>
                <div className="flex-1 mx-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-500" 
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
                <div className="flex-shrink-0 w-16 text-right text-xs text-gray-500">
                  {count} ({percentage.toFixed(0)}%)
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-2">
          État des boîtiers
        </h3>
        <div className="grid grid-cols-10 gap-1">
          {Array.from({ length: totalParticipants }).map((_, index) => {
            const hasResponded = index < responsesReceived;
            
            return (
              <div 
                key={index}
                className={`
                  w-6 h-6 rounded-md flex items-center justify-center text-xs font-medium
                  transition-colors duration-300
                  ${hasResponded ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}
                `}
              >
                {index + 1}
              </div>
            );
          })}
        </div>
        {isTestMode && (
          <p className="mt-4 text-xs text-amber-600">
            Mode test actif : Les réponses sont anonymes et ne seront pas enregistrées
          </p>
        )}
      </div>
    </Card>
  );
};

export default ResponseMonitor;