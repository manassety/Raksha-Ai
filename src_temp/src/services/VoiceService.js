// ====================================================================
// FILE: src/services/VoiceService.js
// ====================================================================
import * as Speech from 'expo-speech';
import * as Audio from 'expo-av';

export const VoiceService = {
    async speak(text, options = {}) {
        try {
            const defaultOptions = {
                language: 'en',
                pitch: 1.0,
                rate: 1.0,
                volume: 1.0,
                onDone: () => console.log('Speech finished'),
                onError: (error) => console.log('Speech error:', error),
            };

            const mergedOptions = { ...defaultOptions, ...options };

            Speech.speak(text, mergedOptions);
            return { success: true };
        } catch (error) {
            console.log('Error speaking:', error);
            return { success: false, error: error.message };
        }
    },

    async stopSpeaking() {
        try {
            Speech.stop();
            return { success: true };
        } catch (error) {
            console.log('Error stopping speech:', error);
            return { success: false, error: error.message };
        }
    },

    async isSpeaking() {
        try {
            const isSpeaking = await Speech.isSpeakingAsync();
            return isSpeaking;
        } catch (error) {
            return false;
        }
    },

    async getAvailableLanguages() {
        try {
            const languages = await Speech.getAvailableLanguagesAsync();
            return languages;
        } catch (error) {
            return [];
        }
    },

    async getAvailableVoices() {
        try {
            const voices = await Speech.getAvailableVoicesAsync();
            return voices;
        } catch (error) {
            return [];
        }
    },

    async setLanguage(language) {
        try {
            // Language is set per speech call
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    async playSound(soundType) {
        try {
            const sounds = {
                emergency: require('../../assets/sounds/emergency.mp3'),
                alert: require('../../assets/sounds/alert.mp3'),
                success: require('../../assets/sounds/success.mp3'),
                error: require('../../assets/sounds/error.mp3'),
            };

            const soundSource = sounds[soundType];
            if (!soundSource) {
                return { success: false, error: 'Sound not found' };
            }

            const { sound } = await Audio.Sound.createAsync(soundSource);
            await sound.playAsync();

            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.didJustFinish) {
                    sound.unloadAsync();
                }
            });

            return { success: true };
        } catch (error) {
            console.log('Error playing sound:', error);
            return { success: false, error: error.message };
        }
    },

    async playEmergencySound() {
        try {
            // Play emergency alert sound
            await Audio.setAudioModeAsync({
                playsInSilentModeIOS: true,
            });

            const { sound } = await Audio.Sound.createAsync(
                require('../../assets/sounds/emergency.mp3'),
                { isLooping: true }
            );

            await sound.playAsync();
            return { sound, success: true };
        } catch (error) {
            console.log('Error playing emergency sound:', error);
            return { success: false, error: error.message };
        }
    },

    async stopSound(sound) {
        try {
            if (sound) {
                await sound.stopAsync();
                await sound.unloadAsync();
            }
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
};

export default VoiceService;