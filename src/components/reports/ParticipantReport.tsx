import React, { useState, useEffect, useMemo } from 'react';
import Card from '../ui/Card';
import { getAllSessions, getResultsForSession, getQuestionsForSessionBlocks, getAllReferentiels, getReferentialById } from '../../db'; // Ajout de getAllReferentiels, getReferentialById
import { Session, Participant, SessionResult, QuestionWithId, Referential } from '../../types'; // Ajout de Referential
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

interface SessionParticipation {
  key: string; // Clé unique pour la ligne, ex: `session-${sessionId}-participant-${participantRef.assignedGlobalDeviceId}`
  participantDisplayId: string; // Pour l'affichage, si idBoitier n'est pas sur Participant
  participantRef: Participant;
  sessionName: string;
  sessionDate: string;
  referentialName: string;
}

const ParticipantReport = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [allReferentiels, setAllReferentiels] = useState<Referential[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [processedParticipantSessions, setProcessedParticipantSessions] = useState<ProcessedSession[]>([]);

  const referentialMap = useMemo(() => {
    return new Map(allReferentiels.map(ref => [ref.id, ref.nom_complet]));
  }, [allReferentiels]);

  useEffect(() => {
    const fetchInitialData = async () => {
      const [fetchedSessions, fetchedReferentiels] = await Promise.all([
        getAllSessions(),
        getAllReferentiels()
      ]);
      setSessions(fetchedSessions.sort((a, b) => new Date(b.dateSession).getTime() - new Date(a.dateSession).getTime()));
      setAllReferentiels(fetchedReferentiels);
    };
    fetchInitialData();
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
  }, [selectedParticipant, sessions]); // Potentiellement ajouter getQuestionsForSessionBlocks si sa définition change

  const allSessionParticipations = useMemo(() => {
    const participations: SessionParticipation[] = [];
    sessions.forEach(session => {
      if (!session.id) return; // Assurer que la session a un ID
      session.participants?.forEach((p, index) => {
        // Utiliser assignedGlobalDeviceId ou un index pour la clé si assignedGlobalDeviceId est null
        const participantKeyPart = p.assignedGlobalDeviceId ? p.assignedGlobalDeviceId.toString() : `idx-${index}`;
        participations.push({
          key: `session-${session.id}-participant-${participantKeyPart}`,
          participantRef: p,
          participantDisplayId: p.identificationCode || `Boîtier ID ${p.assignedGlobalDeviceId || 'N/A'}`, // Exemple d'ID affichable
          sessionName: session.nomSession,
          sessionDate: new Date(session.dateSession).toLocaleDateString('fr-FR'),
          referentialName: session.referentielId ? (referentialMap.get(session.referentielId) || 'N/A') : 'N/A',
        });
      });
    });
    return participations;
  }, [sessions, referentialMap]);

  const filteredSessionParticipations = useMemo(() => {
    if (!searchTerm) {
      return allSessionParticipations;
    }
    return allSessionParticipations.filter(participation =>
      participation.participantRef.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      participation.participantRef.prenom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      participation.sessionName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      participation.referentialName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allSessionParticipations, searchTerm]);

  const handleSelectParticipant = (participant: Participant) => {
    // La sélection d'un participant pour voir ses détails reste basée sur l'objet Participant
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
            <TableHead>Participant</TableHead>
            <TableHead>Session</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Référentiel</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredSessionParticipations.map((participation) => (
            <TableRow
              key={participation.key}
              onClick={() => handleSelectParticipant(participation.participantRef)}
              className="cursor-pointer hover:bg-gray-50"
            >
              <TableCell>{participation.participantRef.prenom} {participation.participantRef.nom}</TableCell>
              <TableCell>{participation.sessionName}</TableCell>
              <TableCell>{participation.sessionDate}</TableCell>
              <TableCell>
                <Badge variant="secondary">{participation.referentialName}</Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleSelectParticipant(participation.participantRef); }}>
                  Voir l'historique du participant
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};

export default ParticipantReport;
