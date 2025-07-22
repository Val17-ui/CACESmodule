import * as path from 'path';
import * as fs from 'fs';
import JSZip from "jszip";
import sizeOf from 'image-size';

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

function generateGUID(): string {
  const guid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16).toUpperCase();
  });
  console.log(`[LOG][val17PptxGenerator] Generated GUID: ${guid}`);
  return guid;
}

function escapeXml(unsafe: string): string {
  if (typeof unsafe !== "string") {
    // Ensure input is a string
    if (unsafe === null || unsafe === undefined) return "";
    unsafe = String(unsafe);
  }
  const cleaned = unsafe.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ""); // prefer-const
  return cleaned
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/--/g, "—");
}

function countExistingSlides(zip: JSZip): number {
  console.log('[LOG][val17PptxGenerator] Counting existing slides.');
  let count = 0;
  zip.folder("ppt/slides")?.forEach((relativePath) => {
    if (
      relativePath.match(/^slide\d+\.xml$/) &&
      !relativePath.includes("_rels")
    ) {
      count++;
    }
  });
  console.log(`[LOG][val17PptxGenerator] Found ${count} existing slides.`);
  return count;
}

function validateQuestions(questions: Val17Question[]): void {
  console.log('[LOG][val17PptxGenerator] Validating questions.');
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
  console.log('[LOG][val17PptxGenerator] Questions validated successfully.');
}

function calculateImageDimensions(
  originalWidth: number,
  originalHeight: number
): ImageDimensions {
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

  const dimensions = {
    x: imageAreaX + offsetX,
    y: imageAreaY + offsetY,
    width: finalWidth,
    height: finalHeight,
  };
  console.log('[LOG][val17PptxGenerator] Calculated image dimensions:', dimensions);
  return dimensions;
}

function processCloudUrl(url: string): string {
  console.log(`[LOG][val17PptxGenerator] Processing cloud URL: ${url}`);
  try {
    if (url.includes("dropbox.com")) {
      const newUrl = url.replace("?dl=0", "?dl=1");
      console.log(`[LOG][val17PptxGenerator] Dropbox URL transformed to: ${newUrl}`);
      return newUrl;
    }
    return url;
  } catch (error) {
    console.error("[ERREUR][val17PptxGenerator] Erreur lors du traitement de l'URL:", error);
    return url;
  }
}

async function loadLocalImageWithDimensions(filePath: string): Promise<{
  data: Buffer;
  extension: string;
  width: number;
  height: number;
} | null> {
  console.log(`[LOG][val17PptxGenerator] Loading local image from: ${filePath}`);
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
    console.log(`[LOG][val17PptxGenerator] Local image loaded successfully. Dimensions: ${result.width}x${result.height}`);
    return result;
  } catch (error) {
    console.error("[ERREUR][val17PptxGenerator] Erreur lors du chargement de l'image locale :", error);
    return null;
  }
}

async function downloadImageFromCloudWithDimensions(url: string): Promise<{
  data: Buffer;
  extension: string;
  width: number;
  height: number;
} | null> {
  console.log(`[LOG][val17PptxGenerator] Downloading image from cloud: ${url}`);
  try {
    let finalUrl = url;
    if (url.includes("dropbox.com")) {
      finalUrl = processCloudUrl(url);
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
    console.log(`[LOG][val17PptxGenerator] Image downloaded successfully. Dimensions: ${result.width}x${result.height}`);
    return result;
  } catch (error) {
    console.error(`[ERREUR][val17PptxGenerator] [IMAGE] ✗ Échec pour ${url}:`, error);
    return null;
  }
}

function updateContentTypesForImages(
  content: string,
  imageExtensions: Set<string>
): string {
  console.log('[LOG][val17PptxGenerator] Updating content types for images:', imageExtensions);
  let updated = content;
  imageExtensions.forEach((ext) => {
    if (!updated.includes(`Extension="${ext}"`)) {
      console.log(`[LOG][val17PptxGenerator] Adding content type for extension: ${ext}`);
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
  return updated;
}

async function findNextAvailableSlideLayoutId(
  zip: JSZip
): Promise<{ layoutId: number; layoutFileName: string; rId: string }> {
  console.log('[LOG][val17PptxGenerator] Finding next available slide layout ID.');
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
  const allRIds = extractExistingRIds(masterRelsContent);
  const existingRIds = allRIds.map((m) => m.rId); 
  const nextRId = getNextAvailableRId(existingRIds);
  const result = {
    layoutId: nextLayoutNum,
    layoutFileName: `slideLayout${nextLayoutNum}.xml`,
    rId: nextRId,
  };
  console.log('[LOG][val17PptxGenerator] Next available slide layout ID found:', result);
  return result;
}

async function ensureOmbeaSlideLayoutExists(
  zip: JSZip
): Promise<{ layoutFileName: string; layoutRId: string }> {
  console.log('[LOG][val17PptxGenerator] Ensuring OMBEA slide layout exists.');
  const { layoutId, layoutFileName, rId } =
    await findNextAvailableSlideLayoutId(zip);
  const slideLayoutContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="tx" preserve="1"><p:cSld name="Titre et texte"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="Titre 1"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR" smtClean="0"/><a:t>Modifiez le style du titre</a:t></a:r><a:endParaRPr lang="fr-FR"/></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Espace réservé du texte 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr lvl="0"/><a:r><a:rPr lang="fr-FR" smtClean="0"/><a:t>Modifiez les styles du texte du masque</a:t></a:r></a:p><a:p><a:pPr lvl="1"/><a:r><a:rPr lang="fr-FR" smtClean="0"/><a:t>Deuxième niveau</a:t></a:r></a:p><a:p><a:pPr lvl="2"/><a:r><a:rPr lang="fr-FR" smtClean="0"/><a:t>Troisième niveau</a:t></a:r></a:p><a:p><a:pPr lvl="3"/><a:r><a:rPr lang="fr-FR" smtClean="0"/><a:t>Quatrième niveau</a:t></a:r></a:p><a:p><a:pPr lvl="4"/><a:r><a:rPr lang="fr-FR" smtClean="0"/><a:t>Cinquième niveau</a:t></a:r><a:endParaRPr lang="fr-FR"/></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="4" name="Espace réservé de la date 3"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="dt" sz="half" idx="10"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:fld id="{ABB4FD2C-0372-488A-B992-EB1BD753A34A}" type="datetimeFigureOut"><a:rPr lang="fr-FR" smtClean=... [truncated]
    Math.floor(Math.random() * 2147483647) + 1
  }"/></p:ext></p:extLst></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
  zip.file(`ppt/slideLayouts/${layoutFileName}`, slideLayoutContent);
  const slideLayoutRelsContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`;
  zip.file(
    `ppt/slideLayouts/_rels/${layoutFileName}.rels`,
    slideLayoutRelsContent
  );
  await updateSlideMasterRelsForNewLayout(zip, layoutFileName, rId);
  await updateSlideMasterForNewLayout(zip, layoutId, rId);
  await updateContentTypesForNewLayout(zip, layoutFileName);
  console.log(`[LOG][val17PptxGenerator] OMBEA slide layout ensured. FileName: ${layoutFileName}, rId: ${rId}`);
  return { layoutFileName: layoutFileName, layoutRId: rId };
}

async function updateSlideMasterRelsForNewLayout(
  zip: JSZip,
  layoutFileName: string,
  rId: string
): Promise<void> {
  console.log(`[LOG][val17PptxGenerator] Updating slide master rels for new layout: ${layoutFileName}`);
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
}

async function updateSlideMasterForNewLayout(
  zip: JSZip,
  layoutId: number,
  rId: string
): Promise<void> {
  console.log(`[LOG][val17PptxGenerator] Updating slide master for new layout ID: ${layoutId}`);
  const masterFile = zip.file("ppt/slideMasters/slideMaster1.xml");
  if (masterFile) {
    let content = await masterFile.async("string");
    const layoutIdLstEnd = content.indexOf("</p:sldLayoutIdLst>");
    if (layoutIdLstEnd > -1) {
      const layoutIdValue = 2147483648 + layoutId;
      const newLayoutId = `\n    <p:sldId id="${layoutIdValue}" r:id="${rId}"/>`;
      content =
        content.slice(0, layoutIdLstEnd) +
        newLayoutId +
        "\n  " +
        content.slice(layoutIdLstEnd);
      zip.file("ppt/slideMasters/slideMaster1.xml", content);
    }
  }
}

async function updateContentTypesForNewLayout(
  zip: JSZip,
  layoutFileName: string
): Promise<void> {
  console.log(`[LOG][val17PptxGenerator] Updating content types for new layout: ${layoutFileName}`);
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
}

function createIntroTitleSlideXml(
  sessionInfo: SessionInfo,
  slideNumber: number
): string {
  console.log(`[LOG][val17PptxGenerator] Creating intro title slide XML for slide number: ${slideNumber}`);
  const slideComment = `<!-- Intro Slide ${slideNumber}: Title -->`;
  const baseId = slideNumber * 1000;
  const titlePlaceholder = `<p:sp>\n    <p:nvSpPr>\n      <p:cNvPr id="${baseId + 1}" name="Title Placeholder"/>\n      <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>\n      <p:nvPr><p:ph type="title"/></p:nvPr>\n    </p:nvSpPr>\n    <p:spPr/>\n    <p:txBody>\n      <a:bodyPr/><a:lstStyle/>\n      <a:p><a:r><a:rPr lang="fr-FR"/><a:t>${escapeXml(
    sessionInfo.title
  )}</a:t></a:r></a:p>\n    </p:txBody>\n  </p:sp>`;

  const datePlaceholder = sessionInfo.date
    ? `<p:sp>\n    <p:nvSpPr>\n      <p:cNvPr id="${baseId + 2}" name="Subtitle Placeholder"/>\n      <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>\n      <p:nvPr><p:ph type="body" idx="1"/></p:nvPr>\n    </p:nvSpPr>\n    <p:spPr/>\n    <p:txBody>\n      <a:bodyPr/><a:lstStyle/>\n      <a:p><a:r><a:rPr lang="fr-FR"/><a:t>${escapeXml(
        sessionInfo.date
      )}</a:t></a:r></a:p>\n    </p:txBody>\n  </p:sp>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n  ${slideComment}\n  <p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">\n    <p:cSld>\n      <p:spTree>\n        <p:nvGrpSpPr>\n          <p:cNvPr id="${baseId}" name="Intro Title Group"/>\n          <p:cNvGrpSpPr/><p:nvPr/>\n        </p:nvGrpSpPr>\n        <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>\n        ${titlePlaceholder}\n        ${datePlaceholder}\n      </p:spTree>\n    </p:cSld>\n    <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>\n  </p:sld>`;
}

function generateTableRowsXml(
  participants: ParticipantForGenerator[],
  rowHeightEMU: number = 370840
): string {
  console.log(`[LOG][val17PptxGenerator] Generating table rows XML for ${participants.length} participants.`);
  let tableRowsXml = "";
  const hasOrganizationData = participants.some(p => p.organization && p.organization.trim() !== "");

  tableRowsXml += `<a:tr h="${rowHeightEMU}">`;
  const headers = ["N°", "ID Boîtier", "Nom", "Prénom"];
  if (hasOrganizationData) {
    headers.push("Organisation");
  }

  headers.forEach(headerText => {
    tableRowsXml += `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr b="1" lang="fr-FR"/><a:t>${escapeXml(headerText)}</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>`;
  });
  tableRowsXml += `</a:tr>`;

  participants.forEach((participant, index) => {
    tableRowsXml += `<a:tr h="${rowHeightEMU}">`;
    tableRowsXml += `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR"/><a:t>${index + 1}</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>`;
    tableRowsXml += `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR"/><a:t>${escapeXml(participant.idBoitier || "")}</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>`;
    tableRowsXml += `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR"/><a:t>${escapeXml(participant.nom || "")}</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>`;
    tableRowsXml += `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR"/><a:t>${escapeXml(participant.prenom || "")}</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>`;
    if (hasOrganizationData) {
      tableRowsXml += `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR"/><a:t>${escapeXml(participant.organization || "")}</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>`;
    }
    tableRowsXml += `</a:tr>`;
  });

  return tableRowsXml;
}

function generateTableGraphicFrame(participants: ParticipantForGenerator[], baseSpId: number): string {
    console.log('[LOG][val17PptxGenerator] Generating table graphic frame.');
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

    const tableRows = generateTableRowsXml(participants, rowHeightEMU);

    let tableXml = `<p:graphicFrame>\n      <p:nvGraphicFramePr>\n        <p:cNvPr id="${baseSpId}" name="Tableau Participants"/>\n        <p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr>\n        <p:nvPr/>\n      </p:nvGraphicFramePr>\n      <p:xfrm>\n        <a:off x="${tableX}" y="${tableY}"/>\n        <a:ext cx="${tableCx}" cy="${tableCy}"/>\n      </p:xfrm>\n      <a:graphic>\n        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">\n          <a:tbl>\n            <a:tblPr firstRow="1" bandRow="1">\n              <a:tableStyleId>{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}</a:tableStyleId>\n            </a:tblPr>\n            <a:tblGrid>`;
    colWidths.forEach(w => { tableXml += `<a:gridCol w="${w}"/>`; });
    tableXml += `</a:tblGrid>${tableRows}</a:tbl>\n        </a:graphicData>\n      </a:graphic>\n    </p:graphicFrame>`;
    return tableXml;
}

function createIntroParticipantsSlideXml(
  participants: ParticipantForGenerator[],
  slideNumber: number,
  layoutPptxFilePath: string | null,
  layoutXmlAsSlideBase: string | null,
  layoutGraphicFrameTarget: string | null,
  layoutTblPr: string | null,
  layoutTblGrid: string | null
): string {
  console.log(`[LOG][val17PptxGenerator] Creating intro participants slide XML for slide number: ${slideNumber}`);
  const slideComment = `<!-- Intro Slide ${slideNumber}: Participants -->`;
  const titleTextToSet = "Participants";

  let finalSlideXml = "";

  if (layoutXmlAsSlideBase && layoutGraphicFrameTarget && layoutTblPr && layoutTblGrid) {
    console.log("[LOG][val17PptxGenerator] Using provided layout for participants slide.");
    const tableRows = generateTableRowsXml(participants);
    const newTblContent = `${layoutTblPr}${layoutTblGrid}${tableRows}`;
    const newFullTblXml = `<a:tbl>${newTblContent}</a:tbl>`;
    const graphicFrameWithNewTable = layoutGraphicFrameTarget.replace(
      /<a:tbl>[\s\S]*?<\/a:tbl>/,
      newFullTblXml
    );

    const baseSlideStructure = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n    ${slideComment}\n    <p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">\n      <p:cSld name="${layoutPptxFilePath ? layoutPptxFilePath.substring(layoutPptxFilePath.lastIndexOf('/') + 1, layoutPptxFilePath.lastIndexOf('.')) : 'ParticipantsLayout'}">\n        <p:spTree>\n          <p:nvGrpSpPr>\n            <p:cNvPr id="${slideNumber * 1000 + 0}" name="Group Shape"/> <p:cNvGrpSpPr/><p:nvPr/>\n          </p:nvGrpSpPr>\n          <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>\n          <p:sp>\n            <p:nvSpPr>\n              <p:cNvPr id="${slideNumber * 1000 + 1}" name="Title"/>\n              <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>\n              <p:nvPr><p:ph type="title"/></p:nvPr>\n            </p:nvSpPr>\n            <p:spPr/>\n            <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR"/><a:t>${escapeXml(titleTextToSet)}</a:t></a:r></a:p></a:txBody>\n          </p:sp>\n          ${graphicFrameWithNewTable}\n        </p:spTree>\n      </p:cSld>\n      <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>\n    </p:sld>`;
    finalSlideXml = baseSlideStructure;

  } else {
    console.log("[LOG][val17PptxGenerator] Fallback: Dynamically generating full participants table.");
    const dynamicTableGraphicFrame = generateTableGraphicFrame(participants, slideNumber * 1000 + 2);

    finalSlideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n    ${slideComment}\n    <p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">\n      <p:cSld name="${layoutPptxFilePath ? layoutPptxFilePath.substring(layoutPptxFilePath.lastIndexOf('/') + 1, layoutPptxFilePath.lastIndexOf('.')) : 'ParticipantsLayout'}">\n        <p:spTree>\n          <p:nvGrpSpPr>\n            <p:cNvPr id="${slideNumber * 1000}" name="Content Group"/>\n            <p:cNvGrpSpPr/><p:nvPr/>\n          </p:nvGrpSpPr>\n          <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>\n          <p:sp>\n            <p:nvSpPr>\n              <p:cNvPr id="${slideNumber * 1000 + 1}" name="Title"/>\n              <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>\n              <p:nvPr><p:ph type="title"/></p:nvPr>\n            </p:nvSpPr>\n            <p:spPr/>\n            <p:txBody>\n              <a:bodyPr/><a:lstStyle/>\n              <a:p><a:r><a:rPr lang="fr-FR"/><a:t>${escapeXml(titleTextToSet)}</a:t></a:r></a:p>\n            </p:txBody>\n          </p:sp>\n          ${dynamicTableGraphicFrame}\n        </p:spTree>\n      </p:cSld>\n      <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>\n    </p:sld>`;
  }
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
  imageDimensions?: ImageDimensions,
  ombeaConfig?: ConfigOptions
): string {
  console.log(`[LOG][val17PptxGenerator] Creating slide XML for question slide number: ${slideNumber}`);
  const slideComment = `<!-- Slide ${slideNumber} -->`;
  // slideNumber est le numéro de la diapositive dans le lot de questions (1ère q, 2ème q)
  // et non le numéro absolu de la diapositive dans la présentation finale.

  const grpId = 1; // ID fixe pour le p:nvGrpSpPr principal de la diapositive de question
  const titleId = 2; // ID pour la forme du titre
  const bodyId = 3;  // ID pour la forme des réponses/options
  const countdownId = 4; // ID pour la forme du compte-à-rebours
  const imageId = 5; // ID pour la forme de l'image (si présente)

  // L'ancienne méthode de calcul des IDs basée sur slideNumber * 100 est supprimée
  // pour ces éléments spécifiques dans les diapositives de questions OMBEA.

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
  let xmlContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${slideComment}<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="${grpId}" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="${titleId}" name="Titre ${slideNumber}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/><p:custDataLst><p:tags r:id="rId2"/></p:custDataLst></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR" dirty="0"/><a:t>${escapeXml(
    question
  )}</a:t></a:r><a:endParaRPr lang="fr-FR" dirty="0"/></a:p></p:txBody></p:sp>`;
  if (imageDimensions) {
    xmlContent += `<p:pic><p:nvPicPr><p:cNvPr id="${imageId}" name="Image ${slideNumber}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId6"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${imageDimensions.x}" y="${imageDimensions.y}"/><a:ext cx="${imageDimensions.width}" cy="${imageDimensions.height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
  }
  xmlContent += `<p:sp><p:nvSpPr><p:cNvPr id="${bodyId}" name="Espace réservé du texte ${slideNumber}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/><p:custDataLst><p:tags r:id="rId3"/></p:custDataLst></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="1600200"/><a:ext cx="4572000" cy="4525963"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/>${listStyleXml}${options
    .map(
      (option) =>
        `<a:p><a:pPr><a:buFont typeface="+mj-lt"/><a:buAutoNum type="${bulletTypeForXml}"/></a:pPr><a:r><a:rPr lang="fr-FR" dirty="0"/><a:t>${escapeXml(
          option
        )}</a:t></a:r></a:p>`
    )
    .join("")}</p:txBody></p:sp>`;
  if (Number(countdownDisplayText) > 0) {
    // Nouvelles coordonnées X=7380000 (20.5cm), Y=3722400 (10.34cm)
    xmlContent += `<p:sp><p:nvSpPr><p:cNvPr id="${countdownId}" name="OMBEA Countdown ${slideNumber}"/><p:cNvSpPr txBox="1"/><p:nvPr><p:custDataLst><p:tags r:id="rId4"/></p:custDataLst></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="7380000" y="3722400"/><a:ext cx="1524000" cy="769441"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr vert="horz" rtlCol="0" anchor="ctr" anchorCtr="1"><a:spAutoFit/></a:bodyPr><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR" sz="4400" smtClean="0"/><a:t>${String(
      countdownDisplayText
    )}</a:t></a:r><a:endParaRPr lang="fr-FR" sz="4400"/></a:p></p:txBody></p:sp>`;
  }
  xmlContent += `</p:spTree><p:custDataLst><p:tags r:id="rId1"/></p:custDataLst><p:extLst><p:ext uri="{BB962C8B-B14F-4D97-AF65-F5344CB8AC3E}"><p14:creationId xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" val="${
    Math.floor(Math.random() * 2147483647) + 1
  }"/></p:ext></p:extLst></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr><p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"/></p:par></p:tnLst></p:timing></p:sld>`;
  return xmlContent;
}

function calculateBaseTagNumber(
  slideNumberInBatch: number,
  tagOffset: number = 0
): number {
  return tagOffset + 1 + (slideNumberInBatch - 1) * 4;
}

function findHighestExistingTagNumber(zip: JSZip): number {
  console.log('[LOG][val17PptxGenerator] Finding highest existing tag number.');
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
  console.log(`[LOG][val17PptxGenerator] Highest existing tag number is: ${maxTagNumber}`);
  return maxTagNumber;
}

async function findLayoutByCSldName(
  zip: JSZip,
  targetName: string,
  layoutType: "title" | "participants"
): Promise<string | null> {
  console.log(`[LOG][val17PptxGenerator] Finding layout by cSld name. Target: "${targetName}", Type: ${layoutType}`);
  const layoutsFolder = zip.folder("ppt/slideLayouts");
  if (!layoutsFolder) {
    console.warn('[WARN][val17PptxGenerator] ppt/slideLayouts folder not found.');
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
            console.log(`[LOG][val17PptxGenerator] Found exact layout match: ${fileEntry.name}`);
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
                console.log(`[LOG][val17PptxGenerator] Found aliased layout match: ${fileEntry.name}`);
                return fileEntry.name;
              }
            }
          }
        }
       } catch (_error) { 
        console.warn(`[WARN][val17PptxGenerator] Error reading layout file ${fileEntry.name}`, _error);
      }
    }
  }
  console.warn(`[WARN][val17PptxGenerator] No layout found for target: "${targetName}"`);
  return null;
}

function ensureTagContinuity(
  zip: JSZip,
  startingTag: number,
  endingTag: number
): string[] {
  console.log(`[LOG][val17PptxGenerator] Ensuring tag continuity from ${startingTag} to ${endingTag}.`);
  const warnings: string[] = [];
  for (let i = startingTag; i <= endingTag; i++) {
    if (!zip.file(`ppt/tags/tag${i}.xml`)) {
      warnings.push(`Attention: tag${i}.xml manquant dans la séquence`);
    }
  }
  return warnings;
}

function createSlideTagFiles(
  questionIndexInBatch: number,
  options: string[],
  correctAnswerIndex: number | undefined,
  duration: number,
  ombeaConfig?: ConfigOptions,
  tagOffset: number = 0
): TagInfo[] {
  console.log(`[LOG][val17PptxGenerator] Creating slide tag files for question index in batch: ${questionIndexInBatch}`);
  const baseTagNumber = calculateBaseTagNumber(questionIndexInBatch, tagOffset);
  const slideGuid = generateGUID();
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
      .map(escapeXml)
      .join("&#13;")}"/></p:tagLst>`, 
  });
  tags.push({
    tagNumber: baseTagNumber + 3,
    fileName: `tag${baseTagNumber + 3}.xml`,
    content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:tagLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:tag name="OR_SHAPE_TYPE" val="OR_COUNTDOWN"/></p:tagLst>`, 
  });
  return tags;
}

function extractExistingRIds(relsContent: string): RIdMapping[] {
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
  return mappings;
}

function getNextAvailableRId(existingRIds: string[]): string {
  let maxId = 0;
  existingRIds.forEach((rId) => {
    const match = rId.match(/rId(\d+)/);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (num > maxId) maxId = num;
    }
  });
  return `rId${maxId + 1}`;
}

function updatePresentationRelsWithMappings(
  originalContent: string,
  initialExistingSlideCount: number,
  introSlideDetails: {
    slideNumber: number;
    layoutRIdInSlide: string;
    layoutFileName: string;
  }[],
  newOmbeaQuestionCount: number
): {
  updatedContent: string;
  slideRIdMappings: { slideNumber: number; rId: string }[];
  oldToNewRIdMap: { [oldRId: string]: string };
} {
  console.log('[LOG][val17PptxGenerator] Updating presentation rels with mappings.');
  const existingRels = extractExistingRIds(originalContent);
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
    console.warn("[WARN][val17PptxGenerator] No Slide Master found. Adding a default as rId1.");
    finalRelsOutput.push({ rId: "rId1", type: slideMasterType, target: "slideMasters/slideMaster1.xml", originalRId: "rId1_placeholder" });
  }
  rIdCounter = 2;

  introSlideDetails.forEach((detail, index) => {
    const newRId = `rId${rIdCounter++}`;
    const finalSlideOrderIndex = index + 1;
    finalRelsOutput.push({
      rId: newRId,
      type: slideType,
      target: `slides/slide${detail.slideNumber}.xml`,
    });
    slideRIdMappings.push({ slideNumber: finalSlideOrderIndex, rId: newRId });
  });

  for (let i = 0; i < initialExistingSlideCount; i++) {
    const templateSlideFileNumber = i + 1;
    const slideTarget = `slides/slide${templateSlideFileNumber}.xml`;
    const originalRel = existingRels.find(m => m.target === slideTarget && m.type === slideType);
    const newRId = `rId${rIdCounter++}`;
    const finalSlideOrderIndex = introSlideDetails.length + 1 + i;

    finalRelsOutput.push({
      rId: newRId,
      type: slideType,
      target: slideTarget,
      originalRId: originalRel?.rId,
    });
    slideRIdMappings.push({ slideNumber: finalSlideOrderIndex, rId: newRId });
    if (originalRel) oldToNewRIdMap[originalRel.rId] = newRId;
  }

  for (let i = 0; i < newOmbeaQuestionCount; i++) {
    const questionSlideFileNumber = initialExistingSlideCount + introSlideDetails.length + 1 + i;
    const newRId = `rId${rIdCounter++}`;
    const finalSlideOrderIndex = introSlideDetails.length + initialExistingSlideCount + 1 + i;

    finalRelsOutput.push({
      rId: newRId,
      type: slideType,
      target: `slides/slide${questionSlideFileNumber}.xml`
    });
    slideRIdMappings.push({ slideNumber: finalSlideOrderIndex, rId: newRId });
  }

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

  slideRIdMappings.sort((a, b) => a.slideNumber - b.slideNumber);
  console.log('[LOG][val17PptxGenerator] Presentation rels updated.');
  return { updatedContent, slideRIdMappings, oldToNewRIdMap };
}

async function rebuildPresentationXml(
  zip: JSZip,
  slideRIdMappings: { slideNumber: number; rId: string }[],
  slideSizeAttrs: SlideSizeAttributes | null,
  oldToNewRIdMap: { [oldRId: string]: string }
): Promise<void> {
  console.log('[LOG][val17PptxGenerator] Rebuilding presentation.xml.');
  const presentationFile = zip.file("ppt/presentation.xml");
  if (!presentationFile) {
    console.error("[ERREUR][val17PptxGenerator] ppt/presentation.xml not found in template ZIP.");
    return;
  }
  let content = await presentationFile.async("string");

  content = content.replace(/r:id="(rId\d+)"/g, (match, oldRId) => {
    const newRId = oldToNewRIdMap[oldRId];
    if (newRId) {
      return `r:id="${newRId}"`;
    }
    console.warn(
      `[WARN][val17PptxGenerator] presentation.xml: No new r:id mapping found for old r:id="${oldRId}". Keeping original. Match: ${match}`
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
            console.warn(
              "[WARN][val17PptxGenerator] Could not find a suitable place to insert <p:sldSz> in presentation.xml."
            );
          }
        }
      }
    }
  }
  zip.file("ppt/presentation.xml", content);
  console.log('[LOG][val17PptxGenerator] presentation.xml rebuilt.');
}

function updateContentTypesComplete(
  originalContent: string,
  introSlideDetails: { slideNumber: number; layoutFileName: string }[],
  newOmbeaQuestionCount: number,
  totalSlidesInFinalPptx: number,
  ombeaQuestionLayoutFileName: string,
  totalTagsUsed: number
): string {
  console.log('[LOG][val17PptxGenerator] Performing complete update of [Content_Types].xml.');
  let updatedContent = originalContent;
  let newOverrides = "";

  introSlideDetails.forEach((detail) => {
    const slidePartName = `/ppt/slides/slide${detail.slideNumber}.xml`;
    if (!updatedContent.includes(`PartName="${slidePartName}"`)) {
      newOverrides += `\n  <Override PartName="${slidePartName}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
    }
  });

  const ombeaLayoutPartName = `/ppt/slideLayouts/${ombeaQuestionLayoutFileName}`;
  if (!updatedContent.includes(`PartName="${ombeaLayoutPartName}"`)) {
    const lastLayoutIdx = updatedContent.lastIndexOf("slideLayout");
    let insertPt = -1;
    if (lastLayoutIdx > -1)
      insertPt = updatedContent.indexOf("/>", lastLayoutIdx) + 2;
    else insertPt = updatedContent.lastIndexOf("</Types>");
    if (insertPt > -1) {
      const newLayoutOverride = `\n  <Override PartName="${ombeaLayoutPartName}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>`;
      updatedContent =
        updatedContent.slice(0, insertPt) +
        newLayoutOverride +
        updatedContent.slice(insertPt);
    }
  }

  const slidesBeforeOmbeaQuestions =
    totalSlidesInFinalPptx - newOmbeaQuestionCount;
  for (let i = 0; i < newOmbeaQuestionCount; i++) {
    const slideNum = slidesBeforeOmbeaQuestions + 1 + i;
    const slidePartName = `/ppt/slides/slide${slideNum}.xml`;
    if (!updatedContent.includes(`PartName="${slidePartName}"`)) {
      newOverrides += `\n  <Override PartName="${slidePartName}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
    }
  }

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
  return updatedContent;
}

function calculateAppXmlMetadata(
  totalFinalSlides: number,
  newOmbeaQuestions: Val17Question[]
): AppXmlMetadata {
  console.log('[LOG][val17PptxGenerator] Calculating app.xml metadata.');
  let totalWords = 0;
  let totalParagraphs = 0;
  const newSlideTitles: string[] = [];
  newOmbeaQuestions.forEach((q) => {
    const questionWords = q.question.trim().split(/\s+/).filter(Boolean).length;
    const optionsWords = q.options
      .map((opt) => opt.trim().split(/\s+/).filter(Boolean).length)
      .reduce((a, b) => a + b, 0);
    totalWords += questionWords + optionsWords + 1;
    totalParagraphs += 1 + q.options.length + 1;
    newSlideTitles.push(q.question);
  });
  const metadata = {
    totalSlides: totalFinalSlides,
    totalWords,
    totalParagraphs,
    slideTitles: newSlideTitles,
  };
  console.log('[LOG][val17PptxGenerator] App.xml metadata calculated:', metadata);
  return metadata;
}

async function updateAppXml(
  zip: JSZip,
  metadata: AppXmlMetadata
): Promise<void> {
  console.log('[LOG][val17PptxGenerator] Updating app.xml.');
  const appFile = zip.file("docProps/app.xml");
  if (!appFile) {
    console.warn("[WARN][val17PptxGenerator] app.xml not found, creating a new file.");
    createNewAppXml(zip, metadata);
    return;
  }
  let content = await appFile.async("string");
  content = updateSimpleFields(content, metadata);
  content = updateHeadingPairsAndTitles(content, metadata.slideTitles);
  zip.file("docProps/app.xml", content);
  console.log('[LOG][val17PptxGenerator] app.xml updated.');
}

function updateSimpleFields(content: string, metadata: AppXmlMetadata): string {
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
  return updated;
}

function updateHeadingPairsAndTitles(
  content: string,
  newOmbeaSlideTitles: string[]
): string {
  let updated = content;
  const titlesToAddCount = newOmbeaSlideTitles.length;

  const headingPairsRegex =
    /<vt:lpstr>Titres des diapositives<\/vt:lpstr>\s*<\/vt:variant>\s*<vt:variant>\s*<vt:i4>(\d+)<\/vt:i4>/;
  updated = updated.replace(headingPairsRegex, (_match, p1) => {
    const existingCount = parseInt(p1, 10);
    return `<vt:lpstr>Titres des diapositives<\/vt:lpstr><\/vt:variant><vt:variant><vt:i4>${
      existingCount + titlesToAddCount
    }<\/vt:i4>`;
  });

  const titlesOfPartsEndIndex = updated.indexOf(
    "</vt:vector>",
    updated.indexOf("<TitlesOfParts>")
  );
  if (titlesOfPartsEndIndex !== -1) {
    let titlesXmlToAdd = "";
    newOmbeaSlideTitles.forEach((title) => {
      titlesXmlToAdd += `\n      <vt:lpstr>${escapeXml(
        title.substring(0, 250)
      )}<\/vt:lpstr>`;
    });
    updated =
      updated.slice(0, titlesOfPartsEndIndex) +
      titlesXmlToAdd +
      updated.slice(titlesOfPartsEndIndex);

    updated = updated.replace(
      /<TitlesOfParts>\s*<vt:vector size="(\d+)"/,
      (_match, p1) => {
        const existingSize = parseInt(p1, 10);
        return `<TitlesOfParts><vt:vector size="${
          existingSize + titlesToAddCount
        }"`;
      }
    );
  }
  return updated;
}

function buildHeadingPairs(
  nonSlideTitles: string[],
  allSlideTitles: string[]
): string {
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
  return `<HeadingPairs><vt:vector size="${vectorSize}" baseType="variant">${pairs.join(
    ""
  )}\n    <\/vt:vector><\/HeadingPairs>`;
}

function buildTitlesOfParts(
  fonts: string[],
  themes: string[],
  existingSlideTitles: string[],
  newSlideTitles: string[]
): string {
  const allTitles: string[] = [];
  fonts.forEach((font) => allTitles.push(escapeXml(font)));
  themes.forEach((theme) => allTitles.push(escapeXml(theme)));
  existingSlideTitles.forEach((title) => allTitles.push(escapeXml(title)));
  newSlideTitles.forEach((title) => {
    const truncatedTitle =
      title.length > 250 ? title.substring(0, 247) + "..." : title;
    allTitles.push(escapeXml(truncatedTitle));
  });
  const vectorContent = allTitles
    .map((title) => `\n      <vt:lpstr>${title}<\/vt:lpstr>`)
    .join("");
  return `<TitlesOfParts><vt:vector size="${allTitles.length}" baseType="lpstr">${vectorContent}\n    <\/vt:vector><\/TitlesOfParts>`;
}

function createNewAppXml(zip: JSZip, metadata: AppXmlMetadata): void {
  console.log('[LOG][val17PptxGenerator] Creating new app.xml.');
  const defaultFonts = ["Arial", "Calibri"];
  const defaultThemes = ["Thème Office"];
  const headingPairs = buildHeadingPairs(
    [...defaultFonts, ...defaultThemes],
    metadata.slideTitles
  );
  const titlesOfParts = buildTitlesOfParts(
    defaultFonts,
    defaultThemes,
    [],
    metadata.slideTitles
  );

  const appXmlContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">\n  <TotalTime>2<\/TotalTime><Words>${metadata.totalWords}<\/Words><Application>Microsoft Office PowerPoint<\/Application>\n  <PresentationFormat>Affichage à l'écran (4:3)<\/PresentationFormat><Paragraphs>${metadata.totalParagraphs}<\/Paragraphs>\n  <Slides>${metadata.totalSlides}<\/Slides><Notes>0<\/Notes><HiddenSlides>0<\/HiddenSlides><MMClips>0<\/MMClips>\n  <ScaleCrop>false<\/ScaleCrop>${headingPairs}${titlesOfParts}<Company/><LinksUpToDate>false<\/LinksUpToDate>\n  <SharedDoc>false<\/SharedDoc><HyperlinksChanged>false<\/HyperlinksChanged><AppVersion>14.0000<\/AppVersion><\/Properties>`;
  zip.file("docProps/app.xml", appXmlContent);
}

async function updateCoreXml(
  zip: JSZip,
  newQuestionCount: number
): Promise<void> {
  console.log('[LOG][val17PptxGenerator] Updating core.xml.');
  const coreFile = zip.file("docProps/core.xml");
  if (coreFile) {
    let content = await coreFile.async("string");
    const title = `Quiz OMBEA ${newQuestionCount} question${
      newQuestionCount > 1 ? "s" : ""
    }`;
    content = content.replace(
      /<dc:title>.*?<\/dc:title>/,
      `<dc:title>${escapeXml(title)}<\/dc:title>`
    );
    const now = new Date().toISOString();
    content = content.replace(
      /<dcterms:modified.*?>.*?<\/dcterms:modified>/,
      `<dcterms:modified xsi:type="dcterms:W3CDTF">${now}<\/dcterms:W3CDTF>`
    );
    if (!content.includes("<dcterms:created>")) {
      const lastModifiedEnd =
        content.indexOf("</dcterms:modified>") + "</dcterms:modified>".length;
      const createdTag = `\n  <dcterms:created xsi:type="dcterms:W3CDTF">${now}<\/dcterms:W3CDTF>`;
      if (lastModifiedEnd > -1 && lastModifiedEnd <= content.length) {
        content =
          content.slice(0, lastModifiedEnd) +
          createdTag +
          content.slice(lastModifiedEnd);
      } else {
        const corePropsEnd = content.lastIndexOf("</cp:coreProperties>");
        if (corePropsEnd > -1) {
          content =
            content.slice(0, corePropsEnd) +
            createdTag +
            "\n" +
            content.slice(corePropsEnd);
        }
      }
    }
    zip.file("docProps/core.xml", content);
    console.log('[LOG][val17PptxGenerator] core.xml updated.');
  }
}

// Helper function to get XML content of a layout file
async function getLayoutXml(zip: JSZip, layoutFileName: string): Promise<string | null> {
  const layoutFile = zip.file(layoutFileName);
  if (layoutFile) {
    return layoutFile.async("string");
  }
  console.warn(`[WARN][val17PptxGenerator] [getLayoutXml] Fichier layout non trouvé: ${layoutFileName}`);
  return null;
}

// Fonction principale exportée
export async function generatePPTXVal17(
  templateFile: string | Buffer,
  questions: Val17Question[],
  options: GenerationOptions = {},
  sessionInfo?: SessionInfo,
  participants?: ParticipantForGenerator[]
): Promise<{ pptxBlob: Blob; questionMappings: QuestionMapping[]; preExistingQuestionSlideGuids: string[]; } | null> {
  console.log('--- [LOG][val17PptxGenerator] DÉBUT DE LA GÉNÉRATION PPTX VAL17 ---');
  try {
    // const executionId = Date.now(); 
    validateQuestions(questions);
    if (!templateFile) {
      console.warn("[WARN][val17PptxGenerator] Aucun fichier modèle fourni.");
      throw new Error("Template file is required by generatePPTXVal17.");
    }

    // Gérer le cas où templateFile est un chemin de fichier (string)
    let templateBuffer: Buffer;
    if (typeof templateFile === 'string') {
        console.log(`[LOG][val17PptxGenerator] Loading template from file path: ${templateFile}`);
        if (!fs.existsSync(templateFile)) {
            console.error(`[ERREUR][val17PptxGenerator] Le fichier template n'existe pas à l'emplacement: ${templateFile}`);
            throw new Error(`Template file not found at: ${templateFile}`);
        }
        templateBuffer = fs.readFileSync(templateFile);
    } else {
        // Gérer les autres types (Buffer, etc.)
        console.log('[LOG][val17PptxGenerator] Loading template from buffer/object.');
        templateBuffer = templateFile; // Assumer que c'est déjà un Buffer
    }

    console.log('[LOG][val17PptxGenerator] Chargement du template ZIP.');
    const templateZip = await JSZip.loadAsync(templateBuffer);
    console.log('[LOG][val17PptxGenerator] Template ZIP chargé.');

    // ---> DÉBUT : Logique d'extraction exhaustive des GUIDs des questions préexistantes (sans logs internes excessifs) <---
    console.log('[LOG][val17PptxGenerator] Début de l\'extraction des GUIDs des questions préexistantes.');
    const preExistingQuestionSlideGuids: string[] = [];
    const slideFilesFolder = templateZip.folder("ppt/slides");

    if (slideFilesFolder) {
      const slideProcessingPromises: Promise<void>[] = [];
      slideFilesFolder.forEach((relativePath, slideFileEntry) => {
        if (relativePath.startsWith("slide") && relativePath.endsWith(".xml") && !slideFileEntry.dir) {
          // Pour chaque diapositive, lire son fichier de relations .rels
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
        console.log("[LOG][val17PptxGenerator] GUIDs des questions OMBEA préexistantes trouvés dans le modèle:", preExistingQuestionSlideGuids);
      } else {
        console.log("[LOG][val17PptxGenerator] Aucune question OMBEA préexistante (avec OR_SLIDE_GUID) trouvée dans le modèle.");
      }
    } else {
        console.log("[LOG][val17PptxGenerator] Dossier ppt/slides non trouvé dans le templateZip.");
    }
    // ---> FIN : Logique d'extraction exhaustive des GUIDs des questions préexistantes <---


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
        console.log('[LOG][val17PptxGenerator] Slide size attributes found:', slideSizeAttrs);
      } else {
        console.warn(
          "[WARN][val17PptxGenerator] <p:sldSz> non trouvé dans le presentation.xml du modèle."
        );
      }
    } else {
      console.warn("[WARN][val17PptxGenerator] ppt/presentation.xml non trouvé dans le ZIP du modèle.");
    }

    const existingTagsCount = findHighestExistingTagNumber(templateZip);
    let maxTagNumberUsed = existingTagsCount;

    const outputZip = new JSZip();
    const copyPromises: Promise<void>[] = [];
    console.log('[LOG][val17PptxGenerator] Copying all files from template to output zip.');
    templateZip.forEach((relativePath, file) => {
      if (!file.dir) {
        // Log the file being processed
        // console.log(`[val17PptxGenerator] Copying file: ${relativePath}`); // This is too verbose
        const copyPromise: Promise<void> = file
          .async("arraybuffer")
          .then((content) => {
            outputZip.file(relativePath, content);
          });
        copyPromises.push(copyPromise);
      } else {
        outputZip.folder(relativePath);
      }
    });
    await Promise.all(copyPromises);
    console.log('[LOG][val17PptxGenerator] All files copied.');

    const initialExistingSlideCount = countExistingSlides(outputZip);
    let introSlidesAddedCount = 0;
    const newIntroSlideDetails: {
      slideNumber: number;
      layoutRIdInSlide: string;
      layoutFileName: string;
    }[] = [];

    // Gestion de la diapositive de titre
    if (sessionInfo && options.introSlideLayouts?.titleLayoutName) {
      console.log('[LOG][val17PptxGenerator] Adding intro title slide.');
      const targetTitleLayoutName = options.introSlideLayouts.titleLayoutName;
      const actualTitleLayoutPath = await findLayoutByCSldName(outputZip, targetTitleLayoutName, "title");
      if (actualTitleLayoutPath) {
        const currentIntroSlideNumber = initialExistingSlideCount + introSlidesAddedCount + 1;
        const titleSlideXml = createIntroTitleSlideXml(sessionInfo, currentIntroSlideNumber);
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
        console.log(`[LOG][val17PptxGenerator] Intro title slide added as slide${currentIntroSlideNumber}.xml`);
      } else {
        console.warn(`[WARN][val17PptxGenerator] Layout de titre avec nom approchant "${targetTitleLayoutName}" non trouvé. Slide de titre non ajoutée.`);
      }
    }

    // Gestion de la diapositive des participants
    if (participants && participants.length > 0 && options.introSlideLayouts?.participantsLayoutName) {
      console.log('[LOG][val17PptxGenerator] Adding participants slide.');
      const targetParticipantsLayoutName = options.introSlideLayouts.participantsLayoutName;
      const actualParticipantsLayoutPath = await findLayoutByCSldName(outputZip, targetParticipantsLayoutName, "participants");

      if (actualParticipantsLayoutPath) {
        let layoutTblPrXml: string | null = null;
        let layoutTblGridXml: string | null = null;
        let layoutGraphicFrameXml: string | null = null;

        const layoutFileXmlContent = await getLayoutXml(outputZip, actualParticipantsLayoutPath);

        if (layoutFileXmlContent) {
          const graphicFrameRegex = /<p:graphicFrame>([\s\S]*?<a:tbl>[\s\S]*?<\/a:tbl>[\s\S]*?)<\/p:graphicFrame>/;
          const graphicFrameMatch = layoutFileXmlContent.match(graphicFrameRegex);

          if (graphicFrameMatch && graphicFrameMatch[0]) {
            layoutGraphicFrameXml = graphicFrameMatch[0];
            // Log plus complet de layoutGraphicFrameXml pour inspection
            if (layoutGraphicFrameXml.length < 2000) { // Limiter la taille du log si trop grand
                 console.log("[LOG][val17PptxGenerator] Full layoutGraphicFrameXml:", layoutGraphicFrameXml);
            } else {
                 console.log("[LOG][val17PptxGenerator] Found graphicFrame (snippet):", layoutGraphicFrameXml.substring(0, 1000) + "...");
            }
            console.log(`[LOG][val17PptxGenerator] Index of '<a:tblPr' in layoutGraphicFrameXml: ${layoutGraphicFrameXml.indexOf('<a:tblPr')}`);
            console.log(`[LOG][val17PptxGenerator] Index of '<a:tblGrid' in layoutGraphicFrameXml: ${layoutGraphicFrameXml.indexOf('<a:tblGrid')}`);

            // Tentative avec une regex très simple pour tblPr
            const simpleTblPrRegex = /<a:tblPr/;
            const simpleTblPrMatch = layoutGraphicFrameXml.match(simpleTblPrRegex);
            if (simpleTblPrMatch) {
              console.log("[LOG][val17PptxGenerator] Found '<a:tblPr' using simple regex. Match object:", simpleTblPrMatch);
            } else {
              console.warn("[WARN][val17PptxGenerator] Did NOT find '<a:tblPr' using simple regex.");
            }

            // Regex pour tblPr:
            const tblPrRegex = /<a:tblPr([^>]*)>([\s\S]*?)<\/a:tblPr>/;
            const tblPrMatch = layoutGraphicFrameXml.match(tblPrRegex);
            if (tblPrMatch && tblPrMatch[0]) { // tblPrMatch[0] est la balise complète, tblPrMatch[1] les attributs, tblPrMatch[2] le contenu interne
              layoutTblPrXml = tblPrMatch[0];
              console.log("[LOG][val17PptxGenerator] Extracted tblPr from layout (v2):", layoutTblPrXml);
            } else {
              console.warn("[WARN][val17PptxGenerator] Could not extract tblPr from layout's table within graphicFrame (v2).");
            }

            // Regex pour tblGrid:
            const tblGridRegex = /<a:tblGrid([^>]*)>([\s\S]*?)<\/a:tblGrid>/;
            const tblGridMatch = layoutGraphicFrameXml.match(tblGridRegex);
            if (tblGridMatch && tblGridMatch[0]) {
              layoutTblGridXml = tblGridMatch[0];
              console.log("[LOG][val17PptxGenerator] Extracted tblGrid from layout (v2):", layoutTblGridXml);
            } else {
              console.warn("[WARN][val17PptxGenerator] Could not extract tblGrid from layout's table within graphicFrame (v2).");
            }
          } else {
            console.warn("[WARN][val17PptxGenerator] No graphicFrame with a table found directly in layout XML. Will create table from scratch.");
          }
        } else {
          console.warn(`[WARN][val17PptxGenerator] Could not read content of layout file: ${actualParticipantsLayoutPath}`);
        }

        console.log(`[LOG][val17PptxGenerator] Layout des participants trouvé: ${actualParticipantsLayoutPath}. Préparation de la diapositive.`);
        const currentIntroSlideNumber = initialExistingSlideCount + introSlidesAddedCount + 1;

        const participantsSlideXml = createIntroParticipantsSlideXml(
          participants,
          currentIntroSlideNumber,
          actualParticipantsLayoutPath,
          layoutFileXmlContent,
          layoutGraphicFrameXml,
          layoutTblPrXml,
          layoutTblGridXml
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
        console.log(`[LOG][val17PptxGenerator] Participants slide added as slide${currentIntroSlideNumber}.xml`);
      } else {
        console.warn(`[WARN][val17PptxGenerator] Layout des participants avec nom approchant "${targetParticipantsLayoutName}" non trouvé.`);
      }
    }

    const effectiveExistingSlideCount =
      initialExistingSlideCount + introSlidesAddedCount;
    const ombeaLayout = await ensureOmbeaSlideLayoutExists(outputZip);
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

    if (questions.some((q) => q.imageUrl)) {
      console.log('[LOG][val17PptxGenerator] Processing images for questions.');
      const imagePromises = questions.map(async (question, index) => {
        if (question.imageUrl) {
          let imageData = null;
          if (question.imageUrl.startsWith("http://") || question.imageUrl.startsWith("https://")) {
            imageData = await downloadImageFromCloudWithDimensions(question.imageUrl);
          } else {
            // Assume local file path
            const resolvedImagePath = path.resolve(question.imageUrl);
            console.log(`[LOG][val17PptxGenerator] [IMAGE] Tentative de chargement de l'image locale: ${resolvedImagePath}`);
            if (fs.existsSync(resolvedImagePath)) {
              imageData = await loadLocalImageWithDimensions(resolvedImagePath);
            } else {
              console.warn(`[WARN][val17PptxGenerator] [IMAGE] Fichier image local non trouvé: ${resolvedImagePath}`);
            }
          }

          if (imageData) {
            const absoluteSlideNumberForImage =
              effectiveExistingSlideCount + index + 1;
            const imgFileName = `image_q_slide${absoluteSlideNumberForImage}.${imageData.extension}`;
            const dimensions = calculateImageDimensions(
              imageData.width,
              imageData.height
            );
            return {
              slideNumberContext: absoluteSlideNumberForImage,
              image: {
                fileName: imgFileName,
                data: imageData.data,
                width: imageData.width,
                height: imageData.height,
                dimensions,
                extension: imageData.extension,
              },
            };
          }
        }
        return null;
      });
      const imageResults = await Promise.all(imagePromises);
      imageResults.forEach((result) => {
        if (result && result.image) {
          downloadedImages.set(result.slideNumberContext, result.image);
          imageExtensions.add(result.image.extension);
          outputZip
            .folder("ppt/media")
            ?.file(result.image.fileName, result.image.data);
        }
      });
      console.log('[LOG][val17PptxGenerator] Image processing complete.');
    }

    console.log(`[LOG][val17PptxGenerator] Starting loop to create ${questions.length} question slides.`);
    for (let i = 0; i < questions.length; i++) {
      const absoluteSlideNumber = effectiveExistingSlideCount + i + 1;
      console.log(`[LOG][val17PptxGenerator] Processing question ${i + 1}/${questions.length}, absolute slide number ${absoluteSlideNumber}.`);
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
        downloadedImage?.dimensions,
        options.ombeaConfig
      );
      outputZip.file(`ppt/slides/slide${absoluteSlideNumber}.xml`, slideXml);

      const baseTagNumberForSlide = calculateBaseTagNumber(
        i + 1,
        existingTagsCount
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
          console.warn(`[WARN][val17PptxGenerator] Question avec dbQuestionId ${questionData.dbQuestionId} a un thème "${questionData.theme}" sans suffixe de bloc identifiable (_X).`);
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
    console.log('[LOG][val17PptxGenerator] Question slide creation loop finished.');

    if (existingTagsCount > 0 && questions.length > 0) {
      const warnings = ensureTagContinuity(outputZip, 1, maxTagNumberUsed);
      if (warnings.length > 0)
        console.warn("[WARN][val17PptxGenerator] ⚠️ Problèmes de continuité des tags détectés:", warnings);
    }

    const totalFinalSlideCount = effectiveExistingSlideCount + questions.length;

    const contentTypesFile = outputZip.file("[Content_Types].xml");
    if (contentTypesFile) {
      let contentTypesContent = await contentTypesFile.async("string");
      if (imageExtensions.size > 0)
        contentTypesContent = updateContentTypesForImages(
          contentTypesContent,
          imageExtensions
        );
      contentTypesContent = updateContentTypesComplete(
        contentTypesContent,
        newIntroSlideDetails.map((d) => ({
          slideNumber: d.slideNumber,
          layoutFileName: d.layoutFileName,
        })),
        questions.length,
        totalFinalSlideCount,
        ombeaLayoutFileName,
        maxTagNumberUsed
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
      } = updatePresentationRelsWithMappings(
        presentationRelsContent,
        initialExistingSlideCount,
        newIntroSlideDetails,
        questions.length
      );
      outputZip.file(
        "ppt/_rels/presentation.xml.rels",
        updatedPresentationRels
      );
      await rebuildPresentationXml(
        outputZip,
        slideRIdMappings,
        slideSizeAttrs,
        oldToNewRIdMap
      );
    }

    await updateCoreXml(outputZip, questions.length);
    const appMetadata = calculateAppXmlMetadata(
      totalFinalSlideCount,
      questions
    );
    await updateAppXml(outputZip, appMetadata);

    console.log('[LOG][val17PptxGenerator] Generating final PPTX blob.');
    const outputBlob = await outputZip.generateAsync({
      type: "blob",
      mimeType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      compression: "DEFLATE",
      compressionOptions: { level: 3 },
    });

    console.log(`[LOG][val17PptxGenerator] PPTX Blob et mappings de questions générés avec succès.`);
    console.log('--- [LOG][val17PptxGenerator] FIN DE LA GÉNÉRATION PPTX VAL17 ---');
    return { pptxBlob: outputBlob, questionMappings: questionMappingsInternal, preExistingQuestionSlideGuids };
  } catch (error: any) {
    console.error(`=== [ERREUR][val17PptxGenerator] ERREUR GÉNÉRATION VAL17 ===`);
    console.error(error.message);
    console.error(error.stack);
    throw new Error(`Erreur lors de la génération du PPTX interactif des questions OMBEA: ${error.message}`);
  }
}