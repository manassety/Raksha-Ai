// ====================================================================
// FILE: src/hooks/useEmergency.js
// ====================================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import * as Speech from 'expo-speech';
import * as Audio from 'expo-av';
import { useEmergency } from '../contexts/EmergencyContext';
import { useAuth } from '../contexts/AuthContext';
import { useContacts } from '../contexts/ContactsContext';
import { useLocation } from '../contexts/LocationContext';
import { EmergencyService } from '../services/EmergencyService';
import { NotificationService } from '../services/NotificationService';
import { EMERGENCY_CONFIG } from '../config/constants';

export const useEmergency = () => {
    const {
        isEmergencyActive,
        emergencyStartTime,
        pinAttempts,
        isLocked,
        recording,
        emergencyLogs,
        evidence,
        startEmergency: contextStartEmergency,
        stopEmergency: contextStopEmergency,
        addEvidence,
        escalateEmergency,
    } = useEmergency();

    const { user } = useAuth();
    const { emergencyContacts } = useContacts();
    const { currentLocation, getCurrentLocation } = useLocation();

    const [isRecording, setIsRecording] = useState(false);
    const [emergencyDuration, setEmergencyDuration] = useState(0);
    const [voiceFeedbackEnabled, setVoiceFeedbackEnabled] = useState(true);

    const timerRef = useRef(null);
    const recordingRef = useRef(null);

    // Update emergency duration
    useEffect(() => {
        if (isEmergencyActive) {
            timerRef.current = setInterval(() => {
                setEmergencyDuration(Date.now() - emergencyStartTime);
            }, 1000);
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
            setEmergencyDuration(0);
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [isEmergencyActive, emergencyStartTime]);

    const startEmergency = useCallback(async (trigger = 'manual') => {
        try {
            // Request permissions
            await Audio.requestPermissionsAsync();
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            // Get current location
            const location = await getCurrentLocation();

            // Start audio recording
            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            recordingRef.current = recording;
            setIsRecording(true);

            // Send emergency alerts
            await EmergencyService.sendEmergencyAlerts(location, emergencyContacts, trigger);

            // Voice feedback
            if (voiceFeedbackEnabled) {
                Speech.speak('Emergency activated. Recording started. Help is on the way.', {
                    language: 'en',
                });
            }

            // Start context emergency
            await contextStartEmergency(trigger);

            return { success: true };
        } catch (error) {
            console.log('Error starting emergency:', error);
            return { success: false, error: error.message };
        }
    }, [emergencyContacts, voiceFeedbackEnabled]);

    const stopEmergency = useCallback(async (pin) => {
        try {
            // Stop recording
            if (recordingRef.current) {
                await recordingRef.current.stopAndUnloadAsync();
                recordingRef.current = null;
            }
            setIsRecording(false);

            // Stop context emergency
            const result = await contextStopEmergency(pin);

            // Voice feedback
            if (voiceFeedbackEnabled && result.success) {
                Speech.speak('Emergency deactivated. You are safe now.', {
                    language: 'en',
                });
            }

            return result;
        } catch (error) {
            console.log('Error stopping emergency:', error);
            return { success: false, error: error.message };
        }
    }, [voiceFeedbackEnabled]);

    const captureEvidence = useCallback(async (type) => {
        try {
            let evidenceData;

            if (type === 'photo') {
                const result = await ImagePicker.launchCameraAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    quality: 1,
                });

                if (!result.canceled) {
                    evidenceData = {
                        type: 'photo',
                        uri: result.assets[0].uri,
                    };
                }
            } else if (type === 'video') {
                const result = await ImagePicker.launchCameraAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                    quality: 1,
                });

                if (!result.canceled) {
                    evidenceData = {
                        type: 'video',
                        uri: result.assets[0].uri,
                        duration: result.assets[0].duration,
                    };
                }
            } else if (type === 'audio') {
                if (!recordingRef.current) {
                    const { recording } = await Audio.Recording.createAsync(
                        Audio.RecordingOptionsPresets.HIGH_QUALITY
                    );
                    recordingRef.current = recording;
                    setIsRecording(true);
                    evidenceData = {
                        type: 'audio',
                        isRecording: true,
                    };
                } else {
                    await recordingRef.current.stopAndUnloadAsync();
                    evidenceData = {
                        type: 'audio',
                        uri: recordingRef.current.getURI(),
                    };
                    recordingRef.current = null;
                    setIsRecording(false);
                }
            }

            if (evidenceData) {
                await addEvidence(evidenceData);
                return { success: true, evidence: evidenceData };
            }

            return { success: false, error: 'No evidence captured' };
        } catch (error) {
            console.log('Error capturing evidence:', error);
            return { success: false, error: error.message };
        }
    }, [addEvidence]);

    const formatDuration = (milliseconds) => {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        }
        return `${seconds}s`;
    };

    return {
        isEmergencyActive,
        emergencyStartTime,
        pinAttempts,
        isLocked,
        isRecording,
        emergencyDuration,
        emergencyLogs,
        evidence,
        voiceFeedbackEnabled,
        setVoiceFeedbackEnabled,
        startEmergency,
        stopEmergency,
        captureEvidence,
        escalateEmergency,
        formatDuration,
    };
};

export default useEmergency;