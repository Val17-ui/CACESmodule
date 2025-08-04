// src/utils/resultsParser.ts

// import { QuestionWithId } from '../db'; // Unused
import { SessionResult } from '@common/types';
import { logger } from './logger';

// Nouvelle interface pour les données extraites et prétraitées du XML
export interface ExtractedResultFromXml {
  participantDeviceID: string; // Le DeviceID physique du boîtier
  questionSlideGuid: string;   // Le SlideGUID de la question
  answerGivenID: string;       // L'ID de l' <ors:Answer> choisie par le participant (contenu de ors:IntVal)
  pointsObtained: number;      // Points calculés à partir du barème de la question dans le XML
  timestamp?: string;      // Optionnel: timestamp de la réponse si disponible et utile
}

/**
 * Parse le contenu XML d'un fichier de résultats OMBEA (`ORSession.xml`).
 * Extrait les réponses, les associe aux participants et calcule les points obtenus.
 *
 * @param xmlString La chaîne de caractères contenant le XML.
 * @returns Un tableau de ExtractedResultFromXml.
 * @throws Error si le fichier XML est mal formé.
 */
export const parseOmbeaResultsXml = (xmlString: string): ExtractedResultFromXml[] => {
  logger.info("Début du parsing du fichier ORSession.xml...");
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "application/xml");

  // logger.info("XML content snippet for debugging (first 500 chars):", xmlString.substring(0, 500)); // DEBUG

  const parserErrorNode = xmlDoc.querySelector("parsererror");
  if (parserErrorNode) {
    logger.error("Erreur de parsing XML:", parserErrorNode.textContent || "Erreur inconnue du parser");
    throw new Error("Le fichier de résultats XML est mal formé ou invalide.");
  }

  const extractedResults: ExtractedResultFromXml[] = [];

  // 1. Créer un map RespondentID -> DeviceID
  const respondentToDeviceMap = new Map<string, string>();
  const respondentNodes = xmlDoc.querySelectorAll("RespondentList > Respondents > Respondent");
  respondentNodes.forEach(respNode => {
    const respondentIdAttr = respNode.getAttribute("ID"); // Ceci est l'ID séquentiel (1, 2, 3...)
    const deviceNode = respNode.querySelector("Devices > Device");
    const deviceId = deviceNode?.textContent?.trim(); // Ceci est l'ID physique du boîtier (ex: "102494")

    if (respondentIdAttr && deviceId) {
      respondentToDeviceMap.set(respondentIdAttr, deviceId);
    } else {
      logger.warning("Respondent ID séquentiel ou DeviceID physique manquant dans RespondentList pour un noeud:", respNode.innerHTML);
    }
  });
  if(respondentToDeviceMap.size === 0) {
    logger.warning("Aucun mappage RespondentID vers DeviceID n'a pu être créé à partir de RespondentList. Le parsing des réponses pourrait échouer à trouver les DeviceID.");
  } else {
    // logger.info("Map RespondentID vers DeviceID créé:", respondentToDeviceMap); // DEBUG
  }


  // 2. Itérer sur chaque <ors:Question>
  const questionNodes = xmlDoc.querySelectorAll("ORSession > Questions > Question");
  // logger.info(`Nombre de <Question> trouvées dans le XML: ${questionNodes.length}`); // DEBUG

  questionNodes.forEach((qNode, qIndex) => {
    const slideGuid = qNode.getAttribute("SlideGUID");
    const questionXMLId = qNode.getAttribute("ID"); // ID numérique simple (1, 2, ...) de la question dans le XML

    /* DEBUG Start
    if (qIndex < 3) { // Log details for the first 3 questions
      logger.info(`[Parser Log] Question XML ID: ${questionXMLId}, SlideGUID: ${slideGuid}`);
      logger.info(`[Parser Log] Question Node OuterHTML: ${qNode.outerHTML.substring(0, 500)}...`);
    }
    DEBUG End */

    if (!slideGuid) {
      logger.warning(`Question (ID XML: ${questionXMLId || qIndex + 1}) n'a pas de SlideGUID. Ses réponses seront ignorées.`);
      return; // Passe à la question suivante
    }

    // 2a. Parser les barèmes (Answers) pour cette question
    const answerScores = new Map<string, number>(); // Map AnswerID -> Points
    qNode.querySelectorAll("Answers > Answer").forEach(ansNode => {
      const answerId = ansNode.getAttribute("ID"); // ID de l'option de réponse (ex: "1", "2")
      const pointsStr = ansNode.getAttribute("Points");
      if (answerId && pointsStr) {
        const points = parseInt(pointsStr, 10);
        if (!isNaN(points)) {
          answerScores.set(answerId, points);
        } else {
          logger.warning(`Points invalides pour Answer ID ${answerId} dans Question SlideGUID ${slideGuid}`);
        }
      } else {
         logger.warning(`ID ou Points manquant pour une Answer dans Question SlideGUID ${slideGuid}`);
      }
    });
    /* DEBUG Start
    if (qIndex < 3) {
        logger.info(`[Parser Log] answerScores map for SlideGUID ${slideGuid}:`, answerScores);
    }
    DEBUG End */

    // 2b. Itérer sur chaque <ors:Response> pour cette question
    // let responseCounterForQuestion = 0; // Unused
    qNode.querySelectorAll("Responses > Response").forEach(responseNode => {
      // RespondentID dans <ors:Response> est l'ID séquentiel (1, 2, 3...)
      const respondentIdSequential = responseNode.getAttribute("RespondentID");
      const participantDeviceID = respondentIdSequential ? respondentToDeviceMap.get(respondentIdSequential) : undefined;

      const intValNode = responseNode.querySelector("Part > IntVal");
      const answerGivenID = intValNode?.textContent?.trim(); // ID de l'option de réponse choisie par le participant
      const responseTimestamp = responseNode.getAttribute("Time"); // Extraction du timestamp

      if (participantDeviceID && slideGuid && answerGivenID) {
        const pointsObtained = answerScores.get(answerGivenID) ?? 0;
        /* DEBUG Start
        if (qIndex < 3 && responseCounterForQuestion < 5) { // Log for first 3 questions, first 5 responses
            logger.info(`[Parser Log] Response for SlideGUID ${slideGuid}: RespondentIDSeq=${respondentIdSequential}, DeviceID=${participantDeviceID}, AnswerGivenID=${answerGivenID}, PointsObtained=${pointsObtained}`);
            responseCounterForQuestion++;
        }
        DEBUG End */
        extractedResults.push({
          participantDeviceID,
          questionSlideGuid: slideGuid,
          answerGivenID, // C'est l'ID de l'option de réponse (ex: "1", "2", "3", "4")
          pointsObtained,
          timestamp: responseTimestamp || undefined // Stockage du timestamp
        });
      } else {
        if (!participantDeviceID) logger.warning(`DeviceID non trouvé pour RespondentID séquentiel: ${respondentIdSequential} (Question SlideGUID ${slideGuid}). Réponse ignorée.`);
        if (!answerGivenID) logger.warning(`Réponse (IntVal) manquante pour RespondentID séquentiel: ${respondentIdSequential}, Question SlideGUID ${slideGuid}. Réponse ignorée.`);
      }
    });
  });

  if (extractedResults.length === 0) {
    logger.warning("Aucune réponse exploitable n'a été extraite du fichier XML. Vérifiez la structure du fichier ou son contenu.");
  }

  logger.info(`Parsing XML terminé. ${extractedResults.length} réponses valides extraites et prétraitées.`);
  return extractedResults;
};


/**
 * Transforme les ExtractedResultFromXml en objets SessionResult prêts pour la DB.
 *
 * @param extractedResults Tableau des réponses extraites et prétraitées du XML.
 * @param questionsInSession Liste des questions (QuestionWithId) effectivement utilisées dans cette session (doivent avoir un champ slideGuid).
 * @param currentSessionId ID numérique de la session en cours.
 * @returns Un tableau d'objets SessionResult.
 */
export const transformParsedResponsesToSessionResults = (
  extractedResults: ExtractedResultFromXml[],
  questionMappingsFromSession: Array<{dbQuestionId: number, slideGuid: string | null, orderInPptx: number}>,
  currentSessionId: number,
  currentIterationId: number,
  participantsForIteration: Array<{ id: number, serialNumber: string }>
): SessionResult[] => {
  const sessionResults: SessionResult[] = [];

  if (!currentSessionId || !currentIterationId) {
    logger.error("ID de session ou d'itération manquant pour la transformation des résultats.");
    return [];
  }
  if (!questionMappingsFromSession || questionMappingsFromSession.length === 0) {
    logger.warning("Aucun mappage de question fourni pour la session.");
    return [];
  }
  if (!participantsForIteration || participantsForIteration.length === 0) {
    logger.warning("Aucun participant fourni pour l'itération.");
    return [];
  }

  const dbQuestionIdBySlideGuid = new Map<string, number>();
  questionMappingsFromSession.forEach(mapping => {
    if (mapping.slideGuid && mapping.dbQuestionId) {
      dbQuestionIdBySlideGuid.set(mapping.slideGuid, mapping.dbQuestionId);
    }
  });

  const participantIdBySerial = new Map<string, number>();
  participantsForIteration.forEach(p => {
    if (p.serialNumber && p.id) {
      participantIdBySerial.set(p.serialNumber, p.id);
    }
  });

  extractedResults.forEach(extResult => {
    const dbQuestionId = dbQuestionIdBySlideGuid.get(extResult.questionSlideGuid);
    const participantId = participantIdBySerial.get(extResult.participantDeviceID);

    if (!dbQuestionId) {
      logger.warning(`Impossible de trouver un dbQuestionId pour le SlideGUID XML "${extResult.questionSlideGuid}".`);
      return;
    }
    if (!participantId) {
      logger.warning(`Impossible de trouver un participantId pour le boîtier S/N "${extResult.participantDeviceID}".`);
      // Ne pas retourner ici, on peut quand même enregistrer le résultat anonymement si on le souhaite,
      // mais pour l'instant, on l'ignore car il ne peut pas être lié à un participant.
      return;
    }

    const isCorrect = extResult.pointsObtained > 0;

    const sessionResult: SessionResult = {
      sessionId: currentSessionId,
      sessionIterationId: currentIterationId,
      questionId: dbQuestionId,
      participantIdBoitier: extResult.participantDeviceID,
      participantId: participantId, // Ajout de l'ID unique du participant
      answer: extResult.answerGivenID,
      isCorrect: isCorrect,
      pointsObtained: extResult.pointsObtained,
      timestamp: new Date().toISOString(),
    };
    sessionResults.push(sessionResult);
  });

  logger.info(`${sessionResults.length} résultats transformés en SessionResult.`);
  return sessionResults;
};
