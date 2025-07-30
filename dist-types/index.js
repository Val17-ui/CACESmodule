"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.questionCategories = exports.questionTypes = exports.questionThemes = exports.referentialLimits = exports.referentials = exports.CACESReferential = exports.QuestionType = void 0;
var QuestionType;
(function (QuestionType) {
    QuestionType["QCM"] = "multiple-choice";
    QuestionType["QCU"] = "single-choice";
    QuestionType["TrueFalse"] = "true-false";
})(QuestionType || (exports.QuestionType = QuestionType = {}));
var CACESReferential;
(function (CACESReferential) {
    CACESReferential["R482"] = "R482";
    CACESReferential["R484"] = "R484";
    CACESReferential["R485"] = "R485";
    CACESReferential["R486"] = "R486";
    CACESReferential["R489"] = "R489";
    CACESReferential["R490"] = "R490";
})(CACESReferential || (exports.CACESReferential = CACESReferential = {}));
exports.referentials = {
    'R482': 'Engins de chantier',
    'R484': 'Ponts roulants',
    'R485': 'Chariots de manutention',
    'R486': 'Plates-formes élévatrices',
    'R489': 'Chariots élévateurs',
    'R490': 'Grues de chargement'
};
exports.referentialLimits = {
    'R482': { min: 20, max: 45 },
    'R484': { min: 25, max: 50 },
    'R485': { min: 20, max: 40 },
    'R486': { min: 25, max: 50 },
    'R489': { min: 20, max: 50 },
    'R490': { min: 30, max: 55 }
};
exports.questionThemes = {
    reglementation: 'Réglementation',
    securite: 'Sécurité',
    technique: 'Technique'
};
exports.questionTypes = (_a = {},
    _a[QuestionType.QCM] = 'Questionnaire à choix multiples',
    _a[QuestionType.QCU] = 'Questionnaire à choix unique',
    _a[QuestionType.TrueFalse] = 'Vrai/Faux',
    _a);
exports.questionCategories = {
    theory: 'Théorie',
    practice: 'Pratique',
    eliminatory: 'Éliminatoire'
};
