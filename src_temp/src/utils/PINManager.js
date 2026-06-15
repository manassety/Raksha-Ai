import * as SecureStore from 'expo-secure-store';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getAuth } from 'firebase/auth';

const PIN_KEY = 'userSafetyPIN';
const BIOMETRIC_KEY = 'biometricEnabled';

export const setPIN = async (pin) => {
    try {
        const auth = getAuth();
        const user = auth.currentUser;

        if (!user) {
            return { success: false, error: 'User not authenticated' };
        }

        // Save to Firebase Firestore
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            await updateDoc(userDocRef, {
                safetyPIN: pin,
                hasSafetyPIN: true,
                pinUpdatedAt: new Date().toISOString()
            });
        } else {
            await setDoc(userDocRef, {
                safetyPIN: pin,
                hasSafetyPIN: true,
                pinCreatedAt: new Date().toISOString(),
                pinUpdatedAt: new Date().toISOString()
            });
        }

        // Also save locally for quick verification
        await SecureStore.setItemAsync(PIN_KEY, pin);

        return { success: true };
    } catch (error) {
        console.error('Error saving PIN to Firebase:', error);
        return { success: false, error: error.message };
    }
};

export const verifyPIN = async (pin) => {
    try {
        const auth = getAuth();
        const user = auth.currentUser;

        if (!user) {
            return { success: false, error: 'User not authenticated' };
        }

        // First check local storage for quick verification
        const localPIN = await SecureStore.getItemAsync(PIN_KEY);

        if (localPIN === pin) {
            return { success: true, match: true };
        }

        // If local doesn't match, check Firebase
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists() && userDoc.data().safetyPIN === pin) {
            // Update local storage with correct PIN
            await SecureStore.setItemAsync(PIN_KEY, pin);
            return { success: true, match: true };
        }

        return { success: true, match: false };
    } catch (error) {
        console.error('Error verifying PIN:', error);
        return { success: false, error: error.message };
    }
};

export const hasPIN = async () => {
    try {
        const auth = getAuth();
        const user = auth.currentUser;

        if (!user) {
            return false;
        }

        // Check local storage first
        const localPIN = await SecureStore.getItemAsync(PIN_KEY);
        if (localPIN) {
            return true;
        }

        // Check Firebase
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        return userDoc.exists() && userDoc.data().hasSafetyPIN === true;
    } catch (error) {
        console.error('Error checking PIN:', error);
        return false;
    }
};

export const resetPIN = async () => {
    try {
        const auth = getAuth();
        const user = auth.currentUser;

        if (!user) {
            return { success: false, error: 'User not authenticated' };
        }

        // Remove from Firebase
        const userDocRef = doc(db, 'users', user.uid);
        await updateDoc(userDocRef, {
            safetyPIN: null,
            hasSafetyPIN: false,
            pinResetAt: new Date().toISOString()
        });

        // Remove from local storage
        await SecureStore.deleteItemAsync(PIN_KEY);
        await SecureStore.deleteItemAsync(BIOMETRIC_KEY);

        return { success: true };
    } catch (error) {
        console.error('Error resetting PIN:', error);
        return { success: false, error: error.message };
    }
};

export const enableBiometric = async (enabled) => {
    try {
        if (enabled) {
            const { hasHardware, isEnrolled } = await LocalAuthentication;

            if (!hasHardware || !isEnrolled) {
                return { success: false, error: 'Biometric authentication not available' };
            }
        }

        await SecureStore.setItemAsync(BIOMETRIC_KEY, enabled ? 'true' : 'false');
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

export const isBiometricEnabled = async () => {
    try {
        const result = await SecureStore.getItemAsync(BIOMETRIC_KEY);
        return result === 'true';
    } catch (error) {
        return false;
    }
};

export const authenticateWithBiometrics = async () => {
    try {
        const { hasHardware } = await LocalAuthentication;

        if (!hasHardware) {
            return { success: false, error: 'No biometric hardware available' };
        }

        const result = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Verify your identity',
            cancelLabel: 'Use PIN',
            fallbackLabel: 'Use PIN',
        });

        return { success: result.success };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

export const getUserPINStatus = async () => {
    try {
        const auth = getAuth();
        const user = auth.currentUser;

        if (!user) {
            return { hasPIN: false, isMainAdmin: false };
        }

        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            const data = userDoc.data();
            const pinExists = !!(data.safetyPIN || data.safetyPin || data.hasSafetyPIN);
            return {
                hasPIN: pinExists,
                isMainAdmin: data.isMainAdmin || false,
                isAdmin: data.isAdmin || false
            };
        }

        return { hasPIN: false, isMainAdmin: false, isAdmin: false };
    } catch (error) {
        console.error('Error getting PIN status:', error);
        return { hasPIN: false, isMainAdmin: false, isAdmin: false };
    }
};

export default {
    setPIN,
    verifyPIN,
    hasPIN,
    resetPIN,
    enableBiometric,
    isBiometricEnabled,
    authenticateWithBiometrics,
    getUserPINStatus
};