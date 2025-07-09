// src/utils/resultsParser.ts

// import { QuestionWithId } from '../db'; // Unused
import { SessionResult } from '../types';

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
  console.log("Début du parsing du fichier ORSession.xml...");
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "application/xml");

  // console.log("XML content snippet for debugging (first 500 chars):", xmlString.substring(0, 500)); // DEBUG

  const parserErrorNode = xmlDoc.querySelector("parsererror");
  if (parserErrorNode) {
    console.error("Erreur de parsing XML:", parserErrorNode.textContent || "Erreur inconnue du parser");
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
      console.warn("Respondent ID séquentiel ou DeviceID physique manquant dans RespondentList pour un noeud:", respNode.innerHTML);
    }
  });
  if(respondentToDeviceMap.size === 0) {
    console.warn("Aucun mappage RespondentID vers DeviceID n'a pu être créé à partir de RespondentList. Le parsing des réponses pourrait échouer à trouver les DeviceID.");
  } else {
    // console.log("Map RespondentID vers DeviceID créé:", respondentToDeviceMap); // DEBUG
  }


  // 2. Itérer sur chaque <ors:Question>
  const questionNodes = xmlDoc.querySelectorAll("ORSession > Questions > Question");
  // console.log(`Nombre de <Question> trouvées dans le XML: ${questionNodes.length}`); // DEBUG

  questionNodes.forEach((qNode, qIndex) => {
    const slideGuid = qNode.getAttribute("SlideGUID");
    const questionXMLId = qNode.getAttribute("ID"); // ID numérique simple (1, 2, ...) de la question dans le XML

    /* DEBUG Start
    if (qIndex < 3) { // Log details for the first 3 questions
      console.log(`[Parser Log] Question XML ID: ${questionXMLId}, SlideGUID: ${slideGuid}`);
      console.log(`[Parser Log] Question Node OuterHTML: ${qNode.outerHTML.substring(0, 500)}...`);
    }
    DEBUG End */

    if (!slideGuid) {
      console.warn(`Question (ID XML: ${questionXMLId || qIndex + 1}) n'a pas de SlideGUID. Ses réponses seront ignorées.`);
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
          console.warn(`Points invalides pour Answer ID ${answerId} dans Question SlideGUID ${slideGuid}`);
        }
      } else {
         console.warn(`ID ou Points manquant pour une Answer dans Question SlideGUID ${slideGuid}`);
      }
    });
    /* DEBUG Start
    if (qIndex < 3) {
        console.log(`[Parser Log] answerScores map for SlideGUID ${slideGuid}:`, answerScores);
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
            console.log(`[Parser Log] Response for SlideGUID ${slideGuid}: RespondentIDSeq=${respondentIdSequential}, DeviceID=${participantDeviceID}, AnswerGivenID=${answerGivenID}, PointsObtained=${pointsObtained}`);
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
        if (!participantDeviceID) console.warn(`DeviceID non trouvé pour RespondentID séquentiel: ${respondentIdSequential} (Question SlideGUID ${slideGuid}). Réponse ignorée.`);
        if (!answerGivenID) console.warn(`Réponse (IntVal) manquante pour RespondentID séquentiel: ${respondentIdSequential}, Question SlideGUID ${slideGuid}. Réponse ignorée.`);
      }
    });
  });

  if (extractedResults.length === 0) {
    console.warn("Aucune réponse exploitable n'a été extraite du fichier XML. Vérifiez la structure du fichier ou son contenu.");
  }

  console.log(`Parsing XML terminé. ${extractedResults.length} réponses valides extraites et prétraitées.`);
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
  currentSessionId: number
): SessionResult[] => {
  const sessionResults: SessionResult[] = [];

  // console.log("[Transform Log] Initial questionMappingsFromSession:", questionMappingsFromSession); // DEBUG

  if (!currentSessionId) {
    console.error("ID de session manquant pour la transformation des résultats.");
    return [];
  }
  if (!questionMappingsFromSession || questionMappingsFromSession.length === 0) {
    console.warn("Aucun mappage de question (questionMappings) fourni pour la session. Impossible de lier les résultats XML aux IDs de questions de la DB.");
    return [];
  }

  // Créer un Map pour un accès rapide au dbQuestionId par slideGuid à partir des mappings de la session
  const dbQuestionIdBySlideGuid = new Map<string, number>();
  questionMappingsFromSession.forEach(mapping => {
    if (mapping.slideGuid && mapping.dbQuestionId) { // s'assurer que slideGuid et dbQuestionId existent
      dbQuestionIdBySlideGuid.set(mapping.slideGuid, mapping.dbQuestionId);
    } else {
      console.warn("Mapping de question incomplet ignoré dans questionMappingsFromSession:", mapping);
    }
  });

  if (dbQuestionIdBySlideGuid.size === 0) {
    console.warn("Aucun mappage slideGuid -> dbQuestionId valide trouvé dans questionMappingsFromSession. Vérifiez le contenu de session.questionMappings.");
    return [];
  }
  // console.log("[Transform Log] Map dbQuestionId par SlideGUID (depuis session.questionMappings):", dbQuestionIdBySlideGuid); // DEBUG

  extractedResults.forEach((extResult, _index) => { // index unused
    const dbQuestionId = dbQuestionIdBySlideGuid.get(extResult.questionSlideGuid);

    /* DEBUG Start
    if (index < 5) { // Log details for the first 5 extracted results being transformed
        console.log(`[Transform Log] Processing extResult ${index}: SlideGUID=${extResult.questionSlideGuid}, ParticipantDeviceID=${extResult.participantDeviceID}, PointsObtained=${extResult.pointsObtained}`);
    }
    DEBUG End */

    if (!dbQuestionId) {
      console.warn(`Impossible de trouver un dbQuestionId pour le SlideGUID XML "${extResult.questionSlideGuid}" via les questionMappings de la session. Résultat ignoré pour le participant ${extResult.participantDeviceID}.`);
      return;
    }

    // Déterminer isCorrect en fonction des points.
    const isCorrect = extResult.pointsObtained > 0;
    /* DEBUG Start
     if (index < 5) {
        console.log(`[Transform Log] For extResult ${index}: dbQuestionId=${dbQuestionId}, isCorrect derived as ${isCorrect} from points ${extResult.pointsObtained}`);
    }
    DEBUG End */

    const sessionResult: SessionResult = {
      sessionId: currentSessionId,
      questionId: dbQuestionId, // Utiliser le dbQuestionId trouvé grâce au mapping
      participantIdBoitier: extResult.participantDeviceID,
      answer: extResult.answerGivenID,
      isCorrect: isCorrect,
      pointsObtained: extResult.pointsObtained, // Assurer le transfert des points
      timestamp: new Date().toISOString(),
    };
    sessionResults.push(sessionResult);
    /* DEBUG Start
    if (index < 5) {
        console.log(`[Transform Log] Created SessionResult ${index}:`, sessionResult);
    }
    DEBUG End */
  });

  console.log(`${sessionResults.length} résultats transformés en SessionResult.`);
  /* DEBUG Start
  if (sessionResults.length > 0 && sessionResults.length < 5) {
    console.log("[Transform Log] All transformed SessionResults (if few):", sessionResults);
  } else if (sessionResults.length > 0) {
    console.log("[Transform Log] First 3 transformed SessionResults:", sessionResults.slice(0,3));
  }
  DEBUG End */
  return sessionResults;
};
