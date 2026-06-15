// ====================================================================
// FILE: src/contexts/EmergencyContext.js
// ====================================================================
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import * as Location from 'expo-location';
import * as SMS from 'expo-sms';
import * as SecureStore from 'expo-secure-store';

import { StorageService } from '../services/StorageService';
import { LocationService } from '../services/LocationService';
import { NotificationService } from '../services/NotificationService';
import { EmergencyService } from '../services/EmergencyService';
import { STORAGE_KEYS, EMERGENCY_CONFIG, POLICE_CONTACTS } from '../config/constants';
import { useAuth } from './AuthContext';
import { useContacts } from './ContactsContext';
import { useLocation } from './LocationContext';

const EmergencyContext = createContext();

export const EmergencyProvider = ({ children }) => {
    const { user } = useAuth();
    const { emergencyContacts } = useContacts();
    const { currentLocation } = useLocation();

    const [isEmergencyActive, setIsEmergencyActive] = useState(false);
    const [emergencyStartTime, setEmergencyStartTime] = useState(null);
    const [pinAttempts, setPinAttempts] = useState(0);
    const [isLocked, setIsLocked] = useState(false);
    const [recording, setRecording] = useState(null);
    const [emergencyLogs, setEmergencyLogs] = useState([]);
    const [evidence, setEvidence] = useState([]);
    const [isVoiceListening, setIsVoiceListening] = useState(false);

    useEffect(() => {
        loadEmergencyData();
        loadEmergencyLogs();
    }, []);

    const loadEmergencyData = async () => {
        try {
            const savedEvidence = await StorageService.get(STORAGE_KEYS.EVIDENCE_DATA);
            if (savedEvidence) {
                setEvidence(savedEvidence);
            }
        } catch (error) {
            console.log('Error loading emergency data:', error);
        }
    };

    const loadEmergencyLogs = async () => {
        try {
            const logs = await StorageService.get(STORAGE_KEYS.EMERGENCY_LOGS);
            if (logs) {
                setEmergencyLogs(logs);
            }
        } catch (error) {
            console.log('Error loading emergency logs:', error);
        }
    };

    const saveEmergencyLogs = async (logs) => {
        try {
            await StorageService.set(STORAGE_KEYS.EMERGENCY_LOGS, logs);
            setEmergencyLogs(logs);
        } catch (error) {
            console.log('Error saving emergency logs:', error);
        }
    };

    const startEmergency = useCallback(async (trigger = 'manual') => {
        try {
            setIsEmergencyActive(true);
            setEmergencyStartTime(Date.now());
            setPinAttempts(0);

            // Request permissions
            await Audio.requestPermissionsAsync();
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            // Get current location
            const location = await LocationService.getCurrentLocation();

            // Start audio recording
            const { recording: newRecording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            setRecording(newRecording);

            // Send emergency notifications
            await NotificationService.sendEmergencyAlert({
                title: '🚨 SOS EMERGENCY ACTIVATED',
                body: `Emergency triggered by ${user?.name || 'User'} at ${new Date().toLocaleString()}`,
                data: { location, trigger },
            });

            // Notify emergency contacts via SMS
            await notifyEmergencyContacts(location);

            // Notify nearby users
            await notifyNearbyUsers(location);

            // Voice feedback
            Speech.speak('Emergency activated. Recording started. Sending alerts to your contacts and authorities.', { language: 'en' });

            // Log the emergency
            const newLog = {
                id: Date.now().toString(),
                type: 'emergency_start',
                trigger,
                location,
                timestamp: new Date().toISOString(),
                userId: user?.uid,
            };
            const updatedLogs = [newLog, ...emergencyLogs];
            await saveEmergencyLogs(updatedLogs);

            return { success: true };
        } catch (error) {
            console.log('Error starting emergency:', error);
            Speech.speak('Failed to activate emergency. Please try again.', { language: 'en' });
            return { success: false, error: error.message };
        }
    }, [user, emergencyContacts, currentLocation]);

    const stopEmergency = useCallback(async (pin) => {
        try {
            // Verify PIN
            const storedPin = await SecureStore.getItemAsync(STORAGE_KEYS.SAFETY_PIN);

            if (pin !== storedPin) {
                const newAttempts = pinAttempts + 1;
                setPinAttempts(newAttempts);

                if (newAttempts >= EMERGENCY_CONFIG.MAX_PIN_ATTEMPTS) {
                    setIsLocked(true);
                    Speech.speak('Too many incorrect attempts. Emergency remains active. Authorities have been notified.', { language: 'en' });
                    return { success: false, error: 'Too many attempts', locked: true };
                }

                Speech.speak(`Incorrect PIN. ${EMERGENCY_CONFIG.MAX_PIN_ATTEMPTS - newAttempts} attempts remaining.`, { language: 'en' });
                return { success: false, error: 'Incorrect PIN' };
            }

            // Stop recording
            if (recording) {
                await recording.stopAndUnloadAsync();
                setRecording(null);
            }

            setIsEmergencyActive(false);
            setEmergencyStartTime(null);
            setPinAttempts(0);
            setIsLocked(false);

            // Voice feedback
            Speech.speak('Emergency deactivated. Stay safe.', { language: 'en' });

            // Log the emergency end
            const newLog = {
                id: Date.now().toString(),
                type: 'emergency_stop',
                pinVerified: true,
                timestamp: new Date().toISOString(),
                userId: user?.uid,
            };
            const updatedLogs = [newLog, ...emergencyLogs];
            await saveEmergencyLogs(updatedLogs);

            return { success: true };
        } catch (error) {
            console.log('Error stopping emergency:', error);
            return { success: false, error: error.message };
        }
    }, [pinAttempts, recording, user]);

    const notifyEmergencyContacts = async (location) => {
        try {
            const contacts = emergencyContacts || [];
            const message = `🚨 EMERGENCY ALERT from Tanprix!\n\nMy location: https://maps.google.com/?q=${location.latitude},${location.longitude}\n\nPlease help me!`;

            // Send SMS to all emergency contacts
            const phoneNumbers = contacts.map(c => c.phone);
            if (phoneNumbers.length > 0) {
                const result = await SMS.sendSMSAsync(phoneNumbers, message);
                console.log('SMS send result:', result);
            }

            // Also notify police
            const policeNumbers = [POLICE_CONTACTS.GENERAL, POLICE_CONTACTS.WOMEN_HELPLINE];
            for (const number of policeNumbers) {
                try {
                    await SMS.sendSMSAsync([number], `EMERGENCY: ${message}`);
                } catch (e) {
                    console.log('Failed to send to police:', number);
                }
            }
        } catch (error) {
            console.log('Error notifying emergency contacts:', error);
        }
    };

    const notifyNearbyUsers = async (location) => {
        try {
            // In production, this would query a database of nearby users
            // For now, we'll just log it
            console.log('Notifying nearby users within', EMERGENCY_CONFIG.NEARBY_RADIUS_KM, 'km');

            await NotificationService.sendNearbyAlert({
                title: '🚨 Nearby Emergency',
                body: 'Someone nearby has triggered an emergency alert. Check your surroundings.',
                data: { location, radius: EMERGENCY_CONFIG.NEARBY_RADIUS_KM },
            });
        } catch (error) {
            console.log('Error notifying nearby users:', error);
        }
    };

    const addEvidence = async (newEvidence) => {
        try {
            const evidenceItem = {
                id: Date.now().toString(),
                ...newEvidence,
                timestamp: new Date().toISOString(),
                emergencyId: emergencyStartTime?.toString(),
            };

            const updatedEvidence = [evidenceItem, ...evidence];
            setEvidence(updatedEvidence);
            await StorageService.set(STORAGE_KEYS.EVIDENCE_DATA, updatedEvidence);

            return { success: true, evidence: evidenceItem };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const escalateEmergency = useCallback(async () => {
        try {
            const location = await LocationService.getCurrentLocation();

            // Notify police with location
            const message = `🚨 AUTO-ESCALATION from Tanprix!\n\nUser safety concern detected.\nLocation: https://maps.google.com/?q=${location.latitude},${location.longitude}`;

            const policeNumbers = [POLICE_CONTACTS.GENERAL, POLICE_CONTACTS.WOMEN_HELPLINE, POLICE_CONTACTS.EMERGENCY];

            for (const number of policeNumbers) {
                try {
                    await SMS.sendSMSAsync([number], message);
                } catch (e) {
                    console.log('Failed to escalate to:', number);
                }
            }

            // Send push notification
            await NotificationService.sendEmergencyAlert({
                title: '🚨 Emergency Escalated',
                body: 'Emergency has been escalated to authorities due to inactivity.',
                data: { location, type: 'escalation' },
            });

            Speech.speak('Emergency escalated to authorities. Help is on the way.', { language: 'en' });

            return { success: true };
        } catch (error) {
            console.log('Error escalating emergency:', error);
            return { success: false, error: error.message };
        }
    }, []);

    const value = {
        isEmergencyActive,
        emergencyStartTime,
        pinAttempts,
        isLocked,
        recording,
        emergencyLogs,
        evidence,
        isVoiceListening,
        setIsVoiceListening,
        startEmergency,
        stopEmergency,
        addEvidence,
        escalateEmergency,
    };

    return (
        <EmergencyContext.Provider value={value}>
            {children}
        </EmergencyContext.Provider>
    );
};

export const useEmergency = () => {
    const context = useContext(EmergencyContext);
    if (!context) {
        throw new Error('useEmergency must be used within an EmergencyProvider');
    }
    return context;
};

export default EmergencyContext;