import React, { useState, useEffect, useMemo } from 'react';
import Card from '../ui/Card';
import { getAllSessions, getResultsForSession, getQuestionsForSessionBlocks } from '../../db';
import { Session, Participant, SessionResult, QuestionWithId } from '../../types';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui/Table';
import Input from '../ui/Input';
import { Search, ArrowLeft } from 'lucide-react';
import Button from '../ui/Button';
import { calculateParticipantScore, calculateThemeScores, determineIndividualSuccess } from '../../utils/reportCalculators';
import Badge from '../ui/Badge';

interface ProcessedSession extends Session {
  participantScore?: number;
  participantSuccess?: boolean;
}

const ParticipantReport = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [processedParticipantSessions, setProcessedParticipantSessions] = useState<ProcessedSession[]>([]);

  useEffect(() => {
    const fetchSessions = async () => {
      const allSessions = await getAllSessions();
      setSessions(allSessions);
    };
    fetchSessions();
  }, []);

  useEffect(() => {
    const processSessions = async () => {
      if (selectedParticipant) {
        const participantSessions = sessions.filter(s => s.participants?.some(p => p.nom === selectedParticipant.nom && p.prenom === selectedParticipant.prenom));
        const processed: ProcessedSession[] = [];

        for (const session of participantSessions) {
          if (session.id) {
            const sessionResults = await getResultsForSession(session.id);
            const sessionQuestions = await getQuestionsForSessionBlocks(session.selectionBlocs || []);

            const currentParticipantSessionResults = sessionResults.filter(r => r.participantIdBoitier === selectedParticipant.idBoitier);
            const score = calculateParticipantScore(currentParticipantSessionResults, sessionQuestions);
            const themeScores = calculateThemeScores(currentParticipantSessionResults, sessionQuestions);
            const reussite = determineIndividualSuccess(score, themeScores);

            processed.push({ ...session, participantScore: score, participantSuccess: reussite });
          }
        }
        setProcessedParticipantSessions(processed);
      }
    };
    processSessions();
  }, [selectedParticipant, sessions]);

  const allParticipants = useMemo(() => {
    const participantMap = new Map<string, { participant: Participant; sessionCount: number }>();
    sessions.forEach(session => {
      session.participants?.forEach(p => {
        const key = `${p.nom}-${p.prenom}`;
        if (participantMap.has(key)) {
          participantMap.get(key)!.sessionCount++;
        } else {
          participantMap.set(key, { participant: p, sessionCount: 1 });
        }
      });
    });
    return Array.from(participantMap.values());
  }, [sessions]);

  const filteredParticipants = useMemo(() => {
    return allParticipants.filter(({ participant }) => 
      `${participant.prenom} ${participant.nom}`.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allParticipants, searchTerm]);

  const handleSelectParticipant = (participant: Participant) => {
    setSelectedParticipant(participant);
  };

  const handleBack = () => {
    setSelectedParticipant(null);
    setProcessedParticipantSessions([]);
  };

  if (selectedParticipant) {
    const totalScore = processedParticipantSessions.reduce((sum, s) => sum + (s.participantScore || 0), 0);
    const avgScore = processedParticipantSessions.length > 0 ? totalScore / processedParticipantSessions.length : 0;
    const totalSuccess = processedParticipantSessions.filter(s => s.participantSuccess).length;
    const successRate = processedParticipantSessions.length > 0 ? (totalSuccess / processedParticipantSessions.length) * 100 : 0;

    return (
      <Card>
        <Button variant="outline" icon={<ArrowLeft size={16} />} onClick={handleBack} className="mb-4">
          Retour à la liste
        </Button>
        <h2 className="text-2xl font-bold mb-2">{selectedParticipant.prenom} {selectedParticipant.nom}</h2>
        <p className="text-gray-500 mb-6">ID Boîtier: {selectedParticipant.idBoitier}</p>
        
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-xs text-gray-500">Score moyen global</p>
            <p className="text-2xl font-semibold text-gray-900">{avgScore.toFixed(0)}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Taux de réussite global</p>
            <p className="text-2xl font-semibold text-gray-900">{successRate.toFixed(0)}%</p>
          </div>
        </div>

        <h3 className="text-xl font-semibold mb-4">Historique des sessions</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Session</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Résultat</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {processedParticipantSessions.map(session => (
              <TableRow key={session.id}>
                <TableCell>{session.nomSession}</TableCell>
                <TableCell>{new Date(session.dateSession).toLocaleDateString('fr-FR')}</TableCell>
                <TableCell>{session.participantScore !== undefined ? `${session.participantScore.toFixed(0)}%` : 'N/A'}</TableCell>
                <TableCell>
                  {session.participantSuccess !== undefined ? (
                    session.participantSuccess ? (
                      <Badge variant="success">Certifié</Badge>
                    ) : (
                      <Badge variant="danger">Ajourné</Badge>
                    )
                  ) : (
                    <Badge variant="warning">En attente</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="text-xl font-bold mb-4">Rapport par Participant</h2>
      <div className="mb-4">
        <Input 
          placeholder="Rechercher par nom..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-1/3"
          icon={<Search size={16} className="text-gray-400"/>}
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Prénom</TableHead>
            <TableHead>Nom</TableHead>
            <TableHead className="text-center">Sessions Participées</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredParticipants.map(({ participant, sessionCount }) => (
            <TableRow key={`${participant.nom}-${participant.prenom}`} onClick={() => handleSelectParticipant(participant)} className="cursor-pointer">
              <TableCell>{participant.prenom}</TableCell>
              <TableCell>{participant.nom}</TableCell>
              <TableCell className="text-center">{sessionCount}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" onClick={() => handleSelectParticipant(participant)}>Détails</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};

export default ParticipantReport;
