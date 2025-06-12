import { logger } from './logger';
export class OmbeaApi {
    constructor() {
        Object.defineProperty(this, "isConnected", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "simulatedResponseInterval", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
    }
    static getInstance() {
        if (!OmbeaApi.instance) {
            OmbeaApi.instance = new OmbeaApi();
        }
        return OmbeaApi.instance;
    }
    async connect() {
        if (this.isConnected) {
            return;
        }
        try {
            // Simulate USB connection initialization
            await new Promise(resolve => setTimeout(resolve, 1000));
            this.isConnected = true;
            logger.success('API OMBEA initialisée');
        }
        catch (error) {
            logger.error('Échec de l\'initialisation API OMBEA', error);
            throw error;
        }
    }
    disconnect() {
        this.isConnected = false;
        if (this.simulatedResponseInterval) {
            clearInterval(this.simulatedResponseInterval);
            this.simulatedResponseInterval = null;
        }
        logger.info('API OMBEA déconnectée');
    }
    startSimulatedResponses(onResponse, deviceCount = 15) {
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
    stopSimulatedResponses() {
        if (this.simulatedResponseInterval) {
            clearInterval(this.simulatedResponseInterval);
            this.simulatedResponseInterval = null;
        }
    }
}
export const ombeaApi = OmbeaApi.getInstance();
