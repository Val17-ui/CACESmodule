// src/renderer.d.ts
import { Session, Referential, Trainer, Theme, Bloc, QuestionWithId, Omit, SessionResult, VotingDevice, DeviceKit, SessionQuestion, SessionBoitier, BlockUsage } from './types/index';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    dbAPI?: {
      getAllSessions: () => Promise<Session[]>;
      getSessionById: (id: number) => Promise<Session | undefined>;
      addSession: (data: Omit<Session, 'id'>) => Promise<number | undefined>;
      updateSession: (id: number, updates: Partial<Omit<Session, 'id'>>) => Promise<number | undefined>;
      addBulkSessionResults: (results: Omit<SessionResult, 'id'>[]) => Promise<(number | undefined)[] | undefined>;
      getResultsForSession: (sessionId: number) => Promise<SessionResult[]>;
      getAllResults: () => Promise<SessionResult[]>;
      getAllVotingDevices: () => Promise<VotingDevice[]>;
      addBulkSessionQuestions: (questions: Omit<SessionQuestion, 'id'>[]) => Promise<(number | undefined)[] | undefined>;
      deleteSessionQuestionsBySessionId: (sessionId: number) => Promise<void>;
      addBulkSessionBoitiers: (boitiers: Omit<SessionBoitier, 'id'>[]) => Promise<(number | undefined)[] | undefined>;
      deleteSessionBoitiersBySessionId: (sessionId: number) => Promise<void>;
      getSessionQuestionsBySessionId: (sessionId: number) => Promise<SessionQuestion[]>;
      getSessionBoitiersBySessionId: (sessionId: number) => Promise<SessionBoitier[]>;
      getAllDeviceKits: () => Promise<DeviceKit[]>;
      getDefaultDeviceKit: () => Promise<DeviceKit | undefined>;
      getVotingDevicesForKit: (kitId: number) => Promise<VotingDevice[]>;
      addReferential: (data: Omit<Referential, 'id'>) => Promise<number | undefined>;
      getAllReferentiels: () => Promise<Referential[]>;
      getReferentialByCode: (code: string) => Promise<Referential | undefined>;
      getReferentialById: (id: number) => Promise<Referential | undefined>;
      addTheme: (data: Omit<Theme, 'id'>) => Promise<number | undefined>;
      getThemeByCodeAndReferentialId: (code: string, refId: number) => Promise<Theme | undefined>;
      getThemesByReferentialId: (refId: number) => Promise<Theme[]>;
      getThemeById: (id: number) => Promise<Theme | undefined>;
      getAllThemes: () => Promise<Theme[]>;
      addBloc: (data: Omit<Bloc, 'id'>) => Promise<number | undefined>;
      getBlocByCodeAndThemeId: (code: string, themeId: number) => Promise<Bloc | undefined>;
      getBlocsByThemeId: (themeId: number) => Promise<Bloc[]>;
      getBlocById: (id: number) => Promise<Bloc | undefined>;
      getAllBlocs: () => Promise<Bloc[]>;
      addQuestion: (data: Omit<QuestionWithId, 'id'>) => Promise<number | undefined>;
      upsertParticipant: (participant: Omit<DBParticipantType, 'id'>) => Promise<number | undefined>;
      setParticipantAssignmentsForIteration: (iterationId: number, assignments: any[]) => Promise<(number | undefined)[] | undefined>;
      getQuestionById: (id: number) => Promise<QuestionWithId | undefined>;
      getQuestionsByBlocId: (blocId: number) => Promise<QuestionWithId[]>;
      updateQuestion: (id: number, updates: Partial<Omit<QuestionWithId, 'id'>>) => Promise<number | undefined>;
      deleteQuestion: (id: number) => Promise<void>;
      getAllQuestions: () => Promise<QuestionWithId[]>;
      getQuestionsByIds: (ids: number[]) => Promise<QuestionWithId[]>;
      getQuestionsForSessionBlocks: (blocIds?: number[]) => Promise<QuestionWithId[]>;
      getAdminSetting: (key: string) => Promise<any>;
      setAdminSetting: (key: string, value: any) => Promise<void>;
      getAllAdminSettings: () => Promise<{ key: string; value: any }[]>;
      generatePresentation: (sessionInfo: any, participants: any[], questions: any[], template?: any, adminSettings?: any) => Promise<any>;
      getDefaultPptxTemplate: () => Promise<Buffer>;
      savePptxFile: (fileBuffer: ArrayBuffer, fileName: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
      openExcelFileDialog: () => Promise<{ canceled: boolean; filePaths: string[] }>;
      openDirectoryDialog: (filePath?: string) => Promise<void>;
      openResultsFile: () => Promise<{ canceled: boolean; fileName: string | null; fileBuffer: string | null; error: string | null; }>;
      openFile: (filePath: string) => Promise<void>;
      importResultsForIteration: (iterationId: number, sessionId: number, results: SessionResult[]) => Promise<Session | undefined>;
      addOrUpdateSessionIteration: (iteration: SessionIteration) => Promise<number>;
      getSessionIterations: (sessionId: number) => Promise<SessionIteration[]>;
      deleteResultsForIteration: (iterationId: number) => Promise<void>;
      addVotingDevice: (data: Omit<VotingDevice, 'id'>) => Promise<number | undefined>;
      updateVotingDevice: (id: number, updates: Partial<Omit<VotingDevice, 'id'>>) => Promise<number | undefined>;
      deleteVotingDevice: (id: number) => Promise<void>;
      bulkAddVotingDevices: (devices: Omit<VotingDevice, 'id'>[]) => Promise<void>;
      addDeviceKit: (data: Omit<DeviceKit, 'id'>) => Promise<number | undefined>;
      updateDeviceKit: (id: number, updates: Partial<Omit<DeviceKit, 'id'>>) => Promise<number | undefined>;
      deleteDeviceKit: (id: number) => Promise<void>;
      getDeviceKitById: (id: number) => Promise<DeviceKit | undefined>;
      setDefaultDeviceKit: (id: number) => Promise<void>;
      assignDeviceToKit: (kitId: number, votingDeviceId: number) => Promise<number | undefined>;
      removeDeviceFromKit: (kitId: number, votingDeviceId: number) => Promise<void>;
      getKitsForVotingDevice: (votingDeviceId: number) => Promise<DeviceKit[]>;
      removeAssignmentsByKitId: (kitId: number) => Promise<void>;
      removeAssignmentsByVotingDeviceId: (votingDeviceId: number) => Promise<void>;
      addTrainer: (data: Omit<Trainer, 'id'>) => Promise<number | undefined>;
      getTrainerById: (id: number) => Promise<Trainer | undefined>;
      deleteTrainer: (id: number) => Promise<void>;
      setDefaultTrainer: (id: number) => Promise<void>;
      updateTrainer: (id: number, updates: Partial<Omit<Trainer, 'id'>>) => Promise<number | undefined>;
      calculateBlockUsage: () => Promise<BlockUsage[]>;
      exportAllData: () => Promise<any>;
      importAllData: (data: any) => Promise<void>;
    };
  }
}

interface ElectronAPI {
  readImageFile: (path: string | Blob | null) => Promise<string>;
  Buffer_from: (data: string, encoding: string) => Buffer;
  openFileDialog: () => Promise<{
    canceled: boolean;
    filePaths: string[];
    fileBuffer?: string;
    fileName?: string;
    error?: string;
  }>;
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
}

export {};