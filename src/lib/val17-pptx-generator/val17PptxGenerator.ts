import JSZip from 'jszip';
import { saveAs } from 'file-saver';
// import { ConfigOptions, GenerationOptions } from './val17PptxTypes'; // Temporarily commented out

// Placeholder types until we get the actual definitions
export interface ConfigOptions {
  pollStartMode?: string;
  chartValueLabelFormat?: string;
  answersBulletStyle?: string;
  pollTimeLimit?: number;
  pollCountdownStartMode?: string;
  pollMultipleResponse?: string;
  // Add other fields as necessary based on pptxGenerator.ts usage
}

export interface GenerationOptions {
  fileName?: string;
  defaultDuration?: number;
  ombeaConfig?: ConfigOptions;
  // Add other fields as necessary
}


// ========== INTERFACES ==========
// Interface Question for val17PptxGenerator
export interface Val17Question { // Renamed to avoid conflict with our main Question type
  question: string;
  options: string[];
  correctAnswerIndex?: number;
  imageUrl?: string;
}

// GenerationOptions is now imported from ./val17PptxTypes

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
// ========== FONCTIONS UTILITAIRES ==========

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
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ width: 1920, height: 1080 }); // Default on error
    };
    img.src = url;
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
    let finalUrl = url;
    if (url.includes('dropbox.com')) {
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
      console.error(`[IMAGE] Stack: ${error.stack}`);
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
      const insertPoint = updated.indexOf('<Override');
      if (insertPoint > -1) {
        const newDefault = `\n<Default Extension="${ext}" ContentType="${contentType}"/>`;
        updated = updated.slice(0, insertPoint) + newDefault + updated.slice(insertPoint);
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
    const num = parseInt(match.match(/slideLayout(\d+)\.xml/)?.[1] || '0');
    if (num > maxLayoutNum) maxLayoutNum = num;
  });
  const nextLayoutNum = maxLayoutNum + 1;
  const allRIds = extractExistingRIds(masterRelsContent);
  const existingRIds = allRIds.map(m => m.rId);
  let nextRId = getNextAvailableRId(existingRIds);
  console.log(`Prochain layout: slideLayout${nextLayoutNum}, rId: ${nextRId}`);
  console.log(`rIds existants dans slideMaster1.xml.rels:`, existingRIds);
  return { layoutId: nextLayoutNum, layoutFileName: `slideLayout${nextLayoutNum}.xml`, rId: nextRId };
}

async function ensureOmbeaSlideLayoutExists(zip: JSZip): Promise<{ layoutFileName: string, layoutRId: string }> {
  console.log('Création d\'un layout OMBEA dédié...');
  const { layoutId, layoutFileName, rId } = await findNextAvailableSlideLayoutId(zip);
  const slideLayoutContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="tx" preserve="1">
  <p:cSld name="Titre et texte"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="Titre 1"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR" smtClean="0"/><a:t>Modifiez le style du titre</a:t></a:r><a:endParaRPr lang="fr-FR"/></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Espace réservé du texte 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr lvl="0"/><a:r><a:rPr lang="fr-FR" smtClean="0"/><a:t>Modifiez les styles du texte du masque</a:t></a:r></a:p><a:p><a:pPr lvl="1"/><a:r><a:rPr lang="fr-FR" smtClean="0"/><a:t>Deuxième niveau</a:t></a:r></a:p><a:p><a:pPr lvl="2"/><a:r><a:rPr lang="fr-FR" smtClean="0"/><a:t>Troisième niveau</a:t></a:r></a:p><a:p><a:pPr lvl="3"/><a:r><a:rPr lang="fr-FR" smtClean="0"/><a:t>Quatrième niveau</a:t></a:r></a:p><a:p><a:pPr lvl="4"/><a:r><a:rPr lang="fr-FR" smtClean="0"/><a:t>Cinquième niveau</a:t></a:r><a:endParaRPr lang="fr-FR"/></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="4" name="Espace réservé de la date 3"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="dt" sz="half" idx="10"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:fld id="{ABB4FD2C-0372-488A-B992-EB1BD753A34A}" type="datetimeFigureOut"><a:rPr lang="fr-FR" smtClean="0"/><a:t>28/05/2025</a:t></a:fld><a:endParaRPr lang="fr-FR"/></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="5" name="Espace réservé du pied de page 4"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="ftr" sz="quarter" idx="11"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="fr-FR"/></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="6" name="Espace réservé du numéro de diapositive 5"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldNum" sz="quarter" idx="12"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:fld id="{CD42254F-ACD2-467B-9045-5226EEC3B6AB}" type="slidenum"><a:rPr lang="fr-FR" smtClean="0"/><a:t>‹N°›</a:t></a:fld><a:endParaRPr lang="fr-FR"/></a:p></p:txBody></p:sp></p:spTree><p:extLst><p:ext uri="{BB962C8B-B14F-4D97-AF65-F5344CB8AC3E}"><p14:creationId xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" val="${Math.floor(Math.random() * 2147483647) + 1}"/></p:ext></p:extLst></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
  zip.file(`ppt/slideLayouts/${layoutFileName}`, slideLayoutContent);
  const slideLayoutRelsContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`;
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
      if (lastLayoutIndex > -1) {
        const endOfLastLayout = content.indexOf('/>', lastLayoutIndex) + 2;
        const newOverride = `\n  <Override PartName="/ppt/slideLayouts/${layoutFileName}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>`;
        content = content.slice(0, endOfLastLayout) + newOverride + content.slice(endOfLastLayout);
      }
      zip.file('[Content_Types].xml', content);
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
  const baseId = slideNumber * 10;
  const grpId = baseId + 1;
  const titleId = baseId + 2;
  const bodyId = baseId + 3;
  const countdownId = baseId + 4;
  const imageId = baseId + 5;
  let countdownDisplayText = duration;
  if (ombeaConfig?.pollTimeLimit !== undefined) {
    countdownDisplayText = ombeaConfig.pollTimeLimit;
  }
  let bulletTypeForXml = 'arabicPeriod';
  if (ombeaConfig?.answersBulletStyle) {
    switch (ombeaConfig.answersBulletStyle) {
      case 'ppBulletAlphaUCParenRight': bulletTypeForXml = 'alphaUcParenR'; break;
      case 'ppBulletAlphaUCPeriod': bulletTypeForXml = 'alphaUcPeriod'; break;
      case 'ppBulletArabicParenRight': bulletTypeForXml = 'arabicParenR'; break;
      case 'ppBulletArabicPeriod': bulletTypeForXml = 'arabicPeriod'; break;
    }
  }
  const listStyleXml = `
    <a:lstStyle>
      <a:lvl1pPr marL="514350" indent="-514350" algn="l">
        <a:buFontTx/>
        <a:buClrTx/>
        <a:buSzTx/>
        <a:buAutoNum type="${bulletTypeForXml}"/>
      </a:lvl1pPr>
    </a:lstStyle>`;
  let xmlContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
${slideComment}
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="${grpId}" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      <p:sp><p:nvSpPr><p:cNvPr id="${titleId}" name="Titre ${slideNumber}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/><p:custDataLst><p:tags r:id="rId2"/></p:custDataLst></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR" dirty="0"/><a:t>${escapeXml(question)}</a:t></a:r><a:endParaRPr lang="fr-FR" dirty="0"/></a:p></p:txBody></p:sp>`;
  if (imageDimensions) {
    xmlContent += `
      <p:pic><p:nvPicPr><p:cNvPr id="${imageId}" name="Image ${slideNumber}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId6"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${imageDimensions.x}" y="${imageDimensions.y}"/><a:ext cx="${imageDimensions.width}" cy="${imageDimensions.height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
  }
  xmlContent += `
      <p:sp><p:nvSpPr><p:cNvPr id="${bodyId}" name="Espace réservé du texte ${slideNumber}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/><p:custDataLst><p:tags r:id="rId3"/></p:custDataLst></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="1600200"/><a:ext cx="4572000" cy="4525963"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/>${listStyleXml}${options.map(option => `
          <a:p><a:pPr><a:buFont typeface="+mj-lt"/><a:buAutoNum type="${bulletTypeForXml}"/></a:pPr><a:r><a:rPr lang="fr-FR" dirty="0"/><a:t>${escapeXml(option)}</a:t></a:r></a:p>`).join('')}</p:txBody></p:sp>`;
  if (Number(countdownDisplayText) > 0) {
    xmlContent += `
      <p:sp><p:nvSpPr><p:cNvPr id="${countdownId}" name="OMBEA Countdown ${slideNumber}"/><p:cNvSpPr txBox="1"/><p:nvPr><p:custDataLst><p:tags r:id="rId4"/></p:custDataLst></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="317500" y="5715000"/><a:ext cx="1524000" cy="769441"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr vert="horz" rtlCol="0" anchor="ctr" anchorCtr="1"><a:spAutoFit/></a:bodyPr><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR" sz="4400" smtClean="0"/><a:t>${String(countdownDisplayText)}</a:t></a:r><a:endParaRPr lang="fr-FR" sz="4400"/></a:p></p:txBody></p:sp>`;
  }
  xmlContent += `
    </p:spTree><p:custDataLst><p:tags r:id="rId1"/></p:custDataLst><p:extLst><p:ext uri="{BB962C8B-B14F-4D97-AF65-F5344CB8AC3E}"><p14:creationId xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" val="${Math.floor(Math.random() * 2147483647) + 1}"/></p:ext></p:extLst></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr><p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"/></p:par></p:tnLst></p:timing></p:sld>`;
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
        const tagNum = parseInt(match[1]);
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
  questionIndex: number,
  options: string[],
  correctAnswerIndex: number | undefined,
  duration: number,
  ombeaConfig?: ConfigOptions,
  tagOffset: number = 0
): TagInfo[] {
  const baseTagNumber = calculateBaseTagNumber(questionIndex, tagOffset);
  const slideGuid = generateGUID();
  let points = '';
  if (correctAnswerIndex !== undefined) {
    points = options.map((_, index) => index === correctAnswerIndex ? "1.00" : "0.00").join(',');
  } else {
    points = options.map(() => "0.00").join(',');
  }
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
      const num = parseInt(match[1]);
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
  const slideMasterRId = 'rId1';
  let newContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="${slideMasterRId}"/></p:sldMasterIdLst><p:sldIdLst>`;
  for (let i = 1; i <= existingSlideCount; i++) {
    newContent += `\n    <p:sldId id="${255 + i}" r:id="rId${i + 1}"/>`;
  }
  slideRIdMappings.forEach(mapping => {
    const slideId = 255 + mapping.slideNumber;
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
  newSlideCount: number,
  existingSlideCount: number
): { updatedContent: string; slideRIdMappings: { slideNumber: number; rId: string }[] } {
  const existingMappings = extractExistingRIds(originalContent);
  const slideMasterRel = existingMappings.find(m => m.type.includes('slideMaster'));
  const slideRelations = existingMappings.filter(m => m.type.includes('/slide') && !m.type.includes('slideMaster'));
  const presPropsRel = existingMappings.find(m => m.type.includes('presProps'));
  const viewPropsRel = existingMappings.find(m => m.type.includes('viewProps'));
  const themeRel = existingMappings.find(m => m.type.includes('theme'));
  const tableStylesRel = existingMappings.find(m => m.type.includes('tableStyles'));
  let newContent = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
  const slideRIdMappings: { slideNumber: number; rId: string }[] = [];
  if (slideMasterRel) {
    newContent += `<Relationship Id="rId1" Type="${slideMasterRel.type}" Target="${slideMasterRel.target}"/>`;
  }
  let slideRIdCounter = 2;
  slideRelations.forEach((rel) => {
    newContent += `<Relationship Id="rId${slideRIdCounter}" Type="${rel.type}" Target="${rel.target}"/>`;
    slideRIdCounter++;
  });
  for (let i = 1; i <= newSlideCount; i++) {
    const slideNumber = existingSlideCount + i;
    const rId = `rId${slideRIdCounter}`;
    slideRIdMappings.push({ slideNumber: slideNumber, rId: rId });
    newContent += `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${slideNumber}.xml"/>`;
    slideRIdCounter++;
  }
  let nextRId = slideRIdCounter;
  if (presPropsRel) { newContent += `<Relationship Id="rId${nextRId}" Type="${presPropsRel.type}" Target="${presPropsRel.target}"/>`; nextRId++; }
  if (viewPropsRel) { newContent += `<Relationship Id="rId${nextRId}" Type="${viewPropsRel.type}" Target="${viewPropsRel.target}"/>`; nextRId++; }
  if (themeRel) { newContent += `<Relationship Id="rId${nextRId}" Type="${themeRel.type}" Target="${themeRel.target}"/>`; nextRId++; }
  if (tableStylesRel) { newContent += `<Relationship Id="rId${nextRId}" Type="${tableStylesRel.type}" Target="${tableStylesRel.target}"/>`; nextRId++; }
  newContent += '</Relationships>';
  console.log('Nouvelle organisation des rId :');
  console.log('- slideMaster : rId1');
  console.log(`- slides : rId2 à rId${slideRIdCounter - 1}`);
  return { updatedContent: newContent, slideRIdMappings };
}

function updateContentTypesComplete(
  originalContent: string,
  newSlideCount: number,
  existingSlideCount: number,
  layoutFileName: string,
  totalTags: number
): string {
  let updatedContent = originalContent;
  if (!updatedContent.includes(layoutFileName)) {
    const layoutInsertRegex = /(<Override[^>]*slideLayout\d+\.xml"[^>]*\/>)/g;
    const matches = Array.from(updatedContent.matchAll(layoutInsertRegex));
    if (matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      const insertPoint = lastMatch.index! + lastMatch[0].length;
      const newOverride = `\n  <Override PartName="/ppt/slideLayouts/${layoutFileName}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>`;
      updatedContent = updatedContent.slice(0, insertPoint) + newOverride + updatedContent.slice(insertPoint);
    }
  }
  let newOverrides = '';
  for (let i = existingSlideCount + 1; i <= existingSlideCount + newSlideCount; i++) {
    if (!updatedContent.includes(`slide${i}.xml`)) {
      newOverrides += `\n  <Override PartName="/ppt/slides/slide${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
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
  existingSlideCount: number,
  questions: Val17Question[] // Changed to Val17Question
): AppXmlMetadata {
  let totalWords = 0;
  let totalParagraphs = 0;
  const slideTitles: string[] = [];
  questions.forEach(q => {
    const questionWords = q.question.trim().split(/\s+/).filter(word => word.length > 0).length;
    totalWords += questionWords + 2 + 1;
    totalParagraphs += 4;
    slideTitles.push(q.question);
  });
  return { totalSlides: existingSlideCount + questions.length, totalWords, totalParagraphs, slideTitles };
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
  content = updateHeadingPairsAndTitles(content, metadata);
  zip.file('docProps/app.xml', content);
}

function updateSimpleFields(content: string, metadata: AppXmlMetadata): string {
  let updated = content;
  updated = updated.replace(/<Slides>\d+<\/Slides>/, `<Slides>${metadata.totalSlides}</Slides>`);
  updated = updated.replace(/<Words>\d+<\/Words>/, `<Words>${metadata.totalWords}</Words>`);
  updated = updated.replace(/<Paragraphs>\d+<\/Paragraphs>/, `<Paragraphs>${metadata.totalParagraphs}</Paragraphs>`);
  if (!updated.includes('<TotalTime>')) {
    const propertiesEnd = updated.indexOf('</Properties>');
    const totalTimeTag = '\n  <TotalTime>2</TotalTime>';
    updated = updated.slice(0, propertiesEnd) + totalTimeTag + '\n' + updated.slice(propertiesEnd);
  }
  if (!updated.includes('<Company')) {
    const insertPoint = updated.indexOf('</TitlesOfParts>');
    if (insertPoint > -1) {
      const companyTag = '\n  <Company/>';
      updated = updated.slice(0, insertPoint + '</TitlesOfParts>'.length) + companyTag + updated.slice(insertPoint + '</TitlesOfParts>'.length);
    }
  }
  return updated;
}

function updateHeadingPairsAndTitles(content: string, metadata: AppXmlMetadata): string {
  let updated = content;
  const allExistingTitles: string[] = [];
  const titlesMatch = content.match(/<TitlesOfParts>[\s\S]*?<\/TitlesOfParts>/);
  if (titlesMatch) {
    const titlesContent = titlesMatch[0];
    const titleRegex = /<vt:lpstr>([^<]+)<\/vt:lpstr>/g;
    let match;
    while ((match = titleRegex.exec(titlesContent)) !== null) {
      allExistingTitles.push(match[1]);
    }
  }
  const fonts: string[] = [];
  const themes: string[] = [];
  const existingSlideTitles: string[] = [];
  allExistingTitles.forEach(title => {
    if (title === 'Arial' || title === 'Calibri') fonts.push(title);
    else if (title === 'Thème Office' || title === 'Office Theme') themes.push(title);
    else if (title !== '' && !metadata.slideTitles.includes(title)) existingSlideTitles.push(title);
  });
  const nonSlideTitles = [...fonts, ...themes];
  const allSlideTitles = [...existingSlideTitles, ...metadata.slideTitles];
  console.log('Fonts trouvées:', fonts);
  console.log('Thèmes trouvés:', themes);
  console.log('Titres slides existantes:', existingSlideTitles);
  console.log('Nouveaux titres:', metadata.slideTitles);
  console.log('Total titres slides:', allSlideTitles.length);
  const headingPairs = buildHeadingPairs(nonSlideTitles, allSlideTitles);
  const titlesOfParts = buildTitlesOfParts(fonts, themes, existingSlideTitles, metadata.slideTitles);
  const headingPairsRegex = /<HeadingPairs>[\s\S]*?<\/HeadingPairs>/;
  if (headingPairsRegex.test(updated)) updated = updated.replace(headingPairsRegex, headingPairs);
  const titlesOfPartsRegex = /<TitlesOfParts>[\s\S]*?<\/TitlesOfParts>/;
  if (titlesOfPartsRegex.test(updated)) updated = updated.replace(titlesOfPartsRegex, titlesOfParts);
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
  const vectorSize = pairs.length * 2; // This was pairs.length * 2, but pairs are already doubled. It should be pairs.length / 2 for the count of "name" elements.
                                      // However, the original code multiplies by 2, let's stick to it if it worked.
                                      // The vector size is the total number of <vt:variant> elements.
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
  const defaultFonts = ['Arial', 'Calibri'];
  const defaultThemes = ['Thème Office'];
  const existingSlideTitles: string[] = [];
  const nonSlideTitles = [...defaultFonts, ...defaultThemes];
  const headingPairs = buildHeadingPairs(nonSlideTitles, metadata.slideTitles);
  const titlesOfParts = buildTitlesOfParts(defaultFonts, defaultThemes, existingSlideTitles, metadata.slideTitles);
  const appXmlContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <TotalTime>2</TotalTime><Words>${metadata.totalWords}</Words><Application>Microsoft Office PowerPoint</Application>
  <PresentationFormat>Affichage à l'écran (4:3)</PresentationFormat><Paragraphs>${metadata.totalParagraphs}</Paragraphs>
  <Slides>${metadata.totalSlides}</Slides><Notes>0</Notes><HiddenSlides>0</HiddenSlides><MMClips>0</MMClips>
  <ScaleCrop>false</ScaleCrop>${headingPairs}${titlesOfParts}<Company/><LinksUpToDate>false</LinksUpToDate>
  <SharedDoc>false</SharedDoc><HyperlinksChanged>false</HyperlinksChanged><AppVersion>14.0000</AppVersion></Properties>`;
  zip.file('docProps/app.xml', appXmlContent);
}

async function updateCoreXml(zip: JSZip, slideCount: number): Promise<void> {
  const coreFile = zip.file('docProps/core.xml');
  if (coreFile) {
    let content = await coreFile.async('string');
    const title = `Quiz OMBEA ${slideCount} question${slideCount > 1 ? 's' : ''}`;
    content = content.replace(/<dc:title>.*?<\/dc:title>/, `<dc:title>${escapeXml(title)}</dc:title>`);
    const now = new Date().toISOString();
    content = content.replace(/<dcterms:modified.*?>.*?<\/dcterms:modified>/, `<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>`);
    zip.file('docProps/core.xml', content);
  }
}

export async function generatePPTXVal17( // Renamed to avoid conflict if we have another generatePPTX
  templateFile: File | null,
  questions: Val17Question[], // Changed to Val17Question
  options: GenerationOptions = {}
): Promise<void> {
  try {
    const executionId = Date.now();
    console.log(`\n=== DÉBUT GÉNÉRATION ${executionId} ===`);
    validateQuestions(questions);
    let template: File;
    if (templateFile) {
      template = templateFile;
    } else {
      template = await createDefaultTemplate();
    }
    console.log('Chargement du modèle...');
    const templateZip = await JSZip.loadAsync(template);
    let fileCount = 0;
    templateZip.forEach(() => fileCount++);
    console.log(`Fichiers dans le template: ${fileCount}`);
    const existingSlideCount = countExistingSlides(templateZip);
    console.log(`Slides existantes dans le modèle: ${existingSlideCount}`);
    console.log(`Nouvelles slides à créer: ${questions.length}`);
    const existingTagsCount = findHighestExistingTagNumber(templateZip);
    console.log(`Tags OMBEA existants: ${existingTagsCount}`);
    const existingOmbeaSlides = await countExistingOmbeaSlides(templateZip);
    if (existingOmbeaSlides > 0) {
      console.log(`⚠️ Template OMBEA détecté avec ${existingOmbeaSlides} slides OMBEA existantes`);
      console.log(`Les nouvelles questions seront ajoutées après les slides existantes`);
    }
    let totalTagsCreated = 0;
    const outputZip = new JSZip();
    const copyPromises: Promise<void>[] = [];
    templateZip.forEach((relativePath, file) => {
      if (!file.dir) {
        const promise = file.async('blob').then(content => outputZip.file(relativePath, content));
        copyPromises.push(promise);
      }
    });
    await Promise.all(copyPromises);
    console.log('Modèle copié');
    const { layoutFileName, layoutRId } = await ensureOmbeaSlideLayoutExists(outputZip);
    console.log(`Layout OMBEA: ${layoutFileName} (${layoutRId})`);
    outputZip.folder('ppt/tags');
    if (!outputZip.folder('ppt/media')) {
      outputZip.folder('ppt/media');
    }
    console.log('Création des nouvelles slides OMBEA...');
    const imageExtensions = new Set<string>();
    interface DownloadedImage { fileName: string; data: ArrayBuffer; width: number; height: number; dimensions: ImageDimensions; extension: string; }
    const downloadedImages = new Map<number, DownloadedImage>();

    if (questions.some(q => q.imageUrl)) {
      console.log('Téléchargement des images depuis le cloud...');
      const imagePromises = questions.map(async (question, index) => {
        if (question.imageUrl) {
          try {
            const imageData = await downloadImageFromCloudWithDimensions(question.imageUrl);
            if (imageData) {
              const slideNumber = existingSlideCount + index + 1;
              const fileName = `image${slideNumber}.${imageData.extension}`;
              const dimensions = calculateImageDimensions(imageData.width, imageData.height);
              console.log(`[IMAGE] Dimensions calculées: x=${dimensions.x}, y=${dimensions.y}, w=${dimensions.width}, h=${dimensions.height}`);
              return { slideNumber, image: { fileName, data: imageData.data, width: imageData.width, height: imageData.height, dimensions, extension: imageData.extension } };
            }
          } catch (error) { console.error(`Erreur téléchargement image pour question ${index + 1}:`, error); }
        }
        return null;
      });
      const imageResults = await Promise.all(imagePromises);
      imageResults.forEach(result => {
        if (result) {
          downloadedImages.set(result.slideNumber, result.image);
          imageExtensions.add(result.image.extension);
          let mediaFolder = outputZip.folder('ppt/media');
          if (!mediaFolder) mediaFolder = outputZip.folder('ppt')!.folder('media')!;
          console.log(`[ZIP] Ajout de l'image: ${result.image.fileName}`);
          mediaFolder.file(result.image.fileName, result.image.data);
          const addedFile = outputZip.file(`ppt/media/${result.image.fileName}`);
          if (addedFile) console.log(`[ZIP] ✓ Image ajoutée avec succès: ppt/media/${result.image.fileName}`);
          else console.error(`[ZIP] ✗ Échec ajout image: ppt/media/${result.image.fileName}`);
        }
      });
      console.log(`${downloadedImages.size} images téléchargées avec succès`);
    }

    for (let i = 0; i < questions.length; i++) {
      const slideNumber = existingSlideCount + i + 1;
      const question = questions[i];
      const duration = options.ombeaConfig?.pollTimeLimit || options.defaultDuration || 30;
      const questionIndex = i + 1; // For tag calculation, 1-based for new questions
      const downloadedImage = downloadedImages.get(slideNumber);
      const hasImage = !!downloadedImage;
      const slideXml = createSlideXml(question.question, question.options, slideNumber, duration, hasImage ? downloadedImage!.dimensions : undefined, options.ombeaConfig);
      outputZip.file(`ppt/slides/slide${slideNumber}.xml`, slideXml);
      const baseTagNumber = calculateBaseTagNumber(questionIndex, existingTagsCount);
      let slideRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags" Target="../tags/tag${baseTagNumber}.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags" Target="../tags/tag${baseTagNumber + 1}.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags" Target="../tags/tag${baseTagNumber + 2}.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags" Target="../tags/tag${baseTagNumber + 3}.xml"/><Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/${layoutFileName}"/>`;
      if (hasImage && downloadedImage) {
        slideRelsXml += `\n  <Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${downloadedImage.fileName}"/>`;
      }
      slideRelsXml += `\n</Relationships>`;
      outputZip.file(`ppt/slides/_rels/slide${slideNumber}.xml.rels`, slideRelsXml);
      const tags = createSlideTagFiles(questionIndex, question.options, question.correctAnswerIndex, duration, options.ombeaConfig, existingTagsCount);
      tags.forEach(tag => { outputZip.file(`ppt/tags/${tag.fileName}`, tag.content); totalTagsCreated = tag.tagNumber; });
      const imageStatus = hasImage ? ' (avec image cloud)' : '';
      const optionsInfo = question.correctAnswerIndex !== undefined ? ` (${question.options.length} options, réponse: ${question.correctAnswerIndex + 1})` : ` (${question.options.length} options, sondage)`;
      console.log(`Slide OMBEA ${slideNumber} créée${imageStatus}${optionsInfo}: ${question.question.substring(0, 50)}...`);
    }
    console.log(`Total des tags créés: ${totalTagsCreated}`);
    if (existingTagsCount > 0) {
      const warnings = ensureTagContinuity(outputZip, 1, totalTagsCreated);
      if (warnings.length > 0) console.warn('⚠️ Problèmes de continuité détectés:', warnings);
    }
    if (!outputZip.folder('ppt/media')) { outputZip.folder('ppt/media'); }

    const contentTypesFile = outputZip.file('[Content_Types].xml');
    if (contentTypesFile) {
      let contentTypesContent = await contentTypesFile.async('string');
      if (imageExtensions.size > 0) contentTypesContent = updateContentTypesForImages(contentTypesContent, imageExtensions);
      contentTypesContent = updateContentTypesComplete(contentTypesContent, questions.length, existingSlideCount, layoutFileName, totalTagsCreated);
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
    const appMetadata = calculateAppXmlMetadata(existingSlideCount, questions);
    await updateAppXml(outputZip, appMetadata);
    console.log('Génération du fichier final...');
    const outputBlob = await outputZip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', compression: 'DEFLATE', compressionOptions: { level: 3 } });
    const fileName = options.fileName || `Questions_OMBEA_${new Date().toISOString().slice(0, 10)}.pptx`;
    saveAs(outputBlob, fileName);
    console.log(`Fichier OMBEA généré avec succès: ${fileName}`);
    console.log(`Total des slides: ${existingSlideCount + questions.length}`);
    console.log(`Total des tags: ${totalTagsCreated}`);
    console.log(`=== FIN GÉNÉRATION ${executionId} - SUCCÈS ===`);
  } catch (error: any) {
    console.error(`=== ERREUR GÉNÉRATION ===`);
    console.error('Stack trace complet:', error.stack);
    throw error;
  }
}

export async function testConsistency(templateFile: File, questions: Val17Question[]): Promise<void> { // Changed to Val17Question
  console.log('=== TEST DE COHÉRENCE ===');
  const results = [];
  for (let i = 0; i < 5; i++) {
    console.log(`\nTest ${i + 1}/5...`);
    try {
      const templateCopy = new File([await templateFile.arrayBuffer()], templateFile.name, { type: templateFile.type });
      await generatePPTXVal17(templateCopy, questions, { fileName: `Test_${i + 1}.pptx` }); // Renamed call
      results.push('SUCCÈS');
    } catch (error) { results.push('ÉCHEC: '); }
  }
  console.log('\n=== RÉSULTATS ===');
  results.forEach((result, i) => console.log(`Test ${i + 1}: ${result}`));
}

export const handleGeneratePPTX = async (templateFile: File, questions: Val17Question[]) => { // Changed to Val17Question
  try {
    await generatePPTXVal17(templateFile, questions, { fileName: 'Quiz_OMBEA_Interactif.pptx' }); // Renamed call
  } catch (error: any) {
    console.error('Erreur:', error);
    alert(`Erreur lors de la génération: ${error.message}`);
  }
};

// ========== EXPORTS ==========
// Removed Question from here as it's defined locally as Val17Question
export type {
  // GenerationOptions is imported
  TagInfo,
  RIdMapping,
  AppXmlMetadata
};
