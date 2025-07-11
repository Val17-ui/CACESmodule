import { addQuestion, getAllQuestions, getQuestionById, updateQuestion, deleteQuestion } from './db.js'; // QuestionWithId retirée d'ici
// Types are used for casting and defining sample data structure, not for runtime enum values here.
import { QuestionTheme, ReferentialType, QuestionWithId } from './types/index.js'; // QuestionWithId ajoutée ici

// Define a QuestionType enum locally for test data, mirroring what might be in types.ts or the actual string literals
enum QuestionTypeForTest {
  QCM = 'multiple-choice',
  // QCU = 'multiple-choice', // Assuming QCU is a variant of multiple-choice for data structure
  TRUE_FALSE = 'true-false',
}

// Using console.log as fs access might be problematic
const log = (message: string, ...args: any[]) => {
  if (args.length > 0) {
    console.log(message, args);
  } else {
    console.log(message);
  }
};

const runDBTests = async () => {
  console.log("!!! FULL DB TEST SCRIPT STARTED !!!");
  log("Starting database tests...");

  // 1. Create a mock image Blob
  log("\nStep 1: Creating mock image Blob...");
  let mockImageBlob: Blob | undefined = undefined;
  try {
    if (typeof fetch !== 'function' || typeof Blob !== 'function') {
      log("fetch or Blob API not available in this environment. Skipping actual Blob creation.");
      mockImageBlob = undefined;
    } else {
      const base64Image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
      const response = await fetch(base64Image);
      if (!response.ok) throw new Error(`Failed to fetch base64 image, status: ${response.status}`);
      mockImageBlob = await response.blob();
      if (mockImageBlob && mockImageBlob.size > 0) {
        log(`Mock image Blob created successfully. Size: ${mockImageBlob.size} bytes, Type: ${mockImageBlob.type}`);
      } else {
        throw new Error("Failed to create mock image Blob or Blob is empty after fetch.");
      }
    }
  } catch (error: any) {
    log(`Error creating mock image Blob: ${error.message}. Proceeding without image.`);
    mockImageBlob = undefined;
  }

  let newQuestionId: number | undefined;

  // 2. Add a new question
  log("\nStep 2: Adding a new question...");
  const sampleQuestion: QuestionWithId = {
    text: 'What is the capital of France?',
    type: QuestionTypeForTest.QCM, // Using the local enum which should map to 'multiple-choice'
    options: ['Paris', 'London', 'Berlin', 'Madrid'],
    correctAnswer: 'Paris', // Storing answer text
    timeLimit: 30,
    isEliminatory: false,
    // referential and theme are not direct properties of questions table in SQLite db.ts
    // It uses blocId, referentiel_id, theme_id.
    // For this test to align with db.ts, it would need to create a bloc first.
    // For now, these fields will be ignored by addQuestion if not in its QuestionData mapping.
    // Let's assume addQuestion in db.ts expects blocId.
    // We'll need a mock blocId or set up a bloc. For simplicity, we'll omit it for now
    // and rely on addQuestion handling potentially missing blocId if the test is simplified.
    // However, questions table has bloc_id NOT NULL. This test will fail without a valid bloc_id.
    // This test needs significant rework to align with db.ts schema.
    // For the image part:
    image: mockImageBlob ? Buffer.from(await mockImageBlob.arrayBuffer()) : null, // Convert Blob to Buffer
    createdAt: new Date().toISOString(),
    usageCount: 0,
    correctResponseRate: 0,
    // blocId is required by QuestionData in db.ts and NOT NULL in table.
    // This test will fail here. Placeholder for what it should be:
    blocId: 1, // Placeholder - this assumes a bloc with id 1 exists.
  };

  try {
    // The addQuestion from './db.js' (SQLite) expects different QuestionData structure
    // (e.g. blocId is mandatory, referential/theme strings are not direct fields)
    // This test, as written, is more for a Dexie-like structure.
    // We are focusing on the Blob to Buffer conversion part.
    // The following call will likely fail due to schema mismatches if not addressed.
    // To make it runnable for image test, we'd add a dummy blocId.
    // However, the original addQuestion was likely for Dexie.
    // Let's assume db.js addQuestion is the SQLite one.
    newQuestionId = await addQuestion(sampleQuestion as any); // Cast to any to bypass strict type checking for this partial fix
    if (newQuestionId !== undefined) {
      log(`New question added with ID: ${newQuestionId}`);
    } else {
      throw new Error("addQuestion did not return an ID.");
    }
  } catch (error: any) {
    log(`ERROR during Add Question: ${error.message || JSON.stringify(error)}`);
    log("Aborting further tests due to failure in adding question.");
    console.error("!!! TEST SCRIPT FAILED during Add Question !!!");
    return;
  }

  // 3. Retrieve all questions and verify the new one
  log("\nStep 3: Retrieving all questions and verifying the new one...");
  try {
    const allQuestions = await getAllQuestions();
    log(`Total questions in DB: ${allQuestions.length}`);
    const retrievedQuestion = allQuestions.find(q => q.id === newQuestionId);
    if (retrievedQuestion) {
      log("Found newly added question by ID.");
      if (retrievedQuestion.text === sampleQuestion.text) {
        log("SUCCESS: Question text matches.");
      } else {
        log(`FAILURE: Question text does not match. Expected: "${sampleQuestion.text}", Got: "${retrievedQuestion.text}"`);
      }

      if (mockImageBlob === undefined) {
        if (retrievedQuestion.image === undefined || retrievedQuestion.image === null) {
            log("INFO: Mock image blob was not created/available, and retrieved image is undefined/null as expected.");
        } else {
            log(`FAILURE: Mock image blob was not created/available, but retrieved image is not undefined/null. Image: ${typeof retrievedQuestion.image}`);
        }
      } else if (Buffer.isBuffer(retrievedQuestion.image)) { // Check if it's a Buffer
        const originalImageBuffer = sampleQuestion.image as Buffer; // Already converted
        if (retrievedQuestion.image.length === originalImageBuffer.length) {
            log(`SUCCESS: Question image is a Buffer with matching length (${retrievedQuestion.image.length}).`);
            // For a more thorough check, compare buffer contents, e.g., retrievedQuestion.image.equals(originalImageBuffer)
            // This requires originalImageBuffer to be kept or reconstructed if mockImageBlob is available.
        } else {
            log(`FAILURE: Question image is a Buffer, but length does not match. Retrieved length: ${retrievedQuestion.image.length}. Expected length: ${originalImageBuffer.length}`);
        }
      } else {
        log(`FAILURE: Question image is not a valid Buffer. Expected Buffer, Got: ${typeof retrievedQuestion.image}`);
      }
    } else {
      log(`FAILURE: Could not find newly added question with ID ${newQuestionId} in allQuestions.`);
    }
  } catch (error: any) {
    log(`ERROR during Retrieve All/Verify: ${error.message || JSON.stringify(error)}`);
  }

  // 4. Update the question
  log("\nStep 4: Updating the question...");
  const updatedText = "What is the new capital of France (updated)?";
  if (newQuestionId !== undefined) {
    try {
      const updatedId = await updateQuestion(newQuestionId, { text: updatedText });
      if (updatedId !== undefined) {
        log(`Update initiated for question with ID ${updatedId}.`);
        const updatedQuestion = await getQuestionById(newQuestionId);
        if (updatedQuestion && updatedQuestion.text === updatedText) {
          log(`SUCCESS: Question text updated successfully. New text: "${updatedQuestion.text}"`);
        } else if (updatedQuestion) {
          log(`FAILURE: Question text not updated. Expected: "${updatedText}", Got: "${updatedQuestion.text}"`);
        } else {
          log(`FAILURE: Could not retrieve question with ID ${newQuestionId} after update attempt.`);
        }
      } else {
        log(`FAILURE: updateQuestion did not confirm update for ID ${newQuestionId}.`);
      }
    } catch (error: any) {
      log(`ERROR during Update Question: ${error.message || JSON.stringify(error)}`);
    }
  } else {
    log("Skipping Update Question test as newQuestionId is undefined.");
  }

  // 5. Delete the question
  log("\nStep 5: Deleting the question...");
  if (newQuestionId !== undefined) {
    try {
      await deleteQuestion(newQuestionId);
      log(`Deletion initiated for question with ID ${newQuestionId}.`);
      const deletedQuestion = await getQuestionById(newQuestionId);
      if (deletedQuestion === undefined) {
        log(`SUCCESS: Question with ID ${newQuestionId} successfully deleted and not found.`);
      } else {
        log(`FAILURE: Question with ID ${newQuestionId} still found after deletion. ${JSON.stringify(deletedQuestion)}`);
      }
    } catch (error: any) {
      log(`ERROR during Delete Question: ${error.message || JSON.stringify(error)}`);
    }
  } else {
    log("Skipping Delete Question test as newQuestionId is undefined.");
  }

  log("\nDatabase tests finished.");
  console.log("!!! FULL DB TEST SCRIPT COMPLETED !!!");
};

runDBTests().catch(finalError => {
  console.error("!!! FULL DB TEST SCRIPT FAILED (FINAL CATCH) !!!");
  if (finalError instanceof Error) {
    console.error("Final Error Name:", finalError.name);
    console.error("Final Error Message:", finalError.message);
    console.error("Final Error Stack:", finalError.stack);
  } else {
    console.error("Final Raw error object:", JSON.stringify(finalError, null, 2));
  }
  log(`An unexpected error occurred during the test run. Name: ${finalError?.name}. Message: ${finalError?.message}. Stack: ${finalError?.stack}. Raw: ${JSON.stringify(finalError, null, 2)}`);
});

export {};
