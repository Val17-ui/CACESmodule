// Timestamp: 2024-06-24T18:50:00Z (Adding debug log before calling Val17 generator)
// import PptxGenJS from 'pptxgenjs'; // Not directly used now
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { QuestionWithId as StoredQuestion } from '../db';
import { Session, Participant } from '../types'; // Assuming these are the correct local types
import {
  Val17Question,
  GenerationOptions as Val17GenerationOptions,
  ConfigOptions as Val17ConfigOptions,
  generatePPTXVal17,
  FinalQuestionData, // Import this type
  SessionInfo as Val17SessionInfo // Import this type if different from local Session
} from '../lib/val17-pptx-generator/val17PptxGenerator';


// Placeholder for ORSession.xml generation function
// This will need to be implemented based on the actual structure of ORSession.xml
function generateOmbeaSessionXml(
  sessionInfo: Val17SessionInfo, // Use the one from val17PptxGenerator for consistency
  participants: Participant[],
  finalQuestions: FinalQuestionData[]
): string {
  // Basic XML structure - THIS IS A VERY SIMPLIFIED PLACEHOLDER
  // TODO: Replace with actual ORSession.xml structure based on example if provided
  let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`;
  xml += `<ORSession>\n`;
  xml += `  <SessionInfo>\n`;
  xml += `    <Title>${sessionInfo.title}</Title>\n`;
  xml += `    <Date>${sessionInfo.date || new Date().toISOString().slice(0,10)}</Date>\n`;
  // Add other sessionInfo fields as needed
  xml += `  </SessionInfo>\n`;

  xml += `  <Attendees>\n`;
  participants.forEach(p => {
    xml += `    <Attendee Name="${p.name}" />\n`; // Assuming name is the primary field
  });
  xml += `  </Attendees>\n`;

  xml += `  <QuestionList>\n`;
  finalQuestions.forEach(q => {
    xml += `    <QuestionItem>\n`;
    xml += `      <QuestionID>${q.questionIdInSession}</QuestionID>\n`; // Sequential ID in this session
    xml += `      <SlideUID>${q.slideGuid || ''}</SlideUID>\n`; // GUID from PPTX tag
    xml += `      <Text>${q.title}</Text>\n`;
    xml += `      <Duration>${q.duration}</Duration>\n`;
    xml += `      <Options>\n`;
    q.options.forEach((opt, index) => {
      xml += `        <Option Correct="${index === q.correctAnswerIndex ? 'true' : 'false'}">${opt}</Option>\n`;
    });
    xml += `      </Options>\n`;
    // Add other question details as needed by ORSession.xml
    xml += `    </QuestionItem>\n`;
  });
  xml += `  </QuestionList>\n`;

  xml += `</ORSession>`;
  return xml;
}

// Placeholder for a more sophisticated error notification system
// For now, this ensures alerts are shown if they reach this stage.
function alertAlreadyShown(_error: Error): boolean {
  // In a real app, this would check if a user-facing error for this operation
  // has already been displayed.
  return false;
}

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
      points: sq.timeLimit, // Mapped from StoredQuestion.timeLimit
    };
  });
}

export async function generatePresentation(
  sessionInfo: { name: string; date: string; referential: string },
  _participants: Participant[],
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
    // Log data being passed to the generator for debugging
    console.log("Data being passed to generatePPTXVal17:", JSON.stringify({
      templateName: templateFileFromUser.name,
      questionsCount: transformedQuestions.length,
      // Log first 2 questions to check structure, especially correctAnswerIndex and points
      questionsSample: transformedQuestions.slice(0, 2).map(q => ({
          text: q.question.substring(0,30) + "...", // Keep log concise
          optionsCount: q.options.length,
          correctAnswerIndex: q.correctAnswerIndex,
          points: q.points,
          hasImageUrl: !!q.imageUrl
      })),
      options: generationOptions
    }, null, 2));

    // Map sessionInfo to the SessionInfo type expected by val17PptxGenerator
    const val17SessionInfo: Val17SessionInfo = { // Ensure type consistency
      title: sessionInfo.name,
      date: sessionInfo.date,
    };

    const generatedData = await generatePPTXVal17(
      templateFileFromUser,
      transformedQuestions,
      generationOptions,
      val17SessionInfo,
      _participants
    );

    if (generatedData && generatedData.pptxBlob) {
      console.log("PPTX Blob et données des questions reçus de generatePPTXVal17.");

      const orSessionXmlContent = generateOmbeaSessionXml(
        val17SessionInfo, // Pass the same sessionInfo used for PPTX generation
        _participants,
        generatedData.questionsData // Use data returned from generator
      );

      const outputOrsZip = new JSZip();
      const pptxFileNameInZip = generationOptions.fileName || `presentation.pptx`; // Use fileName from options if available
      outputOrsZip.file(pptxFileNameInZip, generatedData.pptxBlob);
      outputOrsZip.file("ORSession.xml", orSessionXmlContent); // CORRECTED FILENAME

      const orsBlob = await outputOrsZip.generateAsync({ type: 'blob', mimeType: 'application/octet-stream' }); // Standard MIME for .ors might be this or application/zip

      const orsFileName = `Session_${sessionInfo.name.replace(/[^a-z0-9]/gi, '_')}.ors`;
      saveAs(orsBlob, orsFileName);
      console.log(`Fichier .ors "${orsFileName}" généré et téléchargement initié.`);

    } else {
      console.error("Échec de la génération des données PPTX ou du Blob.");
      // L'alerte d'erreur est déjà gérée dans generatePPTXVal17 si besoin.
      // On pourrait ajouter une alerte spécifique à l'orchestrateur si generatePPTXVal17 retourne null sans alerter.
      if (!alertAlreadyShown(new Error("PPTX generation returned null."))) { // Hypothetical error tracking
         alert("La génération du fichier PPTX a échoué, le fichier .ors ne peut pas être créé.");
      }
    }

  } catch (error) { // Catch errors from orchestrator logic itself (e.g., XML generation, zipping)
    console.error("Erreur dans pptxOrchestrator.generatePresentation:", error);
    if (!alertAlreadyShown(error as Error)) { // Hypothetical error tracking
        alert("Une erreur est survenue lors de la création du fichier .ors.");
    }
  } finally {
    tempImageUrls.forEach(url => {
      try { URL.revokeObjectURL(url); } catch (e) { console.warn("Failed to revoke URL for generatePresentation (direct call):", url, e); }
    });
    console.log("Revoked temporary object URLs for images in generatePresentation (direct call).");
    tempImageUrls = [];
  }
}
