import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, Alert, Modal, TextInput, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { collection, query, where, onSnapshot, doc, updateDoc, Timestamp, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import GradientBackground from '../components/GradientBackground';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';
import { saveEvidence } from '../utils/EvidenceManager';
import { getAuth } from 'firebase/auth';
import { io } from 'socket.io-client';
import { STREAMING_CONFIG } from '../config/streaming';
import DiscoveryService from '../services/DiscoveryService';
import {
    RTCView,
    RTCPeerConnection,
    RTCIceCandidate,
    RTCSessionDescription
} from 'react-native-webrtc';

const LiveSOSMonitorScreen = () => {
    const navigation = useNavigation();
    const [liveStreams, setLiveStreams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [passwordModalVisible, setPasswordModalVisible] = useState(false);
    const [adminPassword, setAdminPassword] = useState('');
    const [ipModalVisible, setIpModalVisible] = useState(false);
    const [ipInput, setIpInput] = useState('');
    const [ipTarget, setIpTarget] = useState('streaming'); // 'streaming' or 'python'
    const [selectedStream, setSelectedStream] = useState(null);
    const [isRecordingStream, setIsRecordingStream] = useState(null);
    const [voiceMessage, setVoiceMessage] = useState('');
    const [sendingVoice, setSendingVoice] = useState(false);
    const [streamConnected, setStreamConnected] = useState(false);
    const [streamUrl, setStreamUrl] = useState(DiscoveryService.getUrl());
    const [reconnectPulse, setReconnectPulse] = useState(0);

    // Live Feed State
    const [remoteStreams, setRemoteStreams] = useState({}); // Kept for logic compatibility

    const pulseAnim = useRef(new Animated.Value(1)).current;
    const socketRef = useRef(null);
    const peerConnections = useRef({}); // { sosId: RTCPeerConnection }
    const [remoteVideoStreams, setRemoteVideoStreams] = useState({}); // { sosId: MediaStream }
    const liveFramesRef = useRef({}); // { sosId: base64Frame }
    const [frameUpdater, setFrameUpdater] = useState(0); // Force re-renders on new frames

    // Discovery
    useEffect(() => {
        DiscoveryService.init();
        const unmount = DiscoveryService.onUrlChange((newUrl) => {
            setStreamUrl(newUrl);
        });
        return unmount;
    }, []);

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    // ── Socket.IO Connection for Live Frames ──
    useEffect(() => {
        console.log('[Admin] Connecting to streaming server:', streamUrl);

        const socket = io(streamUrl, {
            transports: ['websocket'],
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
            forceNew: true
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('[Admin] Connected to streaming server:', socket.id);
            setStreamConnected(true);
            socket.emit('admin:get_sessions');
        });

        socket.on('disconnect', (reason) => {
            console.log('[Admin] Disconnected from streaming server:', reason);
            setStreamConnected(false);
        });

        socket.on('connect_error', (err) => {
            console.log('[Admin] Stream connection error:', err.message);
            setStreamConnected(false);
        });

        socket.on('sos:session_ended', (data) => {
            console.log('[Admin] SOS session ended via socket:', data.sosId);
            // Removed: setLiveStreams(prev => prev.filter(s => s.id !== data.sosId));
            // We now rely solely on Firestore 'onSnapshot' to remove streams when status becomes 'resolved'.
            // This prevents momentary websocket disconnects from making the SOS vanish from the dashboard.
            if (peerConnections.current[data.sosId]) {
                peerConnections.current[data.sosId].close();
                delete peerConnections.current[data.sosId];
            }
            // Keep the last frame visible to avoid a black screen during brief network jitter
            // delete liveFramesRef.current[data.sosId];
        });

        // ── WebRTC Signaling Handlers ──
        socket.on('signal:offer', async (data) => {
            const { sosId, offer, from } = data;
            try {
                let pc = peerConnections.current[sosId];
                if (!pc) {
                    pc = createPeerConnection(sosId, socket, from);
                    peerConnections.current[sosId] = pc;
                }
                await pc.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.emit('signal:answer', { sosId, answer, to: from });
            } catch (err) {
                console.error('[WebRTC] Offer handle error:', err);
            }
        });

        socket.on('signal:candidate', async (data) => {
            const { sosId, candidate } = data;
            const pc = peerConnections.current[sosId];
            if (pc && candidate) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (e) {
                    console.log("[WebRTC] ICE Error:", e.message);
                }
            }
        });

        return () => {
            socket.disconnect();
            Object.values(peerConnections.current).forEach(pc => pc.close());
            socketRef.current = null;
        };
    }, [streamUrl, reconnectPulse]);

    // ── Helper: Create PeerConnection ──
    const createPeerConnection = (sosId, socket, streamerId) => {
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        });

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('signal:candidate', {
                    sosId,
                    candidate: event.candidate,
                    to: streamerId
                });
            }
        };

        pc.ontrack = (event) => {
            console.log(`[WebRTC] Received remote track for ${sosId}`);
            if (event.streams && event.streams[0]) {
                setRemoteVideoStreams(prev => ({
                    ...prev,
                    [sosId]: event.streams[0]
                }));
            }
        };

        pc.onconnectionstatechange = () => {
            console.log(`[WebRTC] PC State (${sosId}):`, pc.connectionState);
            if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
                // Cleanup potentially needed
            }
        };

        return pc;
    };

    // ── Firestore listener for SOS alerts metadata ──
    useEffect(() => {
        const q = query(
            collection(db, "sos_alerts"),
            where("type", "==", "SOS_EMERGENCY"),
            where("status", "==", "ongoing")
        );

        const activeListeners = new Set();

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const streams = [];
            const now = Date.now();
            const cleanupPromises = [];

            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const startTime = data.timestamp ? data.timestamp.toMillis() : now;
                const lastTime = data.lastFrameTime ? data.lastFrameTime.toMillis() : startTime;

                if (now - lastTime < 300000) { // 5 min timeout
                    streams.push({ id: docSnap.id, ...data });

                    // Efficiently attach socket listener only ONCE per stream ID
                    if (socketRef.current && streamConnected && !activeListeners.has(docSnap.id)) {
                        const eventName = `sos:live_frame:${docSnap.id}`;
                        activeListeners.add(docSnap.id);

                        // Use a single listener setup per ID
                        socketRef.current.off(eventName); // Safety clear
                        socketRef.current.on(eventName, (frameData) => {
                            liveFramesRef.current[docSnap.id] = frameData.frame;
                            // Throttled UI update: Only re-render every few frames if needed
                            // For simplicity, we keep the frameUpdater but it's now cleaner
                            setFrameUpdater(prev => prev + 1);
                        });
                        socketRef.current.emit('admin:watch', { sosId: docSnap.id });
                    }
                } else if (now - lastTime > 360000) {
                    cleanupPromises.push(updateDoc(doc(db, "sos_alerts", docSnap.id), { status: 'resolved' }));
                }
            });

            if (cleanupPromises.length > 0) {
                await Promise.all(cleanupPromises).catch(e => console.log("Cleanup Error:", e));
            }

            setLiveStreams(streams);
            setLoading(false);
        });

        return () => {
            unsubscribe();
            activeListeners.clear();
        };
    }, [streamConnected, streamUrl]); // Depend on connection state

    const sendVoiceCommand = async (streamId) => {
        if (!voiceMessage.trim()) return;
        setSendingVoice(true);
        try {
            // Send via Socket.IO (fast, real-time)
            if (socketRef.current && streamConnected) {
                socketRef.current.emit('admin:voice_command', {
                    sosId: streamId,
                    message: voiceMessage,
                });
            }

            // Also save to Firestore as fallback
            await updateDoc(doc(db, "sos_alerts", streamId), {
                adminVoiceCommand: voiceMessage,
                adminVoiceCommandId: Date.now().toString(),
                adminVoiceCommandTime: Timestamp.now()
            });

            setVoiceMessage('');
            Alert.alert("Sent", "Message broadcasted to user's device.");
        } catch (e) {
            console.log("Voice command error:", e);
            Alert.alert("Error", "Failed to broadcast voice.");
        }
        setSendingVoice(false);
    };

    const toggleRecording = async (item) => {
        if (isRecordingStream === item.id) {
            setIsRecordingStream(null);
            Alert.alert('Recording Stopped', 'Feed capture session finalized.');
        } else {
            setIsRecordingStream(item.id);
            Alert.alert('Recording Started', 'Capturing live stream session.');
        }
    };

    const handleSingleCapture = async (item) => {
        const frame = liveFramesRef.current[item.id] || item.liveFrame;
        if (frame) {
            try {
                const auth = getAuth();
                const userName = auth.currentUser?.displayName || 'Admin';
                const fileInfo = {
                    uri: `data:image/jpeg;base64,${frame}`,
                    name: `AdminCapture_${item.id}_${Date.now()}.jpg`,
                    size: 100,
                };
                await saveEvidence(userName, fileInfo, 'image', null, 'Admin Live Capture', 'sos');
                Alert.alert('Evidence Saved', 'A frame from the live feed has been saved to Evidence Gallery.');
            } catch (e) {
                console.log('Error saving evidence:', e);
            }
        }
    };

    const clearAllStale = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, "sos_alerts"), where("status", "==", "ongoing"));
            const snap = await getDocs(q);
            const batch = [];
            snap.forEach(d => batch.push(updateDoc(doc(db, "sos_alerts", d.id), { status: 'resolved' })));
            await Promise.all(batch);
            Alert.alert("Success", "All ongoing streams have been marked as resolved.");
        } catch (e) {
            Alert.alert("Error", "Failed to clear screens.");
        }
        setLoading(false);
    };

    const handleEmergencyStop = (item) => {
        setSelectedStream(item);
        setAdminPassword('');
        setPasswordModalVisible(true);
    };

    const confirmEmergencyStop = async () => {
        if (adminPassword === 'man*dep#2005' || adminPassword === 'Kaidoo#@2302') {
            try {
                await updateDoc(doc(db, "sos_alerts", selectedStream.id), { status: "resolved" });
                Alert.alert("Success", "SOS has been force-stopped.");
                setPasswordModalVisible(false);
            } catch (e) {
                Alert.alert("Error", "Could not stop SOS.");
            }
        } else {
            Alert.alert("Denied", "Incorrect admin password.");
        }
    };

    const confirmIpUpdate = () => {
        if (!ipInput.trim()) return;
        DiscoveryService.register(ipInput.trim(), ipTarget === 'python');
        setIpModalVisible(false);
        setIpInput('');
        Alert.alert("Success", `${ipTarget === 'streaming' ? 'Streaming' : 'Python'} Server IP updated successfully.`);
    };

    const renderStreamItem = ({ item }) => {
        const isCurrentlyRecording = isRecordingStream === item.id;
        // Use Socket.IO frame if available, fall back to Firestore frame
        const currentFrame = liveFramesRef.current[item.id] || item.liveFrame;

        const pulsatingStyle = {
            transform: [{ scale: pulseAnim }],
            opacity: pulseAnim.interpolate({
                inputRange: [1, 1.2],
                outputRange: [1, 0.7]
            })
        };

        return (
            <View style={styles.streamCard}>
                <View style={styles.streamHeader}>
                    <Ionicons name="warning" size={24} color={COLORS.danger} />
                    <View style={styles.headerInfo}>
                        <Text style={styles.streamTitle}>Emergency: {item.userName || "Unknown User"}</Text>
                        <Text style={styles.userInfo}>Alert ID: {item.id.slice(0, 8)}</Text>
                    </View>
                    <View style={[styles.liveBadge, streamConnected && styles.liveBadgeConnected]}>
                        <Text style={styles.liveBadgeText}>
                            {streamConnected ? 'LIVE' : 'ONGOING'}
                        </Text>
                    </View>
                </View>

                <View style={styles.videoContainer}>
                    {remoteVideoStreams[item.id] ? (
                        <View style={{ flex: 1 }}>
                            <RTCView
                                streamURL={remoteVideoStreams[item.id].toURL()}
                                style={styles.liveImage}
                                objectFit="cover"
                            />
                            <View style={[styles.streamLabel, { backgroundColor: COLORS.success }]}>
                                <Text style={styles.streamLabelText}>WEBRTC LIVE STREAM</Text>
                            </View>
                        </View>
                    ) : currentFrame ? (
                        <View style={{ flex: 1 }}>
                            <Image
                                source={{ uri: `data:image/jpeg;base64,${currentFrame}` }}
                                style={styles.liveImage}
                                resizeMode="cover"
                            />
                            <View style={[styles.streamLabel, { backgroundColor: COLORS.success }]}>
                                <Text style={styles.streamLabelText}>LIVE PHOTO STREAM (v2)</Text>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.noFrameContainer}>
                            <ActivityIndicator color={COLORS.primary} size="large" />
                            <Text style={styles.noFrameText}>Waiting for SOS Photos or Video...</Text>
                            <Text style={styles.noFrameSubtext}>
                                {streamConnected ? 'Connected — Waiting for victim WebRTC/Photos...' : 'Connecting to emergency stream...'}
                            </Text>
                        </View>
                    )}
                    {(currentFrame || remoteVideoStreams[item.id]) && (
                        <View style={styles.liveOverlay}>
                            <Animated.View style={[styles.liveDot, pulsatingStyle]} />
                            <Text style={styles.liveLabelText}>LIVE FEED</Text>
                        </View>
                    )}
                    {isCurrentlyRecording && (
                        <View style={styles.recordingOverlay}>
                            <View style={styles.recDot} />
                            <Text style={styles.recText}>REC</Text>
                        </View>
                    )}
                    {item.humanDetected && (
                        <View style={styles.humanBadge}>
                            <Ionicons name="person" size={12} color={COLORS.white} />
                            <Text style={styles.humanBadgeText}>HUMAN DETECTED</Text>
                        </View>
                    )}
                </View>

                <View style={styles.voiceControlBar}>
                    <TextInput
                        style={styles.voiceTextInput}
                        placeholder="Say something to the user..."
                        placeholderTextColor={COLORS.gray400}
                        value={voiceMessage}
                        onChangeText={setVoiceMessage}
                    />
                    <TouchableOpacity
                        style={[styles.voiceSendBtn, { opacity: voiceMessage.trim() ? 1 : 0.5 }]}
                        onPress={() => sendVoiceCommand(item.id)}
                        disabled={!voiceMessage.trim() || sendingVoice}
                    >
                        {sendingVoice ? <ActivityIndicator size="small" color={COLORS.white} /> : <Ionicons name="mic" size={20} color={COLORS.white} />}
                    </TouchableOpacity>
                </View>

                <View style={styles.actionGrid}>
                    <TouchableOpacity
                        onPress={() => toggleRecording(item)}
                        style={[styles.actionBtn, { backgroundColor: isCurrentlyRecording ? COLORS.warning : COLORS.gray100 }]}
                    >
                        <Ionicons name={isCurrentlyRecording ? "stop-circle" : "videocam"} size={20} color={isCurrentlyRecording ? COLORS.white : COLORS.primary} />
                        <Text style={[styles.actionBtnText, { color: isCurrentlyRecording ? COLORS.white : COLORS.primary }]}>
                            {isCurrentlyRecording ? "Stop Recording" : "Record Feed"}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => handleSingleCapture(item)}
                        style={[styles.actionBtn, { backgroundColor: COLORS.gray100 }]}
                    >
                        <Ionicons name="camera" size={20} color={COLORS.success} />
                        <Text style={[styles.actionBtnText, { color: COLORS.success }]}>Capture Frame</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => handleEmergencyStop(item)}
                        style={[styles.actionBtn, { backgroundColor: COLORS.danger + '15' }]}
                    >
                        <Ionicons name="close-circle" size={20} color={COLORS.danger} />
                        <Text style={[styles.actionBtnText, { color: COLORS.danger }]}>Force Stop</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.cardFooter}>
                    <Text style={styles.timeText}>
                        Last Update: {item.lastFrameTime ? item.lastFrameTime.toDate().toLocaleTimeString() : 'N/A'}
                    </Text>
                    <View style={styles.connectionStatus}>
                        <View style={[styles.connectionDot, { backgroundColor: streamConnected ? COLORS.success : COLORS.warning }]} />
                        <Text style={styles.connectionText}>
                            {streamConnected ? 'Real-time' : 'Polling'}
                        </Text>
                    </View>
                    {item.location && (
                        <TouchableOpacity style={styles.locationLink}>
                            <Ionicons name="location" size={14} color={COLORS.primary} />
                            <Text style={styles.locationText}>View Map</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    return (
        <GradientBackground colors={GRADIENTS.dark}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <Text style={styles.title}>Live SOS Monitor</Text>
                        <TouchableOpacity
                            onPress={() => setReconnectPulse(p => p + 1)}
                            style={[styles.serverBadge, { backgroundColor: streamConnected ? COLORS.success + '30' : COLORS.warning + '30' }]}
                        >
                            <View style={[styles.serverDot, { backgroundColor: streamConnected ? COLORS.success : COLORS.warning }]} />
                            <Text style={[styles.serverText, { color: streamConnected ? COLORS.success : COLORS.warning }]}>
                                {streamConnected ? 'Server Connected' : 'Connecting (Tap to Retry)'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={clearAllStale} style={styles.clearBtn}>
                        <Ionicons name="trash-outline" size={24} color={COLORS.danger} />
                    </TouchableOpacity>
                </View>

                {/* SERVER STATUS & IP UPDATE */}
                <View style={styles.serverConfigBar}>
                    <Text style={styles.serverConfigText}>Server: {DiscoveryService.getUrl()}</Text>
                    <TouchableOpacity
                        style={styles.updateIpBtn}
                        onPress={() => {
                            Alert.alert(
                                "Select Server to Update",
                                "Which server IP do you want to configure?",
                                [
                                    { text: "Cancel", style: "cancel" },
                                    {
                                        text: "Streaming Server", onPress: () => {
                                            setIpTarget('streaming');
                                            setIpInput(DiscoveryService.getUrl());
                                            setIpModalVisible(true);
                                        }
                                    },
                                    {
                                        text: "Python AI Server", onPress: () => {
                                            setIpTarget('python');
                                            setIpInput(DiscoveryService.getPythonUrl());
                                            setIpModalVisible(true);
                                        }
                                    }
                                ]
                            );
                        }}
                    >
                        <Text style={styles.updateIpBtnText}>Update IP</Text>
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                    </View>
                ) : liveStreams.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="videocam-off" size={48} color={COLORS.gray500} />
                        <Text style={styles.emptyText}>No Active Live Streams</Text>
                        <Text style={styles.emptySubtext}>
                            {streamConnected
                                ? 'Streaming server connected. Waiting for SOS triggers...'
                                : 'Attempting to connect to streaming server...'}
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        data={liveStreams}
                        keyExtractor={(item) => item.id}
                        renderItem={renderStreamItem}
                        contentContainerStyle={styles.listContent}
                        extraData={frameUpdater}
                    />
                )}

                {/* Password Modal for Admin Force Stop */}
                <Modal
                    visible={passwordModalVisible}
                    transparent
                    animationType="fade"
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.passwordCard}>
                            <Text style={styles.modalTitle}>Force Stop SOS</Text>
                            <Text style={styles.modalSubtext}>Enter Admin Password:</Text>
                            <TextInput
                                style={styles.passwordInput}
                                secureTextEntry
                                placeholder="Common Password"
                                value={adminPassword}
                                onChangeText={setAdminPassword}
                                autoFocus
                            />
                            <View style={styles.modalButtons}>
                                <TouchableOpacity
                                    style={[styles.modalBtn, { backgroundColor: COLORS.gray300 }]}
                                    onPress={() => setPasswordModalVisible(false)}
                                >
                                    <Text style={styles.btnText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalBtn, { backgroundColor: COLORS.danger }]}
                                    onPress={confirmEmergencyStop}
                                >
                                    <Text style={[styles.btnText, { color: COLORS.white }]}>Stop SOS</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* IP Configuration Modal */}
                <Modal
                    visible={ipModalVisible}
                    transparent
                    animationType="fade"
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.passwordCard}>
                            <Text style={styles.modalTitle}>Update Server IP</Text>
                            <Text style={styles.modalSubtext}>
                                Enter the {ipTarget === 'streaming' ? 'Node.js Streaming' : 'Python AI'} URL:
                            </Text>
                            <TextInput
                                style={[styles.passwordInput, { fontSize: 16 }]}
                                placeholder="http://192.168.x.x:PORT or https://..."
                                value={ipInput}
                                onChangeText={setIpInput}
                                autoCapitalize="none"
                                autoCorrect={false}
                                autoFocus
                            />
                            <View style={styles.modalButtons}>
                                <TouchableOpacity
                                    style={[styles.modalBtn, { backgroundColor: COLORS.gray300 }]}
                                    onPress={() => setIpModalVisible(false)}
                                >
                                    <Text style={styles.btnText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalBtn, { backgroundColor: COLORS.primary }]}
                                    onPress={confirmIpUpdate}
                                >
                                    <Text style={[styles.btnText, { color: COLORS.white }]}>Update</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </View>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.md,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.gray800,
    },
    serverConfigBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.md,
        paddingVertical: 8,
        backgroundColor: COLORS.black + '40',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.gray800,
    },
    serverConfigText: {
        color: COLORS.gray400,
        fontSize: 10,
        fontFamily: 'monospace',
    },
    updateIpBtn: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        backgroundColor: COLORS.primary + '20',
        borderRadius: 6,
    },
    updateIpBtnText: {
        color: COLORS.primary,
        fontSize: 10,
        fontWeight: 'bold',
    },
    headerCenter: { flex: 1, marginLeft: 12 },
    clearBtn: {
        padding: 5,
        backgroundColor: COLORS.danger + '10',
        borderRadius: 8,
    },
    title: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.white },
    serverBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        marginTop: 4,
        alignSelf: 'flex-start',
    },
    serverDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
    serverText: { fontSize: 10, fontWeight: '600' },
    listContent: { padding: SPACING.md },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
    emptyText: { color: COLORS.gray500, fontSize: FONT_SIZES.md, marginTop: SPACING.sm },
    emptySubtext: { color: COLORS.gray600, fontSize: FONT_SIZES.xs, marginTop: 4, textAlign: 'center' },
    streamCard: {
        backgroundColor: COLORS.white,
        borderRadius: 16,
        padding: SPACING.md,
        marginBottom: SPACING.lg,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    streamHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
    headerInfo: { flex: 1, marginLeft: 12 },
    streamTitle: { fontSize: FONT_SIZES.md, fontWeight: 'bold', color: COLORS.gray800 },
    liveBadge: { backgroundColor: COLORS.danger, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    liveBadgeConnected: { backgroundColor: COLORS.success },
    liveBadgeText: { color: COLORS.white, fontSize: 10, fontWeight: 'bold' },
    userInfo: { fontSize: 10, color: COLORS.gray500, marginTop: 2 },

    videoContainer: { width: '100%', height: 280, backgroundColor: COLORS.black, borderRadius: 12, overflow: 'hidden', marginBottom: SPACING.md },
    liveImage: { width: '100%', height: '100%' },
    noFrameContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' },
    noFrameText: { color: COLORS.white, marginTop: 12, fontWeight: 'bold' },
    noFrameSubtext: { color: COLORS.gray500, fontSize: 10, marginTop: 4 },

    liveOverlay: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.danger, marginRight: 6 },
    liveLabelText: { color: COLORS.white, fontSize: 10, fontWeight: 'bold' },

    humanBadge: { position: 'absolute', bottom: 12, left: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.success, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    humanBadgeText: { color: COLORS.white, fontSize: 9, fontWeight: 'bold', marginLeft: 4 },

    streamLabel: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingVertical: 4, alignItems: 'center', opacity: 0.8 },
    streamLabelText: { color: COLORS.white, fontSize: 8, fontWeight: 'bold', letterSpacing: 1 },

    recordingOverlay: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,0,0,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: COLORS.danger },
    recDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.danger, marginRight: 4 },
    recText: { color: COLORS.danger, fontSize: 10, fontWeight: 'bold' },

    voiceControlBar: { flexDirection: 'row', backgroundColor: COLORS.gray100, borderRadius: 12, padding: 4, marginBottom: SPACING.md },
    voiceTextInput: { flex: 1, paddingHorizontal: 12, paddingVertical: 8, color: COLORS.gray800, fontSize: 14 },
    voiceSendBtn: { backgroundColor: COLORS.primary, width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

    actionGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.md },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, marginHorizontal: 4 },
    actionBtnText: { fontSize: 11, fontWeight: 'bold', marginLeft: 6 },

    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.gray100, paddingTop: 10 },
    timeText: { fontSize: 10, color: COLORS.gray500 },
    connectionStatus: { flexDirection: 'row', alignItems: 'center' },
    connectionDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
    connectionText: { fontSize: 10, color: COLORS.gray500 },
    locationLink: { flexDirection: 'row', alignItems: 'center' },
    locationText: { fontSize: 10, color: COLORS.primary, fontWeight: 'bold', marginLeft: 4 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
    passwordCard: { backgroundColor: COLORS.white, width: '85%', padding: SPACING.lg, borderRadius: 20 },
    modalTitle: { fontSize: FONT_SIZES.lg, fontWeight: 'bold', color: COLORS.gray800, marginBottom: 4, textAlign: 'center' },
    modalSubtext: { fontSize: FONT_SIZES.sm, color: COLORS.gray600, marginBottom: SPACING.lg, textAlign: 'center' },
    passwordInput: {
        backgroundColor: COLORS.gray100,
        borderRadius: 12,
        padding: 15,
        marginBottom: SPACING.lg,
        textAlign: 'center',
        fontSize: FONT_SIZES.xl,
        fontWeight: 'bold',
        color: COLORS.primary
    },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
    modalBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', marginHorizontal: 6 },
    btnText: { fontWeight: 'bold', fontSize: 14 }
});

export default LiveSOSMonitorScreen;
