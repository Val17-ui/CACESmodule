// Timestamp: 2024-06-24T18:30:00Z (Correcting import and ensuring no modifiedTemplateFileForVal17)
import PptxGenJS from 'pptxgenjs'; // Not actively used for slide creation in this version, but kept for potential future use for intro slides
import { QuestionWithId as StoredQuestion } from '../db'; // Corrected import
import { Session, Participant } from '../types'; // Session might be unused if sessionInfo is typed inline
import { Val17Question, GenerationOptions as Val17GenerationOptions, ConfigOptions as Val17ConfigOptions, generatePPTXVal17 } from '../lib/val17-pptx-generator/val17PptxGenerator';

export interface AdminPPTXSettings extends Val17ConfigOptions {
  defaultDuration?: number;
}

let tempImageUrls: string[] = [];

export function transformQuestionsForVal17Generator(storedQuestions: StoredQuestion[]): Val17Question[] {
  tempImageUrls.forEach(url => {
    try { URL.revokeObjectURL(url); } catch (e) { console.warn("Failed to revoke URL for transformQuestionsForVal17Generator:", url, e); }
  });
  tempImageUrls = [];

  return storedQuestions.map((sq) => {
    let correctAnswerIndex: number | undefined = undefined;
    if (sq.correctAnswer) {
      if (sq.type === 'multiple-choice') {
        const cIndex = parseInt(sq.correctAnswer, 10);
        if (!isNaN(cIndex) && cIndex >= 0 && cIndex < sq.options.length) {
          correctAnswerIndex = cIndex;
        }
      } else if (sq.type === 'true-false') {
        correctAnswerIndex = sq.correctAnswer === '0' ? 0 : 1;
      }
    }

    let imageUrl: string | undefined = undefined;
    if (sq.image instanceof Blob) {
      try {
        imageUrl = URL.createObjectURL(sq.image);
        tempImageUrls.push(imageUrl);
      } catch (e) {
        console.error("Error creating object URL for image in transformQuestionsForVal17Generator:", e);
      }
    }

    return {
      question: sq.text,
      options: sq.options,
      correctAnswerIndex: correctAnswerIndex,
      imageUrl: imageUrl,
      points: sq.timeLimit, // Map timeLimit to points
    };
  });
}

export async function generatePresentation(
  sessionInfo: { name: string; date: string; referential: string },
  _participants: Participant[], // Marked as unused for now in this simplified version
  storedQuestions: StoredQuestion[],
  templateFileFromUser: File,
  adminSettings: AdminPPTXSettings
): Promise<void> {

  console.log(`generatePresentation (simplified for direct call) called. User template: "${templateFileFromUser.name}", Questions: ${storedQuestions.length}`);

  const transformedQuestions = transformQuestionsForVal17Generator(storedQuestions);

  const generationOptions: Val17GenerationOptions = {
    fileName: `Session_${sessionInfo.name.replace(/[^a-z0-9]/gi, '_')}_OMBEA.pptx`,
    defaultDuration: adminSettings.defaultDuration || 30,
    ombeaConfig: {
      pollStartMode: adminSettings.pollStartMode,
      chartValueLabelFormat: adminSettings.chartValueLabelFormat,
      answersBulletStyle: adminSettings.answersBulletStyle,
      pollTimeLimit: adminSettings.pollTimeLimit,
      pollCountdownStartMode: adminSettings.pollCountdownStartMode,
      pollMultipleResponse: adminSettings.pollMultipleResponse,
    }
  };

  try {
    await generatePPTXVal17(templateFileFromUser, transformedQuestions, generationOptions);
    console.log("Call to val17PptxGenerator.generatePPTXVal17 completed successfully.");
  } catch (error) {
    console.error("Error reported from val17PptxGenerator.generatePPTXVal17:", error);
    if (!(error instanceof Error && error.message.includes("OMBEA"))) {
        alert("Une erreur inattendue est survenue lors de la tentative de génération du PPTX.");
    }
  } finally {
    tempImageUrls.forEach(url => {
      try { URL.revokeObjectURL(url); } catch (e) { console.warn("Failed to revoke URL for generatePresentation (direct call):", url, e); }
    });
    console.log("Revoked temporary object URLs for images in generatePresentation (direct call).");
    tempImageUrls = [];
  }
}
