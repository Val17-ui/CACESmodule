const handleImportResults = async (iterationIndex: number) => {
        logger.info(`[SessionForm] Starting import for iteration index: ${iterationIndex}`);
        if (!currentSessionDbId || !editingSessionData) {
            logger.error("[SessionForm] Import failed: No active session.");
            setImportSummary("Aucune session active.");
            return;
        }

        const iteration = editingSessionData.iterations?.find(it => it.iteration_index === iterationIndex);
        if (!iteration) {
            logger.error(`[SessionForm] Import failed: Iteration not found for index ${iterationIndex}`);
            setImportSummary("Itération non trouvée.");
            return;
        }

        if (iteration.status === 'completed') {
            logger.warn(`[SessionForm] Import skipped: Iteration ${iterationIndex} is already completed.`);
            setImportSummary("Les résultats pour cette itération ont déjà été importés.");
            return;
        }

        if (!iteration.ors_file_path) {
            logger.error(`[SessionForm] Import failed: No .ors file path for iteration ${iterationIndex}`);
            setImportSummary("Veuillez d'abord générer un fichier .ors pour cette itération.");
            return;
        }

        setImportSummary(`Lecture du fichier pour l'itération ${iteration.name}...`);
        try {
            logger.info(`[SessionForm] Opening results file: ${iteration.ors_file_path}`);
            const fileData = await window.dbAPI.openResultsFile(iteration.ors_file_path);
            if (fileData.canceled || !fileData.fileBuffer) {
                logger.error("[SessionForm] Import failed: File not found or import canceled.");
                setImportSummary("Importation annulée ou fichier non trouvé.");
                return;
            }
            const arrayBuffer = Uint8Array.from(atob(fileData.fileBuffer), c => c.charCodeAt(0));
            logger.info(`[SessionForm] File read successfully, buffer length: ${arrayBuffer.byteLength}`);

      const zip = await JSZip.loadAsync(arrayBuffer);
      const orSessionXmlFile = zip.file("ORSession.xml");
      if (!orSessionXmlFile) { setImportSummary("Erreur: ORSession.xml introuvable dans le .zip."); return; }
      const xmlString = await orSessionXmlFile.async("string");
      setImportSummary("Parsing XML...");
      let extractedResultsFromXml: ExtractedResultFromXml[] = parseOmbeaResultsXml(xmlString);
      if (extractedResultsFromXml.length === 0) {
        setImportSummary("Aucune réponse trouvée dans le fichier XML.");
        return;
      }
      logger.info(`[Import Results] ${extractedResultsFromXml.length} réponses initialement extraites du XML.`);
      const slideGuidsToIgnore = editingSessionData.ignoredSlideGuids;
      if (slideGuidsToIgnore && slideGuidsToIgnore.length > 0) {
        const countBeforeFilteringIgnored = extractedResultsFromXml.length;
        extractedResultsFromXml = extractedResultsFromXml.filter(
          (result: ExtractedResultFromXml) => !slideGuidsToIgnore.includes(result.questionSlideGuid)
        );
        const countAfterFilteringIgnored = extractedResultsFromXml.length;
        if (countBeforeFilteringIgnored > countAfterFilteringIgnored) {
          logger.info(`[Import Results] ${countBeforeFilteringIgnored - countAfterFilteringIgnored} réponses correspondant à ${slideGuidsToIgnore.length} GUID(s) ignoré(s) ont été filtrées.`);
        }
      }
      const latestResultsMap = new Map<string, ExtractedResultFromXml>();
      for (const result of extractedResultsFromXml) {
        const key = `${result.participantDeviceID}-${result.questionSlideGuid}`;
        const existingResult = latestResultsMap.get(key);
        if (!existingResult) {
          latestResultsMap.set(key, result);
        } else {
          if (result.timestamp && existingResult.timestamp) {
            if (new Date(result.timestamp) > new Date(existingResult.timestamp)) {
              latestResultsMap.set(key, result);
            }
          } else if (result.timestamp && !existingResult.timestamp) {
            latestResultsMap.set(key, result);
          }
        }
      }
      const finalExtractedResults = Array.from(latestResultsMap.values());
      logger.info(`[Import Results] ${finalExtractedResults.length} réponses retenues après déduplication.`);
      if (finalExtractedResults.length === 0 && !(editingSessionData.ignoredSlideGuids && editingSessionData.ignoredSlideGuids.length > 0 && extractedResultsFromXml.length === 0) ) {
        setImportSummary("Aucune réponse valide à importer après filtrage et déduplication.");
        return;
      }
      logger.info(`[SessionForm] Fetching questions for session blocks:`, editingSessionData.selectedBlocIds);
      const sessionQuestionsFromDb = await StorageManager.getQuestionsForSessionBlocks(editingSessionData.selectedBlocIds);
      const sessionBoitiers = await StorageManager.getSessionBoitiersBySessionId(currentSessionDbId);
      if (!sessionQuestionsFromDb || sessionQuestionsFromDb.length === 0) {
        setImportSummary("Erreur: Impossible de charger les questions de référence pour cette session.");
        logger.error(`[Import Results] Impossible de charger sessionQuestions pour sessionId: ${currentSessionDbId}`);
        return;
      }
      if (!sessionBoitiers) {
           console.warn(`[Import Results] Aucune information de boîtier (sessionBoitiers) trouvée pour sessionId: ${currentSessionDbId}.`);
      }
      const relevantSessionQuestions = editingSessionData.ignoredSlideGuids
        ? sessionQuestionsFromDb.filter((sq: SessionQuestion) => !editingSessionData.ignoredSlideGuids!.includes(sq.slideGuid))
        : sessionQuestionsFromDb;
      const relevantSessionQuestionGuids = new Set(relevantSessionQuestions.map((sq: SessionQuestion) => sq.slideGuid));
      const totalRelevantQuestionsCount = relevantSessionQuestionGuids.size;
      logger.info(`[Import Results] Nombre total de questions pertinentes pour la session: ${totalRelevantQuestionsCount}`);
      for (const result of finalExtractedResults) {
        if (!relevantSessionQuestionGuids.has(result.questionSlideGuid)) {
          const errorMessage = `GUID de question importé (${result.questionSlideGuid}) n'est pas parmi les questions pertinentes de la session.`;
          setImportSummary(errorMessage);
          logger.error(`[Import Results - Anomaly] ${errorMessage}`, {
            importedGuid: result.questionSlideGuid,
            expectedGuids: Array.from(relevantSessionQuestionGuids)
          });
          return;
        }
      }
      logger.info("[Import Results] Vérification des GUID de questions terminée.");
      const detectedAnomaliesData: DetectedAnomalies = {
        expectedHavingIssues: [],
        unknownThatResponded: [],
      };
      const responsesFromExpectedDevices: ExtractedResultFromXml[] = [];
      for (const boitierAttendu of (sessionBoitiers || [])) {
        const responsesForThisExpectedDevice = finalExtractedResults.filter(
          (r: ExtractedResultFromXml) => r.participantDeviceID === boitierAttendu.serialNumber
        );
        const respondedGuidsForThisExpected = new Set(responsesForThisExpectedDevice.map((r: ExtractedResultFromXml) => r.questionSlideGuid));
        const missedGuidsForThisExpected: string[] = [];
        if (totalRelevantQuestionsCount > 0) {
          relevantSessionQuestionGuids.forEach((guid: string) => {
            if (!respondedGuidsForThisExpected.has(guid)) {
              missedGuidsForThisExpected.push(guid);
            }
          });
        }
        if (missedGuidsForThisExpected.length > 0 && totalRelevantQuestionsCount > 0) {
          if (!detectedAnomaliesData.expectedHavingIssues) detectedAnomaliesData.expectedHavingIssues = [];
          detectedAnomaliesData.expectedHavingIssues.push({
            serialNumber: boitierAttendu.serialNumber,
            visualId: boitierAttendu.visualId,
            participantName: boitierAttendu.participantName,
            responseInfo: {
              respondedToQuestionsGuids: Array.from(respondedGuidsForThisExpected),
              responsesProvidedByExpected: responsesForThisExpectedDevice,
              missedQuestionsGuids: missedGuidsForThisExpected,
              totalSessionQuestionsCount: totalRelevantQuestionsCount,
            },
          });
        } else if (totalRelevantQuestionsCount === 0 && responsesForThisExpectedDevice.length > 0) {
           responsesFromExpectedDevices.push(...responsesForThisExpectedDevice);
        } else {
          responsesFromExpectedDevices.push(...responsesForThisExpectedDevice);
        }
      }
      logger.info(`[Import Results] ${detectedAnomaliesData.expectedHavingIssues?.length || 0} boîtier(s) attendu(s) ont des réponses manquantes.`);
      const expectedSerialNumbers = new Set((sessionBoitiers || []).map((b: SessionBoitier) => b.serialNumber));
      const unknownSerialNumbersResponses: { [key: string]: ExtractedResultFromXml[] } = {};
      for (const result of finalExtractedResults) {
        if (!expectedSerialNumbers.has(result.participantDeviceID)) {
          if (!unknownSerialNumbersResponses[result.participantDeviceID]) {
            unknownSerialNumbersResponses[result.participantDeviceID] = [];
          }
          unknownSerialNumbersResponses[result.participantDeviceID].push(result);
        }
      }
      Object.entries(unknownSerialNumbersResponses).forEach(([serialNumber, responses]: [string, ExtractedResultFromXml[]]) => {
        if (!detectedAnomaliesData.unknownThatResponded) detectedAnomaliesData.unknownThatResponded = [];
        detectedAnomaliesData.unknownThatResponded.push({
          serialNumber: serialNumber,
          responses: responses,
        });
      });
      logger.info(`[Import Results] ${detectedAnomaliesData.unknownThatResponded?.length || 0} boîtier(s) inconnu(s) ont répondu.`);
      if ((detectedAnomaliesData.expectedHavingIssues?.length || 0) > 0 || (detectedAnomaliesData.unknownThatResponded?.length || 0) > 0) {
        setImportSummary(`Anomalies détectées: ${detectedAnomaliesData.expectedHavingIssues?.length || 0} boîtier(s) attendu(s) avec problèmes, ${detectedAnomaliesData.unknownThatResponded?.length || 0} boîtier(s) inconnu(s). Résolution nécessaire.`);
        setDetectedAnomalies(detectedAnomaliesData as DetectedAnomalies);
        setPendingValidResults(responsesFromExpectedDevices);
        setShowAnomalyResolutionUI(true);
        logger.info("[Import Results] Des anomalies de boîtiers ont été détectées. Affichage de l'interface de résolution.");
        return;
      }
      logger.info("[Import Results] Aucune anomalie de boîtier détectée. Procédure d'import direct.");
      setImportSummary(`${responsesFromExpectedDevices.length} réponses valides prêtes pour transformation et import...`);
      const currentQuestionMappings = editingSessionData.questionMappings;
      if (!currentQuestionMappings || currentQuestionMappings.length === 0) {
        setImportSummary("Erreur: Mappages de questions manquants pour la session. Impossible de lier les résultats.");
        return;
      }
      const sessionResultsToSave = transformParsedResponsesToSessionResults(
        responsesFromExpectedDevices,
        currentQuestionMappings,
        currentSessionDbId
      );
      if (sessionResultsToSave.length > 0) {
        try {
          const savedResultIds = await StorageManager.addBulkSessionResults(sessionResultsToSave);
          if (savedResultIds && savedResultIds.length > 0) {
            let message = `${savedResultIds.length} résultats sauvegardés !`;
            let sessionProcessError: string | null = null;
            try {
              if (currentSessionDbId) {
                await StorageManager.updateSession(currentSessionDbId, { status: 'completed', updatedAt: new Date().toISOString() });
                message += "\nStatut session: 'Terminée'.";
                const sessionResultsForScore: SessionResult[] = await StorageManager.getResultsForSession(currentSessionDbId);
                let sessionDataForScores = await StorageManager.getSessionById(currentSessionDbId);
                if (sessionDataForScores && sessionDataForScores.questionMappings && sessionResultsForScore.length > 0) {
                  const questionIds = sessionDataForScores.questionMappings.map(q => q.dbQuestionId).filter((id): id is number => id !== null && id !== undefined);
                  const sessionQuestionsDb = await StorageManager.getQuestionsByIds(questionIds);
                  if (sessionQuestionsDb.length > 0) {
                    const updatedParticipants = sessionDataForScores.participants.map((p_db: DBParticipantType) => {
                      const matchingGlobalDevice = hardwareDevices.find(hd => hd.id === p_db.assignedGlobalDeviceId);
                      if (!matchingGlobalDevice) {
                        console.warn(`Participant ${p_db.nom} ${p_db.prenom} n'a pas de boîtier physique valide assigné pour le calcul des scores.`);
                        return { ...p_db, score: p_db.score || 0, reussite: p_db.reussite || false };
                      }
                      const participantActualSerialNumber = matchingGlobalDevice.serialNumber;
                      const participantResults = sessionResultsForScore.filter(r => r.participantIdBoitier === participantActualSerialNumber);
                      const score = calculateParticipantScore(participantResults, sessionQuestionsDb);
                      const themeScores = calculateThemeScores(participantResults, sessionQuestionsDb);
                      const reussite = determineIndividualSuccess(score, themeScores);
                      return { ...p_db, score, reussite };
                    });
                    await StorageManager.updateSession(currentSessionDbId, { participants: updatedParticipants, updatedAt: new Date().toISOString() });
                    message += "\nScores et réussite calculés et mis à jour.";
                    const finalUpdatedSession = await StorageManager.getSessionById(currentSessionDbId);
                    if (finalUpdatedSession) {
                      setEditingSessionData(finalUpdatedSession);
                      const formParticipantsToUpdate: FormParticipant[] = finalUpdatedSession.participants.map((p_db_updated: DBParticipantType, index: number) => {
                        const visualDeviceId = index + 1;
                        const currentFormParticipantState = participants[index];
                        return {
                          nom: p_db_updated.nom,
                          prenom: p_db_updated.prenom,
                          identificationCode: p_db_updated.identificationCode,
                          score: p_db_updated.score,
                          reussite: p_db_updated.reussite,
                          assignedGlobalDeviceId: p_db_updated.assignedGlobalDeviceId,
                          statusInSession: p_db_updated.statusInSession,
                          id: currentFormParticipantState?.id || `updated-${index}-${Date.now()}`,
                          firstName: p_db_updated.prenom,
                          lastName: p_db_updated.nom,
                          deviceId: currentFormParticipantState?.deviceId ?? visualDeviceId,
                          organization: currentFormParticipantState?.organization || '',
                          hasSigned: currentFormParticipantState?.hasSigned || false,
                        };
                      });
                      setParticipants(formParticipantsToUpdate);
                    }
                  } else { message += "\nImpossible charger questions pour scores."; }
                } else { message += "\nImpossible calculer scores."; }
              }
            } catch (processingError: any) { sessionProcessError = processingError.message; }
            if(sessionProcessError) { message += `\nErreur post-traitement: ${sessionProcessError}`; }
            setImportSummary(message);
            setResultsFile(null);
            logger.info(`Résultats importés pour la session ID ${currentSessionDbId}`, {
              eventType: 'RESULTS_IMPORTED',
              sessionId: currentSessionDbId,
              fileName: resultsFile.name,
              resultsCount: savedResultIds.length
            });
          } else {
            setImportSummary("Echec sauvegarde résultats.");
            logger.warning(`Échec de la sauvegarde des résultats importés pour la session ID ${currentSessionDbId}`, { eventType: 'RESULTS_IMPORT_FAILED_DB_SAVE', sessionId: currentSessionDbId, fileName: resultsFile.name });
          }
        } catch (dbError: any) {
          setImportSummary(`Erreur DB sauvegarde résultats: ${dbError.message}`);
          logger.error(`Erreur DB lors de la sauvegarde des résultats importés pour la session ID ${currentSessionDbId}`, { eventType: 'RESULTS_IMPORT_ERROR_DB_SAVE', sessionId: currentSessionDbId, error: dbError, fileName: resultsFile.name });
        }
      } else {
        setImportSummary("Aucun résultat transformé.");
        logger.warning(`Aucun résultat transformé après parsing du fichier pour la session ID ${currentSessionDbId}`, {eventType: 'RESULTS_IMPORT_NO_TRANSFORMED_DATA', sessionId: currentSessionDbId, fileName: resultsFile?.name});
      }
    } catch (error: any) {
      setImportSummary(`Erreur traitement fichier: ${error.message}`);
      logger.error(`Erreur lors du traitement du fichier de résultats pour la session ID ${currentSessionDbId}`, {eventType: 'RESULTS_IMPORT_FILE_PROCESSING_ERROR', sessionId: currentSessionDbId, error, fileName: resultsFile?.name});
    }
  };
