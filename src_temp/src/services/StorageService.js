// ====================================================================
// FILE: src/services/StorageService.js
// ====================================================================
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export const StorageService = {
    // AsyncStorage for regular data
    async set(key, value) {
        try {
            const jsonValue = JSON.stringify(value);
            await AsyncStorage.setItem(key, jsonValue);
            return { success: true };
        } catch (error) {
            console.log('StorageService set error:', error);
            return { success: false, error: error.message };
        }
    },

    async get(key) {
        try {
            const jsonValue = await AsyncStorage.getItem(key);
            return jsonValue != null ? JSON.parse(jsonValue) : null;
        } catch (error) {
            console.log('StorageService get error:', error);
            return null;
        }
    },

    async remove(key) {
        try {
            await AsyncStorage.removeItem(key);
            return { success: true };
        } catch (error) {
            console.log('StorageService remove error:', error);
            return { success: false, error: error.message };
        }
    },

    async clear() {
        try {
            await AsyncStorage.clear();
            return { success: true };
        } catch (error) {
            console.log('StorageService clear error:', error);
            return { success: false, error: error.message };
        }
    },

    async multiGet(keys) {
        try {
            const result = await AsyncStorage.multiGet(keys);
            const parsed = result.map(([key, value]) => ({
                key,
                value: value != null ? JSON.parse(value) : null,
            }));
            return parsed;
        } catch (error) {
            console.log('StorageService multiGet error:', error);
            return [];
        }
    },

    async getAllKeys() {
        try {
            const keys = await AsyncStorage.getAllKeys();
            return keys;
        } catch (error) {
            console.log('StorageService getAllKeys error:', error);
            return [];
        }
    },
};

export const SecureStorageService = {
    // SecureStore for sensitive data (PINs, tokens)
    async set(key, value) {
        try {
            const jsonValue = JSON.stringify(value);
            await SecureStore.setItemAsync(key, jsonValue);
            return { success: true };
        } catch (error) {
            console.log('SecureStorageService set error:', error);
            return { success: false, error: error.message };
        }
    },

    async get(key) {
        try {
            const jsonValue = await SecureStore.getItemAsync(key);
            return jsonValue != null ? JSON.parse(jsonValue) : null;
        } catch (error) {
            console.log('SecureStorageService get error:', error);
            return null;
        }
    },

    async remove(key) {
        try {
            await SecureStore.deleteItemAsync(key);
            return { success: true };
        } catch (error) {
            console.log('SecureStorageService remove error:', error);
            return { success: false, error: error.message };
        }
    },

    async isAvailable() {
        try {
            const result = await SecureStore.getItemAsync('test_key');
            if (result) {
                await SecureStore.deleteItemAsync('test_key');
            }
            return true;
        } catch (error) {
            return false;
        }
    },
};

export default StorageService;