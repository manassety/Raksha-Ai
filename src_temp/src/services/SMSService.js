import * as SMS from 'expo-sms';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

export const getLocationLink = async () => {
    try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            return null;
        }

        let location = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = location.coords;

        // Create Google Maps link
        const mapLink = `https://maps.google.com/?q=${latitude},${longitude}`;

        return {
            coordinates: { latitude, longitude },
            mapLink: mapLink,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('Error getting location:', error);
        return null;
    }
};

export const formatLocationMessage = (locationData, customMessage = '') => {
    if (!locationData) {
        return customMessage || "EMERGENCY! I need help! (Location unavailable)";
    }

    const message = `EMERGENCY! I need help!\n\n` +
        `This is an automated message from Tanprix Safety App.\n\n` +
        `📍 Location: ${locationData.mapLink}\n` +
        `🕐 Time: ${new Date(locationData.timestamp).toLocaleString()}\n\n` +
        (customMessage ? `📝 Message: ${customMessage}\n\n` : '') +
        `Please contact me immediately if you receive this message.`;

    return message;
};

export const sendEmergencySMS = async (contacts, customMessage = '') => {
    try {
        // Check if SMS is available on this device
        const isAvailable = await SMS.isAvailableAsync();
        if (!isAvailable) {
            return { success: false, error: 'SMS is not available on this device' };
        }

        // Get location
        const locationData = await getLocationLink();
        const message = formatLocationMessage(locationData, customMessage);

        // Get phone numbers
        const phoneNumbers = contacts
            .filter(contact => contact.phone && contact.phone.trim() !== '')
            .map(contact => contact.phone.trim());

        if (phoneNumbers.length === 0) {
            return { success: false, error: 'No valid phone numbers found' };
        }

        // Send SMS
        const result = await SMS.sendSMSAsync(
            phoneNumbers,
            message
        );

        return {
            success: result.result === 'sent',
            sentTo: phoneNumbers,
            location: locationData,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('Error sending SMS:', error);
        return { success: false, error: error.message };
    }
};

export default {
    getLocationLink,
    formatLocationMessage,
    sendEmergencySMS
};