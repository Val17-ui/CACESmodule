import React from 'react';
import { Users, Calendar, CheckCircle, Clock } from 'lucide-react';
import Card from '../ui/Card';
import { Session } from '../../types';

type DashboardCardsProps = {
  sessions: Session[];
};

const DashboardCards: React.FC<DashboardCardsProps> = ({ sessions }) => {
  // Débogage : inspecter les sessions reçues
  console.log('Sessions dans DashboardCards :', sessions);

  // Compter les sessions planifiées (planned ou ready)
  const plannedSessionsCount = sessions.filter(s => s.status === 'planned' || s.status === 'ready').length;

  // Compter les participants dans les sessions planned, ready ou in-progress
  const totalParticipantsInPlannedOrInProgress = sessions
    .filter(s => s.status === 'planned' || s.status === 'ready' || s.status === 'in-progress')
    .reduce((acc, session) => acc + (session.participants?.length || 0), 0);

  // TODO: Calculer le taux de réussite et les certifications à partir des données réelles si possible.
  // Pour l'instant, utilisons des placeholders.
  const successRate = 'N/A'; // Exemple: calculer à partir des sessionResults
  const certificationsCount = 'N/A'; // Exemple: nombre de participants avec reussite: true

  const cards = [
    { 
      title: 'Sessions planifiées',
      value: plannedSessionsCount.toString(),
      icon: <Calendar size={24} className="text-rouge-accent" />,
      change: '' // Pourrait être "X cette semaine" si on ajoute une logique de date
    },
    { 
      title: 'Participants (planifiés/en cours)',
      value: totalParticipantsInPlannedOrInProgress.toString(),
      icon: <Users size={24} className="text-rouge-accent" />,
      change: '' // Pourrait être "Y ce mois"
    },
    { 
      title: 'Taux de réussite global',
      value: successRate,
      icon: <CheckCircle size={24} className="text-rouge-accent" />,
      change: '' // Pourrait être "Z% vs. mois dernier"
    },
    { 
      title: 'Certifications émises',
      value: certificationsCount,
      icon: <Clock size={24} className="text-rouge-accent" />,
      change: '' // Pourrait être "W en attente"
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
      {cards.map((card, index) => (
        <Card key={index} className="border border-gris-moyen/50">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-texte-principal/80">{card.title}</p>
              <p className="mt-1 text-3xl font-semibold text-texte-principal">{card.value}</p>
              {card.change && <p className="mt-2 text-xs text-texte-principal/80">{card.change}</p>}
            </div>
            <div className="p-2 rounded-lg bg-gris-moyen/20">
              {card.icon}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default DashboardCards;