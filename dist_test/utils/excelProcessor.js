import ExcelJS from 'exceljs';
export async function processExcel(file) {
    return new Promise(async (resolve, reject) => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(arrayBuffer);
            const worksheet = workbook.getWorksheet(1); // Get the first worksheet
            if (!worksheet) {
                throw new Error('No worksheet found in the Excel file');
            }
            const questions = [];
            // Skip header row if it exists
            let startRow = 1;
            const firstRow = worksheet.getRow(1);
            const firstCellValue = firstRow.getCell(1).value?.toString().toLowerCase();
            if (firstCellValue && (firstCellValue.includes('question') ||
                firstCellValue.includes('réponse') ||
                firstCellValue.includes('image'))) {
                startRow = 2;
            }
            // Process each row
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber >= startRow) {
                    const questionText = row.getCell(1).value?.toString() || '';
                    if (!questionText.trim()) {
                        return; // Skip empty rows
                    }
                    // Get correct answer (assuming "Vrai" or "Faux" in column 2)
                    const answerText = row.getCell(2).value?.toString().toLowerCase() || '';
                    const correctAnswer = answerText.includes('vrai') || answerText === '1' || answerText === 'true';
                    // Optional: Get image path if available (column 3)
                    const imagePath = row.getCell(3).value?.toString() || undefined;
                    // Optional: Get duration if available (column 4)
                    const durationCell = row.getCell(4).value;
                    const duration = typeof durationCell === 'number' ? durationCell : undefined;
                    questions.push({
                        question: questionText,
                        correctAnswer,
                        imagePath: imagePath?.trim() || undefined,
                        duration
                    });
                }
            });
            if (questions.length === 0) {
                throw new Error('No valid questions found in the Excel file');
            }
            resolve(questions);
        }
        catch (error) {
            console.error('Error processing Excel file:', error);
            reject(error);
        }
    });
}
