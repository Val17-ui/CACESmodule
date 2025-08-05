import React, { useEffect } from 'react';
import Button from '../ui/Button';
import { Save, Trash2 } from 'lucide-react';
import {
  QuestionWithId as StoredQuestion,
  CACESReferential,
} from '@common/types';
import { StorageManager } from '../../services/StorageManager';
import { getActivePptxTemplateFile } from '../../utils/templateManager';
import AnomalyResolutionModal from './AnomalyResolutionModal';
import ResultsImporter from './form/ResultsImporter';
import QuestionnaireGenerator from './form/QuestionnaireGenerator';
import ParticipantManager from './form/ParticipantManager';
import SessionDetailsForm from './form/SessionDetailsForm';
import ReportDetails from '../reports/ReportDetails';
import { useSessionSaver } from './hooks/useSessionSaver';
import { useParticipantManager } from './hooks/useParticipantManager';
import { useSessionLoader } from './hooks/useSessionLoader';
import { useResultsImporter } from './hooks/useResultsImporter';
import { SessionProvider, useSessionContext } from './context/SessionContext';

interface SessionFormProps {
  sessionIdToLoad?: number;
  sessionToImport?: File | null;
}

type TabKey = 'details' | 'participants' | 'generateQuestionnaire' | 'importResults' | 'report';

interface AdminPPTXSettings {
    defaultDuration: number;
    pollTimeLimit: number;
    answersBulletStyle: string;
    pollStartMode: string;
    chartValueLabelFormat: string;
    pollCountdownStartMode: string;
    pollMultipleResponse: string;
}

const SessionFormContent: React.FC<SessionFormProps> = ({ sessionIdToLoad, sessionToImport }) => {
    const { state, dispatch } = useSessionContext();
    useParticipantManager({
        initialParticipants: state.participants,
        initialAssignments: state.participantAssignments,
        editingSessionData: state.editingSessionData,
        selectedKitIdState: state.selectedKitIdState,
        votingDevicesInSelectedKit: state.votingDevicesInSelectedKit,
      });

      const {
        importSummary: resultsImportSummary,
        handleImportResults,
        showAnomalyResolutionUI,
        detectedAnomalies,
        pendingValidResults,
        handleResolveAnomalies,
        handleCancelAnomalyResolution,
      } = useResultsImporter({
        editingSessionData: state.editingSessionData,
        setEditingSessionData: (session) => dispatch({ type: 'SET_FIELD', field: 'editingSessionData', payload: session }),
        hardwareDevices: state.hardwareDevices,
      });

      const { prepareSessionDataForDb, handleSaveSession } = useSessionSaver({
        initialState: state,
        setEditingSessionData: (session) => dispatch({ type: 'SET_FIELD', field: 'editingSessionData', payload: session }),
        setCurrentSessionDbId: (id) => dispatch({ type: 'SET_FIELD', field: 'currentSessionDbId', payload: id }),
        setImportSummary: (summary) => dispatch({ type: 'SET_FIELD', field: 'importSummary', payload: summary }),
        setModifiedAfterOrsGeneration: (modified) => dispatch({ type: 'SET_FIELD', field: 'modifiedAfterOrsGeneration', payload: modified }),
      });

      useSessionLoader({
        sessionIdToLoad,
        sessionToImport,
        dispatch,
        state,
      });

      useEffect(() => {
        const fetchDevicesInKit = async () => {
          if (state.selectedKitIdState !== null) {
            try {
              const devices = await StorageManager.getVotingDevicesForKit(state.selectedKitIdState);
              dispatch({ type: 'SET_FIELD', field: 'votingDevicesInSelectedKit', payload: devices });
            } catch (error) {
              console.error(`Erreur lors du chargement des boîtiers pour le kit ${state.selectedKitIdState}:`, error);
              dispatch({ type: 'SET_FIELD', field: 'votingDevicesInSelectedKit', payload: [] });
            }
          } else {
            dispatch({ type: 'SET_FIELD', field: 'votingDevicesInSelectedKit', payload: [] });
          }
        };
        fetchDevicesInKit();
      }, [state.selectedKitIdState, dispatch]);

      const handleGenerateQuestionnaireAndOrs = async (iterationIndex?: number) => {
        const refCodeToUse = state.selectedReferential || (state.editingSessionData?.referentielId ? state.referentielsData.find(r => r.id === state.editingSessionData?.referentielId)?.code : null);
        if (!refCodeToUse) {
          dispatch({ type: 'SET_FIELD', field: 'importSummary', payload: "Veuillez sélectionner un référentiel pour générer l'ORS." });
          return;
        }
        dispatch({ type: 'SET_FIELD', field: 'isGeneratingOrs', payload: true });
        dispatch({ type: 'SET_FIELD', field: 'importSummary', payload: "Sauvegarde de la session avant génération..." });
        let sessionDataPreORS = await prepareSessionDataForDb();
        if (!sessionDataPreORS) {
          dispatch({ type: 'SET_FIELD', field: 'importSummary', payload: "Erreur lors de la préparation des données de la session." });
          dispatch({ type: 'SET_FIELD', field: 'isGeneratingOrs', payload: false });
          return;
        }
        const currentSavedId = await handleSaveSession(sessionDataPreORS);
        if (!currentSavedId) {
          dispatch({ type: 'SET_FIELD', field: 'importSummary', payload: "Erreur lors de la sauvegarde de la session avant la génération." });
          dispatch({ type: 'SET_FIELD', field: 'isGeneratingOrs', payload: false });
          return;
        }
        let upToDateSessionData = await StorageManager.getSessionById(currentSavedId);
        if (!upToDateSessionData) {
            dispatch({ type: 'SET_FIELD', field: 'importSummary', payload: "Erreur lors du rechargement de la session après sauvegarde." });
            dispatch({ type: 'SET_FIELD', field: 'isGeneratingOrs', payload: false });
            return;
        }
        dispatch({ type: 'SET_FIELD', field: 'editingSessionData', payload: upToDateSessionData });

        try {
          let allSelectedQuestionsForPptx: StoredQuestion[] = [];
          const newlySelectedBlocIds: number[] = [];
          if (!upToDateSessionData.questionMappings || upToDateSessionData.questionMappings.length === 0) {
            const referentielObject = await StorageManager.getReferentialByCode(refCodeToUse as string);
            if (!referentielObject?.id) throw new Error(`Référentiel non trouvé: ${refCodeToUse}`);
            const themes = await StorageManager.getThemesByReferentialId(referentielObject.id);
            for (const theme of themes) {
              if (!theme.id) continue;
              const blocs = (await StorageManager.getBlocsByThemeId(theme.id)).filter(b => b.code_bloc.match(/_([A-E]|G\d+)$/i));
              if (blocs.length > 0) {
                const chosenBloc = blocs[Math.floor(Math.random() * blocs.length)];
                if (chosenBloc.id) {
                  newlySelectedBlocIds.push(chosenBloc.id);
                  const questions = await StorageManager.getQuestionsForBloc(chosenBloc.id);
                  allSelectedQuestionsForPptx.push(...questions);
                }
              }
            }
            if (newlySelectedBlocIds.length > 0) {
              dispatch({ type: 'SET_FIELD', field: 'selectedBlocIds', payload: newlySelectedBlocIds });
              await StorageManager.updateSession(currentSavedId, { selectedBlocIds: newlySelectedBlocIds });
              const reloadedSessionWithBlocks = await StorageManager.getSessionById(currentSavedId);
              if (!reloadedSessionWithBlocks) {
                throw new Error("Impossible de recharger la session après la sauvegarde des blocs.");
              }
              upToDateSessionData = reloadedSessionWithBlocks;
              dispatch({ type: 'SET_FIELD', field: 'editingSessionData', payload: reloadedSessionWithBlocks });
            }
            if (allSelectedQuestionsForPptx.length === 0) throw new Error("Aucune question sélectionnée.");
          } else {
            const questionIds = upToDateSessionData.questionMappings.map((q: any) => q.dbQuestionId).filter((id: number): id is number => id != null);
            allSelectedQuestionsForPptx = await StorageManager.getQuestionsByIds(questionIds);
          }

          const iterationsToGenerate = iterationIndex !== undefined ? [iterationIndex] : Array.from({ length: state.iterationCount }, (_, i) => i);
          for (const i of iterationsToGenerate) {
            const iterationName = state.iterationNames[i];
            const assignedParticipantIds = (state.participantAssignments[i] || []).map((p: { id: string; }) => p.id);
            const participantsForIteration = state.participants.filter(p => assignedParticipantIds.includes(p.uiId));
            const participantsForGenerator = participantsForIteration.map(p => {
              const device = state.hardwareDevices.find(hd => hd.id === p.assignedGlobalDeviceId);
              return { idBoitier: device?.serialNumber || '', nom: p.lastName, prenom: p.firstName, identificationCode: p.identificationCode };
            });

            const templateFile = await getActivePptxTemplateFile();
            const { orsBlob, questionMappings } = await window.dbAPI?.generatePresentation(
              { name: `${state.sessionName} - ${iterationName}`, date: state.sessionDate, referential: refCodeToUse as CACESReferential },
              participantsForGenerator, allSelectedQuestionsForPptx, templateFile, {} as AdminPPTXSettings
            );

            if (orsBlob) {
              if (i === 0 && (!upToDateSessionData.questionMappings || upToDateSessionData.questionMappings.length === 0)) {
                await StorageManager.updateSession(currentSavedId, { questionMappings: questionMappings });
              }

              const safeSessionName = (state.sessionName || 'Session').replace(/ /g, '_');
              const safeIterationName = (iterationName || 'Iteration').replace(/ /g, '_');
              const fileName = `${safeSessionName}_${safeIterationName}.ors`;
              const saveResult = await window.dbAPI?.savePptxFile(orsBlob, fileName);
              if (saveResult && saveResult.success) {
                const iterToUpdateRaw = upToDateSessionData.iterations?.find((it: any) => it.iteration_index === i);
                const { participants, ...iterToUpdate } = iterToUpdateRaw || { created_at: new Date().toISOString() };

                await StorageManager.addOrUpdateSessionIteration({
                  ...iterToUpdate,
                  session_id: currentSavedId,
                  iteration_index: i,
                  name: iterationName,
                  ors_file_path: saveResult.filePath,
                  status: 'ready',
                  question_mappings: questionMappings,
                });
                dispatch({ type: 'SET_FIELD', field: 'importSummary', payload: `Itération ${iterationName} générée.` });
              } else { throw new Error(`Sauvegarde échouée pour ${iterationName}: ${saveResult?.error}`); }
            }
          }
          const finalSessionData = await StorageManager.getSessionById(currentSavedId);
          dispatch({ type: 'SET_FIELD', field: 'editingSessionData', payload: finalSessionData || null });
        } catch (error: any) {
            dispatch({ type: 'SET_FIELD', field: 'importSummary', payload: `Erreur majeure génération: ${error.message}` });
        } finally {
            dispatch({ type: 'SET_FIELD', field: 'isGeneratingOrs', payload: false });
        }
      };

      const handleSaveDraft = async () => {
        const sessionData = await prepareSessionDataForDb(state.editingSessionData?.orsFilePath);
        if (sessionData) {
          const savedId = await handleSaveSession(sessionData);
          if (savedId) { dispatch({ type: 'SET_FIELD', field: 'importSummary', payload: `Session (ID: ${savedId}) sauvegardée avec succès !` }); }
        }
      };

      const handleCancelSession = async () => {
        if (window.confirm("Êtes-vous sûr de vouloir annuler cette session ? Cette action est irréversible.")) {
          if (state.currentSessionDbId) {
            try {
              await StorageManager.updateSession(state.currentSessionDbId, {
                status: 'cancelled',
                archived_at: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              });
              dispatch({ type: 'SET_FIELD', field: 'importSummary', payload: "Session annulée et archivée." });
            } catch (error) {
              console.error("Erreur lors de l'annulation de la session:", error);
              dispatch({ type: 'SET_FIELD', field: 'importSummary', payload: "Erreur lors de l'annulation de la session." });
            }
          } else {
            dispatch({ type: 'SET_FIELD', field: 'importSummary', payload: "Impossible d'annuler une session non sauvegardée." });
          }
        }
      };

      const renderTabNavigation = () => {
        const tabLabels: Record<TabKey, string> = {
            details: 'Détails Session',
            participants: 'Participants',
            generateQuestionnaire: 'Générer le questionnaire',
            importResults: 'Importer les résultats',
            report: 'Rapport',
        };

        const isReportTabVisible = state.editingSessionData?.status === 'completed';
        let tabsToShow: TabKey[] = ['details', 'participants', 'generateQuestionnaire', 'importResults'];
        if (isReportTabVisible) {
          tabsToShow.push('report');
        }

        return (
            <div className="mb-6">
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-4 sm:space-x-8" aria-label="Tabs">
                        {tabsToShow.map((tabKey) => (
                            <button
                                key={tabKey}
                                onClick={() => dispatch({ type: 'SET_FIELD', field: 'activeTab', payload: tabKey })}
                                className={`
                                    ${state.activeTab === tabKey ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                                    whitespace-nowrap py-3 px-2 sm:py-4 sm:px-3 border-b-2 font-medium text-sm
                                `}
                                aria-current={state.activeTab === tabKey ? 'page' : undefined}
                            >
                                {tabLabels[tabKey]}
                            </button>
                        ))}
                    </nav>
                </div>
            </div>
        );
      };

      const renderTabContent = () => {
        const isReadOnly = state.editingSessionData?.status === 'completed';

        switch (state.activeTab) {
          case 'details':
            return (
              <SessionDetailsForm
                isReadOnly={isReadOnly}
              />
            );
          case 'participants':
            return (
              <ParticipantManager
                isReadOnly={isReadOnly}
              />
            );
          case 'generateQuestionnaire':
            return (
              <QuestionnaireGenerator
                isReadOnly={isReadOnly}
                handleGenerateQuestionnaire={handleGenerateQuestionnaireAndOrs}
              />
            );
          case 'importResults':
            return (
              <ResultsImporter
                isReadOnly={isReadOnly}
                handleImportResults={handleImportResults}
                importSummary={resultsImportSummary || state.importSummary}
              />
            );
          case 'report':
            return state.editingSessionData ? <ReportDetails session={state.editingSessionData} /> : <div>Chargement du rapport...</div>;
          default:
            return null;
        }
      };

      return (
        <div>
            {renderTabNavigation()}
            {renderTabContent()}
          <div className="flex justify-between items-center mt-8 py-4 border-t border-gray-200">
            <div>
              <Button variant="outline" icon={<Save size={16} />} onClick={handleSaveDraft} disabled={state.editingSessionData?.status === 'completed' || state.isGeneratingOrs}>
                Enregistrer Brouillon
              </Button>
            </div>
            <Button variant="danger" icon={<Trash2 size={16} />} onClick={handleCancelSession} disabled={state.editingSessionData?.status === 'completed' || state.editingSessionData?.status === 'cancelled'}>
              Annuler la Session
            </Button>
          </div>
          {showAnomalyResolutionUI && detectedAnomalies && (
            <AnomalyResolutionModal
              isOpen={showAnomalyResolutionUI}
              detectedAnomalies={detectedAnomalies}
              pendingValidResults={pendingValidResults}
              onResolve={handleResolveAnomalies}
              onCancel={handleCancelAnomalyResolution}
            />
          )}
        </div>
      );
}

const SessionForm: React.FC<SessionFormProps> = (props) => (
    <SessionProvider>
        <SessionFormContent {...props} />
    </SessionProvider>
);

export default SessionForm;
