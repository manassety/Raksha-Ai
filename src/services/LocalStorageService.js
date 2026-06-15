import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../config/constants';

export const saveContactsLocally = async (contacts) => {
    try {
        await AsyncStorage.setItem(STORAGE_KEYS.EMERGENCY_CONTACTS, JSON.stringify(contacts));
        return { success: true };
    } catch (error) {
        console.error('Error saving contacts locally:', error);
        return { success: false, error: error.message };
    }
};

export const loadContactsLocally = async () => {
    try {
        const contactsJson = await AsyncStorage.getItem(STORAGE_KEYS.EMERGENCY_CONTACTS);
        if (contactsJson) {
            return { success: true, contacts: JSON.parse(contactsJson) };
        }
        return { success: true, contacts: [] };
    } catch (error) {
        console.error('Error loading contacts locally:', error);
        return { success: false, error: error.message, contacts: [] };
    }
};

export const deleteContactLocally = async (contactId) => {
    try {
        const { contacts } = await loadContactsLocally();
        const filtered = contacts.filter(c => c.id !== contactId);
        await saveContactsLocally(filtered);
        return { success: true };
    } catch (error) {
        console.error('Error deleting contact locally:', error);
        return { success: false, error: error.message };
    }
};

export default {
    saveContactsLocally,
    loadContactsLocally,
    deleteContactLocally
};