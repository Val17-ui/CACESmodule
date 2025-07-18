// Timestamp: 2024-06-24T18:50:00Z (Adding debug log before calling Val17 generator)
// import PptxGenJS from 'pptxgenjs'; // Not directly used now
import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';
// import { saveAs } from 'file-saver'; // saveAs n'est plus utilisé ici directement
// import { QuestionWithId as StoredQuestion } from '../db'; // Supprimé
import { Participant, QuestionWithId as StoredQuestion } from '../../src/types/index';
// Importer QuestionMapping et ajuster les autres imports si FinalQuestionData a été supprimé
import {
  Val17Question,
  GenerationOptions as Val17GenerationOptions,
  ConfigOptions as Val17ConfigOptions,
  generatePPTXVal17,
  QuestionMapping, // Importer directement
  SessionInfo as Val17SessionInfo
} from './val17PptxGenerator';

// Ré-exporter QuestionMapping pour qu'il soit utilisable par d'autres modules
export type { QuestionMapping };


function generateOmbeaSessionXml(
  sessionInfo: Val17SessionInfo,
  participants: Participant[],
  _questionMappings: QuestionMapping[] // Utiliser QuestionMapping ici, même si non utilisé dans ce XML particulier
): string {
  // console.log('[pptxOrchestrator] generateOmbeaSessionXml received participants:', JSON.stringify(participants.map(p => ({ idBoitier: p.idBoitier, nom: p.nom, prenom: p.prenom })), null, 2)); // DEBUG REMOVED
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

  // REMOVED Hardcoded device ID logic
  // const knownDeviceIDs = ["102494", "1017ED", "0FFB1C", "1027AC"];
  // const formatDeviceId = (participantIndex: number): string => { ... };

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

  // Traiter FirstName et LastName comme des CustomHeaders
  // Garder une trace des index pour les propriétés personnalisées
  let currentHeaderIndex = 2; // DeviceIDHeader est à l'index 1

  xml += `      <rl:CustomHeader Index="${currentHeaderIndex++}">FirstName</rl:CustomHeader>\n`;
  xml += `      <rl:CustomHeader Index="${currentHeaderIndex++}">LastName</rl:CustomHeader>\n`;

  xml += `    </rl:RespondentHeaders>\n`;

  xml += `    <rl:Respondents>\n`;
  participants.forEach((p, index) => {
    xml += `      <rl:Respondent ID="${index + 1}">\n`; // Sequential 1-based ID for Respondent, not device
    xml += `        <rl:Devices>\n`;
    // Use the actual idBoitier from the participant data
    xml += `          <rl:Device>${esc(p.assignedGlobalDeviceId?.toString())}</rl:Device>\n`;
    xml += `        </rl:Devices>\n`;

    // Ajouter FirstName comme CustomProperty
    xml += `        <rl:CustomProperty>\n`;
    xml += `          <rl:ID>FirstName</rl:ID>\n`;
    xml += `          <rl:Text>${esc(p.prenom)}</rl:Text>\n`; // Utiliser p.prenom
    xml += `        </rl:CustomProperty>\n`;

    // Ajouter LastName comme CustomProperty
    xml += `          <rl:ID>LastName</rl:ID>\n`;
    xml += `          <rl:Text>${esc(p.nom)}</rl:Text>\n`; // Utiliser p.nom
    xml += `        </rl:CustomProperty>\n`;

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
      dbQuestionId: sq.id as number, // Assurer que l'ID est bien passé
      question: sq.text,
      options: sq.options,
      correctAnswerIndex: correctAnswerIndex,
      imageUrl: imageUrl,
      points: sq.timeLimit, // ou sq.points si c'est le bon champ pour la durée/points
      theme: sq.blocId.toString(), // AJOUTÉ : Passer le thème complet (ex: "securite_A")
    };
  });
}

export async function generatePresentation(
  sessionInfo: { name: string; date: string; referential: string },
  _participants: Participant[],
  storedQuestions: StoredQuestion[],
  templateFile: File | ArrayBuffer,
  adminSettings: AdminPPTXSettings
): Promise<{ orsBlob: Blob | null; questionMappings: QuestionMapping[] | null; ignoredSlideGuids: string[] | null; }> {

  let templateBuffer: ArrayBuffer;
  if (templateFile) {
    if (templateFile instanceof File) {
      templateBuffer = await templateFile.arrayBuffer();
    } else {
      templateBuffer = templateFile;
    }
  } else {
    const defaultTemplatePath = path.join(__dirname, '..', '..', 'src', 'assets', 'templates', 'default.pptx');
    templateBuffer = fs.readFileSync(defaultTemplatePath);
  }

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
    },
    introSlideLayouts: {
      titleLayoutName: "Title Slide Layout",
      participantsLayoutName: "Participants Slide Layout",
    }
  };

  try {
    const val17SessionInfo: Val17SessionInfo = {
      title: sessionInfo.name,
      date: sessionInfo.date,
    };

    const participantsForGenerator = _participants.map(p => ({
      idBoitier: p.assignedGlobalDeviceId?.toString(),
      nom: p.nom,
      prenom: p.prenom,
      identificationCode: p.identificationCode
    }));

    const generatedData = await generatePPTXVal17(
      templateBuffer,
      transformedQuestions,
      generationOptions,
      val17SessionInfo,
      participantsForGenerator
    );

    if (generatedData && generatedData.pptxBlob && generatedData.questionMappings && generatedData.preExistingQuestionSlideGuids) {
      const orSessionXmlContent = generateOmbeaSessionXml(
        val17SessionInfo,
        _participants,
        generatedData.questionMappings
      );

      const outputOrsZip = new JSZip();
      const pptxFileNameInZip = generationOptions.fileName || `presentation.pptx`;
      outputOrsZip.file(pptxFileNameInZip, generatedData.pptxBlob);
      outputOrsZip.file("ORSession.xml", orSessionXmlContent);

      const orsBlob = await outputOrsZip.generateAsync({ type: 'blob', mimeType: 'application/octet-stream' });

      return {
        orsBlob: orsBlob,
        questionMappings: generatedData.questionMappings,
        ignoredSlideGuids: generatedData.preExistingQuestionSlideGuids
      };
    } else {
      console.error("Échec de la génération des données PPTX complètes.");
      if (!alertAlreadyShown(new Error("generatePPTXVal17 returned null or incomplete data."))) {
        alert("La génération du fichier PPTX ou des données de mappage a échoué.");
      }
      return { orsBlob: null, questionMappings: null, ignoredSlideGuids: null };
    }
  } catch (error) {
    console.error("Erreur dans generatePresentation:", error);
    if (!alertAlreadyShown(error as Error)) {
      alert("Une erreur est survenue lors de la création du fichier .ors.");
    }
    return { orsBlob: null, questionMappings: null, ignoredSlideGuids: null };
  } finally {
    tempImageUrls.forEach(url => {
      try { URL.revokeObjectURL(url); } catch (e) { console.warn("Failed to revoke URL:", url, e); }
    });
    tempImageUrls = [];
  }
}