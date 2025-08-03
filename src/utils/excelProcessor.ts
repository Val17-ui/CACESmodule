import ExcelJS from 'exceljs';
import { Question, QuestionType } from '@common/types';

export interface RawExcelQuestion {
  text?: string;
  referential?: string;
  theme?: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctAnswer?: string; // 'A', 'B', 'C', or 'D'
  isEliminatory?: string; // 'TRUE'/'FALSE' or '1'/'0'
  timeLimit?: number;
  imageName?: string;
  type?: string;
}

export async function parseQuestionsExcel(file: File): Promise<{ data: RawExcelQuestion[], errors: string[], columnHeaders: string[] }> {
  const errors: string[] = [];
  const data: RawExcelQuestion[] = [];
  const columnHeaders: string[] = []; // prefer-const

  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      errors.push("Aucune feuille de calcul trouvée dans le fichier Excel.");
      return { data, errors, columnHeaders };
    }

    // Lire les en-têtes (première ligne)
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell, _colNumber) => { // colNumber unused here
      columnHeaders.push(cell.value?.toString().trim() || '');
    });

    // Vérifier les en-têtes requis
    const requiredHeaders = ['text', 'referential', 'theme', 'optionA', 'optionB', 'correctAnswer', 'isEliminatory'];
    for (const requiredHeader of requiredHeaders) {
      if (!columnHeaders.includes(requiredHeader)) {
        errors.push(`En-tête manquant requis : ${requiredHeader}.`);
      }
    }

    if (errors.length > 0) {
      return { data, errors, columnHeaders };
    }

    // Lire les données (à partir de la ligne 2)
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) { // Ignorer la ligne d'en-tête
        const rowData: RawExcelQuestion = {};
        
        row.eachCell((cell, colNumber) => {
          const header = columnHeaders[colNumber - 1];
          if (header) {
            const value = cell.value?.toString().trim() || '';
            if (header === 'timeLimit') {
              rowData[header] = value ? parseInt(value, 10) : undefined;
            } else {
              rowData[header as keyof RawExcelQuestion] = value || undefined;
            }
          }
        });

        // Ne pas ajouter les lignes vides
        if (rowData.text && rowData.text.trim()) {
          data.push(rowData);
        }
      }
    });

  } catch (error) {
    errors.push(`Erreur lors de la lecture du fichier Excel: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
  }

  return { data, errors, columnHeaders };
}

export interface SessionDetails {
  [key: string]: any;
}

export interface ParsedParticipant {
  prenom: string;
  nom: string;
  organization: string;
  identificationCode: string;
  iterationNumber: number;
  deviceName: string;
}

export async function parseFullSessionExcel(file: File): Promise<{ details: SessionDetails; participants: ParsedParticipant[] }> {
  const details: SessionDetails = {};
  const participants: ParsedParticipant[] = [];

  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  // Parse SessionDetails sheet
  const sessionDetailsSheet = workbook.getWorksheet('SessionDetails');
  if (sessionDetailsSheet) {
    const keyMapping: { [key: string]: string } = {
      'nom de la session': 'nomSession',
      'nomsession': 'nomSession',
      'nom session': 'nomSession',
      'date de la session': 'dateSession',
      'datesession': 'dateSession',
      'date session': 'dateSession',
      'code du référentiel': 'referentielCode',
      'référentiel': 'referentielCode',
      'referentiel': 'referentielCode',
      'referentielcode': 'referentielCode',
      'nom du formateur': 'trainerName',
      'formateur': 'trainerName',
      'trainername': 'trainerName',
      'nom du kit': 'kitName',
      'kit': 'kitName',
      'kitname': 'kitName',
      'nombre d\'itérations': 'iterationCount',
      'iterationcount': 'iterationCount',
      'noms des itérations': 'iterationNames',
      'iterationnames': 'iterationNames',
      'lieu': 'location',
      'notes': 'notes',
      'numéro de session': 'numSession',
      'numsession': 'numSession',
      'numéro de stage': 'numStage',
      'numstage': 'numStage',
    };

    sessionDetailsSheet.eachRow((row) => {
      const rawKey = row.getCell(1).value?.toString().toLowerCase().trim();
      const value = row.getCell(2).value;
      if (rawKey) {
        const mappedKey = keyMapping[rawKey] || rawKey;
        details[mappedKey] = value || '';
      }
    });
  } else {
    throw new Error("La feuille 'SessionDetails' est introuvable dans le fichier Excel.");
  }

  // Parse Participants sheet
  const participantsSheet = workbook.getWorksheet('Participants');
  if (participantsSheet) {
    const headerRow = (participantsSheet.getRow(1).values as string[]).map(h => h.toLowerCase().trim());

    const findIndex = (aliases: string[]) => {
      for (const alias of aliases) {
        const index = headerRow.indexOf(alias);
        if (index !== -1) return index;
      }
      return -1;
    };

    const prenomIndex = findIndex(['prénom', 'prenom', 'firstname', 'first name']);
    const nomIndex = findIndex(['nom', 'lastname', 'last name']);
    const organizationIndex = findIndex(['organisation', 'organization', 'société', 'societe']);
    const identificationCodeIndex = findIndex(['code identification', 'identificationcode', 'code']);
    const iterationNumberIndex = findIndex(['itération', 'iteration', 'iterationnumber']);
    const deviceNameIndex = findIndex(['boîtier', 'boitier', 'devicename']);

    participantsSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) { // Skip header row
        const prenom = row.getCell(prenomIndex).value?.toString() || '';
        const nom = row.getCell(nomIndex).value?.toString() || '';
        if (prenom || nom) {
          participants.push({
            prenom,
            nom,
            organization: row.getCell(organizationIndex).value?.toString() || '',
            identificationCode: row.getCell(identificationCodeIndex).value?.toString() || '',
            iterationNumber: parseInt(row.getCell(iterationNumberIndex).value?.toString() || '1', 10),
            deviceName: row.getCell(deviceNameIndex).value?.toString() || '',
          });
        }
      }
    });
  } else {
    throw new Error("La feuille 'Participants' est introuvable dans le fichier Excel.");
  }

  return { details, participants };
}


export async function exportQuestionsToExcel(questions: Question[]): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Questions');

  // Définir les en-têtes
  const headers = [
    'id', 'text', 'referential', 'theme',
    'optionA', 'optionB', 'optionC', 'optionD',
    'correctAnswer', 'isEliminatory', 'timeLimit',
    'imageName', 'type'
  ];

  // Ajouter la ligne d'en-tête
  worksheet.addRow(headers);

  // Styliser la ligne d'en-tête
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };

  // Ajouter les données
  questions.forEach(q => {
    const options = q.options || [];
    
    // Convertir correctAnswer en lettre
    let correctAnswerLetter = '';
    if (q.type === QuestionType.QCM && typeof q.correctAnswer === 'string') {
      // Si correctAnswer est déjà une lettre
      if (['A', 'B', 'C', 'D'].includes(q.correctAnswer.toUpperCase())) {
        correctAnswerLetter = q.correctAnswer.toUpperCase();
      } else {
        // Si c'est le texte de la réponse, trouver l'index
        const answerIndex = options.indexOf(q.correctAnswer);
        if (answerIndex >= 0 && answerIndex < 4) {
          correctAnswerLetter = String.fromCharCode(65 + answerIndex);
        }
      }
    } else if (q.type === QuestionType.TrueFalse) {
      // Pour Vrai/Faux, A = Vrai, B = Faux
      correctAnswerLetter = q.correctAnswer === 'Vrai' || q.correctAnswer === '0' ? 'A' : 'B';
    }

    const row = [
      q.id,
      q.text,
      q.referential,
      q.theme,
      options[0] || '',
      options[1] || '',
      options[2] || '',
      options[3] || '',
      correctAnswerLetter,
      q.isEliminatory ? 'TRUE' : 'FALSE',
      q.timeLimit || '',
      q.image ? 'image_associée' : '', // Placeholder pour l'image
      q.type
    ];

    worksheet.addRow(row);
  });

  // Ajuster la largeur des colonnes
  worksheet.columns.forEach((column, index) => {
    if (index === 1) { // Colonne text
      column.width = 50;
    } else if (index >= 4 && index <= 7) { // Colonnes options
      column.width = 20;
    } else {
      column.width = 15;
    }
  });

  // Générer le fichier Excel
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
}