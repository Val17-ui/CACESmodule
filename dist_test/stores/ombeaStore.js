import { create } from 'zustand';
import { logger } from '../utils/logger';
export const useOmbeaStore = create((set, get) => ({
    devices: {},
    isConnected: false,
    isTestMode: false,
    responses: {},
    connect: async () => {
        try {
            // Simulate USB connection
            await new Promise(resolve => setTimeout(resolve, 1000));
            // Initialize with 15 mock devices
            const devices = {};
            for (let i = 1; i <= 15; i++) {
                devices[i.toString()] = {
                    id: i.toString(),
                    connected: true,
                };
            }
            set({ devices, isConnected: true });
            logger.success('Connexion OMBEA établie');
        }
        catch (error) {
            logger.error('Échec de la connexion OMBEA', error);
            throw error;
        }
    },
    disconnect: () => {
        set({ devices: {}, isConnected: false, responses: {} });
        logger.info('Déconnexion OMBEA');
    },
    handleResponse: (deviceId, response) => {
        const { isTestMode } = get();
        const timestamp = new Date();
        // Update device state
        set(state => ({
            devices: {
                ...state.devices,
                [deviceId]: {
                    ...state.devices[deviceId],
                    lastResponse: response,
                    lastResponseTime: timestamp,
                }
            },
            responses: {
                ...state.responses,
                [deviceId]: response
            }
        }));
        // Log the response
        logger.info(`Boîtier#${deviceId} → ${response}`, isTestMode ? undefined : { deviceId, response, timestamp });
    },
    clearResponses: () => {
        set({ responses: {} });
    },
    setTestMode: (enabled) => {
        set({ isTestMode: enabled });
        logger.info(`Mode test ${enabled ? 'activé' : 'désactivé'}`);
    },
}));
