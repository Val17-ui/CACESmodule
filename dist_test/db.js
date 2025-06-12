import Dexie from 'dexie';
export class MySubClassedDexie extends Dexie {
    constructor() {
        super('myDatabase');
        Object.defineProperty(this, "questions", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        }); // Second type arg is the primary key type
        this.version(1).stores({
            // Define schema for QuestionWithId. All fields to be indexed are listed.
            // `image` (Blob) is typically not indexed directly.
            questions: '++id, text, type, correctAnswer, timeLimit, isEliminatory, referential, theme, createdAt, usageCount, correctResponseRate, *options'
            // Indexing 'options' as a multiEntry index if searching by options is needed.
        });
    }
}
export const db = new MySubClassedDexie();
// Service functions
export const addQuestion = async (question) => {
    try {
        // Ensure `image` is either a Blob or undefined, not null, if Dexie has issues with null.
        // However, Dexie v4 should handle null fine. Let's assume it's okay or handled by QuestionWithId type.
        const id = await db.questions.add(question);
        return id;
    }
    catch (error) {
        console.error("Error adding question: ", error);
        // Consider re-throwing or returning a more specific error/result
    }
};
export const getAllQuestions = async () => {
    try {
        const questions = await db.questions.toArray();
        return questions;
    }
    catch (error) {
        console.error("Error getting all questions: ", error);
        return []; // Return empty array or re-throw
    }
};
export const getQuestionById = async (id) => {
    try {
        const question = await db.questions.get(id);
        return question;
    }
    catch (error) {
        console.error(`Error getting question with id ${id}: `, error);
        // Consider re-throwing
    }
};
export const updateQuestion = async (id, updates) => {
    try {
        await db.questions.update(id, updates);
        return id;
    }
    catch (error) {
        console.error(`Error updating question with id ${id}: `, error);
        // Consider re-throwing
    }
};
export const deleteQuestion = async (id) => {
    try {
        await db.questions.delete(id);
    }
    catch (error) {
        console.error(`Error deleting question with id ${id}: `, error);
        // Consider re-throwing
    }
};
