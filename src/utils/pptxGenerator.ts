import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// ========== INTERFACES ==========
interface Question {
  question: string;
  correctAnswer?: boolean;
  duration?: number;
}

interface GenerationOptions {
  fileName?: string;
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

// ========== FONCTIONS UTILITAIRES ==========

// Fonction pour générer un GUID unique (format UUID v4)
function generateGUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16).toUpperCase();
  });
}

// Fonction utilitaire pour échapper le XML
function escapeXml(unsafe: string): string {
  if (!unsafe) return ''; // Gérer les chaînes vides ou null

  // Supprimer les caractères de contrôle interdits en XML 1.0 (sauf \n, \r, \t)
  let cleaned = unsafe.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

  // Journaliser si des caractères suspects sont trouvés
  if (/[:\-]|\-\-/.test(cleaned)) {
    console.warn(`Caractères suspects détectés dans la chaîne: ${cleaned}`);
  }

  // Échapper les caractères réservés XML
  return cleaned
    .replace(/&/g, '&amp;')  // Important : d'abord &
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/:/g, '&#58;') // facultatif si ":" pose souci dans du contenu textuel
    .replace(/--/g, '—');   // remplacer les doubles tirets
}

// Compte le nombre de slides existantes dans le modèle
function countExistingSlides(zip: JSZip): number {
  let count = 0;
  zip.folder('ppt/slides')?.forEach((relativePath) => {
    if (relativePath.match(/^slide\d+\.xml$/) && !relativePath.includes('_rels')) {
      count++;
    }
  });
  return count;
}

// Validation des données d'entrée
function validateQuestions(questions: Question[]): void {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('Au moins une question est requise');
  }
  
  questions.forEach((question, index) => {
    if (!question.question || typeof question.question !== 'string' || question.question.trim() === '') {
      throw new Error(`Question ${index + 1}: Le texte de la question est requis`);
    }
    
    if (question.duration && (typeof question.duration !== 'number' || question.duration <= 0)) {
      throw new Error(`Question ${index + 1}: La durée doit être un nombre positif`);
    }
  });
}

// ========== GESTION DES LAYOUTS ==========

// Trouve le prochain slideLayout disponible après les existants
// Remplacer la fonction findNextAvailableSlideLayoutId :

async function findNextAvailableSlideLayoutId(zip: JSZip): Promise<{ layoutId: number, layoutFileName: string, rId: string }> {
  const masterRelsFile = zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels');
  if (!masterRelsFile) {
    throw new Error('slideMaster1.xml.rels non trouvé');
  }
  
  const masterRelsContent = await masterRelsFile.async('string');
  
  // Trouver tous les slideLayouts existants
  const layoutMatches = masterRelsContent.match(/slideLayout(\d+)\.xml/g) || [];
  let maxLayoutNum = 0;
  
  layoutMatches.forEach(match => {
    const num = parseInt(match.match(/slideLayout(\d+)\.xml/)?.[1] || '0');
    if (num > maxLayoutNum) maxLayoutNum = num;
  });
  
  // Le prochain layout sera maxLayoutNum + 1
  const nextLayoutNum = maxLayoutNum + 1;
  
  // IMPORTANT : Extraire TOUS les rId existants
  const allRIds = extractExistingRIds(masterRelsContent);
  const existingRIds = allRIds.map(m => m.rId);
  
  // Trouver le prochain rId disponible
  let nextRId = getNextAvailableRId(existingRIds);
  
  // SUPPRESSION de la protection rId12 - laisser PowerPoint gérer naturellement
  // Les slideLayout doivent utiliser leur rId correspondant quand possible
  
  console.log(`Prochain layout: slideLayout${nextLayoutNum}, rId: ${nextRId}`);
  console.log(`rIds existants dans slideMaster1.xml.rels:`, existingRIds);
  
  return {
    layoutId: nextLayoutNum,
    layoutFileName: `slideLayout${nextLayoutNum}.xml`,
    rId: nextRId
  };
}
// ========== GESTION DES LAYOUTS (SUITE) ==========

// Créer ou vérifier l'existence d'un slideLayout OMBEA
async function ensureOmbeaSlideLayoutExists(zip: JSZip): Promise<{ layoutFileName: string, layoutRId: string }> {
  // CHANGEMENT : Au lieu de chercher un layout existant (qui pourrait être le mauvais),
  // on va toujours créer un nouveau layout OMBEA pour être sûr qu'il soit compatible
  
  console.log('Création d\'un layout OMBEA dédié...');
  const { layoutId, layoutFileName, rId } = await findNextAvailableSlideLayoutId(zip);
  
  // Contenu du slideLayout OMBEA avec la structure spécifique pour les questions
  const slideLayoutContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="tx" preserve="1">
  <p:cSld name="Titre et texte">
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Titre 1"/>
          <p:cNvSpPr>
            <a:spLocks noGrp="1"/>
          </p:cNvSpPr>
          <p:nvPr>
            <p:ph type="title"/>
          </p:nvPr>
        </p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="fr-FR" smtClean="0"/>
              <a:t>Modifiez le style du titre</a:t>
            </a:r>
            <a:endParaRPr lang="fr-FR"/>
          </a:p>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="3" name="Espace réservé du texte 2"/>
          <p:cNvSpPr>
            <a:spLocks noGrp="1"/>
          </p:cNvSpPr>
          <p:nvPr>
            <p:ph type="body" idx="1"/>
          </p:nvPr>
        </p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:pPr lvl="0"/>
            <a:r>
              <a:rPr lang="fr-FR" smtClean="0"/>
              <a:t>Modifiez les styles du texte du masque</a:t>
            </a:r>
          </a:p>
          <a:p>
            <a:pPr lvl="1"/>
            <a:r>
              <a:rPr lang="fr-FR" smtClean="0"/>
              <a:t>Deuxième niveau</a:t>
            </a:r>
          </a:p>
          <a:p>
            <a:pPr lvl="2"/>
            <a:r>
              <a:rPr lang="fr-FR" smtClean="0"/>
              <a:t>Troisième niveau</a:t>
            </a:r>
          </a:p>
          <a:p>
            <a:pPr lvl="3"/>
            <a:r>
              <a:rPr lang="fr-FR" smtClean="0"/>
              <a:t>Quatrième niveau</a:t>
            </a:r>
          </a:p>
          <a:p>
            <a:pPr lvl="4"/>
            <a:r>
              <a:rPr lang="fr-FR" smtClean="0"/>
              <a:t>Cinquième niveau</a:t>
            </a:r>
            <a:endParaRPr lang="fr-FR"/>
          </a:p>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="4" name="Espace réservé de la date 3"/>
          <p:cNvSpPr>
            <a:spLocks noGrp="1"/>
          </p:cNvSpPr>
          <p:nvPr>
            <p:ph type="dt" sz="half" idx="10"/>
          </p:nvPr>
        </p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:fld id="{ABB4FD2C-0372-488A-B992-EB1BD753A34A}" type="datetimeFigureOut">
              <a:rPr lang="fr-FR" smtClean="0"/>
              <a:t>28/05/2025</a:t>
            </a:fld>
            <a:endParaRPr lang="fr-FR"/>
          </a:p>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="5" name="Espace réservé du pied de page 4"/>
          <p:cNvSpPr>
            <a:spLocks noGrp="1"/>
          </p:cNvSpPr>
          <p:nvPr>
            <p:ph type="ftr" sz="quarter" idx="11"/>
          </p:nvPr>
        </p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:endParaRPr lang="fr-FR"/>
          </a:p>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="6" name="Espace réservé du numéro de diapositive 5"/>
          <p:cNvSpPr>
            <a:spLocks noGrp="1"/>
          </p:cNvSpPr>
          <p:nvPr>
            <p:ph type="sldNum" sz="quarter" idx="12"/>
          </p:nvPr>
        </p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:fld id="{CD42254F-ACD2-467B-9045-5226EEC3B6AB}" type="slidenum">
              <a:rPr lang="fr-FR" smtClean="0"/>
              <a:t>‹N°›</a:t>
            </a:fld>
            <a:endParaRPr lang="fr-FR"/>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
    <p:extLst>
      <p:ext uri="{BB962C8B-B14F-4D97-AF65-F5344CB8AC3E}">
        <p14:creationId xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" val="2131546393"/>
      </p:ext>
    </p:extLst>
  </p:cSld>
  <p:clrMapOvr>
    <a:masterClrMapping/>
  </p:clrMapOvr>
</p:sldLayout>`;
  
  // Créer le fichier slideLayout
  zip.file(`ppt/slideLayouts/${layoutFileName}`, slideLayoutContent);
  
  // Créer le fichier .rels correspondant
  const slideLayoutRelsContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`;
  
  zip.file(`ppt/slideLayouts/_rels/${layoutFileName}.rels`, slideLayoutRelsContent);
  
  // Mettre à jour slideMaster1.xml.rels
  await updateSlideMasterRelsForNewLayout(zip, layoutFileName, rId);
  
  // Mettre à jour slideMaster1.xml
  await updateSlideMasterForNewLayout(zip, layoutId, rId);
  
  // Mettre à jour [Content_Types].xml
  await updateContentTypesForNewLayout(zip, layoutFileName);
  
  console.log(`Layout OMBEA créé : ${layoutFileName} avec ${rId}`);
  
  return {
    layoutFileName: layoutFileName,
    layoutRId: rId
  };
}

// Mettre à jour slideMaster1.xml.rels pour le nouveau layout
async function updateSlideMasterRelsForNewLayout(zip: JSZip, layoutFileName: string, rId: string): Promise<void> {
  const masterRelsFile = zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels');
  if (masterRelsFile) {
    let content = await masterRelsFile.async('string');
    
    // Ajouter la nouvelle relation avant </Relationships>
    const insertPoint = content.lastIndexOf('</Relationships>');
    const newRel = `\n  <Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/${layoutFileName}"/>`;
    content = content.slice(0, insertPoint) + newRel + '\n' + content.slice(insertPoint);
    
    zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', content);
  }
}

// Mettre à jour slideMaster1.xml pour le nouveau layout
async function updateSlideMasterForNewLayout(zip: JSZip, layoutId: number, rId: string): Promise<void> {
  const masterFile = zip.file('ppt/slideMasters/slideMaster1.xml');
  if (masterFile) {
    let content = await masterFile.async('string');
    
    // Trouver la section sldLayoutIdLst
    const layoutIdLstEnd = content.indexOf('</p:sldLayoutIdLst>');
    if (layoutIdLstEnd > -1) {
      // Générer un ID unique pour le layout (commencer à 2147483649)
      const layoutIdValue = 2147483648 + layoutId;
      
      const newLayoutId = `\n    <p:sldLayoutId id="${layoutIdValue}" r:id="${rId}"/>`;
      content = content.slice(0, layoutIdLstEnd) + newLayoutId + '\n  ' + content.slice(layoutIdLstEnd);
      
      zip.file('ppt/slideMasters/slideMaster1.xml', content);
    }
  }
}
// Mettre à jour [Content_Types].xml pour le nouveau layout
async function updateContentTypesForNewLayout(zip: JSZip, layoutFileName: string): Promise<void> {
  const contentTypesFile = zip.file('[Content_Types].xml');
  if (contentTypesFile) {
    let content = await contentTypesFile.async('string');
    
    // Vérifier si le layout est déjà dans Content_Types
    if (!content.includes(layoutFileName)) {
      // Trouver un bon endroit pour insérer (après les autres layouts)
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

// ========== CRÉATION DES SLIDES ==========

// Génère le XML d'une nouvelle slide OMBEA
function createSlideXml(question: string, slideNumber: number, duration: number = 30): string {
  // Calculer des IDs uniques basés sur le numéro de slide
  // Pour éviter les conflits, on utilise slideNumber * 10 + position
  const baseId = slideNumber * 10;
  const grpId = baseId + 1;
  const titleId = baseId + 2;
  const bodyId = baseId + 3;
  const countdownId = baseId + 4;
  
  // Utiliser slideNumber pour le commentaire
  const slideComment = `<!-- Slide ${slideNumber} -->`;
  
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
${slideComment}
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="${grpId}" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="${titleId}" name="Titre ${slideNumber}"/>
          <p:cNvSpPr>
            <a:spLocks noGrp="1"/>
          </p:cNvSpPr>
          <p:nvPr>
            <p:ph type="title"/>
          </p:nvPr>
        </p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="fr-FR" dirty="0" smtClean="0"/>
              <a:t>${escapeXml(question)}</a:t>
            </a:r>
            <a:endParaRPr lang="fr-FR" dirty="0"/>
          </a:p>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="${bodyId}" name="Espace réservé du texte ${slideNumber}"/>
          <p:cNvSpPr>
            <a:spLocks noGrp="1"/>
          </p:cNvSpPr>
          <p:nvPr>
            <p:ph type="body" idx="1"/>
            <p:custDataLst>
              <p:tags r:id="rId3"/>
            </p:custDataLst>
          </p:nvPr>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="457200" y="1600200"/>
            <a:ext cx="4572000" cy="4525963"/>
          </a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:pPr marL="514350" indent="-514350">
              <a:buAutoNum type="arabicPeriod"/>
            </a:pPr>
            <a:r>
              <a:rPr lang="fr-FR" dirty="0" smtClean="0"/>
              <a:t>Vrai</a:t>
            </a:r>
          </a:p>
          <a:p>
            <a:pPr marL="514350" indent="-514350">
              <a:buAutoNum type="arabicPeriod"/>
            </a:pPr>
            <a:r>
              <a:rPr lang="fr-FR" dirty="0" smtClean="0"/>
              <a:t>Faux</a:t>
            </a:r>
            <a:endParaRPr lang="fr-FR" dirty="0"/>
          </a:p>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="${countdownId}" name="OMBEA Countdown ${slideNumber}"/>
          <p:cNvSpPr txBox="1"/>
          <p:nvPr>
            <p:custDataLst>
              <p:tags r:id="rId4"/>
            </p:custDataLst>
          </p:nvPr>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="317500" y="5715000"/>
            <a:ext cx="1524000" cy="769441"/>
          </a:xfrm>
          <a:prstGeom prst="rect">
            <a:avLst/>
          </a:prstGeom>
          <a:noFill/>
        </p:spPr>
        <p:txBody>
          <a:bodyPr vert="horz" rtlCol="0" anchor="ctr" anchorCtr="1">
            <a:spAutoFit/>
          </a:bodyPr>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="fr-FR" sz="4400" smtClean="0"/>
              <a:t>${duration}</a:t>
            </a:r>
            <a:endParaRPr lang="fr-FR" sz="4400"/>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
    <p:custDataLst>
      <p:tags r:id="rId1"/>
    </p:custDataLst>
    <p:extLst>
      <p:ext uri="{BB962C8B-B14F-4D97-AF65-F5344CB8AC3E}">
        <p14:creationId xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" val="${Math.floor(Math.random() * 10000000000)}"/>
      </p:ext>
    </p:extLst>
  </p:cSld>
  <p:clrMapOvr>
    <a:masterClrMapping/>
  </p:clrMapOvr>
  <p:timing>
    <p:tnLst>
      <p:par>
        <p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"/>
      </p:par>
    </p:tnLst>
  </p:timing>
</p:sld>`;
}
// ========== GESTION DES TAGS ==========
// Calcule le numéro de base pour les tags d'une slide
function calculateBaseTagNumber(slideNumber: number): number {
  // Chaque slide utilise 4 tags, commençant à tag1 pour la première slide
  return 1 + (slideNumber - 1) * 4; // tag1, tag2, tag3, tag4 pour slide 1; tag5, tag6, tag7, tag8 pour slide 2, etc.
}

// Génère les 4 fichiers tags pour une slide OMBEA
function createSlideTagFiles(
  slideNumber: number,
  correctAnswer: boolean, 
  duration: number = 30
): TagInfo[] {
  const baseTagNumber = calculateBaseTagNumber(slideNumber);
  const slideGuid = generateGUID();
  const points = correctAnswer ? "1.00,0.00" : "0.00,1.00";
  
  const tags: TagInfo[] = [];
  
  // Tag principal de la slide (configuration OMBEA)
  tags.push({
    tagNumber: baseTagNumber,
    fileName: `tag${baseTagNumber}.xml`,
    content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:tagLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:tag name="OR_SLIDE_GUID" val="${slideGuid}"/>
  <p:tag name="OR_OFFICE_MAJOR_VERSION" val="14"/>
  <p:tag name="OR_POLL_START_MODE" val="Automatic"/>
  <p:tag name="OR_CHART_VALUE_LABEL_FORMAT" val="Response_Count"/>
  <p:tag name="OR_CHART_RESPONSE_DENOMINATOR" val="Responses"/>
  <p:tag name="OR_CHART_FIXED_RESPONSE_DENOMINATOR" val="100"/>
  <p:tag name="OR_CHART_COLOR_MODE" val="Color_Scheme"/>
  <p:tag name="OR_CHART_APPLY_OMBEA_TEMPLATE" val="True"/>
  <p:tag name="OR_POLL_DEFAULT_ANSWER_OPTION" val="None"/>
  <p:tag name="OR_SLIDE_TYPE" val="OR_QUESTION_SLIDE"/>
  <p:tag name="OR_ANSWERS_BULLET_STYLE" val="ppBulletArabicPeriod"/>
  <p:tag name="OR_POLL_FLOW" val="Automatic"/>
  <p:tag name="OR_CHART_DISPLAY_MODE" val="Automatic"/>
  <p:tag name="OR_POLL_TIME_LIMIT" val="${duration}"/>
  <p:tag name="OR_POLL_COUNTDOWN_START_MODE" val="Automatic"/>
  <p:tag name="OR_POLL_MULTIPLE_RESPONSES" val="1"/>
  <p:tag name="OR_POLL_DUPLICATES_ALLOWED" val="False"/>
  <p:tag name="OR_CATEGORIZING" val="False"/>
  <p:tag name="OR_PRIORITY_RANKING" val="False"/>
  <p:tag name="OR_IS_POLLED" val="False"/>
</p:tagLst>`
  });
  
  // Tag du titre
  tags.push({
    tagNumber: baseTagNumber + 1,
    fileName: `tag${baseTagNumber + 1}.xml`,
    content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:tagLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:tag name="OR_SHAPE_TYPE" val="OR_TITLE"/>
</p:tagLst>`
  });
  
  // Tag des réponses avec les points
  tags.push({
    tagNumber: baseTagNumber + 2,
    fileName: `tag${baseTagNumber + 2}.xml`,
    content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:tagLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:tag name="OR_SHAPE_TYPE" val="OR_ANSWERS"/>
  <p:tag name="OR_ANSWER_POINTS" val="${points}"/>
  <p:tag name="OR_ANSWERS_TEXT" val="Vrai&#13;Faux"/>
  <p:tag name="OR_EXCEL_ANSWER_COLORS" val="-10838489,-14521195"/>
</p:tagLst>`
  });
  
  // Tag du countdown
  tags.push({
    tagNumber: baseTagNumber + 3,
    fileName: `tag${baseTagNumber + 3}.xml`,
    content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:tagLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:tag name="OR_SHAPE_TYPE" val="OR_COUNTDOWN"/>
</p:tagLst>`
  });
  
  return tags;
}

// Génère le fichier .rels pour une slide OMBEA avec les bons tags
function createSlideRelsXml(
  slideNumber: number,
  layoutFileName: string
): string {
  const baseTagNumber = calculateBaseTagNumber(slideNumber); 
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags" Target="../tags/tag${baseTagNumber}.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags" Target="../tags/tag${baseTagNumber + 1}.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags" Target="../tags/tag${baseTagNumber + 2}.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags" Target="../tags/tag${baseTagNumber + 3}.xml"/>
  <Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/${layoutFileName}"/>
</Relationships>`;
}
// ========== GESTION DES RID ==========

// Analyse et extrait tous les rId existants d'un fichier .rels
function extractExistingRIds(relsContent: string): RIdMapping[] {
  const mappings: RIdMapping[] = [];
  // Regex améliorée pour capturer tous les attributs possibles
  const relationshipRegex = /<Relationship\s+([^>]+)>/g;
  
  let match;
  while ((match = relationshipRegex.exec(relsContent)) !== null) {
    const attributes = match[1];
    
    // Extraire les attributs individuels
    const idMatch = attributes.match(/Id="(rId\d+)"/);
    const typeMatch = attributes.match(/Type="([^"]+)"/);
    const targetMatch = attributes.match(/Target="([^"]+)"/);
    
    if (idMatch && typeMatch && targetMatch) {
      mappings.push({
        rId: idMatch[1],
        type: typeMatch[1],
        target: targetMatch[1]
      });
    }
  }
  
  return mappings;
}
// Trouve le prochain rId disponible
function getNextAvailableRId(existingRIds: string[]): string {
  let maxId = 0;
  
  existingRIds.forEach(rId => {
    const match = rId.match(/rId(\d+)/);
    if (match) {
      const num = parseInt(match[1]);
      if (num > maxId) maxId = num;
    }
  });
  
  // Toujours retourner le prochain rId disponible
  return `rId${maxId + 1}`;
}

// ========== MISES À JOUR XML ==========

// Met à jour presentation.xml avec les nouvelles slides

async function rebuildPresentationXml(
  zip: JSZip,
  slideRIdMappings: { slideNumber: number; rId: string }[],
  existingSlideCount: number
): Promise<void> {
  const presentationFile = zip.file('ppt/presentation.xml');
  if (!presentationFile) return;
  
  let content = await presentationFile.async('string');
  
  // Extraire defaultTextStyle
  const defaultTextStyleMatch = content.match(/<p:defaultTextStyle>[\s\S]*?<\/p:defaultTextStyle>/);
  
  // MAINTENANT slideMaster est TOUJOURS rId1
  const slideMasterRId = 'rId1';
  
  // Reconstruire presentation.xml
  let newContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" saveSubsetFonts="1">
  <p:sldMasterIdLst>
    <p:sldMasterId id="2147483648" r:id="${slideMasterRId}"/>
  </p:sldMasterIdLst>
  <p:sldIdLst>`;
  
  // Slides existantes commencent à rId2
  for (let i = 1; i <= existingSlideCount; i++) {
    newContent += `\n    <p:sldId id="${255 + i}" r:id="rId${i + 1}"/>`;
  }
  
  // Ajouter les nouvelles slides
  slideRIdMappings.forEach(mapping => {
    const slideId = 255 + mapping.slideNumber;
    newContent += `\n    <p:sldId id="${slideId}" r:id="${mapping.rId}"/>`;
  });
  
  newContent += `\n  </p:sldIdLst>
  <p:sldSz cx="9144000" cy="6858000" type="screen4x3"/>
  <p:notesSz cx="6858000" cy="9144000"/>`;
  
  // Ajouter defaultTextStyle si trouvé
  if (defaultTextStyleMatch) {
    newContent += '\n  ' + defaultTextStyleMatch[0];
  }
  
  newContent += `\n</p:presentation>`;
  
  zip.file('ppt/presentation.xml', newContent);
}

// Modifier aussi updatePresentationRelsWithMappings pour retourner le rId de tag1 :

// Remplacer complètement updatePresentationRelsWithMappings :

function updatePresentationRelsWithMappings(
  originalContent: string,
  newSlideCount: number,
  existingSlideCount: number
): { updatedContent: string; slideRIdMappings: { slideNumber: number; rId: string }[] } {
  // IMPORTANT : PowerPoint s'attend à cet ordre EXACT :
  // rId1 = slideMaster
  // rId2-N = slides  
  // Ensuite les autres éléments
  
  const existingMappings = extractExistingRIds(originalContent);
  
  // Séparer les relations par type
  const slideMasterRel = existingMappings.find(m => m.type.includes('slideMaster'));
  const slideRelations = existingMappings.filter(m => m.type.includes('/slide') && !m.type.includes('slideMaster'));
  const presPropsRel = existingMappings.find(m => m.type.includes('presProps'));
  const viewPropsRel = existingMappings.find(m => m.type.includes('viewProps'));
  const themeRel = existingMappings.find(m => m.type.includes('theme'));
  const tableStylesRel = existingMappings.find(m => m.type.includes('tableStyles'));
  
  // Construire le nouveau contenu avec l'ordre standard
  let newContent = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  newContent += '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
  
  const slideRIdMappings: { slideNumber: number; rId: string }[] = [];
  
  // 1. slideMaster DOIT être rId1
  if (slideMasterRel) {
    newContent += `<Relationship Id="rId1" Type="${slideMasterRel.type}" Target="${slideMasterRel.target}"/>`;
  }
  
  // 2. Toutes les slides (existantes + nouvelles)
  let slideRIdCounter = 2;
  
  // Slides existantes
  slideRelations.forEach((rel) => {
    newContent += `<Relationship Id="rId${slideRIdCounter}" Type="${rel.type}" Target="${rel.target}"/>`;
    slideRIdCounter++;
  });
  
  // Nouvelles slides
  for (let i = 1; i <= newSlideCount; i++) {
    const slideNumber = existingSlideCount + i;
    const rId = `rId${slideRIdCounter}`;
    
    slideRIdMappings.push({
      slideNumber: slideNumber,
      rId: rId
    });
    
    newContent += `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${slideNumber}.xml"/>`;
    slideRIdCounter++;
  }
  
  // 3. Autres éléments dans l'ordre PowerPoint standard
  let nextRId = slideRIdCounter;
  
  if (presPropsRel) {
    newContent += `<Relationship Id="rId${nextRId}" Type="${presPropsRel.type}" Target="${presPropsRel.target}"/>`;
    nextRId++;
  }
  
  if (viewPropsRel) {
    newContent += `<Relationship Id="rId${nextRId}" Type="${viewPropsRel.type}" Target="${viewPropsRel.target}"/>`;
    nextRId++;
  }
  
  if (themeRel) {
    newContent += `<Relationship Id="rId${nextRId}" Type="${themeRel.type}" Target="${themeRel.target}"/>`;
    nextRId++;
  }
  
  if (tableStylesRel) {
    newContent += `<Relationship Id="rId${nextRId}" Type="${tableStylesRel.type}" Target="${tableStylesRel.target}"/>`;
    nextRId++;
  }
  
  newContent += '</Relationships>';
  
  console.log('Nouvelle organisation des rId :');
  console.log('- slideMaster : rId1');
  console.log(`- slides : rId2 à rId${slideRIdCounter - 1}`);
  
  return { 
    updatedContent: newContent, 
    slideRIdMappings 
  };
}

// Met à jour [Content_Types].xml avec tous les nouveaux éléments
function updateContentTypesComplete(
  originalContent: string, 
  newSlideCount: number, 
  existingSlideCount: number,
  layoutFileName: string,
  totalTags: number
): string {
  let updatedContent = originalContent;
  
  // Vérifier et ajouter le slideLayout si nécessaire
  if (!updatedContent.includes(layoutFileName)) {
    // Trouver un bon endroit pour insérer (après les autres layouts ou avant slides)
    const layoutInsertRegex = /(<Override[^>]*slideLayout\d+\.xml"[^>]*\/>)/g;
    const matches = Array.from(updatedContent.matchAll(layoutInsertRegex));
    
    if (matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      const insertPoint = lastMatch.index! + lastMatch[0].length;
      const newOverride = `\n  <Override PartName="/ppt/slideLayouts/${layoutFileName}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>`;
      updatedContent = updatedContent.slice(0, insertPoint) + newOverride + updatedContent.slice(insertPoint);
    }
  }
  
  // Préparer les nouvelles entrées
  let newOverrides = '';
  
  // Ajouter les nouvelles slides
  for (let i = existingSlideCount + 1; i <= existingSlideCount + newSlideCount; i++) {
    if (!updatedContent.includes(`slide${i}.xml`)) {
      newOverrides += `\n  <Override PartName="/ppt/slides/slide${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
    }
  }
  
  // Ajouter tous les tags manquants
  for (let i = 1; i <= totalTags; i++) {
    if (!updatedContent.includes(`tag${i}.xml`)) {
      newOverrides += `\n  <Override PartName="/ppt/tags/tag${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tags+xml"/>`;
    }
  }
  
  // Insérer toutes les nouvelles entrées avant </Types>
  if (newOverrides) {
    const insertPoint = updatedContent.lastIndexOf('</Types>');
    updatedContent = updatedContent.slice(0, insertPoint) + newOverrides + '\n' + updatedContent.slice(insertPoint);
  }
  
  return updatedContent;
}
// ========== GESTION DE APP.XML ==========

// Calcule les métadonnées pour app.xml
function calculateAppXmlMetadata(
  existingSlideCount: number,
  questions: Question[]
): AppXmlMetadata {
  // Calculer les mots et paragraphes
  let totalWords = 0;
  let totalParagraphs = 0;
  const slideTitles: string[] = [];
  
  questions.forEach(q => {
    // Compter les mots dans la question + "Vrai" + "Faux" + duration (comme "30")
    const questionWords = q.question.trim().split(/\s+/).filter(word => word.length > 0).length;
    totalWords += questionWords + 2 + 1; // +2 pour "Vrai" et "Faux", +1 pour le timer
    
    // Paragraphes : 1 pour le titre, 2 pour les réponses, 1 pour le countdown
    totalParagraphs += 4; // Au lieu de 3
    
    // Ajouter le titre de la slide
    slideTitles.push(q.question);
  });
  
  return {
    totalSlides: existingSlideCount + questions.length,
    totalWords,
    totalParagraphs,
    slideTitles
  };
}

// Met à jour app.xml avec la structure correcte
async function updateAppXml(
  zip: JSZip, 
  metadata: AppXmlMetadata
): Promise<void> {
  const appFile = zip.file('docProps/app.xml');
  if (!appFile) {
    console.warn('app.xml non trouvé, création d\'un nouveau fichier');
    createNewAppXml(zip, metadata);
    return;
  }
  
  let content = await appFile.async('string');
  
  // Mettre à jour les champs simples
  content = updateSimpleFields(content, metadata);
  
  // Mettre à jour HeadingPairs et TitlesOfParts
  content = updateHeadingPairsAndTitles(content, metadata);
  
  zip.file('docProps/app.xml', content);
}

// Met à jour les champs simples dans app.xml
function updateSimpleFields(content: string, metadata: AppXmlMetadata): string {
  let updated = content;
  
  // Slides
  updated = updated.replace(/<Slides>\d+<\/Slides>/, `<Slides>${metadata.totalSlides}</Slides>`);
  
  // Words
  updated = updated.replace(/<Words>\d+<\/Words>/, `<Words>${metadata.totalWords}</Words>`);
  
  // Paragraphs
  updated = updated.replace(/<Paragraphs>\d+<\/Paragraphs>/, `<Paragraphs>${metadata.totalParagraphs}</Paragraphs>`);
  
  // TotalTime (garder la valeur existante ou mettre 2 par défaut)
  if (!updated.includes('<TotalTime>')) {
    const propertiesEnd = updated.indexOf('</Properties>');
    const totalTimeTag = '\n  <TotalTime>2</TotalTime>';
    updated = updated.slice(0, propertiesEnd) + totalTimeTag + '\n' + updated.slice(propertiesEnd);
  }
  
  // Company (s'assurer qu'elle existe)
  if (!updated.includes('<Company')) {
    // Insérer après TitlesOfParts ou HeadingPairs
    const insertPoint = updated.indexOf('</TitlesOfParts>');
    if (insertPoint > -1) {
      const companyTag = '\n  <Company/>';
      updated = updated.slice(0, insertPoint + '</TitlesOfParts>'.length) + companyTag + updated.slice(insertPoint + '</TitlesOfParts>'.length);
    }
  }
  
  return updated;
}

// Met à jour HeadingPairs et TitlesOfParts avec la structure correcte
function updateHeadingPairsAndTitles(content: string, metadata: AppXmlMetadata): string {
  let updated = content;
  
  // Extraire TOUS les titres existants
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
  
  // Séparer les titres en catégories
  const fonts: string[] = [];
  const themes: string[] = [];
  const existingSlideTitles: string[] = [];
  
  allExistingTitles.forEach(title => {
    if (title === 'Arial' || title === 'Calibri') {
      fonts.push(title);
    } else if (title === 'Thème Office' || title === 'Office Theme') {
      themes.push(title);
    } else if (title !== '' && !metadata.slideTitles.includes(title)) {
      // C'est un titre de slide existant (comme "Présentation PowerPoint")
      existingSlideTitles.push(title);
    }
  });
  
  // Reconstruire les listes correctement
  const nonSlideTitles = [...fonts, ...themes];
  const allSlideTitles = [...existingSlideTitles, ...metadata.slideTitles];
  
  // Pour debug
  console.log('Fonts trouvées:', fonts);
  console.log('Thèmes trouvés:', themes);
  console.log('Titres slides existantes:', existingSlideTitles);
  console.log('Nouveaux titres:', metadata.slideTitles);
  console.log('Total titres slides:', allSlideTitles.length);

   // Construire la nouvelle structure HeadingPairs
  const headingPairs = buildHeadingPairs(nonSlideTitles, allSlideTitles);
  
  // Construire la nouvelle structure TitlesOfParts - CORRECTION ICI
  const titlesOfParts = buildTitlesOfParts(fonts, themes, existingSlideTitles, metadata.slideTitles);
    
  // Remplacer HeadingPairs
  const headingPairsRegex = /<HeadingPairs>[\s\S]*?<\/HeadingPairs>/;
  if (headingPairsRegex.test(updated)) {
    updated = updated.replace(headingPairsRegex, headingPairs);
  }
  
  // Remplacer TitlesOfParts
  const titlesOfPartsRegex = /<TitlesOfParts>[\s\S]*?<\/TitlesOfParts>/;
  if (titlesOfPartsRegex.test(updated)) {
    updated = updated.replace(titlesOfPartsRegex, titlesOfParts);
  }
  
  return updated;
}
// Construit la structure HeadingPairs correcte
function buildHeadingPairs(nonSlideTitles: string[], allSlideTitles: string[]): string {
  const pairs: string[] = [];
  
  // Compter les polices (si présentes)
  const fontCount = nonSlideTitles.filter(t => 
    t.includes('Arial') || t.includes('Calibri') || t.includes('Font') || t.includes('Police')
  ).length;
  
  if (fontCount > 0) {
    pairs.push(`
      <vt:variant>
        <vt:lpstr>Polices utilisées</vt:lpstr>
      </vt:variant>
      <vt:variant>
        <vt:i4>${fontCount}</vt:i4>
      </vt:variant>`);
  }
  
  // Compter les thèmes (toujours 1 s'il y en a)
  const hasTheme = nonSlideTitles.some(t => 
    t.includes('Thème') || t.includes('Theme') || t === 'Thème Office'
  );
  
  if (hasTheme) {
    pairs.push(`
      <vt:variant>
        <vt:lpstr>Thème</vt:lpstr>
      </vt:variant>
      <vt:variant>
        <vt:i4>1</vt:i4>
      </vt:variant>`);
  }
  
  // Ajouter la paire pour les titres de diapositives
  if (allSlideTitles.length > 0) {
    pairs.push(`
      <vt:variant>
        <vt:lpstr>Titres des diapositives</vt:lpstr>
      </vt:variant>
      <vt:variant>
        <vt:i4>${allSlideTitles.length}</vt:i4>
      </vt:variant>`);
  }
  
  const vectorSize = pairs.length * 2;
  
  return `<HeadingPairs>
    <vt:vector size="${vectorSize}" baseType="variant">${pairs.join('')}
    </vt:vector>
  </HeadingPairs>`;
}

// Construit la structure TitlesOfParts correcte
function buildTitlesOfParts(
  fonts: string[], 
  themes: string[], 
  existingSlideTitles: string[], 
  newSlideTitles: string[]
): string {
  const allTitles: string[] = [];
  
  // 1. Ajouter les polices
  fonts.forEach(font => allTitles.push(font));
  
  // 2. Ajouter les thèmes
  themes.forEach(theme => allTitles.push(theme));
  
  // 3. Ajouter les titres des slides existantes
  existingSlideTitles.forEach(title => allTitles.push(title));
  
  // 4. Ajouter les titres des nouvelles slides
  newSlideTitles.forEach(title => {
    const truncatedTitle = title.length > 100 ? title.substring(0, 97) + '...' : title;
    allTitles.push(escapeXml(truncatedTitle));
  });
  
  const vectorContent = allTitles.map(title => 
    `\n      <vt:lpstr>${title}</vt:lpstr>`
  ).join('');
  
  return `<TitlesOfParts>
    <vt:vector size="${allTitles.length}" baseType="lpstr">${vectorContent}
    </vt:vector>
  </TitlesOfParts>`;
}

// Crée un nouveau fichier app.xml si nécessaire
function createNewAppXml(zip: JSZip, metadata: AppXmlMetadata): void {
  // Valeurs par défaut pour un nouveau fichier
  const defaultFonts = ['Arial', 'Calibri'];
  const defaultThemes = ['Thème Office'];
  const existingSlideTitles: string[] = []; // Pas de slides existantes dans un nouveau fichier
  
  const nonSlideTitles = [...defaultFonts, ...defaultThemes];
  const headingPairs = buildHeadingPairs(nonSlideTitles, metadata.slideTitles);
  const titlesOfParts = buildTitlesOfParts(defaultFonts, defaultThemes, existingSlideTitles, metadata.slideTitles);
  
  const appXmlContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <TotalTime>2</TotalTime>
  <Words>${metadata.totalWords}</Words>
  <Application>Microsoft Office PowerPoint</Application>
  <PresentationFormat>Affichage à l'écran (4:3)</PresentationFormat>
  <Paragraphs>${metadata.totalParagraphs}</Paragraphs>
  <Slides>${metadata.totalSlides}</Slides>
  <Notes>0</Notes>
  <HiddenSlides>0</HiddenSlides>
  <MMClips>0</MMClips>
  <ScaleCrop>false</ScaleCrop>
  ${headingPairs}
  ${titlesOfParts}
  <Company/>
  <LinksUpToDate>false</LinksUpToDate>
  <SharedDoc>false</SharedDoc>
  <HyperlinksChanged>false</HyperlinksChanged>
  <AppVersion>14.0000</AppVersion>
</Properties>`;
  
  zip.file('docProps/app.xml', appXmlContent);
}

// ========== GESTION DE CORE.XML ==========

// Met à jour core.xml avec les nouvelles métadonnées
// Remplacer la fonction updateCoreXml existante par celle-ci :

async function updateCoreXml(zip: JSZip, slideCount: number): Promise<void> {
  const coreFile = zip.file('docProps/core.xml');
  if (coreFile) {
    let content = await coreFile.async('string');
    
    // Mettre à jour le titre avec gestion du pluriel
    const title = `Quiz OMBEA ${slideCount} question${slideCount > 1 ? 's' : ''}`;
    content = content.replace(/<dc:title>.*?<\/dc:title>/, `<dc:title>${escapeXml(title)}</dc:title>`);
    
    // Mettre à jour la date de modification
    const now = new Date().toISOString();
    content = content.replace(/<dcterms:modified.*?>.*?<\/dcterms:modified>/, 
      `<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>`);
    
    // NE PAS ajouter dcterms:created si elle existe déjà
    // (Le code original ajoutait une deuxième balise, ce qui causait la corruption)
    
    zip.file('docProps/core.xml', content);
  }
}
// ========== FONCTION PRINCIPALE ==========

// Fonction principale de génération avec support OMBEA
export async function generatePPTX(
  templateFile: File,
  questions: Question[],
  options: GenerationOptions = {}
): Promise<void> {
  try {
    // DEBUG: Générer un ID unique pour cette exécution
    const executionId = Date.now();
    console.log(`\n=== DÉBUT GÉNÉRATION ${executionId} ===`);
    
    // DEBUG: Afficher la taille du template
    console.log(`Template: ${templateFile.name}, taille: ${templateFile.size} octets`);
    
    // DEBUG: Calculer un hash simple des questions
    const questionsHash = questions.map(q => q.question).join('|');
    console.log(`Hash questions: ${questionsHash.substring(0, 50)}...`);
    
    console.log('Validation des données...');
    validateQuestions(questions);

    console.log('Chargement du modèle...');
    const templateZip = await JSZip.loadAsync(templateFile);
    
    // DEBUG: Vérifier l'intégrité du ZIP chargé
    let fileCount = 0;
    templateZip.forEach(() => fileCount++);
    console.log(`Fichiers dans le template: ${fileCount}`);
    const existingSlideCount = countExistingSlides(templateZip);
    console.log(`Slides existantes dans le modèle: ${existingSlideCount}`);
    console.log(`Nouvelles slides à créer: ${questions.length}`);

    let totalTagsCreated = 0;

    const outputZip = new JSZip();
    const copyPromises: Promise<void>[] = [];
    templateZip.forEach((relativePath, file) => {
      if (!file.dir) {
        const promise = file.async('blob').then(content => {
          outputZip.file(relativePath, content);
        });
        copyPromises.push(promise);
      }
    });
    await Promise.all(copyPromises);
    console.log('Modèle copié');

    const { layoutFileName, layoutRId } = await ensureOmbeaSlideLayoutExists(outputZip);
    console.log(`Layout OMBEA: ${layoutFileName} (${layoutRId})`);

    outputZip.folder('ppt/tags');

    console.log('Création des nouvelles slides OMBEA...');
    for (let i = 0; i < questions.length; i++) {
      const slideNumber = existingSlideCount + i + 1;
      const question = questions[i];
      const correctAnswer = question.correctAnswer !== undefined ? question.correctAnswer : false;
      const duration = question.duration || 30;

      const slideXml = createSlideXml(question.question, slideNumber, duration);
      outputZip.file(`ppt/slides/slide${slideNumber}.xml`, slideXml);

      const slideRelsXml = createSlideRelsXml(i + 1, layoutFileName);
      outputZip.file(`ppt/slides/_rels/slide${slideNumber}.xml.rels`, slideRelsXml);

      const tags = createSlideTagFiles(i + 1, correctAnswer, duration);
      tags.forEach(tag => {
        outputZip.file(`ppt/tags/${tag.fileName}`, tag.content);
        totalTagsCreated = Math.max(totalTagsCreated, tag.tagNumber);
      });

      console.log(`Slide OMBEA ${slideNumber} créée: ${question.question.substring(0, 50)}...`);
    }

    console.log(`Total des tags créés: ${totalTagsCreated}`);

    const contentTypesFile = outputZip.file('[Content_Types].xml');
    if (contentTypesFile) {
      const contentTypesContent = await contentTypesFile.async('string');
      const updatedContentTypes = updateContentTypesComplete(
        contentTypesContent,
        questions.length,
        existingSlideCount,
        layoutFileName,
        totalTagsCreated
      );
      outputZip.file('[Content_Types].xml', updatedContentTypes);
    }

    const presentationRelsFile = outputZip.file('ppt/_rels/presentation.xml.rels');
    if (presentationRelsFile) {
      const presentationRelsContent = await presentationRelsFile.async('string');
      const { updatedContent: updatedPresentationRels, slideRIdMappings } = updatePresentationRelsWithMappings(
        presentationRelsContent,
        questions.length,
        existingSlideCount
      );

      outputZip.file('ppt/_rels/presentation.xml.rels', updatedPresentationRels);

      await rebuildPresentationXml(
        outputZip,
        slideRIdMappings,
        existingSlideCount
      );
    }

    await updateCoreXml(outputZip, questions.length);
    const appMetadata = calculateAppXmlMetadata(existingSlideCount, questions);
    await updateAppXml(outputZip, appMetadata);

    console.log('Génération du fichier final...');
const outputBlob = await outputZip.generateAsync({
  type: 'blob',
  mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  compression: 'DEFLATE',
  compressionOptions: { level: 3 }  // Réduire le niveau de compression de 6 à 3
});

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
export async function testConsistency(templateFile: File, questions: Question[]): Promise<void> {
  console.log('=== TEST DE COHÉRENCE ===');
  const results = [];
  
  for (let i = 0; i < 5; i++) {
    console.log(`\nTest ${i + 1}/5...`);
    try {
      // Créer une copie du template pour éviter toute modification
      const templateCopy = new File([await templateFile.arrayBuffer()], templateFile.name, {
        type: templateFile.type
      });
      
      await generatePPTX(templateCopy, questions, {
        fileName: `Test_${i + 1}.pptx`
      });
      
      results.push('SUCCÈS');
    } catch (_error) { // error unused
      results.push('ÉCHEC: ');
    }
  }
  
  console.log('\n=== RÉSULTATS ===');
  results.forEach((result, i) => {
    console.log(`Test ${i + 1}: ${result}`);
  });
}
// Exemple d'utilisation avec les nouvelles options
export const handleGeneratePPTX = async (templateFile: File, questions: Question[]) => {
  try {
    await generatePPTX(templateFile, questions, {
      fileName: 'Quiz_OMBEA_Interactif.pptx'
    });
  } catch (error: any) {
    console.error('Erreur:', error);
    alert(`Erreur lors de la génération: ${error.message}`);
  }
};

// ========== EXPORTS ==========

export type {
  Question,
  GenerationOptions,
  TagInfo,
  RIdMapping,
  AppXmlMetadata
};
