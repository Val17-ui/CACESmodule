import { Question } from '../types'; // Assuming Question type is available

export interface RawCsvQuestion {
  text?: string;
  referential?: string;
  theme?: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctAnswer?: string; // 'A', 'B', 'C', or 'D'
  isEliminatory?: string; // 'TRUE'/'FALSE' or '1'/'0'
  timeLimit?: string;
  imageName?: string;
  type?: string;
  // Allows for other columns if present, though they might not be used initially
  [key: string]: string | undefined;
}

export function parseQuestionsCsv(csvString: string): { data: RawCsvQuestion[], errors: string[], columnHeaders: string[] } {
  const errors: string[] = [];
  const data: RawCsvQuestion[] = [];
  let columnHeaders: string[] = [];

  if (!csvString || csvString.trim() === "") {
    errors.push("Le contenu CSV est vide.");
    return { data, errors, columnHeaders };
  }

  const lines = csvString.split(/\r\n|\n/);

  // Remove potential BOM from the first line if present
  if (lines.length > 0 && lines[0].charCodeAt(0) === 0xFEFF) {
    lines[0] = lines[0].substring(1);
  }

  // Filter out empty lines that might result from multiple newlines
  const nonEmptyLines = lines.filter(line => line.trim() !== '');

  if (nonEmptyLines.length === 0) {
    errors.push("Le fichier CSV ne contient aucune ligne de contenu valide.");
    return { data, errors, columnHeaders };
  }

  // Process header
  const headerLine = nonEmptyLines[0];
  // No need to check headerLine for emptiness again due to nonEmptyLines filter
  columnHeaders = headerLine.split(',').map(h => h.trim());

  const requiredHeaders = ['text', 'referential', 'theme', 'optionA', 'optionB', 'correctAnswer', 'isEliminatory'];
  for (const requiredHeader of requiredHeaders) {
    if (!columnHeaders.includes(requiredHeader)) {
      errors.push(`En-tête manquant requis : ${requiredHeader}.`);
    }
  }

  if (errors.length > 0) {
    // Return early if required headers are missing, as parsing data would be unreliable.
    // We still return columnHeaders as they were parsed, for debugging.
    return { data, errors, columnHeaders };
  }

  // Process data rows
  for (let i = 1; i < nonEmptyLines.length; i++) {
    const line = nonEmptyLines[i];
    // No need to skip empty lines here due to nonEmptyLines filter

    const values = line.split(','); // Basic split, doesn't handle commas in quotes well.

    // The check for values.length !== columnHeaders.length was intentionally commented out in the prompt.
    // If it were active, it might be too strict for CSVs where trailing empty optional columns aren't explicitly comma-separated.
    // Example: header1,header2,optionalHeader3
    //          value1,value2
    // This would fail if the check was active.
    // A more robust CSV parser library would be needed for complex cases.

    const rowData: RawCsvQuestion = {};
    columnHeaders.forEach((header, index) => {
      // Only assign if value exists, to avoid undefined strings for completely missing trailing columns
      if (values[index] !== undefined) {
        rowData[header] = values[index].trim();
      } else {
        // If a header exists but there's no corresponding value (e.g. line ends prematurely)
        // we can choose to set it as undefined or an empty string.
        // Setting to undefined is cleaner for an optional field.
        rowData[header] = undefined;
      }
    });
    data.push(rowData);
  }

  return { data, errors, columnHeaders };
}

export function exportQuestionsToCsv(questions: Question[]): string {
  if (!questions || questions.length === 0) {
    return "";
  }

  const headers = [
    'id', 'text', 'referential', 'theme',
    'optionA', 'optionB', 'optionC', 'optionD',
    'correctAnswer', 'isEliminatory', 'timeLimit',
    'imageName', 'type'
  ];

  const csvRows = [headers.join(',')]; // Header row

  questions.forEach(q => {
    const options = q.options || [];
    // Corrected: Accessing correctAnswer for multiple-choice
    // Assuming q.correctAnswer is an index for single-choice multiple-choice, or an array of indices for multiple-answer
    // For simple CSV export, let's assume single correct answer index for 'A', 'B', 'C', 'D' mapping
    let correctAnswerLetter = '';
    if (q.type === 'multiple-choice' && typeof q.correctAnswer === 'number') {
       if (q.correctAnswer >= 0 && q.correctAnswer < 4) {
        correctAnswerLetter = String.fromCharCode(65 + q.correctAnswer); // A, B, C, D
       }
    } else if (q.type === 'true-false' && typeof q.correctAnswer === 'number') {
      // Example: 0 for True, 1 for False, if options are ['True', 'False']
      // This needs to be consistent with how true/false questions store answers.
      // For this example, let's assume options[0] is 'True', options[1] is 'False'
      // and correctAnswer is the index. So, 'A' for True, 'B' for False if mapped that way.
      // Or, more directly, 'TRUE' / 'FALSE' strings.
      // The prompt implies 'A','B','C','D' mapping is primary, so this part might need adjustment
      // based on actual true/false data structure.
      // For now, let's stick to A/B if options are present for true/false.
      if (q.correctAnswer === 0) correctAnswerLetter = 'A'; // Assuming option A is True
      else if (q.correctAnswer === 1) correctAnswerLetter = 'B'; // Assuming option B is False
    }
    // If q.correctAnswer is an array (for multiple select), this logic would need to be different,
    // e.g., "A;B" or similar. The current headers imply one correct answer.

    const row = [
      q.id,
      `"${q.text?.replace(/"/g, '""') || ''}"`, // Quote text and escape double quotes
      q.referential || '',
      q.theme || '', // Assuming q.theme is of type QuestionTheme which is a string
      `"${(options[0] || '').replace(/"/g, '""')}"`,
      `"${(options[1] || '').replace(/"/g, '""')}"`,
      `"${(options[2] || '').replace(/"/g, '""')}"`,
      `"${(options[3] || '').replace(/"/g, '""')}"`,
      correctAnswerLetter,
      q.isEliminatory ? 'TRUE' : 'FALSE',
      q.timeLimit !== undefined ? q.timeLimit.toString() : '',
      `"${q.image?.replace(/"/g, '""') || ''}"`, // Assuming q.image is the imageName
      q.type || 'multiple-choice'
    ];
    csvRows.push(row.join(','));
  });

  return csvRows.join('\n');
}
