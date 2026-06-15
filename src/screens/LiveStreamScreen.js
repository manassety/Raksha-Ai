import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import WebRTCStreamingService from '../services/WebRTCStreamingService';
import { useDetectionService } from '../services/DetectionService';
import { db } from '../config/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { mediaDevices } from 'react-native-webrtc';

const LiveStreamScreen = ({ route, navigation }) => {
    const { sosId, userId } = route.params || { sosId: `sos-${Date.now()}`, userId: 'user-1' };
    const device = useCameraDevice('back');

    const [hasPermission, setHasPermission] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [detectionInfo, setDetectionInfo] = useState({ humanDetected: false, confidence: 0 });
    const [streamError, setStreamError] = useState(null);

    // Initialize Detection
    const handleDetection = (info) => {
        setDetectionInfo(info);
    };
    const { frameProcessor, modelLoaded } = useDetectionService(sosId, handleDetection);

    useEffect(() => {
        (async () => {
            const cameraStatus = await Camera.requestCameraPermission();
            const microPhoneStatus = await Camera.requestMicrophonePermission();
            setHasPermission(cameraStatus === 'granted' && microPhoneStatus === 'granted');
        })();

        // Initialize Firebase Session Metadata
        initFirebaseSession();

        return () => {
            stopStream();
        };
    }, []);

    const initFirebaseSession = async () => {
        try {
            await setDoc(doc(db, 'sosSessions', sosId), {
                sosId,
                userId,
                status: 'active',
                streamStatus: 'connecting',
                startedAt: new Date().toISOString(),
                detection: {
                    humanDetected: false,
                    confidence: 0,
                    label: 'none'
                }
            }, { merge: true });
        } catch (e) {
            console.error('[LiveStreamScreen] Firebase init error:', e);
        }
    };

    const startStream = async () => {
        if (isStreaming) return;
        try {
            // Get Local Stream for WebRTC
            const localStream = await mediaDevices.getUserMedia({
                audio: true,
                video: {
                    facingMode: 'environment'
                }
            });

            WebRTCStreamingService.init(sosId, localStream);
            setIsStreaming(true);

            await setDoc(doc(db, 'sosSessions', sosId), {
                streamStatus: 'live',
                updatedAt: new Date().toISOString(),
            }, { merge: true });

        } catch (e) {
            console.error('[LiveStreamScreen] Start stream error:', e);
            setStreamError('Failed to start stream.');
            Alert.alert('Stream Error', 'Could not start live stream. Please check network/permissions.');
        }
    };

    const stopStream = async () => {
        if (!isStreaming) return;
        WebRTCStreamingService.stop();
        setIsStreaming(false);

        try {
            await setDoc(doc(db, 'sosSessions', sosId), {
                streamStatus: 'stopped',
                status: 'resolved',
                endedAt: new Date().toISOString(),
            }, { merge: true });
        } catch (e) {
            console.error('[LiveStreamScreen] Firebase update error:', e);
        }
    };

    if (!hasPermission) {
        return <View style={styles.container}><Text>No Camera/Microphone Permission</Text></View>;
    }

    if (device == null) {
        return <View style={styles.container}><Text>Loading Camera...</Text></View>;
    }

    return (
        <View style={styles.container}>
            <Camera
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={true}
                frameProcessor={frameProcessor}
                frameProcessorFps={5} // Limit FPS for model performance
            />

            {/* Overlays */}
            <View style={styles.overlayTop}>
                <Text style={styles.infoText}>SOS ID: {sosId}</Text>
                <Text style={styles.infoText}>Status: {isStreaming ? 'LIVE' : 'IDLE'}</Text>
                <Text style={styles.infoText}>AI Model: {modelLoaded ? 'Loaded' : 'Loading...'}</Text>
                {streamError && <Text style={styles.errorText}>{streamError}</Text>}
            </View>

            {/* Detection Box */}
            <View style={styles.detectionBox}>
                <Text style={styles.detectionText}>
                    Human: {detectionInfo.humanDetected ? 'YES' : 'NO'} | Conf: {detectionInfo.confidence.toFixed(2)}
                </Text>
            </View>

            {/* Controls */}
            <View style={styles.controls}>
                {!isStreaming ? (
                    <TouchableOpacity style={styles.btnStart} onPress={startStream}>
                        <Text style={styles.btnText}>Start Stream</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={styles.btnStop} onPress={stopStream}>
                        <Text style={styles.btnText}>Stop Stream / Resolve</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
    overlayTop: {
        position: 'absolute',
        top: 50,
        left: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 10,
        borderRadius: 8
    },
    infoText: { color: '#FFF', fontSize: 14, marginBottom: 4 },
    errorText: { color: 'red', fontSize: 14 },
    detectionBox: {
        position: 'absolute',
        top: 150,
        left: 20,
        backgroundColor: 'rgba(255, 0, 0, 0.5)',
        padding: 10,
        borderRadius: 8
    },
    detectionText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
    controls: {
        position: 'absolute',
        bottom: 50,
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'center',
    },
    btnStart: { backgroundColor: 'green', padding: 15, borderRadius: 10 },
    btnStop: { backgroundColor: 'red', padding: 15, borderRadius: 10 },
    btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});

export default LiveStreamScreen;
