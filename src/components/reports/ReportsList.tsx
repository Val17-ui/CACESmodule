import React, { useState, useEffect } from 'react';
import { Download, Eye, Printer, FileText } from 'lucide-react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { Session } from '@common/types'; // Referential enlevé
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui/Table';
import { StorageManager } from '../../services/StorageManager';

type ReportsListProps = {
  sessions: Session[];
  onViewReport: (id: string) => void;
  referentialMap: Map<number | undefined, string | undefined>; // Map ID Référentiel -> Code Référentiel
};

const ReportsList: React.FC<ReportsListProps> = ({ sessions, onViewReport, referentialMap }) => {
  const formatDate = (dateString: string | undefined | null): string => {
    if (!dateString) {
      return 'Date non spécifiée';
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Date invalide';
    }
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
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom de la session</TableHead>
            <TableHead>Référentiel</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-center">Participants</TableHead>
            <TableHead className="text-center">Score moyen</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {completedSessions.map((session) => (
            <TableRow key={session.id} className="hover:bg-gray-50">
              <TableCell className="font-medium">{session.nomSession}</TableCell>
              <TableCell>
                <Badge variant="default">
                  {session.referentielId ? (referentialMap.get(session.referentielId) || 'N/A') : 'N/A'}
                </Badge>
              </TableCell>
              <TableCell>{formatDate(session.dateSession)}</TableCell>
              <TableCell className="text-center">{session.participantCount || 0}</TableCell>
              <TableCell className="text-center font-medium text-blue-600">
                {session.averageScore !== null && session.averageScore !== undefined
                  ? `${session.averageScore.toFixed(0)}/100`
                  : 'N/A'}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Eye size={14} />}
                    onClick={() => onViewReport(String(session.id))}
                  >
                    Consulter
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};

export default ReportsList;