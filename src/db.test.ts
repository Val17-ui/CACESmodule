import { addQuestion, getAllQuestions, getQuestionById, updateQuestion, deleteQuestion, QuestionWithId } from './db.js';
// Types are used for casting and defining sample data structure, not for runtime enum values here.
import { QuestionTheme, ReferentialType } from './types/index.js';

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
    type: QuestionTypeForTest.QCM,
    options: ['Paris', 'London', 'Berlin', 'Madrid'],
    correctAnswer: 'Paris', // Storing answer text
    timeLimit: 30,
    isEliminatory: false,
    referential: 'R489' as ReferentialType, // Use string literal, cast for type safety
    theme: 'reglementation' as QuestionTheme, // Use string literal, cast for type safety
    image: mockImageBlob,
    createdAt: new Date().toISOString(),
    usageCount: 0,
    correctResponseRate: 0,
  };

  try {
    newQuestionId = await addQuestion(sampleQuestion);
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
            log(`FAILURE: Mock image blob was not created/available, but retrieved image is not undefined/null. Image: ${JSON.stringify(retrievedQuestion.image)}`);
        }
      } else if (retrievedQuestion.image instanceof Blob) {
        if (retrievedQuestion.image.size === mockImageBlob.size && retrievedQuestion.image.type === mockImageBlob.type) {
            log(`SUCCESS: Question image is a Blob with matching size (${retrievedQuestion.image.size}) and type (${retrievedQuestion.image.type}).`);
        } else {
            log(`FAILURE: Question image is a Blob, but size or type does not match. Retrieved: size=${retrievedQuestion.image.size}, type=${retrievedQuestion.image.type}. Expected: size=${mockImageBlob.size}, type=${mockImageBlob.type}`);
        }
      } else {
        log(`FAILURE: Question image is not a valid Blob. Expected Blob, Got: ${JSON.stringify(retrievedQuestion.image)}`);
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
