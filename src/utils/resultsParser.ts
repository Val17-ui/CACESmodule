// src/utils/resultsParser.ts

import { QuestionWithId } from '../db';
import { SessionResult } from '../types';

// Nouvelle interface pour les données extraites et prétraitées du XML
export interface ExtractedResultFromXml {
  participantDeviceID: string; // Le DeviceID physique du boîtier
  questionSlideGuid: string;   // Le SlideGUID de la question
  answerGivenID: string;       // L'ID de l' <ors:Answer> choisie par le participant (contenu de ors:IntVal)
  pointsObtained: number;      // Points calculés à partir du barème de la question dans le XML
  // timestamp?: string;      // Optionnel: timestamp de la réponse si disponible et utile
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
    console.log("Map RespondentID vers DeviceID créé:", respondentToDeviceMap);
  }


  // 2. Itérer sur chaque <ors:Question>
  const questionNodes = xmlDoc.querySelectorAll("ORSession > Questions > Question");
  console.log(`Nombre de <Question> trouvées dans le XML: ${questionNodes.length}`);

  questionNodes.forEach((qNode, qIndex) => {
    const slideGuid = qNode.getAttribute("SlideGUID");
    const questionXMLId = qNode.getAttribute("ID"); // ID numérique simple (1, 2, ...) de la question dans le XML

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

    // 2b. Itérer sur chaque <ors:Response> pour cette question
    qNode.querySelectorAll("Responses > Response").forEach(responseNode => {
      // RespondentID dans <ors:Response> est l'ID séquentiel (1, 2, 3...)
      const respondentIdSequential = responseNode.getAttribute("RespondentID");
      const participantDeviceID = respondentIdSequential ? respondentToDeviceMap.get(respondentIdSequential) : undefined;

      const intValNode = responseNode.querySelector("Part > IntVal");
      const answerGivenID = intValNode?.textContent?.trim(); // ID de l'option de réponse choisie par le participant
      // const responseTimestamp = responseNode.getAttribute("Time"); // Peut être utile

      if (participantDeviceID && slideGuid && answerGivenID) {
        const pointsObtained = answerScores.get(answerGivenID) ?? 0;

        extractedResults.push({
          participantDeviceID,
          questionSlideGuid: slideGuid,
          answerGivenID, // C'est l'ID de l'option de réponse (ex: "1", "2", "3", "4")
          pointsObtained,
          // timestamp: responseTimestamp || undefined
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
  questionsInSession: QuestionWithId[],
  currentSessionId: number
): SessionResult[] => {
  const sessionResults: SessionResult[] = [];

  if (!currentSessionId) {
    console.error("ID de session manquant pour la transformation des résultats.");
    return [];
  }
  if (!questionsInSession || questionsInSession.length === 0) {
    console.warn("Aucune question correspondante à la session (depuis la DB) n'a été fournie. Impossible de mapper les résultats XML aux IDs de questions de la DB.");
    return [];
  }

  // Créer un Map pour un accès rapide aux questions par slideGuid
  const questionsBySlideGuid = new Map<string, QuestionWithId>();
  questionsInSession.forEach(q => {
    if (q.slideGuid) { // Vérifier que slideGuid existe et n'est pas vide
      questionsBySlideGuid.set(q.slideGuid, q);
    } else {
      console.warn(`Question ID ${q.id} (texte: "${q.text.substring(0,30)}...") n'a pas de slideGuid stocké en DB, elle ne pourra pas être mappée avec les résultats du XML.`);
    }
  });

  if(questionsBySlideGuid.size === 0) {
    console.warn("Aucune question de la session en DB n'a de slideGuid. Impossible de procéder au mappage des résultats.");
    return [];
  }

  extractedResults.forEach(extResult => {
    const questionInDb = questionsBySlideGuid.get(extResult.questionSlideGuid);

    if (!questionInDb || !questionInDb.id) {
      console.warn(`Impossible de mapper la question XML avec SlideGUID "${extResult.questionSlideGuid}" à une question de la DB (non trouvée ou ID manquant). Résultat ignoré pour le participant ${extResult.participantDeviceID}.`);
      return;
    }

    // Déterminer isCorrect en fonction des points.
    // Une réponse est correcte si elle rapporte des points.
    const isCorrect = extResult.pointsObtained > 0;

    const sessionResult: SessionResult = {
      sessionId: currentSessionId,
      questionId: questionInDb.id,
      participantIdBoitier: extResult.participantDeviceID,
      answer: extResult.answerGivenID, // Stocke l'ID de l'option de réponse (ex: "1", "2")
      isCorrect: isCorrect,
      // points: extResult.pointsObtained, // Pourrait être ajouté à SessionResult si besoin de stocker les points par réponse
      timestamp: new Date().toISOString(),
    };
    sessionResults.push(sessionResult);
  });

  console.log(`${sessionResults.length} résultats transformés en SessionResult.`);
  return sessionResults;
};
