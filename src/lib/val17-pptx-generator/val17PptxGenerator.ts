import JSZip from "jszip";
import { saveAs } from "file-saver";

// Placeholder types until the actual GenerationOptions and ConfigOptions from your project are fully integrated.
// These should ideally come from a './val17PptxTypes' import if that file is created with your type definitions.

// Basic placeholder for session information
export interface SessionInfo {
  title: string;
  date?: string;
  // other relevant fields
}

// Basic placeholder for participant information
export interface Participant {
  name: string;
  // other relevant fields
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
  question: string;
  options: string[];
  correctAnswerIndex?: number; // 0-based index
  imageUrl?: string;
  points?: number; // Corresponds to timeLimit from StoredQuestion, used for duration
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
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16).toUpperCase();
  });
}

function escapeXml(unsafe: string): string {
  if (typeof unsafe !== "string") {
    // Ensure input is a string
    if (unsafe === null || unsafe === undefined) return "";
    unsafe = String(unsafe);
  }
  let cleaned = unsafe.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
  return cleaned
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/--/g, "—");
}

function countExistingSlides(zip: JSZip): number {
  let count = 0;
  zip.folder("ppt/slides")?.forEach((relativePath) => {
    if (
      relativePath.match(/^slide\d+\.xml$/) &&
      !relativePath.includes("_rels")
    ) {
      count++;
    }
  });
  return count;
}

function validateQuestions(questions: Val17Question[]): void {
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

  return {
    x: imageAreaX + offsetX,
    y: imageAreaY + offsetY,
    width: finalWidth,
    height: finalHeight,
  };
}

function processCloudUrl(url: string): string {
  try {
    if (url.includes("dropbox.com")) {
      return url.replace("?dl=0", "?dl=1");
    }
    return url;
  } catch (error) {
    console.error("Erreur lors du traitement de l'URL:", error);
    return url;
  }
}

function getImageDimensions(
  blob: Blob
): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: 1920, height: 1080 });
    };
    img.src = objectUrl;
  });
}

async function createDefaultTemplate(): Promise<File> {
  throw new Error(
    "Aucun template fourni. Veuillez sélectionner un fichier PowerPoint template."
  );
}

async function downloadImageFromCloudWithDimensions(
  url: string
): Promise<{
  data: ArrayBuffer;
  extension: string;
  width: number;
  height: number;
} | null> {
  try {
    // console.log(`[IMAGE] Début téléchargement: ${url}`); // Verbose
    let finalUrl = url;
    if (url.includes("dropbox.com")) {
      finalUrl = processCloudUrl(url);
      // console.log(`[IMAGE] URL Dropbox transformée: ${finalUrl}`); // Verbose
    }
    // console.log(`[IMAGE] Tentative de fetch: ${finalUrl}`); // Verbose
    const response = await fetch(finalUrl);
    // console.log(`[IMAGE] Réponse reçue: ${response.status} ${response.statusText}`); // Verbose
    // console.log(`[IMAGE] Content-Type: ${response.headers.get('content-type')}`); // Verbose

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}: ${response.statusText} for ${finalUrl}`
      );
    }
    const blob = await response.blob();
    // console.log(`[IMAGE] Blob reçu: ${blob.size} octets, type: ${blob.type}`); // Verbose
    if (!blob.type.startsWith("image/")) {
      console.warn(
        `[IMAGE] Type MIME non-image détecté: ${blob.type} pour ${finalUrl}, on continue quand même`
      );
    }
    const arrayBuffer = await blob.arrayBuffer();
    let extension = "jpg";
    if (blob.type) {
      const mimeToExt: { [key: string]: string } = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/gif": "gif",
        "image/webp": "webp",
        "image/svg+xml": "svg",
      };
      extension = mimeToExt[blob.type] || "jpg";
    }
    const dimensions = await getImageDimensions(blob);
    // console.log(`[IMAGE] ✓ Succès: ${(arrayBuffer.byteLength / 1024).toFixed(2)} KB, ${dimensions.width}x${dimensions.height}, ${extension}`); // Verbose
    return {
      data: arrayBuffer,
      extension,
      width: dimensions.width,
      height: dimensions.height,
    };
  } catch (error) {
    console.error(`[IMAGE] ✗ Échec pour ${url}:`, error);
    return null;
  }
}

function updateContentTypesForImages(
  content: string,
  imageExtensions: Set<string>
): string {
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
  return updated;
}

async function findNextAvailableSlideLayoutId(
  zip: JSZip
): Promise<{ layoutId: number; layoutFileName: string; rId: string }> {
  const masterRelsFile = zip.file(
    "ppt/slideMasters/_rels/slideMaster1.xml.rels"
  );
  if (!masterRelsFile) throw new Error("slideMaster1.xml.rels non trouvé");

  const masterRelsContent = await masterRelsFile.async("string");
  const layoutMatches = masterRelsContent.match(/slideLayout(\d+)\.xml/g) || [];
  let maxLayoutNum = 0;
  layoutMatches.forEach((match) => {
    const numPart = match.match(/slideLayout(\d+)\.xml/);
    const num = numPart ? parseInt(numPart[1], 10) : 0;
    if (num > maxLayoutNum) maxLayoutNum = num;
  });
  const nextLayoutNum = maxLayoutNum + 1;
  const allRIds = extractExistingRIds(masterRelsContent);
  const existingRIds = allRIds.map((m) => m.rId);
  let nextRId = getNextAvailableRId(existingRIds);
  // console.log(`Prochain layout: slideLayout${nextLayoutNum}, rId: ${nextRId}`); // Verbose
  return {
    layoutId: nextLayoutNum,
    layoutFileName: `slideLayout${nextLayoutNum}.xml`,
    rId: nextRId,
  };
}

async function ensureOmbeaSlideLayoutExists(
  zip: JSZip
): Promise<{ layoutFileName: string; layoutRId: string }> {
  // console.log('Création d\'un layout OMBEA dédié...'); // Verbose
  const { layoutId, layoutFileName, rId } =
    await findNextAvailableSlideLayoutId(zip);
  const slideLayoutContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="tx" preserve="1"><p:cSld name="Titre et texte"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="Titre 1"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR" smtClean="0"/><a:t>Modifiez le style du titre</a:t></a:r><a:endParaRPr lang="fr-FR"/></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Espace réservé du texte 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr lvl="0"/><a:r><a:rPr lang="fr-FR" smtClean="0"/><a:t>Modifiez les styles du texte du masque</a:t></a:r></a:p><a:p><a:pPr lvl="1"/><a:r><a:rPr lang="fr-FR" smtClean="0"/><a:t>Deuxième niveau</a:t></a:r></a:p><a:p><a:pPr lvl="2"/><a:r><a:rPr lang="fr-FR" smtClean="0"/><a:t>Troisième niveau</a:t></a:r></a:p><a:p><a:pPr lvl="3"/><a:r><a:rPr lang="fr-FR" smtClean="0"/><a:t>Quatrième niveau</a:t></a:r></a:p><a:p><a:pPr lvl="4"/><a:r><a:rPr lang="fr-FR" smtClean="0"/><a:t>Cinquième niveau</a:t></a:r><a:endParaRPr lang="fr-FR"/></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="4" name="Espace réservé de la date 3"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="dt" sz="half" idx="10"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:fld id="{ABB4FD2C-0372-488A-B992-EB1BD753A34A}" type="datetimeFigureOut"><a:rPr lang="fr-FR" smtClean="0"/><a:t>28/05/2025</a:t></a:fld><a:endParaRPr lang="fr-FR"/></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="5" name="Espace réservé du pied de page 4"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="ftr" sz="quarter" idx="11"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="fr-FR"/></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="6" name="Espace réservé du numéro de diapositive 5"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldNum" sz="quarter" idx="12"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:fld id="{CD42254F-ACD2-467B-9045-5226EEC3B6AB}" type="slidenum"><a:rPr lang="fr-FR" smtClean="0"/><a:t>‹N°›</a:t></a:fld><a:endParaRPr lang="fr-FR"/></a:p></p:txBody></p:sp></p:spTree><p:extLst><p:ext uri="{BB962C8B-B14F-4D97-AF65-F5344CB8AC3E}"><p14:creationId xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" val="${
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
  // console.log(`Layout OMBEA créé : ${layoutFileName} avec ${rId}`); // Verbose
  return { layoutFileName: layoutFileName, layoutRId: rId };
}

async function updateSlideMasterRelsForNewLayout(
  zip: JSZip,
  layoutFileName: string,
  rId: string
): Promise<void> {
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
}

async function updateContentTypesForNewLayout(
  zip: JSZip,
  layoutFileName: string
): Promise<void> {
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

// Fonction pour générer le XML d'une slide d'introduction (Titre)
function createIntroTitleSlideXml(
  sessionInfo: SessionInfo,
  slideNumber: number // Absolute slide number in the final PPTX
  // layoutName: string - Ce sera nécessaire pour trouver le rId vers le layout
): string {
  const slideComment = `<!-- Intro Slide ${slideNumber}: Title -->`;
  const baseId = slideNumber * 1000; // Utiliser un multiplicateur différent pour éviter collisions avec slides de questions

  // XML simplifié - supposant un placeholder de type "title" et un de type "subTitle" ou "body" pour la date
  // Ceci devra être adapté en fonction de la structure réelle des layouts clients
  // et de la manière dont on identifie les placeholders.

  // TODO: Identifier correctement les placeholders (type, idx) dans le layout spécifié.
  // Pour l'instant, on assume des placeholders génériques.
  const titlePlaceholder = `<p:sp>
    <p:nvSpPr>
      <p:cNvPr id="${baseId + 1}" name="Title Placeholder"/>
      <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
      <p:nvPr><p:ph type="title"/></p:nvPr>
    </p:nvSpPr>
    <p:spPr/>
    <p:txBody>
      <a:bodyPr/><a:lstStyle/>
      <a:p><a:r><a:rPr lang="fr-FR"/><a:t>${escapeXml(
        sessionInfo.title
      )}</a:t></a:r></a:p>
    </p:txBody>
  </p:sp>`;

  const datePlaceholder = sessionInfo.date
    ? `<p:sp>
    <p:nvSpPr>
      <p:cNvPr id="${baseId + 2}" name="Subtitle Placeholder"/>
      <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
      <p:nvPr><p:ph type="body" idx="1"/><!-- Ou un autre identifiant --></p:nvPr>
    </p:nvSpPr>
    <p:spPr/>
    <p:txBody>
      <a:bodyPr/><a:lstStyle/>
      <a:p><a:r><a:rPr lang="fr-FR"/><a:t>${escapeXml(
        sessionInfo.date
      )}</a:t></a:r></a:p>
    </p:txBody>
  </p:sp>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  ${slideComment}
  <p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
    <p:cSld>
      <p:spTree>
        <p:nvGrpSpPr>
          <p:cNvPr id="${baseId}" name="Intro Title Group"/>
          <p:cNvGrpSpPr/><p:nvPr/>
        </p:nvGrpSpPr>
        <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
        ${titlePlaceholder}
        ${datePlaceholder}
      </p:spTree>
    </p:cSld>
    <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
  </p:sld>`;
}

// TODO: Créer des fonctions similaires pour :
// - createIntroParticipantsSlideXml(participants: Participant[], slideNumber: number): string
// - createIntroInstructionsSlideXml(instructionsText: string, slideNumber: number): string

function createIntroParticipantsSlideXml(
  participants: Participant[],
  slideNumber: number // Absolute slide number in the final PPTX
  // layoutName: string - Ce sera nécessaire pour trouver le rId vers le layout
): string {
  const slideComment = `<!-- Intro Slide ${slideNumber}: Participants -->`;
  const baseId = slideNumber * 1000;

  // TODO: Identifier correctement le placeholder pour le titre de cette slide (ex: "Participants")
  // et celui pour la liste.
  const titleText = "Participants"; // Peut être configurable plus tard
  const titlePlaceholder = `<p:sp>
    <p:nvSpPr>
      <p:cNvPr id="${baseId + 1}" name="Title Placeholder"/>
      <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
      <p:nvPr><p:ph type="title"/></p:nvPr>
    </p:nvSpPr>
    <p:spPr/>
    <p:txBody>
      <a:bodyPr/><a:lstStyle/>
      <a:p><a:r><a:rPr lang="fr-FR"/><a:t>${escapeXml(
        titleText
      )}</a:t></a:r></a:p>
    </p:txBody>
  </p:sp>`;

  const participantsListXml = participants
    .map(
      (participant) =>
        `<a:p><a:r><a:rPr lang="fr-FR"/><a:t>${escapeXml(
          participant.name
        )}</a:t></a:r></a:p>`
    )
    .join("");

  const bodyPlaceholder = `<p:sp>
    <p:nvSpPr>
      <p:cNvPr id="${baseId + 2}" name="Body Placeholder"/>
      <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
      <p:nvPr><p:ph type="body" idx="1"/><!-- Ou un autre identifiant --></p:nvPr>
    </p:nvSpPr>
    <p:spPr/>
    <p:txBody>
      <a:bodyPr/><a:lstStyle/>${
        /* TODO: Ajouter des styles de liste si nécessaire (puces, etc.) */ ""
      }
      ${participantsListXml}
    </p:txBody>
  </p:sp>`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  ${slideComment}
  <p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
    <p:cSld>
      <p:spTree>
        <p:nvGrpSpPr>
          <p:cNvPr id="${baseId}" name="Intro Participants Group"/>
          <p:cNvGrpSpPr/><p:nvPr/>
        </p:nvGrpSpPr>
        <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
        ${titlePlaceholder}
        ${bodyPlaceholder}
      </p:spTree>
    </p:cSld>
    <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
  </p:sld>`;
}

function createIntroInstructionsSlideXml(
  slideNumber: number, // Absolute slide number in the final PPTX
  instructionsText?: string // Optional custom instructions text
  // layoutName: string - Ce sera nécessaire pour trouver le rId vers le layout
): string {
  const slideComment = `<!-- Intro Slide ${slideNumber}: Instructions -->`;
  const baseId = slideNumber * 1000;

  const defaultInstructions =
    "Instructions de vote :\n1. Connectez-vous...\n2. Votez...\n3. Amusez-vous !";
  const currentInstructionsText = instructionsText || defaultInstructions;

  // TODO: Identifier correctement le placeholder pour le titre et le corps.
  const titleText = "Instructions"; // Peut être configurable plus tard
  const titlePlaceholder = `<p:sp>
    <p:nvSpPr>
      <p:cNvPr id="${baseId + 1}" name="Title Placeholder"/>
      <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
      <p:nvPr><p:ph type="title"/></p:nvPr>
    </p:nvSpPr>
    <p:spPr/>
    <p:txBody>
      <a:bodyPr/><a:lstStyle/>
      <a:p><a:r><a:rPr lang="fr-FR"/><a:t>${escapeXml(
        titleText
      )}</a:t></a:r></a:p>
    </p:txBody>
  </p:sp>`;

  // Pour un texte plus long avec des sauts de ligne, chaque ligne peut nécessiter son propre <a:p>
  const instructionsBodyXml = currentInstructionsText
    .split("\n")
    .map(
      (line) =>
        `<a:p><a:r><a:rPr lang="fr-FR"/><a:t>${escapeXml(
          line
        )}</a:t></a:r></a:p>`
    )
    .join("");

  const bodyPlaceholder = `<p:sp>
    <p:nvSpPr>
      <p:cNvPr id="${baseId + 2}" name="Body Placeholder"/>
      <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
      <p:nvPr><p:ph type="body" idx="1"/><!-- Ou un autre identifiant --></p:nvPr>
    </p:nvSpPr>
    <p:spPr/>
    <p:txBody>
      <a:bodyPr/><a:lstStyle/>
      ${instructionsBodyXml}
    </p:txBody>
  </p:sp>`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  ${slideComment}
  <p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
    <p:cSld>
      <p:spTree>
        <p:nvGrpSpPr>
          <p:cNvPr id="${baseId}" name="Intro Instructions Group"/>
          <p:cNvGrpSpPr/><p:nvPr/>
        </p:nvGrpSpPr>
        <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
        ${titlePlaceholder}
        ${bodyPlaceholder}
      </p:spTree>
    </p:cSld>
    <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
  </p:sld>`;
}

function createSlideXml(
  question: string,
  options: string[],
  slideNumber: number, // Absolute slide number in the final PPTX
  duration: number = 30,
  imageDimensions?: ImageDimensions,
  ombeaConfig?: ConfigOptions
): string {
  const slideComment = `<!-- Slide ${slideNumber} -->`;
  const baseId = slideNumber * 100; // Increased multiplier for more unique IDs
  const grpId = baseId + 1;
  const titleId = baseId + 2;
  const bodyId = baseId + 3;
  const countdownId = baseId + 4;
  const imageId = baseId + 5;
  let countdownDisplayText =
    ombeaConfig?.pollTimeLimit !== undefined
      ? ombeaConfig.pollTimeLimit
      : duration;

  let bulletTypeForXml = "arabicPeriod"; // Default
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
    xmlContent += `<p:sp><p:nvSpPr><p:cNvPr id="${countdownId}" name="OMBEA Countdown ${slideNumber}"/><p:cNvSpPr txBox="1"/><p:nvPr><p:custDataLst><p:tags r:id="rId4"/></p:custDataLst></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="317500" y="5715000"/><a:ext cx="1524000" cy="769441"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr vert="horz" rtlCol="0" anchor="ctr" anchorCtr="1"><a:spAutoFit/></a:bodyPr><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR" sz="4400" smtClean="0"/><a:t>${String(
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
  let maxTagNumber = 0;
  const tagsFolder = zip.folder("ppt/tags");
  if (tagsFolder) {
    tagsFolder.forEach((relativePath) => {
      const match = relativePath.match(/tag(\d+)\.xml$/);
      if (match && match[1]) {
        const tagNum = parseInt(match[1], 10);
        console.log(
          `[TAG_DEBUG] Found existing tag: ${relativePath}, number: ${tagNum}`
        );
        if (tagNum > maxTagNumber) maxTagNumber = tagNum;
      }
    });
  }
  console.log(
    `[TAG_DEBUG] findHighestExistingTagNumber returning: ${maxTagNumber}`
  );
  return maxTagNumber;
}

// Helper to find a slide layout by its name (e.g., "slideLayout1.xml")
// For now, assumes layoutName is the direct file name.
// TODO: Enhance to search by <p:cSld name=""> if user provides friendly names.
async function findSlideLayoutFile(
  zip: JSZip,
  layoutName: string
): Promise<string | null> {
  const layoutPath = `ppt/slideLayouts/${layoutName}`;
  const layoutFile = zip.file(layoutPath);
  if (layoutFile) {
    return layoutPath;
  }
  // Try with .xml extension if not provided
  const layoutPathWithExt = `ppt/slideLayouts/${layoutName}.xml`;
  const layoutFileWithExt = zip.file(layoutPathWithExt);
  if (layoutFileWithExt) {
    return layoutPathWithExt;
  }
  console.warn(`Slide layout "${layoutName}" not found.`);
  return null;
}

function ensureTagContinuity(
  zip: JSZip,
  startingTag: number,
  endingTag: number
): string[] {
  const warnings: string[] = [];
  for (let i = startingTag; i <= endingTag; i++) {
    if (!zip.file(`ppt/tags/tag${i}.xml`)) {
      warnings.push(`Attention: tag${i}.xml manquant dans la séquence`);
    }
  }
  return warnings;
}

async function isOmbeaSlide(zip: JSZip, slideNumber: number): Promise<boolean> {
  const slideRelsPath = `ppt/slides/_rels/slide${slideNumber}.xml.rels`;
  const slideRelsFile = zip.file(slideRelsPath);
  if (!slideRelsFile) return false;
  try {
    const content = await slideRelsFile.async("string");
    return content.includes("relationships/tags");
  } catch {
    return false;
  }
}

/* // countExistingOmbeaSlides is declared but its value is never read.
async function countExistingOmbeaSlides(zip: JSZip): Promise<number> {
  let count = 0;
  const totalSlides = countExistingSlides(zip);
  for (let i = 1; i <= totalSlides; i++) {
    if (await isOmbeaSlide(zip, i)) count++;
  }
  console.log(`Slides OMBEA existantes détectées: ${count}`);
  return count;
}
*/

function createSlideTagFiles(
  questionIndexInBatch: number,
  options: string[],
  correctAnswerIndex: number | undefined,
  duration: number,
  ombeaConfig?: ConfigOptions,
  tagOffset: number = 0
): TagInfo[] {
  const baseTagNumber = calculateBaseTagNumber(questionIndexInBatch, tagOffset);
  const slideGuid = generateGUID();
  let points = options
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

async function rebuildPresentationXml(
  zip: JSZip,
  slideRIdMappings: { slideNumber: number; rId: string }[], // slideNumber is absolute slide number
  existingSlideCountInTemplate: number,
  slideSizeAttrs: SlideSizeAttributes | null
): Promise<void> {
  const presentationFile = zip.file("ppt/presentation.xml");
  if (!presentationFile) {
    console.error("ppt/presentation.xml not found in template ZIP.");
    return;
  }
  let content = await presentationFile.async("string");
  const defaultTextStyleMatch = content.match(
    /<p:defaultTextStyle>[\s\S]*?<\/p:defaultTextStyle>/
  );
  const slideMasterRId = "rId1"; // Standard assumption

  // slideRIdMappings now contains all slides (template, intro, ombea) correctly ordered by slideNumber
  // and with their final rIds for presentation.xml.rels.
  // The existingSlideCountInTemplate parameter here refers to the original template slide count.

  let newSldIdLstContent = `<p:sldIdLst>`;
  // The slideRIdMappings should be sorted by slideNumber to ensure correct ID generation.
  // updatePresentationRelsWithMappings now sorts it.
  slideRIdMappings.forEach((mapping, index) => {
    // The ID for <p:sldId> is typically 256, 257, ... for the first, second slide etc. in the list.
    // So, 255 + (index + 1) seems more robust if mapping.slideNumber isn't contiguous from 1.
    // However, PowerPoint seems to use 255 + slideNumber if slideNumber is 1-based and contiguous.
    // Let's use 255 + (index + 1) for robustness, assuming mappings are sorted by appearance order.
    const sldIdValue = 256 + index; // Generates IDs like 256, 257, ...
    newSldIdLstContent += `\n    <p:sldId id="${sldIdValue}" r:id="${mapping.rId}"/>`;
  });
  newSldIdLstContent += `\n  </p:sldIdLst>`;

  content = content.replace(
    /<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/,
    newSldIdLstContent
  );

  // Ensure sldMasterIdLst points to a valid rId (usually rId1)
  if (
    !content.includes(
      `<p:sldMasterId id="2147483648" r:id="${slideMasterRId}"/>`
    )
  ) {
    content = content.replace(
      /<p:sldMasterIdLst>[\s\S]*?<\/p:sldMasterIdLst>/,
      `<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="${slideMasterRId}"/></p:sldMasterIdLst>`
    );
  }

  // Apply slide size attributes from template
  if (slideSizeAttrs) {
    const sldSzRegex = /<p:sldSz[^>]*\/>/;
    const typeAttr = slideSizeAttrs.type
      ? ` type="${slideSizeAttrs.type}"`
      : "";
    const newSldSzTag = `<p:sldSz cx="${slideSizeAttrs.cx}" cy="${slideSizeAttrs.cy}"${typeAttr}/>`;
    if (sldSzRegex.test(content)) {
      content = content.replace(sldSzRegex, newSldSzTag);
    } else {
      // If <p:sldSz> doesn't exist, try to insert it after <p:notesSz/> or before <p:defaultTextStyle/>
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
          // Fallback: attempt to insert before the sldIdLst (less ideal)
          insertPoint = content.indexOf("<p:sldIdLst>");
          if (insertPoint !== -1) {
            content = `${content.slice(
              0,
              insertPoint
            )}${newSldSzTag}\n  ${content.slice(insertPoint)}`;
          } else {
            console.warn(
              "Could not find a suitable place to insert <p:sldSz> in presentation.xml."
            );
          }
        }
      }
    }
  }

  zip.file("ppt/presentation.xml", content);
}

function updatePresentationRelsWithMappings(
  originalContent: string,
  initialExistingSlideCount: number, // Slides from the original template
  introSlideDetails: {
    slideNumber: number;
    layoutRIdInSlide: string;
    layoutFileName: string;
  }[], // Details of new intro slides
  newOmbeaQuestionCount: number // Count of new OMBEA question slides
): {
  updatedContent: string;
  slideRIdMappings: { slideNumber: number; rId: string }[];
} {
  const existingMappings = extractExistingRIds(originalContent);
  const newRelsOrder: RIdMapping[] = [];
  const allSlideRIdMappings: { slideNumber: number; rId: string }[] = [];
  let rIdCounter = 1; // This is the correct declaration

  const slideType =
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide";
  const slideMasterType =
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster";

  // 1. Preserve Slide Master relation first (usually rId1)
  const slideMasterRel = existingMappings.find(
    (m) => m.type === slideMasterType
  );
  if (slideMasterRel) {
    newRelsOrder.push({ ...slideMasterRel, rId: `rId${rIdCounter++}` });
  } else {
    console.warn(
      "Slide Master relation not found in template's presentation.xml.rels! This is unusual."
    );
    // Potentially add a default one if critical, though a valid template should have it.
    // newRelsOrder.push({ rId: `rId${rIdCounter++}`, type: slideMasterType, target: "slideMasters/slideMaster1.xml" });
  }

  // 2. Preserve relations for existing template slides that are being kept
  const templateSlideRels = existingMappings.filter(
    (m) =>
      m.type === slideType &&
      parseInt(m.target.match(/slide(\d+)\.xml/)![1]) <=
        initialExistingSlideCount
  );
  templateSlideRels.sort(
    (a, b) =>
      parseInt(a.target.match(/slide(\d+)\.xml/)![1]) -
      parseInt(b.target.match(/slide(\d+)\.xml/)![1])
  );

  templateSlideRels.forEach((rel) => {
    const slideNum = parseInt(rel.target.match(/slide(\d+)\.xml/)![1]);
    const newRId = `rId${rIdCounter++}`;
    newRelsOrder.push({ ...rel, rId: newRId }); // Keep original target, update rId
    allSlideRIdMappings.push({ slideNumber: slideNum, rId: newRId });
  });

  // 3. Add relations for new introductory slides
  introSlideDetails.forEach((introDetail) => {
    const newSlideRId = `rId${rIdCounter++}`;
    newRelsOrder.push({
      rId: newSlideRId,
      type: slideType,
      target: `slides/slide${introDetail.slideNumber}.xml`,
    });
    allSlideRIdMappings.push({
      slideNumber: introDetail.slideNumber,
      rId: newSlideRId,
    });
  });

  // 4. Add relations for new OMBEA question slides
  for (let i = 0; i < newOmbeaQuestionCount; i++) {
    const ombeaSlideNumber =
      initialExistingSlideCount + introSlideDetails.length + 1 + i;
    const newSlideRId = `rId${rIdCounter++}`;
    newRelsOrder.push({
      rId: newSlideRId,
      type: slideType,
      target: `slides/slide${ombeaSlideNumber}.xml`,
    });
    allSlideRIdMappings.push({
      slideNumber: ombeaSlideNumber,
      rId: newSlideRId,
    });
  }

  // 5. Preserve all other existing relations from the template (theme, viewProps, presProps, customXml, tags, etc.)
  // by ensuring they are not already processed (like slideMaster or template slides whose rIds might have changed)
  const processedTargets = new Set(newRelsOrder.map((r) => r.target));
  existingMappings.forEach((origRel) => {
    if (
      origRel.type !== slideType &&
      origRel.type !== slideMasterType &&
      !processedTargets.has(origRel.target)
    ) {
      // If it's a type we haven't explicitly handled and its target hasn't been added, preserve it.
      // This should cover presProps, viewProps, theme, tableStyles, and any presentation-level tags.
      newRelsOrder.push({ ...origRel, rId: `rId${rIdCounter++}` });
      processedTargets.add(origRel.target); // Add to processed to avoid duplicates if any logic changes
    } else if (
      origRel.type !== slideType &&
      origRel.type !== slideMasterType &&
      !newRelsOrder.some(
        (nr) => nr.target === origRel.target && nr.type === origRel.type
      )
    ) {
      // Fallback for types like slideMaster if it wasn't found by the specific check but is present
      // Or other specific known types if necessary
      console.warn(
        `Re-adding relation for target: ${origRel.target} of type ${origRel.type} that might have been missed`
      );
      newRelsOrder.push({ ...origRel, rId: `rId${rIdCounter++}` });
    }
  });

  // Ensure a clean build of the XML content
  let updatedContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`;
  newRelsOrder.forEach((rel) => {
    updatedContent += `\n  <Relationship Id="${rel.rId}" Type="${rel.type}" Target="${rel.target}"/>`;
  });
  updatedContent += "\n</Relationships>";

  // console.log('Updated presentation.xml.rels content structure generated.'); // Verbose
  allSlideRIdMappings.sort((a, b) => a.slideNumber - b.slideNumber); // Ensure sorted for rebuildPresentationXml
  return { updatedContent, slideRIdMappings: allSlideRIdMappings };
}

function updateContentTypesComplete(
  originalContent: string,
  introSlideDetails: { slideNumber: number; layoutFileName: string }[], // Details des slides d'intro
  newOmbeaQuestionCount: number, // Nombre de slides de questions OMBEA
  totalSlidesInFinalPptx: number, // Nombre total de slides (template + intro + questions)
  ombeaQuestionLayoutFileName: string, // Nom du fichier layout pour les questions OMBEA
  totalTagsUsed: number
): string {
  let updatedContent = originalContent;
  let newOverrides = "";

  // 1. Overrides pour les slides d'introduction
  introSlideDetails.forEach((detail) => {
    const slidePartName = `/ppt/slides/slide${detail.slideNumber}.xml`;
    if (!updatedContent.includes(`PartName="${slidePartName}"`)) {
      newOverrides += `\n  <Override PartName="${slidePartName}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
    }
    // Assurer que le layout de la slide d'intro est listé (s'il est unique et pas déjà là)
    // Note: ensureOmbeaSlideLayoutExists s'occupe de son propre layout.
    // Ici, on s'assure que les layouts *utilisés par les slides d'intro* sont présents.
    // Souvent, ils seront déjà dans le template, mais ajoutons par sécurité si ce n'est pas le cas.
    const introLayoutPartName = `/ppt/slideLayouts/${detail.layoutFileName}`;
    if (!updatedContent.includes(`PartName="${introLayoutPartName}"`)) {
      // Tentative d'ajout intelligent (similaire à ensureOmbeaSlideLayoutExists)
      const lastLayoutOverride = updatedContent.lastIndexOf(
        'ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"'
      );
      let insertPoint = -1;
      if (lastLayoutOverride > -1) {
        insertPoint = updatedContent.indexOf("/>", lastLayoutOverride) + 2;
      } else {
        insertPoint = updatedContent.lastIndexOf("</Types>");
      }
      if (insertPoint > -1) {
        const newLayoutOverride = `\n  <Override PartName="${introLayoutPartName}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>`;
        // Pour éviter de modifier updatedContent dans la boucle, on stocke cet override potentiel
        // et on l'ajoute à newOverrides ou on modifie updatedContent une fois avant la boucle principale des overrides.
        // Pour simplifier ici, on l'ajoute directement à newOverrides, mais cela peut conduire à un ordre non optimal.
        // Idéalement, les layouts devraient être groupés.
        if (!newOverrides.includes(newLayoutOverride))
          newOverrides += newLayoutOverride;
      }
    }
  });

  // 2. Override pour le layout des questions OMBEA (généralement déjà fait par ensureOmbeaSlideLayoutExists)
  const ombeaLayoutPartName = `/ppt/slideLayouts/${ombeaQuestionLayoutFileName}`;
  if (!updatedContent.includes(`PartName="${ombeaLayoutPartName}"`)) {
    // Duplique la logique de ensureOmbeaSlideLayoutExists pour l'ajout au ContentTypes si manquant
    const lastLayoutIdx = updatedContent.lastIndexOf("slideLayout");
    let insertPt = -1;
    if (lastLayoutIdx > -1)
      insertPt = updatedContent.indexOf("/>", lastLayoutIdx) + 2;
    else insertPt = updatedContent.lastIndexOf("</Types>");
    if (insertPt > -1) {
      const newLayoutOverride = `\n  <Override PartName="${ombeaLayoutPartName}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>`;
      // Insérer directement pour s'assurer qu'il est là avant les slides qui l'utilisent
      updatedContent =
        updatedContent.slice(0, insertPt) +
        newLayoutOverride +
        updatedContent.slice(insertPt);
    }
  }

  // 3. Overrides pour les slides de questions OMBEA
  // totalSlidesInFinalPptx = initialTemplateSlides + introSlidesAddedCount + newOmbeaQuestionCount
  const slidesBeforeOmbeaQuestions =
    totalSlidesInFinalPptx - newOmbeaQuestionCount;
  for (let i = 0; i < newOmbeaQuestionCount; i++) {
    const slideNum = slidesBeforeOmbeaQuestions + 1 + i;
    const slidePartName = `/ppt/slides/slide${slideNum}.xml`;
    if (!updatedContent.includes(`PartName="${slidePartName}"`)) {
      newOverrides += `\n  <Override PartName="${slidePartName}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
    }
  }

  // 4. Overrides pour les tags
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
  let totalWords = 0;
  let totalParagraphs = 0;
  const newSlideTitles: string[] = [];
  newOmbeaQuestions.forEach((q) => {
    const questionWords = q.question.trim().split(/\s+/).filter(Boolean).length;
    const optionsWords = q.options
      .map((opt) => opt.trim().split(/\s+/).filter(Boolean).length)
      .reduce((a, b) => a + b, 0);
    totalWords += questionWords + optionsWords + 1; // +1 for timer placeholder
    totalParagraphs += 1 + q.options.length + 1; // Title, each option, timer placeholder
    newSlideTitles.push(q.question);
  });
  // totalSlides is the grand total including template slides
  return {
    totalSlides: totalFinalSlides,
    totalWords,
    totalParagraphs,
    slideTitles: newSlideTitles,
  };
}

async function updateAppXml(
  zip: JSZip,
  metadata: AppXmlMetadata
): Promise<void> {
  const appFile = zip.file("docProps/app.xml");
  if (!appFile) {
    console.warn("app.xml non trouvé, création d'un nouveau fichier");
    createNewAppXml(zip, metadata);
    return;
  }
  let content = await appFile.async("string");
  content = updateSimpleFields(content, metadata);
  // updateHeadingPairsAndTitles needs to be robust for merging.
  // For now, it might be safer to update counts and not aggressively merge titles if it causes issues.
  content = updateHeadingPairsAndTitles(content, metadata.slideTitles); // Pass only new titles
  zip.file("docProps/app.xml", content);
}

function updateSimpleFields(content: string, metadata: AppXmlMetadata): string {
  let updated = content;
  updated = updated.replace(
    /<Slides>\d+<\/Slides>/,
    `<Slides>${metadata.totalSlides}</Slides>`
  );

  const wordsMatch = updated.match(/<Words>(\d+)<\/Words>/);
  const existingWords =
    wordsMatch && wordsMatch[1] ? parseInt(wordsMatch[1], 10) : 0;
  updated = updated.replace(
    /<Words>\d*<\/Words>/,
    `<Words>${existingWords + metadata.totalWords}</Words>`
  );

  const paragraphsMatch = updated.match(/<Paragraphs>(\d+)<\/Paragraphs>/);
  const existingParagraphs =
    paragraphsMatch && paragraphsMatch[1]
      ? parseInt(paragraphsMatch[1], 10)
      : 0;
  updated = updated.replace(
    /<Paragraphs>\d*<\/Paragraphs>/,
    `<Paragraphs>${existingParagraphs + metadata.totalParagraphs}</Paragraphs>`
  );

  if (!updated.includes("<TotalTime>")) {
    const propertiesEnd = updated.indexOf("</Properties>");
    if (propertiesEnd > -1) {
      const totalTimeTag = "\n  <TotalTime>2</TotalTime>";
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

// updateHeadingPairsAndTitles simplified to avoid complex merge, focuses on counts
function updateHeadingPairsAndTitles(
  content: string,
  newOmbeaSlideTitles: string[]
): string {
  let updated = content;
  const titlesToAddCount = newOmbeaSlideTitles.length;

  // Update "Titres des diapositives" count in HeadingPairs
  const headingPairsRegex =
    /<vt:lpstr>Titres des diapositives<\/vt:lpstr>\s*<\/vt:variant>\s*<vt:variant>\s*<vt:i4>(\d+)<\/vt:i4>/;
  updated = updated.replace(headingPairsRegex, (match, p1) => {
    const existingCount = parseInt(p1, 10);
    return `<vt:lpstr>Titres des diapositives</vt:lpstr></vt:variant><vt:variant><vt:i4>${
      existingCount + titlesToAddCount
    }</vt:i4>`;
  });

  // Append new slide titles to TitlesOfParts
  const titlesOfPartsEndIndex = updated.indexOf(
    "</vt:vector>",
    updated.indexOf("<TitlesOfParts>")
  );
  if (titlesOfPartsEndIndex !== -1) {
    let titlesXmlToAdd = "";
    newOmbeaSlideTitles.forEach((title) => {
      titlesXmlToAdd += `\n      <vt:lpstr>${escapeXml(
        title.substring(0, 250)
      )}</vt:lpstr>`; // Max length for lpstr
    });
    updated =
      updated.slice(0, titlesOfPartsEndIndex) +
      titlesXmlToAdd +
      updated.slice(titlesOfPartsEndIndex);

    // Update TitlesOfParts vector size
    updated = updated.replace(
      /<TitlesOfParts>\s*<vt:vector size="(\d+)"/,
      (match, p1) => {
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
      `\n      <vt:variant><vt:lpstr>Polices utilisées</vt:lpstr></vt:variant>\n      <vt:variant><vt:i4>${fontCount}</vt:i4></vt:variant>`
    );
  }
  const hasTheme = nonSlideTitles.some(
    (t) => t.includes("Thème") || t.includes("Theme") || t === "Thème Office"
  );
  if (hasTheme) {
    pairs.push(
      `\n      <vt:variant><vt:lpstr>Thème</vt:lpstr></vt:variant>\n      <vt:variant><vt:i4>1</vt:i4></vt:variant>`
    );
  }
  if (allSlideTitles.length > 0) {
    pairs.push(
      `\n      <vt:variant><vt:lpstr>Titres des diapositives</vt:lpstr></vt:variant>\n      <vt:variant><vt:i4>${allSlideTitles.length}</vt:i4></vt:variant>`
    );
  }
  const vectorSize = pairs.reduce(
    (acc, curr) => acc + curr.split("<vt:variant>").length - 1,
    0
  );
  return `<HeadingPairs><vt:vector size="${vectorSize}" baseType="variant">${pairs.join(
    ""
  )}\n    </vt:vector></HeadingPairs>`;
}

function buildTitlesOfParts(
  fonts: string[],
  themes: string[],
  existingSlideTitles: string[],
  newSlideTitles: string[]
): string {
  const allTitles: string[] = [];
  fonts.forEach((font) => allTitles.push(escapeXml(font))); // Escape all titles
  themes.forEach((theme) => allTitles.push(escapeXml(theme)));
  existingSlideTitles.forEach((title) => allTitles.push(escapeXml(title)));
  newSlideTitles.forEach((title) => {
    const truncatedTitle =
      title.length > 250 ? title.substring(0, 247) + "..." : title; // Ensure not too long
    allTitles.push(escapeXml(truncatedTitle));
  });
  const vectorContent = allTitles
    .map((title) => `\n      <vt:lpstr>${title}</vt:lpstr>`)
    .join("");
  return `<TitlesOfParts><vt:vector size="${allTitles.length}" baseType="lpstr">${vectorContent}\n    </vt:vector></TitlesOfParts>`;
}

function createNewAppXml(zip: JSZip, metadata: AppXmlMetadata): void {
  const defaultFonts = ["Arial", "Calibri"];
  const defaultThemes = ["Thème Office"];
  const headingPairs = buildHeadingPairs(
    [...defaultFonts, ...defaultThemes],
    metadata.slideTitles
  ); // slideTitles are for new slides
  const titlesOfParts = buildTitlesOfParts(
    defaultFonts,
    defaultThemes,
    [],
    metadata.slideTitles
  );

  const appXmlContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <TotalTime>2</TotalTime><Words>${metadata.totalWords}</Words><Application>Microsoft Office PowerPoint</Application>
  <PresentationFormat>Affichage à l'écran (4:3)</PresentationFormat><Paragraphs>${metadata.totalParagraphs}</Paragraphs>
  <Slides>${metadata.totalSlides}</Slides><Notes>0</Notes><HiddenSlides>0</HiddenSlides><MMClips>0</MMClips>
  <ScaleCrop>false</ScaleCrop>${headingPairs}${titlesOfParts}<Company/><LinksUpToDate>false</LinksUpToDate>
  <SharedDoc>false</SharedDoc><HyperlinksChanged>false</HyperlinksChanged><AppVersion>14.0000</AppVersion></Properties>`;
  zip.file("docProps/app.xml", appXmlContent);
}

async function updateCoreXml(
  zip: JSZip,
  newQuestionCount: number
): Promise<void> {
  const coreFile = zip.file("docProps/core.xml");
  if (coreFile) {
    let content = await coreFile.async("string");
    const title = `Quiz OMBEA ${newQuestionCount} question${
      newQuestionCount > 1 ? "s" : ""
    }`;
    content = content.replace(
      /<dc:title>.*?<\/dc:title>/,
      `<dc:title>${escapeXml(title)}</dc:title>`
    );
    const now = new Date().toISOString();
    content = content.replace(
      /<dcterms:modified.*?>.*?<\/dcterms:modified>/,
      `<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>`
    );
    if (!content.includes("<dcterms:created")) {
      const lastModifiedEnd =
        content.indexOf("</dcterms:modified>") + "</dcterms:modified>".length;
      const createdTag = `\n  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>`;
      if (lastModifiedEnd > -1 && lastModifiedEnd <= content.length) {
        content =
          content.slice(0, lastModifiedEnd) +
          createdTag +
          content.slice(lastModifiedEnd);
      } else {
        // Fallback if </dcterms:modified> not found, append before </cp:coreProperties>
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
  }
}

export async function generatePPTXVal17(
  templateFile: File | null,
  questions: Val17Question[],
  options: GenerationOptions = {},
  sessionInfo?: SessionInfo, // Added for intro slides
  participants?: Participant[] // Added for intro slides
): Promise<GeneratedPptxData | null> {
  // MODIFIED RETURN TYPE
  try {
    const executionId = Date.now();
    // console.log(`\n=== DÉBUT GÉNÉRATION VAL17 ${executionId} ===`); // Verbose
    validateQuestions(questions);
    let currentTemplateFile: File;
    if (templateFile) {
      currentTemplateFile = templateFile;
    } else {
      console.warn("Aucun fichier modèle fourni.");
      throw new Error("Template file is required by generatePPTXVal17.");
    }
    // console.log(`Chargement du modèle: ${currentTemplateFile.name}`); // Verbose
    const templateZip = await JSZip.loadAsync(currentTemplateFile);

    let slideSizeAttrs: SlideSizeAttributes | null = null;
    const presentationXmlFile = templateZip.file("ppt/presentation.xml");
    if (presentationXmlFile) {
      const presentationXmlContent = await presentationXmlFile.async("string");
      const sldSzMatch = presentationXmlContent.match(
        /<p:sldSz\s+cx="(\d+)"\s+cy="(\d+)"(?:\s+type="(\w+)")?/
      );
      if (sldSzMatch) {
        slideSizeAttrs = { cx: sldSzMatch[1], cy: sldSzMatch[2] };
        if (sldSzMatch[3]) {
          slideSizeAttrs.type = sldSzMatch[3];
        }
        console.log("Dimensions du modèle lues :", slideSizeAttrs);
      } else {
        console.warn(
          "<p:sldSz> non trouvé dans le presentation.xml du modèle."
        );
      }
    } else {
      console.warn("ppt/presentation.xml non trouvé dans le ZIP du modèle.");
    }

    // let initialFileCount = 0; // Verbose
    // templateZip.forEach(() => initialFileCount++); // Verbose
    // console.log(`Fichiers dans le template chargé: ${initialFileCount}`); // Verbose

    const existingSlideCount = countExistingSlides(templateZip);
    // console.log(`Slides existantes dans le modèle: ${existingSlideCount}`); // Verbose
    // console.log(`Nouvelles slides OMBEA à créer: ${questions.length}`); // Verbose

    const existingTagsCount = findHighestExistingTagNumber(templateZip);
    console.log(
      `[TAG_DEBUG] existingTagsCount in generatePPTXVal17: ${existingTagsCount}`
    );
    let maxTagNumberUsed = existingTagsCount;

    const outputZip = new JSZip();
    const copyPromises: Promise<void>[] = [];
    templateZip.forEach((relativePath, file) => {
      if (!file.dir) {
        const copyPromise: Promise<void> = file
          .async("blob")
          .then((content) => {
            // Corrected type
            outputZip.file(relativePath, content);
          });
        copyPromises.push(copyPromise);
      } else {
        outputZip.folder(relativePath);
      }
    });
    await Promise.all(copyPromises);
    // console.log('Modèle copié dans outputZip.'); // Verbose

    const initialExistingSlideCount = countExistingSlides(templateZip); // Renamed for clarity
    console.log(
      `Slides existantes initiales dans le modèle: ${initialExistingSlideCount}`
    );

    let introSlidesAddedCount = 0;
    const newIntroSlideDetails: {
      slideNumber: number;
      layoutRIdInSlide: string;
      layoutFileName: string;
    }[] = [];
    // const slideMasterTargetForLayout = "../slideMasters/slideMaster1.xml"; // Standard (not directly needed for slide rels)

    // --- BEGIN INSERTION OF INTRODUCTORY SLIDES ---
    if (sessionInfo && options.introSlideLayouts?.titleLayoutName) {
      const requestedLayoutName = options.introSlideLayouts.titleLayoutName;
      const layoutFileName = requestedLayoutName.endsWith(".xml")
        ? requestedLayoutName
        : `${requestedLayoutName}.xml`;
      const layoutFilePath = await findSlideLayoutFile(
        outputZip,
        layoutFileName
      ); // outputZip should have the template layouts

      if (layoutFilePath) {
        const currentIntroSlideNumber =
          initialExistingSlideCount + introSlidesAddedCount + 1;
        const titleSlideXml = createIntroTitleSlideXml(
          sessionInfo,
          currentIntroSlideNumber
        );
        outputZip.file(
          `ppt/slides/slide${currentIntroSlideNumber}.xml`,
          titleSlideXml
        );

        const layoutRIdInSlide = "rId1"; // Standard rId for layout in slide's rels
        const slideRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="${layoutRIdInSlide}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/${layoutFileName}"/>
</Relationships>`;
        outputZip.file(
          `ppt/slides/_rels/slide${currentIntroSlideNumber}.xml.rels`,
          slideRelsXml
        );

        newIntroSlideDetails.push({
          slideNumber: currentIntroSlideNumber,
          layoutRIdInSlide,
          layoutFileName,
        });
        introSlidesAddedCount++;
        console.log(
          `Slide d'introduction (Titre) ajoutée : slide${currentIntroSlideNumber}.xml utilisant ${layoutFileName}`
        );
      } else {
        console.warn(
          `Layout pour la slide de titre "${requestedLayoutName}" non trouvé. Slide non ajoutée.`
        );
      }
    }

    if (
      participants &&
      participants.length > 0 &&
      options.introSlideLayouts?.participantsLayoutName
    ) {
      const requestedLayoutName =
        options.introSlideLayouts.participantsLayoutName;
      const layoutFileName = requestedLayoutName.endsWith(".xml")
        ? requestedLayoutName
        : `${requestedLayoutName}.xml`;
      const layoutFilePath = await findSlideLayoutFile(
        outputZip,
        layoutFileName
      );

      if (layoutFilePath) {
        const currentIntroSlideNumber =
          initialExistingSlideCount + introSlidesAddedCount + 1;
        const participantsSlideXml = createIntroParticipantsSlideXml(
          participants,
          currentIntroSlideNumber
        );
        outputZip.file(
          `ppt/slides/slide${currentIntroSlideNumber}.xml`,
          participantsSlideXml
        );

        const layoutRIdInSlide = "rId1";
        const slideRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="${layoutRIdInSlide}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/${layoutFileName}"/>
</Relationships>`;
        outputZip.file(
          `ppt/slides/_rels/slide${currentIntroSlideNumber}.xml.rels`,
          slideRelsXml
        );

        newIntroSlideDetails.push({
          slideNumber: currentIntroSlideNumber,
          layoutRIdInSlide,
          layoutFileName,
        });
        introSlidesAddedCount++;
        console.log(
          `Slide d'introduction (Participants) ajoutée : slide${currentIntroSlideNumber}.xml utilisant ${layoutFileName}`
        );
      } else {
        console.warn(
          `Layout pour la slide des participants "${requestedLayoutName}" non trouvé. Slide non ajoutée.`
        );
      }
    }

    // Instruction slide (example with default text)
    if (options.introSlideLayouts?.instructionsLayoutName) {
      const requestedLayoutName =
        options.introSlideLayouts.instructionsLayoutName;
      const layoutFileName = requestedLayoutName.endsWith(".xml")
        ? requestedLayoutName
        : `${requestedLayoutName}.xml`;
      const layoutFilePath = await findSlideLayoutFile(
        outputZip,
        layoutFileName
      );

      if (layoutFilePath) {
        const currentIntroSlideNumber =
          initialExistingSlideCount + introSlidesAddedCount + 1;
        // TODO: Pass actual instructions text, possibly from options (e.g. options.instructionsText)
        const instructionsText = sessionInfo?.title
          ? `Instructions pour la session ${sessionInfo.title}`
          : "Instructions de vote";
        const instructionsSlideXml = createIntroInstructionsSlideXml(
          currentIntroSlideNumber,
          instructionsText
        );
        outputZip.file(
          `ppt/slides/slide${currentIntroSlideNumber}.xml`,
          instructionsSlideXml
        );

        const layoutRIdInSlide = "rId1";
        const slideRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="${layoutRIdInSlide}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/${layoutFileName}"/>
</Relationships>`;
        outputZip.file(
          `ppt/slides/_rels/slide${currentIntroSlideNumber}.xml.rels`,
          slideRelsXml
        );

        newIntroSlideDetails.push({
          slideNumber: currentIntroSlideNumber,
          layoutRIdInSlide,
          layoutFileName,
        });
        introSlidesAddedCount++;
        console.log(
          `Slide d'introduction (Instructions) ajoutée : slide${currentIntroSlideNumber}.xml utilisant ${layoutFileName}`
        );
      } else {
        console.warn(
          `Layout pour la slide d'instructions "${requestedLayoutName}" non trouvé. Slide non ajoutée.`
        );
      }
    }
    // --- END INSERTION OF INTRODUCTORY SLIDES ---

    const effectiveExistingSlideCount =
      initialExistingSlideCount + introSlidesAddedCount;
    console.log(
      `Nombre total de slides (template + intro) avant questions OMBEA: ${effectiveExistingSlideCount}`
    );

    const ombeaLayout = await ensureOmbeaSlideLayoutExists(outputZip);
    const ombeaLayoutFileName = ombeaLayout.layoutFileName;

    outputZip.folder("ppt/tags");
    if (!outputZip.file("ppt/media")) {
      outputZip.folder("ppt/media");
    }

    // console.log('Préparation des slides de questions OMBEA...'); // Verbose
    const imageExtensions = new Set<string>();
    interface DownloadedImage {
      fileName: string;
      data: ArrayBuffer;
      width: number;
      height: number;
      dimensions: ImageDimensions;
      extension: string;
    }
    const downloadedImages = new Map<number, DownloadedImage>();
    const finalQuestionDataList: FinalQuestionData[] = []; // Initialize list to store question data

    if (questions.some((q) => q.imageUrl)) {
      // console.log('Téléchargement des images pour les questions...'); // Verbose
      const imagePromises = questions.map(async (question, index) => {
        if (question.imageUrl) {
          try {
            const imageData = await downloadImageFromCloudWithDimensions(
              question.imageUrl
            );
            if (imageData) {
              const absoluteSlideNumberForImage =
                effectiveExistingSlideCount + index + 1; // UTILISE effectiveExistingSlideCount
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
          } catch (error) {
            console.error(
              `Erreur téléchargement image pour question ${index + 1} (${
                question.imageUrl
              }):`,
              error
            );
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
      // console.log(`${downloadedImages.size} images traitées.`); // Verbose
    }

    for (let i = 0; i < questions.length; i++) {
      const absoluteSlideNumber = effectiveExistingSlideCount + i + 1; // UTILISE effectiveExistingSlideCount
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
      if (i === 0) {
        // Log only for the first new question being processed
        console.log(
          `[TAG_DEBUG] First new question (index ${
            i + 1
          }), baseTagNumberForSlide: ${baseTagNumberForSlide} (calculated with offset: ${existingTagsCount})`
        );
      }

      let slideRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`;
      slideRelsXml += `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags" Target="../tags/tag${baseTagNumberForSlide}.xml"/>`;
      slideRelsXml += `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags" Target="../tags/tag${
        baseTagNumberForSlide + 1
      }.xml"/>`;
      slideRelsXml += `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags" Target="../tags/tag${
        baseTagNumberForSlide + 2
      }.xml"/>`;
      slideRelsXml += `<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags" Target="../tags/tag${
        baseTagNumberForSlide + 3
      }.xml"/>`;
      slideRelsXml += `<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/${ombeaLayoutFileName}"/>`; // UTILISE ombeaLayoutFileName
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

      // Populate finalQuestionDataList
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
      finalQuestionDataList.push({
        originalQuestionIndex: i,
        slideGuid: slideGuid,
        questionIdInSession: i + 1, // 1-based sequential ID for this session
        title: questionData.question,
        options: questionData.options,
        correctAnswerIndex: questionData.correctAnswerIndex,
        duration: duration,
        absoluteSlideNumber: absoluteSlideNumber,
      });
    }
    if (existingTagsCount > 0 && questions.length > 0) {
      const warnings = ensureTagContinuity(outputZip, 1, maxTagNumberUsed);
      if (warnings.length > 0)
        console.warn("⚠️ Problèmes de continuité des tags détectés:", warnings);
    }

    const totalFinalSlideCount = effectiveExistingSlideCount + questions.length; // Correction: Utiliser effectiveExistingSlideCount

    const contentTypesFile = outputZip.file("[Content_Types].xml");
    if (contentTypesFile) {
      let contentTypesContent = await contentTypesFile.async("string");
      if (imageExtensions.size > 0)
        contentTypesContent = updateContentTypesForImages(
          contentTypesContent,
          imageExtensions
        );
      // newIntroSlideDetails contient: { slideNumber: number, layoutRIdInSlide: string, layoutFileName: string }
      // questions.length est newOmbeaQuestionCount
      // ombeaLayoutFileName est le layout des questions ombea
      contentTypesContent = updateContentTypesComplete(
        contentTypesContent,
        newIntroSlideDetails.map((d) => ({
          slideNumber: d.slideNumber,
          layoutFileName: d.layoutFileName,
        })), // Pass only needed info
        questions.length, // newOmbeaQuestionCount
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
      // Pass initialExistingSlideCount for template slides, newIntroSlideDetails for intro, and questions.length for ombea questions
      const { updatedContent: updatedPresentationRels, slideRIdMappings } =
        updatePresentationRelsWithMappings(
          presentationRelsContent,
          initialExistingSlideCount,
          newIntroSlideDetails, // Pass full details for rId generation
          questions.length
        );
      outputZip.file(
        "ppt/_rels/presentation.xml.rels",
        updatedPresentationRels
      );
      // Pass initialExistingSlideCount for template slides, and the combined slideRIdMappings (which will include intro + ombea slides)
      await rebuildPresentationXml(
        outputZip,
        slideRIdMappings,
        initialExistingSlideCount,
        slideSizeAttrs
      );
    }

    await updateCoreXml(outputZip, questions.length);
    const appMetadata = calculateAppXmlMetadata(
      totalFinalSlideCount,
      questions
    );
    await updateAppXml(outputZip, appMetadata);

    // console.log('Génération du fichier PPTX final...'); // Verbose
    const outputBlob = await outputZip.generateAsync({
      type: "blob",
      mimeType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      compression: "DEFLATE",
      compressionOptions: { level: 3 },
    });

    // const finalFileName = options.fileName || `Questions_OMBEA_${new Date().toISOString().slice(0, 10)}.pptx`;
    // saveAs(outputBlob, finalFileName); // REMOVED - Orchestrator will handle saving the .ors file
    // console.log(`Fichier OMBEA PPTX Blob généré avec succès pour inclusion dans .ors.`);

    console.log(`PPTX Blob et données des questions générés.`);
    // console.log(`Total des slides: ${totalFinalSlideCount}`); // Verbose
    // console.log(`=== FIN GÉNÉRATION VAL17 ${executionId} - SUCCÈS ===`); // Verbose
    return { pptxBlob: outputBlob, questionsData: finalQuestionDataList }; // RETURN BLOB AND DATA
  } catch (error: any) {
    console.error(`=== ERREUR GÉNÉRATION VAL17 ===`);
    console.error(error.message);
    alert(
      `Erreur lors de la génération du PPTX interactif des questions OMBEA: ${error.message}`
    );
    // throw error; // Ne plus propager l'erreur ici si on veut que l'orchestrateur gère le null
    return null; // Return null on error
  }
}

export async function testConsistency(
  templateFile: File,
  questions: Val17Question[]
): Promise<void> {
  console.log("=== TEST DE COHÉRENCE (val17PptxGenerator) ===");
  const results = [];
  for (let i = 0; i < 1; i++) {
    console.log(`\nTest de cohérence ${i + 1}...`);
    try {
      const templateCopy = new File(
        [await templateFile.arrayBuffer()],
        templateFile.name,
        { type: templateFile.type }
      );
      const result = await generatePPTXVal17(
        templateCopy,
        questions,
        { fileName: `Test_Coherence_${i + 1}.pptx` },
        undefined,
        undefined
      );
      if (result && result.pptxBlob) {
        results.push("SUCCÈS - Blob PPTX généré");
        // Pourrait sauvegarder ici si nécessaire pour le test : saveAs(result.pptxBlob, `Test_Coherence_${i + 1}.pptx`);
      } else {
        results.push("ÉCHEC - Le générateur n'a pas retourné de blob PPTX");
      }
    } catch (error: any) {
      results.push(`ÉCHEC: ${error.message}`);
    }
  }
  console.log("\n=== RÉSULTATS TEST DE COHÉRENCE ===");
  results.forEach((result, i) => console.log(`Test ${i + 1}: ${result}`));
}

export const handleGeneratePPTXFromVal17Tool = async (
  templateFile: File,
  questions: Val17Question[]
) => {
  try {
    // Appel simple pour l'outil de test, sans sessionInfo ni participants pour l'instant
    const result = await generatePPTXVal17(
      templateFile,
      questions,
      { fileName: "Quiz_OMBEA_Interactif_Val17.pptx" },
      undefined,
      undefined
    );
    if (result && result.pptxBlob) {
      console.log(
        "handleGeneratePPTXFromVal17Tool: PPTX Blob généré, sauvegarde..."
      );
      saveAs(result.pptxBlob, "Quiz_OMBEA_Interactif_Val17_Tool.pptx"); // Sauvegarde pour cet outil de test spécifique
    } else {
      console.error(
        "handleGeneratePPTXFromVal17Tool: Échec de la génération du Blob PPTX."
      );
      alert(
        "handleGeneratePPTXFromVal17Tool: N'a pas pu générer le fichier PPTX."
      );
    }
  } catch (error: any) {
    console.error("Erreur dans handleGeneratePPTXFromVal17Tool:", error);
    alert(
      `Erreur lors de la génération (handleGeneratePPTXFromVal17Tool): ${error.message}`
    );
  }
};

export type { TagInfo, RIdMapping, AppXmlMetadata };

// Data structure for information about each generated question slide, to be returned
export interface FinalQuestionData {
  originalQuestionIndex: number; // Index de la question dans le tableau d'entrée 'questions'
  slideGuid: string | null; // GUID de la slide OMBEA
  questionIdInSession: number; // Numéro séquentiel de la question OMBEA (1-based)
  title: string; // Texte de la question (pour référence)
  options: string[]; // Options de la question (pour référence)
  correctAnswerIndex?: number; // Index de la bonne réponse (pour référence)
  duration: number; // Durée de la question (pour référence)
  absoluteSlideNumber: number; // Numéro de la slide dans le PPTX final
}

export interface GeneratedPptxData {
  pptxBlob: Blob;
  questionsData: FinalQuestionData[];
}
