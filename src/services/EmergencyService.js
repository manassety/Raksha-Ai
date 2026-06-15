// ====================================================================
// FILE: src/services/EmergencyService.js
// ====================================================================
import { PermissionsAndroid, Platform } from 'react-native';
import * as SMS from 'expo-sms';
import { SendDirectSms } from 'react-native-send-direct-sms';
import * as Speech from 'expo-speech';
import * as Audio from 'expo-av';
import * as Location from 'expo-location';
import { StorageService } from './StorageService';
import { NotificationService } from './NotificationService';
import { LocationService } from './LocationService';
import { STORAGE_KEYS, EMERGENCY_CONFIG, POLICE_CONTACTS } from '../config/constants';

let audioRecording = null;
let inactivityTimer = null;
let voiceRecognitionInterval = null;

export const EmergencyService = {
    async startEmergency(options = {}) {
        const { trigger = 'manual', contacts = [], voiceCommand = null } = options;

        try {
            // ⚡ FAST EXECUTION: Start audio recording in background (Don't await it to block UI)
            this.startRecording().catch(err => console.log('Recording start err:', err));

            // Get current location (Wait only for location, as it's needed for alerts)
            // Timeout gracefully if GPS takes too long
            const locationPromise = LocationService.getCurrentLocation();
            const timeoutPromise = new Promise(resolve => setTimeout(() => resolve({ latitude: 0, longitude: 0, error: 'timeout' }), 4000));
            const location = await Promise.race([locationPromise, timeoutPromise]);

            // ⚡ FAST EXECUTION: Send all notifications and SMS in background concurrently
            this.sendEmergencyAlerts(location, contacts, trigger).catch(err => console.log('Background alert err:', err));

            // Setup offline monitoring
            this.startInactivityMonitoring();
            this.startVoiceRecognition();

            // Log the emergency concurrently
            this.logEmergency({
                type: 'start',
                trigger,
                voiceCommand,
                location,
                timestamp: new Date().toISOString(),
            }).catch(e => console.log(e));

            return {
                success: true,
                location,
                recording: audioRecording,
            };
        } catch (error) {
            console.log('Error starting emergency:', error);
            return { success: false, error: error.message };
        }
    },

    async stopEmergency(pin, options = {}) {
        const { force = false } = options;

        try {
            // Verify PIN if not forcing
            if (!force) {
                const storedPin = await StorageService.get(STORAGE_KEYS.SAFETY_PIN);
                if (pin !== storedPin) {
                    return { success: false, error: 'Invalid PIN' };
                }
            }

            // Stop recording
            await this.stopRecording();

            // Clear timers
            this.clearTimers();

            // Log the emergency end
            await this.logEmergency({
                type: 'stop',
                pinVerified: !force,
                timestamp: new Date().toISOString(),
            });

            return { success: true };
        } catch (error) {
            console.log('Error stopping emergency:', error);
            return { success: false, error: error.message };
        }
    },

    async startRecording() {
        try {
            await Audio.requestPermissionsAsync();
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            audioRecording = recording;
            return { success: true };
        } catch (error) {
            console.log('Error starting recording:', error);
            return { success: false, error: error.message };
        }
    },

    async stopRecording() {
        try {
            if (audioRecording) {
                await audioRecording.stopAndUnloadAsync();
                audioRecording = null;
            }
            return { success: true };
        } catch (error) {
            console.log('Error stopping recording:', error);
            return { success: false, error: error.message };
        }
    },

    async getRecordingURI() {
        if (audioRecording) {
            return audioRecording.getURI();
        }
        return null;
    },

    async sendEmergencyAlerts(location, contacts, trigger) {
        try {
            const locLink = location.latitude !== 0 ? `https://maps.google.com/?q=${location.latitude},${location.longitude}` : 'Location Unavailable';
            const message = `🚨 SOS EMERGENCY ALERT!\n\nEmergency triggered at: ${new Date().toLocaleString()}\nLocation: ${locLink}\n\nPlease help!`;

            // 1. FIREBASE/PUSH NOTIFICATION (Network dependent) - Fire and forget
            NotificationService.sendEmergencyAlert({
                title: '🚨 SOS Emergency',
                body: `Emergency triggered by user. Check your app for details.`,
                data: { location, trigger },
            }).catch(e => console.log("Push Notification skipped (Offline or Slow):", e));

            // 2. DIRECT SMS (Works OFFLINE! No internet required! GSM network)
            const allNumbers = [
                ...contacts.map(c => c.phone),
                POLICE_CONTACTS.GENERAL,
                POLICE_CONTACTS.WOMEN_HELPLINE,
                POLICE_CONTACTS.EMERGENCY,
            ].filter(Boolean); // removes undefined

            // Request SMS permission on Android for silent offline sending
            if (Platform.OS === 'android') {
                try {
                    const granted = await PermissionsAndroid.request(
                        PermissionsAndroid.PERMISSIONS.SEND_SMS,
                        {
                            title: "Emergency SMS Permission",
                            message: "App needs SMS permission to send silent offline emergency alerts.",
                            buttonNeutral: "Ask Me Later",
                            buttonNegative: "Cancel",
                            buttonPositive: "OK"
                        }
                    );
                    if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                        console.log("Direct SMS Permission denied");
                    }
                } catch (err) {
                    console.log("SMS Permission request error:", err);
                }
            }

            // Loop through and fire background offline SMS via Direct SMS
            for (const number of allNumbers) {
                try {
                    // Send Direct SMS silently
                    if (SendDirectSms && Platform.OS === 'android') {
                        try {
                            // Do not chain .catch directly because SendDirectSms might not return a promise in this React Native module version
                            SendDirectSms(number, message);
                        } catch (err) {
                            // Fallback to Expo-SMS if direct fails
                            SMS.sendSMSAsync([number], message).catch(e => console.log(e));
                        }
                    } else {
                        SMS.sendSMSAsync([number], message).catch(e => console.log(e));
                    }
                } catch (e) {
                    console.log(`Failed to queue SMS to ${number}:`, e);
                }
            }

            return { success: true };
        } catch (error) {
            console.log('Error sending emergency alerts:', error);
            return { success: false, error: error.message };
        }
    },

    startInactivityMonitoring() {
        // Clear existing timer
        if (inactivityTimer) {
            clearTimeout(inactivityTimer);
        }

        // Set new timer for auto-escalation
        inactivityTimer = setTimeout(async () => {
            await this.escalateEmergency();
        }, EMERGENCY_CONFIG.AUTO_ESCALATION_TIME);
    },

    resetInactivityTimer() {
        if (inactivityTimer) {
            clearTimeout(inactivityTimer);
        }
        this.startInactivityMonitoring();
    },

    clearTimers() {
        if (inactivityTimer) {
            clearTimeout(inactivityTimer);
            inactivityTimer = null;
        }
        if (voiceRecognitionInterval) {
            clearInterval(voiceRecognitionInterval);
            voiceRecognitionInterval = null;
        }
    },

    startVoiceRecognition() {
        // Check for voice commands periodically
        voiceRecognitionInterval = setInterval(() => {
            this.checkVoiceCommands();
        }, 3000);
    },

    async checkVoiceCommands() {
        // In a real implementation, this would use speech recognition
        // For now, we'll just log that voice recognition is active
        console.log('Voice recognition active, listening for stop command...');
    },

    async escalateEmergency() {
        try {
            const location = await LocationService.getCurrentLocation();
            const message = `🚨 AUTO-ESCALATION from RakshaAi!\n\nUser inactive for ${EMERGENCY_CONFIG.AUTO_ESCALATION_TIME / 1000} seconds.\nLocation: https://maps.google.com/?q=${location.latitude},${location.longitude}`;

            // Notify police
            const policeNumbers = [
                POLICE_CONTACTS.GENERAL,
                POLICE_CONTACTS.WOMEN_HELPLINE,
                POLICE_CONTACTS.EMERGENCY,
            ];

            for (const number of policeNumbers) {
                try {
                    await SMS.sendSMSAsync([number], message);
                } catch (e) {
                    console.log(`Failed to escalate to ${number}:`, e);
                }
            }

            // Send push notification
            await NotificationService.sendEmergencyAlert({
                title: '🚨 Emergency Escalated',
                body: 'Emergency has been escalated to authorities due to inactivity.',
                data: { location, type: 'escalation' },
            });

            // Voice feedback
            Speech.speak('Emergency escalated to authorities. Help is on the way.', {
                language: 'en',
            });

            return { success: true };
        } catch (error) {
            console.log('Error escalating emergency:', error);
            return { success: false, error: error.message };
        }
    },

    async logEmergency(logData) {
        try {
            const existingLogs = await StorageService.get(STORAGE_KEYS.EMERGENCY_LOGS) || [];
            const newLog = {
                id: Date.now().toString(),
                ...logData,
            };
            const updatedLogs = [newLog, ...existingLogs].slice(0, 100);
            await StorageService.set(STORAGE_KEYS.EMERGENCY_LOGS, updatedLogs);
            return { success: true };
        } catch (error) {
            console.log('Error logging emergency:', error);
            return { success: false, error: error.message };
        }
    },

    async getEmergencyLogs() {
        try {
            const logs = await StorageService.get(STORAGE_KEYS.EMERGENCY_LOGS) || [];
            return logs;
        } catch (error) {
            console.log('Error getting emergency logs:', error);
            return [];
        }
    },

    async clearEmergencyLogs() {
        try {
            await StorageService.remove(STORAGE_KEYS.EMERGENCY_LOGS);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
};

export default EmergencyService;