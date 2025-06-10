import { logger } from './logger';

export class OmbeaApi {
  private static instance: OmbeaApi;
  private isConnected: boolean = false;
  private simulatedResponseInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): OmbeaApi {
    if (!OmbeaApi.instance) {
      OmbeaApi.instance = new OmbeaApi();
    }
    return OmbeaApi.instance;
  }

  public async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      // Simulate USB connection initialization
      await new Promise(resolve => setTimeout(resolve, 1000));
      this.isConnected = true;
      logger.success('API OMBEA initialisée');
    } catch (error) {
      logger.error('Échec de l\'initialisation API OMBEA', error);
      throw error;
    }
  }

  public disconnect(): void {
    this.isConnected = false;
    if (this.simulatedResponseInterval) {
      clearInterval(this.simulatedResponseInterval);
      this.simulatedResponseInterval = null;
    }
    logger.info('API OMBEA déconnectée');
  }

  public startSimulatedResponses(
    onResponse: (deviceId: string, response: string) => void,
    deviceCount: number = 15
  ): void {
    if (!this.isConnected) {
      throw new Error('OMBEA API not connected');
    }

    // Simulate random responses from devices
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
    }
  }
}

export const ombeaApi = OmbeaApi.getInstance();