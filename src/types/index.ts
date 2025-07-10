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
  referentielId?: number; // FK vers Referential.id - Remplacer l'ancien champ 'referentiel'
  participants: Participant[]; // Utilise la nouvelle interface Participant ci-dessous
  // selectionBlocs: SelectedBlock[]; // Remplacé par selectedBlocIds
  selectedBlocIds?: number[]; // Liste des IDs des blocs sélectionnés pour cette session
  donneesOrs?: Blob | null; // Stockage du fichier .ors généré
  status?: 'planned' | 'in-progress' | 'completed' | 'cancelled' | 'ready'; // Statut optionnel, ajout de 'ready'
  location?: string; // Lieu de la session
  questionMappings?: Array<{dbQuestionId: number, slideGuid: string | null, orderInPptx: number}>;
  notes?: string; // Notes pour la session
  createdAt?: string;
  updatedAt?: string;
  trainerId?: number; // ID du formateur assigné à la session (number pour correspondre à Trainer.id)
  ignoredSlideGuids?: string[] | null; // GUIDs des slides pré-existantes dans le modèle à ignorer
  resolvedImportAnomalies?: {
    expectedIssues: ExpectedIssueResolution[];
    unknownDevices: UnknownDeviceResolution[];
    resolvedAt: string;
  } | null;
  selectedKitId?: number | null; // ID du kit de boîtiers sélectionné pour la session
}

// --- Nouveaux types pour la gestion des Kits de Boîtiers ---
export interface DeviceKit {
  id?: number; // Auto-incremented primary key
  name: string; // Nom du kit, ex: "Salle A"
  isDefault?: 0 | 1; // 0 pour false, 1 pour true (un seul kit par défaut)
}

export interface DeviceKitAssignment {
  id?: number; // Auto-incremented primary key
  kitId: number; // FK vers DeviceKit.id
  votingDeviceId: number; // FK vers VotingDevice.id
}

// --- Types pour la résolution des anomalies d'import (partagés) ---

// Actions pour un boîtier ATTENDU AYANT DES PROBLÈMES (muet total/partiel)
export type ExpectedIssueAction =
  | 'pending'
  | 'mark_absent'
  | 'aggregate_with_unknown'
  | 'ignore_device';

// Actions pour un boîtier INCONNU
export type UnknownDeviceAction =
  | 'pending'
  | 'ignore_responses'
  | 'add_as_new_participant';

// Résolution pour un boîtier attendu ayant des problèmes
export interface ExpectedIssueResolution {
  serialNumber: string; // Du boîtier attendu
  action: ExpectedIssueAction;
  // Si action est 'aggregate_with_unknown', ceci est le S/N de l'inconnu à utiliser
  sourceUnknownSerialNumber?: string;
}

// Résolution pour un boîtier inconnu
export interface UnknownDeviceResolution {
  serialNumber: string; // Du boîtier inconnu
  action: UnknownDeviceAction;
  // Si action est 'add_as_new_participant', nom du nouveau participant
  newParticipantName?: string;
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
  statusInSession?: 'present' | 'absent'; // Statut du participant pour cette session spécifique
}

// L'interface SelectedBlock n'est plus nécessaire car nous stockons selectedBlocIds directement.
// // Nouvelle interface pour décrire un bloc thématique sélectionné
// export interface SelectedBlock {
//   themeId: number;
//   blocId: number;
// }

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
  // referentiel: CACESReferential; // Remplacé par blocId
  // theme: string; // Remplacé par blocId
  blocId?: number; // Clé étrangère vers la table Blocs
  image?: Blob;
  createdAt?: string;
  updatedAt?: string;
  lastUsedAt?: string;
  usageCount?: number;
  correctResponseRate?: number;
  slideGuid?: string; // Ajout du SlideGUID
}

// Nouvelles interfaces pour la structure dynamique
export interface Referential {
  id?: number;
  code: string; // Ex: R489
  nom_complet: string; // Ex: Chariots de manutention automoteurs
}

export interface Theme {
  id?: number;
  code_theme: string; // Ex: R489PR
  nom_complet: string; // Ex: Prévention des risques
  referentiel_id: number; // FK vers Referential.id
}

export interface Bloc {
  id?: number;
  code_bloc: string; // Ex: R489PR_A
  // nom_complet: string; // Pas spécifié dans le plan initial, mais pourrait être utile
  theme_id: number; // FK vers Theme.id
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
  defaultSuccessThreshold?: number; // Seuil de réussite global par défaut (ex: 70 pour 70%)
  defaultThemeThreshold?: number; // Seuil de réussite par thème par défaut (ex: 50 pour 50%)
  reportLogoBase64?: string; // Logo pour les rapports PDF, encodé en Base64
  // Potentiellement d'autres paramètres globaux pour les rapports ici
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

// Ajouté depuis reportCalculators.ts pour une portée globale
export interface ThemeScoreDetails {
  score: number; // en pourcentage
  correct: number;
  total: number;
}

// Déplacé depuis db.ts
export interface QuestionWithId {
  id?: number;
  text: string;
  // type: 'multiple-choice' | 'true-false'; // Remplacé par QuestionType enum
  type: QuestionType;
  options: string[];
  correctAnswer: string;
  timeLimit?: number;
  isEliminatory: boolean;
  blocId: number; // Made mandatory
  image?: Blob | null;
  createdAt?: string;
  updatedAt?: string;
  usageCount?: number;
  correctResponseRate?: number;
  slideGuid?: string;
  imageName?: string;
}

// Déplacé depuis db.ts
export interface VotingDevice {
  id?: number;
  name: string;
  serialNumber: string;
}

// Déplacé depuis reportCalculators.ts
export interface CalculatedBlockOverallStats {
  blocId: number;
  referentielCode: string;
  themeCode: string;
  blocCode: string;
  usageCount: number;
  averageSuccessRate: number;
  averageScore: number;
}

// Déplacé depuis reportCalculators.ts
export interface OverallThemeStats {
  themeId: number;
  themeCode: string;
  themeName: string;
  totalQuestionsAnswered: number;
  totalCorrectAnswers: number;
  successRate: number;
}