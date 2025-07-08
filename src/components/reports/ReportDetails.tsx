import React, { useRef, useEffect, useState, useMemo } from 'react'; // Ajout de useMemo
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { UserCheck, Calendar, Download, Layers, MapPin, User, BookOpen, ListChecks } from 'lucide-react';
import { Session, Participant, SessionResult, QuestionWithId, QuestionMapping, Trainer, Referential, Theme, Bloc, VotingDevice } from '../../types'; // Ajout de VotingDevice
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
  getAllThemes, // Ajouté
  getAllBlocs // Ajouté
} from '../../db';
import {
  calculateParticipantScore,
  calculateThemeScores,
  determineIndividualSuccess,
  calculateBlockPerformanceForSession, // Gardé pour l'instant, mais sera remplacé/supprimé
  BlockPerformanceStats,
  calculateNumericBlockPerformanceForSession,
  NumericBlockPerformanceStats,
  ThemeScoreDetails // Importer ThemeScoreDetails
} from '../../utils/reportCalculators';

interface ParticipantCalculatedData extends Participant {
  score?: number;
  reussite?: boolean;
  idBoitier?: string; // Le serialNumber du boîtier
  themeScores?: { [theme: string]: ThemeScoreDetails }; // Ajouté pour la cohérence
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
  const [referentialCode, setReferentialCode] = useState<string>('N/A'); // Stocker uniquement le code
  const [themeNames, setThemeNames] = useState<string[]>([]);
  const [votingDevices, setVotingDevices] = useState<VotingDevice[]>([]);
  const [allThemesDb, setAllThemesDb] = useState<Theme[]>([]);
  const [allBlocsDb, setAllBlocsDb] = useState<Bloc[]>([]);

  // Utiliser session.participants directement
  const participants = session.participants || [];

  const deviceMap = useMemo(() => {
    return new Map(votingDevices.map(device => [device.id, device.serialNumber]));
  }, [votingDevices]);

  useEffect(() => {
    const fetchData = async () => {
      if (session.id) {
        // Charger tous les boîtiers de vote
        const allVotingDevicesData = await getAllVotingDevices();
        setVotingDevices(allVotingDevicesData);

        // Charger tous les thèmes et blocs de la DB
        const allThemesData = await getAllThemes();
        setAllThemesDb(allThemesData);
        const allBlocsData = await getAllBlocs();
        setAllBlocsDb(allBlocsData);

        // Récupérer le nom du formateur
        if (session.trainerId) {
          const trainer = await getTrainerById(session.trainerId);
          if (trainer) setTrainerName(trainer.name);
        }

        // Récupérer le nom du référentiel
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

        // Récupérer les noms des thèmes
        if (session.selectedBlocIds && session.selectedBlocIds.length > 0) {
          const uniqueThemeIds = new Set<number>();
          for (const blocId of session.selectedBlocIds) {
            const bloc = await getBlocById(blocId);
            if (bloc && bloc.theme_id) {
              uniqueThemeIds.add(bloc.theme_id);
            }
          }
          const fetchedThemeNames = [];
          for (const themeId of uniqueThemeIds) {
            const theme = await getThemeById(themeId);
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
            // Enrichir les questions avec le nom du thème résolu
            const enrichedQuestions = await Promise.all(
              baseQuestions.map(async (question) => {
                let resolvedThemeName = 'Thème non spécifié';
                if (question.blocId) {
                  const bloc = await getBlocById(question.blocId);
                  if (bloc && bloc.theme_id) {
                    const theme = await getThemeById(bloc.theme_id);
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
  }, [session]); // Ajout de getBlocById et getThemeById aux dépendances si elles changent, mais elles sont stables.

  useEffect(() => {
    // Calculer les stats par bloc une fois que session, sessionResults, questionsForThisSession, deviceMap, allThemesDb et allBlocsDb sont disponibles
    if (
      session &&
      session.selectedBlocIds &&
      sessionResults.length > 0 && // ou session.participants.length > 0 si on veut afficher même sans résultats
      questionsForThisSession.length > 0 && // Nécessaire pour filtrer les questions du bloc
      deviceMap.size > 0 && // S'assurer que deviceMap est prête
      allThemesDb.length > 0 && // S'assurer que les thèmes sont chargés
      allBlocsDb.length > 0 // S'assurer que les blocs sont chargés
    ) {
      const calculatedBlockStats: NumericBlockPerformanceStats[] = [];
      console.log('[ReportDetails] Calculating NumericBlockPerformance for selectedBlocIds:', session.selectedBlocIds);

      session.selectedBlocIds.forEach(blocId => {
        if (blocId === undefined || blocId === null) return; // Skip si un ID de bloc est invalide

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
        } else {
          console.log(`[ReportDetails] No stats returned for numeric blocId ${blocId}`);
        }
      });
      setBlockStats(calculatedBlockStats.sort((a,b) => a.themeName.localeCompare(b.themeName) || a.blocCode.localeCompare(b.blocCode)));
    } else {
      // Log pour déboguer pourquoi on n'entre pas dans le calcul
      // console.log('[ReportDetails] Skipping blockStats calculation due to missing data:', {
      //   hasSession: !!session,
      //   hasSelectedBlocIds: !!session?.selectedBlocIds?.length,
      //   hasSessionResults: sessionResults.length > 0,
      //   hasQuestions: questionsForThisSession.length > 0,
      //   hasDeviceMap: deviceMap.size > 0,
      //   hasAllThemesDb: allThemesDb.length > 0,
      //   hasAllBlocsDb: allBlocsDb.length > 0,
      // });
      setBlockStats([]);
    }
  }, [session, sessionResults, questionsForThisSession, deviceMap, allThemesDb, allBlocsDb]); // Ajout de deviceMap, allThemesDb, allBlocsDb aux dépendances


  const handleExportPDF = () => {
    if (reportRef.current) {
      html2canvas(reportRef.current).then((canvas: HTMLCanvasElement) => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`rapport_${session.nomSession}.pdf`);
      });
    }
  };

  const formatDate = (dateString: string | undefined | null): string => {
    if (!dateString) return 'Date non spécifiée';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Date invalide';
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  };

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
        themeScores // Stocker pour une utilisation potentielle future (ex: PDF détaillé depuis ici)
      };
    });
  }, [participants, sessionResults, questionsForThisSession, deviceMap]);

  const passedCount = participantCalculatedData.filter(p => p.reussite).length;
  const passRate = participants.length > 0 ? (passedCount / participants.length) * 100 : 0;
  const averageScoreOverall = participants.length > 0
    ? participantCalculatedData.reduce((sum, p) => sum + (p.score || 0), 0) / participants.length
    : 0;


  // La section pour questionSuccessRates est supprimée et remplacée par blockStats plus bas

  const [isGeneratingZip, setIsGeneratingZip] = useState(false);

  // Fonction pour générer le PDF d'un participant
  // (Contenu HTML et style très simplifiés pour cette étape)
  const generateParticipantPDF = async (
    participant: Participant & { score?: number; reussite?: boolean },
    currentSession: Session,
    questionsForSession: QuestionWithId[], // questions déjà enrichies avec resolvedThemeName
    sessionTrainerName: string,
    sessionReferentialName: string
  ): Promise<{ filename: string; data: Blob }> => {
    const { nom, prenom, score, reussite } = participant;
    const safeScore = score !== undefined ? score.toFixed(0) : 'N/A';
    const mention = reussite ? 'Réussi' : 'Ajourné';

    // Récupérer les résultats et scores par thème pour ce participant
    const participantResults = sessionResults.filter(r => r.participantIdBoitier === participant.idBoitier);
    const themeScores = calculateThemeScores(participantResults, questionsForSession as any); // Cast car QuestionWithId[] attendu par le type, mais on passe des enrichies

    let reportHtml = `
      <div style="font-family: Arial, sans-serif; margin: 20px; font-size: 10px;">
        <h1 style="font-size: 16px; text-align: center;">Rapport Individuel</h1>
        <p><strong>Session :</strong> ${currentSession.nomSession}</p>
        <p><strong>Date :</strong> ${formatDate(currentSession.dateSession)}</p>
        <p><strong>Lieu :</strong> ${currentSession.location || 'N/A'}</p>
        <p><strong>Formateur :</strong> ${sessionTrainerName}</p>
        <p><strong>Référentiel :</strong> ${sessionReferentialName}</p>
        <hr />
        <h2 style="font-size: 14px;">Participant : ${prenom} ${nom}</h2>
        <p><strong>Score Global :</strong> ${safeScore} / 100</p>
        <p><strong>Mention :</strong> ${mention}</p>
        <h3 style="font-size: 12px;">Scores par Thème :</h3>
        <ul>
    `;
    for (const theme in themeScores) {
      reportHtml += `<li>${theme}: ${themeScores[theme].toFixed(0)} / 100</li>`;
    }
    reportHtml += `</ul>`;

    // Ajout simplifié des questions/réponses (sans détails pour l'instant pour garder la fonction gérable)
    reportHtml += `<h3 style="font-size: 12px; margin-top: 15px;">Détail des Réponses (simplifié) :</h3>`;
    questionsForSession.forEach(q => {
      const result = participantResults.find(r => r.questionId === q.id);
      reportHtml += `
        <div style="margin-bottom: 5px; padding-bottom: 5px; border-bottom: 1px solid #eee;">
          <p style="margin: 2px 0;"><strong>Thème :</strong> ${q.resolvedThemeName || 'N/A'}</p>
          <p style="margin: 2px 0;"><strong>Question :</strong> ${q.text}</p>
          <p style="margin: 2px 0;"><strong>Réponse donnée :</strong> ${result ? result.answer : 'Non répondu'}</p>
          <p style="margin: 2px 0;"><strong>Correction :</strong> ${q.correctAnswer}</p>
          <p style="margin: 2px 0;"><strong>Points :</strong> ${result && result.isCorrect ? (result.pointsObtained || 1) : 0}</p>
        </div>
      `;
    });

    reportHtml += `</div>`;

    const element = document.createElement('div');
    element.innerHTML = reportHtml;
    document.body.appendChild(element); // Nécessaire pour html2canvas pour calculer les styles

    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 10, 10, pdfWidth - 20, pdfHeight - 20); // Marges de 10mm

    document.body.removeChild(element); // Nettoyage

    return {
      filename: `Rapport_${currentSession.nomSession}_${prenom}_${nom}.pdf`.replace(/[^a-zA-Z0-9_.-]/g, '_'),
      data: pdf.output('blob')
    };
  };

  const handleExportAllParticipantsPDF = async () => {
    if (!session || participantCalculatedData.length === 0) return;
    setIsGeneratingZip(true);
    const zip = new JSZip();

    for (const participant of participantCalculatedData) {
      // On s'assure que participantCalculatedData contient bien les infos de Participant (idBoitier etc.)
      // et les infos calculées (score, reussite).
      // Le type de participant dans participantCalculatedData est déjà Participant & { score, reussite }
      try {
      // referentialCode est déjà juste le code ou 'N/A'
        const pdfData = await generateParticipantPDF(
          participant,
          session,
          questionsForThisSession as (QuestionWithId & { resolvedThemeName?: string })[], // Cast pour correspondre
          trainerName,
        referentialCode
        );
        zip.file(pdfData.filename, pdfData.data);
      } catch (error) {
        console.error(`Erreur lors de la génération du PDF pour ${participant.nom} ${participant.prenom}:`, error);
        // On pourrait ajouter une notification à l'utilisateur ici
      }
    }

    try {
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `Rapports_Session_${session.nomSession.replace(/[^a-zA-Z0-9_.-]/g, '_')}.zip`);
    } catch (error) {
      console.error("Erreur lors de la génération du fichier ZIP:", error);
    } finally {
      setIsGeneratingZip(false);
    }
  };

  // console.log('[ReportDetails] Final referentialInfo before render:', referentialInfo); // Remplacé par referentialCode
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
          {/* Ajout de md:items-start pour que les colonnes de la grille déterminent leur propre hauteur */}
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
                  <div className="flex items-start text-sm"> {/* items-start pour alignement multiligne */}
                    <ListChecks size={18} className="text-gray-400 mr-2 mt-0.5" />
                    <span className="flex-1">Thèmes abordés : {themeNames.join(', ')}</span>
                  </div>
                )}
                <div className="flex items-center text-sm">
                  <UserCheck size={18} className="text-gray-400 mr-2" />
                  <span>Participants : {session.participants?.length || 0}</span>
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
          <div className="overflow-hidden">
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
                      {/* participantData est l'objet Participant enrichi, donc on accède directement à nom/prenom */}
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
            {blockStats.length > 0 && (
              <div className="mt-4 bg-blue-50 p-3 rounded-lg">
                  <p className="text-xs text-blue-700">
                  <strong>Note :</strong> Le "Taux de réussite du bloc" indique le pourcentage de participants ayant obtenu au moins 50% de bonnes réponses aux questions de ce bloc spécifique.
                  Par exemple, pour un bloc de {blockStats[0].questionsInBlockCount} questions, il faut au moins {Math.ceil(blockStats[0].questionsInBlockCount * 0.5)} bonnes réponses.
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