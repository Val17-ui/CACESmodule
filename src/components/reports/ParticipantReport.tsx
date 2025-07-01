import { useState, useEffect, useMemo } from 'react';
import Card from '../ui/Card';
import { getAllSessions, getResultsForSession } from '../../db';
import { Session, Participant, SessionResult } from '../../types';
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

const ParticipantReport = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [participantDetails, setParticipantDetails] = useState<{ sessions: Session[], results: SessionResult[] }>({ sessions: [], results: [] });

  useEffect(() => {
    const fetchSessions = async () => {
      const allSessions = await getAllSessions();
      setSessions(allSessions);
    };
    fetchSessions();
  }, []);

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

  const handleSelectParticipant = async (participant: Participant) => {
    setSelectedParticipant(participant);
    const participantSessions = sessions.filter(s => s.participants?.some(p => p.nom === participant.nom && p.prenom === participant.prenom));
    let allResults: SessionResult[] = [];
    for (const session of participantSessions) {
      if(session.id) {
        const results = await getResultsForSession(session.id);
        allResults = [...allResults, ...results.filter(r => r.participantIdBoitier === participant.idBoitier)];
      }
    }
    setParticipantDetails({ sessions: participantSessions, results: allResults });
  };

  const handleBack = () => {
    setSelectedParticipant(null);
    setParticipantDetails({ sessions: [], results: [] });
  };

  if (selectedParticipant) {
    return (
      <Card>
        <Button variant="outline" icon={<ArrowLeft size={16} />} onClick={handleBack} className="mb-4">
          Retour à la liste
        </Button>
        <h2 className="text-2xl font-bold mb-2">{selectedParticipant.prenom} {selectedParticipant.nom}</h2>
        <p className="text-gray-500 mb-6">ID Boîtier: {selectedParticipant.idBoitier}</p>
        
        {/* TODO: Add summary stats (avg score, etc.) */}

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
            {participantDetails.sessions.map(session => (
              <TableRow key={session.id}>
                <TableCell>{session.nomSession}</TableCell>
                <TableCell>{new Date(session.dateSession).toLocaleDateString('fr-FR')}</TableCell>
                <TableCell>N/A</TableCell> {/* TODO: Calculate score */}
                <TableCell>N/A</TableCell> {/* TODO: Determine success */}
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