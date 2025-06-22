import { logger } from './logger';
import { Question, QuestionType } from '../types'; // Import Question and QuestionType

// Base URL for the Ombea API (local)
const OMBEA_API_BASE_URL = 'http://localhost:9236';

interface AccessToken {
  token: string;
  type: string;
  expiresAt: number;
}

export interface ApiOmbeaResponseLink {
  id: string;
  connectionState: "connected" | "disconnected" | "connecting" | "error";
  name?: string;
}

export interface ApiPollResponse {
  id: string; // This is the pollId
  type: string; // e.g., "standard"
  state: "running" | "stopped" | "completed"; // Possible states of the poll
}

export class OmbeaApi {
  private static instance: OmbeaApi;
  private accessToken: AccessToken | null = null;

  // Old simulation variables - to be eventually removed or properly scoped for testing only
  private isSimulatedConnected: boolean = false;
  private simulatedResponseInterval: NodeJS.Timeout | null = null;

  private constructor() {
    if (!process.env.REACT_APP_OMBEA_CLIENT_ID || !process.env.REACT_APP_OMBEA_CLIENT_SECRET) {
      logger.warn("OmbeaApi: Client ID ou Client Secret non configurés. L'authentification échouera.");
    }
  }

  public static getInstance(): OmbeaApi {
    if (!OmbeaApi.instance) {
      OmbeaApi.instance = new OmbeaApi();
    }
    return OmbeaApi.instance;
  }

  private isTokenValid(): boolean {
    const bufferSeconds = 60;
    return !!this.accessToken && this.accessToken.expiresAt > (Date.now() + bufferSeconds * 1000);
  }

  public getStoredAccessTokenValue(): string | null {
    if (this.isTokenValid()) {
      return `${this.accessToken!.type} ${this.accessToken!.token}`;
    }
    return null;
  }

  public clearStoredAccessToken(): void {
    this.accessToken = null;
    logger.info("OmbeaApi: Access token cleared.");
  }

  public async getAccessToken(): Promise<string> {
    const storedTokenValue = this.getStoredAccessTokenValue();
    if (storedTokenValue) {
      logger.debug("OmbeaApi: Using existing valid access token.");
      return storedTokenValue;
    }

    logger.info("OmbeaApi: Requesting new access token...");
    const clientId = process.env.REACT_APP_OMBEA_CLIENT_ID;
    const clientSecret = process.env.REACT_APP_OMBEA_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      logger.error("OmbeaApi: Client ID or Client Secret is missing.");
      throw new Error("Client ID ou Client Secret manquant.");
    }

    const credentials = btoa(`${clientId}:${clientSecret}`);
    const body = new URLSearchParams();
    body.append('grant_type', 'client_credentials');
    body.append('scope', 'responselink.events responselink.control');

    try {
      const response = await fetch(`${OMBEA_API_BASE_URL}/token/v1`, {
        method: 'POST',
        headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!response.ok) {
        let errorData;
        try { errorData = await response.json(); } catch (e) { errorData = { errors: [{ message: response.statusText }] }; }
        const firstErrorMessage = errorData.errors?.[0]?.message || response.statusText;
        logger.error('OmbeaApi: Failed to get access token', { status: response.status, error: errorData });
        throw new Error(`Échec token: ${firstErrorMessage}`);
      }

      const tokenData = await response.json();
      if (!tokenData.access_token || !tokenData.expires_in) {
        logger.error('OmbeaApi: Invalid token data received', tokenData);
        throw new Error('Données token API invalides.');
      }
      this.accessToken = {
        token: tokenData.access_token,
        type: tokenData.token_type || 'Bearer',
        expiresAt: Date.now() + ((tokenData.expires_in - 60) * 1000),
      };
      logger.success('OmbeaApi: Access token obtenu.');
      return `${this.accessToken.type} ${this.accessToken.token}`;
    } catch (error) {
      logger.error('OmbeaApi: Erreur requête access token', error);
      this.accessToken = null;
      throw error;
    }
  }

  private async makeApiRequest<T>(urlPath: string, options: RequestInit = {}, isRetry: boolean = false): Promise<T> {
    const token = await this.getAccessToken();
    const defaultHeaders: HeadersInit = {
      'Authorization': token,
      'Content-Type': 'application/json',
      ...options.headers,
    };
    const fullUrl = `${OMBEA_API_BASE_URL}${urlPath}`;

    try {
        const response = await fetch(fullUrl, { ...options, headers: defaultHeaders });
        if (!response.ok) {
            if (response.status === 401 && !isRetry) {
                logger.warn("OmbeaApi: 401 reçu, tentative de rafraîchissement token.");
                this.clearStoredAccessToken();
                return this.makeApiRequest<T>(urlPath, options, true);
            }
            let errorData;
            try { errorData = await response.json(); } catch (e) { errorData = { errors: [{ message: response.statusText }] }; }
            const firstErrorMessage = errorData.errors?.[0]?.message || response.statusText;
            logger.error(`OmbeaApi: Échec requête API ${fullUrl}`, { status: response.status, error: errorData });
            throw new Error(`Erreur API ${urlPath} (${response.status}): ${firstErrorMessage}`);
        }
        if (response.status === 204) {
            return undefined as T;
        }
        return response.json() as Promise<T>;
    } catch(error) {
        logger.error(`OmbeaApi: Erreur réseau/inattendue pour ${fullUrl}`, error);
        throw error;
    }
  }

  public async getResponseLinks(onlyConnected: boolean = true): Promise<ApiOmbeaResponseLink[]> {
    logger.debug(`OmbeaApi: Récupération ResponseLinks ${onlyConnected ? '(connectés)' : '(tous)'}...`);
    const urlPath = onlyConnected
      ? `/rlapi/v1/responselinks?connectionState=connected`
      : `/rlapi/v1/responselinks`;
    return this.makeApiRequest<ApiOmbeaResponseLink[]>(urlPath, { method: 'GET' });
  }

  public async startPoll(responseLinkId: string, question: Question): Promise<ApiPollResponse> {
    logger.info(`OmbeaApi: Démarrage poll Q:${question.id} sur RL:${responseLinkId}`);
    const urlPath = `/rlapi/v1/responselinks/${responseLinkId}/polls`;

    // Pour l'API Ombea, le type "standard" semble être pour QCM.
    // Il n'y a pas de distinction claire pour Vrai/Faux dans la doc fournie pour le corps de la requête.
    // On utilisera "standard" et le nombre d'options sera 2 pour Vrai/Faux.
    const pollType = "standard";

    const body = {
      type: pollType,
      configuration: {
        numberOfOptions: question.options.length,
        allowChangeOfMind: true, // Defaulting to true; pourrait être basé sur un champ de la question
      }
    };

    try {
      const pollResponseData = await this.makeApiRequest<ApiPollResponse>(urlPath, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      logger.success(`OmbeaApi: Poll démarré. ID: ${pollResponseData.id}, État: ${pollResponseData.state}`);
      return pollResponseData;
    } catch (error) {
      logger.error(`OmbeaApi: Échec démarrage poll RL:${responseLinkId}, Q:${question.id}`, error);
      throw error;
    }
  }

  public async stopPoll(responseLinkId: string, pollId: string): Promise<void> {
    logger.info(`OmbeaApi: Arrêt poll ID ${pollId} sur RL:${responseLinkId}`);
    const urlPath = `/rlapi/v1/responselinks/${responseLinkId}/polls/${pollId}/stop`;
    try {
      await this.makeApiRequest<void>(urlPath, { method: 'POST' });
      logger.success(`OmbeaApi: Poll ${pollId} arrêté.`);
    } catch (error) {
      logger.error(`OmbeaApi: Échec arrêt poll ${pollId} sur RL:${responseLinkId}`, error);
      throw error;
    }
  }

  // --- Méthodes de simulation conservées pour tests potentiels ---
  public async connect_simulated(): Promise<void> {
    this.isSimulatedConnected = true;
    logger.info('OmbeaApi (Simulated): Connection established.');
  }
  public disconnect_simulated(): void {
    this.isSimulatedConnected = false;
    if (this.simulatedResponseInterval) clearInterval(this.simulatedResponseInterval);
    this.simulatedResponseInterval = null;
    logger.info('OmbeaApi (Simulated): Disconnected.');
  }
  public startSimulatedResponses(onResponse: (deviceId: string, response: string) => void, deviceCount: number = 5): void {
    if (!this.isSimulatedConnected) {
      logger.warn('OmbeaApi (Simulated): Not connected, cannot start responses.');
      return;
    }
    this.stopSimulatedResponses();
    logger.info('OmbeaApi (Simulated): Starting simulated responses.');
    this.simulatedResponseInterval = setInterval(() => {
      const deviceId = `sim-${Math.floor(Math.random() * deviceCount) + 1}`;
      const response = String.fromCharCode(65 + Math.floor(Math.random() * 4));
      onResponse(deviceId, response);
    }, 1800);
  }
  public stopSimulatedResponses(): void {
    if (this.simulatedResponseInterval) {
      clearInterval(this.simulatedResponseInterval);
      this.simulatedResponseInterval = null;
      logger.info('OmbeaApi (Simulated): Stopped simulated responses.');
    }
  }
}

export const ombeaApi = OmbeaApi.getInstance();