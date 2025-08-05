import { useState, useEffect, useMemo } from 'react';
import Card from '../ui/Card';
import { StorageManager } from '../../services/StorageManager';
import { Session, Participant, Referential, Theme, Bloc, QuestionWithId, VotingDevice, ThemeScoreDetails, SessionResult } from '@common/types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
// import { saveAs } from 'file-saver'; // Retiré car pdf.save() le gère
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui/Table';
import Input from '../ui/Input';
// ChevronDown, ChevronRight retirés
import { Search, ArrowLeft, HelpCircle, CheckCircle, XCircle, Download } from 'lucide-react';
import Button from '../ui/Button';
import { calculateParticipantScore, calculateThemeScores, determineIndividualSuccess } from '../../utils/reportCalculators';
import Badge from '../ui/Badge';

interface EnrichedQuestionForParticipantReport extends QuestionWithId {
  resolvedThemeName?: string;
  resolvedBlocCode?: string;
  participantAnswer?: string;
  pointsObtainedForAnswer?: number;
  isCorrectAnswer?: boolean;
}

interface ProcessedSessionDetails extends Session {
  participantRef: Participant;
  participantScore?: number;
  participantSuccess?: boolean;
  themeScores?: { [theme: string]: ThemeScoreDetails };
  questionsForDisplay?: EnrichedQuestionForParticipantReport[];
}

interface SessionParticipation {
  key: string;
  participantDisplayId: string;
  participantRef: Participant;
  sessionName: string;
  sessionDate: string;
  referentialCode: string;
  originalSessionId: number;
  originalParticipantAssignedGlobalDeviceId?: number | null;
}

const ParticipantReport = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [allReferentiels, setAllReferentiels] = useState<Referential[]>([]);
  const [allVotingDevices, setAllVotingDevices] = useState<VotingDevice[]>([]);
  const [allThemesDb, setAllThemesDb] = useState<Theme[]>([]);
  const [allBlocsDb, setAllBlocsDb] = useState<Bloc[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [detailedParticipation, setDetailedParticipation] = useState<ProcessedSessionDetails | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [savedPdfPath, setSavedPdfPath] = useState<string | null>(null);
  const [trainerName, setTrainerName] = useState<string>('N/A');

  useEffect(() => {
    const fetchTrainerName = async () => {
      if (detailedParticipation?.trainerId) {
        const trainer = await window.dbAPI?.getTrainerById(detailedParticipation.trainerId);
        if (trainer) {
          setTrainerName(trainer.name);
        } else {
          setTrainerName('N/A');
        }
      } else {
        setTrainerName('N/A');
      }
    };
    fetchTrainerName();
  }, [detailedParticipation]);

  const referentialCodeMap = useMemo(() => {
    return new Map(allReferentiels.map(ref => [ref.id, ref.code]));
  }, [allReferentiels]);

  const deviceMap = useMemo(() => {
    return new Map(allVotingDevices.map(device => [device.id, device.serialNumber]));
  }, [allVotingDevices]);

  useEffect(() => {
    const fetchInitialData = async () => {
      const [
        fetchedSessions,
        fetchedReferentiels,
        fetchedVotingDevices,
        fetchedThemes,
        fetchedBlocs
      ] = await Promise.all([
        StorageManager.getAllSessions(),
        StorageManager.getAllReferentiels(),
        StorageManager.getAllVotingDevices(),
        StorageManager.getAllThemes(),
        StorageManager.getAllBlocs()
      ]);
      setSessions(fetchedSessions.sort((a: Session, b: Session) => new Date(b.dateSession).getTime() - new Date(a.dateSession).getTime()));
      setAllReferentiels(fetchedReferentiels);
      setAllVotingDevices(fetchedVotingDevices);
      setAllThemesDb(fetchedThemes);
      setAllBlocsDb(fetchedBlocs);
    };
    fetchInitialData();
  }, []);

  const allSessionParticipations = useMemo(() => {
    const participations: SessionParticipation[] = [];
    const filteredSessionsByDate = sessions.filter(session => {
      if (!startDate && !endDate) return true;
      const sessionDate = new Date(session.dateSession);
      const start = startDate ? new Date(startDate) : null;
      if (start) start.setHours(0,0,0,0);
      if (start && sessionDate < start) return false;

      const end = endDate ? new Date(endDate) : null;
      if (end) end.setHours(23, 59, 59, 999);
      if (end && sessionDate > end) return false;
      return true;
    });

    filteredSessionsByDate.forEach(session => {
      if (!session.id) return;
      session.participants?.forEach((p, index) => {
        participations.push({
          key: `sess-${session.id}-part-${index}`,
          participantRef: p,
          participantDisplayId: p.identificationCode || `Boîtier ${deviceMap.get(p.assignedGlobalDeviceId === null ? undefined : p.assignedGlobalDeviceId) || 'N/A'}`,
          sessionName: session.nomSession,
          sessionDate: new Date(session.dateSession).toLocaleDateString('fr-FR'),
          referentialCode: session.referentielId ? (referentialCodeMap.get(session.referentielId) || 'N/A') : 'N/A',
          originalSessionId: session.id as number,
          originalParticipantAssignedGlobalDeviceId: p.assignedGlobalDeviceId,
        });
      });
    });
    return participations;
  }, [sessions, referentialCodeMap, deviceMap, startDate, endDate]);

  const filteredSessionParticipations = useMemo(() => {
    if (!searchTerm) return allSessionParticipations;
    return allSessionParticipations.filter(participation =>
      `${participation.participantRef.prenom} ${participation.participantRef.nom}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      participation.sessionName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      participation.referentialCode.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allSessionParticipations, searchTerm]);

  const structuredReportData = useMemo(() => {
    if (!detailedParticipation?.questionsForDisplay) {
      return {};
    }

    const data: {
      [themeName: string]: {
        themeId: number;
        score: number;
        blocks: {
          [blockKey: string]: {
            questions: EnrichedQuestionForParticipantReport[];
            score: number;
            correct: number;
            total: number;
          };
        };
      };
    } = {};

    detailedParticipation.questionsForDisplay.forEach(q => {
      const theme = allThemesDb.find(t => t.nom_complet === q.resolvedThemeName);
      if (!theme) return;

      const themeName = theme.nom_complet;
      if (!data[themeName]) {
        data[themeName] = {
          themeId: theme.id,
          blocks: {},
        };
      }

      const bloc = allBlocsDb.find(b => b.id === q.blocId);
      const blockKey = bloc ? `${bloc.code_bloc} (${q.version || 'N/A'})` : `Inconnu (${q.version || 'N/A'})`;

      if (!data[themeName].blocks[blockKey]) {
        data[themeName].blocks[blockKey] = {
          questions: [],
          score: 0,
          correct: 0,
          total: 0,
        };
      }

      data[themeName].blocks[blockKey].questions.push(q);
    });

    // Calculate scores for blocks and themes
    for (const themeName in data) {
      let totalThemeCorrect = 0;
      let totalThemeQuestions = 0;

      for (const blockKey in data[themeName].blocks) {
        const block = data[themeName].blocks[blockKey];
        block.total = block.questions.length;
        block.correct = block.questions.filter(q => q.isCorrectAnswer).length;
        block.score = block.total > 0 ? (block.correct / block.total) * 100 : 0;

        totalThemeCorrect += block.correct;
        totalThemeQuestions += block.total;
      }

      data[themeName].score = totalThemeQuestions > 0 ? (totalThemeCorrect / totalThemeQuestions) * 100 : 0;
    }

    return data;
  }, [detailedParticipation, allThemesDb, allBlocsDb]);

  const handleSelectParticipation = async (participation: SessionParticipation) => {
    setDetailedParticipation(null);

    const targetSession = sessions.find(s => s.id === participation.originalSessionId);
    const targetParticipantRef = targetSession?.participants?.find(p => p.assignedGlobalDeviceId === participation.originalParticipantAssignedGlobalDeviceId);

    if (!targetSession || !targetSession.id || !targetParticipantRef || targetParticipantRef.assignedGlobalDeviceId === undefined || !deviceMap.size || !allThemesDb.length || !allBlocsDb.length) {
      console.error("Données manquantes pour traiter la participation détaillée", {targetSession, targetParticipantRef, deviceMapSize: deviceMap.size, allThemesDbL: allThemesDb.length, allBlocsDbL: allBlocsDb.length});
      return;
    }

    const serialNumberOfSelectedParticipant = deviceMap.get(targetParticipantRef.assignedGlobalDeviceId === null ? undefined : targetParticipantRef.assignedGlobalDeviceId);
    if (!serialNumberOfSelectedParticipant) {
      console.error("Numéro de série non trouvé pour le participant", targetParticipantRef);
      return;
    }

    try {
      const sessionResults = await StorageManager.getResultsForSession(targetSession.id!);
      const baseSessionQuestions = await StorageManager.getQuestionsForSessionBlocks(targetSession.selectedBlocIds || []);

      const enrichedSessionQuestions: EnrichedQuestionForParticipantReport[] = await Promise.all(
        baseSessionQuestions.map(async (question: QuestionWithId, index: number) => {
          try {
            let resolvedThemeName = 'Thème non spécifié';
            let resolvedBlocCode = 'N/A';
            if (question.blocId) {
              const bloc = allBlocsDb.find(b => b.id === question.blocId);
              if (bloc) {
                resolvedBlocCode = bloc.code_bloc;
                if (bloc.theme_id) {
                  const theme = allThemesDb.find(t => t.id === bloc.theme_id);
                  if (theme) resolvedThemeName = theme.nom_complet;
                }
              }
            }
            const participantResult = sessionResults.find(
              (sr: SessionResult) => sr.participantIdBoitier === serialNumberOfSelectedParticipant && sr.questionId === question.id
            );
            return { ...question, resolvedThemeName, resolvedBlocCode, participantAnswer: participantResult?.answer, pointsObtainedForAnswer: participantResult?.pointsObtained, isCorrectAnswer: participantResult?.isCorrect };
          } catch (error) {
            console.error(`[ParticipantReport] Error enriching question ID ${question.id} (index ${index}):`, error);
            return { ...question, resolvedThemeName: 'Erreur chargement thème', resolvedBlocCode: 'Erreur', participantAnswer: 'Erreur', pointsObtainedForAnswer: 0, isCorrectAnswer: false };
          }
        })
      );

      const currentParticipantSessionResults = sessionResults.filter(r => r.participantIdBoitier === serialNumberOfSelectedParticipant);
      const score = calculateParticipantScore(currentParticipantSessionResults, enrichedSessionQuestions);
      const themeScores = calculateThemeScores(currentParticipantSessionResults, enrichedSessionQuestions);
      const reussite = determineIndividualSuccess(score, Object.values(themeScores));

      setDetailedParticipation({
        ...targetSession,
        participantRef: targetParticipantRef,
        participantScore: score,
        participantSuccess: reussite,
        themeScores,
        questionsForDisplay: enrichedSessionQuestions
      });
    } catch (error) {
      console.error('[ParticipantReport] Error processing participation details:', error);
      setDetailedParticipation(null);
    }
  };

  const handleBackToList = () => {
    setDetailedParticipation(null);
  };

  const generateSingleParticipantReportPDF = async () => {
    if (!detailedParticipation) return;
    setIsGeneratingPdf(true);
    setSavedPdfPath(null);

    const { participantRef, nomSession, dateSession, referentielId, location, trainerId, participantScore, participantSuccess, questionsForDisplay, num_session, num_stage } = detailedParticipation;

    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;
    let y = 20;

    // --- Header ---
    doc.setFontSize(18);
    doc.setTextColor(33, 33, 33);
    doc.text("Rapport Individuel de Session", doc.internal.pageSize.width / 2, y, { align: 'center' });
    y += 10;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, doc.internal.pageSize.width - margin, y);
    y += 10;

    // --- Details Section (Two Columns) ---
    const col1X = margin;
    const col2X = doc.internal.pageSize.width / 2 + 5;
    let yCol1 = y;
    let yCol2 = y;

    const currentReferential = referentielId ? allReferentiels.find(r => r.id === referentielId) : null;
    const referentialDisplayForPdf = currentReferential ? `${currentReferential.code} - ${currentReferential.nom_complet}` : 'N/A';

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text("Détails", col1X, yCol1);
    yCol1 += 6;
    doc.setFont('helvetica', 'normal');
    doc.text(`Participant : ${participantRef.prenom} ${participantRef.nom}`, col1X, yCol1);
    yCol1 += 5;
    doc.text(`ID Candidat : ${participantRef.identificationCode || 'N/A'}`, col1X, yCol1);
    yCol1 += 5;
    doc.text(`Organisation : ${participantRef.organization || 'N/A'}`, col1X, yCol1);
    yCol1 += 5;
    doc.text(`Session : ${nomSession}`, col1X, yCol1);
    yCol1 += 5;
    doc.text(`Référentiel : ${referentialDisplayForPdf}`, col1X, yCol1);
    yCol1 += 5;
    doc.text(`N° Session : ${num_session || 'N/A'}`, col1X, yCol1);
    yCol1 += 5;
    doc.text(`N° Stage : ${num_stage || 'N/A'}`, col1X, yCol1);
    yCol1 += 5;
    doc.text(`Date : ${new Date(dateSession).toLocaleDateString('fr-FR')}`, col1X, yCol1);
    yCol1 += 5;
    doc.text(`Formateur : ${trainerName}`, col1X, yCol1);
    yCol1 += 5;
    doc.text(`Lieu : ${location || 'N/A'}`, col1X, yCol1);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text("Scores par Thème", col2X, yCol2);
    yCol2 += 6;
    doc.setFont('helvetica', 'normal');

    Object.entries(structuredReportData)
      .sort(([_, a], [__, b]) => a.themeId - b.themeId)
      .forEach(([themeName, themeData]) => {
        doc.setTextColor(themeData.score < 50 ? 255 : 33, 0, 0);
        doc.setFont('helvetica', 'bold');
        doc.text(themeName, col2X, yCol2);
        doc.setTextColor(33, 33, 33);
        doc.setFont('helvetica', 'normal');
        yCol2 += 5;

        Object.entries(themeData.blocks).forEach(([blockKey, blockData]) => {
          doc.text(`- ${blockKey}: ${blockData.score.toFixed(0)}% (${blockData.correct}/${blockData.total})`, col2X + 4, yCol2);
          yCol2 += 5;
        });
      });

    y = Math.max(yCol1, yCol2) + 10;

    // --- Global Score ---
    doc.setFillColor(participantSuccess ? 232 : 255, participantSuccess ? 245 : 235, participantSuccess ? 233 : 238);
    doc.rect(margin, y, doc.internal.pageSize.width - margin * 2, 18, 'F');
    y += 8;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(participantSuccess ? 46 : 198, participantSuccess ? 125 : 40, participantSuccess ? 50 : 40);
    doc.text(`Note Globale : ${participantScore !== undefined ? participantScore.toFixed(0) : 'N/A'} / 100`, doc.internal.pageSize.width / 2, y, { align: 'center' });
    y += 7;
    doc.setFontSize(12);
    doc.text(`Mention : ${participantSuccess ? 'RÉUSSI' : 'AJOURNÉ'}`, doc.internal.pageSize.width / 2, y, { align: 'center' });
    y += 10;

    // --- Questions Section ---
    doc.addPage();
    y = 20;
    doc.setFontSize(14);
    doc.setTextColor(33, 33, 33);
    doc.setFont('helvetica', 'bold');
    doc.text("Détail des Questions", margin, y);
    y += 8;

    const sortedThemes = Object.entries(structuredReportData).sort(([_, a], [__, b]) => a.themeId - b.themeId);

    sortedThemes.forEach(([themeName, themeData]) => {
      if (y > pageHeight - 20) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(63, 81, 181);
      doc.text(themeName, margin, y);
      y += 7;

      Object.entries(themeData.blocks).forEach(([blockKey, blockData]) => {
        if (y > pageHeight - 20) { doc.addPage(); y = 20; }
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100, 100, 100);
        doc.text(blockKey, margin, y);
        y += 6;

        blockData.questions.forEach(q => {
          if (y > pageHeight - 15) { doc.addPage(); y = 20; }
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(33, 33, 33);
          const questionTextLines = doc.splitTextToSize(q.text, doc.internal.pageSize.width - margin * 2);
          doc.text(questionTextLines, margin, y);
          y += questionTextLines.length * 4;

          doc.setFont('helvetica', 'normal');
          const answerText = `Réponse : ${q.participantAnswer || 'Non répondu'}`;
          const statusText = q.isCorrectAnswer ? 'Correct' : 'Incorrect';
          const answerX = margin + 4;
          const statusX = answerX + doc.getTextWidth(answerText) + 5;

          doc.text(answerText, answerX, y);
          doc.setTextColor(q.isCorrectAnswer ? 46 : 198, q.isCorrectAnswer ? 125 : 40, q.isCorrectAnswer ? 50 : 40);
          doc.text(statusText, statusX, y);
          y += 6;
        });
      });
    });

    const safeFileName = `Rapport_${participantRef.prenom}_${participantRef.nom}_${nomSession}.pdf`.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const pdfBuffer = doc.output('arraybuffer');
    const result = await window.dbAPI.saveReportFile(pdfBuffer, safeFileName);

    if (result.success && result.filePath) {
      setSavedPdfPath(result.filePath);
    } else {
      console.error("Failed to save PDF:", result.error);
    }

    setIsGeneratingPdf(false);
  };

  if (detailedParticipation) {
    const { participantRef, participantScore, participantSuccess } = detailedParticipation;

    return (
      <Card>
        <div className="flex justify-between items-center mb-4">
          <Button variant="outline" icon={<ArrowLeft size={16} />} onClick={handleBackToList}>
            Retour à la liste
          </Button>
          <Button
            onClick={generateSingleParticipantReportPDF}
            icon={<Download size={16} />}
            disabled={isGeneratingPdf}
          >
            {isGeneratingPdf ? 'Génération PDF...' : 'Télécharger PDF'}
          </Button>
          {savedPdfPath && (
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                window.dbAPI.openFile(savedPdfPath);
              }}
              className="text-sm text-blue-600 hover:underline ml-4"
            >
              Ouvrir le rapport
            </a>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Col 1: Details */}
          <div className="lg:col-span-1">
            <h2 className="text-2xl font-bold mb-4">Détails</h2>
            <Card className="p-4 space-y-2">
              <div><strong>Participant :</strong> {participantRef.prenom} {participantRef.nom}</div>
              <div><strong>ID Candidat :</strong> {participantRef.identificationCode || 'N/A'}</div>
              <div><strong>Organisation :</strong> {participantRef.organization || 'N/A'}</div>
              <hr className="my-2" />
              <div><strong>Session :</strong> {detailedParticipation.nomSession}</div>
              <div><strong>Référentiel :</strong> <Badge variant="default">{referentialCodeMap.get(detailedParticipation.referentielId) || 'N/A'}</Badge></div>
              <div><strong>N° Session :</strong> {detailedParticipation.num_session || 'N/A'}</div>
              <div><strong>N° Stage :</strong> {detailedParticipation.num_stage || 'N/A'}</div>
              <div><strong>Date :</strong> {new Date(detailedParticipation.dateSession).toLocaleDateString('fr-FR')}</div>
              <div><strong>Formateur :</strong> {trainerName}</div>
              <div><strong>Lieu :</strong> {detailedParticipation.location || 'N/A'}</div>
            </Card>
          </div>

          {/* Col 2: Scores */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <Card className="p-4 flex-grow">
              <div className="space-y-2">
                {Object.entries(structuredReportData)
                  .sort(([_, a], [__, b]) => a.themeId - b.themeId)
                  .map(([themeName, themeData]) => (
                    <div key={themeName}>
                      {Object.entries(themeData.blocks).map(([blockKey, blockData]) => (
                        <div key={blockKey} className="text-sm">
                          <span className={`font-semibold ${themeData.score < 50 ? 'text-red-500' : ''}`}>{themeName}</span> - {blockKey}: {blockData.score.toFixed(0)}% ({blockData.correct}/{blockData.total})
                        </div>
                      ))}
                    </div>
                  ))}
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Note Globale</h3>
                <div className="text-right">
                  <p className={participantSuccess ? 'text-green-600 font-bold text-xl' : 'text-red-600 font-bold text-xl'}>
                    {participantScore !== undefined ? `${participantScore.toFixed(0)} / 100` : 'N/A'}
                  </p>
                  {participantSuccess !== undefined ? (
                    participantSuccess ? <Badge variant="success">Réussi</Badge> : <Badge variant="danger">Ajourné</Badge>
                  ) : <Badge variant="warning">En attente</Badge>}
                </div>
              </div>
            </Card>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">Détail des Questions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
            {Object.entries(structuredReportData)
              .sort(([_, a], [__, b]) => a.themeId - b.themeId)
              .map(([themeName, themeData]) => (
                <div key={themeName} className="mb-4 pt-2">
                  <h4 className="text-md font-semibold text-gray-700 mb-3 pb-1 border-b border-gray-300">
                    {themeName}
                  </h4>
                  {Object.entries(themeData.blocks).map(([blockKey, blockData]) => (
                    <div key={blockKey}>
                      <h5 className="font-medium text-gray-600 mb-2">{blockKey}</h5>
                      {blockData.questions.map((q, qIndex) => (
                        <div key={q.id || `q-${qIndex}`} className="text-sm mb-4 pb-3 border-b border-gray-200 last:border-b-0 last:pb-0 last:mb-0">
                          <p className="font-medium text-gray-900 mb-1">{q.text}</p>
                          <div className="pl-6 space-y-0.5">
                            <p>
                              Réponse : <span className="font-semibold">{q.participantAnswer || 'Non répondu'}</span>
                              <span className={`ml-2 font-semibold ${q.isCorrectAnswer ? 'text-green-600' : 'text-red-600'}`}>
                                {q.isCorrectAnswer ? 'Correct' : 'Incorrect'}
                              </span>
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="text-xl font-bold mb-4">Rapport par Participant (Participations aux Sessions)</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Input 
          placeholder="Rechercher..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="md:col-span-1"
          icon={<Search size={16} className="text-gray-400"/>}
        />
        <Input
          type="date"
          label="Date de début"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className=""
        />
        <Input
          type="date"
          label="Date de fin"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className=""
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
              onClick={() => handleSelectParticipation(participation)}
              className="cursor-pointer hover:bg-gray-50"
            >
              <TableCell>{participation.participantRef.prenom} {participation.participantRef.nom}</TableCell>
              <TableCell>{participation.sessionName}</TableCell>
              <TableCell>{participation.sessionDate}</TableCell>
              <TableCell>
                <Badge variant="default">{participation.referentialCode}</Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" onClick={(event: React.MouseEvent) => { event.stopPropagation(); handleSelectParticipation(participation); }}>
                  Voir détails participation
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
