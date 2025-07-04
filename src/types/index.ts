// src/types/index.ts

export interface User {
  id: string;
  name: string;
  role: 'admin' | 'instructor' | 'viewer';
}

// Nouvelle interface Session pour le stockage Dexie
export interface Session {
  id?: number; // Auto-incremented primary key par Dexie
  nomSession: string;
  dateSession: string; // ISO string date
  referentiel: CACESReferential | string; // Utiliser CACESReferential, ou string pour flexibilité
  participants: Participant[]; // Utilise la nouvelle interface Participant ci-dessous
  selectionBlocs: SelectedBlock[]; // Blocs thématiques sélectionnés pour cette session
  donneesOrs?: Blob | null; // Stockage du fichier .ors généré
  status?: 'planned' | 'in-progress' | 'completed' | 'cancelled' | 'ready'; // Statut optionnel, ajout de 'ready'
  location?: string; // Lieu de la session
  questionMappings?: Array<{dbQuestionId: number, slideGuid: string | null, orderInPptx: number}>;
  notes?: string; // Notes pour la session
  createdAt?: string;
  updatedAt?: string;
  trainerId?: number; // ID du formateur assigné à la session (number pour correspondre à Trainer.id)
  testSlideGuid?: string | null; // GUID de la slide de la question test pour cette session
}

// Interface pour stocker les métadonnées des questions d'une session
export interface SessionQuestion {
  id?: number; // Auto-incremented primary key par Dexie
  sessionId: number; // Clé étrangère vers Session.id
  dbQuestionId: number; // Clé étrangère vers QuestionWithId.id (l'ID original de la question)
  slideGuid: string; // GUID de la slide dans le PPTX généré
  text: string; // Texte de la question (snapshot)
  options: string[]; // Options de réponse (snapshot)
  correctAnswer: string; // Réponse correcte (snapshot)
  blockId: string; // Identifiant du bloc dont la question provient (snapshot)
}

// Interface pour stocker les métadonnées des boîtiers assignés à une session
export interface SessionBoitier {
  id?: number; // Auto-incremented primary key par Dexie
  sessionId: number; // Clé étrangère vers Session.id
  participantId: string; // Identifiant unique du participant au sein de la session (par exemple, un UUID ou index)
  visualId: number; // Numéro visuel du boîtier dans l'interface (1, 2, 3...)
  serialNumber: string; // Numéro de série physique du boîtier (OMBEA ID)
  participantName: string; // Nom complet du participant pour référence
}

// Nouveau type pour les formateurs
export interface Trainer {
  id?: number; // Sera auto-incrémenté par Dexie
  name: string;
  isDefault?: 0 | 1; // 0 pour false, 1 pour true
}

// Interface pour le mappage Question DB <-> Slide PPTX (par session)
// Doit correspondre à celle dans val17PptxGenerator.ts
export interface QuestionMapping {
  dbQuestionId: number;
  slideGuid: string | null;
  orderInPptx: number;
  theme: string;   // AJOUTÉ - thème de base de la question (ex: "securite")
  blockId: string; // AJOUTÉ - ID du bloc de la question (ex: "A")
}

// Nouvelle interface Participant pour les listes dans une Session
export interface Participant {
  // idBoitier: string; // Identifiant du boîtier de vote - REMPLACÉ par assignedGlobalDeviceId
  nom: string;
  prenom: string;
  identificationCode?: string; // Code d'identification optionnel
  score?: number; // Score total du participant pour cette session
  reussite?: boolean; // Statut de réussite du participant pour cette session
  assignedGlobalDeviceId?: number | null; // Référence à GlobalDevice.id (VotingDevice.id)
}

// Nouvelle interface pour décrire un bloc thématique sélectionné
export interface SelectedBlock {
  theme: string; // e.g., "securite"
  blockId: string; // e.g., "A", "B" ou un ID numérique spécifique du bloc
}

// Nouvelle interface pour stocker les résultats d'une session
export interface SessionResult {
  id?: number; // Auto-incremented primary key par Dexie
  sessionId: number; // Clé étrangère vers Session.id
  // Doit correspondre à l'ID de la question DANS LA DB (QuestionWithId.id)
  questionId: number;
  participantIdBoitier: string; // Identifiant du boîtier du participant
  answer: string; // Réponse donnée (ID de l'option de réponse pour QCM/QCU)
  isCorrect: boolean; // Si la réponse était correcte
  pointsObtained: number; // Points obtenus pour cette réponse spécifique
  timestamp: string; // ISO string date de la réponse
}

export enum QuestionType {
  QCM = 'multiple-choice',
  QCU = 'single-choice',
  TrueFalse = 'true-false'
}

// Interface pour les questions telles qu'elles pourraient être définies initialement
// L'objet stocké dans Dexie (`QuestionWithId` dans `db.ts`) aura un `id: number`
export interface Question {
  id: string; // ID original de la question (non celui de la DB Dexie)
  text: string;
  type: QuestionType;
  options: string[];
  correctAnswer: string;
  timeLimit?: number;
  isEliminatory: boolean;
  referentiel: CACESReferential;
  theme: string;
  image?: Blob;
  createdAt?: string;
  updatedAt?: string;
  lastUsedAt?: string;
  usageCount?: number;
  correctResponseRate?: number;
  slideGuid?: string; // Ajout du SlideGUID
}

export interface QuestionStatistics {
  questionId: string;
  usageCount: number;
  correctResponses: number;
  totalResponses: number;
  correctResponseRate: number;
  lastUsed?: string;
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

export enum CACESReferential {
  R482 = 'R482',
  R484 = 'R484',
  R485 = 'R485',
  R486 = 'R486',
  R489 = 'R489',
  R490 = 'R490'
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

export const questionTypes: Record<QuestionType, string> = {
  [QuestionType.QCM]: 'Questionnaire à choix multiples',
  [QuestionType.QCU]: 'Questionnaire à choix unique',
  [QuestionType.TrueFalse]: 'Vrai/Faux'
};

export type QuestionCategory = 'theory' | 'practice' | 'eliminatory';

export const questionCategories: Record<QuestionCategory, string> = {
  theory: 'Théorie',
  practice: 'Pratique',
  eliminatory: 'Éliminatoire'
};

export interface PPTXQuestion {
  question: string;
  correctAnswer: boolean;
  duration?: number;
  imagePath?: string;
}

export interface PPTXGenerationOptions {
  fileName?: string;
}