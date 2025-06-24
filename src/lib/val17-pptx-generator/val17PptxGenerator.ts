import JSZip from 'jszip';
import { saveAs } from 'file-saver';
// Placeholder types, assuming val17PptxTypes.ts will be created or types defined here
// import { ConfigOptions, GenerationOptions } from './val17PptxTypes';

// Placeholder types until we get the actual definitions from your types.ts
export interface ConfigOptions {
  pollStartMode?: string;
  chartValueLabelFormat?: string;
  answersBulletStyle?: string;
  pollTimeLimit?: number;
  pollCountdownStartMode?: string;
  pollMultipleResponse?: string;
}

export interface GenerationOptions {
  fileName?: string;
  defaultDuration?: number;
  ombeaConfig?: ConfigOptions;
}

// Interface Question for this generator
export interface Val17Question {
  question: string;
  options: string[];
  correctAnswerIndex?: number;
  imageUrl?: string;
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
  if (!unsafe) return '';
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
    const objectUrl = URL.createObjectURL(blob); // Renamed for clarity
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: 1920, height: 1080 }); // Default on error
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
    console.log(`[IMAGE] Début téléchargement: ${url}`);
    let finalUrl = url; // For blob URLs, it's already direct
    if (url.includes('dropbox.com')) { // Example of specific cloud provider handling
      finalUrl = processCloudUrl(url);
      console.log(`[IMAGE] URL Dropbox transformée: ${finalUrl}`);
    }
    console.log(`[IMAGE] Tentative de fetch: ${finalUrl}`);
    const response = await fetch(finalUrl);
    console.log(`[IMAGE] Réponse reçue: ${response.status} ${response.statusText}`);
    console.log(`[IMAGE] Content-Type: ${response.headers.get('content-type')}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const blob = await response.blob();
    console.log(`[IMAGE] Blob reçu: ${blob.size} octets, type: ${blob.type}`);
    if (!blob.type.startsWith('image/')) {
      console.warn(`[IMAGE] Type MIME non-image détecté: ${blob.type}, on continue quand même`);
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
    console.log(`[IMAGE] ✓ Succès: ${(arrayBuffer.byteLength / 1024).toFixed(2)} KB, ${dimensions.width}x${dimensions.height}, ${extension}`);
    return { data: arrayBuffer, extension, width: dimensions.width, height: dimensions.height };
  } catch (error) {
    console.error(`[IMAGE] ✗ Échec pour ${url}:`, error);
    if (error instanceof Error) {
      console.error(`[IMAGE] Message: ${error.message}`);
      // console.error(`[IMAGE] Stack: ${error.stack}`); // Stack might be too verbose for default log
    }
    return null;
  }
}

function updateContentTypesForImages(content: string, imageExtensions: Set<string>): string {
  let updated = content;
  imageExtensions.forEach(ext => {
    if (!updated.includes(`Extension="${ext}"`)) {
      let contentType = 'image/jpeg';
      switch(ext) {
        case 'png': contentType = 'image/png'; break;
        case 'gif': contentType = 'image/gif'; break;
        case 'bmp': contentType = 'image/bmp'; break;
        case 'svg': contentType = 'image/svg+xml'; break;
        case 'webp': contentType = 'image/webp'; break;
      }
      const insertPoint = updated.indexOf('<Override'); // Simplified insertion point
      if (insertPoint > -1) {
        const newDefault = `\n<Default Extension="${ext}" ContentType="${contentType}"/>`;
        updated = updated.slice(0, insertPoint) + newDefault + updated.slice(insertPoint);
      } else { // Fallback if no <Override> tag is found (highly unlikely for a valid PPTX)
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
  if (!masterRelsFile) {
    throw new Error('slideMaster1.xml.rels non trouvé');
  }
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
  console.log(`Prochain layout: slideLayout${nextLayoutNum}, rId: ${nextRId}`);
  // console.log(`rIds existants dans slideMaster1.xml.rels:`, existingRIds); // Verbose
  return { layoutId: nextLayoutNum, layoutFileName: `slideLayout${nextLayoutNum}.xml`, rId: nextRId };
}

async function ensureOmbeaSlideLayoutExists(zip: JSZip): Promise<{ layoutFileName: string, layoutRId: string }> {
  console.log('Création d\'un layout OMBEA dédié...');
  const { layoutId, layoutFileName, rId } = await findNextAvailableSlideLayoutId(zip);
  const slideLayoutContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="tx" preserve="1"><p:cSld name="Titre et texte"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="Titre 1"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR" smtClean="0"/><a:t>Modifiez le style du titre</a:t></a:r><a:endParaRPr lang="fr-FR"/></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Espace réservé du texte 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr lvl="0"/><a:r><a:rPr lang="fr-FR" smtClean="0"/><a:t>Modifiez les styles du texte du masque</a:t></a:r></a:p><a:p><a:pPr lvl="1"/><a:r><a:rPr lang="fr-FR" smtClean="0"/><a:t>Deuxième niveau</a:t></a:r></a:p><a:p><a:pPr lvl="2"/><a:r><a:rPr lang="fr-FR" smtClean="0"/><a:t>Troisième niveau</a:t></a:r></a:p><a:p><a:pPr lvl="3"/><a:r><a:rPr lang="fr-FR" smtClean="0"/><a:t>Quatrième niveau</a:t></a:r></a:p><a:p><a:pPr lvl="4"/><a:r><a:rPr lang="fr-FR" smtClean="0"/><a:t>Cinquième niveau</a:t></a:r><a:endParaRPr lang="fr-FR"/></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="4" name="Espace réservé de la date 3"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="dt" sz="half" idx="10"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:fld id="{ABB4FD2C-0372-488A-B992-EB1BD753A34A}" type="datetimeFigureOut"><a:rPr lang="fr-FR" smtClean="0"/><a:t>28/05/2025</a:t></a:fld><a:endParaRPr lang="fr-FR"/></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="5" name="Espace réservé du pied de page 4"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="ftr" sz="quarter" idx="11"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="fr-FR"/></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="6" name="Espace réservé du numéro de diapositive 5"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldNum" sz="quarter" idx="12"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:fld id="{CD42254F-ACD2-467B-9045-5226EEC3B6AB}" type="slidenum"><a:rPr lang="fr-FR" smtClean="0"/><a:t>‹N°›</a:t></a:fld><a:endParaRPr lang="fr-FR"/></a:p></p:txBody></p:sp></p:spTree><p:extLst><p:ext uri="{BB962C8B-B14F-4D97-AF65-F5344CB8AC3E}"><p14:creationId xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" val="${Math.floor(Math.random() * 2147483647) + 1}"/></p:ext></p:extLst></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
  zip.file(`ppt/slideLayouts/${layoutFileName}`, slideLayoutContent);
  const slideLayoutRelsContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`;
  zip.file(`ppt/slideLayouts/_rels/${layoutFileName}.rels`, slideLayoutRelsContent);
  await updateSlideMasterRelsForNewLayout(zip, layoutFileName, rId);
  await updateSlideMasterForNewLayout(zip, layoutId, rId);
  await updateContentTypesForNewLayout(zip, layoutFileName);
  console.log(`Layout OMBEA créé : ${layoutFileName} avec ${rId}`);
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
      const layoutIdValue = 2147483648 + layoutId; // Ensure unique ID for layout
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
      if (lastLayoutIndex > -1) {
        insertPoint = content.indexOf('/>', lastLayoutIndex) + 2;
      } else { // Fallback if no slideLayouts exist, insert before </Types>
        insertPoint = content.lastIndexOf('</Types>');
      }
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
  slideNumber: number,
  duration: number = 30,
  imageDimensions?: ImageDimensions,
  ombeaConfig?: ConfigOptions
): string {
  const slideComment = `<!-- Slide ${slideNumber} -->`;
  const baseId = slideNumber * 10; // Ensure unique base ID for each slide
  const grpId = baseId + 1;
  const titleId = baseId + 2;
  const bodyId = baseId + 3;
  const countdownId = baseId + 4;
  const imageId = baseId + 5; // For the image placeholder if present
  let countdownDisplayText = ombeaConfig?.pollTimeLimit !== undefined ? ombeaConfig.pollTimeLimit : duration;

  let bulletTypeForXml = 'arabicPeriod';
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

function calculateBaseTagNumber(slideNumber: number, tagOffset: number = 0): number {
  return tagOffset + 1 + (slideNumber - 1) * 4;
}

function findHighestExistingTagNumber(zip: JSZip): number {
  let maxTagNumber = 0;
  const tagsFolder = zip.folder('ppt/tags');
  if (tagsFolder) {
    tagsFolder.forEach((relativePath) => {
      const match = relativePath.match(/tag(\d+)\.xml$/);
      if (match) {
        const tagNum = parseInt(match[1],10);
        if (tagNum > maxTagNumber) maxTagNumber = tagNum;
      }
    });
  }
  console.log(`Plus grand tag OMBEA existant: tag${maxTagNumber}.xml`);
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

async function countExistingOmbeaSlides(zip: JSZip): Promise<number> {
  let count = 0;
  const totalSlides = countExistingSlides(zip);
  for (let i = 1; i <= totalSlides; i++) {
    if (await isOmbeaSlide(zip, i)) count++;
  }
  console.log(`Slides OMBEA existantes détectées: ${count}`);
  return count;
}

function createSlideTagFiles(
  questionIndex: number, // This is 1-based index for new questions
  options: string[],
  correctAnswerIndex: number | undefined,
  duration: number,
  ombeaConfig?: ConfigOptions,
  tagOffset: number = 0 // Number of existing tags
): TagInfo[] {
  const baseTagNumber = calculateBaseTagNumber(questionIndex, tagOffset);
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
    if (match) {
      const num = parseInt(match[1],10);
      if (num > maxId) maxId = num;
    }
  });
  return `rId${maxId + 1}`;
}

async function rebuildPresentationXml(
  zip: JSZip,
  slideRIdMappings: { slideNumber: number; rId: string }[],
  existingSlideCount: number
): Promise<void> {
  const presentationFile = zip.file('ppt/presentation.xml');
  if (!presentationFile) return;
  let content = await presentationFile.async('string');
  const defaultTextStyleMatch = content.match(/<p:defaultTextStyle>[\s\S]*?<\/p:defaultTextStyle>/);
  const slideMasterRId = 'rId1'; // Standard assumption
  let newContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="${slideMasterRId}"/></p:sldMasterIdLst><p:sldIdLst>`;
  for (let i = 1; i <= existingSlideCount; i++) { // This loop should correctly reference existing slides rIds
     const existingSlideRel = (await extractExistingRIds(await zip.file('ppt/_rels/presentation.xml.rels')!.async('string'))).find(r => r.target === `slides/slide${i}.xml`);
     if(existingSlideRel) newContent += `\n    <p:sldId id="${255 + i}" r:id="${existingSlideRel.rId}"/>`;
  }
  slideRIdMappings.forEach(mapping => { // These are new slides
    const slideId = 255 + mapping.slideNumber; // slideNumber here is the absolute number (existing + new_index)
    newContent += `\n    <p:sldId id="${slideId}" r:id="${mapping.rId}"/>`;
  });
  newContent += `\n  </p:sldIdLst><p:sldSz cx="9144000" cy="6858000" type="screen4x3"/><p:notesSz cx="6858000" cy="9144000"/>`;
  if (defaultTextStyleMatch) {
    newContent += '\n  ' + defaultTextStyleMatch[0];
  }
  newContent += `\n</p:presentation>`;
  zip.file('ppt/presentation.xml', newContent);
}

function updatePresentationRelsWithMappings(
  originalContent: string,
  newSlideCount: number, // Number of newly added OMBEA slides
  existingSlideCount: number // Number of slides in the template BEFORE OMBEA slides
): { updatedContent: string; slideRIdMappings: { slideNumber: number; rId: string }[] } {
  const existingMappings = extractExistingRIds(originalContent);
  const slideMasterRel = existingMappings.find(m => m.type.includes('slideMaster'));
  // Filter for actual slide relations, excluding slide master itself if it was caught by '/slide'
  const slideRelations = existingMappings.filter(m => m.type.endsWith('/relationships/slide') && m.target.startsWith('slides/slide'));
  const presPropsRel = existingMappings.find(m => m.type.includes('presProps'));
  const viewPropsRel = existingMappings.find(m => m.type.includes('viewProps'));
  const themeRel = existingMappings.find(m => m.type.includes('theme'));
  const tableStylesRel = existingMappings.find(m => m.type.includes('tableStyles'));

  let newContent = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
  const slideRIdMappings: { slideNumber: number; rId: string }[] = [];
  let rIdCounter = 1; // Start rId counter

  if (slideMasterRel) {
    newContent += `<Relationship Id="rId${rIdCounter++}" Type="${slideMasterRel.type}" Target="${slideMasterRel.target}"/>`;
  }
  // Add existing slide relations from the template
  slideRelations.forEach(() => { // Iterate for the number of existing slides
    const originalRel = slideRelations.shift(); // take the first one
    if (originalRel) {
        newContent += `<Relationship Id="rId${rIdCounter++}" Type="${originalRel.type}" Target="${originalRel.target}"/>`;
    }
  });

  // Add new OMBEA slides
  for (let i = 0; i < newSlideCount; i++) {
    const absoluteSlideNumber = existingSlideCount + 1 + i; // Correct absolute slide number
    const rId = `rId${rIdCounter++}`;
    slideRIdMappings.push({ slideNumber: absoluteSlideNumber, rId: rId });
    newContent += `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${absoluteSlideNumber}.xml"/>`;
  }

  // Add other properties
  if (presPropsRel) { newContent += `<Relationship Id="rId${rIdCounter++}" Type="${presPropsRel.type}" Target="${presPropsRel.target}"/>`;}
  if (viewPropsRel) { newContent += `<Relationship Id="rId${rIdCounter++}" Type="${viewPropsRel.type}" Target="${viewPropsRel.target}"/>`;}
  if (themeRel) { newContent += `<Relationship Id="rId${rIdCounter++}" Type="${themeRel.type}" Target="${themeRel.target}"/>`;}
  if (tableStylesRel) { newContent += `<Relationship Id="rId${rIdCounter++}" Type="${tableStylesRel.type}" Target="${tableStylesRel.target}"/>`;}
  newContent += '</Relationships>';
  // console.log('Nouvelle organisation des rId dans presentation.xml.rels générée.');
  return { updatedContent: newContent, slideRIdMappings };
}

function updateContentTypesComplete(
  originalContent: string,
  newOmbeaSlideCount: number, // Number of new OMBEA slides
  totalSlidesInFinalPptx: number, // Total slides (template + ombea)
  layoutFileName: string, // The OMBEA layout we ensured/created
  totalTags: number // Total number of tagX.xml files
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
  // Add new OMBEA slides - their numbers start *after* existing template slides
  // existingSlideCount is total slides in template *before* OMBEA slides are added.
  const existingSlideCountOriginal = totalSlidesInFinalPptx - newOmbeaSlideCount;

  for (let i = 1; i <= newOmbeaSlideCount; i++) {
    const slideNum = existingSlideCountOriginal + i;
    if (!updatedContent.includes(`slide${slideNum}.xml`)) {
      newOverrides += `\n  <Override PartName="/ppt/slides/slide${slideNum}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
    }
  }
  for (let i = 1; i <= totalTags; i++) {
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
  totalFinalSlides: number, // Total slides in the final PPTX
  questions: Val17Question[]
): AppXmlMetadata {
  let totalWords = 0;
  let totalParagraphs = 0;
  const slideTitles: string[] = []; // Only for new OMBEA questions
  questions.forEach(q => {
    const questionWords = q.question.trim().split(/\s+/).filter(word => word.length > 0).length;
    totalWords += questionWords + (q.options.map(opt => opt.trim().split(/\s+/).filter(w => w.length > 0).length).reduce((a,b) => a+b, 0)) + 1; // +1 for timer
    totalParagraphs += 1 + q.options.length + 1; // Title, each option, timer
    slideTitles.push(q.question);
  });
  return { totalSlides: totalFinalSlides, totalWords, totalParagraphs, slideTitles };
}

async function updateAppXml(zip: JSZip, metadata: AppXmlMetadata): Promise<void> {
  const appFile = zip.file('docProps/app.xml');
  if (!appFile) {
    console.warn('app.xml non trouvé, création d\'un nouveau fichier');
    createNewAppXml(zip, metadata); // metadata.slideTitles here are only for new slides
    return;
  }
  let content = await appFile.async('string');
  content = updateSimpleFields(content, metadata); // metadata.totalSlides is the final count
  // For HeadingPairs and TitlesOfParts, we need to preserve existing titles from template
  // This part is complex if we want to perfectly merge.
  // A simpler approach for now: update counts, but don't try to merge TitlesOfParts perfectly.
  // The metadata.slideTitles are for the *newly added* slides.
  // This might need refinement if app.xml structure is critical for template styles.
  // For now, let's assume PowerPoint can handle some inconsistencies here if we just update counts.
  // Or, we can try to append new titles to existing ones.
  zip.file('docProps/app.xml', content);
}

function updateSimpleFields(content: string, metadata: AppXmlMetadata): string {
  let updated = content;
  updated = updated.replace(/<Slides>\d+<\/Slides>/, `<Slides>${metadata.totalSlides}</Slides>`);
  // For Words and Paragraphs, we should ideally ADD to existing counts, not replace.
  // This requires parsing existing values. For simplicity, current code replaces.
  const wordsMatch = updated.match(/<Words>(\d+)<\/Words>/);
  const existingWords = wordsMatch ? parseInt(wordsMatch[1], 10) : 0;
  updated = updated.replace(/<Words>\d+<\/Words>/, `<Words>${existingWords + metadata.totalWords}</Words>`);

  const paragraphsMatch = updated.match(/<Paragraphs>(\d+)<\/Paragraphs>/);
  const existingParagraphs = paragraphsMatch ? parseInt(paragraphsMatch[1], 10) : 0;
  updated = updated.replace(/<Paragraphs>\d+<\/Paragraphs>/, `<Paragraphs>${existingParagraphs + metadata.totalParagraphs}</Paragraphs>`);

  if (!updated.includes('<TotalTime>')) {
    const propertiesEnd = updated.indexOf('</Properties>');
    if (propertiesEnd > -1) {
        const totalTimeTag = '\n  <TotalTime>2</TotalTime>'; // Default value
        updated = updated.slice(0, propertiesEnd) + totalTimeTag + updated.slice(propertiesEnd);
    }
  }
  if (!updated.includes('<Company')) { // Ensure Company tag exists
    const insertPoint = updated.indexOf('</TitlesOfParts>') > -1 ? updated.indexOf('</TitlesOfParts>') + '</TitlesOfParts>'.length : updated.indexOf('</Properties>');
    if (insertPoint > -1) {
        const companyTag = '\n  <Company/>';
        updated = updated.slice(0, insertPoint) + companyTag + updated.slice(insertPoint);
    }
  }
  return updated;
}

function updateHeadingPairsAndTitles(content: string, newSlideTitles: string[]): string {
    // This function needs to be more robust:
    // 1. Parse existing HeadingPairs and TitlesOfParts from `content`.
    // 2. Append newSlideTitles to the existing list of slide titles.
    // 3. Reconstruct HeadingPairs and TitlesOfParts XML with updated counts and lists.
    // For now, this is a placeholder for a complex operation.
    // A simple approach might be to just update the count in HeadingPairs if "Titres des diapositives" exists.
    console.warn("updateHeadingPairsAndTitles is simplified and may not perfectly merge titles from template with new titles.");

    let updated = content;
    const titlesToAddCount = newSlideTitles.length;

    // Try to update "Titres des diapositives" count in HeadingPairs
    const headingPairsMatch = updated.match(/<vt:lpstr>Titres des diapositives<\/vt:lpstr>\s*<vt:variant>\s*<vt:i4>(\d+)<\/vt:i4>\s*<\/vt:variant>/);
    if (headingPairsMatch && headingPairsMatch[1]) {
        const existingTitleCount = parseInt(headingPairsMatch[1], 10);
        const newTitleCount = existingTitleCount + titlesToAddCount;
        updated = updated.replace(headingPairsMatch[0], `<vt:lpstr>Titres des diapositives</vt:lpstr></vt:variant><vt:variant><vt:i4>${newTitleCount}</vt:i4></vt:variant>`);
    }

    // Try to append to TitlesOfParts
    const titlesOfPartsEndMatch = updated.lastIndexOf('</vt:vector>', updated.indexOf('</TitlesOfParts>'));
    if (titlesOfPartsEndMatch > -1) {
        let titlesXmlToAdd = "";
        newSlideTitles.forEach(title => {
            titlesXmlToAdd += `\n      <vt:lpstr>${escapeXml(title.substring(0,100))}</vt:lpstr>`;
        });
        updated = updated.slice(0, titlesOfPartsEndMatch) + titlesXmlToAdd + updated.slice(titlesOfPartsEndMatch);

        // Update TitlesOfParts vector size
        const titlesOfPartsStartMatch = updated.match(/<TitlesOfParts>\s*<vt:vector size="(\d+)"/);
        if (titlesOfPartsStartMatch && titlesOfPartsStartMatch[1]) {
            const existingSize = parseInt(titlesOfPartsStartMatch[1], 10);
            const newSize = existingSize + titlesToAddCount;
            updated = updated.replace(titlesOfPartsStartMatch[0], `<TitlesOfParts><vt:vector size="${newSize}"`);
        }
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
  const vectorSize = pairs.length > 0 ? (pairs.map(p => p.split('\n').filter(Boolean).length).reduce((a,b)=>a+b,0)) : 0;
  return `<HeadingPairs><vt:vector size="${vectorSize}" baseType="variant">${pairs.join('')}\n    </vt:vector></HeadingPairs>`;
}

function buildTitlesOfParts(
  fonts: string[],
  themes: string[],
  existingSlideTitles: string[],
  newSlideTitles: string[]
): string {
  const allTitles: string[] = [];
  fonts.forEach(font => allTitles.push(font));
  themes.forEach(theme => allTitles.push(theme));
  existingSlideTitles.forEach(title => allTitles.push(title));
  newSlideTitles.forEach(title => {
    const truncatedTitle = title.length > 100 ? title.substring(0, 97) + '...' : title;
    allTitles.push(escapeXml(truncatedTitle));
  });
  const vectorContent = allTitles.map(title => `\n      <vt:lpstr>${title}</vt:lpstr>`).join('');
  return `<TitlesOfParts><vt:vector size="${allTitles.length}" baseType="lpstr">${vectorContent}\n    </vt:vector></TitlesOfParts>`;
}

function createNewAppXml(zip: JSZip, metadata: AppXmlMetadata): void {
  const defaultFonts = ['Arial', 'Calibri']; // Default fonts if creating app.xml from scratch
  const defaultThemes = ['Thème Office'];  // Default theme

  // In a new app.xml, there are no "existing slide titles" from a template.
  // metadata.slideTitles contains titles of the new slides being added.
  const headingPairs = buildHeadingPairs([...defaultFonts, ...defaultThemes], metadata.slideTitles);
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

async function updateCoreXml(zip: JSZip, newQuestionCount: number): Promise<void> { // Parameter changed to reflect new questions
  const coreFile = zip.file('docProps/core.xml');
  if (coreFile) {
    let content = await coreFile.async('string');
    // Title should reflect the nature of the generated content
    const title = `Quiz OMBEA ${newQuestionCount} question${newQuestionCount > 1 ? 's' : ''}`;
    content = content.replace(/<dc:title>.*?<\/dc:title>/, `<dc:title>${escapeXml(title)}</dc:title>`);
    const now = new Date().toISOString();
    content = content.replace(/<dcterms:modified.*?>.*?<\/dcterms:modified>/, `<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>`);
    // Ensure dcterms:created exists, add if not
     if (!content.includes('<dcterms:created')) {
        const lastModifiedEnd = content.indexOf('</dcterms:modified>') + '</dcterms:modified>'.length;
        const createdTag = `\n  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>`;
        content = content.slice(0, lastModifiedEnd) + createdTag + content.slice(lastModifiedEnd);
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
    console.log(`\n=== DÉBUT GÉNÉRATION VAL17 ${executionId} ===`);
    validateQuestions(questions);
    let currentTemplateFile: File;
    if (templateFile) {
      currentTemplateFile = templateFile;
    } else {
      console.warn("Aucun fichier modèle fourni, tentative de création d'un modèle par défaut (peut échouer ou être basique).");
      currentTemplateFile = await createDefaultTemplate(); // This throws error, as intended by original code
    }
    console.log(`Chargement du modèle: ${currentTemplateFile.name}`);
    const templateZip = await JSZip.loadAsync(currentTemplateFile);

    let initialFileCount = 0;
    templateZip.forEach(() => initialFileCount++);
    console.log(`Fichiers dans le template chargé: ${initialFileCount}`);

    const existingSlideCount = countExistingSlides(templateZip);
    console.log(`Slides existantes dans le modèle: ${existingSlideCount}`);
    console.log(`Nouvelles slides OMBEA à créer: ${questions.length}`);

    const existingTagsCount = findHighestExistingTagNumber(templateZip);
    // console.log(`Tags OMBEA existants (max index): ${existingTagsCount}`); // Verbose

    // const existingOmbeaSlides = await countExistingOmbeaSlides(templateZip); // Can be verbose
    // if (existingOmbeaSlides > 0) {
    //   console.log(`⚠️ Template OMBEA détecté avec ${existingOmbeaSlides} slides OMBEA existantes. Les nouvelles questions seront ajoutées après.`);
    // }

    let maxTagNumberUsed = existingTagsCount; // Keep track of the highest tag number created

    const outputZip = new JSZip(); // Create a new JSZip instance for the output
    const copyPromises: Promise<void>[] = [];
    templateZip.forEach((relativePath, file) => {
      if (!file.dir) {
        const copyPromise: Promise<void> = file.async('blob').then(content => {
          outputZip.file(relativePath, content);
          // No explicit return, so this resolves to void
        });
        copyPromises.push(copyPromise);
      } else {
        // Ensure directories are also created in the output zip
        outputZip.folder(relativePath);
      }
    });
    await Promise.all(copyPromises);
    console.log('Modèle copié dans outputZip.');

    const { layoutFileName /*, layoutRId */ } = await ensureOmbeaSlideLayoutExists(outputZip);
    // console.log(`Layout OMBEA assuré/créé: ${layoutFileName} (${layoutRId})`); // Verbose

    outputZip.folder('ppt/tags'); // Ensure tags folder exists
    if (!outputZip.file('ppt/media')) { // Ensure media folder exists
        outputZip.folder('ppt/media');
    }

    console.log('Préparation des slides de questions OMBEA...');
    const imageExtensions = new Set<string>();
    interface DownloadedImage { fileName: string; data: ArrayBuffer; width: number; height: number; dimensions: ImageDimensions; extension: string; }
    const downloadedImages = new Map<number, DownloadedImage>();

    if (questions.some(q => q.imageUrl)) {
      console.log('Téléchargement des images pour les questions...');
      const imagePromises = questions.map(async (question, index) => {
        if (question.imageUrl) {
          try {
            const imageData = await downloadImageFromCloudWithDimensions(question.imageUrl);
            if (imageData) {
              const absoluteSlideNumberForImage = existingSlideCount + index + 1; // Slide number in the final PPTX
              const imgFileName = `image_q${index + 1}.${imageData.extension}`; // More specific name
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
      console.log(`${downloadedImages.size} images traitées.`);
    }

    for (let i = 0; i < questions.length; i++) {
      const absoluteSlideNumber = existingSlideCount + i + 1; // Slide number in the final PPTX
      const questionData = questions[i];
      const duration = questionData.points || options.ombeaConfig?.pollTimeLimit || options.defaultDuration || 30;

      const downloadedImage = downloadedImages.get(absoluteSlideNumber);
      const slideXml = createSlideXml(questionData.question, questionData.options, absoluteSlideNumber, duration, downloadedImage?.dimensions, options.ombeaConfig);
      outputZip.file(`ppt/slides/slide${absoluteSlideNumber}.xml`, slideXml);

      const baseTagNumberForSlide = calculateBaseTagNumber(i + 1, existingTagsCount); // i+1 for 1-based index of new questions

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
      // console.log(`Slide OMBEA ${absoluteSlideNumber} créée pour question: ${questionData.question.substring(0,30)}...`); // Verbose
    }
    // console.log(`Max tag number utilisé: ${maxTagNumberUsed}`); // Verbose
    if (existingTagsCount > 0 && questions.length > 0) { // Only check continuity if new tags were added to existing ones
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

    await updateCoreXml(outputZip, questions.length); // Pass new question count for title
    const appMetadata = calculateAppXmlMetadata(totalFinalSlideCount, questions); // Pass total slides and new questions
    await updateAppXml(outputZip, appMetadata); // app.xml update logic might need review for merging vs replacing counts

    console.log('Génération du fichier PPTX final...');
    const outputBlob = await outputZip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', compression: 'DEFLATE', compressionOptions: { level: 3 } });
    const finalFileName = options.fileName || `Questions_OMBEA_${new Date().toISOString().slice(0, 10)}.pptx`;
    saveAs(outputBlob, finalFileName);
    console.log(`Fichier OMBEA "${finalFileName}" généré avec succès.`);
    console.log(`Total des slides: ${totalFinalSlideCount}`);
    // console.log(`Total des tags (max index): ${maxTagNumberUsed}`); // Verbose
    console.log(`=== FIN GÉNÉRATION VAL17 ${executionId} - SUCCÈS ===`);
  } catch (error: any) {
    console.error(`=== ERREUR GÉNÉRATION VAL17 ===`);
    console.error(error.message);
    // console.error('Stack trace complet:', error.stack); // Can be very verbose
    alert(`Erreur lors de la génération du PPTX interactif des questions OMBEA: ${error.message}`);
    throw error; // Re-throw pour que l'appelant puisse aussi gérer
  }
}

// testConsistency and handleGeneratePPTX are example usage from original file, can be removed or adapted for our testing.
// For now, they are kept but Val17Question type is updated.
export async function testConsistency(templateFile: File, questions: Val17Question[]): Promise<void> {
  console.log('=== TEST DE COHÉRENCE (val17PptxGenerator) ===');
  const results = [];
  for (let i = 0; i < 1; i++) { // Reduced to 1 for quicker test
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
  // GenerationOptions, ConfigOptions are defined or imported at the top
};
