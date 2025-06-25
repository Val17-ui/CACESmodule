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


function generateOmbeaSessionXml(
  sessionInfo: Val17SessionInfo,
  participants: Participant[], // Using the type from src/types/index.ts
  _finalQuestions: FinalQuestionData[] // Renaming as questions are not part of ORSession.xml for now
): string {
  // Using a helper for escaping XML attribute/text values
  const esc = (unsafe: string | undefined | null): string => {
    if (unsafe === undefined || unsafe === null) return '';
    return String(unsafe)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  // Format device ID (e.g., 1 -> "DEVICE001")
  const formatDeviceId = (participantIndex: number): string => {
    // Placeholder until actual device mapping is implemented in Phase C
    return `DEVICE${String(participantIndex + 1).padStart(3, '0')}`;
  };

  let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`;
  xml += `<ors:ORSession xmlns:rl="http://www.ombea.com/response/respondentlist" xmlns:ors="http://www.ombea.com/response/session" ORVersion="0" SessionVersion="4">\n`;

  // Placeholder for session-specific info if needed in ORSession.xml root or a dedicated section
  // For now, the example only shows Questions and RespondentList at the root.
  // xml += `  <ors:SessionDetails>\n`;
  // xml += `    <ors:Title>${esc(sessionInfo.title)}</ors:Title>\n`;
  // xml += `    <ors:Date>${esc(sessionInfo.date || new Date().toISOString().slice(0,10))}</ors:Date>\n`;
  // xml += `  </ors:SessionDetails>\n`;

  xml += `  <ors:Questions/>\n`; // Empty as per example, questions are in PPTX tags

  xml += `  <ors:RespondentList RespondentListVersion="3">\n`;
  xml += `    <rl:RespondentHeaders>\n`;
  xml += `      <rl:DeviceIDHeader Index="1"/>\n`;
  xml += `      <rl:LastNameHeader Index="2"/>\n`; // Swapped Index with FirstName to match example
  xml += `      <rl:FirstNameHeader Index="3"/>\n`;
  // Assuming 'Organisation' is a fixed custom field for now. This could be made dynamic.
  const customHeaders: { name: string; index: number }[] = [];
  if (participants.some(p => p.organization)) {
    customHeaders.push({ name: "Organisation", index: 4 });
  }
  // Add other custom headers if necessary by inspecting participants data.

  customHeaders.forEach(ch => {
    xml += `      <rl:CustomHeader Index="${ch.index}">${esc(ch.name)}</rl:CustomHeader>\n`;
  });
  xml += `    </rl:RespondentHeaders>\n`;

  xml += `    <rl:Respondents>\n`;
  participants.forEach((p, index) => {
    xml += `      <rl:Respondent ID="${index + 1}">\n`; // Sequential 1-based ID
    xml += `        <rl:Devices>\n`;
    // Use the participant's index for the placeholder Device ID for now
    xml += `          <rl:Device>${formatDeviceId(index)}</rl:Device>\n`;
    xml += `        </rl:Devices>\n`;
    xml += `        <rl:FirstName>${esc(p.firstName)}</rl:FirstName>\n`;
    xml += `        <rl:LastName>${esc(p.lastName)}</rl:LastName>\n`;

    if (p.organization && customHeaders.find(h => h.name === "Organisation")) {
      xml += `        <rl:CustomProperty>\n`;
      xml += `          <rl:ID>Organisation</rl:ID>\n`;
      xml += `          <rl:Text>${esc(p.organization)}</rl:Text>\n`;
      xml += `        </rl:CustomProperty>\n`;
    }
    // Add other custom properties based on detected headers
    xml += `        <rl:GroupReferences/>\n`;
    xml += `      </rl:Respondent>\n`;
  });
  xml += `    </rl:Respondents>\n`;
  xml += `    <rl:Groups/>\n`;
  xml += `  </ors:RespondentList>\n`;
  xml += `</ors:ORSession>`;
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
