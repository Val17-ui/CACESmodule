import { Session, Referential, Trainer, Theme, Bloc, QuestionWithId, Omit } from './types';

declare global {
  interface Window {
    dbAPI: {
      getAllSessions: () => Promise<Session[]>;
      getSessionById: (id: number) => Promise<Session | undefined>;
      addReferential: (data: Omit<Referential, 'id'>) => Promise<number | undefined>;
      getAllReferentiels: () => Promise<Referential[]>;
      getAllTrainers: () => Promise<Trainer[]>;
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
    };
  }
}

export {};
