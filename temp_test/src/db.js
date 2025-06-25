"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteQuestion = exports.updateQuestion = exports.getQuestionById = exports.getAllQuestions = exports.addQuestion = exports.db = exports.MySubClassedDexie = void 0;
const dexie_1 = __importDefault(require("dexie"));
// QuestionnaireWithId interface removed as Questionnaire entity is no longer stored.
class MySubClassedDexie extends dexie_1.default {
    // questionnaires table removed.
    constructor() {
        super('myDatabase');
        this.version(1).stores({
            // Define schema for QuestionWithId. All fields to be indexed are listed.
            // `image` (Blob) is typically not indexed directly.
            questions: '++id, text, type, correctAnswer, timeLimit, isEliminatory, referential, theme, createdAt, usageCount, correctResponseRate, *options'
            // Indexing 'options' as a multiEntry index if searching by options is needed.
            // questionnaires table definition removed.
        });
    }
}
exports.MySubClassedDexie = MySubClassedDexie;
exports.db = new MySubClassedDexie();
// Service functions
const addQuestion = async (question) => {
    try {
        // Ensure `image` is either a Blob or undefined, not null, if Dexie has issues with null.
        // However, Dexie v4 should handle null fine. Let's assume it's okay or handled by QuestionWithId type.
        const id = await exports.db.questions.add(question);
        return id;
    }
    catch (error) {
        console.error("Error adding question: ", error);
        // Consider re-throwing or returning a more specific error/result
    }
};
exports.addQuestion = addQuestion;
const getAllQuestions = async () => {
    try {
        const questions = await exports.db.questions.toArray();
        return questions;
    }
    catch (error) {
        console.error("Error getting all questions: ", error);
        return []; // Return empty array or re-throw
    }
};
exports.getAllQuestions = getAllQuestions;
const getQuestionById = async (id) => {
    try {
        const question = await exports.db.questions.get(id);
        return question;
    }
    catch (error) {
        console.error(`Error getting question with id ${id}: `, error);
        // Consider re-throwing
    }
};
exports.getQuestionById = getQuestionById;
const updateQuestion = async (id, updates) => {
    try {
        await exports.db.questions.update(id, updates);
        return id;
    }
    catch (error) {
        console.error(`Error updating question with id ${id}: `, error);
        // Consider re-throwing
    }
};
exports.updateQuestion = updateQuestion;
const deleteQuestion = async (id) => {
    try {
        await exports.db.questions.delete(id);
    }
    catch (error) {
        console.error(`Error deleting question with id ${id}: `, error);
        // Consider re-throwing
    }
};
exports.deleteQuestion = deleteQuestion;
