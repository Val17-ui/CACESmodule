import { useState, useEffect, useMemo } from 'react';
import Card from '../ui/Card';
import {
  getAllSessions,
  getResultsForSession,
  getQuestionsForSessionBlocks,
  getAllReferentiels,
  getAllVotingDevices,
  getAllThemes,
  getAllBlocs,
  // getBlocById, // Unused
  // getThemeById, // Unused
  getAdminSetting,
  getTrainerById
} from '../../db';
import { Session, Participant, Referential, Theme, Bloc, QuestionWithId, VotingDevice, ThemeScoreDetails } from '../../types';
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
        getAllSessions(),
        getAllReferentiels(),
        getAllVotingDevices(),
        getAllThemes(),
        getAllBlocs()
      ]);
      setSessions(fetchedSessions.sort((a, b) => new Date(b.dateSession).getTime() - new Date(a.dateSession).getTime()));
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
        const participantKeyPart = p.assignedGlobalDeviceId ? p.assignedGlobalDeviceId.toString() : `paridx-${index}`;
        participations.push({
          key: `sess-${session.id}-part-${participantKeyPart}`,
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

  const handleSelectParticipation = async (participation: SessionParticipation) => {
    setDetailedParticipation(null);

    const targetSession = sessions.find(s => s.id === participation.originalSessionId);
    const targetParticipantRef = targetSession?.participants.find(p => p.assignedGlobalDeviceId === participation.originalParticipantAssignedGlobalDeviceId);

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
      const sessionResults = await getResultsForSession(targetSession.id!);
      const baseSessionQuestions = await getQuestionsForSessionBlocks(targetSession.selectedBlocIds || []);

      const enrichedSessionQuestions: EnrichedQuestionForParticipantReport[] = await Promise.all(
        baseSessionQuestions.map(async (question, index) => {
          try {
            let resolvedThemeName = 'Thème non spécifié';
            if (question.blocId) {
              const bloc = allBlocsDb.find(b => b.id === question.blocId);
              if (bloc && bloc.theme_id) {
                const theme = allThemesDb.find(t => t.id === bloc.theme_id);
                if (theme) resolvedThemeName = theme.nom_complet;
              }
            }
            const participantResult = sessionResults.find(
              sr => sr.participantIdBoitier === serialNumberOfSelectedParticipant && sr.questionId === question.id
            );
            return { ...question, resolvedThemeName, participantAnswer: participantResult?.answer, pointsObtainedForAnswer: participantResult?.pointsObtained, isCorrectAnswer: participantResult?.isCorrect };
          } catch (error) {
            console.error(`[ParticipantReport] Error enriching question ID ${question.id} (index ${index}):`, error);
            return { ...question, resolvedThemeName: 'Erreur chargement thème', participantAnswer: 'Erreur', pointsObtainedForAnswer: 0, isCorrectAnswer: false };
          }
        })
      );

      const currentParticipantSessionResults = sessionResults.filter(r => r.participantIdBoitier === serialNumberOfSelectedParticipant);
      const score = calculateParticipantScore(currentParticipantSessionResults, enrichedSessionQuestions);
      const themeScores = calculateThemeScores(currentParticipantSessionResults, enrichedSessionQuestions);
      const reussite = determineIndividualSuccess(score, themeScores);

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

    const { participantRef, nomSession, dateSession, referentielId, location, trainerId, participantScore, participantSuccess, themeScores, questionsForDisplay } = detailedParticipation;

    let fetchedTrainerName = 'N/A';
    if (trainerId) {
      const trainer = await getTrainerById(trainerId);
      if (trainer) fetchedTrainerName = trainer.name;
    }

    const reportDate = new Date().toLocaleDateString('fr-FR');
    const logoBase64 = await getAdminSetting('reportLogoBase64') as string || null;
    const boitierIdDisplay = deviceMap.get(participantRef.assignedGlobalDeviceId === null ? undefined : participantRef.assignedGlobalDeviceId) || 'N/A';

    const currentReferential = referentielId ? allReferentiels.find(r => r.id === referentielId) : null;
    const referentialDisplayForPdf = currentReferential ? `${currentReferential.code} - ${currentReferential.nom_complet}` : 'N/A';

    let pdfHtml = `
      <div style="font-family: Arial, sans-serif; margin: 20px; font-size: 10px; color: #333;">
        ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" style="max-height: 60px; margin-bottom: 20px;"/>` : ''}
        <h1 style="font-size: 18px; text-align: center; color: #1a237e; margin-bottom: 10px;">RAPPORT INDIVIDUEL DE SESSION</h1>
        <hr style="border: 0; border-top: 1px solid #ccc; margin-bottom: 20px;" />
        <table style="width: 100%; font-size: 10px; margin-bottom: 15px; border-collapse: collapse;">
          <tr>
            <td style="padding: 4px; width: 50%;"><strong>Participant :</strong> ${participantRef.prenom} ${participantRef.nom}</td>
            <td style="padding: 4px; width: 50%;"><strong>ID Boîtier :</strong> ${boitierIdDisplay}</td>
          </tr>
          <tr>
            <td style="padding: 4px;"><strong>Session :</strong> ${nomSession}</td>
            <td style="padding: 4px;"><strong>Date :</strong> ${new Date(dateSession).toLocaleDateString('fr-FR')}</td>
          </tr>
          <tr>
            <td style="padding: 4px;"><strong>Référentiel :</strong> ${referentialDisplayForPdf}</td>
            <td style="padding: 4px;"><strong>Lieu :</strong> ${location || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 4px;"><strong>Formateur :</strong> ${fetchedTrainerName}</td>
            <td style="padding: 4px;"></td>
          </tr>
        </table>
        <div style="background-color: ${participantSuccess ? '#e8f5e9' : '#ffebee'}; padding: 15px; border-radius: 4px; margin-bottom: 20px; text-align: center;">
          <p style="font-size: 14px; font-weight: bold; margin:0;">Score Global :
            <span style="color: ${participantSuccess ? '#2e7d32' : '#c62828'};">${participantScore !== undefined ? participantScore.toFixed(0) : 'N/A'} / 100</span>
          </p>
          <p style="font-size: 12px; font-weight: bold; color: ${participantSuccess ? '#2e7d32' : '#c62828'}; margin-top: 5px;">
            Mention : ${participantSuccess ? 'RÉUSSI' : 'AJOURNÉ'}
          </p>
        </div>
        <h2 style="font-size: 14px; color: #1a237e; border-bottom: 1px solid #3f51b5; padding-bottom: 5px; margin-top: 25px; margin-bottom: 10px;">Détail des Scores par Thème</h2>`;
    if (themeScores && Object.keys(themeScores).length > 0) {
      pdfHtml += '<ul style="list-style-type: none; padding-left: 0;">';
      for (const [themeName, details] of Object.entries(themeScores)) {
        pdfHtml += `<li style="margin-bottom: 5px; padding: 5px; border-bottom: 1px solid #eee; ${details.score < 50 ? 'color: #c62828; font-weight: bold;' : ''}">
          ${themeName}: ${details.score.toFixed(0)}% (${details.correct}/${details.total})
        </li>`;
      }
      pdfHtml += '</ul>';
    } else {
      pdfHtml += '<p style="font-size: 10px; color: #555;">Scores par thème non disponibles.</p>';
    }
    pdfHtml += `<h2 style="font-size: 14px; color: #1a237e; border-bottom: 1px solid #3f51b5; padding-bottom: 5px; margin-top: 25px; margin-bottom: 10px;">Détail des Questions</h2>`;
    const questionsByThemeForPdf: { [themeName: string]: EnrichedQuestionForParticipantReport[] } = {};
    if (questionsForDisplay) {
      questionsForDisplay.forEach(q => {
        const theme = q.resolvedThemeName || 'Thème non spécifié';
        if (!questionsByThemeForPdf[theme]) questionsByThemeForPdf[theme] = [];
        questionsByThemeForPdf[theme].push(q);
      });
    }
    if (Object.keys(questionsByThemeForPdf).length > 0) {
      for (const [themeName, questions] of Object.entries(questionsByThemeForPdf)) {
        pdfHtml += `<h3 style="font-size: 12px; color: #3f51b5; margin-top: 15px; margin-bottom: 8px; width:100%; page-break-before: auto; page-break-after: avoid;">Thème : ${themeName}</h3>`;
        pdfHtml += `<div style="width: 100%; overflow: auto; page-break-inside: avoid;">`;

        const questionsPerColumn = Math.ceil(questions.length / 3);
        for (let col = 0; col < 3; col++) {
          const marginRight = col < 2 ? '1%' : '0';
          pdfHtml += `<div style="display: inline-block; width: 32%; vertical-align: top; margin-right: ${marginRight}; page-break-inside: avoid;">`;

          const startIndex = col * questionsPerColumn;
          const endIndex = Math.min(startIndex + questionsPerColumn, questions.length);

          for (let i = startIndex; i < endIndex; i++) {
            const q = questions[i];
            pdfHtml += `
              <div style="margin-bottom: 8px; padding-bottom: 5px; border-bottom: 1px dotted #ccc; page-break-inside: avoid;">
                <p style="margin: 1px 0; font-weight: bold; font-size: 9px;">${q.text}</p>
                <p style="margin: 1px 0 0 8px; font-size: 9px;">Réponse : <span style="font-style: italic;">${q.participantAnswer || 'N/R'}</span></p>
                ${q.isCorrectAnswer === false && q.participantAnswer !== undefined ? `<p style="margin: 1px 0 0 8px; color: #d32f2f; font-size: 9px;">Correction : <span style="font-style: italic;">${q.correctAnswer}</span></p>` : ''}
                <p style="margin: 1px 0 0 8px; font-size: 9px;">Points : ${q.pointsObtainedForAnswer !== undefined ? q.pointsObtainedForAnswer : (q.isCorrectAnswer ? 1 : 0)}</p>
              </div>`;
          }
          pdfHtml += `</div>`;
        }
        pdfHtml += `</div>`;
        pdfHtml += `<div style="clear: both;"></div>`;
      }
    } else {
      pdfHtml += '<p style="font-size: 10px; color: #555;">Détail des questions non disponible.</p>';
    }
    pdfHtml += `<p style="text-align: right; font-size: 8px; color: #777; margin-top: 30px;">Rapport généré le ${reportDate}</p></div>`;

    const element = document.createElement('div');
    element.style.width = '1000px';
    element.style.padding = '20px';
    element.innerHTML = pdfHtml;
    document.body.appendChild(element);

    const canvas = await html2canvas(element, { scale: 2, useCORS: true, windowWidth: element.scrollWidth, windowHeight: element.scrollHeight });
    const imgData = canvas.toDataURL('image/png');
    document.body.removeChild(element);

    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfPageHeight = pdf.internal.pageSize.getHeight();

    const img = new Image();
    img.src = imgData;
    await new Promise(resolve => { img.onload = resolve; img.onerror = () => { console.error("Erreur de chargement de l'image pour PDF"); resolve(null);}; });

    if (img.width === 0 || img.height === 0) {
      console.error("PDF Generation: Image from canvas has zero dimensions.");
      setIsGeneratingPdf(false);
      return;
    }

    const PADDING = 10;
    const usableWidth = pdfWidth - 2 * PADDING;
    const usableHeight = pdfPageHeight - 2 * PADDING;

    const aspectRatio = img.height / img.width;
    let finalImgWidth = usableWidth;
    let finalImgHeight = usableWidth * aspectRatio;

    if (finalImgHeight > usableHeight) {
      finalImgHeight = usableHeight;
      finalImgWidth = usableHeight / aspectRatio;
    }

    const sourceCanvas = canvas;
    const pageCanvas = document.createElement('canvas');
    const pageCtx = pageCanvas.getContext('2d');

    let sliceHeightPx = sourceCanvas.height * (usableHeight / finalImgHeight);
    if (finalImgHeight < usableHeight) {
        sliceHeightPx = sourceCanvas.height;
    }

    pageCanvas.width = sourceCanvas.width;
    pageCanvas.height = sliceHeightPx;

    let yOffsetPx = 0;
    let pageNum = 0;

    while(yOffsetPx < sourceCanvas.height) {
      if (pageNum > 0) {
        pdf.addPage();
      }
      pageCtx?.clearRect(0,0, pageCanvas.width, pageCanvas.height);
      pageCtx?.drawImage(sourceCanvas,
        0, yOffsetPx,
        sourceCanvas.width, Math.min(sliceHeightPx, sourceCanvas.height - yOffsetPx),
        0, 0,
        sourceCanvas.width, Math.min(sliceHeightPx, sourceCanvas.height - yOffsetPx)
      );
      const pageImgData = pageCanvas.toDataURL('image/png');

      let currentSlicePdfHeight = usableHeight;
      if (yOffsetPx + sliceHeightPx > sourceCanvas.height) {
          currentSlicePdfHeight = ((sourceCanvas.height - yOffsetPx) / sliceHeightPx) * usableHeight;
      }

      const currentSlicePdfWidth = Math.min(finalImgWidth, usableWidth);

      pdf.addImage(pageImgData, 'PNG', PADDING + (usableWidth - currentSlicePdfWidth) / 2, PADDING, currentSlicePdfWidth, currentSlicePdfHeight);
      yOffsetPx += sliceHeightPx;
      pageNum++;
      if (pageNum > 20) {
          console.warn("PDF Generation: Exceeded 20 pages, stopping.");
          break;
      }
    }

    const safeFileName = `Rapport_${participantRef.prenom}_${participantRef.nom}_${nomSession}.pdf`.replace(/[^a-zA-Z0-9_.-]/g, '_');
    pdf.save(safeFileName);

    setIsGeneratingPdf(false);
  };

  if (detailedParticipation) {
    const { participantRef, participantScore, participantSuccess, themeScores, questionsForDisplay } = detailedParticipation;

    const questionsByTheme: { [themeName: string]: EnrichedQuestionForParticipantReport[] } = {};
    if (questionsForDisplay) {
      questionsForDisplay.forEach(q => {
        const theme = q.resolvedThemeName || 'Thème non spécifié';
        if (!questionsByTheme[theme]) questionsByTheme[theme] = [];
        questionsByTheme[theme].push(q);
      });
    }

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
        </div>
        <h2 className="text-2xl font-bold mb-1">Détail de la participation</h2>
        <p className="text-lg mb-1">Participant : <span className="font-semibold">{participantRef.prenom} {participantRef.nom}</span></p>
        <p className="text-md mb-1">Session : <span className="font-semibold">{detailedParticipation.nomSession}</span> ({new Date(detailedParticipation.dateSession).toLocaleDateString('fr-FR')})</p>
        <p className="text-md mb-4">Référentiel : <Badge variant="default">{referentialCodeMap.get(detailedParticipation.referentielId) || 'N/A'}</Badge></p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-2">Performance Globale</h3>
            <p className={participantSuccess ? 'text-green-600 font-bold text-2xl' : 'text-red-600 font-bold text-2xl'}>
              {participantScore !== undefined ? `${participantScore.toFixed(0)} / 100` : 'N/A'}
            </p>
            {participantSuccess !== undefined ? (
              participantSuccess ? <Badge variant="success">Réussi</Badge> : <Badge variant="danger">Ajourné</Badge>
            ) : <Badge variant="warning">En attente</Badge>}
          </Card>
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-2">Scores par Thème</h3>
            {themeScores && Object.entries(themeScores).length > 0 ? (
              Object.entries(themeScores).map(([themeName, themeScoreDetail]) => (
              <div key={themeName} className="mb-1 text-sm">
                <span className={themeScoreDetail.score < 50 ? 'text-red-500 font-semibold' : 'text-gray-700 font-semibold'}>
                  {themeName}: </span> {themeScoreDetail.score.toFixed(0)}% ({themeScoreDetail.correct}/{themeScoreDetail.total})
              </div>
            ))
            ) : (<p className="text-sm text-gray-500">Scores par thème non disponibles.</p>)}
          </Card>
        </div>

        <div>
        <h3 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">Détail des Questions par Thème</h3>
        {Object.entries(questionsByTheme).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
              {Object.entries(questionsByTheme).map(([themeName, questions]) => (
                <div key={themeName} className="mb-4 pt-2">
                  <h4 className="text-md font-semibold text-gray-700 mb-3 pb-1 border-b border-gray-300">
                    {themeName}
                  </h4>
                  {questions.map((q, qIndex) => (
                    <div key={q.id || `q-${qIndex}`} className="text-sm mb-4 pb-3 border-b border-gray-200 last:border-b-0 last:pb-0 last:mb-0">
                      <p className="flex items-start font-medium text-gray-900 mb-1">
                        <HelpCircle size={16} className="mr-2 text-blue-600 flex-shrink-0 mt-0.5" />
                        <span>{q.text}</span>
                      </p>
                      <div className="pl-6 space-y-0.5">
                        <p>Votre réponse : <span className="font-semibold">{q.participantAnswer || 'Non répondu'}</span></p>
                        {q.isCorrectAnswer === false && q.participantAnswer !== undefined && (
                          <p className="text-orange-600">Bonne réponse : <span className="font-semibold">{q.correctAnswer}</span></p>
                        )}
                         <p className="flex items-center">
                            Points : <span className="font-semibold ml-1">{q.pointsObtainedForAnswer !== undefined ? q.pointsObtainedForAnswer : (q.isCorrectAnswer ? 1 : 0)}</span>
                            {q.isCorrectAnswer === true && <CheckCircle size={15} className="ml-2 text-green-500" />}
                            {q.isCorrectAnswer === false && q.participantAnswer !== undefined && <XCircle size={15} className="ml-2 text-red-500" />}
                          </p>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (<p className="mt-4 text-sm text-gray-500">Détail des questions non disponible.</p>)}
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
