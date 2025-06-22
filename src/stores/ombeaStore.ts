import { create } from 'zustand';
import { logger } from '../utils/logger';
import { Question } from '../types'; // Assuming Question type is available

export interface OmbeaDevice {
  id: string;
  connected: boolean;
  lastResponse?: string;
  lastResponseTime?: Date;
}

interface OmbeaVotingSessionState {
  isActive: boolean;
  currentQuestion: Question | null;
  // `responses` will store responses for the current question: { deviceId: responseValue }
  // `sessionResults` could store aggregated results per question if needed for a summary later
}

interface OmbeaState {
  devices: Record<string, OmbeaDevice>;
  isConnected: boolean;
  isConnecting: boolean; // To prevent multiple connection attempts
  connectionError: string | null;
  isTestMode: boolean; // For simulating device responses
  responses: Record<string, string>; // Responses for the current question being voted on

  votingSession: OmbeaVotingSessionState;

  connect: () => Promise<void>;
  disconnect: () => void;
  handleResponse: (deviceId: string, response: string) => void; // Records a single device response
  clearResponses: () => void; // Clears responses for the current question (e.g., when moving to next)
  setTestMode: (enabled: boolean) => void;

  // Actions for managing a voting session
  startVotingSession: (initialQuestion: Question) => void;
  setCurrentQuestionForVoting: (question: Question) => void;
  endVotingSession: () => void;

  // For simulation, might be moved to a separate utility or kept here if simple
  _simulatedResponseInterval: NodeJS.Timeout | null;
  startSimulatedResponses: (questionType: 'true-false' | 'multiple-choice', optionsCount: number) => void;
  stopSimulatedResponses: () => void;
}

export const useOmbeaStore = create<OmbeaState>((set, get) => ({
  devices: {},
  isConnected: false,
  isConnecting: false,
  connectionError: null,
  isTestMode: false, // Default to false, can be enabled via UI or settings
  responses: {},

  votingSession: {
    isActive: false,
    currentQuestion: null,
  },

  _simulatedResponseInterval: null,

  connect: async () => {
    if (get().isConnecting || get().isConnected) {
      logger.info('OMBEA Store: Connection attempt skipped (already connected or connecting).');
      return;
    }

    set({ isConnecting: true, connectionError: null });
    logger.info('OMBEA Store: Attempting connection...');
    try {
      // Simulate USB connection detection and handshake
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000)); // Simulate variable delay
      
      // Simulate finding a random number of devices
      const numDevices = Math.floor(Math.random() * 10) + 5; // 5 to 14 devices
      const newDevices: Record<string, OmbeaDevice> = {};
      for (let i = 1; i <= numDevices; i++) {
        newDevices[i.toString()] = {
          id: i.toString(),
          connected: true, // Assume all discovered devices are initially connected
        };
      }
      
      set({ devices: newDevices, isConnected: true, isConnecting: false, connectionError: null });
      logger.success(`OMBEA Store: Connexion établie. ${numDevices} boîtier(s) détecté(s).`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erreur inconnue';
      logger.error('OMBEA Store: Échec de la connexion OMBEA.', error);
      set({ isConnected: false, isConnecting: false, connectionError: errorMsg, devices: {} });
      // Do not throw error here, let UI handle connectionError state
    }
  },

  disconnect: () => {
    get().stopSimulatedResponses(); // Stop simulation if active
    set({
      devices: {},
      isConnected: false,
      isConnecting: false,
      connectionError: null,
      responses: {}, // Clear any current responses
      votingSession: { isActive: false, currentQuestion: null } // Reset voting session state
    });
    logger.info('OMBEA Store: Déconnexion de l\'API OMBEA et réinitialisation de l\'état.');
  },

  handleResponse: (deviceId: string, response: string) => {
    const { votingSession, isTestMode, devices } = get();
    if (!votingSession.isActive || !votingSession.currentQuestion) {
      logger.warn(`OMBEA Store: Réponse reçue pour ${deviceId} mais aucune session de vote active ou question définie.`);
      return;
    }

    const timestamp = new Date();
    
    set(state => ({
      // Update device specific info (last response)
      devices: {
        ...state.devices,
        [deviceId]: {
          ...(state.devices[deviceId] || { id: deviceId, connected: true }), // Add device if not listed (e.g. late joiner)
          lastResponse: response,
          lastResponseTime: timestamp,
        }
      },
      // Store response for current question
      responses: {
        ...state.responses,
        [deviceId]: response // Overwrite previous response if any for this question
      }
    }));

    logger.info(
      `OMBEA Store: Réponse du boîtier #${deviceId} → ${response} pour la question "${votingSession.currentQuestion.text.substring(0,30)}..."`,
      isTestMode ? undefined : { deviceId, response, questionId: votingSession.currentQuestion.id, timestamp }
    );
  },

  clearResponses: () => {
    set({ responses: {} });
    logger.info('OMBEA Store: Réponses pour la question actuelle effacées.');
  },

  setTestMode: (enabled: boolean) => {
    set({ isTestMode: enabled });
    logger.info(`OMBEA Store: Mode test ${enabled ? 'activé' : 'désactivé'}.`);
    if (!enabled) {
      get().stopSimulatedResponses();
    }
    // If enabling test mode and a session is active, one might want to auto-start simulation
    // This depends on desired UX. For now, simulation is started/stopped by component interaction.
  },

  // Voting Session Management
  startVotingSession: (initialQuestion: Question) => {
    if (!get().isConnected) {
      logger.error("OMBEA Store: Impossible de démarrer la session de vote, API OMBEA non connectée.");
      set(state => ({ votingSession: { ...state.votingSession, isActive: false, currentQuestion: null}, connectionError: "OMBEA non connecté." }));
      return;
    }
    get().clearResponses(); // Clear any lingering responses
    set(state => ({
      votingSession: {
        ...state.votingSession,
        isActive: true,
        currentQuestion: initialQuestion,
      },
      connectionError: null // Clear any previous connection error
    }));
    logger.info(`OMBEA Store: Session de vote démarrée. Question initiale: "${initialQuestion.text.substring(0,30)}..."`);
  },

  setCurrentQuestionForVoting: (question: Question) => {
    if (!get().votingSession.isActive) {
      logger.warn("OMBEA Store: Impossible de changer de question, aucune session de vote active.");
      return;
    }
    get().clearResponses();
    // Simulation for new question will be started by the component if in test mode.
    // get().stopSimulatedResponses();

    set(state => ({
      votingSession: {
        ...state.votingSession,
        currentQuestion: question,
      }
    }));
    logger.info(`OMBEA Store: Passage à la question: "${question.text.substring(0,30)}..."`);
  },

  endVotingSession: () => {
    get().stopSimulatedResponses();
    get().clearResponses();
    set(state => ({
      votingSession: {
        ...state.votingSession,
        isActive: false,
        currentQuestion: null,
      }
    }));
    logger.info('OMBEA Store: Session de vote terminée.');
  },

  // Response Simulation (basic example)
  startSimulatedResponses: (questionType: 'true-false' | 'multiple-choice', optionsCount: number) => {
    const { devices, handleResponse, votingSession, isConnected, isTestMode } = get();
    if (!isConnected || !votingSession.isActive || !isTestMode) {
      logger.warn('OMBEA Store: Simulation non démarrée (non connecté, session inactive ou mode test désactivé).');
      return;
    }

    get().stopSimulatedResponses(); // Clear existing interval if any

    const deviceIds = Object.keys(devices);
    if (deviceIds.length === 0) {
      logger.warn('OMBEA Store: Simulation non démarrée, aucun boîtier simulé disponible.');
      // Potentially add some mock devices if none exist and in test mode
      // For now, requires devices to be populated by connect()
      return;
    }

    logger.info(`OMBEA Store: Démarrage de la simulation de réponses pour ${deviceIds.length} boîtiers. Type: ${questionType}, Options: ${optionsCount}`);

    const interval = setInterval(() => {
      if (!get().votingSession.isActive) { // Stop if session becomes inactive
          get().stopSimulatedResponses();
          return;
      }
      // Simulate a random number of devices responding in this interval
      const numRespondingDevices = Math.floor(Math.random() * (deviceIds.length / 2)) + 1;
      for (let i = 0; i < numRespondingDevices; i++) {
        const randomDeviceId = deviceIds[Math.floor(Math.random() * deviceIds.length)];
        let randomResponse = 'A';
        if (questionType === 'true-false') {
          randomResponse = Math.random() < 0.5 ? 'A' : 'B'; // True or False
        } else { // multiple-choice
          // Ensure optionsCount is at least 1 to prevent issues with charCodeAt
          const numChoices = Math.max(1, Math.min(optionsCount, 8)); // Limit to H for safety
          randomResponse = String.fromCharCode(65 + Math.floor(Math.random() * numChoices)); // A, B, C...
        }
        handleResponse(randomDeviceId, randomResponse);
      }
    }, 2000 + Math.random() * 1500); // Vary interval slightly

    set({ _simulatedResponseInterval: interval });
  },

  stopSimulatedResponses: () => {
    const interval = get()._simulatedResponseInterval;
    if (interval) {
      clearInterval(interval);
      set({ _simulatedResponseInterval: null });
      logger.info('OMBEA Store: Simulation de réponses arrêtée.');
    }
  },
}));