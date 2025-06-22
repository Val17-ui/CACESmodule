import { create } from 'zustand';
import { logger } from '../utils/logger';
import { Question, QuestionType } from '../types'; // Added QuestionType
import { ombeaApi, ApiOmbeaResponseLink, ApiPollResponse } from '../utils/ombeaApi';

export interface OmbeaDevice {
  id: string;
  name?: string;
  connected: boolean;
  lastResponse?: string;
  lastResponseTime?: Date;
}

interface OmbeaVotingSessionState {
  isActive: boolean; // Is an exam session active overall?
  currentQuestion: Question | null;
  currentPollId: string | null; // ID of the currently active poll on the API for currentQuestion
  isPollingActiveForQuestion: boolean; // True if a poll is currently running (collecting votes) for currentQuestion
  pollError: string | null; // For errors specific to starting/stopping individual polls
}

interface OmbeaState {
  devices: Record<string, OmbeaDevice>;
  activeResponseLinkId: string | null;
  isApiAuthenticated: boolean; // True if OAuth token is obtained
  isReadyForSession: boolean; // True if Authenticated AND at least one ResponseLink is active
  isConnecting: boolean; // Covers the whole process: auth + getResponseLinks
  connectionError: string | null; // For errors during connect() process
  isTestMode: boolean;
  responses: Record<string, string>;

  votingSession: OmbeaVotingSessionState;

  connect: () => Promise<boolean>;
  disconnect: () => void;
  handleResponse: (deviceId: string, response: string) => void;
  clearResponses: () => void;
  setTestMode: (enabled: boolean) => void;

  startExamSession: (initialQuestion: Question) => void;
  setCurrentExamQuestion: (question: Question) => Promise<void>;
  endExamSession: () => Promise<void>;

  openPollForCurrentQuestion: () => Promise<void>;
  closePollForCurrentQuestion: () => Promise<void>;

  _simulatedResponseInterval: NodeJS.Timeout | null;
  startSimulatedResponses: (questionType: QuestionType, optionsCount: number) => void;
  stopSimulatedResponses: () => void;
}

export const useOmbeaStore = create<OmbeaState>((set, get) => ({
  devices: {},
  activeResponseLinkId: null,
  isApiAuthenticated: false,
  isReadyForSession: false,
  isConnecting: false,
  connectionError: null,
  isTestMode: false,
  responses: {},

  votingSession: {
    isActive: false,
    currentQuestion: null,
    currentPollId: null,
    isPollingActiveForQuestion: false,
    pollError: null,
  },

  _simulatedResponseInterval: null,

  connect: async () => {
    if (get().isConnecting) {
      logger.info('OMBEA Store: Connexion déjà en cours.');
      return get().isReadyForSession;
    }

    set({ isConnecting: true, connectionError: null, devices: {}, activeResponseLinkId: null, isApiAuthenticated: false, isReadyForSession: false });
    logger.info('OMBEA Store: Tentative de connexion API OMBEA...');
    try {
      await ombeaApi.getAccessToken();
      set({isApiAuthenticated: true});
      logger.info('OMBEA Store: Authentification OK. Récupération ResponseLinks...');

      const responseLinks = await ombeaApi.getResponseLinks(true);

      if (responseLinks && responseLinks.length > 0) {
        const newDevices: Record<string, OmbeaDevice> = {};
        responseLinks.forEach((link: ApiOmbeaResponseLink) => {
          newDevices[link.id] = {
            id: link.id, name: link.name || `ResponseLink ${link.id}`,
            connected: link.connectionState === 'connected',
          };
        });

        const firstActiveLink = responseLinks.find(link => link.connectionState === 'connected');
        const activeId = firstActiveLink ? firstActiveLink.id : null;

        if (activeId) {
            set({
              isConnecting: false, connectionError: null, devices: newDevices,
              activeResponseLinkId: activeId, isReadyForSession: true,
            });
            logger.success(`OMBEA Store: Connexion complète. ${Object.keys(newDevices).length} boîtier(s) listé(s). Actif: ${activeId}`);
            return true;
        } else {
            logger.warn(`OMBEA Store: Auth OK, mais aucun ResponseLink actif trouvé.`);
            set({isConnecting: false, connectionError: "Aucun boîtier OMBEA actif détecté.", devices: newDevices, isReadyForSession: false });
            return false;
        }
      } else {
        logger.warn('OMBEA Store: Auth OK, mais aucun ResponseLink retourné/connecté.');
        set({
          isConnecting: false, devices: {}, activeResponseLinkId: null,
          connectionError: "Aucun boîtier OMBEA détecté.", isReadyForSession: false
        });
        return false;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erreur connexion inconnue.';
      logger.error('OMBEA Store: Échec connexion API OMBEA.', { errorMsg, originalError: error });
      set({
        isApiAuthenticated: false, isReadyForSession: false, isConnecting: false,
        connectionError: errorMsg, devices: {}, activeResponseLinkId: null,
      });
      return false;
    }
  },

  disconnect: () => {
    logger.info('OMBEA Store: Déconnexion API OMBEA...');
    if(get().votingSession.currentPollId && get().activeResponseLinkId && get().votingSession.isPollingActiveForQuestion) {
      ombeaApi.stopPoll(get().activeResponseLinkId!, get().votingSession.currentPollId!)
        .catch(e => logger.warn("Erreur arrêt poll pendant déconnexion", e));
    }
    ombeaApi.clearStoredAccessToken();
    get().stopSimulatedResponses();
    set({
      devices: {}, activeResponseLinkId: null, isApiAuthenticated: false, isReadyForSession: false,
      isConnecting: false, connectionError: null, responses: {},
      votingSession: { isActive: false, currentQuestion: null, currentPollId: null, isPollingActiveForQuestion: false, pollError: null }
    });
    logger.info('OMBEA Store: Déconnecté et état réinitialisé.');
  },

  handleResponse: (deviceId: string, response: string) => {
    const { votingSession, isTestMode } = get();
    if (!votingSession.isActive || !votingSession.currentQuestion || !votingSession.isPollingActiveForQuestion) {
      return;
    }
    const timestamp = new Date();
    set(state => ({
      devices: { ...state.devices, [deviceId]: {
          ...(state.devices[deviceId] || { id: deviceId, connected: true, name: `Sim-${deviceId}` }),
          lastResponse: response, lastResponseTime: timestamp,
      }},
      responses: { ...state.responses, [deviceId]: response }
    }));
    logger.debug( `OMBEA Store: Réponse Boîtier #${deviceId} → ${response} pour Q "${votingSession.currentQuestion.id}"`);
  },

  clearResponses: () => { set({ responses: {} }); logger.info('OMBEA Store: Réponses locales effacées.'); },

  setTestMode: (enabled: boolean) => {
    set({ isTestMode: enabled });
    logger.info(`OMBEA Store: Mode Test ${enabled ? 'activé' : 'désactivé'}.`);
    if (!enabled && get()._simulatedResponseInterval) { get().stopSimulatedResponses(); }
  },

  startExamSession: (initialQuestion: Question) => {
    const { isReadyForSession, isTestMode, activeResponseLinkId } = get();
    if (!isReadyForSession && !isTestMode) {
      logger.error("OMBEA Store: Examen non démarré. OMBEA non prêt.");
      set(state => ({ votingSession: { ...state.votingSession, isActive: false, pollError: "OMBEA non prêt." }}));
      return;
    }
    logger.info(`OMBEA Store: Démarrage session examen Q: ${initialQuestion.id}. RL: ${activeResponseLinkId || 'Simulation'}`);
    get().clearResponses();
    set(state => ({
      votingSession: { isActive: true, currentQuestion: initialQuestion, currentPollId: null, isPollingActiveForQuestion: false, pollError: null },
      connectionError: null
    }));
  },

  setCurrentExamQuestion: async (question: Question) => {
    const { votingSession, activeResponseLinkId, isTestMode } = get();
    if (!votingSession.isActive) { logger.warn("OMBEA Store: ChangeQ: Session examen non active."); return; }

    logger.info(`OMBEA Store: Passage à Q: "${question.text.substring(0,30)}..."`);
    if (votingSession.isPollingActiveForQuestion && votingSession.currentPollId && activeResponseLinkId && !isTestMode) {
      try {
        logger.info(`OMBEA Store: ChangeQ: Arrêt poll précédent ${votingSession.currentPollId}.`);
        await ombeaApi.stopPoll(activeResponseLinkId, votingSession.currentPollId);
      } catch (error) { logger.error("OMBEA Store: ChangeQ: Échec arrêt poll précédent.", error); }
    }
    get().clearResponses();
    get().stopSimulatedResponses();
    set(state => ({
      votingSession: { ...state.votingSession, currentQuestion: question, currentPollId: null, isPollingActiveForQuestion: false, pollError: null }
    }));
  },

  endExamSession: async () => {
    const { votingSession, activeResponseLinkId, isTestMode } = get();
    logger.info('OMBEA Store: Fin de session d\'examen.');
    if (votingSession.isPollingActiveForQuestion && votingSession.currentPollId && activeResponseLinkId && !isTestMode) {
      try { await ombeaApi.stopPoll(activeResponseLinkId, votingSession.currentPollId); }
      catch (error) { logger.error("OMBEA Store: EndSession: Échec arrêt poll actif.", error); }
    }
    get().stopSimulatedResponses();
    get().clearResponses();
    set(state => ({
      votingSession: { ...state.votingSession, isActive: false, currentQuestion: null, currentPollId: null, isPollingActiveForQuestion: false, pollError: null }
    }));
  },

  openPollForCurrentQuestion: async () => {
    const { votingSession, activeResponseLinkId, isTestMode, isReadyForSession } = get();
    const currentQ = votingSession.currentQuestion;

    if (!votingSession.isActive || !currentQ) {
      logger.warn("OMBEA Store: OpenPoll: Session/Question non active.");
      set(state => ({ votingSession: {...state.votingSession, pollError: "Session ou question non active." }})); return;
    }
    if (votingSession.isPollingActiveForQuestion) { logger.info("OMBEA Store: OpenPoll: Poll déjà actif."); return; }
    if (!activeResponseLinkId && !isTestMode) {
      logger.error("OMBEA Store: OpenPoll: Aucun ResponseLink actif.");
      set(state => ({ votingSession: {...state.votingSession, pollError: "Aucun boîtier OMBEA actif." }})); return;
    }

    set(state => ({ votingSession: {...state.votingSession, pollError: null }}));
    get().clearResponses();

    if (!isTestMode && activeResponseLinkId) {
      try {
        logger.info(`OMBEA Store: OpenPoll: Ouverture poll pour Q: ${currentQ.id} sur RL: ${activeResponseLinkId}`);
        const pollResponse = await ombeaApi.startPoll(activeResponseLinkId, currentQ);
        set(state => ({ votingSession: { ...state.votingSession, currentPollId: pollResponse.id, isPollingActiveForQuestion: true }}));
        logger.success(`OMBEA Store: OpenPoll: Poll ${pollResponse.id} ouvert.`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Erreur inconnue ouverture poll.";
        logger.error("OMBEA Store: OpenPoll: Échec.", { errorMsg, originalError: error });
        set(state => ({ votingSession: {...state.votingSession, pollError: errorMsg, isPollingActiveForQuestion: false }}));
      }
    } else if (isTestMode) {
      logger.info("OMBEA Store: OpenPoll: Mode Test - Démarrage simulation.");
      set(state => ({ votingSession: { ...state.votingSession, currentPollId: `sim-poll-${Date.now()}`, isPollingActiveForQuestion: true }}));
      get().startSimulatedResponses(currentQ.type, currentQ.options.length);
    }
  },

  closePollForCurrentQuestion: async () => {
    const { votingSession, activeResponseLinkId, isTestMode } = get();
    if (!votingSession.isPollingActiveForQuestion) { logger.warn("OMBEA Store: ClosePoll: Pas de poll actif à clore."); return; }

    set(state => ({ votingSession: {...state.votingSession, pollError: null }}));

    if (!isTestMode && activeResponseLinkId && votingSession.currentPollId) {
      try {
        logger.info(`OMBEA Store: ClosePoll: Clôture poll ${votingSession.currentPollId} sur RL: ${activeResponseLinkId}`);
        await ombeaApi.stopPoll(activeResponseLinkId, votingSession.currentPollId);
        // currentPollId is kept for potential result fetching or reference, isPollingActiveForQuestion is the key state
        set(state => ({ votingSession: { ...state.votingSession, isPollingActiveForQuestion: false }}));
        logger.success(`OMBEA Store: ClosePoll: Poll ${votingSession.currentPollId} clos.`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Erreur inconnue clôture poll.";
        logger.error("OMBEA Store: ClosePoll: Échec.", { errorMsg, originalError: error });
        set(state => ({ votingSession: {...state.votingSession, pollError: errorMsg }}));
      }
    } else if (isTestMode) {
      logger.info("OMBEA Store: ClosePoll: Mode Test - Arrêt simulation.");
      get().stopSimulatedResponses();
      set(state => ({ votingSession: { ...state.votingSession, isPollingActiveForQuestion: false }}));
    }
  },

  startSimulatedResponses: (questionType: QuestionType, optionsCount: number) => {
    const { devices: apiDevices, handleResponse, votingSession, isTestMode } = get();
    if (!isTestMode) { logger.info('OMBEA Store: Simu non démarrée (Mode Test off).'); return; }
    if (!votingSession.isActive || !votingSession.currentQuestion || !votingSession.isPollingActiveForQuestion) {
        logger.warn('OMBEA Store: Simu non démarrée (session/question/poll non actif).'); return;
    }

    get().stopSimulatedResponses();
    let simDeviceIds = Object.keys(apiDevices);
    if (simDeviceIds.length === 0) {
      logger.warn('OMBEA Store: Simu: 0 boîtier réel. Création 10 boîtiers simulés.');
      simDeviceIds = Array.from({length: 10}, (_, i) => `sim-${i + 1}`);
    }
    logger.info(`OMBEA Store: Démarrage simu réponses pour ${simDeviceIds.length} boîtiers`);
    const interval = setInterval(() => {
      if (!get().votingSession.isActive || !get().isTestMode || !get().votingSession.isPollingActiveForQuestion) {
          get().stopSimulatedResponses(); return;
      }
      const numRespondingDevices = Math.floor(Math.random() * (simDeviceIds.length / 2)) + 1;
      for (let i = 0; i < numRespondingDevices; i++) {
        const randomDeviceId = simDeviceIds[Math.floor(Math.random() * simDeviceIds.length)];
        let randomResponse = 'A';
        // Use QuestionType enum for comparison
        if (votingSession.currentQuestion!.type === QuestionType.TrueFalse) {
          randomResponse = Math.random() < 0.5 ? 'A' : 'B';
        } else {
          const numChoices = Math.max(1, Math.min(votingSession.currentQuestion!.options.length, 8));
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