import React from 'react';
import { Users, Calendar, CheckCircle, Clock } from 'lucide-react';
import Card from '../ui/Card';

const DashboardCards: React.FC = () => {
  const cards = [
    { 
      title: 'Sessions à venir', 
      value: '5', 
      icon: <Calendar size={24} className="text-blue-600" />,
      change: '+2 cette semaine'
    },
    { 
      title: 'Participants', 
      value: '42', 
      icon: <Users size={24} className="text-green-600" />,
      change: '+15 ce mois'
    },
    { 
      title: 'Taux de réussite', 
      value: '78%', 
      icon: <CheckCircle size={24} className="text-amber-500" />,
      change: '+5% vs. mois dernier'
    },
    { 
      title: 'Certifications', 
      value: '124', 
      icon: <Clock size={24} className="text-purple-600" />,
      change: '30 en attente'
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
      {cards.map((card, index) => (
        <Card key={index} className="border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">{card.title}</p>
              <p className="mt-1 text-3xl font-semibold text-gray-900">{card.value}</p>
              <p className="mt-2 text-xs text-gray-500">{card.change}</p>
            </div>
            <div className="p-2 rounded-lg bg-gray-50">
              {card.icon}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default DashboardCards;