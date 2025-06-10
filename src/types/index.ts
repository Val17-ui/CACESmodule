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
  organization?: string;
  identificationCode?: string;
  deviceId?: number;
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
  theme: QuestionTheme;
  image?: string;
  createdAt: string;
  usageCount: number;
  correctResponseRate: number;
}

export interface QuestionStatistics {
  questionId: string;
  usageCount: number;
  correctResponses: number;
  totalResponses: number;
  correctResponseRate: number;
  lastUsed?: string;
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
  totalQuestions: number;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceMapping {
  deviceId: number;
  hardwareId: string;
  isActive: boolean;
}

export interface GeneralSettings {
  deviceMappings: DeviceMapping[];
  maxDevices: number;
}

export type ReferentialType = 'R482' | 'R484' | 'R485' | 'R486' | 'R489' | 'R490';

export const referentials: Record<ReferentialType, string> = {
  'R482': 'Engins de chantier',
  'R484': 'Ponts roulants',
  'R485': 'Chariots de manutention',
  'R486': 'Plates-formes élévatrices',
  'R489': 'Chariots élévateurs',
  'R490': 'Grues de chargement'
};

export const referentialLimits: Record<ReferentialType, { min: number; max: number }> = {
  'R482': { min: 20, max: 45 },
  'R484': { min: 25, max: 50 },
  'R485': { min: 20, max: 40 },
  'R486': { min: 25, max: 50 },
  'R489': { min: 20, max: 50 },
  'R490': { min: 30, max: 55 }
};

export type QuestionTheme = 
  | 'reglementation'
  | 'securite'
  | 'technique';

export const questionThemes: Record<QuestionTheme, string> = {
  reglementation: 'Réglementation',
  securite: 'Sécurité',
  technique: 'Technique'
};

export type QuestionCategory = 'theory' | 'practice' | 'eliminatory';

export const questionCategories: Record<QuestionCategory, string> = {
  theory: 'Théorie',
  practice: 'Pratique',
  eliminatory: 'Éliminatoire'
};