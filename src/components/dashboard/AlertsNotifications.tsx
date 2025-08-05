import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import { Bell, AlertTriangle, FileWarning, HelpCircle } from 'lucide-react';
import { Session } from '@common/types';

interface AlertData {
  overdueSessions: Session[];
  questionCount: number;
  isOrsPathSet: boolean;
  isReportPathSet: boolean;
}

const AlertsNotifications: React.FC = () => {
  const [alerts, setAlerts] = useState<AlertData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlerts = async () => {
      setLoading(true);
      try {
        if (window.dbAPI?.getDashboardAlerts) {
          const data = await window.dbAPI.getDashboardAlerts();
          setAlerts(data);
        } else {
          console.error("[AlertsNotifications] dbAPI.getDashboardAlerts is not available.");
        }
      } catch (error) {
        console.error("Erreur lors de la récupération des alertes:", error);
      }
      setLoading(false);
    };

    fetchAlerts();
  }, []);

  const notificationMessages: React.ReactNode[] = [];

  if (alerts) {
    if (alerts.overdueSessions.length > 0) {
      notificationMessages.push(
        <div key="overdue" className="flex items-start">
          <AlertTriangle size={18} className="text-yellow-500 mr-3 mt-0.5" />
          <span>
            <strong>{alerts.overdueSessions.length} session(s) passée(s)</strong> sont prêtes mais les résultats n'ont pas été importés.
          </span>
        </div>
      );
    }
    if (!alerts.isOrsPathSet || !alerts.isReportPathSet) {
      notificationMessages.push(
        <div key="paths" className="flex items-start">
          <FileWarning size={18} className="text-blue-500 mr-3 mt-0.5" />
          <span>
            Les <strong>dossiers d'import</strong> pour les présentations ou les rapports ne sont pas configurés.
          </span>
        </div>
      );
    }
    if (alerts.questionCount === 0) {
      notificationMessages.push(
        <div key="no-questions" className="flex items-start">
          <HelpCircle size={18} className="text-gray-500 mr-3 mt-0.5" />
          <span>
            La <strong>bibliothèque de questions</strong> est vide.
          </span>
        </div>
      );
    }
  }

  return (
    <Card title="Alertes et Notifications" icon={<Bell size={20} className="text-accent-neutre" />}>
      {loading ? (
        <p className="text-sm text-gray-500 italic">Chargement des notifications...</p>
      ) : notificationMessages.length === 0 ? (
        <p className="text-sm text-gray-500 italic">Aucune notification pour le moment.</p>
      ) : (
        <ul className="space-y-3">
          {notificationMessages.map((message, index) => (
            <li key={index} className="text-sm text-gray-700">
              {message}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

export default AlertsNotifications;
