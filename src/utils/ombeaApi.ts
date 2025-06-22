import { logger } from './logger';

// Base URL for the Ombea API (local)
const OMBEA_API_BASE_URL = 'http://localhost:9236';

interface AccessToken {
  token: string;
  type: string; // e.g., "bearer"
  expiresAt: number; // Timestamp when the token expires
}

// Interface to match the structure from ombeaStore.ts,
// plus any other fields from the API if needed for mapping.
export interface ApiOmbeaResponseLink {
  id: string;
  connectionState: "connected" | "disconnected" | "connecting" | "error";
  name?: string;
  // Add other fields if the API provides more that might be useful
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
    // Add a small buffer (e.g., 60 seconds) to request a new token before it actually expires
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
      logger.info("OmbeaApi: Using existing valid access token.");
      return storedTokenValue;
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
        let errorData;
        try {
            errorData = await response.json();
        } catch (e) {
            errorData = { errors: [{ message: response.statusText }] };
        }
        const firstErrorMessage = errorData.errors?.[0]?.message || response.statusText;
        logger.error('OmbeaApi: Failed to get access token', { status: response.status, error: errorData });
        throw new Error(`Échec de l'obtention du token: ${firstErrorMessage}`);
      }

      const tokenData = await response.json();
      if (!tokenData.access_token || !tokenData.expires_in) {
        logger.error('OmbeaApi: Invalid token data received', tokenData);
        throw new Error('Données du token invalides reçues de l\'API.');
      }
      this.accessToken = {
        token: tokenData.access_token,
        type: tokenData.token_type || 'Bearer', // Default to Bearer
        expiresAt: Date.now() + ((tokenData.expires_in - 60) * 1000), // Apply buffer here too for safety
      };
      logger.success('OmbeaApi: Access token obtained successfully.');
      return `${this.accessToken.type} ${this.accessToken.token}`;
    } catch (error) {
      logger.error('OmbeaApi: Error during access token request', error);
      this.accessToken = null;
      throw error;
    }
  }

  // Generic request wrapper to handle auth and errors
  private async makeApiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getAccessToken(); // Ensures token is fresh or obtained

    const defaultHeaders: HeadersInit = {
      'Authorization': token,
      'Content-Type': 'application/json', // Default, can be overridden
      ...options.headers,
    };

    const response = await fetch(url, { ...options, headers: defaultHeaders });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { errors: [{ message: response.statusText }] };
      }
      const firstErrorMessage = errorData.errors?.[0]?.message || response.statusText;
      logger.error(`OmbeaApi: API request to ${url} failed`, { status: response.status, error: errorData });

      if (response.status === 401) { // Unauthorized, likely token expired
        this.clearStoredAccessToken(); // Clear token so next call definitely gets a new one
        logger.info("OmbeaApi: Token was likely expired or invalid (401). Cleared token.");
        // Optionally, you could retry the request once after clearing token, but that adds complexity.
        // For now, let higher level logic (e.g. store) handle retrying the operation if desired.
      }
      throw new Error(`Erreur API (${response.status}): ${firstErrorMessage}`);
    }
    if (response.status === 204) { // No Content
        return undefined as T;
    }
    return response.json() as Promise<T>;
  }

  public async getResponseLinks(onlyConnected: boolean = true): Promise<ApiOmbeaResponseLink[]> {
    logger.info(`OmbeaApi: Fetching response links ${onlyConnected ? '(connected only)' : '(all)'}...`);
    const url = onlyConnected
      ? `${OMBEA_API_BASE_URL}/rlapi/v1/responselinks?connectionState=connected`
      : `${OMBEA_API_BASE_URL}/rlapi/v1/responselinks`;

    try {
      const responseLinks = await this.makeApiRequest<ApiOmbeaResponseLink[]>(url, { method: 'GET' });
      logger.success(`OmbeaApi: Successfully fetched ${responseLinks.length} response links.`);
      return responseLinks;
    } catch (error) {
      logger.error('OmbeaApi: Failed to fetch response links.', error);
      throw error; // Re-throw for the store to handle
    }
  }


  // --- Old simulation methods (can be kept for isolated testing or removed if no longer needed) ---
  public async connect_simulated(): Promise<void> {
    // ... (simulation code as before)
  }
  public disconnect_simulated(): void {
    // ... (simulation code as before)
  }
  public startSimulatedResponses(/* ... */): void {
    // ... (simulation code as before)
  }
  public stopSimulatedResponses(): void {
    // ... (simulation code as before)
  }
}

export const ombeaApi = OmbeaApi.getInstance();