import React, { useRef, useEffect, useState, useMemo } from 'react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { UserCheck, Calendar, Download, MapPin, User, BookOpen, Bookmark } from 'lucide-react';
import { Session, Participant, SessionResult, QuestionWithId, Theme, Bloc, VotingDevice, ThemeScoreDetails } from '@common/types';
import Button from '../ui/Button';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JSZip from 'jszip';
import { StorageManager } from '../../services/StorageManager';
import {
  calculateParticipantScore,
  calculateThemeScores,
  determineIndividualSuccess,
  calculateNumericBlockPerformanceForSession,
  NumericBlockPerformanceStats
} from '../../utils/reportCalculators';

// Déclaration pour étendre le type jsPDF avec lastAutoTable
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: {
      finalY: number;
      rows: { y: number; height: number }[];
    } | undefined;
  }
}

interface ParticipantCalculatedData extends Participant {
  score?: number;
  reussite?: boolean;
  idBoitier?: string;
  themeScores?: { [themeName: string]: ThemeScoreDetails };
}

interface BlockData {
  questions: EnrichedQuestionForParticipantReport[];
  score: number;
  correct: number;
  total: number;
}

interface ThemeData {
  themeId: number;
  score: number;
  blocks: { [blockKey: string]: BlockData };
}

interface StructuredReportData {
  [themeName: string]: ThemeData;
}

interface EnrichedQuestionForParticipantReport extends QuestionWithId {
  resolvedThemeName?: string;
  resolvedBlocCode?: string;
  participantAnswer?: string;
  pointsObtainedForAnswer?: number;
  isCorrectAnswer?: boolean;
}

type ReportDetailsProps = {
  session: Session;
};

const ReportDetails: React.FC<ReportDetailsProps> = ({ session }) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [sessionResults, setSessionResults] = useState<SessionResult[]>([]);
  const [questionsForThisSession, setQuestionsForThisSession] = useState<(QuestionWithId & { resolvedThemeName?: string })[]>([]);
  const [blockStats, setBlockStats] = useState<NumericBlockPerformanceStats[]>([]);
  const [trainerName, setTrainerName] = useState<string>('N/A');
  const [referentialCode, setReferentialCode] = useState<string>('N/A');
  const [votingDevices, setVotingDevices] = useState<VotingDevice[]>([]);
  const [allThemesDb, setAllThemesDb] = useState<Theme[]>([]);
  const [allBlocsDb, setAllBlocsDb] = useState<Bloc[]>([]);
  const [isGeneratingZip, setIsGeneratingZip] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [lastZipPath, setLastZipPath] = useState<string | null>(null);
  const [lastPdfPath, setLastPdfPath] = useState<string | null>(null);

  const participants = session.participants || [];

  const deviceMap = useMemo(() => {
    return new Map(votingDevices.map(device => [device.id, device.serialNumber]));
  }, [votingDevices]);

  const effectiveSelectedBlocIds = useMemo(() => {
    if (session.selectedBlocIds && session.selectedBlocIds.length > 0) {
      return session.selectedBlocIds;
    }
    if (questionsForThisSession.length > 0) {
      const blocIds = new Set(questionsForThisSession.map(q => q.blocId).filter((id): id is number => id !== undefined && id !== null));
      return Array.from(blocIds);
    }
    return [];
  }, [session.selectedBlocIds, questionsForThisSession]);

  useEffect(() => {
    const fetchBaseData = async () => {
      try {
        const [themes, blocs, devices] = await Promise.all([
          StorageManager.getAllThemes(),
          StorageManager.getAllBlocs(),
          StorageManager.getAllVotingDevices()
        ]);
        setAllThemesDb(themes);
        setAllBlocsDb(blocs);
        setVotingDevices(devices);
      } catch (error) {
        console.error("Failed to load base data:", error);
      }
    };
    fetchBaseData();
  }, []);

  useEffect(() => {
    const fetchSessionData = async () => {
      if (!session.id || allThemesDb.length === 0 || allBlocsDb.length === 0) return;

      if (session.trainerId) {
        StorageManager.getTrainerById(session.trainerId).then(trainer => {
          if (trainer) setTrainerName(trainer.name);
        });
      }
      if (session.referentielId) {
        StorageManager.getReferentialById(session.referentielId).then(ref => {
          if (ref) setReferentialCode(ref.code);
        });
      }

      const results = await StorageManager.getResultsForSession(session.id);
      setSessionResults(results);

      if (results && results.length > 0) {
        const questionIds = [...new Set(results.map(r => r.questionId))];
        if (questionIds.length > 0) {
          const baseQuestions = await StorageManager.getQuestionsByIds(questionIds);
          const enrichedQuestions = baseQuestions.map(question => {
            let resolvedThemeName = 'Thème non spécifié';
            let resolvedBlocCode = 'N/A';
            let resolvedThemeCode = 'N/A';
            if (question.blocId) {
              const bloc = allBlocsDb.find(b => b.id === question.blocId);
              if (bloc) {
                resolvedBlocCode = bloc.code_bloc;
                if (bloc.theme_id) {
                  const theme = allThemesDb.find(t => t.id === bloc.theme_id);
                  if (theme) {
                    resolvedThemeName = theme.nom_complet;
                    resolvedThemeCode = theme.code_theme;
                  }
                }
              }
            }
            return { ...question, resolvedThemeName, resolvedBlocCode, resolvedThemeCode };
          });
          setQuestionsForThisSession(enrichedQuestions);
        } else {
          setQuestionsForThisSession([]);
        }
      } else {
        setQuestionsForThisSession([]);
      }
    };
    fetchSessionData();
  }, [session.id, session.trainerId, session.referentielId, allThemesDb, allBlocsDb]);

  useEffect(() => {
    if (
      session &&
      effectiveSelectedBlocIds.length > 0 &&
      sessionResults.length > 0 &&
      questionsForThisSession.length > 0 &&
      deviceMap.size > 0 &&
      allThemesDb.length > 0 &&
      allBlocsDb.length > 0
    ) {
      const calculatedBlockStats: NumericBlockPerformanceStats[] = [];
      effectiveSelectedBlocIds.forEach(blocId => {
        if (blocId === undefined || blocId === null) return;
        const stats = calculateNumericBlockPerformanceForSession(
          blocId,
          session,
          sessionResults,
          questionsForThisSession as (QuestionWithId & { resolvedThemeName?: string })[],
          deviceMap,
          allThemesDb,
          allBlocsDb
        );
        if (stats) {
          calculatedBlockStats.push(stats);
        }
      });
      setBlockStats(calculatedBlockStats.sort((a, b) => a.themeName.localeCompare(b.themeName) || a.blocCode.localeCompare(b.blocCode)));
    } else {
      setBlockStats([]);
    }
  }, [session, effectiveSelectedBlocIds, sessionResults, questionsForThisSession, deviceMap, allThemesDb, allBlocsDb]);

  const participantCalculatedData: ParticipantCalculatedData[] = useMemo(() => {
    return participants.map(p => {
      const participantResults = p.id
        ? sessionResults.filter(r => String(r.participantId) === String(p.id))
        : [];
      const score = calculateParticipantScore(participantResults, questionsForThisSession);
      const themeScores = calculateThemeScores(participantResults, questionsForThisSession);
      const reussite = determineIndividualSuccess(score, Object.values(themeScores));
      const deviceSerialNumber = p.assignedGlobalDeviceId ? deviceMap.get(p.assignedGlobalDeviceId) : undefined;

      return {
        ...p,
        score,
        reussite,
        idBoitier: deviceSerialNumber,
        themeScores
      };
    });
  }, [participants, sessionResults, questionsForThisSession, deviceMap]);

  const passedCount = participantCalculatedData.filter(p => p.reussite).length;
  const passRate = participants.length > 0 ? (passedCount / participants.length) * 100 : 0;
  const averageScoreOverall = participants.length > 0
    ? participantCalculatedData.reduce((sum, p) => sum + (p.score || 0), 0) / participants.length
    : 0;

  const formatDate = (dateString: string | undefined | null): string => {
    if (!dateString) return 'Date non spécifiée';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Date invalide';
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  };
  const generateSingleParticipantReport = async (participant: ParticipantCalculatedData) => {
  const doc = new jsPDF();
  const pageHeight = doc.internal.pageSize.height;
  const margin = 15;
  let y = 20;

  // --- Header ---
  doc.setFontSize(18);
  doc.setTextColor(33, 33, 33);
  doc.text("Rapport Individuel", doc.internal.pageSize.width / 2, y, { align: 'center' });
  y += 10;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, doc.internal.pageSize.width - margin, y);
  y += 10;

  // --- Details Section (Two Columns) ---
  const col1X = margin;
  const col2X = doc.internal.pageSize.width / 2 + 5;
  let yCol1 = y;
  let yCol2 = y;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text("Détails", col1X, yCol1);
  yCol1 += 6;
  doc.setFont('helvetica', 'normal');
  doc.text(`Participant : ${participant.prenom} ${participant.nom}`, col1X, yCol1);
  yCol1 += 5;
  doc.text(`ID Candidat : ${participant.identificationCode || 'N/A'}`, col1X, yCol1);
  yCol1 += 5;
  doc.text(`Organisation : ${participant.entreprise || 'N/A'}`, col1X, yCol1);
  yCol1 += 5;
  doc.text(`Session : ${session.nomSession}`, col1X, yCol1);
  yCol1 += 5;
  doc.text(`Référentiel : ${referentialCode}`, col1X, yCol1);
  yCol1 += 5;
  doc.text(`N° Session : ${session.num_session || 'N/A'}`, col1X, yCol1);
  yCol1 += 5;
  doc.text(`N° Stage : ${session.num_stage || 'N/A'}`, col1X, yCol1);
  yCol1 += 5;
  doc.text(`Date : ${formatDate(session.dateSession)}`, col1X, yCol1);
  yCol1 += 5;
  doc.text(`Formateur : ${trainerName}`, col1X, yCol1);
  yCol1 += 5;
  doc.text(`Lieu : ${session.location || 'N/A'}`, col1X, yCol1);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text("Scores par Thème", col2X, yCol2);
  yCol2 += 6;
  doc.setFont('helvetica', 'normal');

  const structuredReportData: StructuredReportData = {};
  questionsForThisSession.forEach(q => {
    const theme = allThemesDb.find(t => t.nom_complet === q.resolvedThemeName);
    if (!theme) return;

    const themeName = theme.nom_complet;
    if (!structuredReportData[themeName]) {
      structuredReportData[themeName] = {
        themeId: theme.id ?? 0,
        score: 0,
        blocks: {},
      };
    }

    const bloc = allBlocsDb.find(b => b.id === q.blocId);
    const blockKey = bloc ? `${bloc.code_bloc} (${q.version || 'N/A'})` : `Inconnu (${q.version || 'N/A'})`;
    const participantResult = sessionResults.find(r => r.participantId === participant.id && r.questionId === q.id);

    if (!structuredReportData[themeName].blocks[blockKey]) {
      structuredReportData[themeName].blocks[blockKey] = {
        questions: [],
        score: 0,
        correct: 0,
        total: 0,
      };
    }

    structuredReportData[themeName].blocks[blockKey].questions.push({
      ...q,
      participantAnswer: participantResult?.answer,
      isCorrectAnswer: participantResult?.isCorrect,
    });
  });

  for (const themeName in structuredReportData) {
    let totalThemeCorrect = 0;
    let totalThemeQuestions = 0;

    for (const blockKey in structuredReportData[themeName].blocks) {
      const block = structuredReportData[themeName].blocks[blockKey];
      block.total = block.questions.length;
      block.correct = block.questions.filter(q => q.isCorrectAnswer).length;
      block.score = block.total > 0 ? (block.correct / block.total) * 100 : 0;

      totalThemeCorrect += block.correct;
      totalThemeQuestions += block.total;
    }

    structuredReportData[themeName].score = totalThemeQuestions > 0 ? (totalThemeCorrect / totalThemeQuestions) * 100 : 0;
  }

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
  doc.setFillColor(participant.reussite ? 232 : 255, participant.reussite ? 245 : 235, participant.reussite ? 233 : 238);
  doc.rect(margin, y, doc.internal.pageSize.width - margin * 2, 18, 'F');
  y += 8;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(participant.reussite ? 46 : 198, participant.reussite ? 125 : 40, participant.reussite ? 50 : 40);
  doc.text(`Note Globale : ${participant.score !== undefined ? participant.score.toFixed(0) : 'N/A'} / 100`, doc.internal.pageSize.width / 2, y, { align: 'center' });
  y += 7;
  doc.setFontSize(12);
  doc.text(`Mention : ${participant.reussite ? 'RÉUSSI' : 'AJOURNÉ'}`, doc.internal.pageSize.width / 2, y, { align: 'center' });
  y += 10;

  // --- Questions Section ---
  y += 10;
  doc.setFontSize(14);
  doc.setTextColor(33, 33, 33);
  doc.setFont('helvetica', 'bold');
  doc.text("Détail des Questions", margin, y);
  y += 8;

  const sortedThemes = Object.entries(structuredReportData).sort(([_, a], [__, b]) => a.themeId - b.themeId);

  const columnCount = 3;
  const columnWidth = (doc.internal.pageSize.width - margin * (columnCount + 1)) / columnCount;
  const columnPositions = [
    margin,
    margin + columnWidth + margin,
    margin + 2 * (columnWidth + margin)
  ];

  function addTheme(themeName: string, themeData: ThemeData) {
    let columnY = [y, y, y];
    let questionIndex = 0;
    const allQuestions = Object.values(themeData.blocks).flatMap(block => block.questions);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(63, 81, 181);
    const themeTextLines = doc.splitTextToSize(themeName, columnWidth * 3);
    doc.text(themeTextLines, columnPositions[0], columnY[0]);
    columnY[0] += themeTextLines.length * 5;

    const blockKeys = Object.keys(themeData.blocks)[0];
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 100, 100);
    const blockTextLines = doc.splitTextToSize(blockKeys, columnWidth * 3);
    doc.text(blockTextLines, columnPositions[0], columnY[0]);
    columnY[0] += blockTextLines.length * 4;

    const headerHeight = columnY[0];
    columnY = [headerHeight, headerHeight, headerHeight];

    while (questionIndex < allQuestions.length) {
      const col = questionIndex % 3;

      if (columnY[col] > pageHeight - 20) {
        doc.addPage();
        columnY = [20, 20, 20];
      }

      const q = allQuestions[questionIndex];
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(33, 33, 33);
      const questionText = `Question ${q.id}`;
      const questionTextLines = doc.splitTextToSize(questionText, columnWidth);
      doc.text(questionTextLines, columnPositions[col], columnY[col]);
      columnY[col] += questionTextLines.length * 4;

      doc.setFont('helvetica', 'normal');
      const answerText = `Réponse : ${q.participantAnswer || 'Non répondu'}`;
      const statusText = q.isCorrectAnswer ? 'Correct' : 'Incorrect';
      const answerX = columnPositions[col] + 4;
      doc.text(answerText, answerX, columnY[col]);
      doc.setTextColor(q.isCorrectAnswer ? 46 : 198, q.isCorrectAnswer ? 125 : 40, q.isCorrectAnswer ? 50 : 40);
      doc.text(statusText, answerX + doc.getTextWidth(answerText) + 2, columnY[col]);
      columnY[col] += 6;

      questionIndex++;
    }

    const maxY = Math.max(...columnY);
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, maxY + 5, doc.internal.pageSize.width - margin, maxY + 5);
    y = maxY + 10;
  }

  sortedThemes.forEach(([themeName, themeData]) => {
    addTheme(themeName, themeData);
  });

  return doc.output('arraybuffer');
};

const generateAllParticipantsZip = async () => {
  if (!session || participantCalculatedData.length === 0) return;
  const savePath = await StorageManager.getAdminSetting('reportSavePath');
  if (!savePath) {
    alert("Veuillez d'abord configurer le chemin de sauvegarde des rapports dans les Paramètres Techniques.");
    return;
  }
  setIsGeneratingZip(true);
  setLastZipPath(null);

  const zip = new JSZip();

  for (const participant of participantCalculatedData) {
    const pdfBuffer = await generateSingleParticipantReport(participant);
    const safeFileName = `Rapport_${session.nomSession}_${participant.nom}_${participant.prenom}.pdf`.replace(/[^a-zA-Z0-9_.-]/g, '_');
    zip.file(safeFileName, pdfBuffer);
  }

  try {
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const zipBuffer = await zipBlob.arrayBuffer();
    const fileName = `Rapports_Session_${session.nomSession.replace(/[^a-zA-Z0-9_.-]/g, '_')}.zip`;
    const result = await window.dbAPI.saveReportZipFile(zipBuffer, fileName);
    if (result.success && result.filePath) {
      setLastZipPath(result.filePath);
    } else {
      throw new Error(result.error || 'Une erreur inconnue est survenue lors de la sauvegarde du ZIP.');
    }
  } catch (error) {
    console.error("Erreur lors de la génération ou sauvegarde du ZIP:", error);
    alert(`Erreur lors de la génération du ZIP: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    setIsGeneratingZip(false);
  }
};

const generateSessionReportPDF = async () => {
  setIsGeneratingPdf(true);
  setLastPdfPath(null);

  try {
    const doc = new jsPDF();
    const FONT_SIZES = { title: 18, subtitle: 12, body: 10, small: 8 };
    const COLORS = { blue: '#1A4F8B', red: '#FF6161', green: '#6BAF92', text: '#2D2D2D', lightText: '#505050' };
    const margin = 15;
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    // --- Header ---
    const logoSetting = await StorageManager.getAdminSetting('reportLogoBase64');
    if (logoSetting?.value) {
      try { doc.addImage(logoSetting.value, 'PNG', pageWidth - margin - 25, margin, 20, 20); }
      catch (e) { console.error("Error adding logo to PDF:", e); }
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FONT_SIZES.title);
    doc.setTextColor(COLORS.text);
    doc.text('Rapport de Session', pageWidth / 2, margin + 12, { align: 'center' });

    // --- Details Columns ---
    let y = margin + 35;
    doc.setFontSize(FONT_SIZES.subtitle);
    doc.setFont('helvetica', 'bold');
    doc.text('Détails', margin, y);
    y += 8;

    const details = [
      { label: 'Session', value: session.nomSession },
      { label: 'Date', value: formatDate(session.dateSession) },
      { label: 'Référentiel', value: referentialCode },
      { label: 'Formateur', value: trainerName },
      { label: 'Lieu', value: session.location || 'N/A' },
    ];

    details.forEach(detail => {
      const splitValue = doc.splitTextToSize(detail.value, pageWidth / 2 - margin - 40);
      doc.setFontSize(FONT_SIZES.body);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(COLORS.lightText);
      doc.text(`${detail.label}:`, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(COLORS.text);
      doc.text(splitValue, margin + 35, y);
      y += (splitValue.length * 5) + 2;
    });

    let yRight = margin + 35;
    doc.setFontSize(FONT_SIZES.subtitle);
    doc.setFont('helvetica', 'bold');
    doc.text('Questionnaire généré', pageWidth / 2 + 5, yRight);
    yRight += 8;

    const themesData = blockStats.map(bs => {
        const version = [...new Set(questionsForThisSession.filter(q => q.blocId === bs.blocId).map(q => q.version))][0] || 'N/A';
        const mainText = `${bs.themeName} - ${bs.blocCode}`;
        const detailText = `(Version ${version}, ${bs.questionsInBlockCount} questions)`;
        return { mainText, detailText };
    }).sort((a, b) => a.mainText.localeCompare(b.mainText));

    themesData.forEach(theme => {
        doc.setFontSize(FONT_SIZES.body);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(COLORS.text);
        const splitText = doc.splitTextToSize(theme.mainText, pageWidth / 2 - margin - 10);
        doc.text(splitText, pageWidth / 2 + 5, yRight);
        yRight += (splitText.length * 5);

        doc.setFontSize(FONT_SIZES.small);
        doc.setTextColor(COLORS.lightText);
        doc.text(theme.detailText, pageWidth / 2 + 5, yRight);
        yRight += 6;
    });

    y = Math.max(y, yRight) + 10;

    // --- Participants Table ---
    doc.setFontSize(FONT_SIZES.subtitle);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLORS.text);
    doc.text('Tableau des Participants', margin, y);
    y += 8;

    const body = participantCalculatedData.flatMap(p => {
      const mainRow = {
        participant: `${p.prenom} ${p.nom}`,
        company: p.entreprise || '-',
        score: p.score?.toFixed(0) || 'N/A',
        result: p.reussite ? 'Certifié' : 'Ajourné'
      };

      const scores = p.themeScores ? Object.values(p.themeScores) : [];
      const themeScoresContent = scores.length > 0
        ? scores.map(ts => ({
            text: `${ts.themeCode}: ${ts.correct}/${ts.total}`,
            color: (ts.correct / ts.total) < 0.5 ? COLORS.red : COLORS.green
          }))
        : [{ text: 'Scores non disponibles', color: COLORS.lightText }];

      const subRow = [{
        content: themeScoresContent,
        colSpan: 4,
        styles: {
          halign: 'left',
          cellPadding: { top: 2, right: 2, bottom: 2, left: margin + 5 },
          fontSize: FONT_SIZES.small,
        },
      }];
      return [mainRow, subRow];
    });

    autoTable(doc, {
      startY: y,
      head: [[
          { content: 'Participant', dataKey: 'participant' },
          { content: 'Entreprise', dataKey: 'company' },
          { content: 'Score Global', dataKey: 'score' },
          { content: 'Résultat', dataKey: 'result' },
      ]],
      body: body,
      theme: 'grid',
      styles: { fontSize: FONT_SIZES.body, cellPadding: 2, valign: 'middle', overflow: 'linebreak' },
      headStyles: { fillColor: COLORS.blue, textColor: '#FFFFFF', fontStyle: 'bold' },
      columnStyles: {
        participant: { cellWidth: 'auto' },
        company: { cellWidth: 'auto' },
        score: { cellWidth: 35, halign: 'center' },
        result: { cellWidth: 35, halign: 'center' },
      },
      willDrawCell: (data) => {
        if (data.section === 'body' && Array.isArray(data.row.raw) && (data.row.raw as any[])[0].hasOwnProperty('content')) {
            doc.setFillColor(245, 245, 245);
        }
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && Array.isArray(data.row.raw) && (data.row.raw as any[])[0].hasOwnProperty('content')) {
          const cellContent = (data.row.raw as any[])[0].content as { text: string, color: string }[];
          let x = data.cell.x + 2;
          const y = data.cell.y + data.cell.height / 2 + 1.5;

          cellContent.forEach(item => {
            doc.setFontSize(FONT_SIZES.small);
            doc.setTextColor(item.color);
            doc.text(item.text, x, y);
            x += doc.getTextWidth(item.text) + 4;
          });
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 10;

    // --- Footer ---
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(FONT_SIZES.small);
      doc.setTextColor(150);
      doc.text(`Page ${i} / ${totalPages}`, pageWidth / 2, pageHeight - margin, { align: 'center' });
      doc.setDrawColor(150, 150, 150);
      doc.rect(margin, pageHeight - 20, 80, 15);
      doc.setTextColor(100);
      doc.text('Signature du Formateur:', margin + 2, pageHeight - 15);
    }

    // --- Save PDF ---
    const pdfBuffer = doc.output('arraybuffer');
    const fileName = `rapport_session_${session.nomSession.replace(/[^a-zA-Z0-9_.-]/g, '_')}.pdf`;
    const result = await window.dbAPI.saveReportFile(pdfBuffer, fileName);
    if (result.success && result.filePath) {
      setLastPdfPath(result.filePath);
    } else {
      throw new Error(result.error || "Erreur inconnue lors de la sauvegarde du PDF.");
    }
  } catch (error) {
    console.error("Erreur lors de la génération ou sauvegarde du PDF:", error);
    alert(`Erreur lors de la génération du PDF: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    setIsGeneratingPdf(false);
  }
};

return (
  <div>
    <div className="flex justify-end mb-4 space-x-2 items-center">
        <div className="flex-grow">
            {lastZipPath && (
                <div className="text-sm text-green-600">
                    ZIP enregistré !{' '}
                    <a href="#" onClick={(e) => { e.preventDefault(); window.dbAPI?.openFile(lastZipPath); }} className="underline hover:text-green-800">
                        Ouvrir le ZIP
                    </a>
                </div>
            )}
            {lastPdfPath && (
                <div className="text-sm text-green-600 mt-1">
                    PDF enregistré !{' '}
                    <a href="#" onClick={(e) => { e.preventDefault(); window.dbAPI?.openFile(lastPdfPath); }} className="underline hover:text-green-800">
                        Ouvrir le PDF
                    </a>
                </div>
            )}
        </div>
      <Button
        onClick={generateAllParticipantsZip}
        icon={<Download size={16} />}
        disabled={isGeneratingZip}
      >
        {isGeneratingZip ? 'Génération ZIP...' : 'ZIP Participants'}
      </Button>
      <Button
        onClick={generateSessionReportPDF}
        icon={<Download size={16} />}
        disabled={isGeneratingZip || isGeneratingPdf}
      >
        {isGeneratingPdf ? 'Génération PDF...' : 'Exporter PDF Session'}
      </Button>
    </div>
    <div ref={reportRef} className="p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Colonne 1: Détails de la session */}
        <Card>
          <h3 className="text-xl font-semibold text-gray-900 mb-4 text-center">
            {session.nomSession}
          </h3>
          <div className="space-y-3 text-base">
            <div className="flex items-center">
              <Calendar size={18} className="text-gray-500 mr-3" />
              <span>Date : <strong>{formatDate(session.dateSession)}</strong></span>
            </div>
            <div className="flex items-center">
              <BookOpen size={18} className="text-gray-500 mr-3" />
              <span>Référentiel : <strong>{referentialCode}</strong></span>
            </div>
            <div className="flex items-center">
              <UserCheck size={18} className="text-gray-500 mr-3" />
              <span>Participants : <strong>{participants.length}</strong></span>
            </div>
            <div className="flex items-center">
              <User size={18} className="text-gray-500 mr-3" />
              <span>Formateur : <strong>{trainerName}</strong></span>
            </div>
            {session.location && (
              <div className="flex items-center">
                <MapPin size={18} className="text-gray-500 mr-3" />
                <span>Lieu : <strong>{session.location}</strong></span>
              </div>
            )}
            {session.num_stage && (
              <div className="flex items-center">
                <Bookmark size={18} className="text-gray-500 mr-3" />
                <span>N° Stage : <strong>{session.num_stage}</strong></span>
              </div>
            )}
            {session.num_session && (
              <div className="flex items-center">
                <Bookmark size={18} className="text-gray-500 mr-3" />
                <span>N° Session : <strong>{session.num_session}</strong></span>
              </div>
            )}
          </div>
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-around text-center">
              <div>
                <span className="text-sm text-gray-600">Taux de réussite</span>
                <p className="text-2xl font-bold text-gray-900">{passRate.toFixed(0)}%</p>
              </div>
              <div className="border-l border-gray-300 h-12 mx-2"></div>
              <div>
                <span className="text-sm text-gray-600">Score moyen</span>
                <p className="text-2xl font-bold text-gray-900">{averageScoreOverall.toFixed(0)}/100</p>
              </div>
              <div className="border-l border-gray-300 h-12 mx-2"></div>
              <div>
                <span className="text-sm text-gray-600">Certifiés</span>
                <p className="text-2xl font-bold text-green-600">{passedCount} / {participants.length}</p>
              </div>
            </div>
          </div>
        </Card>
        {blockStats.length > 0 && (
          <Card>
            <div className="space-y-4">
              {blockStats.sort((a, b) => a.blocCode.localeCompare(b.blocCode)).map(bs => {
                const questionsInBlock = questionsForThisSession.filter(q => q.blocId === bs.blocId);
                const versions = [...new Set(questionsInBlock.map(q => q.version))];
                const version = versions.length === 1 ? versions[0] : undefined;

                return (
                  <div key={bs.blocId} className="p-3 border border-gray-200 rounded-lg bg-gray-50">
                    <h4 className="text-sm font-semibold text-gray-800 mb-1">
                      Thème: <span className="font-normal">{bs.themeName}</span> - <span className="font-normal">{bs.blocCode}</span>
                      {version !== undefined && (
                        <span className="font-normal"> - Version: {version}</span>
                      )}
                      <span className="text-xs text-gray-500 ml-2">({bs.questionsInBlockCount} questions)</span>
                    </h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <div>
                        <span className="text-gray-500">Taux de réussite:</span>
                        <strong className="ml-1 text-gray-700">{bs.successRateOnBlock.toFixed(0)}%</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>

      <Card className="mb-6">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Participant</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entreprise</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code Identification</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score Global</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut Session</th>
              </tr>
            </thead>
<tbody className="bg-white">
  {participantCalculatedData.map((participantData, index) => {
    const rowStyle = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';
    return (
      <React.Fragment key={participantData.assignedGlobalDeviceId || `pd-${index}`}>
        <tr className={`${rowStyle} hover:bg-blue-50`}>
          <td className="px-6 py-4 whitespace-nowrap align-middle">
            <div className="text-sm font-medium text-gray-900">{participantData.nom} {participantData.prenom}</div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap align-middle">
            <div className="text-sm text-gray-700">{participantData.entreprise || '-'}</div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap align-middle">
            <div className="text-sm text-gray-700">{participantData.identificationCode || '-'}</div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap align-middle">
            <div className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 ${participantData.reussite ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {participantData.score !== undefined ? participantData.score.toFixed(0) : '-'}
              </div>
              <div className="w-24 bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${participantData.reussite ? 'bg-green-600' : 'bg-red-600'}`}
                  style={{ width: `${participantData.score || 0}%` }}
                ></div>
              </div>
            </div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap align-middle">
            {participantData.reussite === true && <Badge variant="success">Certifié</Badge>}
            {participantData.reussite === false && <Badge variant="danger">Ajourné</Badge>}
            {participantData.reussite === undefined && <Badge variant="default">-</Badge>}
          </td>
        </tr>
        <tr className={`${rowStyle} border-b-2 border-gray-300`}>
          <td colSpan={5} className="px-6 py-2">
            <div className="text-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-1 items-center">
              {participantData.themeScores && Object.values(participantData.themeScores).map(themeScore => (
                <span key={themeScore.themeCode} className="font-medium">
                  {themeScore.themeCode}: {themeScore.correct}/{themeScore.total}
                </span>
              ))}
            </div>
          </td>
        </tr>
      </React.Fragment>
    );
  })}
</tbody>
          </table>
        </div>
      </Card>
    </div>
  </div>
);
};

export default ReportDetails;