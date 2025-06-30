
import React from 'react';
import Card from '../ui/Card';
import { Users, CheckCircle, BarChart2, PieChart } from 'lucide-react';

const GlobalStats = () => {
  // Données factices pour l'instant
  const stats = {
    totalSessions: 42,
    avgSuccessRate: 81,
    totalParticipants: 312,
  };

  return (
    <div className="mb-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600 mr-4">
              <BarChart2 size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Sessions terminées</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalSessions}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-600 mr-4">
              <CheckCircle size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Taux de réussite moyen</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.avgSuccessRate}%</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-indigo-100 text-indigo-600 mr-4">
              <Users size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Participants évalués</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalParticipants}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-amber-100 text-amber-600 mr-4">
              <PieChart size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Référentiels</p>
              <p className="text-2xl font-semibold text-gray-900">4 Actifs</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default GlobalStats;
