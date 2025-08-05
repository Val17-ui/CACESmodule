import React, { createContext, useReducer, useContext, Dispatch } from 'react';
import {
  CACESReferential,
  Session as DBSession,
  Trainer,
  Referential,
  Theme,
  Bloc,
  VotingDevice,
  DeviceKit,
  FormParticipant,
} from '@common/types';

// 1. Define the State Shape
interface SessionState {
  currentSessionDbId: number | null;
  sessionName: string;
  sessionDate: string;
  numSession: string;
  numStage: string;
  iterationCount: number;
  iterationNames: string[];
  selectedReferential: CACESReferential | '';
  selectedReferentialId: number | null;
  location: string;
  notes: string;
  participants: FormParticipant[];
  selectedBlocIds: number[];
  displayedBlockDetails: Array<{ themeName: string; blocName: string }>;
  importSummary: string | null;
  editingSessionData: DBSession | null;
  hardwareDevices: VotingDevice[];
  hardwareLoaded: boolean;
  activeTab: 'details' | 'participants' | 'generateQuestionnaire' | 'importResults' | 'report';
  isGeneratingOrs: boolean;
  modifiedAfterOrsGeneration: boolean;
  trainersList: Trainer[];
  selectedTrainerId: number | null;
  referentielsData: Referential[];
  allThemesData: Theme[];
  allBlocsData: Bloc[];
  deviceKitsList: DeviceKit[];
  selectedKitIdState: number | null;
  isLoadingKits: boolean;
  votingDevicesInSelectedKit: VotingDevice[];
  participantAssignments: Record<number, { id: string; assignedGlobalDeviceId: number | null }[]>;
}

// 2. Define Action Types
type Action =
  | { type: 'SET_FIELD'; field: keyof SessionState; payload: any }
  | { type: 'SET_PARTICIPANTS'; payload: FormParticipant[] }
  | { type: 'SET_ASSIGNMENTS'; payload: Record<number, { id: string; assignedGlobalDeviceId: number | null }[]> }
  | { type: 'RESET_FORM' };

// 3. Initial State
const initialState: SessionState = {
  currentSessionDbId: null,
  sessionName: '',
  sessionDate: '',
  numSession: '',
  numStage: '',
  iterationCount: 1,
  iterationNames: ['Session_1'],
  selectedReferential: '',
  selectedReferentialId: null,
  location: '',
  notes: '',
  participants: [],
  selectedBlocIds: [],
  displayedBlockDetails: [],
  importSummary: null,
  editingSessionData: null,
  hardwareDevices: [],
  hardwareLoaded: false,
  activeTab: 'details',
  isGeneratingOrs: false,
  modifiedAfterOrsGeneration: false,
  trainersList: [],
  selectedTrainerId: null,
  referentielsData: [],
  allThemesData: [],
  allBlocsData: [],
  deviceKitsList: [],
  selectedKitIdState: null,
  isLoadingKits: true,
  votingDevicesInSelectedKit: [],
  participantAssignments: {},
};

// 4. Reducer Function
const sessionReducer = (state: SessionState, action: Action): SessionState => {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.payload };
    case 'SET_PARTICIPANTS':
      return { ...state, participants: action.payload };
    case 'SET_ASSIGNMENTS':
      return { ...state, participantAssignments: action.payload };
    case 'RESET_FORM':
      return {
          ...initialState,
          // Preserve data that should not be reset
          hardwareDevices: state.hardwareDevices,
          hardwareLoaded: state.hardwareLoaded,
          trainersList: state.trainersList,
          referentielsData: state.referentielsData,
          allThemesData: state.allThemesData,
          allBlocsData: state.allBlocsData,
          deviceKitsList: state.deviceKitsList,
      };
    default:
      return state;
  }
};

// 5. Create Context
const SessionContext = createContext<{
  state: SessionState;
  dispatch: Dispatch<Action>;
} | undefined>(undefined);

// 6. Create Provider Component
export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(sessionReducer, initialState);

  return (
    <SessionContext.Provider value={{ state, dispatch }}>
      {children}
    </SessionContext.Provider>
  );
};

// 7. Custom Hook for easy context consumption
export const useSessionContext = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSessionContext must be used within a SessionProvider');
  }
  return context;
};
