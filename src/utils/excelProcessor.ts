import ExcelJS from 'exceljs';
import { Question } from '../../types'; // Import the main Question type

// import { Question as MainQuestionType, ReferentialType, QuestionTheme } from '../../types'; // Example if needed

export interface RawExcelQuestion {
  text?: string | null;
  referential?: string | null;
  theme?: string | null;
  optionA?: string | null;
  optionB?: string | null;
  optionC?: string | null;
  optionD?: string | null;
  correctAnswer?: string | null; // Expected 'A', 'B', 'C', or 'D'
  isEliminatory?: string | boolean | null; // Input could be 'OUI', 'NON', TRUE, FALSE etc.
  timeLimit?: string | number | null; // Input could be number or string
  imageName?: string | null;
  type?: string | null;
  // For any unexpected columns, though we primarily map expected ones.
  [key: string]: string | number | boolean | null | undefined;
}

export async function importQuestionsFromExcel(file: File): Promise<{ data: RawExcelQuestion[], errors: string[], rawHeaders: string[] }> {
  const data: RawExcelQuestion[] = [];
  const errors: string[] = [];
  let rawHeaders: string[] = [];

  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    const worksheet = workbook.worksheets[0]; // Get the first worksheet

    if (!worksheet) {
      errors.push('Aucune feuille de calcul trouvée dans le fichier Excel.');
      return { data, errors, rawHeaders };
    }

    // Define expected headers and their mapping to RawExcelQuestion keys
    // User-friendly titles for Excel template vs. internal keys
    const headerMapping: { [key: string]: keyof RawExcelQuestion } = {
      'Texte de la question': 'text',
      'Référentiel (Code)': 'referential',
      'Thème (Code)': 'theme',
      'Option A': 'optionA',
      'Option B': 'optionB',
      'Option C': 'optionC',
      'Option D': 'optionD',
      'Bonne Réponse (Lettre A-D)': 'correctAnswer',
      'Éliminatoire (OUI/NON)': 'isEliminatory',
      'Temps Limite (secondes)': 'timeLimit',
      'Nom Image': 'imageName',
      'Type': 'type' // e.g., 'multiple-choice'
    };
    const expectedHeaderTitles = Object.keys(headerMapping);

    const headerRow = worksheet.getRow(1);
    const actualHeaders: { [key: string]: number } = {}; // Store actual header title to column index

    // Attempt to get header values, handling cases where headerRow.values might be sparse
    const headerValues = headerRow.values;
    if (Array.isArray(headerValues)) {
        rawHeaders = headerValues.map(val => val ? val.toString() : '').filter(Boolean);
    } else {
        // Fallback for different structures if needed, though typically it's an array-like object
        const tempHeaders: string[] = [];
        headerRow.eachCell({ includeEmpty: true }, (cell) => { // includeEmpty might be needed if headers are sparse
            tempHeaders.push(cell.value ? cell.value.toString() : '');
        });
        rawHeaders = tempHeaders.filter(Boolean);
    }


    headerRow.eachCell((cell, colNumber) => {
      const cellValue = cell.value?.toString().trim();
      if (cellValue && expectedHeaderTitles.includes(cellValue)) {
        actualHeaders[cellValue] = colNumber;
      }
    });

    // Validate that all essential headers are present
    const essentialHeaders = [
        'Texte de la question', 'Référentiel (Code)', 'Thème (Code)',
        'Option A', 'Option B', 'Bonne Réponse (Lettre A-D)', 'Éliminatoire (OUI/NON)'
    ];
    for (const essentialHeader of essentialHeaders) {
      if (!actualHeaders[essentialHeader]) {
        errors.push(`En-tête essentiel manquant : "${essentialHeader}". Assurez-vous que la première ligne contient les titres de colonnes attendus.`);
      }
    }

    if (errors.length > 0) {
      // Return early if essential headers are missing
      return { data, errors, rawHeaders };
    }

    // Process data rows (starting from row 2)
    for (let i = 2; i <= worksheet.rowCount; i++) {
      const currentRow = worksheet.getRow(i);
      const rowData: RawExcelQuestion = {};
      let isEmptyRow = true;

      for (const headerTitle in actualHeaders) {
        const colNumber = actualHeaders[headerTitle];
        const cell = currentRow.getCell(colNumber);
        let cellValue: string | number | boolean | null = null;

        if (cell.value !== null && cell.value !== undefined) {
            isEmptyRow = false;
            if (typeof cell.value === 'object' && (cell.value as ExcelJS.CellRichTextValue).richText) {
                cellValue = (cell.value as ExcelJS.CellRichTextValue).richText.map(rt => rt.text).join('');
            } else if (typeof cell.value === 'object' && (cell.value as ExcelJS.CellFormulaValue).result) {
                const result = (cell.value as ExcelJS.CellFormulaValue).result;
                // Check if result is an error object (e.g. #N/A)
                if (typeof result === 'object' && result && (result as any).error) {
                    cellValue = (result as any).error; // Store error string, e.g., "#N/A"
                } else {
                    cellValue = result as (string | number | boolean | null);
                }
            } else if (cell.value instanceof Date) {
                cellValue = cell.value.toISOString();
            } else {
                cellValue = cell.value as (string | number | boolean | null);
            }
        }

        const key = headerMapping[headerTitle];
        if (key) {
          if (typeof cellValue === 'boolean' || typeof cellValue === 'number') {
            rowData[key] = cellValue;
          } else {
            rowData[key] = cellValue?.toString().trim() || null;
          }
        }
      }
      
      if (!isEmptyRow) {
          if (rowData.text || rowData.referential || rowData.theme) {
             data.push(rowData);
          }
      }
    }

    if (data.length === 0 && errors.length === 0) {
        errors.push("Aucune donnée de question valide trouvée après la ligne d'en-tête.");
    }

  } catch (error: any) {
    console.error('Error processing Excel file in importQuestionsFromExcel:', error);
    errors.push(`Erreur technique lors du traitement du fichier Excel : ${error.message || error.toString()}`);
  }

  return { data, errors, rawHeaders };
}

export async function exportQuestionsToExcel(questions: Question[]): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'VotreApplication'; // Optional: set metadata
  workbook.lastModifiedBy = 'VotreApplication';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet('Questions');

  // Define header titles
  const headers = [
    { header: 'ID', key: 'id', width: 30 },
    { header: 'Texte de la question', key: 'text', width: 70 },
    { header: 'Référentiel (Code)', key: 'referential', width: 20 },
    { header: 'Thème (Code)', key: 'theme', width: 20 },
    { header: 'Option A', key: 'optionA', width: 40 },
    { header: 'Option B', key: 'optionB', width: 40 },
    { header: 'Option C', key: 'optionC', width: 40 },
    { header: 'Option D', key: 'optionD', width: 40 },
    { header: 'Bonne Réponse (Lettre A-D)', key: 'correctAnswer', width: 25 },
    { header: 'Éliminatoire (OUI/NON)', key: 'isEliminatory', width: 25 },
    { header: 'Temps Limite (secondes)', key: 'timeLimit', width: 25 },
    { header: 'Nom Image', key: 'imageName', width: 30 },
    { header: 'Type', key: 'type', width: 20 }
  ];
  worksheet.columns = headers.map(h => ({ header: h.header, key: h.key, width: h.width }));

  // Add title row and style it (optional but nice)
  const titleRow = worksheet.getRow(1);
  titleRow.font = { name: 'Calibri', family: 4, size: 11, bold: true };
  titleRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // Prepare data rows
  questions.forEach(q => {
    const options = q.options || [];
    let correctAnswerLetter = '';
    // Ensure q.correctAnswer is a number before using it as an index
    if (typeof q.correctAnswer === 'number' && q.correctAnswer >= 0 && q.correctAnswer < options.length) {
      // Check if it's a true/false question type, which might have different correctAnswer logic
      if (q.type === 'true-false') {
        // Assuming options for true/false are like ['Vrai', 'Faux'] or ['True', 'False']
        // And q.correctAnswer is 0 for True, 1 for False
        correctAnswerLetter = options[q.correctAnswer] === options[0] ? 'A' : 'B'; // Or directly 'VRAI'/'FAUX' if that's preferred for export
      } else { // For multiple-choice
         if (q.correctAnswer < 4) { // Only map A, B, C, D
            correctAnswerLetter = String.fromCharCode(65 + q.correctAnswer);
         }
      }
    }

    worksheet.addRow({
      id: q.id,
      text: q.text,
      referential: q.referential,
      theme: q.theme,
      optionA: options[0] || '',
      optionB: options[1] || '',
      optionC: options[2] || '',
      optionD: options[3] || '',
      correctAnswer: correctAnswerLetter,
      isEliminatory: q.isEliminatory ? 'OUI' : 'NON',
      timeLimit: q.timeLimit !== undefined ? q.timeLimit : '',
      imageName: q.image || '', // Assuming q.image holds the imageName
      type: q.type || 'multiple-choice'
    });
  });

  // Auto-filter on the header row (optional)
  worksheet.autoFilter = {
    from: 'A1',
    to: { row: 1, column: headers.length }
  };

  // Write to buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}


// interface Question {
//   question: string;
//   correctAnswer: boolean; // true for "Vrai", false for "Faux"
//   imagePath?: string;
//   duration?: number;
// }

// export async function processExcel(file: File): Promise<Question[]> {
//   return new Promise(async (resolve, reject) => {
//     try {
//       const arrayBuffer = await file.arrayBuffer();
//       const workbook = new ExcelJS.Workbook();
//       await workbook.xlsx.load(arrayBuffer);
      
//       const worksheet = workbook.getWorksheet(1); // Get the first worksheet
      
//       if (!worksheet) {
//         throw new Error('No worksheet found in the Excel file');
//       }
      
//       const questions: Question[] = [];

//       // Skip header row if it exists
//       let startRow = 1;
//       const firstRow = worksheet.getRow(1);
//       const firstCellValue = firstRow.getCell(1).value?.toString().toLowerCase();

//       if (firstCellValue && (
//         firstCellValue.includes('question') ||
//         firstCellValue.includes('réponse') ||
//         firstCellValue.includes('image')
//       )) {
//         startRow = 2;
//       }
      
//       // Process each row
//       worksheet.eachRow((row, rowNumber) => {
//         if (rowNumber >= startRow) {
//           const questionText = row.getCell(1).value?.toString() || '';
          
//           if (!questionText.trim()) {
//             return; // Skip empty rows
//           }
          
//           // Get correct answer (assuming "Vrai" or "Faux" in column 2)
//           const answerText = row.getCell(2).value?.toString().toLowerCase() || '';
//           const correctAnswer = answerText.includes('vrai') || answerText === '1' || answerText === 'true';
          
//           // Optional: Get image path if available (column 3)
//           const imagePath = row.getCell(3).value?.toString() || undefined;
          
//           // Optional: Get duration if available (column 4)
//           const durationCell = row.getCell(4).value;
//           const duration = typeof durationCell === 'number' ? durationCell : undefined;
          
//           questions.push({
//             question: questionText,
//             correctAnswer,
//             imagePath: imagePath?.trim() || undefined,
//             duration
//           });
//         }
//       });
      
//       if (questions.length === 0) {
//         throw new Error('No valid questions found in the Excel file');
//       }
      
//       resolve(questions);
//     } catch (error) {
//       console.error('Error processing Excel file:', error);
//       reject(error);
//     }
//   });
// }
