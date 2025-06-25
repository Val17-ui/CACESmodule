import { StorageManager } from './StorageManager';
import { db, addQuestion, QuestionWithId } from '../db'; // For test data setup
import { CACESReferential, QuestionTheme } from '../types';

// Helper to run console logs (similar to db.test.ts)
const log = (message: string, ...args: any[]) => {
  if (args.length > 0) {
    console.log(message, args);
  } else {
    console.log(message);
  }
};

const setupTestData = async () => {
  // Clear existing questions to ensure a clean slate for these tests
  // (Ideally, Dexie-mocked would be better, but for now, direct DB interaction)
  const allQuestions = await db.questions.toArray();
  await db.questions.bulkDelete(allQuestions.map(q => q.id!));
  log("Cleared existing questions from DB for test setup.");

  const testQuestions: QuestionWithId[] = [
    { text: 'Q1 R489 Secu A', type: 'multiple-choice', options: ['1'], correctAnswer: '1', isEliminatory: false, referential: CACESReferential.R489, theme: 'securite_A' as QuestionTheme, createdAt: new Date().toISOString() },
    { text: 'Q2 R489 Secu A', type: 'multiple-choice', options: ['1'], correctAnswer: '1', isEliminatory: false, referential: CACESReferential.R489, theme: 'securite_A' as QuestionTheme, createdAt: new Date().toISOString() },
    { text: 'Q1 R489 Secu B', type: 'multiple-choice', options: ['1'], correctAnswer: '1', isEliminatory: false, referential: CACESReferential.R489, theme: 'securite_B' as QuestionTheme, createdAt: new Date().toISOString() },
    { text: 'Q1 R489 Tech A', type: 'multiple-choice', options: ['1'], correctAnswer: '1', isEliminatory: false, referential: CACESReferential.R489, theme: 'technique_A' as QuestionTheme, createdAt: new Date().toISOString() },
    { text: 'Q1 R482 Reg A', type: 'multiple-choice', options: ['1'], correctAnswer: '1', isEliminatory: false, referential: CACESReferential.R482, theme: 'reglementation_A' as QuestionTheme, createdAt: new Date().toISOString() },
  ];

  for (const q of testQuestions) {
    await addQuestion(q);
  }
  log(`Added ${testQuestions.length} test questions for StorageManager tests.`);
};

const runStorageManagerTests = async () => {
  log("--- Starting StorageManager Tests ---");
  await setupTestData();

  // Test 1: getAllBaseThemesForReferential
  log("\nTest 1: getAllBaseThemesForReferential");
  const r489Themes = await StorageManager.getAllBaseThemesForReferential(CACESReferential.R489);
  log(`Base themes for R489: ${r489Themes.join(', ')}`);
  if (r489Themes.length === 2 && r489Themes.includes('securite') && r489Themes.includes('technique')) {
    log("SUCCESS: getAllBaseThemesForReferential for R489 returned correct themes.");
  } else {
    log(`FAILURE: getAllBaseThemesForReferential for R489. Expected ['securite', 'technique'], Got [${r489Themes.join(', ')}]`);
  }

  const r482Themes = await StorageManager.getAllBaseThemesForReferential(CACESReferential.R482);
  log(`Base themes for R482: ${r482Themes.join(', ')}`);
  if (r482Themes.length === 1 && r482Themes.includes('reglementation')) {
    log("SUCCESS: getAllBaseThemesForReferential for R482 returned correct themes.");
  } else {
    log(`FAILURE: getAllBaseThemesForReferential for R482. Expected ['reglementation'], Got [${r482Themes.join(', ')}]`);
  }

  const r484Themes = await StorageManager.getAllBaseThemesForReferential(CACESReferential.R484); // No data for R484
  log(`Base themes for R484: ${r484Themes.join(', ')}`);
  if (r484Themes.length === 0) {
    log("SUCCESS: getAllBaseThemesForReferential for R484 (no data) returned empty array.");
  } else {
    log(`FAILURE: getAllBaseThemesForReferential for R484. Expected [], Got [${r484Themes.join(', ')}]`);
  }

  // Test 2: getAllBlockIdentifiersForTheme
  log("\nTest 2: getAllBlockIdentifiersForTheme");
  const r489SecuBlocks = await StorageManager.getAllBlockIdentifiersForTheme(CACESReferential.R489, 'securite');
  log(`Block IDs for R489/securite: ${r489SecuBlocks.join(', ')}`);
  if (r489SecuBlocks.length === 2 && r489SecuBlocks.includes('A') && r489SecuBlocks.includes('B')) {
    log("SUCCESS: getAllBlockIdentifiersForTheme for R489/securite returned correct blocks.");
  } else {
    log(`FAILURE: getAllBlockIdentifiersForTheme for R489/securite. Expected ['A', 'B'], Got [${r489SecuBlocks.join(', ')}]`);
  }

  const r489TechBlocks = await StorageManager.getAllBlockIdentifiersForTheme(CACESReferential.R489, 'technique');
  log(`Block IDs for R489/technique: ${r489TechBlocks.join(', ')}`);
  if (r489TechBlocks.length === 1 && r489TechBlocks.includes('A')) {
    log("SUCCESS: getAllBlockIdentifiersForTheme for R489/technique returned correct blocks.");
  } else {
    log(`FAILURE: getAllBlockIdentifiersForTheme for R489/technique. Expected ['A'], Got [${r489TechBlocks.join(', ')}]`);
  }

  // Test 3: getQuestionsForBlock
  log("\nTest 3: getQuestionsForBlock");
  const r489SecuAQuestions = await StorageManager.getQuestionsForBlock(CACESReferential.R489, 'securite', 'A');
  log(`Questions for R489/securite/A: ${r489SecuAQuestions.length}`);
  if (r489SecuAQuestions.length === 2) {
    log("SUCCESS: getQuestionsForBlock for R489/securite/A returned correct number of questions.");
  } else {
    log(`FAILURE: getQuestionsForBlock for R489/securite/A. Expected 2, Got ${r489SecuAQuestions.length}`);
  }

  const r489TechAQuestions = await StorageManager.getQuestionsForBlock(CACESReferential.R489, 'technique', 'A');
  log(`Questions for R489/technique/A: ${r489TechAQuestions.length}`);
  if (r489TechAQuestions.length === 1) {
    log("SUCCESS: getQuestionsForBlock for R489/technique/A returned correct number of questions.");
  } else {
    log(`FAILURE: getQuestionsForBlock for R489/technique/A. Expected 1, Got ${r489TechAQuestions.length}`);
  }

  log("\n--- Finished StorageManager Tests ---");
};

// Expose a function to run all tests that can be called from an HTML file or another script
(window as any).runAllAppTests = async () => {
  // We could also import and run runDBTests from 'db.test.ts' here if we adapt it.
  await runStorageManagerTests();
};

log("StorageManager.test.ts loaded. Call runAllAppTests() to execute tests.");

export { runStorageManagerTests }; // Export if needed by other modules, e.g. a main test runner
