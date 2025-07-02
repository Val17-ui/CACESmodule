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
  themeScores: { [theme: string]: number }
): boolean => {
  if (globalScore < 70) {
    return false;
  }

  for (const theme in themeScores) {
    if (themeScores[theme] < 50) {
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
  sessionQuestions: QuestionWithId[]
) => {
  const participantScores = session.participants.map(p => {
    const participantResults = sessionResults.filter(r => r.participantIdBoitier === p.idBoitier);
    return calculateParticipantScore(participantResults, sessionQuestions);
  });

  const averageScore = participantScores.reduce((sum, score) => sum + score, 0) / participantScores.length;

  const successCount = session.participants.filter(p => {
    const participantResults = sessionResults.filter(r => r.participantIdBoitier === p.idBoitier);
    const score = calculateParticipantScore(participantResults, sessionQuestions);
    const themeScores = calculateThemeScores(participantResults, sessionQuestions);
    return determineIndividualSuccess(score, themeScores);
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
 * @returns Les statistiques du bloc (usageCount, averageSuccessRate, averageScore).
 */
export const calculateBlockStats = (
  block: SelectedBlock,
  allSessions: Session[],
  allResults: SessionResult[],
  allQuestions: QuestionWithId[]
) => {
  let totalParticipantsForBlock = 0;
  let totalSuccessfulParticipantsForBlock = 0;
  let totalScoreForBlock = 0;
  let scoreCountForBlock = 0;

  const sessionsContainingBlock = allSessions.filter(s =>
    s.status === 'completed' && s.selectionBlocs?.some(b => b.theme === block.theme && b.blockId === block.blockId)
  );

  for (const session of sessionsContainingBlock) {
    if (session.id) {
      const questionsInThisBlock = allQuestions.filter(q =>
        q.theme === block.theme && q.slideGuid === block.blockId // Assuming slideGuid is blockId
      );

      if (questionsInThisBlock.length === 0) continue;

      const sessionResults = allResults.filter(r => r.sessionId === session.id);

      for (const participant of session.participants || []) {
        const participantResultsForBlock = sessionResults.filter(r =>
          r.participantIdBoitier === participant.idBoitier &&
          questionsInThisBlock.some(q => q.id === r.questionId)
        );

        if (participantResultsForBlock.length > 0) {
          const participantScoreOnBlock = calculateParticipantScore(participantResultsForBlock, questionsInThisBlock);
          // Simplified success for block: score on block >= 70%.
          const participantSuccessOnBlock = participantScoreOnBlock >= 70;

          totalParticipantsForBlock++;
          totalScoreForBlock += participantScoreOnBlock;
          scoreCountForBlock++;

          if (participantSuccessOnBlock) {
            totalSuccessfulParticipantsForBlock++;
          }
        }
      }
    }
  }

  const averageSuccessRate = totalParticipantsForBlock > 0 ? (totalSuccessfulParticipantsForBlock / totalParticipantsForBlock) * 100 : 0;
  const averageScore = scoreCountForBlock > 0 ? totalScoreForBlock / scoreCountForBlock : 0;
  const usageCount = sessionsContainingBlock.length; // Number of completed sessions where the block was selected

  return { usageCount, averageSuccessRate, averageScore };
};

// --- Stats par Bloc pour UNE session spécifique ---

export interface BlockPerformanceStats {
  blockTheme: string;
  blockId: string;
  averageScoreOnBlock: number; // Note moyenne obtenue par les participants SUR LES QUESTIONS DE CE BLOC
  successRateOnBlock: number;  // % de participants ayant "réussi" ce bloc (score >= 70% sur les q° du bloc)
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
    // console.warn(`[BlockPerformance] Aucune question trouvée pour le bloc ${blockSelection.theme} - ${blockSelection.blockId} dans les mappings de la session ${session.id}.`);
    return null; // Pas de questions pour ce bloc dans cette session
  }

  let totalScoreOnBlockAggregated = 0;
  let successfulParticipantsOnBlockCount = 0;
  const sessionParticipantsCount = session.participants.length;

  session.participants.forEach(participant => {
    // Filtrer les résultats du participant pour les questions de ce bloc uniquement
    const participantResultsForBlock = sessionResults.filter(r =>
      r.participantIdBoitier === participant.idBoitier &&
      questionIdsInBlockForThisSession.includes(r.questionId)
    );

    let correctAnswersInBlock = 0;
    participantResultsForBlock.forEach(result => {
      if (result.isCorrect) {
        correctAnswersInBlock++;
      }
    });

    // Score du participant pour CE bloc spécifique
    const scoreOnBlock = questionIdsInBlockForThisSession.length > 0
      ? (correctAnswersInBlock / questionIdsInBlockForThisSession.length) * 100
      : 0;

    totalScoreOnBlockAggregated += scoreOnBlock;

    // Définir la réussite pour ce bloc (ex: >= 70% sur les questions du bloc)
    // Ce seuil pourrait être configurable plus tard
    if (scoreOnBlock >= 70) {
      successfulParticipantsOnBlockCount++;
    }
  });

  const averageScoreOnBlock = sessionParticipantsCount > 0
    ? totalScoreOnBlockAggregated / sessionParticipantsCount
    : 0;

  const successRateOnBlock = sessionParticipantsCount > 0
    ? (successfulParticipantsOnBlockCount / sessionParticipantsCount) * 100
    : 0;

  return {
    blockTheme: blockSelection.theme,
    blockId: blockSelection.blockId,
    averageScoreOnBlock: averageScoreOnBlock,
    successRateOnBlock: successRateOnBlock,
    participantsCountInSession: sessionParticipantsCount,
    questionsInBlockCount: questionIdsInBlockForThisSession.length,
  };
};