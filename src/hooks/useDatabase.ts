import { useCallback, useEffect, useState } from 'react';
import { QuestionWithId, Session, SessionResult, AdminSetting, VotingDevice, Trainer, SessionQuestion, SessionBoitier, Referential, Theme, Bloc, DeviceKit, DeviceKitAssignment } from '../types';

declare global {
  interface Window {
    electronAPI: {
      getQuestions: () => Promise<QuestionWithId[]>;
      addQuestion: (data: QuestionWithId) => Promise<number>;
      updateQuestion: (data: QuestionWithId & { id: number }) => Promise<number>;
      deleteQuestion: (id: number) => Promise<number>;
      getSessions: () => Promise<Session[]>;
      addSession: (data: Session) => Promise<number>;
      updateSession: (data: Session & { id: number }) => Promise<number>;
      deleteSession: (id: number) => Promise<number>;
      getSessionResults: () => Promise<SessionResult[]>;
      addSessionResult: (data: SessionResult) => Promise<number>;
      getAdminSetting: (key: string) => Promise<any>;
      setAdminSetting: (data: { key: string; value: any }) => Promise<number>;
      getVotingDevices: () => Promise<VotingDevice[]>;
      addVotingDevice: (data: VotingDevice) => Promise<number>;
      getTrainers: () => Promise<Trainer[]>;
      addTrainer: (data: Trainer) => Promise<number>;
      getSessionQuestions: (sessionId: number) => Promise<SessionQuestion[]>;
      addSessionQuestion: (data: SessionQuestion) => Promise<number>;
      getSessionBoitiers: (sessionId: number) => Promise<SessionBoitier[]>;
      addSessionBoitier: (data: SessionBoitier) => Promise<number>;
      getReferentiels: () => Promise<Referential[]>;
      addReferential: (data: Referential) => Promise<number>;
      getThemes: (referentielId: number) => Promise<Theme[]>;
      addTheme: (data: Theme) => Promise<number>;
      getBlocs: (themeId: number) => Promise<Bloc[]>;
      addBloc: (data: Bloc) => Promise<number>;
      getDeviceKits: () => Promise<DeviceKit[]>;
      addDeviceKit: (data: DeviceKit) => Promise<number>;
      getDeviceKitAssignments: (kitId: number) => Promise<DeviceKitAssignment[]>;
      addDeviceKitAssignment: (data: DeviceKitAssignment) => Promise<number>;
      exportDb: () => Promise<string>;
      importDb: (path: string) => Promise<string>;
    };
  }
}

export const useDatabase = () => {
  const [questions, setQuestions] = useState<QuestionWithId[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionResults, setSessionResults] = useState<SessionResult[]>([]);
  const [adminSettings, setAdminSettings] = useState<AdminSetting[]>([]);
  const [votingDevices, setVotingDevices] = useState<VotingDevice[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [sessionQuestions, setSessionQuestions] = useState<SessionQuestion[]>([]);
  const [sessionBoitiers, setSessionBo...