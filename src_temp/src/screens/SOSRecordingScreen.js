import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Speech from 'expo-speech';
import * as SecureStore from 'expo-secure-store';
import GradientBackground from '../components/GradientBackground';
import GradientButton from '../components/GradientButton';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';
import { verifyPIN } from '../utils/PINManager';
import { ensureEvidenceDirectory, saveEvidence } from '../utils/EvidenceManager';

const SOSRecordingScreen = () => {
    const navigation = useNavigation();
    const [isRecording, setIsRecording] = useState(true);
    const [recordingTime, setRecordingTime] = useState(0);
    const [listening, setListening] = useState(false);
    const [showPIN, setShowPIN] = useState(false);
    const [pin, setPin] = useState('');
    const [pinError, setPinError] = useState('');
    const [loading, setLoading] = useState(false);
    const timerRef = useRef(null);
    const countdownRef = useRef(null);

    useEffect(() => {
        // Start recording timer
        timerRef.current = setInterval(() => {
            setRecordingTime(prev => prev + 1);
        }, 1000);

        // Start listening for "Stop" command
        startListening();

        // Start 30-second countdown for PIN
        startCountdown();

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);
            Speech.stop();
        };
    }, []);

    const startListening = async () => {
        setListening(true);
        try {
            await Speech.requestPermissionsAsync();
        } catch (error) {
            console.error('Speech permission error:', error);
        }
    };

    const startCountdown = () => {
        let secondsLeft = 30;

        countdownRef.current = setInterval(() => {
            secondsLeft--;

            if (secondsLeft <= 0) {
                clearInterval(countdownRef.current);
                // If PIN not entered, trigger faster alert
                if (!showPIN) {
                    triggerFasterAlert();
                }
            }
        }, 1000);
    };

    const triggerFasterAlert = () => {
        Alert.alert(
            '⚠️ SAFETY ALERT',
            'No PIN entered within 30 seconds!\n\nEmergency contacts have been notified of your situation.',
            [
                {
                    text: 'Enter PIN Now',
                    onPress: () => {
                        setShowPIN(true);
                        setIsRecording(false);
                    }
                }
            ]
        );
    };

    const handleVoiceCommand = async () => {
        try {
            const result = await Speech.getRecognitionResultsAsync();

            if (result.length > 0) {
                const transcript = result[0].val.toLowerCase();

                if (transcript.includes('stop')) {
                    handleStopRecording();
                }
            }
        } catch (error) {
            console.error('Speech recognition error:', error);
        }
    };

    const handleStopRecording = async () => {
        setIsRecording(false);
        setShowPIN(true);
        Speech.speak('Recording stopped. Please enter your safety PIN to confirm your presence.');

        if (countdownRef.current) clearInterval(countdownRef.current);
    };

    const handlePINSubmit = async () => {
        if (pin.length !== 6) {
            setPinError('Please enter 6-digit PIN');
            return;
        }

        setLoading(true);
        setPinError('');

        const result = await verifyPIN(pin);

        if (result.success && result.match) {
            // PIN verified, stop everything
            if (timerRef.current) clearInterval(timerRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);

            Alert.alert(
                '✅ Safety Confirmed',
                'Your presence has been verified. SOS has been cancelled.',
                [{ text: 'OK', onPress: () => navigation.replace('MainTabs') }]
            );
        } else {
            setPinError('Incorrect PIN. Try again.');
            setPin('');
        }

        setLoading(false);
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const renderPINCircles = () => {
        const circles = [];
        for (let i = 0; i < 6; i++) {
            circles.push(
                <View
                    key={i}
                    style={[
                        styles.pinCircle,
                        i < pin.length && styles.pinCircleFilled
                    ]}
                />
            );
        }
        return circles;
    };

    const handleNumberPress = (number) => {
        if (pinError) setPinError('');

        if (pin.length < 6) {
            const newPin = pin + number;
            setPin(newPin);

            if (newPin.length === 6) {
                handlePINSubmit();
            }
        }
    };

    const handleBackspace = () => {
        setPin(pin.slice(0, -1));
    };

    if (showPIN) {
        return (
            <GradientBackground colors={GRADIENTS.danger}>
                <View style={styles.container}>
                    <View style={styles.warningHeader}>
                        <Ionicons name="warning" size={60} color={COLORS.white} />
                        <Text style={styles.warningTitle}>Confirm Your Safety</Text>
                        <Text style={styles.warningSubtitle}>
                            Enter your 6-digit PIN to confirm you're safe and stop the SOS alert.
                        </Text>
                    </View>

                    <View style={styles.timerDisplay}>
                        <Text style={styles.timerText}>{formatTime(recordingTime)}</Text>
                        <Text style={styles.timerLabel}>Recording Duration</Text>
                    </View>

                    {pinError ? (
                        <View style={styles.errorContainer}>
                            <Ionicons name="alert-circle" size={20} color={COLORS.white} />
                            <Text style={styles.errorText}>{pinError}</Text>
                        </View>
                    ) : null}

                    <View style={styles.pinContainer}>
                        {renderPINCircles()}
                    </View>

                    <View style={styles.numberPad}>
                        {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['', '0', 'back']].map((row, rowIndex) => (
                            <View key={rowIndex} style={styles.numberRow}>
                                {row.map((item, index) => {
                                    if (item === '') return <View key={index} style={styles.numberButton} />;
                                    if (item === 'back') {
                                        return (
                                            <TouchableOpacity key={index} style={styles.numberButton} onPress={handleBackspace}>
                                                <Ionicons name="backspace" size={24} color={COLORS.white} />
                                            </TouchableOpacity>
                                        );
                                    }
                                    return (
                                        <TouchableOpacity key={index} style={styles.numberButton} onPress={() => handleNumberPress(item)}>
                                            <Text style={styles.numberText}>{item}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        ))}
                    </View>

                    {loading && (
                        <ActivityIndicator size="large" color={COLORS.white} style={styles.loader} />
                    )}
                </View>
            </GradientBackground>
        );
    }

    return (
        <GradientBackground colors={GRADIENTS.danger}>
            <View style={styles.container}>
                <View style={styles.recordingHeader}>
                    <View style={styles.recordingIndicator}>
                        <View style={styles.recordingDot} />
                        <Text style={styles.recordingText}>RECORDING</Text>
                    </View>
                    <Text style={styles.timerDisplayLarge}>{formatTime(recordingTime)}</Text>
                </View>

                <View style={styles.recordingContent}>
                    <Ionicons name="videocam" size={80} color={COLORS.white} />
                    <Text style={styles.recordingTitle}>SOS Active</Text>
                    <Text style={styles.recordingSubtitle}>
                        Recording evidence and sending alerts to your emergency contacts.
                    </Text>

                    <View style={styles.voiceCommandBox}>
                        <Ionicons name="mic" size={24} color={COLORS.white} />
                        <Text style={styles.voiceCommandText}>Say "Stop" to end recording</Text>
                    </View>

                    <Text style={styles.countdownText}>PIN required in 30 seconds</Text>
                </View>

                <TouchableOpacity
                    style={styles.stopButton}
                    onPress={handleStopRecording}
                >
                    <Ionicons name="stop" size={32} color={COLORS.white} />
                    <Text style={styles.stopButtonText}>Stop Recording</Text>
                </TouchableOpacity>
            </View>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
    warningHeader: { alignItems: 'center', marginBottom: SPACING.xl },
    warningTitle: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.white, marginTop: SPACING.md },
    warningSubtitle: { fontSize: FONT_SIZES.md, color: COLORS.white + '80', textAlign: 'center', marginTop: 8, paddingHorizontal: SPACING.xl },
    recordingHeader: { alignItems: 'center', marginBottom: SPACING.xxl },
    recordingIndicator: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
    recordingDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.danger, marginRight: 8 },
    recordingText: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.danger },
    timerDisplay: { alignItems: 'center', marginBottom: SPACING.xl },
    timerDisplayLarge: { fontSize: 64, fontWeight: 'bold', color: COLORS.white },
    timerText: { fontSize: 48, fontWeight: 'bold', color: COLORS.white },
    timerLabel: { fontSize: FONT_SIZES.sm, color: COLORS.white + '80', marginTop: 4 },
    recordingContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    recordingTitle: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.white, marginTop: SPACING.lg },
    recordingSubtitle: { fontSize: FONT_SIZES.md, color: COLORS.white + '80', textAlign: 'center', marginTop: 8, paddingHorizontal: SPACING.xl },
    voiceCommandBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white + '20', padding: SPACING.md, borderRadius: 12, marginTop: SPACING.xl },
    voiceCommandText: { fontSize: FONT_SIZES.md, color: COLORS.white, marginLeft: 8 },
    countdownText: { fontSize: FONT_SIZES.sm, color: COLORS.white + '60', marginTop: SPACING.xl },
    stopButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white + '20', padding: SPACING.lg, borderRadius: 16, marginBottom: SPACING.xl },
    stopButtonText: { fontSize: FONT_SIZES.lg, fontWeight: '600', color: COLORS.white, marginLeft: 12 },
    errorContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
    errorText: { color: COLORS.white, marginLeft: 8, fontSize: FONT_SIZES.sm },
    pinContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: SPACING.xl },
    pinCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.white + '50', marginHorizontal: 8 },
    pinCircleFilled: { backgroundColor: COLORS.white, borderColor: COLORS.white },
    numberPad: { width: '100%', maxWidth: 280 },
    numberRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    numberButton: { width: 70, height: 70, borderRadius: 35, backgroundColor: COLORS.white + '20', alignItems: 'center', justifyContent: 'center' },
    numberText: { fontSize: 28, fontWeight: '600', color: COLORS.white },
    loader: { marginTop: SPACING.lg },
});

export default SOSRecordingScreen;