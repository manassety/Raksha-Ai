import { useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';

// Global reference to prevent multiple audio instances
let globalBackgroundAudio = null;

export const useGlobalVoiceSOS = (user, navigationRef) => {
    const isAudioBusyRef = useRef(false);

    useEffect(() => {
        if (!user || !navigationRef) {
            stopVoiceRecognition();
            return;
        }

        // Delay checking navigation state until it's ready
        const startIfReady = () => {
            if (navigationRef.current?.isReady()) {
                const currentRoute = navigationRef.current.getCurrentRoute();
                if (currentRoute && currentRoute.name === 'SOSEmergency') {
                    stopVoiceRecognition();
                } else {
                    startVoiceRecognition();
                }
            } else {
                // If not ready, just start it and let the listener catch it later
                startVoiceRecognition();
            }
        };

        startIfReady();

        // Listen for screen changes to free up the microphone when SOS screen is active
        const unsubscribe = navigationRef.addListener('state', () => {
            if (navigationRef.current?.isReady()) {
                const currentRoute = navigationRef.current.getCurrentRoute();
                if (currentRoute && currentRoute.name === 'SOSEmergency') {
                    stopVoiceRecognition();
                } else {
                    startVoiceRecognition();
                }
            }
        });

        return () => {
            if (unsubscribe) unsubscribe();
            stopVoiceRecognition();
        };
    }, [user, navigationRef]);

    const startVoiceRecognition = async () => {
        if (isAudioBusyRef.current || globalBackgroundAudio) return;

        try {
            isAudioBusyRef.current = true;
            let { status } = await Audio.getPermissionsAsync();
            if (status !== 'granted') {
                const req = await Audio.requestPermissionsAsync();
                status = req.status;
            }

            // If no permission, silently fail and don't loop
            if (status !== 'granted') {
                isAudioBusyRef.current = false;
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                staysActiveInBackground: true,
                shouldDuckAndroid: true,
            });

            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            recording.setProgressUpdateInterval(250);
            recording.setOnRecordingStatusUpdate((st) => {
                // Raised threshold to -1 to prevent ambient sounds from triggering it (requires extremely loud noise/shout)
                if (st.isRecording && st.metering && st.metering > -1) {
                    console.log("[Global Voice] Loud noise/shout detected globally in background! Triggering SOS...");

                    if (navigationRef.current) {
                        // Check if already on SOS screen to prevent infinite redirects
                        const currentRoute = navigationRef.current.getCurrentRoute();
                        if (currentRoute && currentRoute.name !== 'SOSEmergency') {
                            // Stop background logger so SOS Emergency screen can take over the mic
                            stopVoiceRecognition().then(() => {
                                Speech.speak("Emergency voice command detected. SOS Activated.");
                                navigationRef.current.navigate('SOSEmergency', { autoStart: true });
                            });
                        }
                    }
                }
            });

            globalBackgroundAudio = recording;
            console.log("Global Sound Trigger listener started (Background Mode Active).");
        } catch (err) {
            console.log("Global Sound Trigger start error:", err);
        } finally {
            isAudioBusyRef.current = false;
        }
    };

    const stopVoiceRecognition = async () => {
        try {
            isAudioBusyRef.current = true;
            if (globalBackgroundAudio) {
                await globalBackgroundAudio.stopAndUnloadAsync();
                globalBackgroundAudio = null;
            }
            console.log("Global Sound Trigger listener stopped.");
        } catch (err) {
            globalBackgroundAudio = null;
        } finally {
            isAudioBusyRef.current = false;
        }
    };
};
