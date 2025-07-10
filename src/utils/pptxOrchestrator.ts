// Timestamp: 2024-06-24T18:50:00Z (Adding debug log before calling Val17 generator)
// import PptxGenJS from 'pptxgenjs'; // Not directly used now
import JSZip from 'jszip';
// import { saveAs } from 'file-saver'; // saveAs n'est plus utilisé ici directement
import { QuestionWithId as StoredQuestion } from '../db';
import { Participant } from '../types'; // Session removed, Assuming these are the correct local types
// Importer QuestionMapping et ajuster les autres imports si FinalQuestionData a été supprimé
import {
  Val17Question,
  GenerationOptions as Val17GenerationOptions,
  ConfigOptions as Val17ConfigOptions,
  generatePPTXVal17,
  QuestionMapping, // Importer directement
  SessionInfo as Val17SessionInfo
} from '../lib/val17-pptx-generator/val17PptxGenerator';
import { getActivePptxTemplateFile } from '../utils/templateManager'; // Import de la nouvelle fonction

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

  // Gérer 'Organisation' comme avant, s'il existe
  const customHeadersForOrganization: { name: string; index: number }[] = [];
  if (participants.some(p => p.organization)) {
    customHeadersForOrganization.push({ name: "Organisation", index: currentHeaderIndex++ });
  }
  customHeadersForOrganization.forEach(ch => {
    xml += `      <rl:CustomHeader Index="${ch.index}">${esc(ch.name)}</rl:CustomHeader>\n`;
  });

  xml += `    </rl:RespondentHeaders>\n`;

  xml += `    <rl:Respondents>\n`;
  participants.forEach((p, index) => {
    xml += `      <rl:Respondent ID="${index + 1}">\n`; // Sequential 1-based ID for Respondent, not device
    xml += `        <rl:Devices>\n`;
    // Use the actual idBoitier from the participant data
    xml += `          <rl:Device>${esc(p.idBoitier)}</rl:Device>\n`;
    xml += `        </rl:Devices>\n`;

    // Ajouter FirstName comme CustomProperty
    xml += `        <rl:CustomProperty>\n`;
    xml += `          <rl:ID>FirstName</rl:ID>\n`;
    xml += `          <rl:Text>${esc(p.prenom)}</rl:Text>\n`; // Utiliser p.prenom
    xml += `        </rl:CustomProperty>\n`;

    // Ajouter LastName comme CustomProperty
    xml += `        <rl:CustomProperty>\n`;
    xml += `          <rl:ID>LastName</rl:ID>\n`;
    xml += `          <rl:Text>${esc(p.nom)}</rl:Text>\n`; // Utiliser p.nom
    xml += `        </rl:CustomProperty>\n`;

    // Assumons que DBParticipantType peut avoir un champ optionnel organization
    // Si p.organization vient d'un type FormParticipant qui n'est pas DBParticipantType, il faut ajuster
    const org = (p as any).organization; // Caster temporairement pour accéder à organization
    if (org && customHeadersForOrganization.find(h => h.name === "Organisation")) {
      xml += `        <rl:CustomProperty>\n`;
      xml += `          <rl:ID>Organisation</rl:ID>\n`;
      xml += `          <rl:Text>${esc(org)}</rl:Text>\n`;
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
      dbQuestionId: sq.id as number, // Assurer que l'ID est bien passé
      question: sq.text,
      options: sq.options,
      correctAnswerIndex: correctAnswerIndex,
      imageUrl: imageUrl,
      points: sq.timeLimit, // ou sq.points si c'est le bon champ pour la durée/points
      theme: sq.theme, // AJOUTÉ : Passer le thème complet (ex: "securite_A")
    };
  });
}

export async function generatePresentation(
  sessionInfo: { name: string; date: string; referential: string },
  _participants: Participant[], // Ce sont les FormParticipant
  storedQuestions: StoredQuestion[], // Ce sont les QuestionWithId (de la DB)
  selectedTemplateId: string | undefined, // Remplacer templateFileFromUser par selectedTemplateId
  adminSettings: AdminPPTXSettings
): Promise<{ orsBlob: Blob | null; questionMappings: QuestionMapping[] | null; ignoredSlideGuids: string[] | null; }> {

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
    // Ajouter les noms des layouts pour les diapositives d'introduction
    // Ces noms doivent correspondre aux noms de fichiers de layout (sans .xml) dans le template PPTX
    // ou aux noms des layouts tels que définis dans le PPTX.
    // Par exemple, si vous avez un layout nommé "Titre Session.xml" dans ppt/slideLayouts/
    // alors titleLayoutName devrait être "Titre Session" ou "Titre Session.xml".
    introSlideLayouts: {
      titleLayoutName: "Title Slide Layout",
      participantsLayoutName: "Participants Slide Layout",
      // instructionsLayoutName: "Instructions Slide Layout" // Supprimé car la diapositive est dans le modèle
    }
  };

  try {
    // Récupérer le fichier de template actif en utilisant la nouvelle logique
    const actualTemplateFile = await getActivePptxTemplateFile(selectedTemplateId);
    // console.log(`[pptxOrchestrator] Using template: "${actualTemplateFile.name}" for generation.`); // DEBUG

    // Log data being passed to the generator for debugging
    /* DEBUG Start
    console.log("Data being passed to generatePPTXVal17:", JSON.stringify({
      templateName: actualTemplateFile.name, // Utiliser le nom du fichier actuel
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
    DEBUG End */

    // Map sessionInfo to the SessionInfo type expected by val17PptxGenerator
    const val17SessionInfo: Val17SessionInfo = { // Ensure type consistency
      title: sessionInfo.name,
      date: sessionInfo.date,
    };

    // Mapper les participants de l'orchestrateur (avec nom, prenom)
    // vers le type ParticipantForGenerator attendu par val17PptxGenerator
    // (qui a été aligné pour utiliser nom, prenom également, donc le mapping est direct)
    const participantsForGenerator = _participants.map(p => ({
      idBoitier: p.idBoitier, // S'assurer que ParticipantForGenerator a ce champ si nécessaire, sinon l'omettre
      nom: p.nom,
      prenom: p.prenom,
      organization: p.organization,
      identificationCode: p.identificationCode
    }));

    const generatedData = await generatePPTXVal17(
      actualTemplateFile, // Utiliser le fichier template récupéré
      transformedQuestions,
      generationOptions,
      val17SessionInfo,
      participantsForGenerator // Utiliser les participants mappés
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
        ignoredSlideGuids: generatedData.preExistingQuestionSlideGuids // Transmettre les GUIDs ignorés
      };

    } else {
      console.error("Échec de la génération des données PPTX complètes (blob, mappings, ou preExistingGuids) à partir de generatePPTXVal17.");
      if (!alertAlreadyShown(new Error("generatePPTXVal17 returned null or incomplete data."))) {
         alert("La génération du fichier PPTX ou des données de mappage a échoué. Le fichier .ors ne peut pas être créé.");
      }
      return { orsBlob: null, questionMappings: null, ignoredSlideGuids: null };
    }

  } catch (error) {
    console.error("Erreur dans pptxOrchestrator.generatePresentation:", error);
    if (!alertAlreadyShown(error as Error)) {
        alert("Une erreur est survenue lors de la création du fichier .ors.");
    }
    return { orsBlob: null, questionMappings: null, ignoredSlideGuids: null };
  } finally {
    tempImageUrls.forEach(url => {
      try { URL.revokeObjectURL(url); } catch (e) { console.warn("Failed to revoke URL for generatePresentation (direct call):", url, e); }
    });
    // console.log("Revoked temporary object URLs for images in generatePresentation (direct call)."); // DEBUG
    tempImageUrls = [];
  }
}
