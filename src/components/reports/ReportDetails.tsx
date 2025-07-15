import React, { useRef, useEffect, useState, useMemo } from 'react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { UserCheck, Calendar, Download, Layers, MapPin, User, BookOpen, ListChecks } from 'lucide-react';
import { Session, Participant, SessionResult, QuestionWithId, Theme, Bloc, VotingDevice, ThemeScoreDetails } from '../../types';
import Button from '../ui/Button';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
  getResultsForSession,
  getQuestionsByIds,
  getTrainerById,
  getReferentialById,
  getThemeById,
  getBlocById,
  getAllVotingDevices,
  getAllThemes,
  getAllBlocs
} from '../../db';
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
  themeScores?: { [theme: string]: ThemeScoreDetails };
}

type ReportDetailsProps = {
  session: Session;
};

const ReportDetails: React.FC<ReportDetailsProps> = ({ session }) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [sessionResults, setSessionResults] = useState<SessionResult[]>([]);
  const [questionsForThisSession, setQuestionsForThisSession] = useState<QuestionWithId[]>([]);
  const [blockStats, setBlockStats] = useState<NumericBlockPerformanceStats[]>([]);
  const [trainerName, setTrainerName] = useState<string>('N/A');
  const [referentialCode, setReferentialCode] = useState<string>('N/A');
  const [themeNames, setThemeNames] = useState<string[]>([]);
  const [votingDevices, setVotingDevices] = useState<VotingDevice[]>([]);
  const [allThemesDb, setAllThemesDb] = useState<Theme[]>([]);
  const [allBlocsDb, setAllBlocsDb] = useState<Bloc[]>([]);
  const [isGeneratingZip, setIsGeneratingZip] = useState(false);

  const participants = session.participants || [];

  const deviceMap = useMemo(() => {
    return new Map(votingDevices.map(device => [device.id, device.serialNumber]));
  }, [votingDevices]);

  useEffect(() => {
    const fetchData = async () => {
      if (session.id) {
        const allVotingDevicesData = await getAllVotingDevices();
        setVotingDevices(allVotingDevicesData);

        const allThemesData = await getAllThemes();
        setAllThemesDb(allThemesData);
        const allBlocsData = await getAllBlocs();
        setAllBlocsDb(allBlocsData);

        if (session.trainerId) {
          const trainer = await getTrainerById(session.trainerId);
          if (trainer) setTrainerName(trainer.name);
        }

        if (session.referentielId) {
          const referential = await getReferentialById(session.referentielId);
          if (referential && referential.code) {
            setReferentialCode(referential.code);
          } else {
            setReferentialCode('N/A');
          }
        } else {
          setReferentialCode('N/A');
        }

        if (session.selectedBlocIds && session.selectedBlocIds.length > 0) {
          const uniqueThemeIds = new Set<number>();
          for (const blocId of session.selectedBlocIds) {
            const bloc = await getBlocById(blocId); // Assumes getBlocById is efficient or blocs are preloaded/cached
            if (bloc && bloc.theme_id) {
              uniqueThemeIds.add(bloc.theme_id);
            }
          }
          const fetchedThemeNames = [];
          for (const themeId of uniqueThemeIds) {
            const theme = await getThemeById(themeId); // Assumes getThemeById is efficient or themes are preloaded/cached
            if (theme) fetchedThemeNames.push(theme.nom_complet);
          }
          setThemeNames(fetchedThemeNames.sort());
        }

        const results = await getResultsForSession(session.id);
        setSessionResults(results);

        if (session.questionMappings && session.questionMappings.length > 0) {
          const questionIds = session.questionMappings
            .map(q => q.dbQuestionId)
            .filter((id): id is number => id !== null && id !== undefined);

          if (questionIds.length > 0) {
            const baseQuestions = await getQuestionsByIds(questionIds);
            const enrichedQuestions = await Promise.all(
              baseQuestions.map(async (question) => {
                let resolvedThemeName = 'Thème non spécifié';
                if (question.blocId) {
                  const bloc = allBlocsDb.find(b => b.id === question.blocId); // Use preloaded allBlocsDb
                  if (bloc && bloc.theme_id) {
                    const theme = allThemesDb.find(t => t.id === bloc.theme_id); // Use preloaded allThemesDb
                    if (theme) {
                      resolvedThemeName = theme.nom_complet;
                    }
                  }
                }
                return { ...question, resolvedThemeName };
              })
            );
            setQuestionsForThisSession(enrichedQuestions);
          } else {
            setQuestionsForThisSession([]);
          }
        } else {
          setQuestionsForThisSession([]);
        }
      } else {
        setSessionResults([]);
        setQuestionsForThisSession([]);
      }
    };
    fetchData();
  }, [session, allBlocsDb, allThemesDb]); // Added allBlocsDb and allThemesDb as they are used in enrichment

  useEffect(() => {
    if (
      session &&
      session.selectedBlocIds &&
      sessionResults.length > 0 &&
      questionsForThisSession.length > 0 &&
      deviceMap.size > 0 &&
      allThemesDb.length > 0 &&
      allBlocsDb.length > 0
    ) {
      const calculatedBlockStats: NumericBlockPerformanceStats[] = [];
      session.selectedBlocIds.forEach(blocId => {
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
  }, [session, sessionResults, questionsForThisSession, deviceMap, allThemesDb, allBlocsDb]);

  const participantCalculatedData: ParticipantCalculatedData[] = useMemo(() => {
    return participants.map(p => {
      const deviceSerialNumber = p.assignedGlobalDeviceId ? deviceMap.get(p.assignedGlobalDeviceId) : undefined;
      const participantResults = deviceSerialNumber
        ? sessionResults.filter(r => r.participantIdBoitier === deviceSerialNumber)
        : [];
      const score = calculateParticipantScore(participantResults, questionsForThisSession);
      const themeScores = calculateThemeScores(participantResults, questionsForThisSession as any);
      const reussite = determineIndividualSuccess(score, themeScores);
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

  const handleExportPDF = () => { // Export PDF de la session (vue actuelle)
    if (reportRef.current) {
      html2canvas(reportRef.current, { scale: 2, useCORS: true }).then((canvas: HTMLCanvasElement) => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfPageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const ratio = imgHeight / imgWidth;
        const newImgHeight = pdfWidth * ratio; // prefer-const
        // let position = 0; // Unused

        if (newImgHeight > pdfPageHeight) {
            const pageCount = Math.ceil(newImgHeight / pdfPageHeight); // prefer-const
            for (let i = 0; i < pageCount; i++) {
                if (i > 0) pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, -i * pdfPageHeight, pdfWidth, newImgHeight);
            }
        } else {
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, newImgHeight);
        }
        pdf.save(`rapport_session_${session.nomSession.replace(/[^a-zA-Z0-9_.-]/g, '_')}.pdf`);
      });
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
    setIsGeneratingZip(true);
    const zip = new JSZip();

    for (const participantData of participantCalculatedData) {
      const participantSpecificResults = sessionResults.filter(r => r.participantIdBoitier === participantData.idBoitier);
      const specificThemeScores = calculateThemeScores(participantSpecificResults, questionsForThisSession as any);

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
        for (const [themeName, details] of Object.entries(specificThemeScores)) {
          reportHtml += `<li>${themeName}: ${details.score.toFixed(0)}% (${details.correct}/${details.total})</li>`;
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
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfPageHeight = pdf.internal.pageSize.getHeight();
        const img = new Image();
        img.src = imgData;
        await new Promise<void>(r => { img.onload = () => r(); img.onerror = () => r(); });

        if (img.width > 0 && img.height > 0) {
            const ratio = img.height / img.width;
            const imgHeightInPdf = pdfWidth * ratio;
            if (imgHeightInPdf <= pdfPageHeight) {
                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeightInPdf);
            } else {
                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeightInPdf);
            }
        } else {
            console.error("Skipping PDF for participant due to image error:", participantData);
        }
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
      saveAs(zipBlob, `Rapports_Session_${session.nomSession.replace(/[^a-zA-Z0-9_.-]/g, '_')}.zip`);
    } catch (error) {
      console.error("Erreur ZIP:", error);
    } finally {
      setIsGeneratingZip(false);
    }
  };

  // console.log('[ReportDetails] Final referentialCode before render:', referentialCode); // Nettoyé

  return (
    <div>
      <div className="flex justify-end mb-4 space-x-2">
        <Button
          onClick={handleExportAllParticipantsPDF}
          icon={<Download size={16}/>}
          disabled={isGeneratingZip}
        >
          {isGeneratingZip ? 'Génération en cours...' : 'Télécharger Rapports Participants (ZIP)'}
        </Button>
        <Button onClick={handleExportPDF} icon={<Download size={16}/>}>Exporter Rapport Session (PDF)</Button>
      </div>
      <div ref={reportRef} className="p-4">
        <Card title="Résumé de la session" className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:items-start">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {session.nomSession}
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-center text-sm">
                  <Calendar size={18} className="text-gray-400 mr-2" />
                  <span>Date : {formatDate(session.dateSession)}</span>
                </div>
                <div className="flex items-center text-sm">
                  <BookOpen size={18} className="text-gray-400 mr-2" />
                  <span>Référentiel : {referentialCode}</span>
                </div>
                {themeNames.length > 0 && (
                  <div className="flex items-start text-sm">
                    <ListChecks size={18} className="text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="flex-1 min-w-0">Thèmes abordés : {themeNames.join(', ')}</span>
                  </div>
                )}
                <div className="flex items-center text-sm">
                  <UserCheck size={18} className="text-gray-400 mr-2" />
                  <span>Participants : {participants.length}</span>
                </div>
                <div className="flex items-center text-sm">
                  <User size={18} className="text-gray-400 mr-2" />
                  <span>Formateur : {trainerName}</span>
                </div>
                {session.location && (
                  <div className="flex items-center text-sm">
                    <MapPin size={18} className="text-gray-400 mr-2" />
                    <span>Lieu : {session.location}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-xl">
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                Statistiques de la session
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Taux de réussite</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {passRate.toFixed(0)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Score moyen</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {averageScoreOverall.toFixed(0)}/100
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Certifiés</p>
                  <p className="text-lg font-medium text-green-600">
                    {passedCount} / {participants.length}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Seuil de réussite</p>
                  <p className="text-lg font-medium text-gray-900">
                    70%
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
        
        <Card title="Résultats par participant" className="mb-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Participant</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score Global Session</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut Session</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {participantCalculatedData.map((participantData, index) => (
                  <tr key={participantData.assignedGlobalDeviceId || `pd-${index}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{participantData.nom} {participantData.prenom}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      {participantData.reussite === true && <Badge variant="success">Certifié</Badge>}
                      {participantData.reussite === false && <Badge variant="danger">Ajourné</Badge>}
                      {participantData.reussite === undefined && <Badge variant="default">-</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {blockStats.length > 0 && (
          <Card title="Performances par Bloc de Questions (utilisés dans cette session)" className="mb-6">
            <div className="flex items-center mb-3 text-gray-600">
                <Layers size={18} className="mr-2" />
                <h3 className="text-md font-semibold">
                Détail par bloc
                </h3>
            </div>
            <div className="space-y-4">
              {blockStats.map(bs => (
                <div key={bs.blocId} className="p-3 border border-gray-200 rounded-lg bg-gray-50">
                  <h4 className="text-sm font-semibold text-gray-800 mb-1">
                    Thème: <span className="font-normal">{bs.themeName}</span> - Bloc: <span className="font-normal">{bs.blocCode}</span>
                    <span className="text-xs text-gray-500 ml-2">({bs.questionsInBlockCount} questions)</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div>
                        <span className="text-gray-500">Score moyen sur bloc:</span>
                        <strong className="ml-1 text-gray-700">{bs.averageScoreOnBlock.toFixed(1)}%</strong>
                    </div>
                    <div>
                        <span className="text-gray-500">Taux de réussite du bloc:</span>
                        <strong className="ml-1 text-gray-700">{bs.successRateOnBlock.toFixed(0)}%</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {blockStats.length > 0 && ( // S'assurer que blockStats a au moins un élément pour l'indexation
              <div className="mt-4 bg-blue-50 p-3 rounded-lg">
                  <p className="text-xs text-blue-700">
                  <strong>Note :</strong> Le "Taux de réussite du bloc" indique le pourcentage de participants ayant obtenu au moins 50% de bonnes réponses aux questions de ce bloc spécifique.
                  {blockStats[0] && ` Par exemple, pour un bloc de ${blockStats[0].questionsInBlockCount} questions, il faut au moins ${Math.ceil(blockStats[0].questionsInBlockCount * 0.5)} bonnes réponses.`}
                  </p>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
};

export default ReportDetails;