import React, { useRef, useEffect, useState, useMemo } from 'react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { UserCheck, Calendar, Download, MapPin, User, BookOpen, Bookmark } from 'lucide-react';
import { Session, Participant, SessionResult, QuestionWithId, Theme, Bloc, VotingDevice, ThemeScoreDetails } from '@common/types';
import Button from '../ui/Button';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { StorageManager } from '../../services/StorageManager';
import {
  calculateParticipantScore,
  calculateThemeScores,
  determineIndividualSuccess,
  calculateNumericBlockPerformanceForSession,
  NumericBlockPerformanceStats
} from '../../utils/reportCalculators';

interface ParticipantCalculatedData extends Participant {
  score?: number;
  reussite?: boolean;
  idBoitier?: string;
  themeScores?: ThemeScoreDetails[];
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
  const [lastSavedFilePath, setLastSavedFilePath] = useState<string | null>(null);

  const participants = session.participants || [];

  const deviceMap = useMemo(() => {
    return new Map(votingDevices.map(device => [device.id, device.serialNumber]));
  }, [votingDevices]);

  const effectiveSelectedBlocIds = useMemo(() => {
    // Priorité à la sélection de la session si elle existe
    if (session.selectedBlocIds && session.selectedBlocIds.length > 0) {
      return session.selectedBlocIds;
    }
    // Sinon, dériver des questions réellement présentes dans les résultats
    if (questionsForThisSession.length > 0) {
      const blocIds = new Set(questionsForThisSession.map(q => q.blocId).filter((id): id is number => id !== undefined && id !== null));
      return Array.from(blocIds);
    }
    return [];
  }, [session.selectedBlocIds, questionsForThisSession]);


  // Effet 1: Charger les données de base (non dépendantes de la session)
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

  // Effet 2: Charger les données spécifiques à la session et enrichir les questions
  useEffect(() => {
    const fetchSessionData = async () => {
      if (!session.id || allThemesDb.length === 0 || allBlocsDb.length === 0) {
        // Ne pas continuer si les données de base ne sont pas prêtes ou si la session n'a pas d'ID
        return;
      }

      // Charger les détails spécifiques comme le formateur et le référentiel
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

      // Charger les résultats de la session
      const results = await StorageManager.getResultsForSession(session.id);
      setSessionResults(results);

      if (results && results.length > 0) {
        const questionIds = [...new Set(results.map(r => r.questionId))];
        if (questionIds.length > 0) {
          const baseQuestions = await StorageManager.getQuestionsByIds(questionIds);

          // Enrichissement des questions - maintenant que allBlocsDb et allThemesDb sont garantis d'être là
          const enrichedQuestions = baseQuestions.map(question => {
            let resolvedThemeName = 'Thème non spécifié';
            let resolvedThemeCode = 'N/A';
            if (question.blocId) {
              const bloc = allBlocsDb.find(b => b.id === question.blocId);
              if (bloc && bloc.theme_id) {
                const theme = allThemesDb.find(t => t.id === bloc.theme_id);
                if (theme) {
                  resolvedThemeName = theme.nom_complet;
                  resolvedThemeCode = theme.code_theme;
                }
              }
            }
            return { ...question, resolvedThemeName, resolvedThemeCode };
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
  }, [session.id, session.trainerId, session.referentielId, allThemesDb, allBlocsDb]); // Dépend de la session et des données de base

  // Effet 3: Calculer les statistiques des blocs une fois que tout est prêt
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
      setBlockStats(calculatedBlockStats.sort((a,b) => a.themeName.localeCompare(b.themeName) || a.blocCode.localeCompare(b.blocCode)));
    } else {
      setBlockStats([]);
    }
  }, [session, effectiveSelectedBlocIds, sessionResults, questionsForThisSession, deviceMap, allThemesDb, allBlocsDb]);

  const participantCalculatedData: ParticipantCalculatedData[] = useMemo(() => {
    return participants.map(p => {
      const participantResults = p.id
        ? sessionResults.filter(r => r.participantId === p.id)
        : [];

      const score = calculateParticipantScore(participantResults, questionsForThisSession);
      const themeScores = calculateThemeScores(participantResults, questionsForThisSession);
      const reussite = determineIndividualSuccess(score, themeScores);
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


  const handleExportPDF = async () => {
    if (reportRef.current) {
      const savePath = await StorageManager.getAdminSetting('reportSavePath');
      if (!savePath) {
        alert("Veuillez d'abord configurer le chemin de sauvegarde des rapports dans les Paramètres Techniques.");
        return;
      }
      setIsGeneratingPdf(true);
      setLastSavedFilePath(null);

      try {
        const logoSetting = await StorageManager.getAdminSetting('reportLogoBase64');
        const currentLogo = logoSetting?.value || null;

        const canvas = await html2canvas(reportRef.current, { scale: 1.5, useCORS: true });
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;
        const headerHeight = 30; // Increased header height for better spacing
        const footerHeight = 20;

        const contentWidth = pdfWidth - margin * 2;
        const contentHeight = (canvas.height * contentWidth) / canvas.width;
        const pageContentHeight = pdfHeight - headerHeight - footerHeight;
        const totalPages = Math.ceil(contentHeight / pageContentHeight);

        for (let i = 0; i < totalPages; i++) {
          if (i > 0) pdf.addPage();
          const y = -(pageContentHeight * i) + headerHeight;
          pdf.addImage(canvas, 'PNG', margin, y, contentWidth, contentHeight);

          if (currentLogo) {
            try {
              pdf.addImage(currentLogo, 'PNG', pdfWidth - margin - 25, margin, 20, 20);
            } catch (e) { console.error("Erreur d'ajout du logo au PDF:", e); }
          }
          pdf.setFontSize(18);
          pdf.text('Rapport de Session', pdfWidth / 2, margin + 12, { align: 'center' });
          pdf.setFontSize(10);
          pdf.setTextColor(150);
          pdf.text(`Page ${i + 1} / ${totalPages}`, pdfWidth / 2, pdfHeight - margin + 5, { align: 'center' });
          pdf.setDrawColor(150, 150, 150);
          pdf.rect(margin, pdfHeight - footerHeight, 80, 15);
          pdf.setTextColor(100);
          pdf.text('Signature du Formateur:', margin + 2, pdfHeight - footerHeight + 5);
        }

        const pdfBlob = pdf.output('blob');
        const pdfBuffer = await pdfBlob.arrayBuffer();
        const fileName = `rapport_session_${session.nomSession.replace(/[^a-zA-Z0-9_.-]/g, '_')}.pdf`;
        const result = await window.dbAPI?.saveReportFile?.(pdfBuffer, fileName);
        if (result?.success) {
          setLastSavedFilePath(result.filePath);
        } else {
          throw new Error(result?.error || 'Une erreur inconnue est survenue.');
        }
      } catch (error) {
        console.error("Erreur lors de l'export PDF:", error);
        alert(`Erreur lors de l'export PDF: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setIsGeneratingPdf(false);
      }
    }
  };

  const formatDate = (dateString: string | undefined | null): string => {
    if (!dateString) return 'Date non spécifiée';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Date invalide';
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  };

  const handleExportAllParticipantsPDF = async () => {
    if (!session || participantCalculatedData.length === 0) return;
    const savePath = await StorageManager.getAdminSetting('reportSavePath');
    if (!savePath) {
      alert("Veuillez d'abord configurer le chemin de sauvegarde des rapports dans les Paramètres Techniques.");
      return;
    }
    setIsGeneratingZip(true);
    setLastSavedFilePath(null);
    const zip = new JSZip();

    for (const participantData of participantCalculatedData) {
      const participantSpecificResults = participantData.id
        ? sessionResults.filter(r => String(r.participantId) === String(participantData.id))
        : [];
      const specificThemeScores = calculateThemeScores(participantSpecificResults, questionsForThisSession);

      let reportHtml = `
        <div style="font-family: Arial, sans-serif; margin: 10px; font-size: 9px;">
          <h1 style="font-size: 14px;">Rapport Session: ${session.nomSession}</h1>
          <p>Date: ${formatDate(session.dateSession)}</p>
          <p>Participant: ${participantData.nom} ${participantData.prenom}</p>
          <p>ID Boîtier: ${participantData.idBoitier || 'N/A'}</p>
          <p>Score Global: ${participantData.score !== undefined ? participantData.score.toFixed(0) : 'N/A'} / 100</p>
          <p>Mention: ${participantData.reussite ? 'Réussi' : 'Ajourné'}</p>
          <h2 style="font-size: 11px;">Scores par Thème:</h2><ul>`;
      if (specificThemeScores) {
        for (const themeScore of specificThemeScores) {
          reportHtml += `<li>${themeScore.themeCode} - ${themeScore.themeName}: ${themeScore.score.toFixed(0)}% (${themeScore.correct}/${themeScore.total})</li>`;
        }
      }
      reportHtml += `</ul>`;
      reportHtml += `<h2 style="font-size: 11px; margin-top: 10px;">Aperçu Questions:</h2>`;
      questionsForThisSession.slice(0, 5).forEach(q => {
        const pResult = participantSpecificResults.find(pr => pr.questionId === q.id);
        const questionEnriched = q as QuestionWithId & { resolvedThemeName?: string };
        reportHtml += `<div style="margin-left: 10px; font-size: 8px;">
          <p>Q: ${questionEnriched.text.substring(0,50)}... - Réponse: ${pResult?.answer || '-'} (${pResult?.isCorrect ? 'Correct' : 'Incorrect'})</p>
          <p>Thème: ${questionEnriched.resolvedThemeName || 'N/A'}</p>
        </div>`;
      });
      reportHtml += `</div>`;

      const element = document.createElement('div');
      element.style.width = '800px';
      element.innerHTML = reportHtml;
      document.body.appendChild(element);

      try {
        const canvas = await html2canvas(element, { scale: 2, useCORS: true });
        const pdf = new jsPDF('p', 'mm', 'a4');
        pdf.addImage(canvas, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight());
        const safeFileName = `Rapport_${session.nomSession}_${participantData.nom}_${participantData.prenom}.pdf`.replace(/[^a-zA-Z0-9_.-]/g, '_');
        zip.file(safeFileName, pdf.output('blob'));
      } catch (error) {
        console.error("Erreur PDF pour participant:", participantData, error);
      } finally {
        document.body.removeChild(element);
      }
    }

    try {
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipBuffer = await zipBlob.arrayBuffer();
      const fileName = `Rapports_Session_${session.nomSession.replace(/[^a-zA-Z0-9_.-]/g, '_')}.zip`;
      const result = await window.dbAPI?.saveReportZipFile?.(zipBuffer, fileName);
      if (result?.success) {
        setLastSavedFilePath(result.filePath);
      } else {
        throw new Error(result?.error || 'Une erreur inconnue est survenue.');
      }
    } catch (error) {
      console.error("Erreur ZIP:", error);
      alert(`Erreur lors de la génération du ZIP: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsGeneratingZip(false);
    }
  };

  return (
    <div>
      <div className="flex justify-end mb-4 space-x-2 items-center">
        {lastSavedFilePath && (
          <div className="text-sm text-green-600 mr-4">
            Fichier enregistré !{' '}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                window.dbAPI?.openFile(lastSavedFilePath);
              }}
              className="underline hover:text-green-800"
            >
              Ouvrir le fichier
            </a>
          </div>
        )}
        <Button
          onClick={handleExportAllParticipantsPDF}
          icon={<Download size={16}/>}
          disabled={isGeneratingZip || isGeneratingPdf}
        >
          {isGeneratingZip ? 'Génération ZIP...' : 'ZIP Participants'}
        </Button>
        <Button onClick={handleExportPDF} icon={<Download size={16}/>} disabled={isGeneratingZip || isGeneratingPdf}>
          {isGeneratingPdf ? 'Génération PDF...' : 'Exporter PDF'}
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

          {/* Colonne 2: Détails par thème */}
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
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organisation</th>
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
                          <div className="text-sm text-gray-700">{participantData.organization || '-'}</div>
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
                            {participantData.themeScores && participantData.themeScores.map(themeScore => (
                              <span key={themeScore.themeCode} className="font-medium">
                                {themeScore.themeCode}:
                                <span className="font-normal ml-1">{themeScore.correct}/{themeScore.total}</span>
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