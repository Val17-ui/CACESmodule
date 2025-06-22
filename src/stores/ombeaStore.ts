import { create } from 'zustand';
import { logger } from '../utils/logger';
import { Question } from '../types';
import { ombeaApi } from '../utils/ombeaApi'; // Import the real API handler

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
  isTestMode: false,
  responses: {},

  votingSession: {
    isActive: false,
    currentQuestion: null,
  },

  _simulatedResponseInterval: null, // Kept for now if test mode needs its own simulation

  connect: async () => {
    if (get().isConnecting || get().isConnected) {
      logger.info('OMBEA Store: Tentative de connexion ignorée (déjà connecté ou en cours de connexion).');
      return;
    }

    set({ isConnecting: true, connectionError: null });
    logger.info('OMBEA Store: Tentative de connexion à l\'API OMBEA réelle...');
    try {
      await ombeaApi.getAccessToken(); // Authenticate and get token
      // For Phase 1, successfully getting a token means "connected" at an auth level.
      // Device listing and SignalR will come in Phase 2 & 4.
      set({
        isConnected: true,
        isConnecting: false,
        connectionError: null,
        // devices: {} // Reset devices until Phase 2 fetches them
      });
      logger.success('OMBEA Store: Authentification réussie avec l\'API OMBEA.');
      // TODO Phase 2: Call ombeaApi.getResponseLinks() and update devices state
      // TODO Phase 4: Initialize SignalR connection here
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erreur inconnue lors de la connexion.';
      logger.error('OMBEA Store: Échec de la connexion/authentification à l\'API OMBEA.', { errorMsg, originalError: error });
      set({
        isConnected: false,
        isConnecting: false,
        connectionError: errorMsg,
        devices: {}
      });
    }
  },

  disconnect: () => {
    logger.info('OMBEA Store: Déconnexion de l\'API OMBEA...');
    ombeaApi.clearStoredAccessToken(); // Clear the stored token in the API utility
    get().stopSimulatedResponses();   // Stop any active simulation (if test mode was used)

    // TODO Phase 4: Properly close SignalR connection here: ombeaApi.disconnectSignalR();

    set({
      devices: {},
      isConnected: false,
      isConnecting: false,
      connectionError: null,
      responses: {},
      votingSession: { isActive: false, currentQuestion: null }
    });
    logger.info('OMBEA Store: Déconnecté et état réinitialisé.');
  },

  // handleResponse will be triggered by SignalR events in Phase 4
  // For now, it's mostly for simulated responses if isTestMode is true
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
    const { isConnected, isTestMode } = get();
    if (!isConnected) {
      logger.error("OMBEA Store: Impossible de démarrer la session de vote, API OMBEA (réelle) non connectée/authentifiée.");
      set(state => ({
        votingSession: { ...state.votingSession, isActive: false, currentQuestion: null },
        connectionError: "OMBEA non authentifié. Veuillez vous connecter."
      }));
      return;
    }

    // TODO Phase 3: Call ombeaApi.startPoll(initialQuestion) here
    // For now, we'll just activate the session locally and use simulation if in test mode.

    logger.info(`OMBEA Store: Démarrage de la session de vote (Question: ${initialQuestion.id}).`);
    get().clearResponses();
    set(state => ({
      votingSession: {
        ...state.votingSession,
        isActive: true,
        currentQuestion: initialQuestion,
      },
      connectionError: null
    }));
    logger.info(`OMBEA Store: Session de vote démarrée pour la question: "${initialQuestion.text.substring(0,30)}..."`);

    if (isTestMode) {
        // The component OmbeaExamVoteDisplay will call startSimulatedResponses if in test mode
        // and when a vote for a question is opened.
        logger.info("OMBEA Store: Mode Test actif. La simulation de réponses sera gérée par le composant d'affichage du vote.");
    }
  },

  setCurrentQuestionForVoting: (question: Question) => {
    const { votingSession, isTestMode } = get();
    if (!votingSession.isActive) {
      logger.warn("OMBEA Store: Impossible de changer de question, aucune session de vote active.");
      return;
    }

    // TODO Phase 3: Call ombeaApi.startPoll(question) here, after potentially stopping the previous poll.
    // For now, just update the current question and clear responses.
    // If a poll was active for the previous question, it should be stopped first.
    // This implies that OmbeaExamVoteDisplay's "stopVote" should call an API.

    logger.info(`OMBEA Store: Passage à la question: "${question.text.substring(0,30)}..."`);
    get().clearResponses();
    // get().stopSimulatedResponses(); // Stop simulation for old question; component will restart for new if needed.

    set(state => ({
      votingSession: {
        ...state.votingSession,
        currentQuestion: question,
      }
    }));

    if (isTestMode) {
        // Component OmbeaExamVoteDisplay will handle starting simulation for the new question when user opens vote.
        logger.info("OMBEA Store: Mode Test actif. La simulation pour la nouvelle question sera gérée par le composant.");
    }
  },

  endVotingSession: () => {
    // TODO Phase 3: If a poll is currently active on the API, call ombeaApi.stopPoll(currentPollId)

    logger.info('OMBEA Store: Session de vote terminée.');
    get().stopSimulatedResponses(); // Ensure simulation is stopped
    get().clearResponses();
    set(state => ({
      votingSession: {
        ...state.votingSession,
        isActive: false,
        currentQuestion: null,
      }
    }));
  },

  // Response Simulation logic remains largely the same, but its invocation might change.
  // It's now more explicitly tied to isTestMode and potentially started/stopped by OmbeaExamVoteDisplay.
  startSimulatedResponses: (questionType: 'true-false' | 'multiple-choice', optionsCount: number) => {
    const { devices, handleResponse, votingSession, isConnected, isTestMode } = get();

    // Check isTestMode explicitly here, as this function is for simulation.
    if (!isTestMode) {
        logger.info('OMBEA Store: startSimulatedResponses appelé mais le Mode Test est désactivé. Aucune simulation démarrée.');
        return;
    }
    if (!isConnected) {
        logger.warn('OMBEA Store: Simulation non démarrée (OMBEA non connecté/authentifié).');
        return;
    }
    if (!votingSession.isActive || !votingSession.currentQuestion) {
      logger.warn('OMBEA Store: Simulation non démarrée (session de vote inactive ou pas de question actuelle).');
      return;
    }

    get().stopSimulatedResponses();

    const deviceIds = Object.keys(devices);
    if (deviceIds.length === 0) {
      // If no devices from API, let's create some mock ones for simulation if in test mode
      logger.warn('OMBEA Store: Aucun boîtier réel détecté. Création de 10 boîtiers simulés pour le Mode Test.');
      for (let i = 1; i <= 10; i++) deviceIds.push(`sim-${i}`);
      // Note: these simulated devices won't be in the main `devices` state from API.
      // This is a local simulation detail.
    }

    logger.info(`OMBEA Store: Démarrage de la simulation de réponses pour ${deviceIds.length} boîtiers (Type: ${questionType}, Options: ${optionsCount})`);

    const interval = setInterval(() => {
      if (!get().votingSession.isActive || !get().isTestMode) {
          get().stopSimulatedResponses();
          return;
      }
      const numRespondingDevices = Math.floor(Math.random() * (deviceIds.length / 2)) + 1;
      for (let i = 0; i < numRespondingDevices; i++) {
        const randomDeviceId = deviceIds[Math.floor(Math.random() * deviceIds.length)];
        let randomResponse = 'A';
        if (questionType === 'true-false') {
          randomResponse = Math.random() < 0.5 ? 'A' : 'B';
        } else {
          const numChoices = Math.max(1, Math.min(optionsCount, 8));
          randomResponse = String.fromCharCode(65 + Math.floor(Math.random() * numChoices));
        }
        // Directly call the original handleResponse which now logs and updates state
        get().handleResponse(randomDeviceId, randomResponse);
      }
    }, 1500 + Math.random() * 1000); // Slightly faster for more dynamic feel

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