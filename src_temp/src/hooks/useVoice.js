// ====================================================================
// FILE: src/hooks/useVoice.js
// ====================================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import * as Speech from 'expo-speech';
import * as Audio from 'expo-av';
import { VoiceService } from '../services/VoiceService';
import { EMERGENCY_CONFIG } from '../config/constants';

export const useVoice = () => {
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [error, setError] = useState(null);
    const [availableLanguages, setAvailableLanguages] = useState([]);
    const [availableVoices, setAvailableVoices] = useState([]);

    const recognitionRef = useRef(null);
    const speechSubscriptionRef = useRef(null);

    useEffect(() => {
        loadAvailableOptions();

        // Set up speech status listener
        speechSubscriptionRef.current = Speech.addSpeechDictionaryUpdatedListener(() => {
            // Dictionary updated
        });

        return () => {
            if (speechSubscriptionRef.current) {
                speechSubscriptionRef.current.remove();
            }
            Speech.stop();
        };
    }, []);

    const loadAvailableOptions = async () => {
        try {
            const languages = await VoiceService.getAvailableLanguages();
            const voices = await VoiceService.getAvailableVoices();
            setAvailableLanguages(languages);
            setAvailableVoices(voices);
        } catch (e) {
            console.log('Error loading voice options:', e);
        }
    };

    const speak = useCallback(async (text, options = {}) => {
        try {
            setIsSpeaking(true);
            await VoiceService.speak(text, {
                ...options,
                onDone: () => setIsSpeaking(false),
                onError: (e) => {
                    setError(e);
                    setIsSpeaking(false);
                },
            });
        } catch (e) {
            setError(e.message);
            setIsSpeaking(false);
        }
    }, []);

    const stopSpeaking = useCallback(async () => {
        await VoiceService.stopSpeaking();
        setIsSpeaking(false);
    }, []);

    const speakEmergency = useCallback(async (location) => {
        const message = `Emergency activated! Recording started. Help is on the way. Your location has been sent to emergency contacts.`;
        await speak(message);
    }, [speak]);

    const speakDeactivated = useCallback(async () => {
        const message = `Emergency deactivated. You are safe now.`;
        await speak(message);
    }, [speak]);

    const speakInstructions = useCallback(async (instructions) => {
        await speak(instructions);
    }, [speak]);

    const checkForTriggerWords = useCallback((text) => {
        const lowerText = text.toLowerCase();
        return EMERGENCY_CONFIG.VOICE_TRIGGER_WORDS.some(word =>
            lowerText.includes(word.toLowerCase())
        );
    }, []);

    const playSound = useCallback(async (soundType) => {
        try {
            await VoiceService.playSound(soundType);
        } catch (e) {
            setError(e.message);
        }
    }, []);

    const playEmergencyAlert = useCallback(async () => {
        try {
            const { sound } = await VoiceService.playEmergencySound();
            return sound;
        } catch (e) {
            setError(e.message);
            return null;
        }
    }, []);

    const getTranscript = useCallback(() => {
        return transcript;
    }, [transcript]);

    const clearTranscript = useCallback(() => {
        setTranscript('');
    }, []);

    return {
        isListening,
        isSpeaking,
        transcript,
        error,
        availableLanguages,
        availableVoices,
        speak,
        stopSpeaking,
        speakEmergency,
        speakDeactivated,
        speakInstructions,
        checkForTriggerWords,
        playSound,
        playEmergencyAlert,
        getTranscript,
        clearTranscript,
    };
};

export default useVoice;