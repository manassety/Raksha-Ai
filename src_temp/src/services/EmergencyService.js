// ====================================================================
// FILE: src/services/EmergencyService.js
// ====================================================================
import * as SMS from 'expo-sms';
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
            // Start audio recording
            await this.startRecording();

            // Get current location
            const location = await LocationService.getCurrentLocation();

            // Send notifications
            await this.sendEmergencyAlerts(location, contacts, trigger);

            // Start inactivity monitoring
            this.startInactivityMonitoring();

            // Start voice recognition for stop command
            this.startVoiceRecognition();

            // Log the emergency
            await this.logEmergency({
                type: 'start',
                trigger,
                voiceCommand,
                location,
                timestamp: new Date().toISOString(),
            });

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
            const message = `🚨 SOS EMERGENCY ALERT!\n\nEmergency triggered at: ${new Date().toLocaleString()}\nLocation: https://maps.google.com/?q=${location.latitude},${location.longitude}\n\nPlease help!`;

            // Send push notification
            await NotificationService.sendEmergencyAlert({
                title: '🚨 SOS Emergency',
                body: `Emergency triggered by user. Check your app for details.`,
                data: { location, trigger },
            });

            // Send SMS to emergency contacts
            const phoneNumbers = contacts.map(c => c.phone);
            if (phoneNumbers.length > 0) {
                await SMS.sendSMSAsync(phoneNumbers, message);
            }

            // Notify police
            const policeNumbers = [
                POLICE_CONTACTS.GENERAL,
                POLICE_CONTACTS.WOMEN_HELPLINE,
                POLICE_CONTACTS.EMERGENCY,
            ];

            for (const number of policeNumbers) {
                try {
                    await SMS.sendSMSAsync([number], `EMERGENCY: ${message}`);
                } catch (e) {
                    console.log(`Failed to send to ${number}:`, e);
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
            const message = `🚨 AUTO-ESCALATION from Tanprix!\n\nUser inactive for ${EMERGENCY_CONFIG.AUTO_ESCALATION_TIME / 1000} seconds.\nLocation: https://maps.google.com/?q=${location.latitude},${location.longitude}`;

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