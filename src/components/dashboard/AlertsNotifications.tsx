import React from 'react';
import Card from '../ui/Card';
import { Bell } from 'lucide-react';

const AlertsNotifications: React.FC = () => {
  // Logique future pour récupérer et afficher les alertes/notifications
  const notifications: string[] = []; // Placeholder

  return (
    <Card title="Alertes et Notifications" icon={<Bell size={20} className="text-accent-neutre" />}>
      {notifications.length === 0 ? (
        <p className="text-sm text-gray-500 italic">Aucune notification pour le moment.</p>
      ) : (
        <ul className="space-y-2">
          {notifications.map((notification, index) => (
            <li key={index} className="text-sm text-gray-700">
              {notification}
            </li>
          ))}
        </ul>
      )}
      {/* Espace pour des actions futures, ex: "Voir toutes les notifications" */}
    </Card>
  );
};

export default AlertsNotifications;
