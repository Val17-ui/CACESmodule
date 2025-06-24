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
    try { URL.revokeObjectURL(url); } catch (e) { console.warn("Failed to revoke URL:", url, e); }
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
        console.error("Error creating object URL for image:", e);
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
  const pptx = new PptxGenJS();

  try {
    const templateArrayBuffer = await templateFileFromUser.arrayBuffer();
    await pptx.load(templateArrayBuffer);
    console.log(`User template "${templateFileFromUser.name}" loaded. Existing slides in template: ${pptx.slides.length}`);
  } catch (error) {
    console.error("Error loading user template:", error);
    alert("Erreur lors du chargement du modèle PPTX. Un PPTX avec un thème par défaut sera utilisé.");
  }

  const commonProps = { x: 0.5, w: '90%', align: 'center' as PptxGenJS.AlignH };
  const titleY = 0.5, titleH = 1.0, subtitleY = 1.5, subtitleH = 0.75;

  let introMasterName: string | undefined = undefined;
  if (pptx.masterSlide layouts && pptx.masterSlide layouts.length > 0) {
    introMasterName = pptx.masterSlide layouts[0].name;
  }
  console.log(`Using master slide for intro slides (if available from template): ${introMasterName}`);

  let titleSlide = pptx.addSlide({ masterName: introMasterName });
  titleSlide.addText(sessionInfo.name, {
    ...commonProps, y: titleY, h: titleH, fontSize: 40, bold: true, valign: 'middle', color: '003366'
  });
  titleSlide.addText(`Référentiel: ${sessionInfo.referential}\nDate: ${sessionInfo.date}`, {
    ...commonProps, y: subtitleY + titleH, h: subtitleH, fontSize: 24, color: '333333'
  });

  let participantsSlide = pptx.addSlide({ masterName: introMasterName });
  participantsSlide.addText("Liste des Participants", {
    ...commonProps, y: 0.25, h: 0.7, fontSize: 32, bold: true, align: 'center', color: '003366'
  });
  const participantRows: PptxGenJS.TableRow[] = [
    [
      { text: "Boîtier", options: { bold: true, fill: 'E0E0E0', fontSize: 10, border: { pt: 1, color: '666666' }, color: '000000', align: 'center', valign: 'middle' } },
      { text: "Nom", options: { bold: true, fill: 'E0E0E0', fontSize: 10, border: { pt: 1, color: '666666' }, color: '000000', valign: 'middle' } },
      { text: "Prénom", options: { bold: true, fill: 'E0E0E0', fontSize: 10, border: { pt: 1, color: '666666' }, color: '000000', valign: 'middle' } },
      { text: "Code ID", options: { bold: true, fill: 'E0E0E0', fontSize: 10, border: { pt: 1, color: '666666' }, color: '000000', valign: 'middle' } }
    ]
  ];
  participants.forEach(p => {
    participantRows.push([
      { text: p.deviceId?.toString() || 'N/A', options: { fontSize: 9, border: { pt: 1, color: 'BFBFBF' }, align: 'center', valign: 'middle' } },
      { text: p.lastName, options: { fontSize: 9, border: { pt: 1, color: 'BFBFBF' }, valign: 'middle' } },
      { text: p.firstName, options: { fontSize: 9, border: { pt: 1, color: 'BFBFBF' }, valign: 'middle' } },
      { text: p.identificationCode || 'N/A', options: { fontSize: 9, border: { pt: 1, color: 'BFBFBF' }, valign: 'middle' } }
    ]);
  });
  participantsSlide.addTable(participantRows, { x: 0.5, y: 1.2, w: 9, colW: [1.5, 2.5, 2.5, 2.5] });

  let instructionSlide = pptx.addSlide({ masterName: introMasterName });
  instructionSlide.addText("Instructions de Vote", {
    ...commonProps, y: 0.25, h: 0.7, fontSize: 32, bold: true, align: 'center', color: '003366'
  });
  instructionSlide.addText(
    "1. Utilisez les boîtiers de vote pour répondre aux questions.\n" +
    "2. Sélectionnez la lettre correspondant à votre réponse et validez.\n" +
    "3. Le temps pour répondre à chaque question est limité.\n" +
    "4. Une question test suivra pour vous familiariser avec le système.",
    { x: 0.5, y: 1.5, w: '90%', h: 4, fontSize: 18, bullet: {type: 'number', style:'arabicPeriod'}, paraSpc: 10, align: 'left', color: '333333' }
  );

  console.log(`Intro slides added. Total slides in pptx object now: ${pptx.slides.length}`);

  const modifiedTemplateArrayBuffer = await pptx.write({ outputType: 'arraybuffer' });
  const modifiedTemplateFileForVal17 = new File(
    [modifiedTemplateArrayBuffer],
    `template_with_intro_${templateFileFromUser.name}`,
    { type: templateFileFromUser.type }
  );
  console.log(`Modified template "${modifiedTemplateFileForVal17.name}" (with intro slides) prepared for Val17 generator.`);

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
    await generatePPTXVal17(modifiedTemplateFileForVal17, transformedQuestions, generationOptions);
    console.log("PPTX generation (including OMBEA slides) initiated by val17PptxGenerator.");
  } catch (error) {
    console.error("Error calling val17PptxGenerator:", error);
    alert("Erreur lors de la génération du PPTX interactif des questions OMBEA.");
  } finally {
    tempImageUrls.forEach(url => {
      try { URL.revokeObjectURL(url); } catch (e) { console.warn("Failed to revoke URL:", url, e); }
    });
    console.log("Revoked temporary object URLs for images.");
    tempImageUrls = [];
  }
}
