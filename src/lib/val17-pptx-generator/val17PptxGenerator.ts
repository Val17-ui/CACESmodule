import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// Placeholder types until the actual GenerationOptions and ConfigOptions from your project are fully integrated.
// These should ideally come from a './val17PptxTypes' import if that file is created with your type definitions.
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

interface ImageDimensions {
  x: number;
  y: number;
  width: number;
  height: number;
}

function generateGUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16).toUpperCase();
  });
}

function escapeXml(unsafe: string): string {
  if (typeof unsafe !== 'string') { // Ensure input is a string
    if (unsafe === null || unsafe === undefined) return '';
    unsafe = String(unsafe);
  }
  let cleaned = unsafe.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  return cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/--/g, '—');
}

function countExistingSlides(zip: JSZip): number {
  let count = 0;
  zip.folder('ppt/slides')?.forEach((relativePath) => {
    if (relativePath.match(/^slide\d+\.xml$/) && !relativePath.includes('_rels')) {
      count++;
    }
  });
  return count;
}

function validateQuestions(questions: Val17Question[]): void {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('Au moins une question est requise');
  }
  questions.forEach((question, index) => {
    if (!question.question || typeof question.question !== 'string' || question.question.trim() === '') {
      throw new Error(`Question ${index + 1}: Le texte de la question est requis`);
    }
    if (!Array.isArray(question.options) || question.options.length === 0) {
      throw new Error(`Question ${index + 1}: doit avoir au moins une option`);
    }
    if (question.options.length > 10) {
      throw new Error(`Question ${index + 1}: ne peut pas avoir plus de 10 options`);
    }
    if (question.correctAnswerIndex !== undefined &&
        (typeof question.correctAnswerIndex !== 'number' ||
         question.correctAnswerIndex < 0 ||
         question.correctAnswerIndex >= question.options.length)) {
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
    height: finalHeight
  };
}

function processCloudUrl(url: string): string {
  try {
    if (url.includes('dropbox.com')) {
      return url.replace('?dl=0', '?dl=1');
    }
    return url;
  } catch (error) {
    console.error('Erreur lors du traitement de l\'URL:', error);
    return url;
  }
}

function getImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
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
  throw new Error('Aucun template fourni. Veuillez sélectionner un fichier PowerPoint template.');
}

async function downloadImageFromCloudWithDimensions(
  url: string
): Promise<{ data: ArrayBuffer; extension: string; width: number; height: number } | null> {
  try {
    // console.log(`[IMAGE] Début téléchargement: ${url}`); // Verbose
    let finalUrl = url;
    if (url.includes('dropbox.com')) {
      finalUrl = processCloudUrl(url);
      // console.log(`[IMAGE] URL Dropbox transformée: ${finalUrl}`); // Verbose
    }
    // console.log(`[IMAGE] Tentative de fetch: ${finalUrl}`); // Verbose
    const response = await fetch(finalUrl);
    // console.log(`[IMAGE] Réponse reçue: ${response.status} ${response.statusText}`); // Verbose
    // console.log(`[IMAGE] Content-Type: ${response.headers.get('content-type')}`); // Verbose

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText} for ${finalUrl}`);
    }
    const blob = await response.blob();
    // console.log(`[IMAGE] Blob reçu: ${blob.size} octets, type: ${blob.type}`); // Verbose
    if (!blob.type.startsWith('image/')) {
      console.warn(`[IMAGE] Type MIME non-image détecté: ${blob.type} pour ${finalUrl}, on continue quand même`);
    }
    const arrayBuffer = await blob.arrayBuffer();
    let extension = 'jpg';
    if (blob.type) {
      const mimeToExt: { [key: string]: string } = {
        'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
        'image/webp': 'webp', 'image/svg+xml': 'svg'
      };
      extension = mimeToExt[blob.type] || 'jpg';
    }
    const dimensions = await getImageDimensions(blob);
    // console.log(`[IMAGE] ✓ Succès: ${(arrayBuffer.byteLength / 1024).toFixed(2)} KB, ${dimensions.width}x${dimensions.height}, ${extension}`); // Verbose
    return { data: arrayBuffer, extension, width: dimensions.width, height: dimensions.height };
  } catch (error) {
    console.error(`[IMAGE] ✗ Échec pour ${url}:`, error);
    return null;
  }
}

function updateContentTypesForImages(content: string, imageExtensions: Set<string>): string {
  let updated = content;
  imageExtensions.forEach(ext => {
    if (!updated.includes(`Extension="${ext}"`)) {
      let contentType = 'image/jpeg'; // Default
      if (ext === 'png') contentType = 'image/png';
      else if (ext === 'gif') contentType = 'image/gif';
      else if (ext === 'bmp') contentType = 'image/bmp';
      else if (ext === 'svg') contentType = 'image/svg+xml';
      else if (ext === 'webp') contentType = 'image/webp';

      const insertPoint = updated.indexOf('<Override');
      if (insertPoint > -1) {
        const newDefault = `\n<Default Extension="${ext}" ContentType="${contentType}"/>`;
        updated = updated.slice(0, insertPoint) + newDefault + updated.slice(insertPoint);
      } else {
        const typesEnd = updated.lastIndexOf("</Types>");
        if (typesEnd > -1) {
            const newDefault = `\n<Default Extension="${ext}" ContentType="${contentType}"/>`;
            updated = updated.slice(0, typesEnd) + newDefault + updated.slice(typesEnd);
        }
      }
    }
  });
  return updated;
}

async function findNextAvailableSlideLayoutId(zip: JSZip): Promise<{ layoutId: number, layoutFileName: string, rId: string }> {
  const masterRelsFile = zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels');
  if (!masterRelsFile) throw new Error('slideMaster1.xml.rels non trouvé');

  const masterRelsContent = await masterRelsFile.async('string');
  const layoutMatches = masterRelsContent.match(/slideLayout(\d+)\.xml/g) || [];
  let maxLayoutNum = 0;
  layoutMatches.forEach(match => {
    const numPart = match.match(/slideLayout(\d+)\.xml/);
    const num = numPart ? parseInt(numPart[1], 10) : 0;
    if (num > maxLayoutNum) maxLayoutNum = num;
  });
  const nextLayoutNum = maxLayoutNum + 1;
  const allRIds = extractExistingRIds(masterRelsContent);
  const existingRIds = allRIds.map(m => m.rId);
  let nextRId = getNextAvailableRId(existingRIds);
  // console.log(`Prochain layout: slideLayout${nextLayoutNum}, rId: ${nextRId}`); // Verbose
  return { layoutId: nextLayoutNum, layoutFileName: `slideLayout${nextLayoutNum}.xml`, rId: nextRId };
}

async function ensureOmbeaSlideLayoutExists(zip: JSZip): Promise<{ layoutFileName: string, layoutRId: string }> {
  // console.log('Création d\'un layout OMBEA dédié...'); // Verbose
  const { layoutId, layoutFileName, rId } = await findNextAvailableSlideLayoutId(zip);
  const slideLayoutContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="tx" preserve="1"><p:cSld name="Titre et texte"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="Titre 1"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR" smtClean="0"/><a:t>Modifiez le style du titre</a:t></a:r><a:endParaRPr lang="fr-FR"/></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Espace réservé du texte 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr lvl="0"/><a:r><a:rPr lang="fr-FR" smtClean="0"/><a:t>Modifiez les styles du texte du masque</a:t></a:r></a:p><a:p><a:pPr lvl="1"/><a:r><a:rPr lang="fr-FR" smtClean="0"/><a:t>Deuxième niveau</a:t></a:r></a:p><a:p><a:pPr lvl="2"/><a:r><a:rPr lang="fr-FR" smtClean="0"/><a:t>Troisième niveau</a:t></a:r></a:p><a:p><a:pPr lvl="3"/><a:r><a:rPr lang="fr-FR" smtClean="0"/><a:t>Quatrième niveau</a:t></a:r></a:p><a:p><a:pPr lvl="4"/><a:r><a:rPr lang="fr-FR" smtClean="0"/><a:t>Cinquième niveau</a:t></a:r><a:endParaRPr lang="fr-FR"/></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="4" name="Espace réservé de la date 3"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="dt" sz="half" idx="10"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:fld id="{ABB4FD2C-0372-488A-B992-EB1BD753A34A}" type="datetimeFigureOut"><a:rPr lang="fr-FR" smtClean="0"/><a:t>28/05/2025</a:t></a:fld><a:endParaRPr lang="fr-FR"/></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="5" name="Espace réservé du pied de page 4"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="ftr" sz="quarter" idx="11"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="fr-FR"/></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="6" name="Espace réservé du numéro de diapositive 5"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldNum" sz="quarter" idx="12"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:fld id="{CD42254F-ACD2-467B-9045-5226EEC3B6AB}" type="slidenum"><a:rPr lang="fr-FR" smtClean="0"/><a:t>‹N°›</a:t></a:fld><a:endParaRPr lang="fr-FR"/></a:p></p:txBody></p:sp></p:spTree><p:extLst><p:ext uri="{BB962C8B-B14F-4D97-AF65-F5344CB8AC3E}"><p14:creationId xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" val="${Math.floor(Math.random() * 2147483647) + 1}"/></p:ext></p:extLst></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
  zip.file(`ppt/slideLayouts/${layoutFileName}`, slideLayoutContent);
  const slideLayoutRelsContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`;
  zip.file(`ppt/slideLayouts/_rels/${layoutFileName}.rels`, slideLayoutRelsContent);
  await updateSlideMasterRelsForNewLayout(zip, layoutFileName, rId);
  await updateSlideMasterForNewLayout(zip, layoutId, rId);
  await updateContentTypesForNewLayout(zip, layoutFileName);
  // console.log(`Layout OMBEA créé : ${layoutFileName} avec ${rId}`); // Verbose
  return { layoutFileName: layoutFileName, layoutRId: rId };
}

async function updateSlideMasterRelsForNewLayout(zip: JSZip, layoutFileName: string, rId: string): Promise<void> {
  const masterRelsFile = zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels');
  if (masterRelsFile) {
    let content = await masterRelsFile.async('string');
    const insertPoint = content.lastIndexOf('</Relationships>');
    const newRel = `\n  <Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/${layoutFileName}"/>`;
    content = content.slice(0, insertPoint) + newRel + '\n' + content.slice(insertPoint);
    zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', content);
  }
}

async function updateSlideMasterForNewLayout(zip: JSZip, layoutId: number, rId: string): Promise<void> {
  const masterFile = zip.file('ppt/slideMasters/slideMaster1.xml');
  if (masterFile) {
    let content = await masterFile.async('string');
    const layoutIdLstEnd = content.indexOf('</p:sldLayoutIdLst>');
    if (layoutIdLstEnd > -1) {
      const layoutIdValue = 2147483648 + layoutId;
      const newLayoutId = `\n    <p:sldLayoutId id="${layoutIdValue}" r:id="${rId}"/>`;
      content = content.slice(0, layoutIdLstEnd) + newLayoutId + '\n  ' + content.slice(layoutIdLstEnd);
      zip.file('ppt/slideMasters/slideMaster1.xml', content);
    }
  }
}

async function updateContentTypesForNewLayout(zip: JSZip, layoutFileName: string): Promise<void> {
  const contentTypesFile = zip.file('[Content_Types].xml');
  if (contentTypesFile) {
    let content = await contentTypesFile.async('string');
    if (!content.includes(layoutFileName)) {
      const lastLayoutIndex = content.lastIndexOf('slideLayout');
      let insertPoint = -1;
      if (lastLayoutIndex > -1) insertPoint = content.indexOf('/>', lastLayoutIndex) + 2;
      else insertPoint = content.lastIndexOf('</Types>');

      if (insertPoint > -1) {
        const newOverride = `\n  <Override PartName="/ppt/slideLayouts/${layoutFileName}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>`;
        content = content.slice(0, insertPoint) + newOverride + content.slice(insertPoint);
        zip.file('[Content_Types].xml', content);
      }
    }
  }
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
  let countdownDisplayText = ombeaConfig?.pollTimeLimit !== undefined ? ombeaConfig.pollTimeLimit : duration;

  let bulletTypeForXml = 'arabicPeriod'; // Default
  if (ombeaConfig?.answersBulletStyle) {
    const styleMap: Record<string, string> = {
      'ppBulletAlphaUCParenRight': 'alphaUcParenR', 'ppBulletAlphaUCPeriod': 'alphaUcPeriod',
      'ppBulletArabicParenRight': 'arabicParenR', 'ppBulletArabicPeriod': 'arabicPeriod'
    };
    bulletTypeForXml = styleMap[ombeaConfig.answersBulletStyle] || 'arabicPeriod';
  }
  const listStyleXml = `<a:lstStyle><a:lvl1pPr marL="514350" indent="-514350" algn="l"><a:buFontTx/><a:buClrTx/><a:buSzTx/><a:buAutoNum type="${bulletTypeForXml}"/></a:lvl1pPr></a:lstStyle>`;
  let xmlContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${slideComment}<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="${grpId}" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="${titleId}" name="Titre ${slideNumber}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/><p:custDataLst><p:tags r:id="rId2"/></p:custDataLst></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR" dirty="0"/><a:t>${escapeXml(question)}</a:t></a:r><a:endParaRPr lang="fr-FR" dirty="0"/></a:p></p:txBody></p:sp>`;
  if (imageDimensions) {
    xmlContent += `<p:pic><p:nvPicPr><p:cNvPr id="${imageId}" name="Image ${slideNumber}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId6"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${imageDimensions.x}" y="${imageDimensions.y}"/><a:ext cx="${imageDimensions.width}" cy="${imageDimensions.height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
  }
  xmlContent += `<p:sp><p:nvSpPr><p:cNvPr id="${bodyId}" name="Espace réservé du texte ${slideNumber}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/><p:custDataLst><p:tags r:id="rId3"/></p:custDataLst></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="1600200"/><a:ext cx="4572000" cy="4525963"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/>${listStyleXml}${options.map(option => `<a:p><a:pPr><a:buFont typeface="+mj-lt"/><a:buAutoNum type="${bulletTypeForXml}"/></a:pPr><a:r><a:rPr lang="fr-FR" dirty="0"/><a:t>${escapeXml(option)}</a:t></a:r></a:p>`).join('')}</p:txBody></p:sp>`;
  if (Number(countdownDisplayText) > 0) {
    xmlContent += `<p:sp><p:nvSpPr><p:cNvPr id="${countdownId}" name="OMBEA Countdown ${slideNumber}"/><p:cNvSpPr txBox="1"/><p:nvPr><p:custDataLst><p:tags r:id="rId4"/></p:custDataLst></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="317500" y="5715000"/><a:ext cx="1524000" cy="769441"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr vert="horz" rtlCol="0" anchor="ctr" anchorCtr="1"><a:spAutoFit/></a:bodyPr><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR" sz="4400" smtClean="0"/><a:t>${String(countdownDisplayText)}</a:t></a:r><a:endParaRPr lang="fr-FR" sz="4400"/></a:p></p:txBody></p:sp>`;
  }
  xmlContent += `</p:spTree><p:custDataLst><p:tags r:id="rId1"/></p:custDataLst><p:extLst><p:ext uri="{BB962C8B-B14F-4D97-AF65-F5344CB8AC3E}"><p14:creationId xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" val="${Math.floor(Math.random() * 2147483647) + 1}"/></p:ext></p:extLst></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr><p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"/></p:par></p:tnLst></p:timing></p:sld>`;
  return xmlContent;
}

function calculateBaseTagNumber(slideNumberInBatch: number, tagOffset: number = 0): number {
  return tagOffset + 1 + (slideNumberInBatch - 1) * 4;
}

function findHighestExistingTagNumber(zip: JSZip): number {
  let maxTagNumber = 0;
  const tagsFolder = zip.folder('ppt/tags');
  if (tagsFolder) {
    tagsFolder.forEach((relativePath) => {
      const match = relativePath.match(/tag(\d+)\.xml$/);
      if (match && match[1]) {
        const tagNum = parseInt(match[1],10);
        if (tagNum > maxTagNumber) maxTagNumber = tagNum;
      }
    });
  }
  // console.log(`Plus grand tag OMBEA existant: tag${maxTagNumber}.xml`); // Verbose
  return maxTagNumber;
}

function ensureTagContinuity(zip: JSZip, startingTag: number, endingTag: number): string[] {
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
    const content = await slideRelsFile.async('string');
    return content.includes('relationships/tags');
  } catch { return false; }
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
  let points = options.map((_, index) => (correctAnswerIndex !== undefined && index === correctAnswerIndex) ? "1.00" : "0.00").join(',');

  const tags: TagInfo[] = [];
  tags.push({
    tagNumber: baseTagNumber, fileName: `tag${baseTagNumber}.xml`,
    content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:tagLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:tag name="OR_SLIDE_GUID" val="${slideGuid}"/><p:tag name="OR_OFFICE_MAJOR_VERSION" val="14"/><p:tag name="OR_POLL_START_MODE" val="${ombeaConfig?.pollStartMode || 'Automatic'}"/><p:tag name="OR_CHART_VALUE_LABEL_FORMAT" val="${ombeaConfig?.chartValueLabelFormat || 'Response_Count'}"/><p:tag name="OR_CHART_RESPONSE_DENOMINATOR" val="Responses"/><p:tag name="OR_CHART_FIXED_RESPONSE_DENOMINATOR" val="100"/><p:tag name="OR_CHART_COLOR_MODE" val="Color_Scheme"/><p:tag name="OR_CHART_APPLY_OMBEA_TEMPLATE" val="True"/><p:tag name="OR_POLL_DEFAULT_ANSWER_OPTION" val="None"/><p:tag name="OR_SLIDE_TYPE" val="OR_QUESTION_SLIDE"/><p:tag name="OR_ANSWERS_BULLET_STYLE" val="${ombeaConfig?.answersBulletStyle || 'ppBulletArabicPeriod'}"/><p:tag name="OR_POLL_FLOW" val="Automatic"/><p:tag name="OR_CHART_DISPLAY_MODE" val="Automatic"/><p:tag name="OR_POLL_TIME_LIMIT" val="${ombeaConfig?.pollTimeLimit !== undefined ? ombeaConfig.pollTimeLimit : duration}"/><p:tag name="OR_POLL_COUNTDOWN_START_MODE" val="${ombeaConfig?.pollCountdownStartMode || 'Automatic'}"/><p:tag name="OR_POLL_MULTIPLE_RESPONSES" val="${ombeaConfig?.pollMultipleResponse !== undefined ? ombeaConfig.pollMultipleResponse : '1'}"/><p:tag name="OR_POLL_DUPLICATES_ALLOWED" val="False"/><p:tag name="OR_CATEGORIZING" val="False"/><p:tag name="OR_PRIORITY_RANKING" val="False"/><p:tag name="OR_IS_POLLED" val="False"/></p:tagLst>`
  });
  tags.push({
    tagNumber: baseTagNumber + 1, fileName: `tag${baseTagNumber + 1}.xml`,
    content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:tagLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:tag name="OR_SHAPE_TYPE" val="OR_TITLE"/></p:tagLst>`
  });
  tags.push({
    tagNumber: baseTagNumber + 2, fileName: `tag${baseTagNumber + 2}.xml`,
    content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:tagLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:tag name="OR_SHAPE_TYPE" val="OR_ANSWERS"/><p:tag name="OR_ANSWER_POINTS" val="${points}"/><p:tag name="OR_ANSWERS_TEXT" val="${options.map(escapeXml).join('&#13;')}"/></p:tagLst>`
  });
  tags.push({
    tagNumber: baseTagNumber + 3, fileName: `tag${baseTagNumber + 3}.xml`,
    content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:tagLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:tag name="OR_SHAPE_TYPE" val="OR_COUNTDOWN"/></p:tagLst>`
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
      mappings.push({ rId: idMatch[1], type: typeMatch[1], target: targetMatch[1] });
    }
  }
  return mappings;
}

function getNextAvailableRId(existingRIds: string[]): string {
  let maxId = 0;
  existingRIds.forEach(rId => {
    const match = rId.match(/rId(\d+)/);
    if (match && match[1]) {
      const num = parseInt(match[1],10);
      if (num > maxId) maxId = num;
    }
  });
  return `rId${maxId + 1}`;
}

async function rebuildPresentationXml(
  zip: JSZip,
  slideRIdMappings: { slideNumber: number; rId: string }[], // slideNumber is absolute slide number
  existingSlideCountInTemplate: number
): Promise<void> {
  const presentationFile = zip.file('ppt/presentation.xml');
  if (!presentationFile) {
    console.error("ppt/presentation.xml not found in template ZIP.");
    return;
  }
  let content = await presentationFile.async('string');
  const defaultTextStyleMatch = content.match(/<p:defaultTextStyle>[\s\S]*?<\/p:defaultTextStyle>/);
  const slideMasterRId = 'rId1'; // Standard assumption for the first (usually only) slide master

  let newSldIdLstContent = `<p:sldIdLst>`;
  // Add existing slides from template, ensuring their rIds are correctly referenced from presentation.xml.rels
  const presentationRelsContent = await zip.file('ppt/_rels/presentation.xml.rels')?.async('string') || '';
  const existingSlideRels = extractExistingRIds(presentationRelsContent).filter(r => r.target.startsWith('slides/slide'));

  for (let i = 1; i <= existingSlideCountInTemplate; i++) {
     const relForSlideI = existingSlideRels.find(r => r.target === `slides/slide${i}.xml`);
     if(relForSlideI) {
        newSldIdLstContent += `\n    <p:sldId id="${255 + i}" r:id="${relForSlideI.rId}"/>`;
     } else {
        // This case should ideally not happen if the template is well-formed
        console.warn(`No rId found in presentation.xml.rels for template slide ${i}`);
        // Fallback: try to guess or use a placeholder - this is risky
        // newSldIdLstContent += `\n    <p:sldId id="${255 + i}" r:id="rId${i+1}"/>`; // Common pattern, but not guaranteed
     }
  }
  // Add new OMBEA slides (their rIds are in slideRIdMappings)
  slideRIdMappings.forEach(mapping => {
    // slideNumber in mapping is already absolute
    newSldIdLstContent += `\n    <p:sldId id="${255 + mapping.slideNumber}" r:id="${mapping.rId}"/>`;
  });
  newSldIdLstContent += `\n  </p:sldIdLst>`;

  // Replace the old sldIdLst with the new one
  content = content.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/, newSldIdLstContent);

  // Ensure sldMasterIdLst points to a valid rId (usually rId1)
  if (!content.includes(`<p:sldMasterId id="2147483648" r:id="${slideMasterRId}"/>`)) {
      content = content.replace(/<p:sldMasterIdLst>[\s\S]*?<\/p:sldMasterIdLst>/, `<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="${slideMasterRId}"/></p:sldMasterIdLst>`);
  }

  zip.file('ppt/presentation.xml', content);
}


function updatePresentationRelsWithMappings(
  originalContent: string,
  newOmbeaSlideCount: number,
  existingSlideCountInTemplate: number
): { updatedContent: string; slideRIdMappings: { slideNumber: number; rId: string }[] } {

  const existingMappings = extractExistingRIds(originalContent);
  let rIdCounter = 1; // rIds start from 1

  const newRelsOrder: RIdMapping[] = [];

  // 1. Slide Master (should be rId1)
  const slideMasterRel = existingMappings.find(m => m.type.includes('slideMaster'));
  if (slideMasterRel) newRelsOrder.push({ ...slideMasterRel, rId: `rId${rIdCounter++}` });
  else console.warn("Slide Master relation not found in presentation.xml.rels!");

  // 2. Existing Slides from template
  const existingSlideRels = existingMappings.filter(m => m.target.startsWith('slides/slide'));
  existingSlideRels.sort((a,b) => { // Sort by target slide number to maintain order
      const numA = parseInt(a.target.match(/slide(\d+)\.xml/)?.[1] || '0');
      const numB = parseInt(b.target.match(/slide(\d+)\.xml/)?.[1] || '0');
      return numA - numB;
  });
  existingSlideRels.forEach(rel => newRelsOrder.push({ ...rel, rId: `rId${rIdCounter++}` }));

  // 3. New OMBEA Slides
  const slideRIdMappings: { slideNumber: number; rId: string }[] = [];
  for (let i = 0; i < newOmbeaSlideCount; i++) {
    const absoluteSlideNumber = existingSlideCountInTemplate + 1 + i;
    const newSlideRId = `rId${rIdCounter++}`;
    slideRIdMappings.push({ slideNumber: absoluteSlideNumber, rId: newSlideRId });
    newRelsOrder.push({
        rId: newSlideRId,
        type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide",
        target: `slides/slide${absoluteSlideNumber}.xml`
    });
  }

  // 4. Other relations (presProps, viewProps, theme, tableStyles)
  ['presProps', 'viewProps', 'theme', 'tableStyles'].forEach(typePart => {
    const rel = existingMappings.find(m => m.type.includes(typePart) && !newRelsOrder.find(nr => nr.target === m.target)); // ensure not already added
    if (rel) newRelsOrder.push({ ...rel, rId: `rId${rIdCounter++}` });
  });

  // Add any other remaining unique relations from original
  existingMappings.forEach(origRel => {
    if (!newRelsOrder.find(nr => nr.target === origRel.target && nr.type === origRel.type)) {
        newRelsOrder.push({ ...origRel, rId: `rId${rIdCounter++}`});
    }
  });


  let updatedContent = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
  newRelsOrder.forEach(rel => {
    updatedContent += `\n  <Relationship Id="${rel.rId}" Type="${rel.type}" Target="${rel.target}"/>`;
  });
  updatedContent += '\n</Relationships>';

  // console.log('Updated presentation.xml.rels content structure generated.'); // Verbose
  return { updatedContent, slideRIdMappings };
}


function updateContentTypesComplete(
  originalContent: string,
  newOmbeaSlideCount: number,
  totalSlidesInFinalPptx: number,
  layoutFileName: string,
  totalTagsUsed: number
): string {
  let updatedContent = originalContent;
  if (!updatedContent.includes(layoutFileName)) {
    const lastLayoutIndex = updatedContent.lastIndexOf('slideLayout');
    let insertPoint = -1;
    if (lastLayoutIndex > -1) insertPoint = updatedContent.indexOf('/>', lastLayoutIndex) + 2;
    else insertPoint = updatedContent.lastIndexOf('</Types>');

    if (insertPoint > -1) {
        const newOverride = `\n  <Override PartName="/ppt/slideLayouts/${layoutFileName}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>`;
        updatedContent = updatedContent.slice(0, insertPoint) + newOverride + updatedContent.slice(insertPoint);
    }
  }
  let newOverrides = '';
  const existingSlidesInTemplate = totalSlidesInFinalPptx - newOmbeaSlideCount;
  for (let i = 1; i <= newOmbeaSlideCount; i++) {
    const slideNum = existingSlidesInTemplate + i;
    if (!updatedContent.includes(`PartName="/ppt/slides/slide${slideNum}.xml"`)) {
      newOverrides += `\n  <Override PartName="/ppt/slides/slide${slideNum}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
    }
  }
  for (let i = 1; i <= totalTagsUsed; i++) {
    const tagPath = `/ppt/tags/tag${i}.xml`;
    if (!updatedContent.includes(`PartName="${tagPath}"`)) {
      newOverrides += `\n  <Override PartName="${tagPath}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tags+xml"/>`;
    }
  }
  if (newOverrides) {
    const insertPoint = updatedContent.lastIndexOf('</Types>');
    updatedContent = updatedContent.slice(0, insertPoint) + newOverrides + '\n' + updatedContent.slice(insertPoint);
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
  newOmbeaQuestions.forEach(q => {
    const questionWords = q.question.trim().split(/\s+/).filter(Boolean).length;
    const optionsWords = q.options.map(opt => opt.trim().split(/\s+/).filter(Boolean).length).reduce((a,b) => a+b, 0);
    totalWords += questionWords + optionsWords + 1; // +1 for timer placeholder
    totalParagraphs += 1 + q.options.length + 1; // Title, each option, timer placeholder
    newSlideTitles.push(q.question);
  });
  // totalSlides is the grand total including template slides
  return { totalSlides: totalFinalSlides, totalWords, totalParagraphs, slideTitles: newSlideTitles };
}

async function updateAppXml(zip: JSZip, metadata: AppXmlMetadata): Promise<void> {
  const appFile = zip.file('docProps/app.xml');
  if (!appFile) {
    console.warn('app.xml non trouvé, création d\'un nouveau fichier');
    createNewAppXml(zip, metadata);
    return;
  }
  let content = await appFile.async('string');
  content = updateSimpleFields(content, metadata);
  // updateHeadingPairsAndTitles needs to be robust for merging.
  // For now, it might be safer to update counts and not aggressively merge titles if it causes issues.
  content = updateHeadingPairsAndTitles(content, metadata.slideTitles); // Pass only new titles
  zip.file('docProps/app.xml', content);
}

function updateSimpleFields(content: string, metadata: AppXmlMetadata): string {
  let updated = content;
  updated = updated.replace(/<Slides>\d+<\/Slides>/, `<Slides>${metadata.totalSlides}</Slides>`);

  const wordsMatch = updated.match(/<Words>(\d+)<\/Words>/);
  const existingWords = wordsMatch && wordsMatch[1] ? parseInt(wordsMatch[1], 10) : 0;
  updated = updated.replace(/<Words>\d*<\/Words>/, `<Words>${existingWords + metadata.totalWords}</Words>`);

  const paragraphsMatch = updated.match(/<Paragraphs>(\d+)<\/Paragraphs>/);
  const existingParagraphs = paragraphsMatch && paragraphsMatch[1] ? parseInt(paragraphsMatch[1], 10) : 0;
  updated = updated.replace(/<Paragraphs>\d*<\/Paragraphs>/, `<Paragraphs>${existingParagraphs + metadata.totalParagraphs}</Paragraphs>`);

  if (!updated.includes('<TotalTime>')) {
    const propertiesEnd = updated.indexOf('</Properties>');
    if (propertiesEnd > -1) {
        const totalTimeTag = '\n  <TotalTime>2</TotalTime>';
        updated = updated.slice(0, propertiesEnd) + totalTimeTag + updated.slice(propertiesEnd);
    }
  }
  if (!updated.includes('<Company')) {
    const insertAfter = '</TitlesOfParts>'
    let insertPoint = updated.indexOf(insertAfter);
    if (insertPoint > -1) insertPoint += insertAfter.length;
    else insertPoint = updated.indexOf('</Properties>');

    if (insertPoint > -1) {
        const companyTag = '\n  <Company/>';
        updated = updated.slice(0, insertPoint) + companyTag + updated.slice(insertPoint);
    }
  }
  return updated;
}

// updateHeadingPairsAndTitles simplified to avoid complex merge, focuses on counts
function updateHeadingPairsAndTitles(content: string, newOmbeaSlideTitles: string[]): string {
    let updated = content;
    const titlesToAddCount = newOmbeaSlideTitles.length;

    // Update "Titres des diapositives" count in HeadingPairs
    const headingPairsRegex = /<vt:lpstr>Titres des diapositives<\/vt:lpstr>\s*<\/vt:variant>\s*<vt:variant>\s*<vt:i4>(\d+)<\/vt:i4>/;
    updated = updated.replace(headingPairsRegex, (match, p1) => {
        const existingCount = parseInt(p1, 10);
        return `<vt:lpstr>Titres des diapositives</vt:lpstr></vt:variant><vt:variant><vt:i4>${existingCount + titlesToAddCount}</vt:i4>`;
    });

    // Append new slide titles to TitlesOfParts
    const titlesOfPartsEndIndex = updated.indexOf('</vt:vector>', updated.indexOf('<TitlesOfParts>'));
    if (titlesOfPartsEndIndex !== -1) {
        let titlesXmlToAdd = "";
        newOmbeaSlideTitles.forEach(title => {
            titlesXmlToAdd += `\n      <vt:lpstr>${escapeXml(title.substring(0, 250))}</vt:lpstr>`; // Max length for lpstr
        });
        updated = updated.slice(0, titlesOfPartsEndIndex) + titlesXmlToAdd + updated.slice(titlesOfPartsEndIndex);

        // Update TitlesOfParts vector size
        updated = updated.replace(/<TitlesOfParts>\s*<vt:vector size="(\d+)"/, (match, p1) => {
            const existingSize = parseInt(p1, 10);
            return `<TitlesOfParts><vt:vector size="${existingSize + titlesToAddCount}"`;
        });
    }
    return updated;
}


function buildHeadingPairs(nonSlideTitles: string[], allSlideTitles: string[]): string {
  const pairs: string[] = [];
  const fontCount = nonSlideTitles.filter(t => t.includes('Arial') || t.includes('Calibri') || t.includes('Font') || t.includes('Police')).length;
  if (fontCount > 0) {
    pairs.push(`\n      <vt:variant><vt:lpstr>Polices utilisées</vt:lpstr></vt:variant>\n      <vt:variant><vt:i4>${fontCount}</vt:i4></vt:variant>`);
  }
  const hasTheme = nonSlideTitles.some(t => t.includes('Thème') || t.includes('Theme') || t === 'Thème Office');
  if (hasTheme) {
    pairs.push(`\n      <vt:variant><vt:lpstr>Thème</vt:lpstr></vt:variant>\n      <vt:variant><vt:i4>1</vt:i4></vt:variant>`);
  }
  if (allSlideTitles.length > 0) {
    pairs.push(`\n      <vt:variant><vt:lpstr>Titres des diapositives</vt:lpstr></vt:variant>\n      <vt:variant><vt:i4>${allSlideTitles.length}</vt:i4></vt:variant>`);
  }
  const vectorSize = pairs.reduce((acc, curr) => acc + curr.split('<vt:variant>').length -1, 0);
  return `<HeadingPairs><vt:vector size="${vectorSize}" baseType="variant">${pairs.join('')}\n    </vt:vector></HeadingPairs>`;
}

function buildTitlesOfParts(
  fonts: string[],
  themes: string[],
  existingSlideTitles: string[],
  newSlideTitles: string[]
): string {
  const allTitles: string[] = [];
  fonts.forEach(font => allTitles.push(escapeXml(font))); // Escape all titles
  themes.forEach(theme => allTitles.push(escapeXml(theme)));
  existingSlideTitles.forEach(title => allTitles.push(escapeXml(title)));
  newSlideTitles.forEach(title => {
    const truncatedTitle = title.length > 250 ? title.substring(0, 247) + '...' : title; // Ensure not too long
    allTitles.push(escapeXml(truncatedTitle));
  });
  const vectorContent = allTitles.map(title => `\n      <vt:lpstr>${title}</vt:lpstr>`).join('');
  return `<TitlesOfParts><vt:vector size="${allTitles.length}" baseType="lpstr">${vectorContent}\n    </vt:vector></TitlesOfParts>`;
}

function createNewAppXml(zip: JSZip, metadata: AppXmlMetadata): void {
  const defaultFonts = ['Arial', 'Calibri'];
  const defaultThemes = ['Thème Office'];
  const headingPairs = buildHeadingPairs([...defaultFonts, ...defaultThemes], metadata.slideTitles); // slideTitles are for new slides
  const titlesOfParts = buildTitlesOfParts(defaultFonts, defaultThemes, [], metadata.slideTitles);

  const appXmlContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <TotalTime>2</TotalTime><Words>${metadata.totalWords}</Words><Application>Microsoft Office PowerPoint</Application>
  <PresentationFormat>Affichage à l'écran (4:3)</PresentationFormat><Paragraphs>${metadata.totalParagraphs}</Paragraphs>
  <Slides>${metadata.totalSlides}</Slides><Notes>0</Notes><HiddenSlides>0</HiddenSlides><MMClips>0</MMClips>
  <ScaleCrop>false</ScaleCrop>${headingPairs}${titlesOfParts}<Company/><LinksUpToDate>false</LinksUpToDate>
  <SharedDoc>false</SharedDoc><HyperlinksChanged>false</HyperlinksChanged><AppVersion>14.0000</AppVersion></Properties>`;
  zip.file('docProps/app.xml', appXmlContent);
}

async function updateCoreXml(zip: JSZip, newQuestionCount: number): Promise<void> {
  const coreFile = zip.file('docProps/core.xml');
  if (coreFile) {
    let content = await coreFile.async('string');
    const title = `Quiz OMBEA ${newQuestionCount} question${newQuestionCount > 1 ? 's' : ''}`;
    content = content.replace(/<dc:title>.*?<\/dc:title>/, `<dc:title>${escapeXml(title)}</dc:title>`);
    const now = new Date().toISOString();
    content = content.replace(/<dcterms:modified.*?>.*?<\/dcterms:modified>/, `<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>`);
     if (!content.includes('<dcterms:created')) {
        const lastModifiedEnd = content.indexOf('</dcterms:modified>') + '</dcterms:modified>'.length;
        const createdTag = `\n  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>`;
        if (lastModifiedEnd > -1 && lastModifiedEnd <= content.length) {
            content = content.slice(0, lastModifiedEnd) + createdTag + content.slice(lastModifiedEnd);
        } else { // Fallback if </dcterms:modified> not found, append before </cp:coreProperties>
            const corePropsEnd = content.lastIndexOf("</cp:coreProperties>");
            if (corePropsEnd > -1) {
                 content = content.slice(0, corePropsEnd) + createdTag + "\n" + content.slice(corePropsEnd);
            }
        }
    }
    zip.file('docProps/core.xml', content);
  }
}

export async function generatePPTXVal17(
  templateFile: File | null,
  questions: Val17Question[],
  options: GenerationOptions = {}
): Promise<void> {
  try {
    const executionId = Date.now();
    // console.log(`\n=== DÉBUT GÉNÉRATION VAL17 ${executionId} ===`); // Verbose
    validateQuestions(questions);
    let currentTemplateFile: File;
    if (templateFile) {
      currentTemplateFile = templateFile;
    } else {
      console.warn("Aucun fichier modèle fourni.");
      throw new Error('Template file is required by generatePPTXVal17.');
    }
    // console.log(`Chargement du modèle: ${currentTemplateFile.name}`); // Verbose
    const templateZip = await JSZip.loadAsync(currentTemplateFile);

    // let initialFileCount = 0; // Verbose
    // templateZip.forEach(() => initialFileCount++); // Verbose
    // console.log(`Fichiers dans le template chargé: ${initialFileCount}`); // Verbose

    const existingSlideCount = countExistingSlides(templateZip);
    // console.log(`Slides existantes dans le modèle: ${existingSlideCount}`); // Verbose
    // console.log(`Nouvelles slides OMBEA à créer: ${questions.length}`); // Verbose

    const existingTagsCount = findHighestExistingTagNumber(templateZip);
    let maxTagNumberUsed = existingTagsCount;

    const outputZip = new JSZip();
    const copyPromises: Promise<void>[] = [];
    templateZip.forEach((relativePath, file) => {
      if (!file.dir) {
        const copyPromise: Promise<void> = file.async('blob').then(content => { // Corrected type
          outputZip.file(relativePath, content);
        });
        copyPromises.push(copyPromise);
      } else {
        outputZip.folder(relativePath);
      }
    });
    await Promise.all(copyPromises);
    // console.log('Modèle copié dans outputZip.'); // Verbose

    const { layoutFileName } = await ensureOmbeaSlideLayoutExists(outputZip);

    outputZip.folder('ppt/tags');
    if (!outputZip.file('ppt/media')) {
        outputZip.folder('ppt/media');
    }

    // console.log('Préparation des slides de questions OMBEA...'); // Verbose
    const imageExtensions = new Set<string>();
    interface DownloadedImage { fileName: string; data: ArrayBuffer; width: number; height: number; dimensions: ImageDimensions; extension: string; }
    const downloadedImages = new Map<number, DownloadedImage>();

    if (questions.some(q => q.imageUrl)) {
      // console.log('Téléchargement des images pour les questions...'); // Verbose
      const imagePromises = questions.map(async (question, index) => {
        if (question.imageUrl) {
          try {
            const imageData = await downloadImageFromCloudWithDimensions(question.imageUrl);
            if (imageData) {
              const absoluteSlideNumberForImage = existingSlideCount + index + 1;
              const imgFileName = `image_q_slide${absoluteSlideNumberForImage}.${imageData.extension}`;
              const dimensions = calculateImageDimensions(imageData.width, imageData.height);
              return { slideNumberContext: absoluteSlideNumberForImage, image: { fileName: imgFileName, data: imageData.data, width: imageData.width, height: imageData.height, dimensions, extension: imageData.extension } };
            }
          } catch (error) { console.error(`Erreur téléchargement image pour question ${index + 1} (${question.imageUrl}):`, error); }
        }
        return null;
      });
      const imageResults = await Promise.all(imagePromises);
      imageResults.forEach(result => {
        if (result && result.image) {
          downloadedImages.set(result.slideNumberContext, result.image);
          imageExtensions.add(result.image.extension);
          outputZip.folder('ppt/media')?.file(result.image.fileName, result.image.data);
        }
      });
      // console.log(`${downloadedImages.size} images traitées.`); // Verbose
    }

    for (let i = 0; i < questions.length; i++) {
      const absoluteSlideNumber = existingSlideCount + i + 1;
      const questionData = questions[i];
      const duration = questionData.points || options.ombeaConfig?.pollTimeLimit || options.defaultDuration || 30;

      const downloadedImage = downloadedImages.get(absoluteSlideNumber);
      const slideXml = createSlideXml(questionData.question, questionData.options, absoluteSlideNumber, duration, downloadedImage?.dimensions, options.ombeaConfig);
      outputZip.file(`ppt/slides/slide${absoluteSlideNumber}.xml`, slideXml);

      const baseTagNumberForSlide = calculateBaseTagNumber(i + 1, existingTagsCount);

      let slideRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`;
      slideRelsXml += `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags" Target="../tags/tag${baseTagNumberForSlide}.xml"/>`;
      slideRelsXml += `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags" Target="../tags/tag${baseTagNumberForSlide + 1}.xml"/>`;
      slideRelsXml += `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags" Target="../tags/tag${baseTagNumberForSlide + 2}.xml"/>`;
      slideRelsXml += `<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags" Target="../tags/tag${baseTagNumberForSlide + 3}.xml"/>`;
      slideRelsXml += `<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/${layoutFileName}"/>`;
      if (downloadedImage) {
        slideRelsXml += `<Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${downloadedImage.fileName}"/>`;
      }
      slideRelsXml += `</Relationships>`;
      outputZip.file(`ppt/slides/_rels/slide${absoluteSlideNumber}.xml.rels`, slideRelsXml);

      const tags = createSlideTagFiles(i + 1, questionData.options, questionData.correctAnswerIndex, duration, options.ombeaConfig, existingTagsCount);
      tags.forEach(tag => {
        outputZip.file(`ppt/tags/${tag.fileName}`, tag.content);
        if (tag.tagNumber > maxTagNumberUsed) maxTagNumberUsed = tag.tagNumber;
      });
    }
    if (existingTagsCount > 0 && questions.length > 0) {
      const warnings = ensureTagContinuity(outputZip, 1, maxTagNumberUsed);
      if (warnings.length > 0) console.warn('⚠️ Problèmes de continuité des tags détectés:', warnings);
    }

    const totalFinalSlideCount = existingSlideCount + questions.length;

    const contentTypesFile = outputZip.file('[Content_Types].xml');
    if (contentTypesFile) {
      let contentTypesContent = await contentTypesFile.async('string');
      if (imageExtensions.size > 0) contentTypesContent = updateContentTypesForImages(contentTypesContent, imageExtensions);
      contentTypesContent = updateContentTypesComplete(contentTypesContent, questions.length, totalFinalSlideCount, layoutFileName, maxTagNumberUsed);
      outputZip.file('[Content_Types].xml', contentTypesContent);
    }

    const presentationRelsFile = outputZip.file('ppt/_rels/presentation.xml.rels');
    if (presentationRelsFile) {
      const presentationRelsContent = await presentationRelsFile.async('string');
      const { updatedContent: updatedPresentationRels, slideRIdMappings } = updatePresentationRelsWithMappings(presentationRelsContent, questions.length, existingSlideCount);
      outputZip.file('ppt/_rels/presentation.xml.rels', updatedPresentationRels);
      await rebuildPresentationXml(outputZip, slideRIdMappings, existingSlideCount);
    }

    await updateCoreXml(outputZip, questions.length);
    const appMetadata = calculateAppXmlMetadata(totalFinalSlideCount, questions);
    await updateAppXml(outputZip, appMetadata);

    // console.log('Génération du fichier PPTX final...'); // Verbose
    const outputBlob = await outputZip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', compression: 'DEFLATE', compressionOptions: { level: 3 } });
    const finalFileName = options.fileName || `Questions_OMBEA_${new Date().toISOString().slice(0, 10)}.pptx`;
    saveAs(outputBlob, finalFileName);
    console.log(`Fichier OMBEA "${finalFileName}" généré avec succès.`);
    // console.log(`Total des slides: ${totalFinalSlideCount}`); // Verbose
    // console.log(`=== FIN GÉNÉRATION VAL17 ${executionId} - SUCCÈS ===`); // Verbose
  } catch (error: any) {
    console.error(`=== ERREUR GÉNÉRATION VAL17 ===`);
    console.error(error.message);
    alert(`Erreur lors de la génération du PPTX interactif des questions OMBEA: ${error.message}`);
    throw error;
  }
}

export async function testConsistency(templateFile: File, questions: Val17Question[]): Promise<void> {
  console.log('=== TEST DE COHÉRENCE (val17PptxGenerator) ===');
  const results = [];
  for (let i = 0; i < 1; i++) {
    console.log(`\nTest de cohérence ${i + 1}...`);
    try {
      const templateCopy = new File([await templateFile.arrayBuffer()], templateFile.name, { type: templateFile.type });
      await generatePPTXVal17(templateCopy, questions, { fileName: `Test_Coherence_${i + 1}.pptx` });
      results.push('SUCCÈS');
    } catch (error: any) { results.push(`ÉCHEC: ${error.message}`); }
  }
  console.log('\n=== RÉSULTATS TEST DE COHÉRENCE ===');
  results.forEach((result, i) => console.log(`Test ${i + 1}: ${result}`));
}

export const handleGeneratePPTXFromVal17Tool = async (templateFile: File, questions: Val17Question[]) => {
  try {
    await generatePPTXVal17(templateFile, questions, { fileName: 'Quiz_OMBEA_Interactif_Val17.pptx' });
  } catch (error: any) {
    console.error('Erreur dans handleGeneratePPTXFromVal17Tool:', error);
    alert(`Erreur lors de la génération (handleGeneratePPTXFromVal17Tool): ${error.message}`);
  }
};

export type {
  TagInfo,
  RIdMapping,
  AppXmlMetadata
};
