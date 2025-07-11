// src/types/index.ts

// Interface pour les utilisateurs (non modifiée, aucune table correspondante dans db.ts)
export interface User {
  id: string;
  name: string;
  role: 'admin' | 'instructor' | 'viewer';
}

// Interface pour les sessions (table sessions dans SQLite3)
export interface Session {
  id?: number; // Clé primaire auto-incrémentée
  nomSession: string; // Nom de la session
  dateSession: string; // Date ISO (ex: '2025-07-11')
  referentielId: number; // Clé étrangère vers referentiels.id
  selectedBlocIds: number[]; // Tableau d'IDs de blocs (stocké en JSON dans SQLite3)
  selectedKitId: number | null; // Clé étrangère vers deviceKits.id
  createdAt: string; // Date ISO de création
  location: string; // Lieu de la session
  status: 'planned' | 'in-progress' | 'completed' | 'cancelled' | 'ready'; // Statut
  questionMappings: Array<{ dbQuestionId: number; slideGuid: string | null; orderInPptx: number }>; // Stocké en JSON
  notes: string; // Notes optionnelles
  trainerId: number; // Clé étrangère vers trainers.id
  ignoredSlideGuids: string[]; // Tableau de GUIDs (stocké en JSON)
  resolvedImportAnomalies: {
    expectedIssues: ExpectedIssueResolution[];
    unknownDevices: UnknownDeviceResolution[];
    resolvedAt: string;
  } | null; // Stocké en JSON
  participants: Participant[]; // Tableau de participants (non stocké directement, géré via sessionBoitiers)
}

// Interface pour les kits de boîtiers (table deviceKits)
export interface DeviceKit {
  id?: number; // Clé primaire auto-incrémentée
  name: string; // Nom du kit (ex: "Salle A")
  isDefault: 0 | 1; // 0 = false, 1 = true
}

// Interface pour les assignations de boîtiers à un kit (table deviceKitAssignments)
export interface DeviceKitAssignment {
  id?: number; // Clé primaire auto-incrémentée
  kitId: number; // Clé étrangère vers deviceKits.id
  votingDeviceId: number; // Clé étrangère vers votingDevices.id
}

// Types pour la résolution des anomalies d'import
export type ExpectedIssueAction = 'pending' | 'mark_absent' | 'aggregate_with_unknown' | 'ignore_device';
export type UnknownDeviceAction = 'pending' | 'ignore_responses' | 'add_as_new_participant';

export interface ExpectedIssueResolution {
  serialNumber: string; // Numéro de série du boîtier attendu
  action: ExpectedIssueAction;
  sourceUnknownSerialNumber?: string; // Numéro de série du boîtier inconnu pour aggregation
}

export interface UnknownDeviceResolution {
  serialNumber: string; // Numéro de série du boîtier inconnu
  action: UnknownDeviceAction;
  newParticipantName?: string; // Nom du participant si ajouté
}

// Interface pour les questions de session (table sessionQuestions)
export interface SessionQuestion {
  id?: number; // Clé primaire auto-incrémentée
  sessionId: number; // Clé étrangère vers sessions.id
  dbQuestionId: number; // Clé étrangère vers questions.id
  slideGuid: string; // GUID de la slide PPTX
  blockId: number; // Clé étrangère vers blocs.id
}

// Interface pour les boîtiers de session (table sessionBoitiers)
export interface SessionBoitier {
  id?: number; // Clé primaire auto-incrémentée
  sessionId: number; // Clé étrangère vers sessions.id
  participantId: string; // Identifiant unique du participant
  visualId: number; // Numéro visuel du boîtier
  serialNumber: string; // Numéro de série du boîtier
  participantName: string; // Nom complet du participant
}

// Interface pour les formateurs (table trainers)
export interface Trainer {
  id?: number; // Clé primaire auto-incrémentée
  name: string; // Nom du formateur
  isDefault: 0 | 1; // 0 = false, 1 = true
}

// Interface pour le mappage des questions dans une session
export interface QuestionMapping {
  dbQuestionId: number; // ID de la question dans la table questions
  slideGuid: string | null; // GUID de la slide PPTX
  orderInPptx: number; // Ordre dans le PPTX
  blockId: number; // Clé étrangère vers blocs.id
}

// Interface pour les participants d'une session
export interface Participant {
  nom: string;
  prenom: string;
  identificationCode?: string; // Code d'identification optionnel
  score?: number; // Score total
  reussite?: boolean; // Statut de réussite
  assignedGlobalDeviceId: number | null; // Clé étrangère vers votingDevices.id
  statusInSession?: 'present' | 'absent'; // Statut dans la session
}

// Interface pour les résultats de session (table sessionResults)
export interface SessionResult {
  id?: number; // Clé primaire auto-incrémentée
  sessionId: number; // Clé étrangère vers sessions.id
  questionId: number; // Clé étrangère vers questions.id
  participantIdBoitier: string; // Identifiant du boîtier/participant
  answer: string; // Réponse donnée
  isCorrect: boolean; // Si la réponse est correcte
  pointsObtained: number; // Points obtenus
  timestamp: string; // Date ISO de la réponse
}

// Enum pour les types de questions
export enum QuestionType {
  QCM = 'multiple-choice',
  QCU = 'single-choice',
  TrueFalse = 'true-false'
}

// Interface pour les questions (table questions)
export interface QuestionWithId {
  id?: number; // Clé primaire auto-incrémentée
  blocId: number; // Clé étrangère vers blocs.id
  text: string; // Texte de la question
  type: QuestionType; // Type de question
  options: string[]; // Options (stocké en JSON dans SQLite3)
  correctAnswer: string; // Réponse correcte
  timeLimit: number; // Limite de temps
  isEliminatory: boolean; // Question éliminatoire
  createdAt: string; // Date ISO de création
  usageCount: number; // Nombre d'utilisations
  correctResponseRate: number; // Taux de réponses correctes
  slideGuid: string; // GUID de la slide PPTX
}

// Interface pour les référentiels (table referentiels)
export interface Referential {
  id?: number; // Clé primaire auto-incrémentée
  code: string; // Code unique (ex: R489)
  nom_complet: string; // Nom complet (ex: Chariots élévateurs)
}

// Interface pour les thèmes (table themes)
export interface Theme {
  id?: number; // Clé primaire auto-incrémentée
  code_theme: string; // Code unique (ex: R489PR)
  referentiel_id: number; // Clé étrangère vers referentiels.id
  nom_complet: string; // Nom complet (ex: Prévention des risques)
}

// Interface pour les blocs (table blocs)
export interface Bloc {
  id?: number; // Clé primaire auto-incrémentée
  code_bloc: string; // Code unique (ex: R489PR_A)
  theme_id: number; // Clé étrangère vers themes.id
}

// Interface pour les boîtiers de vote (table votingDevices)
export interface VotingDevice {
  id?: number; // Clé primaire auto-incrémentée
  name: string; // Nom du boîtier
  serialNumber: string; // Numéro de série unique
}

// Interface pour les paramètres administratifs (table adminSettings)
export interface AdminSetting {
  key: string; // Clé primaire
  value: any; // Valeur (stockée en JSON dans SQLite3)
}

// Interface pour les statistiques de bloc
export interface CalculatedBlockOverallStats {
  blocId: number; // ID du bloc
  referentielCode: string; // Code du référentiel
  themeCode: string; // Code du thème
  blocCode: string; // Code du bloc
  usageCount: number; // Nombre d'utilisations
  averageSuccessRate: number; // Taux de réussite moyen
  averageScore: number; // Score moyen
}

// Interface pour les statistiques de thème
export interface OverallThemeStats {
  themeId: number; // ID du thème
  themeCode: string; // Code du thème
  themeName: string; // Nom du thème
  totalQuestionsAnswered: number; // Total des questions répondues
  totalCorrectAnswers: number; // Total des réponses correctes
  successRate: number; // Taux de réussite
}

// Interface pour les détails de score par thème
export interface ThemeScoreDetails {
  score: number; // Pourcentage
  correct: number; // Nombre de réponses correctes
  total: number; // Nombre total de questions
}

// Interface pour les paramètres globaux
export interface GeneralSettings {
  deviceMappings: DeviceMapping[];
  maxDevices: number; // Nombre maximum de boîtiers
  defaultSuccessThreshold?: number; // Seuil de réussite global (ex: 70%)
  defaultThemeThreshold?: number; // Seuil de réussite par thème (ex: 50%)
  reportLogoBase64?: string; // Logo pour les rapports PDF (base64)
}

// Interface pour le mappage des appareils
export interface DeviceMapping {
  deviceId: number; // ID du boîtier
  hardwareId: string; // Identifiant matériel
  isActive: boolean; // Statut actif
}

// Enum pour les référentiels CACES
export enum CACESReferential {
  R482 = 'R482',
  R484 = 'R484',
  R485 = 'R485',
  R486 = 'R486',
  R489 = 'R489',
  R490 = 'R490'
}

// Types pour les référentiels
export type ReferentialType = 'R482' | 'R484' | 'R485' | 'R486' | 'R489' | 'R490';

// Constantes pour les référentiels
export const referentials: Record<ReferentialType, string> = {
  R482: 'Engins de chantier',
  R484: 'Ponts roulants',
  R485: 'Chariots de manutention',
  R486: 'Plates-formes élévatrices',
  R489: 'Chariots élévateurs',
  R490: 'Grues de chargement'
};

// Limites pour les référentiels
export const referentialLimits: Record<ReferentialType, { min: number; max: number }> = {
  R482: { min: 20, max: 45 },
  R484: { min: 25, max: 50 },
  R485: { min: 20, max: 40 },
  R486: { min: 25, max: 50 },
  R489: { min: 20, max: 50 },
  R490: { min: 30, max: 55 }
};

// Enum pour les thèmes des questions
export type QuestionTheme = 'reglementation' | 'securite' | 'technique';

// Constantes pour les thèmes
export const questionThemes: Record<QuestionTheme, string> = {
  reglementation: 'Réglementation',
  securite: 'Sécurité',
  technique: 'Technique'
};

// Constantes pour les types de questions
export const questionTypes: Record<QuestionType, string> = {
  [QuestionType.QCM]: 'Questionnaire à choix multiples',
  [QuestionType.QCU]: 'Questionnaire à choix unique',
  [QuestionType.TrueFalse]: 'Vrai/Faux'
};

// Catégories de questions
export type QuestionCategory = 'theory' | 'practice' | 'eliminatory';

// Constantes pour les catégories
export const questionCategories: Record<QuestionCategory, string> = {
  theory: 'Théorie',
  practice: 'Pratique',
  eliminatory: 'Éliminatoire'
};

// Interface pour les questions PPTX
export interface PPTXQuestion {
  question: string;
  correctAnswer: boolean;
  duration?: number;
  imagePath?: string;
}

// Options pour la génération PPTX
export interface PPTXGenerationOptions {
  fileName?: string;
}