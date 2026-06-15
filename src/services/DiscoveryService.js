import { db } from '../config/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { STREAMING_CONFIG } from '../config/streaming';
import Constants from 'expo-constants';

let currentServerUrl = 'https://raksha-ai-2.onrender.com';
let currentPythonUrl = 'https://raksha-ai-2.onrender.com';

const listeners = new Set();
let isInitialized = false;

/**
 * Initialize IP discovery.
 * Listens to a common admin config in Firestore for the server IP.
 */
export const initDiscovery = () => {
    if (isInitialized) return;
    isInitialized = true;

    console.log('[Discovery] Initializing Firestore IP discovery...');

    // Listen to the common admin configuration
    const unsub = onSnapshot(doc(db, 'admin', 'streaming_config'), (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.data();
            if (data.serverIp) {
                const newUrl = data.serverIp.includes('://')
                    ? data.serverIp
                    : `http://${data.serverIp}:3001`;

                // Only override if not set by Expo auto-detect in dev, or if forced
                if (newUrl !== currentServerUrl) {
                    console.log('[Discovery] Common IP ignored, using Render URL unconditionally.');
                }
            }
            if (data.pythonIp) {
                currentPythonUrl = data.pythonIp.includes('://')
                    ? data.pythonIp
                    : `http://${data.pythonIp}:5000`;
            }
        }
    }, (error) => {
        if (error.code === 'permission-denied') {
            console.log('[Discovery] Waiting for authentication to sync IP...');
        } else {
            console.error('[Discovery] Firestore listener error:', error);
        }
    });

    return unsub;
};

/**
 * Register a listener for URL changes.
 */
export const onUrlChange = (callback) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
};

/**
 * Get the current resolved streaming server URL.
 */
export const getServerUrl = () => currentServerUrl;

/**
 * Get the current resolved Python AI Server URL.
 */
export const getPythonUrl = () => currentPythonUrl;

/**
 * Manually register a new server IP (used by Admin).
 */
export const registerServerIp = async (ip, isPython = false) => {
    try {
        const payload = isPython ? { pythonIp: ip } : { serverIp: ip };
        await setDoc(doc(db, 'admin', 'streaming_config'), {
            ...payload,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        console.log('[Discovery] Successfully registered new IP:', ip);
        return true;
    } catch (e) {
        console.error('[Discovery] Failed to register IP:', e);
        return false;
    }
};

const DiscoveryService = {
    init: initDiscovery,
    getUrl: getServerUrl,
    getPythonUrl: getPythonUrl,
    register: registerServerIp,
    onUrlChange: onUrlChange
};

export default DiscoveryService;
