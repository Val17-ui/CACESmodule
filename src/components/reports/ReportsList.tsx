import React from 'react';
import { Download, Eye, Printer, FileText, Calendar, Users, CheckCircle } from 'lucide-react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { Session } from '../../types';

type ReportsListProps = {
  sessions: Session[];
  onViewReport: (id: string) => void;
};

const ReportsList: React.FC<ReportsListProps> = ({ sessions, onViewReport }) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
  };

  const completedSessions = sessions.filter(s => s.status === 'completed');

  if (completedSessions.length === 0) {
    return (
      <Card>
        <div className="text-center py-12 text-gray-500">
          <FileText size={48} className="mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-800">Aucun rapport disponible</h3>
          <p className="mt-1 text-sm">Complétez une session pour générer des rapports.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {completedSessions.map((session) => (
        <Card key={session.id} className="flex flex-col justify-between hover:shadow-md transition-shadow duration-200">
          <div>
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">{session.name}</h3>
              <Badge variant="primary">{session.referential}</Badge>
            </div>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-center">
                <Calendar size={16} className="mr-2 text-gray-400" />
                <span>{formatDate(session.date)}</span>
              </div>
              <div className="flex items-center">
                <Users size={16} className="mr-2 text-gray-400" />
                <span>{session.participantsCount} participants</span>
              </div>
              <div className="flex items-center">
                <CheckCircle size={16} className="mr-2 text-green-500" />
                <span className="font-medium">Taux de réussite: 78%</span>
              </div>
            </div>
          </div>
          <div className="border-t -mx-6 mt-6 pt-4 px-6 flex justify-end space-x-2">
            <Button
              variant="primary"
              size="sm"
              icon={<Eye size={16} />}
              onClick={() => onViewReport(session.id)}
            >
              Consulter
            </Button>
            <Button variant="outline" size="icon" title="Exporter en PDF">
              <Download size={16} />
            </Button>
            <Button variant="outline" size="icon" title="Imprimer">
              <Printer size={16} />
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default ReportsList;