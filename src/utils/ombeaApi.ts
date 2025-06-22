import { logger } from './logger';

// Base URL for the Ombea API (local)
const OMBEA_API_BASE_URL = 'http://localhost:9236';

interface AccessToken {
  token: string;
  type: string; // e.g., "bearer"
  expiresAt: number; // Timestamp when the token expires
}

export class OmbeaApi {
  private static instance: OmbeaApi;
  private accessToken: AccessToken | null = null;

  // Variables for simulated connection (can be removed later or kept for testing)
  private isSimulatedConnected: boolean = false;
  private simulatedResponseInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Note for user: Ensure REACT_APP_OMBEA_CLIENT_ID and REACT_APP_OMBEA_CLIENT_SECRET are set in your .env.local file
    if (!process.env.REACT_APP_OMBEA_CLIENT_ID || !process.env.REACT_APP_OMBEA_CLIENT_SECRET) {
      logger.warn("OmbeaApi: Client ID ou Client Secret non configurés dans les variables d'environnement (.env.local). L'authentification échouera.");
    }
  }

  public static getInstance(): OmbeaApi {
    if (!OmbeaApi.instance) {
      OmbeaApi.instance = new OmbeaApi();
    }
    return OmbeaApi.instance;
  }

  private isTokenValid(): boolean {
    return !!this.accessToken && this.accessToken.expiresAt > Date.now();
  }

  public getStoredAccessToken(): string | null {
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
    if (this.isTokenValid()) {
      logger.info("OmbeaApi: Using existing valid access token.");
      return `${this.accessToken!.type} ${this.accessToken!.token}`;
    }

    logger.info("OmbeaApi: Requesting new access token...");
    const clientId = process.env.REACT_APP_OMBEA_CLIENT_ID;
    const clientSecret = process.env.REACT_APP_OMBEA_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      logger.error("OmbeaApi: Client ID or Client Secret is missing. Cannot authenticate.");
      throw new Error("Client ID ou Client Secret manquant.");
    }

    const credentials = btoa(`${clientId}:${clientSecret}`);
    const body = new URLSearchParams();
    body.append('grant_type', 'client_credentials');
    body.append('scope', 'responselink.events responselink.control');

    try {
      const response = await fetch(`${OMBEA_API_BASE_URL}/token/v1`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        logger.error('OmbeaApi: Failed to get access token', { status: response.status, error: errorData });
        throw new Error(`Échec de l'obtention du token: ${errorData.message || response.statusText}`);
      }

      const tokenData = await response.json();
      this.accessToken = {
        token: tokenData.access_token,
        type: tokenData.token_type || 'bearer',
        // expires_in is in seconds, convert to timestamp
        expiresAt: Date.now() + (tokenData.expires_in * 1000),
      };
      logger.success('OmbeaApi: Access token obtained successfully.');
      return `${this.accessToken.type} ${this.accessToken.token}`;
    } catch (error) {
      logger.error('OmbeaApi: Error during access token request', error);
      this.accessToken = null; // Ensure token is cleared on error
      throw error; // Re-throw for the store to handle
    }
  }

  // --- Methods for actual API interaction will be added in later phases ---
  // Example:
  // public async getResponseLinks(): Promise<any[]> {
  //   const token = await this.getAccessToken(); // Ensures token is fresh
  //   const response = await fetch(`${OMBEA_API_BASE_URL}/rlapi/v1/responselinks`, {
  //     headers: { 'Authorization': token }
  //   });
  //   if (!response.ok) throw new Error("Failed to fetch responselinks");
  //   return response.json();
  // }


  // --- Old simulation methods (can be kept for isolated testing or removed if no longer needed) ---
  public async connect_simulated(): Promise<void> {
    if (this.isSimulatedConnected) {
      return;
    }
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      this.isSimulatedConnected = true;
      logger.info('OmbeaApi (Simulated): Connection established.');
    } catch (error) {
      logger.error('OmbeaApi (Simulated): Connection failed.', error);
      throw error;
    }
  }

  public disconnect_simulated(): void {
    this.isSimulatedConnected = false;
    if (this.simulatedResponseInterval) {
      clearInterval(this.simulatedResponseInterval);
      this.simulatedResponseInterval = null;
    }
    logger.info('OmbeaApi (Simulated): Disconnected.');
  }

  public startSimulatedResponses(
    onResponse: (deviceId: string, response: string) => void,
    deviceCount: number = 15
  ): void {
    if (!this.isSimulatedConnected) { // Check simulated connection status
      // throw new Error('OMBEA API (Simulated) not connected');
      logger.warn('OmbeaApi (Simulated): Cannot start responses, not connected.');
      return;
    }
    this.stopSimulatedResponses(); // Clear any existing interval
    logger.info('OmbeaApi (Simulated): Starting simulated responses.');
    this.simulatedResponseInterval = setInterval(() => {
      const deviceId = Math.floor(Math.random() * deviceCount) + 1;
      const response = String.fromCharCode(65 + Math.floor(Math.random() * 4)); // A, B, C, or D
      onResponse(deviceId.toString(), response);
    }, 2000);
  }

  public stopSimulatedResponses(): void {
    if (this.simulatedResponseInterval) {
      clearInterval(this.simulatedResponseInterval);
      this.simulatedResponseInterval = null;
      logger.info('OmbeaApi (Simulated): Stopped simulated responses.');
    }
  }
}

// Export a single instance (Singleton pattern)
export const ombeaApi = OmbeaApi.getInstance();