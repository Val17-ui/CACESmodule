import * as path from 'path';
import * as fs from 'fs';
import JSZip from "jszip";
import sizeOf from 'image-size';
import { ILogger } from './logger';
import { Participant, VotingDevice } from '../../src/types/index';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';

// Placeholder types until the actual GenerationOptions and ConfigOptions from your project are fully integrated.
// These should ideally come from a './val17PptxTypes' import if that file is created with your type definitions.

// Basic placeholder for session information
export interface SessionInfo {
  title: string;
  date?: string;
  // other relevant fields
}

// Participant interface alignée sur src/types/index.ts Participant
// Renommée pour éviter confusion avec le type Participant de l'orchestrateur si jamais il y avait import direct.
export interface ParticipantForGenerator {
  idBoitier?: string;
  nom: string;
  prenom: string;
  organization?: string;
  identificationCode?: string;
  // Les champs comme score, reussite ne sont pas nécessaires pour la génération de la diapo liste participants
}

export interface IntroSlideLayoutNames {
  titleLayoutName?: string;
  participantsLayoutName?: string;
  instructionsLayoutName?: string;
}

export interface ConfigOptions {
  pollStartMode?: string;
  chartValueLabelFormat?: string;
  answersBulletStyle?: string;
  pollTimeLimit?: number;
  pollCountdownStartMode?: string;
  pollMultipleResponse?: string;
  // Add other fields as necessary based on your original types.ts
}

export interface GenerationOptions {
  fileName?: string;
  defaultDuration?: number;
  ombeaConfig?: ConfigOptions;
  introSlideLayouts?: IntroSlideLayoutNames;
  // Add other fields as necessary
}

// Interface Question for this generator, adapted from your description
export interface Val17Question {
  dbQuestionId: number; // ID de la question depuis la base de données
  question: string;
  options: string[];
  correctAnswerIndex?: number; // 0-based index
  imageUrl?: string;
  points?: number; // Corresponds to timeLimit from StoredQuestion, used for duration
  theme: string; // AJOUTÉ - pour stocker le thème original complet (ex: "securite_A")
}

// Structure pour le mappage retourné - Assurer l'export
export interface QuestionMapping { // Déjà exporté, c'est bien.
  dbQuestionId: number;
  slideGuid: string | null;
  orderInPptx: number;
  theme: string;   // AJOUTÉ (sera le thème de base, ex: "securite")
  blockId: string; // AJOUTÉ (sera l'ID du bloc, ex: "A")
  // title?: string; // Optionnel pour debug, peut être retiré
}

interface TagInfo {
  tagNumber: number;
  fileName: string;
  content: string;
}

interface RIdMapping {
  rId: string;
  type: string;
  target: string;
  originalRId?: string; // Added originalRId for mapping
}

interface AppXmlMetadata {
  totalSlides: number;
  totalWords: number;
  totalParagraphs: number;
  slideTitles: string[];
  fonts: string[];
  themes: string[];
}

interface SlideSizeAttributes {
  cx: string;
  cy: string;
  type?: string;
}

interface ImageDimensions {
  x: number;
  y: number;
  width: number;
  height: number;
}



// Ré-exporter QuestionMapping pour qu'il soit utilisable par d'autres modules



function generateGUID(logger: ILogger): string {
  logger.info('[LOG][val17PptxGenerator] Début de generateGUID.');
  const result = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16).toUpperCase();
  });
  logger.info('[LOG][val17PptxGenerator] Fin de generateGUID.');
  return result;
}

function escapeXml(unsafe: string, logger: ILogger): string {
  logger.info('[LOG][val17PptxGenerator] Début de escapeXml.');
  if (typeof unsafe !== "string") {
    if (unsafe === null || unsafe === undefined) return "";
    unsafe = String(unsafe);
  }
  const cleaned = unsafe.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  const result = cleaned
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/--/g, "—");
  logger.info('[LOG][val17PptxGenerator] Fin de escapeXml.');
  return result;
}

function countExistingSlides(zip: JSZip, logger: ILogger): number {
  logger.info('[LOG][val17PptxGenerator] Début de countExistingSlides.');
  let count = 0;
  zip.folder("ppt/slides")?.forEach((relativePath) => {
    if (
      relativePath.match(/^slide\d+\.xml$/) &&
      !relativePath.includes("_rels")
    ) {
      count++;
    }
  });
  logger.info(`[LOG][val17PptxGenerator] Fin de countExistingSlides: ${count} slides trouvées.`);
  return count;
}

function validateQuestions(questions: Val17Question[], logger: ILogger): void {
  logger.info('[LOG][val17PptxGenerator] Début de validateQuestions.');
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("Au moins une question est requise");
  }
  questions.forEach((question, index) => {
    if (
      !question.question ||
      typeof question.question !== "string" ||
      question.question.trim() === ""
    ) {
      throw new Error(
        `Question ${index + 1}: Le texte de la question est requis`
      );
    }
    if (!Array.isArray(question.options) || question.options.length === 0) {
      throw new Error(`Question ${index + 1}: doit avoir au moins une option`);
    }
    if (question.options.length > 10) {
      throw new Error(
        `Question ${index + 1}: ne peut pas avoir plus de 10 options`
      );
    }
    if (
      question.correctAnswerIndex !== undefined &&
      (typeof question.correctAnswerIndex !== "number" ||
        question.correctAnswerIndex < 0 ||
        question.correctAnswerIndex >= question.options.length)
    ) {
      throw new Error(`Question ${index + 1}: correctAnswerIndex invalide`);
    }
  });
  logger.info('[LOG][val17PptxGenerator] Fin de validateQuestions.');
}

function calculateImageDimensions(
  originalWidth: number,
  originalHeight: number,
  logger: ILogger
): ImageDimensions {
  logger.info('[LOG][val17PptxGenerator] Début de calculateImageDimensions.');
  const imageAreaX = 5486400;
  const imageAreaY = 1600200;
  const imageAreaWidth = 3000000;
  const imageAreaHeight = 3000000;
  const imageRatio = originalWidth / originalHeight;
  const areaRatio = imageAreaWidth / imageAreaHeight;
  let finalWidth: number;
  let finalHeight: number;

  if (imageRatio > areaRatio) {
    finalWidth = imageAreaWidth;
    finalHeight = Math.round(finalWidth / imageRatio);
  } else {
    finalHeight = imageAreaHeight;
    finalWidth = Math.round(finalHeight * imageRatio);
  }
  const offsetX = Math.round((imageAreaWidth - finalWidth) / 2);
  const offsetY = Math.round((imageAreaHeight - finalHeight) / 2);

  const result = {
    x: imageAreaX + offsetX,
    y: imageAreaY + offsetY,
    width: finalWidth,
    height: finalHeight,
  };
  logger.info('[LOG][val17PptxGenerator] Fin de calculateImageDimensions.');
  return result;
}

function processCloudUrl(url: string, logger: ILogger): string {
  logger.info('[LOG][val17PptxGenerator] Début de processCloudUrl.');
  try {
    if (url.includes("dropbox.com")) {
      return url.replace("?dl=0", "?dl=1");
    }
    return url;
  } catch (error) {
    logger.error(`Erreur lors du traitement de l'URL: ${error}`);
    return url;
  } finally {
    logger.info('[LOG][val17PptxGenerator] Fin de processCloudUrl.');
  }
}

async function loadLocalImageWithDimensions(filePath: string, logger: ILogger): Promise<{
  data: Buffer;
  extension: string;
  width: number;
  height: number;
} | null> {
  logger.info(`[LOG][val17PptxGenerator] Début de loadLocalImageWithDimensions pour ${filePath}.`);
  try {
    const imageBuffer = fs.readFileSync(filePath);
    const dimensions = sizeOf(imageBuffer);
    const extension = path.extname(filePath).substring(1) || 'jpg';
    const result = {
      data: imageBuffer,
      extension: extension,
      width: dimensions.width || 1920,
      height: dimensions.height || 1080,
    };
    logger.info(`[LOG][val17PptxGenerator] Fin de loadLocalImageWithDimensions pour ${filePath}.`);
    return result;
  } catch (error) {
    logger.error(`Erreur lors du chargement de l'image locale : ${error}`);
    return null;
  }
}

async function downloadImageFromCloudWithDimensions(url: string, logger: ILogger): Promise<{
  data: Buffer;
  extension: string;
  width: number;
  height: number;
} | null> {
  logger.info(`[LOG][val17PptxGenerator] Début de downloadImageFromCloudWithDimensions pour ${url}.`);
  try {
    let finalUrl = url;
    if (url.includes("dropbox.com")) {
      finalUrl = processCloudUrl(url, logger);
    }
    const response = await fetch(finalUrl);
    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}: ${response.statusText} for ${finalUrl}`
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);
    const dimensions = sizeOf(imageBuffer);
    const extension = dimensions.type || 'jpg';

    const result = {
      data: imageBuffer,
      extension,
      width: dimensions.width || 1920,
      height: dimensions.height || 1080,
    };
    logger.info(`[LOG][val17PptxGenerator] Fin de downloadImageFromCloudWithDimensions pour ${url}.`);
    return result;
  } catch (error) {
    logger.error(`[IMAGE] ✗ Échec pour ${url}: ${error}`);
    return null;
  }
}

function updateContentTypesForImages(
  content: string,
  imageExtensions: Set<string>,
  logger: ILogger
): string {
  logger.info('[LOG][val17PptxGenerator] Début de updateContentTypesForImages.');
  let updated = content;
  imageExtensions.forEach((ext) => {
    if (!updated.includes(`Extension="${ext}"`)) {
      let contentType = "image/jpeg"; // Default
      if (ext === "png") contentType = "image/png";
      else if (ext === "gif") contentType = "image/gif";
      else if (ext === "bmp") contentType = "image/bmp";
      else if (ext === "svg") contentType = "image/svg+xml";
      else if (ext === "webp") contentType = "image/webp";

      const insertPoint = updated.indexOf("<Override");
      if (insertPoint > -1) {
        const newDefault = `\n<Default Extension="${ext}" ContentType="${contentType}"/>`;
        updated =
          updated.slice(0, insertPoint) +
          newDefault +
          updated.slice(insertPoint);
      } else {
        const typesEnd = updated.lastIndexOf("</Types>");
        if (typesEnd > -1) {
          const newDefault = `\n<Default Extension="${ext}" ContentType="${contentType}"/>`;
          updated =
            updated.slice(0, typesEnd) + newDefault + updated.slice(typesEnd);
        }
      }
    }
  });
  logger.info('[LOG][val17PptxGenerator] Fin de updateContentTypesForImages.');
  return updated;
}

async function findNextAvailableSlideLayoutId(
  zip: JSZip,
  logger: ILogger
): Promise<{ layoutId: number; layoutFileName: string; rId: string }> {
  logger.info('[LOG][val17PptxGenerator] Début de findNextAvailableSlideLayoutId.');
  const masterRelsFile = zip.file(
    "ppt/slideMasters/_rels/slideMaster1.xml.rels"
  );
  if (!masterRelsFile) throw new Error("slideMaster1.xml.rels non trouvé");

  const masterRelsContent = await masterRelsFile.async("string");
  const layoutMatches = masterRelsContent.match(/slideLayout\d+\.xml/g) || [];
  let maxLayoutNum = 0;
  layoutMatches.forEach((match) => {
    const numPart = match.match(/slideLayout(\d+)\.xml/);
    const num = numPart ? parseInt(numPart[1], 10) : 0;
    if (num > maxLayoutNum) maxLayoutNum = num;
  });
  const nextLayoutNum = maxLayoutNum + 1;
  const allRIds = extractExistingRIds(masterRelsContent, logger);
  const existingRIds = allRIds.map((m) => m.rId);
  const nextRId = getNextAvailableRId(existingRIds, logger);
  logger.info('[LOG][val17PptxGenerator] Fin de findNextAvailableSlideLayoutId.');
  return {
    layoutId: nextLayoutNum,
    layoutFileName: `slideLayout${nextLayoutNum}.xml`,
    rId: nextRId,
  };
}

async function ensureOmbeaSlideLayoutExists(
  zip: JSZip,
  logger: ILogger
): Promise<{ layoutFileName: string; layoutRId: string }> {
  logger.info('[LOG][val17PptxGenerator] Début de ensureOmbeaSlideLayoutExists.');
  const { layoutId, layoutFileName, rId } =
    await findNextAvailableSlideLayoutId(zip, logger);
  const slideLayoutContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="tx" preserve="1"><p:cSld name="Titre et texte"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="Titre 1"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR" smtClean="0"/><a:t>Modifiez le style du titre</a:t></a:r><a:endParaRPr lang="fr-FR"/></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Espace réservé du texte 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr lvl="0"/><a:r><a:rPr lang="fr-FR" smtClean="0"/><a:t>Modifiez les styles du texte du masque</a:t></a:r></a:p><a:p><a:pPr lvl="1"/><a:r><a:rPr lang="fr-FR" smtClean="0"/><a:t>Deuxième niveau</a:t></a:r></a:p><a:p><a:pPr lvl="2"/><a:r><a:rPr lang="fr-FR" smtClean="0"/><a:t>Troisième niveau</a:t></a:r></a:p><a:p><a:pPr lvl="3"/><a:r><a:rPr lang="fr-FR" smtClean="0"/><a:t>Quatrième niveau</a:t></a:r></a:p><a:p><a:pPr lvl="4"/><a:r><a:rPr lang="fr-FR" smtClean="0"/><a:t>Cinquième niveau</a:t></a:r><a:endParaRPr lang="fr-FR"/></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="4" name="Espace réservé de la date 3"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="dt" sz="half" idx="10"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:fld id="{ABB4FD2C-0372-488A-B992-EB1BD753A34A}" type="datetimeFigureOut"><a:rPr lang="fr-FR" smtClean=... [truncated]
    Math.floor(Math.random() * 2147483647) + 1
  }"/></p:ext></p:extLst></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
  zip.file(`ppt/slideLayouts/${layoutFileName}`, slideLayoutContent);
  const slideLayoutRelsContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`;
  zip.file(
    `ppt/slideLayouts/_rels/${layoutFileName}.rels`,
    slideLayoutRelsContent
  );
  await updateSlideMasterRelsForNewLayout(zip, layoutFileName, rId, logger);
  await updateSlideMasterForNewLayout(zip, layoutId, rId, logger);
  await updateContentTypesForNewLayout(zip, layoutFileName, logger);
  logger.info('[LOG][val17PptxGenerator] Fin de ensureOmbeaSlideLayoutExists.');
  return { layoutFileName: layoutFileName, layoutRId: rId };
}

async function updateSlideMasterRelsForNewLayout(
  zip: JSZip,
  layoutFileName: string,
  rId: string,
  logger: ILogger
): Promise<void> {
  logger.info('[LOG][val17PptxGenerator] Début de updateSlideMasterRelsForNewLayout.');
  const masterRelsFile = zip.file(
    "ppt/slideMasters/_rels/slideMaster1.xml.rels"
  );
  if (masterRelsFile) {
    let content = await masterRelsFile.async("string");
    const insertPoint = content.lastIndexOf("</Relationships>");
    const newRel = `\n  <Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/${layoutFileName}"/>`;
    content =
      content.slice(0, insertPoint) +
      newRel +
      "\n" +
      content.slice(insertPoint);
    zip.file("ppt/slideMasters/_rels/slideMaster1.xml.rels", content);
  }
  logger.info('[LOG][val17PptxGenerator] Fin de updateSlideMasterRelsForNewLayout.');
}

async function updateSlideMasterForNewLayout(
  zip: JSZip,
  layoutId: number,
  rId: string,
  logger: ILogger
): Promise<void> {
  logger.info('[LOG][val17PptxGenerator] Début de updateSlideMasterForNewLayout.');
  const masterFile = zip.file("ppt/slideMasters/slideMaster1.xml");
  if (masterFile) {
    let content = await masterFile.async("string");
    const layoutIdLstEnd = content.indexOf("</p:sldLayoutIdLst>");
    if (layoutIdLstEnd > -1) {
      const layoutIdValue = 2147483648 + layoutId;
      const newLayoutId = `\n    <p:sldLayoutId id="${layoutIdValue}" r:id="${rId}"/>`;
      content =
        content.slice(0, layoutIdLstEnd) +
        newLayoutId +
        "\n  " +
        content.slice(layoutIdLstEnd);
      zip.file("ppt/slideMasters/slideMaster1.xml", content);
    }
  }
  logger.info('[LOG][val17PptxGenerator] Fin de updateSlideMasterForNewLayout.');
}

async function updateContentTypesForNewLayout(
  zip: JSZip,
  layoutFileName: string,
  logger: ILogger
): Promise<void> {
  logger.info('[LOG][val17PptxGenerator] Début de updateContentTypesForNewLayout.');
  const contentTypesFile = zip.file("[Content_Types].xml");
  if (contentTypesFile) {
    let content = await contentTypesFile.async("string");
    if (!content.includes(layoutFileName)) {
      const lastLayoutIndex = content.lastIndexOf("slideLayout");
      let insertPoint = -1;
      if (lastLayoutIndex > -1)
        insertPoint = content.indexOf("/>", lastLayoutIndex) + 2;
      else insertPoint = content.lastIndexOf("</Types>");

      if (insertPoint > -1) {
        const newOverride = `\n  <Override PartName="/ppt/slideLayouts/${layoutFileName}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>`;
        content =
          content.slice(0, insertPoint) +
          newOverride +
          content.slice(insertPoint);
        zip.file("[Content_Types].xml", content);
      }
    }
  }
  logger.info('[LOG][val17PptxGenerator] Fin de updateContentTypesForNewLayout.');
}

function createIntroTitleSlideXml(
  sessionInfo: SessionInfo,
  slideNumber: number,
  logger: ILogger
): string {
  logger.info('[LOG][val17PptxGenerator] Début de createIntroTitleSlideXml.');
  const slideComment = `<!-- Intro Slide ${slideNumber}: Title -->`;
  const baseId = slideNumber * 1000;
  const titlePlaceholder = `<p:sp>\n    <p:nvSpPr>\n      <p:cNvPr id="${baseId + 1}" name="Title Placeholder"/>\n      <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>\n      <p:nvPr><p:ph type="title"/></p:nvPr>\n    </p:nvSpPr>\n    <p:spPr/>\n    <p:txBody>\n      <a:bodyPr/><a:lstStyle/>\n      <a:p><a:r><a:rPr lang="fr-FR"/><a:t>${escapeXml(
    sessionInfo.title,
    logger
  )}</a:t></a:r></a:p>\n    </p:txBody>\n  </p:sp>`;

  const datePlaceholder = sessionInfo.date
    ? `<p:sp>\n    <p:nvSpPr>\n      <p:cNvPr id="${baseId + 2}" name="Subtitle Placeholder"/>\n      <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>\n      <p:nvPr><p:ph type="body" idx="1"/></p:nvPr>\n    </p:nvSpPr>\n    <p:spPr/>\n    <p:txBody>\n      <a:bodyPr/><a:lstStyle/>\n      <a:p><a:r><a:rPr lang="fr-FR"/><a:t>${escapeXml(
        sessionInfo.date,
        logger
      )}</a:t></a:r></a:p>\n    </p:txBody>\n  </p:sp>`
    : "";

  const result = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n  ${slideComment}\n  <p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">\n    <p:cSld>\n      <p:spTree>\n        <p:nvGrpSpPr>\n          <p:cNvPr id="${baseId}" name="Intro Title Group"/>\n          <p:cNvGrpSpPr/><p:nvPr/>\n        </p:nvGrpSpPr>\n        <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>\n        ${titlePlaceholder}\n        ${datePlaceholder}\n      </p:spTree>\n    </p:cSld>\n    <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>\n  </p:sld>`;
  logger.info('[LOG][val17PptxGenerator] Fin de createIntroTitleSlideXml.');
  return result;
}

function generateTableRowsXml(
  participants: ParticipantForGenerator[],
  rowHeightEMU: number = 370840,
  logger: ILogger
): string {
  logger.info('[LOG][val17PptxGenerator] Début de generateTableRowsXml.');
  let tableRowsXml = "";
  const hasOrganizationData = participants.some(p => p.organization && p.organization.trim() !== "");

  tableRowsXml += `<a:tr h="${rowHeightEMU}">`;
  const headers = ["N°", "ID Boîtier", "Nom", "Prénom"];
  if (hasOrganizationData) {
    headers.push("Organisation");
  }

  headers.forEach(headerText => {
    tableRowsXml += `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr b="1" lang="fr-FR"/><a:t>${escapeXml(headerText, logger)}</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>`;
  });
  tableRowsXml += `</a:tr>`;

  participants.forEach((participant, index) => {
    tableRowsXml += `<a:tr h="${rowHeightEMU}">`;
    tableRowsXml += `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR"/><a:t>${index + 1}</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>`;
    tableRowsXml += `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR"/><a:t>${escapeXml(participant.idBoitier || "", logger)}</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>`;
    tableRowsXml += `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR"/><a:t>${escapeXml(participant.nom || "", logger)}</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>`;
    tableRowsXml += `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR"/><a:t>${escapeXml(participant.prenom || "", logger)}</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>`;
    if (hasOrganizationData) {
      tableRowsXml += `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR"/><a:t>${escapeXml(participant.organization || "", logger)}</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>`;
    }
    tableRowsXml += `</a:tr>`;
  });
  logger.info('[LOG][val17PptxGenerator] Fin de generateTableRowsXml.');
  return tableRowsXml;
}

function generateTableGraphicFrame(participants: ParticipantForGenerator[], baseSpId: number, logger: ILogger): string {
    logger.info('[LOG][val17PptxGenerator] Début de generateTableGraphicFrame.');
    const hasOrganizationData = participants.some(p => p.organization && p.organization.trim() !== "");

    const slideWidthEMU = 12192000;
    const slideHeightEMU = 6858000;
    const tableWidthRatio = 0.85;
    const tableCx = Math.round(slideWidthEMU * tableWidthRatio);
    const rowHeightEMU = 370840;
    const headerRowCount = 1;
    let tableCy = rowHeightEMU * (participants.length + headerRowCount);
    const tableX = Math.round((slideWidthEMU - tableCx) / 2);
    let tableY = Math.round((slideHeightEMU - tableCy) / 2);
    const minTableY = 1200000;
    if (tableY < minTableY) {
        tableY = minTableY;
    }
    if (tableY + tableCy > slideHeightEMU) {
        tableCy = slideHeightEMU - tableY - 182880;
    }

    const colWidths = [];
    if (hasOrganizationData) {
        colWidths.push(Math.round(tableCx * 0.06));
        colWidths.push(Math.round(tableCx * 0.20));
        colWidths.push(Math.round(tableCx * 0.27));
        colWidths.push(Math.round(tableCx * 0.27));
        colWidths.push(Math.round(tableCx * 0.20));
    } else {
        colWidths.push(Math.round(tableCx * 0.08));
        colWidths.push(Math.round(tableCx * 0.25));
        colWidths.push(Math.round(tableCx * 0.335));
        colWidths.push(Math.round(tableCx * 0.335));
    }
    const sumWidths = colWidths.reduce((a, b) => a + b, 0);
    if (sumWidths !== tableCx && colWidths.length > 0) {
        colWidths[colWidths.length - 1] += (tableCx - sumWidths);
    }

    const tableRows = generateTableRowsXml(participants, rowHeightEMU, logger);

    let tableXml = `<p:graphicFrame>\n      <p:nvGraphicFramePr>\n        <p:cNvPr id="${baseSpId}" name="Tableau Participants"/>\n        <p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr>\n        <p:nvPr/>\n      </p:nvGraphicFramePr>\n      <p:xfrm>\n        <a:off x="${tableX}" y="${tableY}"/>\n        <a:ext cx="${tableCx}" cy="${tableCy}"/>\n      </p:xfrm>\n      <a:graphic>\n        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">\n          <a:tbl>\n            <a:tblPr firstRow="1" bandRow="1">\n              <a:tableStyleId>{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}</a:tableStyleId>\n            </a:tblPr>\n            <a:tblGrid>`;
    colWidths.forEach(w => { tableXml += `<a:gridCol w="${w}"/>`; });
    tableXml += `</a:tblGrid>${tableRows}</a:tbl>\n        </a:graphicData>\n      </a:graphic>\n    </p:graphicFrame>`;
    logger.info('[LOG][val17PptxGenerator] Fin de generateTableGraphicFrame.');
    return tableXml;
}

function createIntroParticipantsSlideXml(
  participants: ParticipantForGenerator[],
  slideNumber: number,
  layoutPptxFilePath: string | null,
  layoutGraphicFrameTarget: string | null,
  layoutTblPr: string | null,
  layoutTblGrid: string | null,
  logger: ILogger
): string {
  logger.info('[LOG][val17PptxGenerator] Début de createIntroParticipantsSlideXml.');
  const slideComment = `<!-- Intro Slide ${slideNumber}: Participants -->`;
  const titleTextToSet = "Participants";

  let finalSlideXml = "";

  if (layoutGraphicFrameTarget && layoutTblPr && layoutTblGrid) {
    logger.debug("[DEBUG_PART_SLIDE_XML] Utilisation du tableau et du layout fournis.");
    const tableRows = generateTableRowsXml(participants, undefined, logger);

    // Re-créer le contenu de <a:tbl>
    const newTblContent = `${layoutTblPr}${layoutTblGrid}${tableRows}`;

    // Remplacer l'ancien <a:tbl> par le nouveau
    const graphicFrameWithNewTable = layoutGraphicFrameTarget.replace(
        /<a:tbl>[\s\S]*?<\/a:tbl>/,
        `<a:tbl>${newTblContent}</a:tbl>`
    );

    // Construire une structure de diapositive propre
    const spTreeContent = `
        <p:nvGrpSpPr>
          <p:cNvPr id="${slideNumber * 1000}" name="Content Group"/>
          <p:cNvGrpSpPr/><p:nvPr/>
        </p:nvGrpSpPr>
        <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
        <p:sp>
          <p:nvSpPr>
            <p:cNvPr id="${slideNumber * 1000 + 1}" name="Title"/>
            <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
            <p:nvPr><p:ph type="title"/></p:nvPr>
          </p:nvSpPr>
          <p:spPr/>
          <p:txBody>
            <a:bodyPr/><a:lstStyle/>
            <a:p><a:r><a:rPr lang="fr-FR"/><a:t>${escapeXml(titleTextToSet, logger)}</a:t></a:r></a:p>
          </p:txBody>
        </p:sp>
        ${graphicFrameWithNewTable}
    `;

    finalSlideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    ${slideComment}
    <p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
      <p:cSld name="${layoutPptxFilePath ? path.basename(layoutPptxFilePath, '.xml') : 'ParticipantsLayout'}">
        <p:spTree>${spTreeContent}</p:spTree>
      </p:cSld>
      <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
    </p:sld>`;

    logger.debug(`[DEBUG_PART_SLIDE_XML] Final generated XML for participants slide (v3): ${finalSlideXml.substring(0, 1500)}...`);

  } else {
    logger.debug("[DEBUG_PART_SLIDE_XML] Fallback: Génération dynamique complète du tableau des participants.");
    const dynamicTableGraphicFrame = generateTableGraphicFrame(participants, slideNumber * 1000 + 2, logger);

    finalSlideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n    ${slideComment}\n    <p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">\n      <p:cSld name="${layoutPptxFilePath ? path.basename(layoutPptxFilePath, '.xml') : 'ParticipantsLayout'}">\n        <p:spTree>\n          <p:nvGrpSpPr>\n            <p:cNvPr id="${slideNumber * 1000}" name="Content Group"/>\n            <p:cNvGrpSpPr/><p:nvPr/>\n          </p:nvGrpSpPr>\n          <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>\n          <p:sp>\n            <p:nvSpPr>\n              <p:cNvPr id="${slideNumber * 1000 + 1}" name="Title"/>\n              <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>\n              <p:nvPr><p:ph type="title"/></p:nvPr>\n            </p:nvSpPr>\n            <p:spPr/>\n            <p:txBody>\n              <a:bodyPr/><a:lstStyle/>\n              <a:p><a:r><a:rPr lang="fr-FR"/><a:t>${escapeXml(titleTextToSet, logger)}</a:t></a:r></a:p>\n            </p:txBody>\n          </p:sp>\n          ${dynamicTableGraphicFrame}\n        </p:spTree>\n      </p:cSld>\n      <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>\n    </p:sld>`;
  }
  logger.info('[LOG][val17PptxGenerator] Fin de createIntroParticipantsSlideXml.');
  return finalSlideXml;
}

// function createIntroInstructionsSlideXml( // Unused
//   slideNumber: number,
//   instructionsText?: string
// ): string {
//   const slideComment = `<!-- Intro Slide ${slideNumber}: Instructions -->`;
//   const baseId = slideNumber * 1000;
//   const defaultInstructions =
//     "Instructions de vote :\n1. Connectez-vous...\n2. Votez...\n3. Amusez-vous !";
//   const currentInstructionsText = instructionsText || defaultInstructions;
//   const titleText = "Instructions";
//   const titlePlaceholder = `<p:sp>\n    <p:nvSpPr>\n      <p:cNvPr id="${baseId + 1}" name="Title Placeholder"/>\n      <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>\n      <p:nvPr><p:ph type="title"/></p:nvPr>\n    </p:nvSpPr>\n    <p:spPr/>\n    <p:txBody>\n      <a:bodyPr/><a:lstStyle/>\n      <a:p><a:r><a:rPr lang="fr-FR"/><a:t>${escapeXml(
//         titleText
//       )}</a:t></a:r></a:p>\n    </p:txBody>\n  </p:sp>`;
//
//   const instructionsBodyXml = currentInstructionsText
//     .split("\n")
//     .map(
//       (line) =>
//         `<a:p><a:r><a:rPr lang="fr-FR"/><a:t>${escapeXml(
//           line
//         )}</a:t></a:r></a:p>`
//     )
//     .join("");
//
//   const bodyPlaceholder = `<p:sp>\n    <p:nvSpPr>\n      <p:cNvPr id="${baseId + 2}" name="Body Placeholder"/>\n      <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>\n      <p:nvPr><p:ph type="body" idx="1"/></p:nvPr>\n    </p:nvSpPr>\n    <p:spPr/>\n    <p:txBody>\n      <a:bodyPr/><a:lstStyle/>\n      ${instructionsBodyXml}\n    </p:txBody>\n  </p:sp>`;
//
//   return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n  ${slideComment}\n  <p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">\n    <p:cSld>\n      <p:spTree>\n        <p:nvGrpSpPr>\n          <p:cNvPr id="${baseId}" name="Intro Instructions Group"/>\n          <p:cNvGrpSpPr/><p:nvPr/>\n        </p:nvGrpSpPr>\n        <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>\n        ${titlePlaceholder}\n        ${bodyPlaceholder}\n      </p:spTree>\n    </p:cSld>\n    <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>\n  </p:sld>`;
// }

function createSlideXml(
  question: string,
  options: string[],
  slideNumber: number,
  duration: number = 30,
  logger: ILogger,
  imageDimensions?: ImageDimensions,
  ombeaConfig?: ConfigOptions
): string {
  logger.info(`[LOG][val17PptxGenerator] Début de createSlideXml pour la slide ${slideNumber}.`);
  const slideComment = `<!-- Slide ${slideNumber} -->`;
  const grpId = 1;
  const titleId = 2;
  const bodyId = 3;
  const countdownId = 4;
  const imageId = 5;

  const countdownDisplayText =
    ombeaConfig?.pollTimeLimit !== undefined
      ? ombeaConfig.pollTimeLimit
      : duration;

  let bulletTypeForXml = "arabicPeriod";
  if (ombeaConfig?.answersBulletStyle) {
    const styleMap: Record<string, string> = {
      ppBulletAlphaUCParenRight: "alphaUcParenR",
      ppBulletAlphaUCPeriod: "alphaUcPeriod",
      ppBulletArabicParenRight: "arabicParenR",
      ppBulletArabicPeriod: "arabicPeriod",
    };
    bulletTypeForXml =
      styleMap[ombeaConfig.answersBulletStyle] || "arabicPeriod";
  }
  const listStyleXml = `<a:lstStyle><a:lvl1pPr marL="514350" indent="-514350" algn="l"><a:buFontTx/><a:buClrTx/><a:buSzTx/><a:buAutoNum type="${bulletTypeForXml}"/></a:lvl1pPr></a:lstStyle>`;
  const questionLines = question.split('\n');
  const questionXml = questionLines.map((line, index) => {
    const text = escapeXml(line, logger);
    if (index === questionLines.length - 1) {
      return `<a:r><a:rPr lang="fr-FR" dirty="0"/><a:t>${text}</a:t></a:r>`;
    }
    return `<a:r><a:rPr lang="fr-FR" dirty="0"/><a:t>${text}</a:t></a:r><a:br/>`;
  }).join('');

  let xmlContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${slideComment}<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="${grpId}" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="${titleId}" name="Titre ${slideNumber}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/><p:custDataLst><p:tags r:id="rId2"/></p:custDataLst></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p>${questionXml}<a:endParaRPr lang="fr-FR" dirty="0"/></a:p></p:txBody></p:sp>`;
  if (imageDimensions) {
    xmlContent += `<p:pic><p:nvPicPr><p:cNvPr id="${imageId}" name="Image ${slideNumber}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId6"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${imageDimensions.x}" y="${imageDimensions.y}"/><a:ext cx="${imageDimensions.width}" cy="${imageDimensions.height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
  }
  xmlContent += `<p:sp><p:nvSpPr><p:cNvPr id="${bodyId}" name="Espace réservé du texte ${slideNumber}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/><p:custDataLst><p:tags r:id="rId3"/></p:custDataLst></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="1600200"/><a:ext cx="4572000" cy="4525963"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/>${listStyleXml}${options
    .map(
      (option) =>
        `<a:p><a:pPr><a:buFont typeface="+mj-lt"/><a:buAutoNum type="${bulletTypeForXml}"/></a:pPr><a:r><a:rPr lang="fr-FR"/><a:t>${escapeXml(
          option, logger
        )}</a:t></a:r></a:p>`
    )
    .join("")}</p:txBody></p:sp>`;;
  if (Number(countdownDisplayText) > 0) {
    xmlContent += `<p:sp><p:nvSpPr><p:cNvPr id="${countdownId}" name="OMBEA Countdown ${slideNumber}"/><p:cNvSpPr txBox="1"/><p:nvPr><p:custDataLst><p:tags r:id="rId4"/></p:custDataLst></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="7380000" y="3722400"/><a:ext cx="1524000" cy="769441"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr vert="horz" rtlCol="0" anchor="ctr" anchorCtr="1"><a:spAutoFit/></a:bodyPr><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR" sz="4400" smtClean="0"/><a:t>${String(
      countdownDisplayText
    )}</a:t></a:r><a:endParaRPr lang="fr-FR" sz="4400"/></a:p></p:txBody></p:sp>`;
  }
  xmlContent += `</p:spTree><p:custDataLst><p:tags r:id="rId1"/></p:custDataLst><p:extLst><p:ext uri="{BB962C8B-B14F-4D97-AF65-F5344CB8AC3E}"><p14:creationId xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" val="${
    Math.floor(Math.random() * 2147483647) + 1
  }"/></p:ext></p:extLst></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr><p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"/></p:par></p:tnLst></p:timing></p:sld>`;
  logger.info(`[LOG][val17PptxGenerator] Fin de createSlideXml pour la slide ${slideNumber}.`);
  return xmlContent;
}

function calculateBaseTagNumber(
  slideNumberInBatch: number,
  tagOffset: number = 0,
  logger: ILogger
): number {
  logger.info('[LOG][val17PptxGenerator] Début de calculateBaseTagNumber.');
  const result = tagOffset + 1 + (slideNumberInBatch - 1) * 4;
  logger.info('[LOG][val17PptxGenerator] Fin de calculateBaseTagNumber.');
  return result;
}

function findHighestExistingTagNumber(zip: JSZip, logger: ILogger): number {
  logger.info('[LOG][val17PptxGenerator] Début de findHighestExistingTagNumber.');
  let maxTagNumber = 0;
  const tagsFolder = zip.folder("ppt/tags");
  if (tagsFolder) {
    tagsFolder.forEach((relativePath) => {
      const match = relativePath.match(/tag(\d+)\.xml$/);
      if (match && match[1]) {
        const tagNum = parseInt(match[1], 10);
        if (tagNum > maxTagNumber) maxTagNumber = tagNum;
      }
    });
  }
  logger.info(`[LOG][val17PptxGenerator] Fin de findHighestExistingTagNumber: ${maxTagNumber} tags trouvés.`);
  return maxTagNumber;
}

async function findLayoutByCSldName(
  zip: JSZip,
  targetName: string,
  layoutType: "title" | "participants",
  logger: ILogger
): Promise<string | null> {
  logger.info(`[LOG][val17PptxGenerator] Début de findLayoutByCSldName pour ${targetName}.`);
  const layoutsFolder = zip.folder("ppt/slideLayouts");
  if (!layoutsFolder) {
    return null;
  }

  const normalizedTargetName = targetName.toLowerCase().replace(/\s+/g, "");
  let aliases: string[] = [];
  if (layoutType === "title") {
    aliases = [
      "title", "titre",
      "titlelayout", "titrelayout",
      "titleslidelayout", "titreslidelayout"
    ];
  } else if (layoutType === "participants") {
    aliases = [
      "participant", "participants",
      "participantlayout", "participantslayout",
      "participantslidelayout","participantsslidelayout",
      "participantsslidelayout"
    ];
  }

  const files = layoutsFolder.filter((relativePathEntry) => relativePathEntry.endsWith(".xml") && !relativePathEntry.includes("/_rels/"));

  for (const fileEntry of files) {
    if (fileEntry) {
      try {
        const content = await fileEntry.async("string");
        const nameMatch = content.match(/<p:cSld[^>]*name="([^"]+)"/);

        if (nameMatch && nameMatch[1]) {
          const cSldNameAttr = nameMatch[1];
          const normalizedCSldNameAttr = cSldNameAttr.toLowerCase().replace(/\s+/g, "");

          if (normalizedCSldNameAttr === normalizedTargetName) {
            logger.info(`[LOG][val17PptxGenerator] Fin de findLayoutByCSldName: ${fileEntry.name} trouvé.`);
            return fileEntry.name;
          }

          for (const alias of aliases) {
            const normalizedAlias = alias.toLowerCase().replace(/\s+/g,"");
            if (normalizedCSldNameAttr.includes(normalizedAlias)) {
              let targetMatchesAliasOrType = false;
              if (normalizedTargetName.includes(normalizedAlias)) {
                targetMatchesAliasOrType = true;
              } else {
                 if (layoutType === 'title' && (normalizedTargetName.includes('title') || normalizedTargetName.includes('titre'))) {
                    targetMatchesAliasOrType = true;
                 } else if (layoutType === 'participants' && (normalizedTargetName.includes('participant') || normalizedTargetName.includes('participants'))) {
                    targetMatchesAliasOrType = true;
                 }
              }

              if (targetMatchesAliasOrType) {
                logger.info(`[LOG][val17PptxGenerator] Fin de findLayoutByCSldName: ${fileEntry.name} trouvé par alias.`);
                return fileEntry.name;
              }
            }
          }
        }
       } catch (_error) {

      }
    }
  }
  logger.info(`[LOG][val17PptxGenerator] Fin de findLayoutByCSldName: aucun layout trouvé.`);
  return null;
}

function ensureTagContinuity(
  zip: JSZip,
  startingTag: number,
  endingTag: number,
  logger: ILogger
): string[] {
  logger.info('[LOG][val17PptxGenerator] Début de ensureTagContinuity.');
  const warnings: string[] = [];
  for (let i = startingTag; i <= endingTag; i++) {
    if (!zip.file(`ppt/tags/tag${i}.xml`)) {
      warnings.push(`Attention: tag${i}.xml manquant dans la séquence`);
    }
  }
  logger.info('[LOG][val17PptxGenerator] Fin de ensureTagContinuity.');
  return warnings;
}

function createSlideTagFiles(
  questionIndexInBatch: number,
  options: string[],
  correctAnswerIndex: number | undefined,
  duration: number,
  ombeaConfig: ConfigOptions | undefined,
  logger: ILogger,
  tagOffset: number = 0
): TagInfo[] {
  logger.info(`[LOG][val17PptxGenerator] Début de createSlideTagFiles pour la question ${questionIndexInBatch}.`);
  const baseTagNumber = calculateBaseTagNumber(questionIndexInBatch, tagOffset, logger);
    const slideGuid = generateGUID(logger);
  const points = options
    .map((_, index) =>
      correctAnswerIndex !== undefined && index === correctAnswerIndex
        ? "1.00"
        : "0.00"
    )
    .join(",");

  const tags: TagInfo[] = [];
  tags.push({
    tagNumber: baseTagNumber,
    fileName: `tag${baseTagNumber}.xml`,
    content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:tagLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:tag name="OR_SLIDE_GUID" val="${slideGuid}"/><p:tag name="OR_OFFICE_MAJOR_VERSION" val="14"/><p:tag name="OR_POLL_START_MODE" val="${
      ombeaConfig?.pollStartMode || "Automatic"
    }"/><p:tag name="OR_CHART_VALUE_LABEL_FORMAT" val="${
      ombeaConfig?.chartValueLabelFormat || "Response_Count"
    }"/><p:tag name="OR_CHART_RESPONSE_DENOMINATOR" val="Responses"/><p:tag name="OR_CHART_FIXED_RESPONSE_DENOMINATOR" val="100"/><p:tag name="OR_CHART_COLOR_MODE" val="Color_Scheme"/><p:tag name="OR_CHART_APPLY_OMBEA_TEMPLATE" val="True"/><p:tag name="OR_POLL_DEFAULT_ANSWER_OPTION" val="None"/><p:tag name="OR_SLIDE_TYPE" val="OR_QUESTION_SLIDE"/><p:tag name="OR_ANSWERS_BULLET_STYLE" val="${
      ombeaConfig?.answersBulletStyle || "ppBulletArabicPeriod"
    }"/><p:tag name="OR_POLL_FLOW" val="Automatic"/><p:tag name="OR_CHART_DISPLAY_MODE" val="Automatic"/><p:tag name="OR_POLL_TIME_LIMIT" val="${
      ombeaConfig?.pollTimeLimit !== undefined
        ? ombeaConfig.pollTimeLimit
        : duration
    }"/><p:tag name="OR_POLL_COUNTDOWN_START_MODE" val="${
      ombeaConfig?.pollCountdownStartMode || "Automatic"
    }"/><p:tag name="OR_POLL_MULTIPLE_RESPONSES" val="${
      ombeaConfig?.pollMultipleResponse !== undefined
        ? ombeaConfig.pollMultipleResponse
        : "1"
    }"/><p:tag name="OR_POLL_DUPLICATES_ALLOWED" val="False"/><p:tag name="OR_CATEGORIZING" val="False"/><p:tag name="OR_PRIORITY_RANKING" val="False"/><p:tag name="OR_IS_POLLED" val="False"/></p:tagLst>`,
  });
  tags.push({
    tagNumber: baseTagNumber + 1,
    fileName: `tag${baseTagNumber + 1}.xml`,
    content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:tagLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:tag name="OR_SHAPE_TYPE" val="OR_TITLE"/></p:tagLst>`,
  });
  tags.push({
    tagNumber: baseTagNumber + 2,
    fileName: `tag${baseTagNumber + 2}.xml`,
    content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:tagLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:tag name="OR_SHAPE_TYPE" val="OR_ANSWERS"/><p:tag name="OR_ANSWER_POINTS" val="${points}"/><p:tag name="OR_ANSWERS_TEXT" val="${options
      .map(option => escapeXml(option, logger))
      .join("&#13;")}"/></p:tagLst>`,
  });
  tags.push({
    tagNumber: baseTagNumber + 3,
    fileName: `tag${baseTagNumber + 3}.xml`,
    content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:tagLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:tag name="OR_SHAPE_TYPE" val="OR_COUNTDOWN"/></p:tagLst>`,
  });
  logger.info(`[LOG][val17PptxGenerator] Fin de createSlideTagFiles pour la question ${questionIndexInBatch}.`);
  return tags;
}

function extractExistingRIds(relsContent: string, logger: ILogger): RIdMapping[] {
  logger.info('[LOG][val17PptxGenerator] Début de extractExistingRIds.');
  const mappings: RIdMapping[] = [];
  const relationshipRegex = /<Relationship\s+([^>]+)>/g;
  let match;
  while ((match = relationshipRegex.exec(relsContent)) !== null) {
    const attributes = match[1];
    const idMatch = attributes.match(/Id="(rId\d+)"/);
    const typeMatch = attributes.match(/Type="([^"]+)"/);
    const targetMatch = attributes.match(/Target="([^"]+)"/);
    if (idMatch && typeMatch && targetMatch) {
      mappings.push({
        rId: idMatch[1],
        type: typeMatch[1],
        target: targetMatch[1],
      });
    }
  }
  logger.info('[LOG][val17PptxGenerator] Fin de extractExistingRIds.');
  return mappings;
}

function getNextAvailableRId(existingRIds: string[], logger: ILogger): string {
  logger.info('[LOG][val17PptxGenerator] Début de getNextAvailableRId.');
  let maxId = 0;
  existingRIds.forEach((rId) => {
    const match = rId.match(/rId(\d+)/);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (num > maxId) maxId = num;
    }
  });
  const result = `rId${maxId + 1}`;
  logger.info('[LOG][val17PptxGenerator] Fin de getNextAvailableRId.');
  return result;
}

async function updatePresentationRelsWithMappings(
  zip: JSZip,
  originalContent: string,
  initialExistingSlideCount: number,
  introSlideDetails: {
    slideNumber: number;
    layoutRIdInSlide: string;
    layoutFileName: string;
  }[],
  newOmbeaQuestionCount: number,
  logger: ILogger
): Promise<{
  updatedContent: string;
  slideRIdMappings: { slideNumber: number; rId: string }[];
  oldToNewRIdMap: { [oldRId: string]: string };
  orderedSlides: { rId: string, target: string }[];
}> {
  logger.info('[LOG][val17PptxGenerator] Début de updatePresentationRelsWithMappings.');
  const existingRels = extractExistingRIds(originalContent, logger);
  const finalRelsOutput: RIdMapping[] = [];
  const slideRIdMappings: { slideNumber: number; rId: string }[] = [];
  const oldToNewRIdMap: { [oldRId: string]: string } = {};
  let rIdCounter = 1;

  const slideType = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide";
  const slideMasterType = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster";

  const originalSlideMaster = existingRels.find(r => r.type === slideMasterType);
  if (originalSlideMaster) {
    finalRelsOutput.push({ ...originalSlideMaster, rId: "rId1" });
    oldToNewRIdMap[originalSlideMaster.rId] = "rId1";
  } else {
    logger.info("No Slide Master found. Adding a default as rId1.");
    finalRelsOutput.push({ rId: "rId1", type: slideMasterType, target: "slideMasters/slideMaster1.xml", originalRId: "rId1_placeholder" });
  }
  rIdCounter = 2;

  const orderedSlides: { rId: string, target: string, slideNumber: number }[] = [];

  // 1. Intro slides
  introSlideDetails.forEach((detail, index) => {
    const newRId = `rId${rIdCounter++}`;
    const finalSlideOrderIndex = index + 1;
    const target = `slides/slide${detail.slideNumber}.xml`;
    orderedSlides.push({ rId: newRId, target, slideNumber: detail.slideNumber });
    finalRelsOutput.push({
      rId: newRId,
      type: slideType,
      target: target,
    });
    slideRIdMappings.push({ slideNumber: finalSlideOrderIndex, rId: newRId });
  });

  // 2. Existing slides
  const introSlidesCount = introSlideDetails.length;
  for (let i = 0; i < initialExistingSlideCount; i++) {
    const templateSlideFileNumber = i + 1;
    const newSlideFileNumber = templateSlideFileNumber + introSlidesCount;
    const slideTarget = `slides/slide${newSlideFileNumber}.xml`;
    const originalRel = existingRels.find(
      (m) => m.target === `slides/slide${templateSlideFileNumber}.xml` && m.type === slideType
    );
    const newRId = `rId${rIdCounter++}`;
    const finalSlideOrderIndex = introSlidesCount + 1 + i;
    orderedSlides.push({ rId: newRId, target: slideTarget, slideNumber: newSlideFileNumber });
    finalRelsOutput.push({
      rId: newRId,
      type: slideType,
      target: slideTarget,
      originalRId: originalRel?.rId,
    });
    slideRIdMappings.push({ slideNumber: finalSlideOrderIndex, rId: newRId });
    if (originalRel) oldToNewRIdMap[originalRel.rId] = newRId;
  }

  // 3. New question slides
  for (let i = 0; i < newOmbeaQuestionCount; i++) {
    const questionSlideFileNumber = initialExistingSlideCount + introSlideDetails.length + 1 + i;
    const newRId = `rId${rIdCounter++}`;
    const finalSlideOrderIndex = introSlideDetails.length + initialExistingSlideCount + 1 + i;
    const target = `slides/slide${questionSlideFileNumber}.xml`;
    orderedSlides.push({ rId: newRId, target, slideNumber: questionSlideFileNumber });
    finalRelsOutput.push({
      rId: newRId,
      type: slideType,
      target
    });
    slideRIdMappings.push({ slideNumber: finalSlideOrderIndex, rId: newRId });
  }

  orderedSlides.sort((a,b) => a.slideNumber - b.slideNumber);

  // 4. Other relationships
  existingRels.forEach((origRel) => {
    if (origRel.type !== slideMasterType && origRel.type !== slideType) {
      if (!oldToNewRIdMap[origRel.rId]) {
        const newRId = `rId${rIdCounter++}`;
        finalRelsOutput.push({ ...origRel, rId: newRId });
        oldToNewRIdMap[origRel.rId] = newRId;
      } else {
        finalRelsOutput.push({ ...origRel, rId: oldToNewRIdMap[origRel.rId] });
      }
    }
  });

  slideRIdMappings.sort((a, b) => a.slideNumber - b.slideNumber);

  let updatedContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`;
  finalRelsOutput
    .sort((a, b) => parseInt(a.rId.substring(3)) - parseInt(b.rId.substring(3)))
    .forEach((rel) => {
      updatedContent += `\n  <Relationship Id="${rel.rId}" Type="${rel.type}" Target="${rel.target}"/>`;
    });
  updatedContent += "\n</Relationships>";

  logger.info('[LOG][val17PptxGenerator] Fin de updatePresentationRelsWithMappings.');
  return { updatedContent, slideRIdMappings, oldToNewRIdMap, orderedSlides };
}

async function rebuildPresentationXml(
  zip: JSZip,
  slideRIdMappings: { slideNumber: number; rId: string }[],
  slideSizeAttrs: SlideSizeAttributes | null,
  oldToNewRIdMap: { [oldRId: string]: string },
  logger: ILogger
): Promise<void> {
  logger.info('[LOG][val17PptxGenerator] Début de rebuildPresentationXml.');
  const presentationFile = zip.file("ppt/presentation.xml");
  if (!presentationFile) {
    logger.error("ppt/presentation.xml not found in template ZIP.");
    return;
  }
  let content = await presentationFile.async("string");

  content = content.replace(/r:id="(rId\d+)"/g, (match, oldRId) => {
    const newRId = oldToNewRIdMap[oldRId];
    if (newRId) {
      return `r:id="${newRId}"`;
    }
    logger.warn(
      `presentation.xml: No new r:id mapping found for old r:id="${oldRId}". Keeping original. Match: ${match}`
    );
    return match;
  });

  let newSldIdLstContent = `<p:sldIdLst>`;
  slideRIdMappings.forEach((mapping, index) => {
    const sldIdValue = 256 + index;
    newSldIdLstContent += `\n    <p:sldId id="${sldIdValue}" r:id="${mapping.rId}"/>`;
  });
  newSldIdLstContent += `\n  </p:sldIdLst>`;
  content = content.replace(
    /<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/,
    newSldIdLstContent
  );

  if (slideSizeAttrs) {
    const sldSzRegex = /<p:sldSz[^>]*\/>/;
    const typeAttr = slideSizeAttrs.type
      ? ` type="${slideSizeAttrs.type}"`
      : "";
    const newSldSzTag = `<p:sldSz cx="${slideSizeAttrs.cx}" cy="${slideSizeAttrs.cy}"${typeAttr}/>`;
    if (sldSzRegex.test(content)) {
      content = content.replace(sldSzRegex, newSldSzTag);
    } else {
      let insertPoint = content.indexOf("</p:notesSz>");
      if (insertPoint !== -1) {
        insertPoint += "</p:notesSz>".length;
        content = `${content.slice(
          0,
          insertPoint
        )}\n  ${newSldSzTag}${content.slice(insertPoint)}`;
      } else {
        insertPoint = content.indexOf("<p:defaultTextStyle>");
        if (insertPoint !== -1) {
          content = `${content.slice(
            0,
            insertPoint
          )}${newSldSzTag}\n  ${content.slice(insertPoint)}`;
        } else {
          insertPoint = content.indexOf("<p:sldIdLst>");
          if (insertPoint !== -1) {
            content = `${content.slice(
              0,
              insertPoint
            )}${newSldSzTag}\n  ${content.slice(insertPoint)}`;
          } else {
            logger.warn(
              "Could not find a suitable place to insert <p:sldSz> in presentation.xml."
            );
          }
        }
      }
    }
  }
  zip.file("ppt/presentation.xml", content);
  logger.info('[LOG][val17PptxGenerator] Fin de rebuildPresentationXml.');
}

function updateContentTypesComplete(
  originalContent: string,
  allSlideNumbers: number[],
  newLayouts: string[],
  totalTagsUsed: number,
  logger: ILogger
): string {
  logger.info('[LOG][val17PptxGenerator] Début de updateContentTypesComplete.');
  let updatedContent = originalContent;
  let newOverrides = "";

  allSlideNumbers.forEach((slideNumber) => {
    const slidePartName = `/ppt/slides/slide${slideNumber}.xml`;
    if (!updatedContent.includes(`PartName="${slidePartName}"`)) {
      newOverrides += `\n  <Override PartName="${slidePartName}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
    }
  });

  newLayouts.forEach((layoutFileName) => {
    const layoutPartName = `/ppt/slideLayouts/${layoutFileName}`;
    if (!updatedContent.includes(`PartName="${layoutPartName}"`)) {
        newOverrides += `\n  <Override PartName="${layoutPartName}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>`;
    }
  });

  for (let i = 1; i <= totalTagsUsed; i++) {
    const tagPath = `/ppt/tags/tag${i}.xml`;
    if (!updatedContent.includes(`PartName="${tagPath}"`)) {
      newOverrides += `\n  <Override PartName="${tagPath}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tags+xml"/>`;
    }
  }
  if (newOverrides) {
    const insertPoint = updatedContent.lastIndexOf("</Types>");
    updatedContent =
      updatedContent.slice(0, insertPoint) +
      newOverrides +
      "\n" +
      updatedContent.slice(insertPoint);
  }
  logger.info('[LOG][val17PptxGenerator] Fin de updateContentTypesComplete.');
  return updatedContent;
}

async function calculateAppXmlMetadata(
  zip: JSZip,
  orderedSlides: { rId: string, target: string }[],
  logger: ILogger
): Promise<AppXmlMetadata> {
  logger.info('[LOG][val17PptxGenerator] Début de calculateAppXmlMetadata.');
  let totalWords = 0;
  let totalParagraphs = 0;
  const slideTitles: string[] = [];
  const fonts: string[] = [];
  const themes: string[] = [];

  const appFile = zip.file("docProps/app.xml");
  if (appFile) {
    const content = await appFile.async("string");
    const contentWithoutXmlDecl = content.replace(/<\?xml[^>]*\?>\s*/, "");
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      textNodeName: "#text",
      allowBooleanAttributes: true,
      parseTagValue: false,
      trimValues: false,
    });
    const jsonObj = parser.parse(contentWithoutXmlDecl);

    const titlesOfParts = jsonObj.Properties.TitlesOfParts["vt:vector"]["vt:lpstr"];
    if (titlesOfParts) {
      const headingPairs = jsonObj.Properties.HeadingPairs["vt:vector"]["vt:variant"];
      const fontPair = headingPairs.find(
        (p: any) => p["vt:lpstr"] === "Polices utilisées"
      );
      const themePair = headingPairs.find(
        (p: any) => p["vt:lpstr"] === "Thème"
      );

      const fontCount = fontPair ? parseInt(headingPairs[headingPairs.indexOf(fontPair) + 1]["vt:i4"]) : 0;
      const themeCount = themePair ? parseInt(headingPairs[headingPairs.indexOf(themePair) + 1]["vt:i4"]) : 0;

      for (let i = 0; i < fontCount; i++) {
        fonts.push(titlesOfParts[i]);
      }
      for (let i = 0; i < themeCount; i++) {
        themes.push(titlesOfParts[fontCount + i]);
      }
    }
  }


  for (const slide of orderedSlides) {
    const slideFile = zip.file(`ppt/${slide.target}`);
    if (slideFile) {
      const content = await slideFile.async("string");
      const textNodes = content.match(/<a:t>.*?<\/a:t>/g) || [];
      let slideText = "";
      textNodes.forEach((node) => {
        slideText += node.replace(/<a:t>(.*?)<\/a:t>/, "$1 ");
      });
      totalWords += slideText.trim().split(/\s+/).filter(Boolean).length;
      totalParagraphs += (content.match(/<a:p>/g) || []).length;

      const titleShapeMatch = content.match(/<p:sp>\s*<p:nvSpPr>\s*<p:cNvPr id="\d+" name="Titre \d+"\/>\s*<p:cNvSpPr>\s*<a:spLocks noGrp="1"\/>\s*<\/p:cNvSpPr>\s*<p:nvPr>\s*<p:ph type="title"\/>/);
      if (titleShapeMatch) {
        const titleBodyMatch = content.match(/<p:txBody>([\s\S]*?)<\/p:txBody>/);
        if (titleBodyMatch) {
          const textRuns = titleBodyMatch[1].match(/<a:t>.*?<\/a:t>/g) || [];
          const title = textRuns.map(run => run.replace(/<a:t>(.*?)<\/a:t>/, "$1")).join('');
          slideTitles.push(title);
        }
      } else {
        const introTitleMatch = content.match(/<p:sp>\s*<p:nvSpPr>\s*<p:cNvPr id="\d+" name="Title Placeholder"\/>\s*<p:cNvSpPr>\s*<a:spLocks noGrp="1"\/>\s*<\/p:cNvSpPr>\s*<p:nvPr>\s*<p:ph type="title"\/>/);
        if(introTitleMatch) {
          const titleBodyMatch = content.match(/<p:txBody>([\s\S]*?)<\/p:txBody>/);
          if (titleBodyMatch) {
            const textRuns = titleBodyMatch[1].match(/<a:t>.*?<\/a:t>/g) || [];
            const title = textRuns.map(run => run.replace(/<a:t>(.*?)<\/a:t>/, "$1")).join('');
            slideTitles.push(title);
          }
        } else {
          const participantsTitleMatch = content.match(/<p:sp>\s*<p:nvSpPr>\s*<p:cNvPr id="\d+" name="Title"\/>\s*<p:cNvSpPr>\s*<a:spLocks noGrp="1"\/>\s*<\/p:cNvSpPr>\s*<p:nvPr>\s*<p:ph type="title"\/>/);
          if(participantsTitleMatch) {
            const titleBodyMatch = content.match(/<p:txBody>([\s\S]*?)<\/p:txBody>/);
            if (titleBodyMatch) {
              const textRuns = titleBodyMatch[1].match(/<a:t>.*?<\/a:t>/g) || [];
              const title = textRuns.map(run => run.replace(/<a:t>(.*?)<\/a:t>/, "$1")).join('');
              slideTitles.push(title);
            }
          }
        }
      }
    }
  }

  const result = {
    totalSlides: orderedSlides.length,
    totalWords,
    totalParagraphs,
    slideTitles,
    fonts,
    themes
  };
  logger.info(`[LOG][val17PptxGenerator] Fin de calculateAppXmlMetadata: ${JSON.stringify(result)}`);
  return result;
}

async function updateAppXml(
  zip: JSZip,
  metadata: AppXmlMetadata,
  logger: ILogger
): Promise<void> {
  logger.info('[LOG][val17PptxGenerator] Début de updateAppXml.');
  const appFile = zip.file("docProps/app.xml");
  if (!appFile) {
    logger.warn("app.xml non trouvé, création d'un nouveau fichier");
    createNewAppXml(zip, metadata, logger);
    return;
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    allowBooleanAttributes: true,
    parseTagValue: false,
    trimValues: false,
  });
  const content = await appFile.async("string");
  const contentWithoutXmlDecl = content.replace(/<\?xml[^>]*\?>\s*/, "");
  const jsonObj = parser.parse(contentWithoutXmlDecl);

  jsonObj.Properties.Slides = metadata.totalSlides;
  jsonObj.Properties.Words = metadata.totalWords;
  jsonObj.Properties.Paragraphs = metadata.totalParagraphs;
  jsonObj.Properties.TotalTime = 41;

  const allTitles = [...metadata.fonts, ...metadata.themes, ...metadata.slideTitles];

  const headingPairs = jsonObj.Properties.HeadingPairs["vt:vector"]["vt:variant"];
  const fontPair = headingPairs.find(
    (p: any) => p["vt:lpstr"] === "Polices utilisées"
  );
  if(fontPair) {
    const fontPairIndex = headingPairs.indexOf(fontPair);
    headingPairs[fontPairIndex + 1]["vt:i4"] = metadata.fonts.length;
  }

  const themePair = headingPairs.find(
    (p: any) => p["vt:lpstr"] === "Thème"
  );
  if(themePair) {
    const themePairIndex = headingPairs.indexOf(themePair);
    headingPairs[themePairIndex + 1]["vt:i4"] = metadata.themes.length;
  }

  const slideTitlesPair = headingPairs.find(
    (p: any) => p["vt:lpstr"] === "Titres des diapositives"
  );
  if (slideTitlesPair) {
    const slideTitlesPairIndex = headingPairs.indexOf(slideTitlesPair);
    headingPairs[slideTitlesPairIndex + 1]["vt:i4"] = metadata.slideTitles.length;
  }

  jsonObj.Properties.TitlesOfParts["vt:vector"]["vt:lpstr"] = allTitles.map(
    (title) => escapeXml(title, logger)
  );
  jsonObj.Properties.TitlesOfParts["vt:vector"]["@_size"] = allTitles.length;

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    format: true,
    suppressBooleanAttributes: false,
    suppressEmptyNode: true,
  });

  const xmlContent = builder.build(jsonObj);
  const finalXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${xmlContent}`;

  zip.file("docProps/app.xml", finalXml);

  logger.info('[LOG][val17PptxGenerator] Fin de updateAppXml.');
}

function updateSimpleFields(content: string, metadata: AppXmlMetadata, logger: ILogger): string {
  logger.info('[LOG][val17PptxGenerator] Début de updateSimpleFields.');
  let updated = content;
  updated = updated.replace(
    /<Slides>\d+<\/Slides>/,
    `<Slides>${metadata.totalSlides}<\/Slides>`
  );

  const wordsMatch = updated.match(/<Words>(\d+)<\/Words>/);
  const existingWords =
    wordsMatch && wordsMatch[1] ? parseInt(wordsMatch[1], 10) : 0;
  updated = updated.replace(
    /<Words>\d*<\/Words>/,
    `<Words>${existingWords + metadata.totalWords}<\/Words>`
  );

  const paragraphsMatch = updated.match(/<Paragraphs>(\d+)<\/Paragraphs>/);
  const existingParagraphs =
    paragraphsMatch && paragraphsMatch[1]
      ? parseInt(paragraphsMatch[1], 10)
      : 0;
  updated = updated.replace(
    /<Paragraphs>\d*<\/Paragraphs>/,
    `<Paragraphs>${existingParagraphs + metadata.totalParagraphs}<\/Paragraphs>`
  );

  if (!updated.includes("<TotalTime>")) {
    const propertiesEnd = updated.indexOf("</Properties>");
    if (propertiesEnd > -1) {
      const totalTimeTag = "\n  <TotalTime>2<\/TotalTime>";
      updated =
        updated.slice(0, propertiesEnd) +
        totalTimeTag +
        updated.slice(propertiesEnd);
    }
  }
  if (!updated.includes("<Company")) {
    const insertAfter = "</TitlesOfParts>";
    let insertPoint = updated.indexOf(insertAfter);
    if (insertPoint > -1) insertPoint += insertAfter.length;
    else insertPoint = updated.indexOf("</Properties>");

    if (insertPoint > -1) {
      const companyTag = "\n  <Company/>";
      updated =
        updated.slice(0, insertPoint) + companyTag + updated.slice(insertPoint);
    }
  }
  logger.info('[LOG][val17PptxGenerator] Fin de updateSimpleFields.');
  return updated;
}

function updateHeadingPairsAndTitles(
  content: string,
  allSlideTitles: string[],
  logger: ILogger
): string {
  logger.info('[LOG][val17PptxGenerator] Début de updateHeadingPairsAndTitles.');
  let updated = content;
  const titlesToAddCount = allSlideTitles.length;

  const headingPairsRegex =
    /<vt:lpstr>Titres des diapositives<\/vt:lpstr>\s*<\/vt:variant>\s*<vt:variant>\s*<vt:i4>(\d+)<\/vt:i4>/;
  updated = updated.replace(headingPairsRegex, (_match, p1) => {
    return `<vt:lpstr>Titres des diapositives<\/vt:lpstr><\/vt:variant><vt:variant><vt:i4>${titlesToAddCount}<\/vt:i4>`;
  });

  const titlesVector = `<vt:vector size="${titlesToAddCount}" baseType="lpstr">${allSlideTitles
    .map(
      (title) =>
        `\n      <vt:lpstr>${escapeXml(
          title.substring(0, 250),
          logger
        )}<\/vt:lpstr>`
    )
    .join("")}\n    </vt:vector>`;

  updated = updated.replace(
    /<TitlesOfParts>[\s\S]*?<\/TitlesOfParts>/,
    `<TitlesOfParts>${titlesVector}</TitlesOfParts>`
  );
  logger.info('[LOG][val17PptxGenerator] Fin de updateHeadingPairsAndTitles.');
  return updated;
}

function buildHeadingPairs(
  nonSlideTitles: string[],
  allSlideTitles: string[],
  logger: ILogger
): string {
  logger.info('[LOG][val17PptxGenerator] Début de buildHeadingPairs.');
  const pairs: string[] = [];
  const fontCount = nonSlideTitles.filter(
    (t) =>
      t.includes("Arial") ||
      t.includes("Calibri") ||
      t.includes("Font") ||
      t.includes("Police")
  ).length;
  if (fontCount > 0) {
    pairs.push(
      `\n      <vt:variant><vt:lpstr>Polices utilisées<\/vt:lpstr><\/vt:variant>\n      <vt:variant><vt:i4>${fontCount}<\/vt:i4><\/vt:variant>`
    );
  }
  const hasTheme = nonSlideTitles.some(
    (t) => t.includes("Thème") || t.includes("Theme") || t === "Thème Office"
  );
  if (hasTheme) {
    pairs.push(
      `\n      <vt:variant><vt:lpstr>Thème<\/vt:lpstr><\/vt:variant>\n      <vt:variant><vt:i4>1<\/vt:i4><\/vt:variant>`
    );
  }
  if (allSlideTitles.length > 0) {
    pairs.push(
      `\n      <vt:variant><vt:lpstr>Titres des diapositives<\/vt:lpstr><\/vt:variant>\n      <vt:variant><vt:i4>${allSlideTitles.length}<\/vt:i4><\/vt:variant>`
    );
  }
  const vectorSize = pairs.reduce(
    (acc, curr) => acc + curr.split("<vt:variant>").length - 1,
    0
  );
  const result = `<HeadingPairs><vt:vector size="${vectorSize}" baseType="variant">${pairs.join(
    ""
  )}\n    <\/vt:vector><\/HeadingPairs>`;
  logger.info('[LOG][val17PptxGenerator] Fin de buildHeadingPairs.');
  return result;
}

function buildTitlesOfParts(
  fonts: string[],
  themes: string[],
  existingSlideTitles: string[],
  newSlideTitles: string[],
  logger: ILogger
): string {
  logger.info('[LOG][val17PptxGenerator] Début de buildTitlesOfParts.');
  const allTitles: string[] = [];
  fonts.forEach((font) => allTitles.push(escapeXml(font, logger)));
  themes.forEach((theme) => allTitles.push(escapeXml(theme, logger)));
  existingSlideTitles.forEach((title) => allTitles.push(escapeXml(title, logger)));
  newSlideTitles.forEach((title) => {
    const truncatedTitle =
      title.length > 250 ? title.substring(0, 247) + "..." : title;
    allTitles.push(escapeXml(truncatedTitle, logger));
  });
  const vectorContent = allTitles
    .map((title) => `\n      <vt:lpstr>${title}<\/vt:lpstr>`)
    .join("");
  const result = `<TitlesOfParts><vt:vector size="${allTitles.length}" baseType="lpstr">${vectorContent}\n    <\/vt:vector><\/TitlesOfParts>`;
  logger.info('[LOG][val17PptxGenerator] Fin de buildTitlesOfParts.');
  return result;
}

function createNewAppXml(zip: JSZip, metadata: AppXmlMetadata, logger: ILogger): void {
  logger.info('[LOG][val17PptxGenerator] Début de createNewAppXml.');
  const defaultFonts = ["Arial", "Calibri"];
  const defaultThemes = ["Thème Office"];
  const headingPairs = buildHeadingPairs(
    [...defaultFonts, ...defaultThemes],
    metadata.slideTitles,
    logger
  );
  const titlesOfParts = buildTitlesOfParts(
    defaultFonts,
    defaultThemes,
    [],
    metadata.slideTitles,
    logger
  );

  const appXmlContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <TotalTime>2<\/TotalTime><Words>${metadata.totalWords}<\/Words><Application>Microsoft Office PowerPoint<\/Application>
  <PresentationFormat>Affichage à l'écran (4:3)<\/PresentationFormat><Paragraphs>${metadata.totalParagraphs}<\/Paragraphs>
  <Slides>${metadata.totalSlides}<\/Slides><Notes>0<\/Notes><HiddenSlides>0<\/HiddenSlides><MMClips>0<\/MMClips>
  <ScaleCrop>false<\/ScaleCrop>${headingPairs}${titlesOfParts}<Company/><LinksUpToDate>false<\/LinksUpToDate>
  <SharedDoc>false<\/SharedDoc><HyperlinksChanged>false<\/HyperlinksChanged><AppVersion>14.0000<\/AppVersion><\/Properties>`;
  zip.file("docProps/app.xml", appXmlContent);
  logger.info('[LOG][val17PptxGenerator] Fin de createNewAppXml.');
}

async function updateCoreXml(
  zip: JSZip,
  newQuestionCount: number,
  logger: ILogger
): Promise<void> {
  logger.info("[LOG][val17PptxGenerator] Début de updateCoreXml.");
  const coreFile = zip.file("docProps/core.xml");
  if (coreFile) {
    try {
      const content = await coreFile.async("string");
      // Supprimer la déclaration XML si elle existe pour éviter les doublons
      const contentWithoutXmlDecl = content.replace(
        /<\?xml[^>]*\?>\s*/,
        ""
      );

      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        textNodeName: "#text",
        allowBooleanAttributes: true,
        parseTagValue: false, // Important pour préserver la structure exacte
        trimValues: false,
      });
      const jsonObj = parser.parse(contentWithoutXmlDecl);

      const coreProperties = jsonObj["cp:coreProperties"];
      if (coreProperties) {
        // Mettre à jour le titre
        const title = `Quiz OMBEA ${newQuestionCount} question${
          newQuestionCount > 1 ? "s" : ""
        }`;
        coreProperties["dc:title"] = title;

        const now = new Date().toISOString();

        // Mettre à jour la date de modification
        coreProperties["dcterms:modified"] = {
          "#text": now,
          "@_xsi:type": "dcterms:W3CDTF",
        };

        // Ajouter la date de création si elle n'existe pas
        if (!coreProperties["dcterms:created"]) {
          coreProperties["dcterms:created"] = {
            "#text": now,
            "@_xsi:type": "dcterms:W3CDTF",
          };
        }
      }

      const builder = new XMLBuilder({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        textNodeName: "#text",
        format: true, // Pour un XML bien indenté
        suppressBooleanAttributes: false,
        suppressEmptyNode: true, // Ne pas générer de balises auto-fermantes vides
      });

      const xmlContent = builder.build(jsonObj);
      const finalXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${xmlContent}`;

      zip.file("docProps/core.xml", finalXml);
      logger.info(
        "[LOG][val17PptxGenerator] core.xml mis à jour avec succès via fast-xml-parser."
      );
    } catch (error) {
      logger.error(
        `[ERREUR][val17PptxGenerator] Erreur lors de la mise à jour de core.xml avec fast-xml-parser: ${error}`
      );
      // Fallback vers l'ancienne méthode si le parsing échoue
      // (vous pouvez choisir de supprimer ce fallback si vous êtes sûr de la nouvelle méthode)
      const content = await coreFile.async("string");
      zip.file("docProps/core.xml", content); // Rétablit le contenu original en cas d'erreur
    }
  } else {
    logger.warn("[LOG][val17PptxGenerator] docProps/core.xml non trouvé.");
  }
  logger.info("[LOG][val17PptxGenerator] Fin de updateCoreXml.");
}

// Helper function to get XML content of a layout file
async function getLayoutXml(zip: JSZip, layoutFileName: string, logger: ILogger): Promise<string | null> {
  logger.info(`[LOG][val17PptxGenerator] Début de getLayoutXml pour ${layoutFileName}.`);
  const layoutFile = zip.file(layoutFileName);
  if (layoutFile) {
    const result = await layoutFile.async("string");
    logger.info(`[LOG][val17PptxGenerator] Fin de getLayoutXml pour ${layoutFileName}.`);
    return result;
  }
  logger.warn(`[getLayoutXml] Fichier layout non trouvé: ${layoutFileName}`);
  return null;
}

// Fonction principale exportée
export async function generatePPTXVal17(
  templateFile: any,
  questions: Val17Question[],
  participants: ParticipantForGenerator[],
  options: GenerationOptions = {},
  logger: ILogger,
  sessionInfo?: SessionInfo
): Promise<{ pptxBlob: Blob; questionMappings: QuestionMapping[]; preExistingQuestionSlideGuids: string[]; } | null> {
  logger.debug(`[LOG][val17PptxGenerator] Final participants for generator: ${JSON.stringify(participants)}`);
  logger.debug(`  - Nombre de questions: ${questions.length}`);
  logger.debug(`  - Options: ${JSON.stringify(options)}`);
  logger.debug(`  - Session Info: ${JSON.stringify(sessionInfo)}`);
  logger.debug(`  - Nombre de participants: ${participants.length}`);
  logger.info('[LOG][val17PptxGenerator] === Début de generatePPTXVal17 ===');
  try {
    validateQuestions(questions, logger);
    if (!templateFile) {
      logger.warn("Aucun fichier modèle fourni.");
      throw new Error("Template file is required by generatePPTXVal17.");
    }
    const templateZip = await JSZip.loadAsync(templateFile);

    const preExistingQuestionSlideGuids: string[] = [];
    const slideFilesFolder = templateZip.folder("ppt/slides");

    if (slideFilesFolder) {
      const slideProcessingPromises: Promise<void>[] = [];
      slideFilesFolder.forEach((relativePath, slideFileEntry) => {
        if (relativePath.startsWith("slide") && relativePath.endsWith(".xml") && !slideFileEntry.dir) {
          const slideNumberMatch = relativePath.match(/slide(\d+)\.xml/);
          if (slideNumberMatch && slideNumberMatch[1]) {
            const slideNumPart = slideNumberMatch[1];
            const relsPath = `ppt/slides/_rels/slide${slideNumPart}.xml.rels`;
            const relsFile = templateZip.file(relsPath);

            if (relsFile) {
              const promise = relsFile.async("string").then(async (relsContent) => {
                const tagRelationshipRegex = /<Relationship[^>]*Type="http:\/\/schemas.openxmlformats.org\/officeDocument\/2006\/relationships\/tags"[^>]*Target="..\/tags\/(tag\d+\.xml)"[^>]*\/>/g;
                let relMatch;
                while ((relMatch = tagRelationshipRegex.exec(relsContent)) !== null) {
                  const tagFileName = relMatch[1];
                  const tagFilePath = `ppt/tags/${tagFileName}`;
                  const tagFile = templateZip.file(tagFilePath);

                  if (tagFile) {
                    try {
                      const tagContent = await tagFile.async("string");
                      const guidMatch = tagContent.match(/<p:tag name="OR_SLIDE_GUID" val="([^"]+)"\/>/);
                      if (guidMatch && guidMatch[1]) {
                        const foundGuid = guidMatch[1];
                        if (!preExistingQuestionSlideGuids.includes(foundGuid)) {
                          preExistingQuestionSlideGuids.push(foundGuid);
                        }
                      }
                    } catch (_e) {
                      // Silently ignore errors for individual tag files
                    }
                  }
                }
              }).catch(_err => {
                // Silently ignore errors for individual rels files
              });
              slideProcessingPromises.push(promise);
            }
          }
        }
      });

      await Promise.all(slideProcessingPromises);

      if (preExistingQuestionSlideGuids.length > 0) {
        logger.info(`[val17PptxGenerator] GUIDs des questions OMBEA préexistantes trouvés dans le modèle: ${JSON.stringify(preExistingQuestionSlideGuids)}`);
      } else {
        logger.info(`[val17PptxGenerator] Aucune question OMBEA préexistante (avec OR_SLIDE_GUID) trouvée dans le modèle.`);
      }
    } else {
        logger.info(`[val17PptxGenerator] Dossier ppt/slides non trouvé dans le templateZip.`);
    }

    let slideSizeAttrs: SlideSizeAttributes | null = null;
    const presentationXmlFileFromTemplate = templateZip.file(
      "ppt/presentation.xml"
    );
    if (presentationXmlFileFromTemplate) {
      const presentationXmlContent =
        await presentationXmlFileFromTemplate.async("string");
      const sldSzMatch = presentationXmlContent.match(
        /<p:sldSz\s+cx="(\d+)"\s+cy="(\d+)"(?:\s+type="(\w+)")?\/>/
      );
      if (sldSzMatch) {
        slideSizeAttrs = { cx: sldSzMatch[1], cy: sldSzMatch[2] };
        if (sldSzMatch[3]) {
          slideSizeAttrs.type = sldSzMatch[3];
        }
      } else {
        logger.warn(
          "<p:sldSz> non trouvé dans le presentation.xml du modèle."
        );
      }
    } else {
      logger.warn("ppt/presentation.xml non trouvé dans le ZIP du modèle.");
    }

    const existingTagsCount = findHighestExistingTagNumber(templateZip, logger);
    let maxTagNumberUsed = existingTagsCount;

    const outputZip = new JSZip();
    const copyPromises: Promise<void>[] = [];

    // START of modification
    const introSlidesCount = (sessionInfo && options.introSlideLayouts?.titleLayoutName ? 1 : 0) +
                             (participants.length > 0 && options.introSlideLayouts?.participantsLayoutName ? 1 : 0);

    templateZip.forEach((relativePath, file) => {
      if (!file.dir) {
        let newPath = relativePath;
        const slideMatch = relativePath.match(/ppt\/slides\/slide(\d+)\.xml/);
        const slideRelsMatch = relativePath.match(/ppt\/slides\/_rels\/slide(\d+)\.xml\.rels/);

        if (slideMatch) {
          const slideNum = parseInt(slideMatch[1], 10);
          newPath = `ppt/slides/slide${slideNum + introSlidesCount}.xml`;
          logger.info(`[val17PptxGenerator] Renaming ${relativePath} to ${newPath}`);
        } else if (slideRelsMatch) {
          const slideNum = parseInt(slideRelsMatch[1], 10);
          newPath = `ppt/slides/_rels/slide${slideNum + introSlidesCount}.xml.rels`;
          logger.info(`[val17PptxGenerator] Renaming ${relativePath} to ${newPath}`);
        } else {
           logger.info(`[val17PptxGenerator] Copying file: ${relativePath}`);
        }

        const copyPromise: Promise<void> = file
          .async("arraybuffer")
          .then((content) => {
             if (slideRelsMatch) {
                let contentStr = new TextDecoder().decode(content);
                // We might need to update the target file name inside the rels file if it contains references to other slides.
                // For now, we assume it does not, but this is a point of attention.
                // Example: Relationship Target="../slides/slide2.xml" would need to be updated.
                // This is not the case for slide relationships to slide layouts, notes, etc.
                // Let's log to be sure
                logger.debug(`[val17PptxGenerator] Content of ${newPath}: ${contentStr}`);
             }
            outputZip.file(newPath, content);
          });
        copyPromises.push(copyPromise);
      } else {
        outputZip.folder(relativePath);
      }
    });
    await Promise.all(copyPromises);
    // END of modification

    const initialExistingSlideCount = countExistingSlides(templateZip, logger);
    let introSlidesAddedCount = 0;
    const newIntroSlideDetails: {
      slideNumber: number;
      layoutRIdInSlide: string;
      layoutFileName: string;
    }[] = [];

    if (sessionInfo && options.introSlideLayouts?.titleLayoutName) {
      const targetTitleLayoutName = options.introSlideLayouts.titleLayoutName;
      const actualTitleLayoutPath = await findLayoutByCSldName(outputZip, targetTitleLayoutName, "title", logger);
      if (actualTitleLayoutPath) {
        const currentIntroSlideNumber = introSlidesAddedCount + 1;
        const titleSlideXml = createIntroTitleSlideXml(sessionInfo, currentIntroSlideNumber, logger);
        outputZip.file(`ppt/slides/slide${currentIntroSlideNumber}.xml`, titleSlideXml);
        const layoutRIdInSlide = "rId1";
        const titleLayoutBaseName = actualTitleLayoutPath.substring(actualTitleLayoutPath.lastIndexOf('/') + 1);
        const slideRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n  <Relationship Id="${layoutRIdInSlide}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/${titleLayoutBaseName}"/>\n</Relationships>`;
        outputZip.file(`ppt/slides/_rels/slide${currentIntroSlideNumber}.xml.rels`, slideRelsXml);
        newIntroSlideDetails.push({
          slideNumber: currentIntroSlideNumber,
          layoutRIdInSlide,
          layoutFileName: actualTitleLayoutPath,
        });
        introSlidesAddedCount++;
      } else {
        logger.warn(`Layout de titre avec nom approchant "${targetTitleLayoutName}" non trouvé. Slide de titre non ajoutée.`);
      }
    }

    if (participants.length > 0 && options.introSlideLayouts?.participantsLayoutName) {
      const targetParticipantsLayoutName = options.introSlideLayouts.participantsLayoutName;
      const actualParticipantsLayoutPath = await findLayoutByCSldName(outputZip, targetParticipantsLayoutName, "participants", logger);

      if (actualParticipantsLayoutPath) {
        let layoutTblPrXml: string | null = null;
        let layoutTblGridXml: string | null = null;
        let layoutGraphicFrameXml: string | null = null;

        const layoutFileXmlContent = await getLayoutXml(outputZip, actualParticipantsLayoutPath, logger);

        if (layoutFileXmlContent) {
          const graphicFrameRegex = /<p:graphicFrame>([\s\S]*?<a:tbl>[\s\S]*?<\/a:tbl>[\s\S]*?)<\/p:graphicFrame>/;
          const graphicFrameMatch = layoutFileXmlContent.match(graphicFrameRegex);

          if (graphicFrameMatch && graphicFrameMatch[0]) {
            layoutGraphicFrameXml = graphicFrameMatch[0];
            if (layoutGraphicFrameXml.length < 2000) {
                 logger.debug(`[DEBUG_TABLE_LAYOUT] Full layoutGraphicFrameXml: ${layoutGraphicFrameXml}`);
            } else {
                 logger.debug(`[DEBUG_TABLE_LAYOUT] Found graphicFrame (snippet): ${layoutGraphicFrameXml.substring(0, 1000)}...`);
            }
            logger.debug(`[DEBUG_TABLE_LAYOUT] Index of '<a:tblPr' in layoutGraphicFrameXml: ${layoutGraphicFrameXml.indexOf('<a:tblPr')}`);
            logger.debug(`[DEBUG_TABLE_LAYOUT] Index of '<a:tblGrid' in layoutGraphicFrameXml: ${layoutGraphicFrameXml.indexOf('<a:tblGrid')}`);

            const simpleTblPrRegex = /<a:tblPr/;
            const simpleTblPrMatch = layoutGraphicFrameXml.match(simpleTblPrRegex);
            if (simpleTblPrMatch) {
              logger.debug(`[DEBUG_TABLE_LAYOUT] Found '<a:tblPr' using simple regex. Match object: ${JSON.stringify(simpleTblPrMatch)}`);
            } else {
              logger.debug(`[DEBUG_TABLE_LAYOUT] Did NOT find '<a:tblPr' using simple regex.`);
            }

            const tblPrRegex = /<a:tblPr([^>]*)>([\s\S]*?)<\/a:tblPr>/;
            const tblPrMatch = layoutGraphicFrameXml.match(tblPrRegex);
            if (tblPrMatch && tblPrMatch[0]) {
              layoutTblPrXml = tblPrMatch[0];
              logger.debug(`[DEBUG_TABLE_LAYOUT] Extracted tblPr from layout (v2): ${layoutTblPrXml}`);
            } else {
              logger.debug(`[DEBUG_TABLE_LAYOUT] Could not extract tblPr from layout's table within graphicFrame (v2).`);
            }

            const tblGridRegex = /<a:tblGrid([^>]*)>([\s\S]*?)<\/a:tblGrid>/;
            const tblGridMatch = layoutGraphicFrameXml.match(tblGridRegex);
            if (tblGridMatch && tblGridMatch[0]) {
              layoutTblGridXml = tblGridMatch[0];
              logger.debug(`[DEBUG_TABLE_LAYOUT] Extracted tblGrid from layout (v2): ${layoutTblGridXml}`);
            } else {
              logger.debug(`[DEBUG_TABLE_LAYOUT] Could not extract tblGrid from layout's table within graphicFrame (v2).`);
            }
          } else {
            logger.debug("[DEBUG_TABLE_LAYOUT] No graphicFrame with a table found directly in layout XML. Will create table from scratch.");
          }
        } else {
          logger.debug(`[DEBUG_TABLE_LAYOUT] Could not read content of layout file: ${actualParticipantsLayoutPath}`);
        }

        logger.debug(`[TEST_PPTX_GEN] Layout des participants trouvé: ${actualParticipantsLayoutPath}. Préparation de la diapositive.`);
        const currentIntroSlideNumber = introSlidesAddedCount + 1;

        const participantsSlideXml = createIntroParticipantsSlideXml(
          participants,
          currentIntroSlideNumber,
          actualParticipantsLayoutPath,
          layoutGraphicFrameXml,
          layoutTblPrXml,
          layoutTblGridXml,
          logger
        );

        outputZip.file(`ppt/slides/slide${currentIntroSlideNumber}.xml`, participantsSlideXml);

        const layoutRIdInSlide = "rId1";
        const participantsLayoutBaseName = actualParticipantsLayoutPath.substring(actualParticipantsLayoutPath.lastIndexOf('/') + 1);
        const slideRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n  <Relationship Id="${layoutRIdInSlide}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/${participantsLayoutBaseName}"/>\n</Relationships>`;
        outputZip.file(`ppt/slides/_rels/slide${currentIntroSlideNumber}.xml.rels`, slideRelsXml);

        newIntroSlideDetails.push({
          slideNumber: currentIntroSlideNumber,
          layoutRIdInSlide,
          layoutFileName: actualParticipantsLayoutPath,
        });
        introSlidesAddedCount++;
      } else {
        logger.warn(`Layout des participants avec nom approchant "${targetParticipantsLayoutName}" non trouvé.`);
      }
    }

    const effectiveExistingSlideCount =
      initialExistingSlideCount;
    const ombeaLayout = await ensureOmbeaSlideLayoutExists(outputZip, logger);
    const ombeaLayoutFileName = ombeaLayout.layoutFileName;

    outputZip.folder("ppt/tags");
    if (!outputZip.file("ppt/media")) {
      outputZip.folder("ppt/media");
    }

    const imageExtensions = new Set<string>();
    interface DownloadedImage {
      fileName: string;
      data: Buffer;
      width: number;
      height: number;
      dimensions: ImageDimensions;
      extension: string;
    }
    const downloadedImages = new Map<number, DownloadedImage>();
    const questionMappingsInternal: QuestionMapping[] = [];

    // if (questions.some((q) => q.imageUrl)) {
    //   const imagePromises = questions.map(async (question, index) => {
    //     if (question.imageUrl) {
    //       let imageData = null;
    //       if (question.imageUrl.startsWith("http://") || question.imageUrl.startsWith("https://")) {
    //         imageData = await downloadImageFromCloudWithDimensions(question.imageUrl, logger);
    //       } else {
    //         const resolvedImagePath = path.resolve(question.imageUrl);
    //         logger.info(`[IMAGE] Tentative de chargement de l'image locale: ${resolvedImagePath}`);
    //         if (fs.existsSync(resolvedImagePath)) {
    //           imageData = await loadLocalImageWithDimensions(resolvedImagePath, logger);
    //         } else {
    //           logger.warn(`[IMAGE] Fichier image local non trouvé: ${resolvedImagePath}`);
    //         }
    //       }

    //       if (imageData) {
    //         const absoluteSlideNumberForImage =
    //           effectiveExistingSlideCount + index + 1;
    //         const imgFileName = `image_q_slide${absoluteSlideNumberForImage}.${imageData.extension}`;
    //         const dimensions = calculateImageDimensions(
    //           imageData.width,
    //           imageData.height,
    //           logger
    //         );
    //         return {
    //           slideNumberContext: absoluteSlideNumberForImage,
    //           image: {
    //             fileName: imgFileName,
    //             data: imageData.data,
    //             width: imageData.width,
    //             height: imageData.height,
    //             dimensions,
    //             extension: imageData.extension,
    //           },
    //         };
    //       }
    //     }
    //     return null;
    //   });
    //   const imageResults = await Promise.all(imagePromises);
    //   imageResults.forEach((result) => {
    //     if (result && result.image) {
    //       downloadedImages.set(result.slideNumberContext, result.image);
    //       imageExtensions.add(result.image.extension);
    //       outputZip
    //         .folder("ppt/media")
    //         ?.file(result.image.fileName, result.image.data);
    //     }
    //   });
    // }

    for (let i = 0; i < questions.length; i++) {
      const absoluteSlideNumber = effectiveExistingSlideCount + introSlidesAddedCount + i + 1;
      const questionData = questions[i];
      const duration =
        questionData.points ||
        options.ombeaConfig?.pollTimeLimit ||
        options.defaultDuration ||
        30;
      const downloadedImage = downloadedImages.get(absoluteSlideNumber);
      const slideXml = createSlideXml(
        questionData.question,
        questionData.options,
        absoluteSlideNumber,
        duration,
        logger,
        downloadedImage?.dimensions,
        options.ombeaConfig
      );
      outputZip.file(`ppt/slides/slide${absoluteSlideNumber}.xml`, slideXml);

      const baseTagNumberForSlide = calculateBaseTagNumber(
        i + 1,
        existingTagsCount,
        logger
      );
      let slideRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`;
      slideRelsXml += `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags" Target="../tags/tag${baseTagNumberForSlide + 2}.xml"/>`;
      slideRelsXml += `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags" Target="../tags/tag${baseTagNumberForSlide + 1}.xml"/>`;
      slideRelsXml += `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags" Target="../tags/tag${baseTagNumberForSlide}.xml"/>`;
      slideRelsXml += `<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/${ombeaLayoutFileName}"/>`;
      slideRelsXml += `<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags" Target="../tags/tag${baseTagNumberForSlide + 3}.xml"/>`;
      if (downloadedImage) {
        slideRelsXml += `<Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${downloadedImage.fileName}"/>`;
      }
      slideRelsXml += `</Relationships>`;

      outputZip.file(
        `ppt/slides/_rels/slide${absoluteSlideNumber}.xml.rels`,
        slideRelsXml
      );

      const tags = createSlideTagFiles(
        i + 1,
        questionData.options,
        questionData.correctAnswerIndex,
        duration,
        options.ombeaConfig,
        logger,
        existingTagsCount
      );
      tags.forEach((tag) => {
        outputZip.file(`ppt/tags/${tag.fileName}`, tag.content);
        if (tag.tagNumber > maxTagNumberUsed) maxTagNumberUsed = tag.tagNumber;
      });

      const slideGuidTag = tags.find(
        (t) => t.fileName === `tag${baseTagNumberForSlide}.xml`
      );
      let slideGuid: string | null = null;
      if (slideGuidTag) {
        const guidMatch = slideGuidTag.content.match(
          /<p:tag name="OR_SLIDE_GUID" val="([^"]+)"\/>/
        );
        if (guidMatch && guidMatch[1]) {
          slideGuid = guidMatch[1];
        }
      }
      let baseTheme = '';
      let blockIdentifier = '';
      if (questionData.theme) {
        const parts = questionData.theme.split('_');
        baseTheme = parts[0];
        if (parts.length > 1) {
          blockIdentifier = parts[1];
        } else {
          logger.warn(`[val17PptxGenerator] Question avec dbQuestionId ${questionData.dbQuestionId} a un thème "${questionData.theme}" sans suffixe de bloc identifiable (_X).`);
        }
      }

      questionMappingsInternal.push({
        dbQuestionId: questionData.dbQuestionId,
        slideGuid: slideGuid,
        orderInPptx: i + 1,
        theme: baseTheme,
        blockId: blockIdentifier
      });
    }
    if (existingTagsCount > 0 && questions.length > 0) {
      const warnings = ensureTagContinuity(outputZip, 1, maxTagNumberUsed, logger);
      if (warnings.length > 0)
        logger.warn(`⚠️ Problèmes de continuité des tags détectés: ${JSON.stringify(warnings)}`);
    }

    const allSlideNumbers: number[] = [];
    newIntroSlideDetails.forEach(d => allSlideNumbers.push(d.slideNumber));
    for (let i = 0; i < initialExistingSlideCount; i++) {
        allSlideNumbers.push(i + 1 + introSlidesAddedCount);
    }
    for (let i = 0; i < questions.length; i++) {
        allSlideNumbers.push(initialExistingSlideCount + introSlidesAddedCount + i + 1);
    }

    const newLayouts = [ombeaLayoutFileName];

    const contentTypesFile = outputZip.file("[Content_Types].xml");
    if (contentTypesFile) {
      let contentTypesContent = await contentTypesFile.async("string");
      if (imageExtensions.size > 0)
        contentTypesContent = updateContentTypesForImages(
          contentTypesContent,
          imageExtensions,
          logger
        );
      contentTypesContent = updateContentTypesComplete(
        contentTypesContent,
        allSlideNumbers,
        newLayouts,
        maxTagNumberUsed,
        logger
      );
      outputZip.file("[Content_Types].xml", contentTypesContent);
    }

    const presentationRelsFile = outputZip.file(
      "ppt/_rels/presentation.xml.rels"
    );
    if (presentationRelsFile) {
      const presentationRelsContent = await presentationRelsFile.async(
        "string"
      );
      const {
        updatedContent: updatedPresentationRels,
        slideRIdMappings,
        oldToNewRIdMap,
        orderedSlides,
      } = await updatePresentationRelsWithMappings(
        outputZip,
        presentationRelsContent,
        initialExistingSlideCount,
        newIntroSlideDetails,
        questions.length,
        logger
      );
      outputZip.file(
        "ppt/_rels/presentation.xml.rels",
        updatedPresentationRels
      );
      await rebuildPresentationXml(
        outputZip,
        slideRIdMappings,
        slideSizeAttrs,
        oldToNewRIdMap,
        logger
      );
    }

    await updateCoreXml(outputZip, questions.length, logger);
    if (!presentationRelsFile) {
        throw new Error("ppt/_rels/presentation.xml.rels not found");
    }
    const relsContent = await presentationRelsFile.async("string");
    const {
        updatedContent: updatedPresentationRels,
        slideRIdMappings,
        oldToNewRIdMap,
        orderedSlides
      } = await updatePresentationRelsWithMappings(
        outputZip,
        relsContent,
        initialExistingSlideCount,
        newIntroSlideDetails,
        questions.length,
        logger
      );
    const appMetadata = await calculateAppXmlMetadata(
        outputZip,
        orderedSlides,
        logger
    );
    await updateAppXml(outputZip, appMetadata, logger);

    const outputBlob = await outputZip.generateAsync({
      type: "blob",
      mimeType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      compression: "DEFLATE",
      compressionOptions: { level: 3 },
    });

    logger.info(`PPTX Blob et mappings de questions générés.`);
    logger.info('[LOG][val17PptxGenerator] Fin de generatePPTXVal17.');
    return { pptxBlob: outputBlob, questionMappings: questionMappingsInternal, preExistingQuestionSlideGuids };
  } catch (error: any) {
    logger.error(`=== ERREUR GÉNÉRATION VAL17 ===`);
    logger.error(error.message);
    throw new Error(`Erreur lors de la génération du PPTX interactif des questions OMBEA: ${error.message}`);
  }
}