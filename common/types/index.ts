// src/types/index.ts
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;



// Nouvelle interface Session pour le stockage
export interface Session {
  id?: number; // Auto-incremented primary key
  nomSession: string;
  dateSession: string; // ISO string date
  referentielId?: number; // FK vers Referential.id - Remplacer l'ancien champ 'referentiel'
  participants?: Participant[]; // Utilise la nouvelle interface Participant ci-dessous
  sselectionBlocs?: { themeId: number; blocId: number }[]; // Remplacé par selectedBlocIds
  selectedBlocIds?: number[]; // Liste des IDs des blocs sélectionnés pour cette session
  donneesOrs?: ArrayBuffer | Buffer | null; // Stockage du fichier .ors généré
  orsFilePath?: string | Blob | ArrayBuffer | null; // Chemin d'accès au fichier .ors
  status?: 'planned' | 'in-progress' | 'completed' | 'cancelled' | 'ready'; // Statut optionnel, ajout de 'ready'
  location?: string; // Lieu de la session
  questionMappings?: QuestionMapping[];
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
  resultsImportedAt?: string | null; // Date/heure de l'importation des résultats
  num_session?: string;
  num_stage?: string;
  archived_at?: string;
  iteration_count?: number;
  iterations?: SessionIteration[];
  participantCount?: number;
  averageScore?: number;
}

// --- Nouveaux types pour la gestion des Kits de Boîtiers ---
export interface DeviceKit {
  id?: number; // Auto-incremented primary key
  name: string; // Nom du kit, ex: "Salle A"
  isDefault?: 0 | 1; // 0 pour false, 1 pour true (un seul kit par défaut)
  is_global?: 0 | 1; // 0 pour false, 1 for true
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
  id?: number; // Auto-incremented primary key
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
  id?: number; // Auto-incremented primary key
  sessionId: number; // Clé étrangère vers Session.id
  participantId: string; // Identifiant unique du participant au sein de la session (par exemple, un UUID ou index)
  visualId: number; // Numéro visuel du boîtier dans l'interface (1, 2, 3...)
  serialNumber: string; // Numéro de série physique du boîtier (OMBEA ID)
  participantName: string; // Nom complet du participant pour référence
}

// Nouveau type pour les formateurs
export interface Trainer {
  id?: number; // Auto-incremented primary key
  name: string;
  isDefault?: 0 | 1; // 0 pour false, 1 pour true
}

// Interface pour le mappage Question DB <-> Slide PPTX (par session)
// Doit correspondre à celle dans val17PptxGenerator.ts
export interface QuestionMapping {
  dbQuestionId: number;
  slideGuid: string | null;
  orderInPptx: number;
  theme: string;
  blockId: string;
}

// Nouvelle interface Participant pour les listes dans une Session
export interface Participant {
  id?: number; // Auto-incremented primary key
  idBoitier?: string; // Identifiant du boîtier de vote - REMPLACÉ par assignedGlobalDeviceId
  nom: string;
  prenom: string;
  entreprise?: string;
  identificationCode?: string; // Code d'identification optionnel
  score?: number; // Score total du participant pour cette session
  reussite?: boolean; // Statut de réussite du participant pour cette session
  assignedGlobalDeviceId?: number | null; // Référence à GlobalDevice.id (VotingDevice.id)
  statusInSession?: 'present' | 'absent'; // Statut du participant pour cette session spécifique
}

export interface FormParticipant extends Participant {
  uiId: string;
  firstName: string;
  lastName: string;
  deviceId: number | null;
  hasSigned?: boolean;
}

// L'interface SelectedBlock n'est plus nécessaire car nous stockons selectedBlocIds directement.
// // Nouvelle interface pour décrire un bloc thématique sélectionné
// export interface SelectedBlock {
//   themeId: number;
//   blocId: number;
// }

// Nouvelle interface pour stocker les résultats d'une session
export interface SessionResult {
  id?: number; // Auto-incremented primary key
  sessionId: number; // Clé étrangère vers Session.id
  sessionIterationId?: number; // Clé étrangère vers SessionIteration.id
  // Doit correspondre à l'ID de la question DANS LA DB (QuestionWithId.id)
  questionId: number;
  participantIdBoitier: string; // Identifiant du boîtier du participant
  participantId?: number; // Clé étrangère vers Participant.id
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
export interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  details?: any;
  timestamp?: string;
}
// Interface pour les questions telles qu'elles pourraient être définies initialement
export interface Question {
  id?: number; // Changed to optional number for DB ID
  userQuestionId?: string; // New: User-defined ID for upserting
  text: string;
  type: QuestionType;
  options: string[];
  correctAnswer: string;
  timeLimit?: number;
  isEliminatory: boolean;
  blocId?: number; // Clé étrangère vers la table Blocs
  image?: Blob;
  createdAt?: string;
  updatedAt?: string;
  lastUsedAt?: string;
  usageCount?: number;
  correctResponseRate?: number;
  slideGuid?: string;
  imageName?: string;
  version?: number; // New: Version number for the question
  theme?: string; // Added
  referential?: string; // Added
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
  nom_complet: string; // Pas spécifié dans le plan initial, mais pourrait être utile
  theme_id: number; // FK vers Theme.id
}




export interface DeviceMapping {
  deviceId: number;
  hardwareId: string;
  isActive: boolean;
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

export interface AdminSettings {
    id?: number;
    key: string;
    value: any;
    createdAt?: string;
    updatedAt?: string;
  }

  export interface AdminPPTXSettings {
    defaultDuration?: number;
    pollStartMode?: string;
    chartValueLabelFormat?: string;
    answersBulletStyle?: string;
    pollTimeLimit?: number;
    pollCountdownStartMode?: string;
    pollMultipleResponse?: string;
    questionSlideTransition?: 'Manual' | 'Automatic';
    questionSlideTransitionDelay?: number;
  }

  export interface Val17Question {
    dbQuestionId: number;
    question: string;
    options: string[];
    correctAnswerIndex?: number;
    imageUrl?: string;
    points?: number;
    theme: string;
  }

  export interface Val17GenerationOptions {
    fileName?: string;
    defaultDuration?: number;
    ombeaConfig?: AdminPPTXSettings;
    introSlideLayouts?: {
      titleLayoutName?: string;
      participantsLayoutName?: string;
    };
  }

  export interface Val17SessionInfo {
    title: string;
    date?: string;
  }

  export interface ParticipantForGenerator {
    idBoitier?: string;
    nom: string;
    prenom: string;
    entreprise?: string;
    identificationCode?: string;
  }
  




// Ajouté depuis reportCalculators.ts pour une portée globale
export interface ThemeScoreDetails {
  score: number; // en pourcentage
  correct: number;
  total: number;
  themeName: string;
  themeCode: string;
}

// Déplacé depuis db.ts
export interface QuestionWithId {
  id?: number;
  userQuestionId?: string; // New: User-defined ID for upserting
  text: string;
  // type: 'multiple-choice' | 'true-false'; // Remplacé par QuestionType enum
  type: QuestionType;
  options: string[];
  correctAnswer: string;
  timeLimit?: number;
  isEliminatory: boolean;
  blocId: number; // Made mandatory
  createdAt?: string;
  updatedAt?: string;
  usageCount?: number;
  correctResponseRate?: number;
  slideGuid?: string;
  image?: Blob; // Changed to Blob based on usage in QuestionLibrary.tsx
  imageName?: string;
  version?: number; // New: Version number for the question
  theme?: string; // Added
  referential?: string; // Added
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

// src/types/index.ts
export interface SessionIteration {
    id?: number;
    session_id: number;
    iteration_index: number;
    name: string;
    ors_file_path?: string;
    status?: 'planned' | 'ready' | 'completed';
    question_mappings?: QuestionMapping[];
    created_at: string;
    updated_at?: string;
    participants?: Participant[];
}

export interface ParticipantAssignment {
    id?: number;
    session_iteration_id: number;
    participant_id: number;
    voting_device_id: number;
    kit_id: number;
}

export interface BlockUsage {
  referentiel: string;
  theme: string;
  blockId: string;
  usageCount: number;
}

export type OnboardingStepStatus = 'pending' | 'completed_by_action' | 'completed_by_user';

export type OnboardingStatus = {
  addQuestions: OnboardingStepStatus;
  addVotingDevices: OnboardingStepStatus;
  addTrainers: OnboardingStepStatus;
  createKits: OnboardingStepStatus;
  modifyPreferences: OnboardingStepStatus;
  configureTechnicalSettings: OnboardingStepStatus;
};

export type ImportProgress = {
  current: number;
  total: number;
};
