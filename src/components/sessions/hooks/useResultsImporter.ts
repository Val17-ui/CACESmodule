import { useState } from 'react';
import JSZip from 'jszip';
import {
  Session as DBSession,
  ExtractedResultFromXml,
  ExpectedIssueResolution,
  UnknownDeviceResolution,
  VotingDevice,
  DBParticipantType,
  SessionIteration,
} from '@common/types';
import { parseOmbeaResultsXml, transformParsedResponsesToSessionResults } from '../../../utils/resultsParser';
import { StorageManager } from '../../../services/StorageManager';
import { logger } from '../../../utils/logger';
import AnomalyResolutionModal, { DetectedAnomalies } from '../AnomalyResolutionModal';

interface UseResultsImporterProps {
  editingSessionData: DBSession | null;
  setEditingSessionData: (session: DBSession | null) => void;
  hardwareDevices: VotingDevice[];
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

export const useResultsImporter = ({
  editingSessionData,
  setEditingSessionData,
  hardwareDevices,
}: UseResultsImporterProps) => {
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [detectedAnomalies, setDetectedAnomalies] = useState<DetectedAnomalies | null>(null);
  const [pendingValidResults, setPendingValidResults] = useState<ExtractedResultFromXml[]>([]);
  const [showAnomalyResolutionUI, setShowAnomalyResolutionUI] = useState<boolean>(false);
  const [currentIterationForImport, setCurrentIterationForImport] = useState<number | null>(null);

  const handleImportResults = async (iterationIndex: number) => {
    if (!editingSessionData?.id) {
      setImportSummary("Aucune session active.");
      return;
    }

    const iteration = editingSessionData.iterations?.find(it => it.iteration_index === iterationIndex);
    if (!iteration?.id || !iteration.ors_file_path) {
      setImportSummary("Veuillez d'abord générer un fichier .ors pour cette itération.");
      return;
    }

    const currentQuestionMappings = iteration.question_mappings;
    if (!currentQuestionMappings || currentQuestionMappings.length === 0) {
      setImportSummary("Erreur: Mappages de questions manquants pour cette itération. Impossible de lier les résultats.");
      logger.error(`[Import Results] No question mappings found for iteration ${iteration.id}`);
      return;
    }

    if (iteration.status === 'completed') {
      if (!window.confirm("Les résultats pour cette itération ont déjà été importés. Voulez-vous vraiment les ré-importer et écraser les données existantes ?")) {
        return;
      }
      await StorageManager.deleteResultsForIteration(iteration.id);
    }

    setImportSummary(`Lecture du fichier ORS pour l'itération ${iteration.name}...`);
    try {
      const fileData = await window.electronAPI?.readFileBuffer(iteration.ors_file_path);
      if (!fileData || !fileData.fileBuffer) {
        setImportSummary(`Lecture du fichier ORS échouée: ${fileData?.error || 'Buffer vide.'}`);
        return;
      }

      const arrayBuffer = base64ToArrayBuffer(fileData.fileBuffer);
      const zip = await JSZip.loadAsync(arrayBuffer);
      const orSessionXmlFile = zip.file("ORSession.xml");
      if (!orSessionXmlFile) {
        setImportSummary("Erreur: ORSession.xml introuvable dans le .zip.");
        return;
      }

      const xmlString = await orSessionXmlFile.async("string");
      setImportSummary("Parsing XML...");
      let extractedResultsFromXml: ExtractedResultFromXml[] = parseOmbeaResultsXml(xmlString);

      if (extractedResultsFromXml.length === 0) {
        setImportSummary("Aucune réponse trouvée dans le fichier XML.");
        return;
      }

      const slideGuidsToIgnore = editingSessionData.ignoredSlideGuids;
      if (slideGuidsToIgnore && slideGuidsToIgnore.length > 0) {
        extractedResultsFromXml = extractedResultsFromXml.filter(
          (result) => !slideGuidsToIgnore.includes(result.questionSlideGuid)
        );
      }

      const latestResultsMap = new Map<string, ExtractedResultFromXml>();
      for (const result of extractedResultsFromXml) {
        const key = `${result.participantDeviceID}-${result.questionSlideGuid}`;
        const existingResult = latestResultsMap.get(key);
        if (!existingResult || (result.timestamp && existingResult.timestamp && new Date(result.timestamp) > new Date(existingResult.timestamp))) {
          latestResultsMap.set(key, result);
        }
      }
      const finalExtractedResults = Array.from(latestResultsMap.values());

      if (finalExtractedResults.length === 0) {
        setImportSummary("Aucune réponse valide à importer après déduplication.");
        return;
      }

      const sessionBoitiers = (iteration.participants || []).map((p: any, index: number) => ({
        serialNumber: hardwareDevices.find(d => d.id === p.assignedGlobalDeviceId)?.serialNumber,
        participantName: `${p.prenom} ${p.nom}`,
        visualId: index + 1,
      })).filter((b: any) => b.serialNumber);

      const relevantSessionQuestionGuids = new Set(currentQuestionMappings.map((q: any) => q.slideGuid));
      const detectedAnomaliesData: DetectedAnomalies = { expectedHavingIssues: [], unknownThatResponded: [] };
      const responsesFromExpectedDevices: ExtractedResultFromXml[] = [];
      const expectedSerialNumbers = new Set(sessionBoitiers.map((b: any) => b.serialNumber));

      finalExtractedResults.forEach(result => {
        if (expectedSerialNumbers.has(result.participantDeviceID)) {
          responsesFromExpectedDevices.push(result);
        } else {
          let unknown = detectedAnomaliesData.unknownThatResponded.find(u => u.serialNumber === result.participantDeviceID);
          if (!unknown) {
            unknown = { serialNumber: result.participantDeviceID, responses: [] };
            detectedAnomaliesData.unknownThatResponded.push(unknown);
          }
          unknown.responses.push(result);
        }
      });

      sessionBoitiers.forEach((boitier: any) => {
        const respondedGuids = new Set(finalExtractedResults.filter(r => r.participantDeviceID === boitier.serialNumber).map(r => r.questionSlideGuid));
        const missedGuids = [...relevantSessionQuestionGuids].filter(guid => !respondedGuids.has(guid as string));
        if (missedGuids.length > 0) {
          detectedAnomaliesData.expectedHavingIssues.push({
            serialNumber: boitier.serialNumber,
            participantName: boitier.participantName,
            visualId: boitier.visualId,
            responseInfo: {
              respondedToQuestionsGuids: [...respondedGuids],
              missedQuestionsGuids: missedGuids,
              totalSessionQuestionsCount: relevantSessionQuestionGuids.size,
              responsesProvidedByExpected: finalExtractedResults.filter(r => r.participantDeviceID === boitier.serialNumber),
            }
          });
        }
      });

      if ((detectedAnomaliesData.expectedHavingIssues.length || 0) > 0 || (detectedAnomaliesData.unknownThatResponded.length || 0) > 0) {
        setImportSummary(`Anomalies détectées: ${detectedAnomaliesData.expectedHavingIssues.length || 0} boîtier(s) attendu(s) avec problèmes, ${detectedAnomaliesData.unknownThatResponded.length || 0} boîtier(s) inconnu(s). Résolution nécessaire.`);
        setDetectedAnomalies(detectedAnomaliesData);
        setPendingValidResults(responsesFromExpectedDevices);
        setCurrentIterationForImport(iteration.id);
        setShowAnomalyResolutionUI(true);
        return;
      }

      const participantsForIteration = (iteration.participants || [])
        .map((p: DBParticipantType) => {
          const device = hardwareDevices.find(d => d.id === p.assignedGlobalDeviceId);
          return {
            id: p.id,
            serialNumber: device ? device.serialNumber : undefined,
          };
        })
        .filter((p): p is { id: number; serialNumber: string } => !!p.id && !!p.serialNumber);

      const sessionResultsToSave = transformParsedResponsesToSessionResults(
        responsesFromExpectedDevices,
        currentQuestionMappings,
        editingSessionData.id!,
        iteration.id,
        participantsForIteration
      );

      if (sessionResultsToSave.length > 0) {
        const updatedSession = await StorageManager.importResultsForIteration(iteration.id, editingSessionData.id!, sessionResultsToSave);
        if (updatedSession) {
          setEditingSessionData(updatedSession);
          setImportSummary(`${sessionResultsToSave.length} résultats importés et traités avec succès pour l'itération ${iteration.name}.`);
        } else {
          setImportSummary("Erreur lors de la finalisation de l'itération.");
        }
      } else {
        setImportSummary("Aucun résultat à importer.");
      }
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setImportSummary(`Erreur traitement fichier: ${errorMessage}`);
      logger.error(`Erreur lors du traitement du fichier de résultats pour la session ID ${editingSessionData.id}`, {
        eventType: 'RESULTS_IMPORT_FILE_PROCESSING_ERROR',
        sessionId: editingSessionData.id,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : 'No stack available'
      });
    }
  };

  const handleResolveAnomalies = async (
    baseResultsToProcess: ExtractedResultFromXml[],
    expectedResolutions: ExpectedIssueResolution[],
    unknownResolutions: UnknownDeviceResolution[]
  ) => {
    setShowAnomalyResolutionUI(false);

    if (!editingSessionData?.id) {
      setImportSummary("Erreur critique : ID de session manquant.");
      return;
    }

    const freshSessionData = await StorageManager.getSessionById(editingSessionData.id);

    if (!freshSessionData) {
      setImportSummary("Erreur critique : Impossible de recharger les données de la session.");
      return;
    }

    const iterationForImport = freshSessionData.iterations?.find((it: SessionIteration) => it.id === currentIterationForImport);

    if (!iterationForImport || !iterationForImport.question_mappings) {
      setImportSummary("Erreur critique : Données de l'itération manquantes pour finaliser l'import.");
      return;
    }

    let finalResultsToImport: ExtractedResultFromXml[] = [...baseResultsToProcess];
    const originalAnomalies = detectedAnomalies;
    if (!originalAnomalies) {
        setImportSummary("Erreur critique : Données d'anomalies originales non trouvées.");
        return;
    }

    const allAssignmentsInSession = freshSessionData.iterations?.flatMap((iter: SessionIteration) => {
        const iterId = iter.id;
        if (!iterId || !iter.participants) return [];
        return iter.participants.map((p: DBParticipantType) => ({
            participantId: p.id,
            iterationId: iterId,
            deviceId: p.assignedGlobalDeviceId,
            deviceSerialNumber: hardwareDevices.find(hd => hd.id === p.assignedGlobalDeviceId)?.serialNumber,
        }));
    }) || [];

    for (const resolution of expectedResolutions) {
        const expectedDeviceData = originalAnomalies.expectedHavingIssues?.find(
            (e: { serialNumber: string }) => e.serialNumber === resolution.serialNumber
        );
        if (!expectedDeviceData) continue;

        const assignmentInfo = allAssignmentsInSession.find((a: { deviceSerialNumber: string | undefined; iterationId: number; }) => a && a.deviceSerialNumber === resolution.serialNumber && a.iterationId === currentIterationForImport);
        if (!assignmentInfo || !assignmentInfo.participantId) {
            continue;
        }

        if (resolution.action === 'mark_absent' || resolution.action === 'ignore_device') {
            await window.dbAPI.updateParticipantStatusInIteration(assignmentInfo.participantId, assignmentInfo.iterationId, 'absent');
            finalResultsToImport = finalResultsToImport.filter(r => r.participantDeviceID !== resolution.serialNumber);

        } else if (resolution.action === 'aggregate_with_unknown') {
        if (resolution.sourceUnknownSerialNumber) {
          const unknownSourceDeviceData = originalAnomalies.unknownThatResponded?.find(
            (u: any) => u.serialNumber === resolution.sourceUnknownSerialNumber
          );
          if (unknownSourceDeviceData) {
            const expectedResponses = expectedDeviceData.responseInfo.responsesProvidedByExpected;
            const unknownResponses = unknownSourceDeviceData.responses;
            const mergedResponsesForKey = new Map<string, ExtractedResultFromXml>();
            for (const resp of expectedResponses) {
              mergedResponsesForKey.set(resp.questionSlideGuid, {
                ...resp,
                participantDeviceID: resolution.serialNumber
              });
            }
            for (const resp of unknownResponses) {
              mergedResponsesForKey.set(resp.questionSlideGuid, {
                ...resp,
                participantDeviceID: resolution.serialNumber
              });
            }
            finalResultsToImport.push(...Array.from(mergedResponsesForKey.values()));
          } else {
           finalResultsToImport.push(...expectedDeviceData.responseInfo.responsesProvidedByExpected.map((r: ExtractedResultFromXml) => ({...r, participantDeviceID: resolution.serialNumber})));
          }
        } else {
           finalResultsToImport.push(...expectedDeviceData.responseInfo.responsesProvidedByExpected.map((r: ExtractedResultFromXml) => ({...r, participantDeviceID: resolution.serialNumber})));
        }
      }
    }
    for (const resolution of unknownResolutions) {
      const isUsedAsSource = expectedResolutions.some(
        expRes => expRes.action === 'aggregate_with_unknown' && expRes.sourceUnknownSerialNumber === resolution.serialNumber
      );
      if (isUsedAsSource) {
        continue;
      }
      const unknownDeviceData = originalAnomalies.unknownThatResponded?.find(
        (u: { serialNumber: string }) => u.serialNumber === resolution.serialNumber
      );
      if (!unknownDeviceData) continue;
      if (resolution.action === 'add_as_new_participant') {
        logger.warning(`[AnomalyResolution] 'add_as_new_participant' is not fully implemented and will not persist correctly. SN: ${resolution.serialNumber}`);
        finalResultsToImport.push(...unknownDeviceData.responses);
      }
    }
    const uniqueResultsMap = new Map<string, ExtractedResultFromXml>();
    for (const result of finalResultsToImport) {
        const key = `${result.participantDeviceID}-${result.questionSlideGuid}`;
        uniqueResultsMap.set(key, result);
    }
    finalResultsToImport = Array.from(uniqueResultsMap.values());

    try {
      if (!currentIterationForImport) {
        setImportSummary("Erreur critique: ID d'itération manquant pour la résolution des anomalies.");
        return;
      }

      const sessionQuestionMaps = iterationForImport.question_mappings;
      if (!sessionQuestionMaps || sessionQuestionMaps.length === 0) {
          setImportSummary("Erreur: Mappages de questions (questionMappings) manquants pour l'itération. Impossible de lier les résultats.");
          return;
      }
      const participantsForIteration = (iterationForImport.participants || [])
        .map((p: any) => {
            const device = hardwareDevices.find(d => d.id === p.assignedGlobalDeviceId);
            return {
                id: p.id,
                serialNumber: device ? device.serialNumber : undefined,
            };
        })
        .filter((p): p is { id: number; serialNumber: string } => !!p.id && !!p.serialNumber);

      const sessionResultsToSave = transformParsedResponsesToSessionResults(
        finalResultsToImport,
        sessionQuestionMaps,
        editingSessionData.id!,
        currentIterationForImport,
        participantsForIteration
      );
      if (sessionResultsToSave.length > 0) {
        const updatedSession = await StorageManager.importResultsForIteration(currentIterationForImport, editingSessionData.id!, sessionResultsToSave);
        if (updatedSession) {
            setEditingSessionData(updatedSession);
        }
      } else {
        setImportSummary("Aucun résultat à sauvegarder après résolution.");
      }
    } catch (error: any) {
        setImportSummary(`Erreur finalisation import après résolution: ${error.message}`);
    }
    setDetectedAnomalies(null);
  };

  const handleCancelAnomalyResolution = () => {
    setShowAnomalyResolutionUI(false);
    setDetectedAnomalies(null);
    setPendingValidResults([]);
    setImportSummary("Importation des résultats annulée par l'utilisateur en raison d'anomalies.");
  };

  return {
    importSummary,
    handleImportResults,
    showAnomalyResolutionUI,
    detectedAnomalies,
    pendingValidResults,
    handleResolveAnomalies,
    handleCancelAnomalyResolution,
  };
};
