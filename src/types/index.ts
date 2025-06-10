export interface User {
  id: string;
  name: string;
  role: 'admin' | 'instructor' | 'viewer';
}

export interface Session {
  id: string;
  name: string;
  date: string;
  referential: string;
  status: 'planned' | 'in-progress' | 'completed' | 'cancelled';
  participantsCount: number;
}

export interface Participant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  hasSigned: boolean;
  score?: number;
  passed?: boolean;
}

export interface Question {
  id: string;
  text: string;
  type: 'multiple-choice' | 'true-false';
  options: string[];
  correctAnswer: number | number[];
  timeLimit: number;
  isEliminatory: boolean;
  referential: string;
  category: QuestionCategory;
  theme: QuestionTheme;
}

export interface Questionnaire {
  id: string;
  name: string;
  referential: string;
  questions: Question[];
  passingThreshold: number;
  themeDistribution: Record<QuestionTheme, number>;
  eliminatoryCount: number;
  isRandomized: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ReferentialType = 'R389' | 'R486' | 'R482' | 'R484' | 'R485' | 'R489' | 'R490';

export const referentials: Record<ReferentialType, string> = {
  'R389': 'Chariots automoteurs',
  'R486': 'Plates-formes élévatrices',
  'R482': 'Engins de chantier',
  'R484': 'Ponts roulants',
  'R485': 'Chariots de manutention',
  'R489': 'Chariots élévateurs',
  'R490': 'Grues de chargement'
};

export type QuestionTheme = 
  | 'reglementation'
  | 'securite'
  | 'technique'
  | 'environnement'
  | 'maintenance';

export const questionThemes: Record<QuestionTheme, string> = {
  reglementation: 'Réglementation',
  securite: 'Sécurité',
  technique: 'Technique',
  environnement: 'Environnement',
  maintenance: 'Maintenance'
};

export type QuestionCategory = 'theory' | 'practice' | 'eliminatory';

export const questionCategories: Record<QuestionCategory, string> = {
  theory: 'Théorie',
  practice: 'Pratique',
  eliminatory: 'Éliminatoire'
};