// src/utils/resultsParser.ts

import { QuestionWithId } from '../db'; // Supposant que QuestionWithId est exportée de db.ts
import { SessionResult } from '../types'; // Importer SessionResult

// Interface temporaire pour ce que l'on s'attend à extraire du XML pour chaque réponse
export interface ParsedResponse {
  participantIdBoitier: string;
  questionIdentifierInXml: string; // L'identifiant de la question tel qu'il est dans le XML (ex: GUID, ordre, etc.)
  answerGiven: string;
  // timestamp?: string; // Optionnel, si fourni par le XML
}


/**
 * Transforme les réponses parsées brutes en objets SessionResult prêts pour la DB.
 *
 * @param parsedResponses Tableau des réponses extraites du fichier XML/JSON.
 * @param questionsInSession Liste des questions (QuestionWithId) effectivement utilisées dans cette session.
 * @param currentSessionId ID numérique de la session en cours.
 * @returns Un tableau d'objets SessionResult.
 */
export const transformParsedResponsesToSessionResults = (
  parsedResponses: ParsedResponse[],
  questionsInSession: QuestionWithId[],
  currentSessionId: number
): SessionResult[] => {
  const sessionResults: SessionResult[] = [];

  if (!currentSessionId) {
    console.error("ID de session manquant pour la transformation des résultats.");
    return [];
  }
  if (!questionsInSession || questionsInSession.length === 0) {
    console.warn("Aucune question fournie pour la session, impossible de mapper les résultats.");
    return [];
  }

  parsedResponses.forEach(parsedResp => {
    // --- DÉBUT DE LA LOGIQUE DE MAPPAGE DE QUESTION (À ADAPTER FORTEMENT) ---
    // Stratégie de mappage placeholder : on suppose que questionIdentifierInXml
    // correspond à un ID unique (ex: un GUID qui serait un champ de QuestionWithId ou son ancien ID texte)
    // ou, plus simplement pour ce placeholder, à l'index+1 ou un ID spécifique.
    // Pour cet exemple, cherchons par un champ `text` (peu robuste) ou un `id` original si on l'avait.
    // Idéalement, QuestionWithId aurait un `originalQuestionId: string` ou `guid: string`
    // que `questionIdentifierInXml` pourrait matcher.

    // Simulation: si questionIdentifierInXml est "Q1_GUID", on cherche la première question, etc.
    // Ceci est très dépendant de ce que contient questionIdentifierInXml.
    let questionInDb: QuestionWithId | undefined = undefined;
    // Exemple de recherche (à remplacer par une vraie logique de mappage):
    // Si questionIdentifierInXml est un index (1-based) dans l'ordre des questions de la session
    // const qIndex = parseInt(parsedResp.questionIdentifierInXml, 10) - 1;
    // if (qIndex >= 0 && qIndex < questionsInSession.length) {
    //   questionInDb = questionsInSession[qIndex];
    // }

    // Autre simulation: on cherche une question dont le texte commence pareil (MAUVAIS pour la prod)
    // questionInDb = questionsInSession.find(q => q.text.startsWith(parsedResp.questionIdentifierInXml));

    // **STRATÉGIE LA PLUS PROBABLE ET ROBUSTE (si implémentée lors de la génération ORS/PPTX):**
    // Le `questionIdentifierInXml` est un GUID unique que vous avez assigné à chaque question
    // lors de la génération du PPTX (via les tags OMBEA, par exemple) et que vous avez aussi
    // stocké dans un champ de votre objet `QuestionWithId` (ex: `QuestionWithId.ombeaGuid`).
    // Exemple: questionInDb = questionsInSession.find(q => q.ombeaGuid === parsedResp.questionIdentifierInXml);

    // Pour l'instant, on prend la première question pour chaque réponse, juste pour faire avancer.
    // CELA DOIT ÊTRE REMPLACÉ.
    questionInDb = questionsInSession.find(q => q.id?.toString() === parsedResp.questionIdentifierInXml);
    // Ou si questionIdentifierInXml est un index (0-based pour cet exemple):
    // const tempQIndex = parseInt(parsedResp.questionIdentifierInXml);
    // if(!isNaN(tempQIndex) && tempQIndex < questionsInSession.length) questionInDb = questionsInSession[tempQIndex];


    if (!questionInDb || !questionInDb.id) {
      console.warn(`Impossible de mapper la question avec l'identifiant XML "${parsedResp.questionIdentifierInXml}" à une question de la DB. Réponse ignorée.`);
      return; // Passe à la prochaine parsedResp
    }

    // --- FIN DE LA LOGIQUE DE MAPPAGE DE QUESTION ---

    // Déterminer si la réponse est correcte.
    // Cela dépend du type de question et du format de `correctAnswer` et `answerGiven`.
    // Exemple pour QCM où `correctAnswer` est l'index (0-based) et `answerGiven` est la lettre (A, B, C...)
    // ou l'index+1.
    let isCorrect = false;
    // Supposons pour l'instant que `correctAnswer` dans `QuestionWithId` est l'option textuelle correcte.
    // Et `answerGiven` est aussi l'option textuelle.
    // Il faudra adapter cela finement.
    // Exemple simple:
    // if (questionInDb.type === 'true-false') {
    //   isCorrect = (questionInDb.correctAnswer === '0' && parsedResp.answerGiven === 'Vrai') || // ou 'True', ou '0'
    //               (questionInDb.correctAnswer === '1' && parsedResp.answerGiven === 'Faux'); // ou 'False', ou '1'
    // } else if (questionInDb.type === 'multiple-choice') {
    //    // Si correctAnswer est l'index de l'option correcte (ex: "0", "1", ...)
    //    // Et si answerGiven est la lettre de l'option (ex: "A", "B", ...)
    //    const correctIndex = parseInt(questionInDb.correctAnswer, 10);
    //    if (!isNaN(correctIndex) && questionInDb.options && correctIndex < questionInDb.options.length) {
    //       // Convertir answerGiven (ex: "A") en index (0)
    //       const givenIndex = parsedResp.answerGiven.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
    //       isCorrect = givenIndex === correctIndex;
    //    }
    // }
    // Pour ce placeholder, mettons isCorrect à false par défaut.
    // Une logique réelle est nécessaire ici.
    // Si `questionInDb.correctAnswer` est directement comparable à `parsedResp.answerGiven`
    if (questionInDb.correctAnswer && parsedResp.answerGiven) {
        isCorrect = questionInDb.correctAnswer.trim().toLowerCase() === parsedResp.answerGiven.trim().toLowerCase();
    }


    const sessionResult: SessionResult = {
      sessionId: currentSessionId,
      questionId: questionInDb.id, // ID numérique de la question en DB
      participantIdBoitier: parsedResp.participantIdBoitier,
      answer: parsedResp.answerGiven,
      isCorrect: isCorrect,
      timestamp: new Date().toISOString(), // Utiliser le timestamp du XML si disponible, sinon maintenant.
    };
    sessionResults.push(sessionResult);
  });

  console.log(`${sessionResults.length} réponses transformées en SessionResult.`);
  return sessionResults;
};

/**
 * Parse le contenu XML d'un fichier de résultats OMBEA.
 *
 * @param xmlString La chaîne de caractères contenant le XML.
 * @returns Un tableau de ParsedResponse ou lance une erreur si le parsing échoue.
 *          Pour l'instant, la logique de parsing réelle est un placeholder.
 */
export const parseOmbeaResultsXml = (
  xmlString: string,
  // questionsInSession: QuestionWithId[] // Sera nécessaire pour le mappage à l'étape de transformation
): ParsedResponse[] => {
  console.log("Début du parsing XML...");
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "application/xml");

  // Vérifier les erreurs de parsing XML standard
  const parserErrorNode = xmlDoc.querySelector("parsererror");
  if (parserErrorNode) {
    console.error("Erreur de parsing XML:", parserErrorNode.textContent || "Erreur inconnue du parser");
    // Tenter de donner plus d'infos si possible (ex: source du fragment erroné)
    // const errorSourceText = parserErrorNode.querySelector('sourcetext')?.textContent;
    // if(errorSourceText) console.error("Fragment source de l'erreur:", errorSourceText);
    throw new Error("Le fichier de résultats XML est mal formé ou invalide. Vérifiez la console pour les détails.");
  }

  const parsedResponses: ParsedResponse[] = [];

  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  // !!! LOGIQUE DE PARSING SPÉCIFIQUE À OMBEA À IMPLÉMENTER ICI              !!!
  // !!! CECI EST UN EXEMPLE HYPOTHÉTIQUE ET DOIT ÊTRE ADAPTÉ AU FORMAT RÉEL  !!!
  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  // Exemple:
  // Supposons que chaque réponse est dans un élément <Vote>
  // avec un attribut "respondentID", un élément <QuestionID>, et un élément <Answer>
  // const voteNodes = xmlDoc.getElementsByTagName("Vote");
  // console.log(`Nombre de noeuds <Vote> trouvés: ${voteNodes.length}`);

  // for (let i = 0; i < voteNodes.length; i++) {
  //   const voteNode = voteNodes[i];
  //   const participantId = voteNode.getAttribute("respondentID");
  //   const questionIdXml = voteNode.querySelector("QuestionID")?.textContent?.trim();
  //   const answer = voteNode.querySelector("Answer")?.textContent?.trim();

  //   if (participantId && questionIdXml && answer) {
  //     parsedResponses.push({
  //       participantIdBoitier: participantId,
  //       questionIdentifierInXml: questionIdXml,
  //       answerGiven: answer,
  //     });
  //   } else {
  //     console.warn("Vote XML incomplet ou mal formé ignoré. ParticipantID:", participantId, "QuestionID:", questionIdXml, "Answer:", answer);
  //   }
  // }

  // Placeholder pour simuler des données extraites si le XML réel n'est pas encore connu
  // À RETIRER LORSQUE LE PARSING RÉEL EST IMPLÉMENTÉ
  if (xmlString.includes("<placeholder_test_results>")) { // Simuler un test
     console.warn("Utilisation de données de parsing placeholder pour le test !");
     parsedResponses.push({ participantIdBoitier: "102494", questionIdentifierInXml: "Q1_GUID", answerGiven: "A" });
     parsedResponses.push({ participantIdBoitier: "1017ED", questionIdentifierInXml: "Q1_GUID", answerGiven: "B" });
     parsedResponses.push({ participantIdBoitier: "102494", questionIdentifierInXml: "Q2_GUID", answerGiven: "C" });
  }


  if (parsedResponses.length === 0 && !xmlString.includes("<placeholder_test_results>")) {
    console.warn("Aucune réponse n'a pu être extraite du fichier XML. La structure XML est peut-être inattendue ou le fichier est vide de réponses pertinentes.");
    // Ne pas lancer d'erreur ici permet de gérer un fichier valide mais sans réponses.
    // Une erreur sera levée si le fichier XML lui-même est malformé (parsererror).
  }

  console.log(`Parsing XML terminé. ${parsedResponses.length} réponses brutes extraites (ou simulées).`);
  return parsedResponses;
};

// Optionnellement, une fonction similaire pour JSON si nécessaire plus tard
// export const parseOmbeaResultsJson = (jsonString: string): ParsedResponse[] => { ... }
