// Timestamp: 2024-06-24T17:05:00Z (forcing a change for cache invalidation, new filename)
import PptxGenJS from 'pptxgenjs';
import { StoredQuestion } from '../db';
import { Session, Participant } from '../types';
// Assuming val17PptxGenerator.ts and val17PptxTypes.ts are correctly placed and exported
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
    };
  });
}

export async function generatePresentation(
  sessionInfo: { name: string; date: string; referential: string },
  participants: Participant[],
  storedQuestions: StoredQuestion[],
  templateFileFromUser: File,
  adminSettings: AdminPPTXSettings
): Promise<void> {

  console.log(`generatePresentation called. User template: "${templateFileFromUser.name}", Questions: ${storedQuestions.length}`);
  // pptxgenjs instance is not used here for loading the template,
  // as val17PptxGenerator handles the template File object directly.

  // Step 1: Transform StoredQuestions to Val17Question format
  const transformedQuestions = transformQuestionsForVal17Generator(storedQuestions);

  // Step 2: Prepare GenerationOptions for Val17's generator
  // These settings would ideally come from an Admin configuration page later.
  const generationOptions: Val17GenerationOptions = {
    fileName: `Session_${sessionInfo.name.replace(/[^a-z0-9]/gi, '_')}_OMBEA.pptx`, // Filename for saveAs
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
    await generatePPTXVal17(modifiedTemplateFileForVal17, transformedQuestions, generationOptions);
    console.log("PPTX generation (including OMBEA slides) initiated by val17PptxGenerator.");
  } catch (error) {
    console.error("Error calling val17PptxGenerator:", error);
    alert("Erreur lors de la génération du PPTX interactif des questions OMBEA.");
  } finally {
    tempImageUrls.forEach(url => {
      try { URL.revokeObjectURL(url); } catch (e) { console.warn("Failed to revoke URL for generatePresentation:", url, e); }
    });
    console.log("Revoked temporary object URLs for images in generatePresentation.");
    tempImageUrls = [];
  }
}
