import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, StatusBar, Modal, ActivityIndicator, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as LocalAuthentication from 'expo-local-authentication';
import { sendPasswordResetEmail } from 'firebase/auth';
import GradientBackground from '../components/GradientBackground';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { auth } from '../config/firebase';

const AppLockScreen = () => {
    const navigation = useNavigation();
    const { user, logout } = useAuth();

    const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
    const [biometricType, setBiometricType] = useState(null);
    const [loading, setLoading] = useState(false);
    const [attempts, setAttempts] = useState(0);
    const [locked, setLocked] = useState(false);
    const [showPinPad, setShowPinPad] = useState(false);
    const [enteredPin, setEnteredPin] = useState('');
    const [appLockEnabled, setAppLockEnabled] = useState(false);
    const [hasPIN, setHasPIN] = useState(false); // Track if PIN is actually set
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [emailError, setEmailError] = useState('');
    const [resetLoading, setResetLoading] = useState(false);

    useEffect(() => {
        checkBiometricAvailability();
        checkAppLockPreference();
    }, []);

    const checkAppLockPreference = async () => {
        try {
            if (!user) {
                // If no user, the navigator will automatically switch to Login stack
                return;
            }

            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                const data = userDoc.data();
                const pinExists = !!(data.safetyPIN || data.safetyPin || data.pin);
                const lockSetting = data.appLockEnabled !== false;

                setHasPIN(pinExists);
                setAppLockEnabled(lockSetting && pinExists);

                // CRITICAL: If no PIN or lock disabled, bypass lock screen
                if (!appLockEnabled) {
                    setTimeout(() => {
                        navigation.replace('MainTabs');
                    }, 500);
                }
            } else {
                setAppLockEnabled(false);
                setHasPIN(false);
                // Force logout to trigger navigator shift
                await logout();
            }
        } catch (error) {
            console.log("Error checking app lock preference:", error);
            setAppLockEnabled(false);
            setHasPIN(false);
            // If something is seriously wrong, logout
            await logout();
        }
    };

    const checkBiometricAvailability = async () => {
        try {
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            const isEnrolled = await LocalAuthentication.isEnrolledAsync();
            const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

            setIsBiometricAvailable(hasHardware && isEnrolled);

            if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
                setBiometricType('fingerprint');
            } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
                setBiometricType('face');
            } else {
                setBiometricType('none');
            }

            // Only attempt biometric if lock is enabled AND PIN exists
            if (hasHardware && isEnrolled && appLockEnabled) {
                setTimeout(() => handleBiometricAuth(), 1000);
            }
        } catch (error) {
            console.error('Error checking biometric:', error);
            setIsBiometricAvailable(false);
        }
    };

    const handleBiometricAuth = async () => {
        if (loading || locked || !appLockEnabled) return;
        setLoading(true);
        try {
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Authenticate to access SafeHer',
                fallbackLabel: 'Use PIN',
                cancelLabel: 'Cancel',
                disableDeviceFallback: false,
            });

            if (result.success) {
                navigation.replace('MainTabs');
            } else if (result.error === 'user_cancel') {
                // User cancelled
            } else {
                setAttempts(prev => prev + 1);
                if (attempts + 1 >= 3) {
                    setLocked(true);
                    Alert.alert('Locked', 'Too many failed attempts.');
                } else {
                    Alert.alert('Failed', 'Authentication failed. Please use PIN.');
                }
            }
        } catch (error) {
            console.error('Biometric error:', error);
            Alert.alert('Error', 'Failed to authenticate. Please use PIN.');
        }
        setLoading(false);
    };

    const handleNumberPress = (num) => {
        if (enteredPin.length < 6) {
            const newPin = enteredPin + num;
            setEnteredPin(newPin);
            if (newPin.length === 6) {
                setTimeout(() => verifyPin(newPin), 300);
            }
        }
    };

    const handleDelete = () => {
        setEnteredPin(enteredPin.slice(0, -1));
    };

    const verifyPin = async (pin) => {
        setLoading(true);
        try {
            if (user && user.uid) {
                const userDocRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userDocRef);

                if (userDoc.exists()) {
                    const data = userDoc.data();
                    const savedPin = data.safetyPIN || data.safetyPin || data.pin;

                    if (pin === savedPin) {
                        navigation.replace('MainTabs');
                    } else {
                        setAttempts(prev => prev + 1);
                        setEnteredPin('');
                        if (attempts + 1 >= 3) {
                            setLocked(true);
                            Alert.alert('Locked', 'Too many failed attempts.');
                        } else {
                            Alert.alert('Wrong PIN', `${3 - attempts - 1} attempts remaining`);
                        }
                    }
                } else {
                    Alert.alert('Error', 'User data not found. Please login again.');
                }
            } else {
                Alert.alert('Error', 'Please login first.');
            }
        } catch (error) {
            console.error('Error verifying PIN:', error);
            Alert.alert('Error', 'Failed to verify PIN. Please try again.');
        }
        setLoading(false);
    };

    const handleForgotPIN = () => {
        setShowResetModal(true);
    };

    const handleResetPIN = async () => {
        if (!resetEmail) {
            setEmailError('Please enter your email');
            return;
        }

        setResetLoading(true);
        setEmailError('');

        try {
            await sendPasswordResetEmail(auth, resetEmail);

            Alert.alert(
                '📧 PIN Reset Link Sent',
                `A PIN reset link has been sent to ${resetEmail}.\n\nPlease check your email and follow the instructions to reset your Safety PIN.`,
                [
                    {
                        text: 'OK',
                        onPress: () => {
                            setShowResetModal(false);
                            setResetEmail('');
                            setEmailError('');
                        }
                    }
                ]
            );
        } catch (error) {
            console.error('Error sending reset email:', error);
            if (error.code === 'auth/user-not-found') {
                setEmailError('No account found with this email address.');
            } else if (error.code === 'auth/invalid-email') {
                setEmailError('Invalid email address format.');
            } else {
                setEmailError('Failed to send reset link. Please try again.');
            }
        }
        setResetLoading(false);
    };

    const getBiometricIcon = () => {
        switch (biometricType) {
            case 'fingerprint': return 'finger-print';
            case 'face': return 'scan';
            case 'iris': return 'eye';
            default: return 'lock-closed';
        }
    };

    const getBiometricText = () => {
        switch (biometricType) {
            case 'fingerprint': return 'Touch fingerprint sensor';
            case 'face': return 'Face recognition';
            case 'iris': return 'Scan iris';
            default: return 'Unlock';
        }
    };

    const renderPinPad = () => (
        <View style={styles.pinPadContainer}>
            <TouchableOpacity style={styles.closePadButton} onPress={() => { setShowPinPad(false); setEnteredPin(''); }}>
                <Ionicons name="close" size={24} color={COLORS.white} />
            </TouchableOpacity>

            <Text style={styles.pinPadTitle}>Enter 6-digit PIN</Text>

            <View style={styles.pinDotsContainer}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                    <View key={i} style={[styles.pinDot, i < enteredPin.length && styles.pinDotFilled]} />
                ))}
            </View>

            <View style={styles.numberPad}>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((num, index) => (
                    <TouchableOpacity
                        key={index}
                        style={[styles.numberButton, num === '' && styles.numberButtonEmpty]}
                        onPress={() => {
                            if (num === 'del') handleDelete();
                            else handleNumberPress(num);
                        }}
                        disabled={num === '' || loading}
                    >
                        {num === 'del' ? (
                            <Ionicons name="backspace" size={28} color={COLORS.white} />
                        ) : (
                            <Text style={styles.numberText}>{num}</Text>
                        )}
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );

    const renderResetModal = () => (
        <Modal
            visible={showResetModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowResetModal(false)}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Ionicons name="key-outline" size={32} color={COLORS.primary} />
                        <Text style={styles.modalTitle}>Reset Safety PIN</Text>
                    </View>

                    <Text style={styles.modalSubtitle}>
                        Enter your email address and we'll send you a link to reset your Safety PIN.
                    </Text>

                    <View style={styles.inputContainer}>
                        <Ionicons name="mail-outline" size={20} color={COLORS.gray400} />
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your email"
                            placeholderTextColor={COLORS.gray400}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            value={resetEmail}
                            onChangeText={(text) => {
                                setResetEmail(text);
                                setEmailError('');
                            }}
                        />
                    </View>

                    {emailError ? (
                        <Text style={styles.modalErrorText}>{emailError}</Text>
                    ) : null}

                    <TouchableOpacity
                        style={styles.sendButton}
                        onPress={handleResetPIN}
                        disabled={resetLoading}
                    >
                        {resetLoading ? (
                            <ActivityIndicator size="small" color={COLORS.white} />
                        ) : (
                            <>
                                <Ionicons name="mail" size={20} color={COLORS.white} />
                                <Text style={styles.sendButtonText}>Send Reset Link</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => {
                            setShowResetModal(false);
                            setResetEmail('');
                            setEmailError('');
                        }}
                    >
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );

    return (
        <GradientBackground colors={GRADIENTS.dark}>
            <StatusBar barStyle="light-content" />
            <View style={styles.container}>
                {!appLockEnabled ? (
                    <View style={styles.noLockContainer}>
                        <Ionicons name="lock-closed-outline" size={60} color={COLORS.gray400} />
                        <Text style={styles.noLockText}>App Lock is Disabled</Text>
                        <Text style={styles.noLockSubtitle}>
                            You can enable it in Settings → Security
                        </Text>
                        <TouchableOpacity
                            style={styles.goToSettingsButton}
                            onPress={() => navigation.navigate('MainTabs', { screen: 'Settings' })}
                        >
                            <Text style={styles.goToSettingsText}>Go to Settings</Text>
                        </TouchableOpacity>
                    </View>
                ) : !showPinPad ? (
                    <>
                        <View style={styles.lockContainer}>
                            <View style={styles.lockIcon}>
                                <Ionicons name="lock-closed" size={50} color={COLORS.primary} />
                            </View>
                            <Text style={styles.title}>SafeHer</Text>
                            <Text style={styles.subtitle}>App is locked</Text>
                            <Text style={styles.userEmail}>{user?.email || 'User'}</Text>
                        </View>

                        {isBiometricAvailable && !locked && (
                            <View style={styles.authContainer}>
                                <TouchableOpacity
                                    style={styles.biometricButton}
                                    onPress={handleBiometricAuth}
                                    disabled={loading}
                                >
                                    <View style={styles.biometricIcon}>
                                        <Ionicons name={getBiometricIcon()} size={40} color={COLORS.primary} />
                                    </View>
                                    <Text style={styles.biometricText}>{getBiometricText()}</Text>
                                </TouchableOpacity>
                                {loading && <Text style={styles.loadingText}>Authenticating...</Text>}
                                <Text style={styles.orText}>or</Text>
                            </View>
                        )}

                        <TouchableOpacity
                            style={styles.pinButton}
                            onPress={() => setShowPinPad(true)}
                            disabled={locked}
                        >
                            <Ionicons name="keypad" size={24} color={COLORS.white} />
                            <Text style={styles.pinButtonText}>Use 6-digit PIN</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.forgotButton}
                            onPress={handleForgotPIN}
                            disabled={locked}
                        >
                            <Text style={styles.forgotButtonText}>Forgot PIN?</Text>
                        </TouchableOpacity>

                        {attempts > 0 && !locked && (
                            <Text style={styles.attemptsText}>{3 - attempts} attempts remaining</Text>
                        )}

                        {locked && (
                            <View style={styles.lockedContainer}>
                                <Ionicons name="warning" size={24} color={COLORS.danger} />
                                <Text style={styles.lockedText}>Too many failed attempts.</Text>
                            </View>
                        )}
                    </>
                ) : (
                    renderPinPad()
                )}

                {renderResetModal()}
            </View>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACING.lg },
    noLockContainer: { alignItems: 'center', padding: SPACING.xl },
    noLockText: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.white, marginTop: SPACING.md },
    noLockSubtitle: { fontSize: FONT_SIZES.md, color: COLORS.white + '80', textAlign: 'center', marginTop: SPACING.sm },
    goToSettingsButton: {
        marginTop: SPACING.lg,
        backgroundColor: COLORS.primary,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 25,
    },
    goToSettingsText: { color: COLORS.white, fontSize: FONT_SIZES.md, fontWeight: '600' },
    lockContainer: { alignItems: 'center', marginBottom: 40 },
    lockIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    title: { fontSize: FONT_SIZES.xxxl, fontWeight: 'bold', color: COLORS.white, marginBottom: 8 },
    subtitle: { fontSize: FONT_SIZES.md, color: COLORS.white + '80' },
    userEmail: { fontSize: FONT_SIZES.sm, color: COLORS.primary, marginTop: 8 },
    authContainer: { alignItems: 'center', width: '100%', marginBottom: 20 },
    biometricButton: { alignItems: 'center', padding: 20 },
    biometricIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    biometricText: { fontSize: FONT_SIZES.md, color: COLORS.white, fontWeight: '500' },
    loadingText: { fontSize: FONT_SIZES.sm, color: COLORS.white + '60', marginTop: 8 },
    orText: { fontSize: FONT_SIZES.sm, color: COLORS.white + '60', marginVertical: 20 },
    pinButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: 30, paddingVertical: 15, borderRadius: 30, marginTop: 20 },
    pinButtonText: { color: COLORS.white, fontSize: FONT_SIZES.md, fontWeight: '600', marginLeft: 10 },
    forgotButton: {
        marginTop: SPACING.md,
        paddingVertical: 12,
    },
    forgotButtonText: { color: COLORS.primary, fontSize: FONT_SIZES.md, fontWeight: '500', textAlign: 'center' },
    attemptsText: { color: COLORS.warning, fontSize: FONT_SIZES.sm, marginTop: 20 },
    lockedContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.danger + '20', padding: 15, borderRadius: 12, marginTop: 20 },
    lockedText: { color: COLORS.danger, fontSize: FONT_SIZES.sm, marginLeft: 10 },
    pinPadContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%', paddingTop: SPACING.xl },
    closePadButton: { position: 'absolute', top: SPACING.xl, right: SPACING.md, padding: 10 },
    pinPadTitle: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.white, marginBottom: 30 },
    pinDotsContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 15 },
    pinDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: COLORS.white + '50', marginHorizontal: 8 },
    pinDotFilled: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    numberPad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
    numberButton: { width: 75, height: 75, borderRadius: 37.5, backgroundColor: COLORS.white + '10', alignItems: 'center', justifyContent: 'center', margin: 8 },
    numberButtonEmpty: { backgroundColor: 'transparent' },
    numberText: { fontSize: 30, fontWeight: '600', color: COLORS.white },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
    modalContent: { backgroundColor: COLORS.white, borderRadius: 24, padding: SPACING.xl, alignItems: 'center', width: '100%', maxWidth: 400 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
    modalTitle: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.gray800, marginLeft: 10 },
    modalSubtitle: { fontSize: FONT_SIZES.md, color: COLORS.gray600, textAlign: 'center', marginBottom: SPACING.lg },
    inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.gray100, borderRadius: 12, paddingHorizontal: 16, marginBottom: SPACING.md, width: '100%' },
    input: { flex: 1, paddingVertical: 12, fontSize: FONT_SIZES.md, color: COLORS.gray800, marginLeft: 10 },
    modalErrorText: { color: COLORS.danger, fontSize: FONT_SIZES.sm, marginBottom: SPACING.md, textAlign: 'center' },
    sendButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: 25, width: '100%', justifyContent: 'center', marginBottom: SPACING.md },
    sendButtonText: { color: COLORS.white, fontSize: FONT_SIZES.md, fontWeight: '600', marginLeft: 8 },
    cancelButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderRadius: 25, width: '100%', justifyContent: 'center' },
    cancelButtonText: { color: COLORS.gray500, fontSize: FONT_SIZES.md, fontWeight: '600' },
});

export default AppLockScreen;