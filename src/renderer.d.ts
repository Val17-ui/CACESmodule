
import {
  Session, Question, VotingDevice, DeviceKit, Trainer, Referential, Theme, Bloc,
  SessionIteration, SessionResult, SessionQuestion, SessionBoitier, AdminPPTXSettings, Participant, QuestionWithId
} from './types';

export interface IElectronDbAPI {
  // Sessions
  getAllSessions: () => Promise<Session[]>;
  getSessionById: (id: number) => Promise<Session | undefined>;
  addSession: (data: Omit<Session, 'id'>) => Promise<number>;
  updateSession: (id: number, updates: Partial<Session>) => Promise<number>;

  // SessionIterations
  addOrUpdateSessionIteration: (iteration: Omit<SessionIteration, 'id'>) => Promise<number>;
  getSessionIterations: (sessionId: number) => Promise<SessionIteration[]>;

  // SessionResults
  addBulkSessionResults: (results: SessionResult[]) => Promise<void>;
  getResultsForSession: (sessionId: number) => Promise<SessionResult[]>;
  deleteResultsForIteration: (iterationId: number) => Promise<void>;
  getAllResults: () => Promise<SessionResult[]>;

  // SessionQuestions
  addBulkSessionQuestions: (questions: SessionQuestion[]) => Promise<void>;
  deleteSessionQuestionsBySessionId: (sessionId: number) => Promise<void>;
  getSessionQuestionsBySessionId: (sessionId: number) => Promise<SessionQuestion[]>;

  // VotingDevices
  getAllVotingDevices: () => Promise<VotingDevice[]>;
  addVotingDevice: (device: Omit<VotingDevice, 'id'>) => Promise<number>;
  updateVotingDevice: (id: number, updates: Partial<VotingDevice>) => Promise<number>;
  deleteVotingDevice: (id: number) => Promise<void>;
  bulkAddVotingDevices: (devices: Omit<VotingDevice, 'id'>[]) => Promise<void>;
  getVotingDevicesForKit: (kitId: number) => Promise<VotingDevice[]>;
  addBulkSessionBoitiers: (boitiers: SessionBoitier[]) => Promise<void>;
  deleteSessionBoitiersBySessionId: (sessionId: number) => Promise<void>;
  getSessionBoitiersBySessionId: (sessionId: number) => Promise<SessionBoitier[]>;

  // DeviceKits
  getAllDeviceKits: () => Promise<DeviceKit[]>;
  getDefaultDeviceKit: () => Promise<DeviceKit | undefined>;
  addDeviceKit: (data: Omit<DeviceKit, 'id'>) => Promise<number>;
  updateDeviceKit: (id: number, updates: Partial<DeviceKit>) => Promise<number>;
  deleteDeviceKit: (id: number) => Promise<void>;
  setDefaultDeviceKit: (id: number) => Promise<void>;
  assignDeviceToKit: (kitId: number, votingDeviceId: number) => Promise<number>;
  removeDeviceFromKit: (kitId: number, votingDeviceId: number) => Promise<void>;
  getKitsForVotingDevice: (votingDeviceId: number) => Promise<DeviceKit[]>;
  removeAssignmentsByKitId: (kitId: number) => Promise<void>;
  removeAssignmentsByVotingDeviceId: (votingDeviceId: number) => Promise<void>;

  // Referentiels
  addReferential: (data: Omit<Referential, 'id'>) => Promise<number>;
  getAllReferentiels: () => Promise<Referential[]>;
  getReferentialByCode: (code: string) => Promise<Referential | undefined>;
  getReferentialById: (id: number) => Promise<Referential | undefined>;

  // Trainers
  getAllTrainers: () => Promise<Trainer[]>;
  addTrainer: (data: Omit<Trainer, 'id'>) => Promise<number>;
  deleteTrainer: (id: number) => Promise<void>;
  setDefaultTrainer: (id: number) => Promise<void>;
  updateTrainer: (id: number, updates: Partial<Trainer>) => Promise<number>;
  getTrainerById: (id: number) => Promise<Trainer | undefined>;
  calculateBlockUsage: () => Promise<CalculatedBlockOverallStats[]>;

  // Themes
  addTheme: (data: Omit<Theme, 'id'>) => Promise<number>;
  getThemeByCodeAndReferentialId: (code: string, refId: number) => Promise<Theme | undefined>;
  getThemesByReferentialId: (refId: number) => Promise<Theme[]>;
  getThemeById: (id: number) => Promise<Theme | undefined>;
  getAllThemes: () => Promise<Theme[]>;

  // Blocs
  addBloc: (data: Omit<Bloc, 'id'>) => Promise<number>;
  getBlocByCodeAndThemeId: (code: string, themeId: number) => Promise<Bloc | undefined>;
  getBlocsByThemeId: (themeId: number) => Promise<Bloc[]>;
  getBlocById: (id: number) => Promise<Bloc | undefined>;
  getAllBlocs: () => Promise<Bloc[]>;

  // Questions
  addQuestion: (data: Omit<Question, 'id'>) => Promise<number>;
  upsertQuestion: (data: Omit<Question, 'id'>) => Promise<number>;
  getQuestionById: (id: number) => Promise<QuestionWithId | undefined>;
  getQuestionsByBlocId: (blocId: number) => Promise<QuestionWithId[]>;
  updateQuestion: (id: number, updates: Partial<Question>) => Promise<number>;
  deleteQuestion: (id: number) => Promise<void>;
  getAllQuestions: () => Promise<QuestionWithId[]>;
  getQuestionsByIds: (ids: number[]) => Promise<QuestionWithId[]>;
  getQuestionsForSessionBlocks: (blocIds?: number[]) => Promise<QuestionWithId[]>;

  // Participants
  upsertParticipant: (participant: Omit<Participant, 'id'>) => Promise<number>;
  setParticipantAssignmentsForIteration: (iterationId: number, assignments: any[]) => Promise<any[]>;

  // AdminSettings
  getAdminSetting: (key: string) => Promise<any>;
  setAdminSetting: (key: string, value: any) => Promise<void>;
  getAllAdminSettings: () => Promise<AdminPPTXSettings>;

  // Backup/Restore
  exportAllData: () => Promise<any>;
  importAllData: (data: any) => Promise<void>;

  // PPTX Generation
  generatePresentation: (sessionInfo: any, participants: any[], questions: any[], template?: any, adminSettings?: any) => Promise<{ orsBlob: string, questionMappings: any[] }>;
  savePptxFile: (fileBuffer: string, fileName: string) => Promise<{ success: boolean, filePath?: string, error?: string }>;
  getDefaultPptxTemplate: () => Promise<ArrayBuffer>;

  // File Operations
  openExcelFileDialog: () => Promise<{ canceled: boolean, fileName: string | null, fileBuffer: string | null, error: string | null }>;
  openDirectoryDialog: (filePath?: string) => Promise<{ canceled: boolean, path?: string }>;
  openResultsFile: () => Promise<{ canceled: boolean, fileName: string | null, fileBuffer: string | null, error: string | null }>;
  openFile: (filePath: string) => Promise<{ success: boolean, result?: string, error?: string }>;

  // Finalization
  importResultsForIteration: (iterationId: number, sessionId: number, results: any[]) => Promise<Session | undefined>;
  checkAndFinalizeSession: (sessionId: number) => Promise<Session | undefined>;
}

declare global {
  interface Window {
    dbAPI: IElectronDbAPI;
    electronAPI: {
      readImageFile: (path: string | Blob | null) => Promise<string>;
      Buffer_from: (buffer: string, encoding: string) => Buffer;
      openFileDialog: () => Promise<{ canceled: boolean, fileName: string | null, fileBuffer: string | null, error: string | null }>;
      info: (message: string) => void;
      warn: (message: string) => void;
      error: (message: string) => void;
    }
  }
}
