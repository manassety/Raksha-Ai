// ====================================================================
// FILE: src/services/EvidenceService.js
// ====================================================================
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as Audio from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { StorageService } from './StorageService';
import { STORAGE_KEYS, EVIDENCE_TYPES } from '../config/constants';

export const EvidenceService = {
    async capturePhoto() {
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                return { success: false, error: 'Camera permission not granted' };
            }

            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 1,
            });

            if (!result.canceled) {
                const evidence = {
                    type: EVIDENCE_TYPES.PHOTO,
                    uri: result.assets[0].uri,
                    timestamp: new Date().toISOString(),
                };

                await this.saveEvidence(evidence);
                return { success: true, evidence };
            }

            return { success: false, error: 'Photo capture cancelled' };
        } catch (error) {
            console.log('Error capturing photo:', error);
            return { success: false, error: error.message };
        }
    },

    async captureVideo() {
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                return { success: false, error: 'Camera permission not granted' };
            }

            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                allowsEditing: true,
                quality: 1,
                videoMaxDuration: 300, // 5 minutes max
            });

            if (!result.canceled) {
                const evidence = {
                    type: EVIDENCE_TYPES.VIDEO,
                    uri: result.assets[0].uri,
                    duration: result.assets[0].duration,
                    timestamp: new Date().toISOString(),
                };

                await this.saveEvidence(evidence);
                return { success: true, evidence };
            }

            return { success: false, error: 'Video capture cancelled' };
        } catch (error) {
            console.log('Error capturing video:', error);
            return { success: false, error: error.message };
        }
    },

    async startAudioRecording() {
        try {
            const { status } = await Audio.requestPermissionsAsync();
            if (status !== 'granted') {
                return { success: false, error: 'Microphone permission not granted' };
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            return { success: true, recording };
        } catch (error) {
            console.log('Error starting audio recording:', error);
            return { success: false, error: error.message };
        }
    },

    async stopAudioRecording(recording) {
        try {
            if (!recording) {
                return { success: false, error: 'No recording in progress' };
            }

            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();

            const evidence = {
                type: EVIDENCE_TYPES.AUDIO,
                uri,
                timestamp: new Date().toISOString(),
            };

            await this.saveEvidence(evidence);
            return { success: true, evidence };
        } catch (error) {
            console.log('Error stopping audio recording:', error);
            return { success: false, error: error.message };
        }
    },

    async pickFromGallery() {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                return { success: false, error: 'Media library permission not granted' };
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.ALL,
                allowsEditing: true,
                quality: 1,
            });

            if (!result.canceled) {
                const asset = result.assets[0];
                const evidence = {
                    type: asset.type === 'video' ? EVIDENCE_TYPES.VIDEO : EVIDENCE_TYPES.PHOTO,
                    uri: asset.uri,
                    timestamp: new Date().toISOString(),
                };

                await this.saveEvidence(evidence);
                return { success: true, evidence };
            }

            return { success: false, error: 'Selection cancelled' };
        } catch (error) {
            console.log('Error picking from gallery:', error);
            return { success: false, error: error.message };
        }
    },

    async saveEvidence(evidence) {
        try {
            const existingEvidence = await StorageService.get(STORAGE_KEYS.EVIDENCE_DATA) || [];
            const newEvidence = {
                id: Date.now().toString(),
                ...evidence,
                isEncrypted: true,
            };

            const updatedEvidence = [newEvidence, ...existingEvidence];
            await StorageService.set(STORAGE_KEYS.EVIDENCE_DATA, updatedEvidence);

            return { success: true, evidence: newEvidence };
        } catch (error) {
            console.log('Error saving evidence:', error);
            return { success: false, error: error.message };
        }
    },

    async getEvidence() {
        try {
            const evidence = await StorageService.get(STORAGE_KEYS.EVIDENCE_DATA) || [];
            return evidence;
        } catch (error) {
            console.log('Error getting evidence:', error);
            return [];
        }
    },

    async deleteEvidence(evidenceId) {
        try {
            const evidence = await this.getEvidence();
            const filtered = evidence.filter(e => e.id !== evidenceId);
            await StorageService.set(STORAGE_KEYS.EVIDENCE_DATA, filtered);
            return { success: true };
        } catch (error) {
            console.log('Error deleting evidence:', error);
            return { success: false, error: error.message };
        }
    },

    async clearAllEvidence() {
        try {
            await StorageService.remove(STORAGE_KEYS.EVIDENCE_DATA);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    async saveToDevice(evidence) {
        try {
            if (evidence.type === EVIDENCE_TYPES.PHOTO || evidence.type === EVIDENCE_TYPES.VIDEO) {
                const { status } = await MediaLibrary.requestPermissionsAsync();
                if (status !== 'granted') {
                    return { success: false, error: 'Media library permission not granted' };
                }

                const asset = await MediaLibrary.createAssetAsync(evidence.uri);
                await MediaLibrary.createAlbumAsync('Tanprix', asset, false);

                return { success: true };
            } else {
                // For audio, just copy to a accessible location
                const fileName = `tanprix_evidence_${Date.now()}.m4a`;
                const destPath = FileSystem.documentDirectory + fileName;
                await FileSystem.copyAsync({
                    from: evidence.uri,
                    to: destPath,
                });

                return { success: true, path: destPath };
            }
        } catch (error) {
            console.log('Error saving to device:', error);
            return { success: false, error: error.message };
        }
    },
};

export default EvidenceService;