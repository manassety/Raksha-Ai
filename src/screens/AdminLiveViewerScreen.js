import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import {
    RTCPeerConnection,
    RTCIceCandidate,
    RTCSessionDescription,
    RTCView,
    MediaStream
} from 'react-native-webrtc';
import { getSocket } from '../services/StreamingService';
import { db } from '../config/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

const PC_CONFIG = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
    ],
};

const AdminLiveViewerScreen = ({ route, navigation }) => {
    const { sosId } = route.params;
    const [remoteStream, setRemoteStream] = useState(null);
    const [sessionData, setSessionData] = useState(null);
    const [error, setError] = useState(null);
    const pcRef = useRef(null);

    useEffect(() => {
        // 1. Firebase snapshot for metadata & detection logs
        const unsub = onSnapshot(doc(db, 'sosSessions', sosId), (docSnap) => {
            if (docSnap.exists()) {
                setSessionData(docSnap.data());
            } else {
                setError('Session not found in Firebase.');
            }
        });

        // 2. Setup WebRTC Peer Connection
        setupWebrtc();

        return () => {
            unsub();
            cleanupWebrtc();
        };
    }, [sosId]);

    const setupWebrtc = () => {
        const socket = getSocket();
        if (!socket) {
            setError('Signal Server not connected.');
            return;
        }

        const pc = new RTCPeerConnection(PC_CONFIG);
        pcRef.current = pc;

        pc.onaddstream = (event) => {
            console.log('[Admin Viewer] Received remote stream');
            setRemoteStream(event.stream);
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('signal:candidate', {
                    sosId,
                    candidate: event.candidate,
                });
            }
        };

        socket.on('signal:offer', async (data) => {
            if (data.sosId !== sosId) return;
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                socket.emit('signal:answer', {
                    sosId,
                    answer,
                    to: data.from
                });
            } catch (e) {
                console.error('[Admin Viewer] Offer handling error:', e);
            }
        });

        socket.on('signal:candidate', async (data) => {
            try {
                if (data.candidate && data.sosId === sosId) {
                    await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                }
            } catch (e) {
                console.error('[Admin Viewer] ICE error:', e);
            }
        });

        // Notify streamer we are watching
        socket.emit('admin:watch', { sosId });
    };

    const cleanupWebrtc = () => {
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        const socket = getSocket();
        if (socket) {
            socket.off('signal:offer');
            socket.off('signal:candidate');
        }
    };

    const endSession = async () => {
        // Ideally this updates firestore or emits to socket
        cleanupWebrtc();
        navigation.goBack();
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>SOS Live Feed</Text>
                <Text style={styles.headerSubtitle}>ID: {sosId}</Text>
            </View>

            {/* Video Container */}
            <View style={styles.videoContainer}>
                {remoteStream ? (
                    <RTCView
                        streamURL={remoteStream.toURL()}
                        style={styles.video}
                        objectFit="cover"
                    />
                ) : (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#ffffff" />
                        <Text style={styles.loadingText}>Waiting for Video Stream...</Text>
                        {error && <Text style={styles.errorText}>{error}</Text>}
                    </View>
                )}
            </View>

            {/* Dynamic Data / Detection Result from Firebase */}
            <View style={styles.dataPanel}>
                <Text style={styles.dataTitle}>Session Metadata</Text>
                <Text style={styles.dataText}>User ID: {sessionData?.userId || 'N/A'}</Text>
                <Text style={styles.dataText}>Status: {sessionData?.streamStatus || 'N/A'}</Text>

                <View style={styles.detectionBox}>
                    <Text style={styles.detectionTitle}>AI Detection Results</Text>
                    <Text style={styles.dataText}>
                        Human: {sessionData?.detection?.humanDetected ? 'YES 🔴' : 'NO 🟢'}
                    </Text>
                    <Text style={styles.dataText}>
                        Confidence: {sessionData?.detection?.confidence.toFixed(2) || '0.00'}
                    </Text>
                </View>
            </View>

            {/* Controls */}
            <View style={styles.controls}>
                <TouchableOpacity style={styles.btnEnd} onPress={endSession}>
                    <Text style={styles.btnText}>Close Viewer</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#121212' },
    header: { padding: 20, paddingTop: 50, backgroundColor: '#1E1E1E' },
    headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
    headerSubtitle: { color: '#AAA', fontSize: 14 },
    videoContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
    video: { width: '100%', height: '100%' },
    loadingContainer: { alignItems: 'center' },
    loadingText: { color: '#FFF', marginTop: 10 },
    errorText: { color: '#FF4444', marginTop: 10 },
    dataPanel: { padding: 20, backgroundColor: '#1E1E1E' },
    dataTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
    dataText: { color: '#DDD', fontSize: 16, marginBottom: 5 },
    detectionBox: { marginTop: 10, padding: 10, backgroundColor: 'rgba(255,0,0,0.1)', borderRadius: 8, borderWidth: 1, borderColor: '#FF4444' },
    detectionTitle: { color: '#FF4444', fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
    controls: { padding: 20, paddingBottom: 40, backgroundColor: '#1E1E1E' },
    btnEnd: { backgroundColor: '#FF4444', padding: 15, borderRadius: 8, alignItems: 'center' },
    btnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});

export default AdminLiveViewerScreen;
