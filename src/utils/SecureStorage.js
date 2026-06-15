import * as SecureStore from 'expo-secure-store';

export const getSecureValue = async (key) => {
    try {
        return await SecureStore.getItemAsync(key);
    } catch (error) {
        console.error(`SecureStore Error (${key}):`, error);
        // If decryption fails, delete the corrupted key to allow the app to function
        try {
            await SecureStore.deleteItemAsync(key);
        } catch (e) {
            // Ignore delete error 
        }
        return null;
    }
};

export const setSecureValue = async (key, value) => {
    try {
        await SecureStore.setItemAsync(key, value);
    } catch (error) {
        console.error(`SecureStore Error saving ${key}:`, error);
    }
};