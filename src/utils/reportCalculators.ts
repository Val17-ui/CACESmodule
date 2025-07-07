import { Session, SessionResult, QuestionWithId, SelectedBlock } from '../types';

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
export const calculateThemeScores = (
  participantResults: SessionResult[],
  sessionQuestions: QuestionWithId[]
): { [theme: string]: number } => {
  const themeScores: { [theme: string]: { correct: number; total: number } } = {};

  sessionQuestions.forEach(question => {
    const theme = question.theme;
    if (!themeScores[theme]) {
      themeScores[theme] = { correct: 0, total: 0 };
    }
    themeScores[theme].total++; // Compte toutes les questions pour le total

    const result = participantResults.find(r => r.questionId === question.id);
    if (result && result.isCorrect) {
      themeScores[theme].correct++;
    }
  });

  const finalScores: { [theme: string]: number } = {};
  for (const theme in themeScores) {
    const { correct, total } = themeScores[theme];
    finalScores[theme] = total > 0 ? (correct / total) * 100 : 0;
  }

  return finalScores;
};

/**
 * Détermine si un participant a réussi la session.
 * @param globalScore - La note globale du participant.
 * @param themeScores - Les notes par thématique du participant.
 * @returns true si le participant a réussi, sinon false.
 */
export const determineIndividualSuccess = (
  globalScore: number,
  themeScores: { [theme: string]: number },
  seuilGlobal: number = 70, // Valeur par défaut si non fournie
  seuilTheme: number = 50   // Valeur par défaut si non fournie
): boolean => {
  if (globalScore < seuilGlobal) {
    return false;
  }

  for (const theme in themeScores) {
    if (themeScores[theme] < seuilTheme) {
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
export interface CalculatedBlockOverallStats {
  blocId: number;
  referentielCode: string;
  themeCode: string;
  blocCode: string;
  usageCount: number; // Nombre de sessions complétées où ce bloc a été utilisé
  averageSuccessRate: number; // Pourcentage moyen de participants ayant "réussi" le bloc (score >= 50% sur les questions du bloc)
  averageScore: number; // Score moyen obtenu par les participants sur ce bloc
}

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
  blockTheme: string;
  blockId: string;
  averageScoreStringOnBlock: string; // Format "X.Y/Z", ex: "32.5/50"
  successRateOnBlock: number;  // % de participants ayant "réussi" ce bloc (score >= 50% sur les q° du bloc)
  participantsCountInSession: number;   // Nb de participants dans CETTE session (ayant donc eu ce bloc)
  questionsInBlockCount: number; // Nombre de questions composant ce bloc dans cette session
}

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
  sessionResults: SessionResult[]
): BlockPerformanceStats | null => {
  if (
    !session.participants ||
    session.participants.length === 0 ||
    !session.questionMappings ||
    session.questionMappings.length === 0
  ) {
    console.warn('[BlockPerformance] Données de session (participants ou questionMappings) manquantes.');
    return null;
  }

  // 1. Identifier les dbQuestionId qui appartiennent à ce bloc pour cette session
  const questionIdsInBlockForThisSession = session.questionMappings
    .filter(qm => qm.theme === blockSelection.theme && qm.blockId === blockSelection.blockId)
    .map(qm => qm.dbQuestionId);

  if (questionIdsInBlockForThisSession.length === 0) {
    return null;
  }
  const numQuestionsInBlock = questionIdsInBlockForThisSession.length;

  let totalCorrectAnswersInBlockAcrossParticipants = 0;
  let successfulParticipantsOnBlockCount = 0;
  const sessionParticipantsCount = session.participants.length;

  session.participants.forEach(participant => {
    const participantResultsForBlock = sessionResults.filter(r =>
      r.participantIdBoitier === participant.idBoitier &&
      questionIdsInBlockForThisSession.includes(r.questionId)
    );

    let correctAnswersInBlockForParticipant = 0;
    participantResultsForBlock.forEach(result => {
      if (result.isCorrect) {
        correctAnswersInBlockForParticipant++;
      }
    });

    totalCorrectAnswersInBlockAcrossParticipants += correctAnswersInBlockForParticipant;

    // Condition de reussite du bloc pour CE participant : >= 50% des questions de CE bloc
    if (numQuestionsInBlock > 0 && (correctAnswersInBlockForParticipant / numQuestionsInBlock) >= 0.50) {
      successfulParticipantsOnBlockCount++;
    }
  });

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