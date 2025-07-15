import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import { Users, CheckCircle, BarChart2, PieChart } from 'lucide-react';
import { Session } from '../../types';
import { calculateSessionStats } from '../../utils/reportCalculators';
import { getResultsForSession, getQuestionsForSessionBlocks } from '../../db';

type GlobalStatsProps = {
  sessions: Session[];
};

const GlobalStats: React.FC<GlobalStatsProps> = ({ sessions }) => {
  const [avgSuccessRate, setAvgSuccessRate] = useState(0);

  const completedSessions = sessions.filter(s => s.status === 'completed');

  useEffect(() => {
    const calculateOverallStats = async () => {
      let totalSuccessRates = 0;
      let sessionsCounted = 0;

      for (const session of completedSessions) {
        if (session.id && session.selectedBlocIds) { // Vérifier aussi selectedBlocIds pour pertinence
          const results = await getResultsForSession(session.id);
          const questions = await getQuestionsForSessionBlocks(session.selectedBlocIds); // Pas besoin de || [] si on vérifie avant
          if (questions.length > 0) { // S'assurer qu'il y a des questions pour calculer les stats
            const stats = calculateSessionStats(session, results, questions);
            totalSuccessRates += stats.successRate;
            sessionsCounted++;
          }
        }
      }

      if (sessionsCounted > 0) {
        setAvgSuccessRate(totalSuccessRates / sessionsCounted);
      } else {
        setAvgSuccessRate(0);
      }
    };

    if (completedSessions.length > 0) {
      calculateOverallStats();
    } else {
      setAvgSuccessRate(0);
    }
  }, [completedSessions]);

  const totalSessions = completedSessions.length;
  const totalParticipants = completedSessions.reduce((acc, session) => acc + (session.participants?.length || 0), 0);
  const activeReferentials = new Set(completedSessions.map(s => s.referentielId)).size;

  return (
    <div className="mb-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-gris-moyen/20 mr-4">
              <BarChart2 size={24} className="text-rouge-accent" />
            </div>
            <div>
              <p className="text-sm font-medium text-texte-principal/80">Sessions terminées</p>
              <p className="text-2xl font-semibold text-texte-principal">{totalSessions}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-gris-moyen/20 mr-4">
              <CheckCircle size={24} className="text-rouge-accent" />
            </div>
            <div>
              <p className="text-sm font-medium text-texte-principal/80">Taux de réussite moyen</p>
              <p className="text-2xl font-semibold text-texte-principal">{avgSuccessRate.toFixed(0)}%</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-gris-moyen/20 mr-4">
              <Users size={24} className="text-rouge-accent" />
            </div>
            <div>
              <p className="text-sm font-medium text-texte-principal/80">Participants évalués</p>
              <p className="text-2xl font-semibold text-texte-principal">{totalParticipants}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-gris-moyen/20 mr-4">
              <PieChart size={24} className="text-rouge-accent" />
            </div>
            <div>
              <p className="text-sm font-medium text-texte-principal/80">Référentiels</p>
              <p className="text-2xl font-semibold text-texte-principal">{activeReferentials} Actifs</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default GlobalStats;
