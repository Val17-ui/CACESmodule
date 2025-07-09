import {
  Session, SessionResult, QuestionWithId, Referential, Theme, Bloc, // SelectedBlock removed
  ThemeScoreDetails, CalculatedBlockOverallStats, OverallThemeStats // Types maintenant importés
} from '../types';

/**
 * Calcule la note globale d'un participant pour une session spécifique.
 * Prend en compte toutes les questions de la session, traitant les non-réponses comme incorrectes.
 * @param participantResults - Toutes les réponses d'un participant pour la session.
 * @param sessionQuestions - Toutes les questions de la session.
 * @returns La note globale en pourcentage.
 */
export const calculateParticipantScore = (
  participantResults: SessionResult[],
  sessionQuestions: QuestionWithId[]
): number => {
  if (sessionQuestions.length === 0) {
    return 0;
  }

  let correctAnswersCount = 0;
  sessionQuestions.forEach(question => {
    const result = participantResults.find(r => r.questionId === question.id);
    if (result && result.isCorrect) {
      correctAnswersCount++;
    }
  });

  const score = (correctAnswersCount / sessionQuestions.length) * 100;
  return score;
};

/**
 * Calcule les notes par thématique pour un participant.
 * Prend en compte toutes les questions de la session, traitant les non-réponses comme incorrectes.
 * @param participantResults - Les résultats du participant.
 * @param sessionQuestions - Les questions de la session.
 * @returns Un objet avec les scores pour chaque thématique.
 */
// Ajout d'une interface pour les questions enrichies avec le nom du thème résolu
interface QuestionWithResolvedTheme extends QuestionWithId {
  resolvedThemeName?: string;
}

// ThemeScoreDetails est maintenant importé depuis ../types

export const calculateThemeScores = (
  participantResults: SessionResult[],
  sessionQuestions: QuestionWithResolvedTheme[] // Utilise le type enrichi
): { [theme: string]: ThemeScoreDetails } => {
  const themeData: { [theme: string]: { correct: number; total: number } } = {};

  sessionQuestions.forEach(question => {
    const themeName = question.resolvedThemeName || 'Thème non spécifié';
    if (!themeData[themeName]) {
      themeData[themeName] = { correct: 0, total: 0 };
    }
    themeData[themeName].total++;

    const result = participantResults.find(r => r.questionId === question.id);
    if (result && result.isCorrect) {
      themeData[themeName].correct++;
    }
  });

  const finalThemeScores: { [theme: string]: ThemeScoreDetails } = {};
  for (const themeName in themeData) {
    const { correct, total } = themeData[themeName];
    finalThemeScores[themeName] = {
      score: total > 0 ? (correct / total) * 100 : 0,
      correct,
      total
    };
  }

  return finalThemeScores;
};

/**
 * Détermine si un participant a réussi la session.
 * @param globalScore - La note globale du participant.
 * @param themeScores - Les notes par thématique du participant.
 * @returns true si le participant a réussi, sinon false.
 */
export const determineIndividualSuccess = (
  globalScore: number,
  themeScores: { [theme: string]: ThemeScoreDetails }, // Modifié pour utiliser ThemeScoreDetails
  seuilGlobal: number = 70,
  seuilTheme: number = 50
): boolean => {
  if (globalScore < seuilGlobal) {
    return false;
  }

  for (const themeName in themeScores) {
    if (themeScores[themeName].score < seuilTheme) { // Accéder à la propriété score
      return false;
    }
  }

  return true;
};

/**
 * Calcule les statistiques d'une session.
 * @param session - La session.
 * @param sessionResults - Les résultats de la session.
 * @param sessionQuestions - Les questions de la session.
 * @returns Les statistiques de la session.
 */
export const calculateSessionStats = (
  session: Session,
  sessionResults: SessionResult[],
  sessionQuestions: QuestionWithId[],
  seuilGlobal: number = 70, // Valeur par défaut
  seuilTheme: number = 50    // Valeur par défaut
) => {
  if (!session.participants || session.participants.length === 0) {
    return { averageScore: 0, successRate: 0 };
  }

  const participantScores = session.participants.map(p => {
    const participantResults = sessionResults.filter(r => r.participantIdBoitier === p.idBoitier);
    return calculateParticipantScore(participantResults, sessionQuestions);
  });

  const totalScore = participantScores.reduce((sum, score) => sum + score, 0);
  const averageScore = totalScore / participantScores.length;

  const successCount = session.participants.filter(p => {
    const participantResults = sessionResults.filter(r => r.participantIdBoitier === p.idBoitier);
    const score = calculateParticipantScore(participantResults, sessionQuestions);
    const themeScores = calculateThemeScores(participantResults, sessionQuestions);
    return determineIndividualSuccess(score, themeScores, seuilGlobal, seuilTheme);
  }).length;

  const successRate = (successCount / session.participants.length) * 100;

  return { averageScore, successRate };
};

/**
 * Calcule le taux de réussite pour une question spécifique.
 * Prend en compte toutes les fois où la question a été présentée dans des sessions terminées.
 * @param questionId - L'ID de la question.
 * @param allSessions - Toutes les sessions.
 * @param allResults - Tous les résultats de toutes les sessions.
 * @param allQuestions - Toutes les questions.
 * @returns Le taux de réussite en pourcentage.
 */
export const calculateQuestionSuccessRate = (
  questionId: number,
  allSessions: Session[],
  allResults: SessionResult[],
  allQuestions: QuestionWithId[]
): number => {
  let totalPresentations = 0;
  let correctAnswers = 0;

  const question = allQuestions.find(q => q.id === questionId);
  if (!question) return 0; // Question not found

  allSessions.forEach(session => {
    if (session.status === 'completed' && session.selectionBlocs) {
      // Check if this question was part of this session
      const isQuestionInSession = session.selectionBlocs.some(block => 
        question.theme === block.theme && question.slideGuid === block.blockId
      );

      if (isQuestionInSession) {
        // For each participant in this session, this question was presented
        const participantsInSession = session.participants?.length || 0;
        totalPresentations += participantsInSession;

        // Count correct answers for this question in this session
        const resultsForThisQuestionInSession = allResults.filter(r => 
          r.sessionId === session.id && r.questionId === questionId
        );
        correctAnswers += resultsForThisQuestionInSession.filter(r => r.isCorrect).length;
      }
    }
  });

  return totalPresentations > 0 ? (correctAnswers / totalPresentations) * 100 : 0;
};

/**
 * Calcule les statistiques pour un bloc de questions spécifique.
 * @param block - Le bloc de questions.
 * @param allSessions - Toutes les sessions.
 * @param allResults - Tous les résultats.
 * @param allQuestions - Toutes les questions.
import { Session, SessionResult, QuestionWithId, Referential, Theme, Bloc } from '../types';

// ... (autres fonctions calculateParticipantScore, calculateThemeScores, determineIndividualSuccess, calculateSessionStats, calculateQuestionSuccessRate)

/**
 * Définit la structure des statistiques retournées pour un bloc.
 */
// export interface CalculatedBlockOverallStats { // Déplacé vers types/index.ts
//   blocId: number;
//   referentielCode: string;
//   themeCode: string;
//   blocCode: string;
//   usageCount: number;
//   averageSuccessRate: number;
//   averageScore: number;
// }

/**
 * Calcule les statistiques de performance pour un BLOC NUMERIQUE ID au sein d'UNE session donnée.
 * @param targetNumericBlocId L'ID numérique du bloc à analyser.
 * @param session L'objet Session complet.
 * @param sessionResults Array des SessionResult pour CETTE session.
 * @param allQuestionsOfSession Questions de la session (déjà filtrées pour la session, peuvent être enrichies).
 * @param deviceMap Map pour lier participant.assignedGlobalDeviceId au serialNumber.
 * @param allThemesDb Liste de tous les thèmes de la DB pour trouver le nom du thème.
 * @param allBlocsDb Liste de tous les blocs de la DB pour trouver le code du bloc.
 * @returns NumericBlockPerformanceStats | null si les données sont insuffisantes.
 */
export const calculateNumericBlockPerformanceForSession = (
  targetNumericBlocId: number,
  session: Session,
  sessionResults: SessionResult[],
  allQuestionsOfSession: QuestionWithResolvedTheme[], // Attend des questions potentiellement enrichies
  deviceMap: Map<number | undefined, string | undefined>,
  allThemesDb: Theme[],
  allBlocsDb: Bloc[]
): NumericBlockPerformanceStats | null => {
  const blocInfo = allBlocsDb.find(b => b.id === targetNumericBlocId);
  if (!blocInfo) {
    // console.warn(`[CalcNumericBlocPerf] Bloc numérique ID ${targetNumericBlocId} non trouvé dans allBlocsDb.`);
    return null;
  }
  const themeInfo = allThemesDb.find(t => t.id === blocInfo.theme_id);
  if (!themeInfo) {
    // console.warn(`[CalcNumericBlocPerf] Thème ID ${blocInfo.theme_id} pour bloc ${targetNumericBlocId} non trouvé.`);
    return null;
  }

  // 1. Identifier les questions qui appartiennent à ce bloc numérique POUR CETTE SESSION
  const questionsInThisNumericBlock = allQuestionsOfSession.filter(
    q => q.blocId === targetNumericBlocId
  );

  if (questionsInThisNumericBlock.length === 0) {
    // Il est possible qu'un bloc sélectionné pour la session (dans selectedBlocIds)
    // n'ait finalement aucune question mappée dans questionMappings (et donc dans allQuestionsOfSession).
    // Dans ce cas, on peut retourner des stats vides pour ce bloc.
    // console.log(`[CalcNumericBlocPerf] Aucune question trouvée pour le bloc numérique ID ${targetNumericBlocId} dans allQuestionsOfSession.`);
    return {
      blocId: targetNumericBlocId,
      blocCode: blocInfo.code_bloc,
      themeName: themeInfo.nom_complet,
      questionsInBlockCount: 0,
      averageScoreOnBlock: 0,
      successRateOnBlock: 0,
    };
  }
  const numQuestionsInBlock = questionsInThisNumericBlock.length;

  let totalScoreSumOnBlock = 0;
  let successfulParticipantsOnBlockCount = 0;
  let participantsWithResultsOnBlock = 0;

  if (!session.participants || session.participants.length === 0) {
    return { // Ou null, ou stats vides. Stats vides semble plus cohérent.
      blocId: targetNumericBlocId,
      blocCode: blocInfo.code_bloc,
      themeName: themeInfo.nom_complet,
      questionsInBlockCount: numQuestionsInBlock,
      averageScoreOnBlock: 0,
      successRateOnBlock: 0,
    };
  }

  session.participants.forEach(participant => {
    const deviceSerialNumber = participant.assignedGlobalDeviceId
      ? deviceMap.get(participant.assignedGlobalDeviceId)
      : undefined;

    if (!deviceSerialNumber) return; // Ne peut pas lier ce participant aux résultats

    const participantResultsForThisBlock = sessionResults.filter(r =>
      r.participantIdBoitier === deviceSerialNumber &&
      questionsInThisNumericBlock.some(q => q.id === r.questionId) // Vérifie que la question est bien de CE bloc numérique
    );

    // On ne compte un participant pour la moyenne que s'il a des résultats pour ce bloc
    if (participantResultsForThisBlock.length > 0) {
      participantsWithResultsOnBlock++;
      const scoreForParticipantOnBlock = calculateParticipantScore(
        participantResultsForThisBlock,
        questionsInThisNumericBlock // Calcule le score basé sur les questions de CE bloc uniquement
      );
      totalScoreSumOnBlock += scoreForParticipantOnBlock;

      if (scoreForParticipantOnBlock >= 50) { // Seuil de réussite pour le bloc à 50%
        successfulParticipantsOnBlockCount++;
      }
    } else if (numQuestionsInBlock > 0) {
      // Si le bloc a des questions mais que le participant n'a aucun résultat pour ces questions,
      // on le compte quand même pour la moyenne des scores (avec un score de 0 implicite pour ce bloc)
      // et pour le taux de réussite (comme un échec).
      // Cela dépend de la définition : est-ce que le taux de réussite est sur ceux qui ont répondu, ou tous ceux qui ont "vu" le bloc?
      // Actuellement, calculateParticipantScore renverra 0 si participantResultsForThisBlock est vide et questionsInThisNumericBlock n'est pas vide.
      // Pour être explicite, si un participant n'a pas de résultats pour un bloc qui a des questions, son score sur ce bloc est 0.
      participantsWithResultsOnBlock++; // Il a "participé" au bloc, même sans répondre.
      // totalScoreSumOnBlock += 0; // implicite
      // successfulParticipantsOnBlockCount += 0; // implicite
    }
  });

  const averageScoreOnBlock = participantsWithResultsOnBlock > 0
    ? totalScoreSumOnBlock / participantsWithResultsOnBlock
    : 0;

  // Taux de réussite basé sur le nombre total de participants à la session,
  // ou sur participantsWithResultsOnBlock ?
  // Le plan d'origine pour BlockPerformanceStats disait "% de participants ayant "réussi" ce bloc"
  // Cela suggère de baser sur le nombre de participants qui ont effectivement eu des résultats pour ce bloc.
  // Si on veut sur tous les participants de la session: session.participants.length
  const successRateOnBlock = participantsWithResultsOnBlock > 0 // Ou session.participants.length si définition différente
    ? (successfulParticipantsOnBlockCount / participantsWithResultsOnBlock) * 100
    : 0;

  return {
    blocId: targetNumericBlocId,
    blocCode: blocInfo.code_bloc,
    themeName: themeInfo.nom_complet,
    questionsInBlockCount: numQuestionsInBlock,
    averageScoreOnBlock: parseFloat(averageScoreOnBlock.toFixed(1)), // Garder une décimale
    successRateOnBlock: parseFloat(successRateOnBlock.toFixed(0)),
  };
};

/**
 * Calcule les statistiques globales pour chaque thème au sein d'un ensemble de sessions donné.
 * @param relevantSessions Sessions déjà filtrées (par référentiel, période).
 * @param allResults Tous les résultats de la base de données.
 * @param allQuestions Toutes les questions de la base de données.
 * @param allThemesDb Tous les thèmes de la base de données.
 * @param allBlocsDb Tous les blocs de la base de données.
 * @returns Un tableau de OverallThemeStats.
 */
export const calculateOverallThemeStats = (
  relevantSessions: Session[],
  allResults: SessionResult[],
  allQuestions: QuestionWithId[],
  allThemesDb: Theme[],
  allBlocsDb: Bloc[]
): OverallThemeStats[] => {
  const themeStatsMap = new Map<number, { themeCode: string; themeName: string; totalCorrect: number; totalAnswered: number }>();

  // Initialiser la map avec tous les thèmes pertinents (ceux présents dans les blocs des questions)
  // pour s'assurer que même les thèmes sans réponse sont listés (avec 0/0).
  // On peut aussi se baser sur les thèmes des blocs sélectionnés dans les relevantSessions.
  const relevantThemeIds = new Set<number>();
  relevantSessions.forEach(session => {
    session.selectedBlocIds?.forEach(blocId => {
      const bloc = allBlocsDb.find(b => b.id === blocId);
      if (bloc && bloc.theme_id) {
        relevantThemeIds.add(bloc.theme_id);
      }
    });
  });

  relevantThemeIds.forEach(themeId => {
    const themeInfo = allThemesDb.find(t => t.id === themeId);
    if (themeInfo) {
      themeStatsMap.set(themeId, {
        themeCode: themeInfo.code_theme,
        themeName: themeInfo.nom_complet,
        totalCorrect: 0,
        totalAnswered: 0,
      });
    }
  });

  relevantSessions.forEach(session => {
    if (!session.id || !session.participants || session.participants.length === 0) {
      return;
    }

    const resultsForThisSession = allResults.filter(r => r.sessionId === session.id);

    resultsForThisSession.forEach(result => {
      const question = allQuestions.find(q => q.id === result.questionId);
      if (!question || question.blocId === undefined) return;

      const bloc = allBlocsDb.find(b => b.id === question.blocId);
      if (!bloc || bloc.theme_id === undefined) return;

      const themeId = bloc.theme_id;
      const themeStat = themeStatsMap.get(themeId);

      if (themeStat) {
        themeStat.totalAnswered++;
        if (result.isCorrect) {
          themeStat.totalCorrect++;
        }
      }
    });
  });

  return Array.from(themeStatsMap.values()).map(stat => ({
    themeId: allThemesDb.find(t => t.code_theme === stat.themeCode && t.nom_complet === stat.themeName)!.id!, // Retrouver l'ID pour la clé
    themeCode: stat.themeCode,
    themeName: stat.themeName,
    totalQuestionsAnswered: stat.totalAnswered,
    totalCorrectAnswers: stat.totalCorrect,
    successRate: stat.totalAnswered > 0 ? (stat.totalCorrect / stat.totalAnswered) * 100 : 0,
  })).sort((a,b) => a.themeName.localeCompare(b.themeName));
};

/**
 * Calcule les statistiques globales pour un bloc de questions spécifique à travers toutes les sessions.
 * @param targetBlocId - L'ID numérique du bloc à analyser.
 * @param allSessions - Toutes les sessions.
 * @param allResults - Tous les résultats de toutes les sessions.
 * @param allQuestions - Toutes les questions de la base de données.
 * @param allReferentiels - Tous les référentiels.
 * @param allThemes - Tous les thèmes.
 * @param allBlocs - Tous les blocs.
 * @returns Les statistiques du bloc, ou null si le bloc n'est pas trouvé.
 */
export const calculateBlockStats = (
  targetBlocId: number,
  allSessions: Session[],
  allResults: SessionResult[],
  allQuestions: QuestionWithId[],
  allReferentiels: Referential[],
  allThemes: Theme[],
  allBlocs: Bloc[]
): CalculatedBlockOverallStats | null => {
  const targetBloc = allBlocs.find(b => b.id === targetBlocId);
  if (!targetBloc) {
    console.warn(`Bloc avec ID ${targetBlocId} non trouvé dans allBlocs.`);
    return null;
  }

  const themeOfBloc = allThemes.find(t => t.id === targetBloc.theme_id);
  if (!themeOfBloc) {
    console.warn(`Thème pour blocId ${targetBlocId} (theme_id ${targetBloc.theme_id}) non trouvé.`);
    return null;
  }

  const referentielOfTheme = allReferentiels.find(r => r.id === themeOfBloc.referentiel_id);
  if (!referentielOfTheme) {
    console.warn(`Référentiel pour themeId ${themeOfBloc.id} (referentiel_id ${themeOfBloc.referentiel_id}) non trouvé.`);
    return null;
  }

  let totalParticipantsForBlock = 0;
  let totalSuccessfulParticipantsForBlock = 0; // Participants ayant >= 50% au bloc
  let totalScoreSumForBlock = 0;
  let scoreCountForBlock = 0; // Nombre de fois qu'un score a été calculé pour ce bloc

  // Filtrer les sessions qui ont utilisé ce bloc et sont complétées
  const sessionsContainingBlock = allSessions.filter(s =>
    s.status === 'completed' && s.selectedBlocIds?.includes(targetBlocId)
  );

  // Filtrer les questions qui appartiennent à ce bloc spécifique
  const questionsInThisBlock = allQuestions.filter(q => q.blocId === targetBlocId);
  if (questionsInThisBlock.length === 0) {
    // Si le bloc n'a pas de questions, on ne peut pas calculer de stats de score/réussite.
    // On retourne quand même le nombre d'utilisations.
    return {
      blocId: targetBlocId,
      referentielCode: referentielOfTheme.code,
      themeCode: themeOfBloc.code_theme,
      blocCode: targetBloc.code_bloc,
      usageCount: sessionsContainingBlock.length,
      averageSuccessRate: 0,
      averageScore: 0,
    };
  }

  for (const session of sessionsContainingBlock) {
    if (!session.id || !session.participants || session.participants.length === 0) continue;

    const sessionResultsForThisSession = allResults.filter(r => r.sessionId === session.id);

    for (const participant of session.participants) {
      const participantResultsForThisBlock = sessionResultsForThisSession.filter(r =>
        r.participantIdBoitier === participant.idBoitier && // idBoitier est encore utilisé dans SessionResult
        questionsInThisBlock.some(q => q.id === r.questionId)
      );

      // On ne compte un participant que s'il a des résultats pour au moins une question du bloc
      // Ou si le bloc a des questions (géré par le check questionsInThisBlock.length === 0)
      // S'il n'y a pas de résultat pour ce participant sur ce bloc, on ne le compte pas pour le score/réussite.
      if (participantResultsForThisBlock.length > 0 || questionsInThisBlock.length > 0) {
         totalParticipantsForBlock++; // Compte chaque participant qui a "vu" le bloc dans une session
      }


      // Calculer le score du participant pour CE bloc dans CETTE session
      const participantScoreOnBlock = calculateParticipantScore(participantResultsForThisBlock, questionsInThisBlock);

      // On ne comptabilise le score que si le participant a répondu à des questions du bloc
      // ou si le bloc a des questions (pour éviter division par zéro si pas de résultats mais des questions)
      if (questionsInThisBlock.length > 0) { // Check to avoid division by zero if no questions
        totalScoreSumForBlock += participantScoreOnBlock;
        scoreCountForBlock++; // Compte pour la moyenne des scores
      }

      // Déterminer la réussite au bloc (ex: >= 50% des points du bloc)
      // Le seuil de 50% est arbitraire ici, pourrait être paramétrable.
      if (questionsInThisBlock.length > 0 && participantScoreOnBlock >= 50) {
        totalSuccessfulParticipantsForBlock++;
      }
    }
  }

  // Le taux de réussite est basé sur les participants qui ont eu des questions pour ce bloc.
  const averageSuccessRate = totalParticipantsForBlock > 0
    ? (totalSuccessfulParticipantsForBlock / totalParticipantsForBlock) * 100
    : 0;

  // Le score moyen est basé sur les scores calculés.
  const averageScore = scoreCountForBlock > 0 ? totalScoreSumForBlock / scoreCountForBlock : 0;

  const usageCount = sessionsContainingBlock.length;

  return {
    blocId: targetBlocId,
    referentielCode: referentielOfTheme.code,
    themeCode: themeOfBloc.code_theme,
    blocCode: targetBloc.code_bloc,
    usageCount,
    averageSuccessRate,
    averageScore,
  };
};

// --- Stats par Bloc pour UNE session spécifique ---

export interface BlockPerformanceStats {
  blockTheme: string; // Ancien identifiant textuel du thème
  blockId: string;    // Ancien identifiant textuel du bloc (ex: "A")
  averageScoreStringOnBlock: string; // Format "X.Y/Z", ex: "32.5/50"
  successRateOnBlock: number;  // % de participants ayant "réussi" ce bloc (score >= 50% sur les q° du bloc)
  participantsCountInSession: number;   // Nb de participants dans CETTE session (ayant donc eu ce bloc)
  questionsInBlockCount: number; // Nombre de questions composant ce bloc dans cette session
}

// Interface pour les questions enrichies avec le nom du thème résolu (déjà définie plus haut)
// interface QuestionWithResolvedTheme extends QuestionWithId {
//   resolvedThemeName?: string;
// }


export interface NumericBlockPerformanceStats {
  blocId: number; // L'ID numérique du bloc
  blocCode: string; // Le code du bloc (ex: R489PR_A)
  themeName: string; // Le nom complet du thème parent
  questionsInBlockCount: number; // Nombre de questions de ce bloc DANS CETTE SESSION
  averageScoreOnBlock: number; // Score moyen des participants sur ce bloc (en pourcentage)
  successRateOnBlock: number;  // % de participants ayant "réussi" ce bloc (score >= 50%)
}

// export interface OverallThemeStats { // Déplacé vers types/index.ts
//   themeId: number;
//   themeCode: string;
//   themeName: string;
//   totalQuestionsAnswered: number;
//   totalCorrectAnswers: number;
//   successRate: number;
// }

/**
 * Calcule les statistiques de performance pour un bloc de questions spécifique au sein d'UNE session donnée.
 * @param blockSelection - L'objet { theme, blockId } du bloc sélectionné pour la session.
 * @param session - L'objet Session complet (doit contenir questionMappings enrichis et participants).
 * @param sessionResults - Array des SessionResult pour CETTE session.
 * @returns BlockPerformanceStats | null si les données sont insuffisantes.
 */
export const calculateBlockPerformanceForSession = (
  blockSelection: { theme: string; blockId: string },
  session: Session,
  sessionResults: SessionResult[],
  deviceMap: Map<number | undefined, string | undefined> // Map de assignedGlobalDeviceId vers serialNumber
): BlockPerformanceStats | null => {
  // console.log('[Calculator] calculateBlockPerformanceForSession called with blockSelection:', blockSelection); // Nettoyé
  if (
    !session.participants ||
    session.participants.length === 0 ||
    !session.questionMappings ||
    session.questionMappings.length === 0
  ) {
    // console.warn('[Calculator] Données de session (participants ou questionMappings) manquantes.'); // Nettoyé
    return null;
  }

  // 1. Identifier les dbQuestionId qui appartiennent à ce bloc pour cette session
  const questionIdsInBlockForThisSession = session.questionMappings
    .filter(qm => qm.theme === blockSelection.theme && qm.blockId === blockSelection.blockId)
    .map(qm => qm.dbQuestionId);
  // console.log('[Calculator] questionIdsInBlockForThisSession:', questionIdsInBlockForThisSession); // Nettoyé

  if (questionIdsInBlockForThisSession.length === 0) {
    // console.log('[Calculator] No questions found for this blockSelection in questionMappings.'); // Nettoyé
    return null;
  }
  const numQuestionsInBlock = questionIdsInBlockForThisSession.length;
  // console.log('[Calculator] numQuestionsInBlock:', numQuestionsInBlock); // Nettoyé

  let totalCorrectAnswersInBlockAcrossParticipants = 0;
  let successfulParticipantsOnBlockCount = 0;
  const sessionParticipantsCount = session.participants.length;
  // console.log(`[Calculator] Processing ${sessionParticipantsCount} participants for block ${blockSelection.theme} - ${blockSelection.blockId}`); // Nettoyé

  session.participants.forEach((participant, _pIndex) => { // pIndex unused
    const deviceSerialNumber = participant.assignedGlobalDeviceId
      ? deviceMap.get(participant.assignedGlobalDeviceId)
      : undefined;

    // console.log(`[Calculator] Participant ${pIndex + 1}: assignedGlobalDeviceId ${participant.assignedGlobalDeviceId}, DeviceSN: ${deviceSerialNumber}, Nom: ${participant.prenom} ${participant.nom}`); // Nettoyé

    const participantResultsForBlock = deviceSerialNumber
      ? sessionResults.filter(r =>
          r.participantIdBoitier === deviceSerialNumber &&
          questionIdsInBlockForThisSession.includes(r.questionId)
        )
      : [];

    // console.log(`[Calculator] Participant ${pIndex + 1}: Found ${participantResultsForBlock.length} results for this block.`); // Nettoyé

    let correctAnswersInBlockForParticipant = 0;
    participantResultsForBlock.forEach(result => {
      if (result.isCorrect) {
        correctAnswersInBlockForParticipant++;
      }
    });
    // console.log(`[Calculator] Participant ${pIndex + 1}: Correct answers in block: ${correctAnswersInBlockForParticipant}`); // Nettoyé

    totalCorrectAnswersInBlockAcrossParticipants += correctAnswersInBlockForParticipant;

    // Condition de reussite du bloc pour CE participant : >= 50% des questions de CE bloc
    if (numQuestionsInBlock > 0 && (correctAnswersInBlockForParticipant / numQuestionsInBlock) >= 0.50) {
      successfulParticipantsOnBlockCount++;
      // console.log(`[Calculator] Participant ${pIndex + 1}: Succeeded in block.`); // Nettoyé
    }
  });

  // console.log(`[Calculator] Totals for block ${blockSelection.theme} - ${blockSelection.blockId}:
  //   TotalCorrectAcrossParticipants: ${totalCorrectAnswersInBlockAcrossParticipants},
  //   SuccessfulParticipants: ${successfulParticipantsOnBlockCount}`); // Nettoyé

  const averageCorrectAnswers = sessionParticipantsCount > 0
    ? totalCorrectAnswersInBlockAcrossParticipants / sessionParticipantsCount
    : 0;

  const successRateOnBlock = sessionParticipantsCount > 0
    ? (successfulParticipantsOnBlockCount / sessionParticipantsCount) * 100
    : 0;

  return {
    blockTheme: blockSelection.theme,
    blockId: blockSelection.blockId,
    averageScoreStringOnBlock: `${averageCorrectAnswers.toFixed(1)}/${numQuestionsInBlock}`,
    successRateOnBlock: successRateOnBlock,
    participantsCountInSession: sessionParticipantsCount,
    questionsInBlockCount: numQuestionsInBlock,
  };
};