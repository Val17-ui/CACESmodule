import { create } from 'zustand';
import { logger } from '../utils/logger';
import { Question } from '../types';
import { ombeaApi, ApiOmbeaResponseLink } from '../utils/ombeaApi'; // Import the real API handler and new interface

export interface OmbeaDevice {
  id: string;
  name?: string; // From API: ResponseLink name
  connected: boolean; // True if connectionState is "connected"
  lastResponse?: string; // Will be updated by SignalR or simulation
  lastResponseTime?: Date; // Will be updated by SignalR or simulation
}

interface OmbeaVotingSessionState {
  isActive: boolean;
  currentQuestion: Question | null;
}

interface OmbeaState {
  devices: Record<string, OmbeaDevice>; // Store devices by ID
  activeResponseLinkId: string | null; // To store the ID of the chosen ResponseLink for polls
  isConnected: boolean; // True if authenticated AND at least one ResponseLink is usable
  isConnecting: boolean;
  connectionError: string | null;
  isTestMode: boolean;
  responses: Record<string, string>;

  votingSession: OmbeaVotingSessionState;

  connect: () => Promise<void>;
  disconnect: () => void;
  handleResponse: (deviceId: string, response: string) => void;
  clearResponses: () => void;
  setTestMode: (enabled: boolean) => void;

  startVotingSession: (initialQuestion: Question) => void;
  setCurrentQuestionForVoting: (question: Question) => void;
  endVotingSession: () => void;

  _simulatedResponseInterval: NodeJS.Timeout | null;
  startSimulatedResponses: (questionType: 'true-false' | 'multiple-choice', optionsCount: number) => void;
  stopSimulatedResponses: () => void;
}

export const useOmbeaStore = create<OmbeaState>((set, get) => ({
  devices: {},
  activeResponseLinkId: null,
  isConnected: false,
  isConnecting: false,
  connectionError: null,
  isTestMode: false,
  responses: {},

  votingSession: {
    isActive: false,
    currentQuestion: null,
  },

  _simulatedResponseInterval: null,

  connect: async () => {
    if (get().isConnecting) {
      logger.info('OMBEA Store: Tentative de connexion ignorée (déjà en cours de connexion).');
      return;
    }

    set({ isConnecting: true, connectionError: null, devices: {}, activeResponseLinkId: null });
    logger.info('OMBEA Store: Tentative de connexion à l\'API OMBEA réelle...');
    try {
      await ombeaApi.getAccessToken();
      logger.info('OMBEA Store: Authentification réussie. Récupération des ResponseLinks...');

      const responseLinks = await ombeaApi.getResponseLinks(true); // Get only connected devices

      if (responseLinks && responseLinks.length > 0) {
        const newDevices: Record<string, OmbeaDevice> = {};
        responseLinks.forEach((link: ApiOmbeaResponseLink) => {
          newDevices[link.id] = {
            id: link.id,
            name: link.name || `ResponseLink ${link.id}`,
            connected: link.connectionState === 'connected',
          };
        });

        const firstActiveLink = responseLinks.find(link => link.connectionState === 'connected');
        const activeId = firstActiveLink ? firstActiveLink.id : null;

        set({
          isConnected: true,
          isConnecting: false,
          connectionError: null,
          devices: newDevices,
          activeResponseLinkId: activeId,
        });
        if (activeId) {
            logger.success(`OMBEA Store: Connexion complète. ${Object.keys(newDevices).length} boîtier(s) listé(s). Boîtier actif: ${activeId}`);
        } else {
            logger.warn(`OMBEA Store: Authentification réussie, mais aucun ResponseLink actif trouvé.`);
            set({connectionError: "Aucun boîtier OMBEA actif détecté.", isConnected: true}); // still auth'd
        }
      } else {
        logger.warn('OMBEA Store: Authentification réussie, mais aucun ResponseLink retourné ou connecté.');
        set({
          isConnected: true,
          isConnecting: false,
          devices: {},
          activeResponseLinkId: null,
          connectionError: "Aucun boîtier OMBEA détecté après authentification."
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erreur inconnue lors de la connexion.';
      logger.error('OMBEA Store: Échec de la connexion à l\'API OMBEA.', { errorMsg, originalError: error });
      set({
        isConnected: false,
        isConnecting: false,
        connectionError: errorMsg,
        devices: {},
        activeResponseLinkId: null,
      });
    }
  },

  disconnect: () => {
    logger.info('OMBEA Store: Déconnexion de l\'API OMBEA...');
    ombeaApi.clearStoredAccessToken();
    get().stopSimulatedResponses();
    // TODO Phase 4: Properly close SignalR connection here
    set({
      devices: {},
      activeResponseLinkId: null,
      isConnected: false,
      isConnecting: false,
      connectionError: null,
      responses: {},
      votingSession: { isActive: false, currentQuestion: null }
    });
    logger.info('OMBEA Store: Déconnecté et état réinitialisé.');
  },

  handleResponse: (deviceId: string, response: string) => {
    const { votingSession, isTestMode, devices } = get();
    if (!votingSession.isActive || !votingSession.currentQuestion) {
      logger.warn(`OMBEA Store: Réponse reçue pour ${deviceId} mais aucune session de vote active ou question définie.`);
      return;
    }
    const timestamp = new Date();
    set(state => ({
      devices: {
        ...state.devices,
        [deviceId]: {
          ...(state.devices[deviceId] || { id: deviceId, connected: true, name: `Device ${deviceId}` }),
          lastResponse: response,
          lastResponseTime: timestamp,
        }
      },
      responses: { ...state.responses, [deviceId]: response }
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
  },

  startVotingSession: (initialQuestion: Question) => {
    const { isConnected, activeResponseLinkId, isTestMode } = get();
    if (!isConnected) {
      logger.error("OMBEA Store: Impossible de démarrer la session de vote, API OMBEA non connectée/authentifiée.");
      set(state => ({
        votingSession: { ...state.votingSession, isActive: false, currentQuestion: null },
        connectionError: "OMBEA non authentifié. Veuillez vous connecter."
      }));
      return;
    }
    if (!activeResponseLinkId && !isTestMode) {
        logger.error("OMBEA Store: Impossible de démarrer la session de vote, aucun ResponseLink actif sélectionné.");
        set(state => ({
          votingSession: { ...state.votingSession, isActive: false, currentQuestion: null },
          connectionError: "Aucun boîtier OMBEA actif pour démarrer le vote."
        }));
        return;
    }
    // TODO Phase 3: Call ombeaApi.startPoll(activeResponseLinkId, initialQuestion) here
    logger.info(`OMBEA Store: Démarrage de la session de vote (Question: ${initialQuestion.id}). RL: ${activeResponseLinkId || 'Simulation'}`);
    get().clearResponses();
    set(state => ({
      votingSession: {
        ...state.votingSession,
        isActive: true,
        currentQuestion: initialQuestion,
      },
      connectionError: null
    }));
  },

  setCurrentQuestionForVoting: (question: Question) => {
    const { votingSession } = get();
    if (!votingSession.isActive) {
      logger.warn("OMBEA Store: Impossible de changer de question, aucune session de vote active.");
      return;
    }
    // TODO Phase 3: Call ombeaApi.startPoll for the new question (after stopping old one if necessary)
    logger.info(`OMBEA Store: Passage à la question: "${question.text.substring(0,30)}..."`);
    get().clearResponses();
    set(state => ({
      votingSession: { ...state.votingSession, currentQuestion: question }
    }));
  },

  endVotingSession: () => {
    // TODO Phase 3: If a poll is active, call ombeaApi.stopPoll(activeResponseLinkId, currentPollId)
    logger.info('OMBEA Store: Session de vote terminée.');
    get().stopSimulatedResponses();
    get().clearResponses();
    set(state => ({
      votingSession: { ...state.votingSession, isActive: false, currentQuestion: null }
    }));
  },

  startSimulatedResponses: (questionType: 'true-false' | 'multiple-choice', optionsCount: number) => {
    const { devices: apiDevices, handleResponse, votingSession, isConnected, isTestMode } = get();
    if (!isTestMode) {
        logger.info('OMBEA Store: startSimulatedResponses appelé mais Mode Test désactivé.');
        return;
    }

    get().stopSimulatedResponses();

    let simDeviceIds = Object.keys(apiDevices);
    if (simDeviceIds.length === 0) {
      logger.warn('OMBEA Store: Aucun boîtier réel. Création de 10 boîtiers simulés pour Mode Test.');
      simDeviceIds = Array.from({length: 10}, (_, i) => `sim-${i + 1}`);
    }

    if (!votingSession.isActive || !votingSession.currentQuestion) {
      logger.warn('OMBEA Store: Simulation non démarrée (session vote inactive ou pas de question).');
      return;
    }

    logger.info(`OMBEA Store: Démarrage simulation réponses pour ${simDeviceIds.length} boîtiers (Type: ${questionType}, Options: ${optionsCount})`);
    const interval = setInterval(() => {
      if (!get().votingSession.isActive || !get().isTestMode) {
          get().stopSimulatedResponses();
          return;
      }
      const numRespondingDevices = Math.floor(Math.random() * (simDeviceIds.length / 2)) + 1;
      for (let i = 0; i < numRespondingDevices; i++) {
        const randomDeviceId = simDeviceIds[Math.floor(Math.random() * simDeviceIds.length)];
        let randomResponse = 'A';
        if (questionType === 'true-false') {
          randomResponse = Math.random() < 0.5 ? 'A' : 'B';
        } else {
          const numChoices = Math.max(1, Math.min(optionsCount, 8));
          randomResponse = String.fromCharCode(65 + Math.floor(Math.random() * numChoices));
        }
        get().handleResponse(randomDeviceId, randomResponse);
      }
    }, 1500 + Math.random() * 1000);
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