export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export interface User {
    id: string;
    name: string;
    role: 'admin' | 'instructor' | 'viewer';
}
export interface Session {
    id?: number;
    nomSession: string;
    dateSession: string;
    referentielId?: number;
    participants?: Participant[];
    participantCount?: number;
    sselectionBlocs?: {
        themeId: number;
        blocId: number;
    }[];
    selectedBlocIds?: number[];
    donneesOrs?: ArrayBuffer | Buffer | null;
    orsFilePath?: string | Blob | ArrayBuffer | null;
    status?: 'planned' | 'in-progress' | 'completed' | 'cancelled' | 'ready';
    location?: string;
    questionMappings?: Array<{
        dbQuestionId: number;
        slideGuid: string | null;
        orderInPptx: number;
    }>;
    notes?: string;
    createdAt?: string;
    updatedAt?: string;
    trainerId?: number;
    ignoredSlideGuids?: string[] | null;
    resolvedImportAnomalies?: {
        expectedIssues: ExpectedIssueResolution[];
        unknownDevices: UnknownDeviceResolution[];
        resolvedAt: string;
    } | null;
    selectedKitId?: number | null;
    resultsImportedAt?: string | null;
    num_session?: string;
    num_stage?: string;
    archived_at?: string;
    iteration_count?: number;
    iterations?: SessionIteration[];
}
export interface DeviceKit {
    id?: number;
    name: string;
    isDefault?: 0 | 1;
    is_global?: 0 | 1;
}
export interface DeviceKitAssignment {
    id?: number;
    kitId: number;
    votingDeviceId: number;
}
export type ExpectedIssueAction = 'pending' | 'mark_absent' | 'aggregate_with_unknown' | 'ignore_device';
export type UnknownDeviceAction = 'pending' | 'ignore_responses' | 'add_as_new_participant';
export interface ExpectedIssueResolution {
    serialNumber: string;
    action: ExpectedIssueAction;
    sourceUnknownSerialNumber?: string;
}
export interface UnknownDeviceResolution {
    serialNumber: string;
    action: UnknownDeviceAction;
    newParticipantName?: string;
}
export interface SessionQuestion {
    id?: number;
    sessionId: number;
    dbQuestionId: number;
    slideGuid: string;
    text: string;
    options: string[];
    correctAnswer: string;
    blockId: string;
}
export interface SessionBoitier {
    id?: number;
    sessionId: number;
    participantId: string;
    visualId: number;
    serialNumber: string;
    participantName: string;
}
export interface Trainer {
    id?: number;
    name: string;
    isDefault?: 0 | 1;
}
export interface QuestionMapping {
    dbQuestionId: number;
    slideGuid: string | null;
    orderInPptx: number;
    theme: string;
    blockId: string;
}
export interface Participant {
    idBoitier?: string;
    nom: string;
    prenom: string;
    organization?: string;
    identificationCode?: string;
    score?: number;
    reussite?: boolean;
    assignedGlobalDeviceId?: number | null;
    statusInSession?: 'present' | 'absent';
}
export interface FormParticipant extends Participant {
    id: string;
    firstName: string;
    lastName: string;
    deviceId: number | null;
    hasSigned?: boolean;
}
export interface SessionResult {
    id?: number;
    sessionId: number;
    questionId: number;
    participantIdBoitier: string;
    answer: string;
    isCorrect: boolean;
    pointsObtained: number;
    timestamp: string;
}
export declare enum QuestionType {
    QCM = "multiple-choice",
    QCU = "single-choice",
    TrueFalse = "true-false"
}
export interface LogEntry {
    level: 'info' | 'warn' | 'error' | 'success';
    message: string;
    details?: any;
    timestamp?: string;
}
export interface Question {
    id: string;
    text: string;
    type: QuestionType;
    options: string[];
    correctAnswer: string;
    timeLimit?: number;
    isEliminatory: boolean;
    blocId?: number;
    image?: Blob;
    createdAt?: string;
    updatedAt?: string;
    lastUsedAt?: string;
    usageCount?: number;
    correctResponseRate?: number;
    slideGuid?: string;
    theme?: string;
    referential?: string;
}
export interface Referential {
    id?: number;
    code: string;
    nom_complet: string;
}
export interface Theme {
    id?: number;
    code_theme: string;
    nom_complet: string;
    referentiel_id: number;
}
export interface Bloc {
    id?: number;
    code_bloc: string;
    theme_id: number;
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
    defaultSuccessThreshold?: number;
    defaultThemeThreshold?: number;
    reportLogoBase64?: string;
}
export declare enum CACESReferential {
    R482 = "R482",
    R484 = "R484",
    R485 = "R485",
    R486 = "R486",
    R489 = "R489",
    R490 = "R490"
}
export type ReferentialType = 'R482' | 'R484' | 'R485' | 'R486' | 'R489' | 'R490';
export declare const referentials: Record<ReferentialType, string>;
export declare const referentialLimits: Record<ReferentialType, {
    min: number;
    max: number;
}>;
export type QuestionTheme = 'reglementation' | 'securite' | 'technique';
export declare const questionThemes: Record<QuestionTheme, string>;
export declare const questionTypes: Record<QuestionType, string>;
export type QuestionCategory = 'theory' | 'practice' | 'eliminatory';
export declare const questionCategories: Record<QuestionCategory, string>;
export interface PPTXQuestion {
    question: string;
    correctAnswer: boolean;
    duration?: number;
    imagePath?: string;
}
export interface PPTXGenerationOptions {
    fileName?: string;
}
export interface ThemeScoreDetails {
    score: number;
    correct: number;
    total: number;
}
export interface QuestionWithId {
    id?: number;
    text: string;
    type: QuestionType;
    options: string[];
    correctAnswer: string;
    timeLimit?: number;
    isEliminatory: boolean;
    blocId: number;
    image?: string | Blob | null;
    createdAt?: string;
    updatedAt?: string;
    usageCount?: number;
    correctResponseRate?: number;
    slideGuid?: string;
    imageName?: string;
    version_questionnaire?: number;
    updated_at?: string;
    theme?: string;
    referential?: string;
}
export interface VotingDevice {
    id?: number;
    name: string;
    serialNumber: string;
}
export interface CalculatedBlockOverallStats {
    blocId: number;
    referentielCode: string;
    themeCode: string;
    blocCode: string;
    usageCount: number;
    averageSuccessRate: number;
    averageScore: number;
}
export interface OverallThemeStats {
    themeId: number;
    themeCode: string;
    themeName: string;
    totalQuestionsAnswered: number;
    totalCorrectAnswers: number;
    successRate: number;
}
export interface SessionIteration {
    id?: number;
    session_id: number;
    iteration_index: number;
    name: string;
    ors_file_path?: string;
    status?: 'planned' | 'ready' | 'completed';
    participants?: Participant[];
    question_mappings?: QuestionMapping[];
    created_at: string;
    updated_at?: string;
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
