// Timestamp: 2024-06-24T18:50:00Z (Adding debug log before calling Val17 generator)
// import PptxGenJS from 'pptxgenjs'; // Not directly used now
import JSZip from 'jszip';
import fs from 'fs';
import { dialog, app } from 'electron';
import path from 'path';


// Ré-exporter QuestionMapping pour qu'il soit utilisable par d'autres modules

function generateOmbeaSessionXml(
  sessionInfo: Val17SessionInfo,
  participants: ParticipantForGenerator[],
  _questionMappings: QuestionMapping[], // Utiliser QuestionMapping ici, même si non utilisé dans ce XML particulier
  logger: ILogger
): string {
  logger.info('[LOG][pptxOrchestrator] Début de generateOmbeaSessionXml.');
  logger.info(`[LOG][pptxOrchestrator] sessionInfo pour XML: ${JSON.stringify(sessionInfo)}`);
  logger.info(`[LOG][pptxOrchestrator] Participants pour XML: ${JSON.stringify(participants.map(p => ({ nom: p.nom, prenom: p.prenom, idBoitier: p.idBoitier })))}`);
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
    xml += `          <rl:Device>${esc(p.idBoitier?.toString())}</rl:Device>\n`;
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

    // Add other custom properties based on detected headers
    xml += `        <rl:GroupReferences/>\n`;
    xml += `      </rl:Respondent>\n`;
  });
  xml += `    </rl:Respondents>\n`;
  xml += `    <rl:Groups/>\n`;
  xml += `  </ors:RespondentList>\n`;
  xml += `</ors:ORSession>`;
  logger.info('[LOG][pptxOrchestrator] Fin de generateOmbeaSessionXml.');
  return xml;
}


import { ILogger } from './logger';
import { QuestionWithId, AdminPPTXSettings, Val17Question, Val17GenerationOptions, QuestionMapping, Val17SessionInfo, ParticipantForGenerator } from '../../src/types/index';

export function transformQuestionsForVal17Generator(storedQuestions: QuestionWithId[], logger: ILogger): Val17Question[] {
  logger.info('[LOG][pptxOrchestrator] Début de transformQuestionsForVal17Generator.');
  const result = storedQuestions.map((sq) => {
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
    // Assuming sq.image is now a string (file path) or undefined
    if (typeof sq.image === 'string' && sq.image.length > 0) {
      imageUrl = sq.image;
    }

    return {
      dbQuestionId: sq.id as number, // Assurer que l'ID est bien passé
      question: sq.text,
      options: sq.options,
      correctAnswerIndex: correctAnswerIndex,
      imageUrl: imageUrl,
      points: sq.timeLimit, // ou sq.points si c'est le bon champ pour la durée/points
      theme: sq.blocId !== undefined ? sq.blocId.toString() : '', // Gérer le cas où blocId est undefined
    };
  });
  logger.info('[LOG][pptxOrchestrator] Fin de transformQuestionsForVal17Generator.');
  return result;
}

export async function generatePresentation(
  sessionInfo: { name: string; date: string; referentiel: string },
  participantsForGenerator: ParticipantForGenerator[],
  storedQuestions: QuestionWithId[],
  templateFile: File | ArrayBuffer | string,
  adminSettings: AdminPPTXSettings,
  logger: ILogger
): Promise<{ orsBlob: ArrayBuffer | null; questionMappings: QuestionMapping[] | null; ignoredSlideGuids: string[] | null; }> {
  logger.info('[LOG][pptxOrchestrator] === Début de generatePresentation ===');
  logger.info(`[LOG][pptxOrchestrator] sessionInfo: ${JSON.stringify(sessionInfo)}`);
  logger.info(`[LOG][pptxOrchestrator] Nombre de participants: ${participantsForGenerator.length}`);
  logger.info(`[LOG][pptxOrchestrator] Nombre de questions: ${storedQuestions.length}`);
  logger.info(`[LOG][pptxOrchestrator] adminSettings: ${JSON.stringify(adminSettings)}`);
  
  let templateBuffer: Buffer;
  if (templateFile) {
    logger.info('[LOG][pptxOrchestrator] Un fichier template a été fourni.');
    if (typeof templateFile === 'string') {
      logger.info(`[LOG][pptxOrchestrator] Le template est un chemin de fichier: ${templateFile}`);
      // Assuming templateFile is a path to a pptx file
      templateBuffer = fs.readFileSync(templateFile);
    } else if (templateFile instanceof Buffer) {
      logger.info('[LOG][pptxOrchestrator] Le template est un Buffer.');
      templateBuffer = templateFile;
    } else if (templateFile instanceof ArrayBuffer) {
      logger.info('[LOG][pptxOrchestrator] Le template est un ArrayBuffer.');
      templateBuffer = Buffer.from(templateFile);
    } else if (templateFile instanceof File) {
        logger.info('[LOG][pptxOrchestrator] Le template est un objet File.');
        const arrayBuffer = await templateFile.arrayBuffer();
        templateBuffer = Buffer.from(arrayBuffer);
    } else {
      logger.error(`[ERREUR][pptxOrchestrator] Format de template invalide fourni.`);
      throw new Error('Invalid template format provided to pptx-generate IPC handler.');
    }
  } else {
    const defaultTemplatePath = path.join(process.resourcesPath, 'assets', 'templates', 'default.pptx');
    logger.info(`[LOG][pptxOrchestrator] Aucun fichier template fourni. Utilisation du template par défaut: ${defaultTemplatePath}`);
    templateBuffer = fs.readFileSync(defaultTemplatePath);
  }

  const transformedQuestions = transformQuestionsForVal17Generator(storedQuestions, logger);
  logger.info('[LOG][pptxOrchestrator] Questions transformées pour le générateur Val17.');

  const generationOptions: Val17GenerationOptions = {
    fileName: `Session_${sessionInfo.name.replace(/[^a-z0-9]/gi, '_')}.pptx`,
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
  const val17SessionInfo: Val17SessionInfo = {
    title: sessionInfo.name,
    date: sessionInfo.date,
  };
  logger.info(`[LOG][pptxOrchestrator] Options de génération créées: ${JSON.stringify(generationOptions)}`);

  try {
    const { generatePPTXVal17 } = await import('@electron/utils/val17PptxGenerator');
    logger.info('[pptxOrchestrator] Importation de val17PptxGenerator réussie');

    logger.debug('[LOG][pptxOrchestrator] Appel de generatePPTXVal17...');
    const generatedData = await generatePPTXVal17(
      templateBuffer,
      transformedQuestions,
      participantsForGenerator,
      generationOptions,
      logger,
      val17SessionInfo
    );
    logger.debug('[LOG][pptxOrchestrator] generatePPTXVal17 a terminé son exécution.');
    logger.info('[LOG][pptxOrchestrator] generatePPTXVal17 call completed.');

    if (generatedData && generatedData.pptxBlob && generatedData.questionMappings && generatedData.preExistingQuestionSlideGuids) {
      logger.info('[LOG][pptxOrchestrator] Génération du PPTX réussie. Génération du XML de session ORS.');
      const orSessionXmlContent = generateOmbeaSessionXml(
        val17SessionInfo,
        participantsForGenerator as any, // Cast to any to avoid type errors
        generatedData.questionMappings,
        logger
      );
      logger.info('[LOG][pptxOrchestrator] XML de session ORS généré.');

      const outputOrsZip = new JSZip();
      const pptxFileNameInZip = generationOptions.fileName || `presentation.pptx`;
      const pptxBuffer = await generatedData.pptxBlob.arrayBuffer();
      outputOrsZip.file(pptxFileNameInZip, pptxBuffer);
      outputOrsZip.file("ORSession.xml", orSessionXmlContent);
      logger.info('[LOG][pptxOrchestrator] Fichiers ajoutés au ZIP ORS.');

      const orsBuffer = await outputOrsZip.generateAsync({ type: 'nodebuffer' });
      logger.info('[LOG][pptxOrchestrator] Buffer ORS généré.');

      // --- Début: Logique de sauvegarde automatique du fichier ORS (Point 12 du plan.txt) ---
      const getSavePathFromSettings = (): string => {
        // TODO: Implémentez la logique pour récupérer le chemin de sauvegarde depuis les paramètres de l'application.
        // Pour l'instant, nous utilisons le dossier Documents de l'utilisateur comme chemin par défaut.
        return path.join(app.getPath('documents'), 'CACES_Exports');
      };

      const savePath = getSavePathFromSettings();
      if (!fs.existsSync(savePath)) {
        fs.mkdirSync(savePath, { recursive: true });
      }

      const fileName = `Session_${sessionInfo.name.replace(/[^a-z0-9]/gi, '_')}_OMBEA.ors`;
      const fullPath = path.join(savePath, fileName);

      logger.info(`[LOG][pptxOrchestrator] Tentative de sauvegarde du fichier ORS.`);
      logger.info(`[LOG][pptxOrchestrator] Chemin de sauvegarde: ${savePath}`);
      logger.info(`[LOG][pptxOrchestrator] Nom du fichier: ${fileName}`);
      logger.info(`[LOG][pptxOrchestrator] Chemin complet: ${fullPath}`);
      try {
        fs.writeFileSync(fullPath, orsBuffer);
        logger.info(`[LOG][pptxOrchestrator] Fichier ORS sauvegardé à : ${fullPath}`);
      } catch (error: any) {
        logger.error(`[ERREUR][pptxOrchestrator] Erreur lors de la sauvegarde automatique : ${error}`);
        dialog.showErrorBox("Erreur de sauvegarde", `Impossible de sauvegarder le fichier ORS à ${fullPath}. Veuillez vérifier les permissions ou choisir un autre dossier.`);
        // Si la sauvegarde automatique échoue, on peut quand même retourner le blob pour permettre une sauvegarde manuelle
      }
      // --- Fin: Logique de sauvegarde automatique ---
      logger.info('[LOG][pptxOrchestrator] Fin de generatePresentation avec succès.');
      return {
        orsBlob: orsBuffer.buffer, // Convertir le Buffer en ArrayBuffer
        questionMappings: generatedData.questionMappings,
        ignoredSlideGuids: generatedData.preExistingQuestionSlideGuids
      };
    } else {
      logger.error(`[ERREUR][pptxOrchestrator] Échec de la génération des données PPTX complètes.`);
      dialog.showErrorBox("Erreur de génération PPTX", "La génération du fichier PPTX ou des données de mappage a échoué.");
      return { orsBlob: null, questionMappings: null, ignoredSlideGuids: null };
    }
  } catch (error) {
    logger.error(`[ERREUR][pptxOrchestrator] Erreur dans generatePresentation: ${error}`);
    dialog.showErrorBox("Erreur de génération", "Une erreur est survenue lors de la création du fichier .ors.");
    return { orsBlob: null, questionMappings: null, ignoredSlideGuids: null };
  }
}