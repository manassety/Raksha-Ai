import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import GradientBackground from '../components/GradientBackground';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const SafetyPINScreen = () => {
    const navigation = useNavigation();
    const { user } = useAuth();

    const [safetyPIN, setSafetyPIN] = useState('');
    const [confirmPIN, setConfirmPIN] = useState('');
    const [currentPIN, setCurrentPIN] = useState('');
    const [mode, setMode] = useState('create'); // create, verify, change
    const [loading, setLoading] = useState(false);
    const [savedPIN, setSavedPIN] = useState(null);

    useEffect(() => {
        loadSavedPIN();
    }, [user]);

    const loadSavedPIN = async () => {
        if (!user) return;

        try {
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                const data = userDoc.data();
                if (data.safetyPIN) {
                    setSavedPIN(data.safetyPIN);
                    setMode('verify');
                } else {
                    setMode('create');
                }
            } else {
                setMode('create');
            }
        } catch (error) {
            console.error('Error loading safety PIN:', error);
            setMode('create');
        }
    };

    const handleNumberPress = (num, target) => {
        if (target === 'current') {
            if (currentPIN.length < 6) {
                const newPIN = currentPIN + num;
                setCurrentPIN(newPIN);
                if (newPIN.length >= 4) {
                    setTimeout(() => verifyCurrentPIN(newPIN), 300);
                }
            }
        } else if (target === 'new') {
            if (safetyPIN.length < 6) {
                const newPIN = safetyPIN + num;
                setSafetyPIN(newPIN);
            }
        } else if (target === 'confirm') {
            if (confirmPIN.length < 6) {
                const newPIN = confirmPIN + num;
                setConfirmPIN(newPIN);
                if (newPIN.length >= 4 && newPIN.length === safetyPIN.length) {
                    setTimeout(() => handleSavePIN(newPIN), 300);
                }
            }
        }
    };

    const handleDelete = (target) => {
        if (target === 'current') {
            setCurrentPIN(currentPIN.slice(0, -1));
        } else if (target === 'new') {
            setSafetyPIN(safetyPIN.slice(0, -1));
        } else if (target === 'confirm') {
            setConfirmPIN(confirmPIN.slice(0, -1));
        }
    };

    const verifyCurrentPIN = async (enteredPIN) => {
        if (enteredPIN === savedPIN) {
            setMode('change');
            setCurrentPIN('');
        } else {
            Alert.alert('Wrong PIN', 'The PIN you entered is incorrect.');
            setCurrentPIN('');
        }
    };

    const handleSavePIN = async (enteredConfirmPIN) => {
        if (safetyPIN !== enteredConfirmPIN) {
            Alert.alert('PINs do not match', 'Please try again.');
            setSafetyPIN('');
            setConfirmPIN('');
            return;
        }

        if (safetyPIN.length < 4) {
            Alert.alert('PIN too short', 'PIN must be at least 4 digits.');
            return;
        }

        setLoading(true);
        try {
            const userDocRef = doc(db, 'users', user.uid);
            await setDoc(userDocRef, {
                safetyPIN: safetyPIN,
                safetyPINUpdatedAt: new Date().toISOString(),
            }, { merge: true });

            setSavedPIN(safetyPIN);
            Alert.alert('Success', 'Safety PIN has been saved to your account!');
            setMode('verify');
            setSafetyPIN('');
            setConfirmPIN('');
        } catch (error) {
            console.error('Error saving safety PIN:', error);
            Alert.alert('Error', 'Failed to save Safety PIN. Please try again.');
        }
        setLoading(false);
    };

    const handleRemovePIN = async () => {
        Alert.alert(
            'Remove Safety PIN',
            'Are you sure you want to remove your Safety PIN?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const userDocRef = doc(db, 'users', user.uid);
                            await setDoc(userDocRef, {
                                safetyPIN: null,
                                safetyPINUpdatedAt: new Date().toISOString(),
                            }, { merge: true });

                            setSavedPIN(null);
                            setMode('create');
                            Alert.alert('Success', 'Safety PIN has been removed.');
                        } catch (error) {
                            console.error('Error removing safety PIN:', error);
                            Alert.alert('Error', 'Failed to remove Safety PIN.');
                        }
                        setLoading(false);
                    },
                },
            ]
        );
    };

    const renderPinDots = (pin) => {
        const dots = [];
        for (let i = 0; i < 6; i++) {
            dots.push(
                <View
                    key={i}
                    style={[styles.pinDot, i < pin.length && styles.pinDotFilled]}
                />
            );
        }
        return dots;
    };

    const renderNumberPad = (target, currentPinValue) => {
        const numbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

        return (
            <View style={styles.numberPad}>
                {numbers.map((num, index) => (
                    <TouchableOpacity
                        key={index}
                        style={[styles.numberButton, num === '' && styles.numberButtonEmpty]}
                        onPress={() => {
                            if (num === 'del') {
                                handleDelete(target);
                            } else if (num !== '') {
                                handleNumberPress(num, target);
                            }
                        }}
                        disabled={num === '' || loading}
                        activeOpacity={0.6}
                    >
                        {num === 'del' ? (
                            <Ionicons name="backspace" size={28} color={COLORS.white} />
                        ) : (
                            <Text style={styles.numberText}>{num}</Text>
                        )}
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    const renderCreateMode = () => (
        <View style={styles.modeContainer}>
            <Text style={styles.modeTitle}>Create Safety PIN</Text>
            <Text style={styles.modeSubtitle}>
                This PIN will be used for emergency situations
            </Text>

            <Text style={styles.inputLabel}>Enter new PIN (4-6 digits)</Text>
            <View style={styles.pinDotsContainer}>
                {renderPinDots(safetyPIN)}
            </View>
            {renderNumberPad('new', safetyPIN)}

            {safetyPIN.length >= 4 && (
                <>
                    <Text style={styles.inputLabel}>Confirm PIN</Text>
                    <View style={styles.pinDotsContainer}>
                        {renderPinDots(confirmPIN)}
                    </View>
                    {renderNumberPad('confirm', confirmPIN)}
                </>
            )}
        </View>
    );

    const renderVerifyMode = () => (
        <View style={styles.modeContainer}>
            <View style={styles.pinStatusIcon}>
                <Ionicons name="checkmark-circle" size={60} color={COLORS.success} />
            </View>
            <Text style={styles.modeTitle}>Safety PIN Active</Text>
            <Text style={styles.modeSubtitle}>
                Your Safety PIN is saved in your account
            </Text>

            <View style={styles.pinDisplay}>
                <Text style={styles.pinLabel}>Your PIN</Text>
                <View style={styles.pinDotsRow}>
                    {renderPinDots(savedPIN)}
                </View>
            </View>

            <TouchableOpacity
                style={styles.changeButton}
                onPress={() => setMode('verifyCurrent')}
            >
                <Ionicons name="create" size={20} color={COLORS.primary} />
                <Text style={styles.changeButtonText}>Change PIN</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.removeButton}
                onPress={handleRemovePIN}
            >
                <Ionicons name="trash" size={20} color={COLORS.danger} />
                <Text style={styles.removeButtonText}>Remove PIN</Text>
            </TouchableOpacity>
        </View>
    );

    const renderVerifyCurrentMode = () => (
        <View style={styles.modeContainer}>
            <Text style={styles.modeTitle}>Verify Current PIN</Text>
            <Text style={styles.modeSubtitle}>
                Enter your current PIN to make changes
            </Text>

            <Text style={styles.inputLabel}>Enter current PIN</Text>
            <View style={styles.pinDotsContainer}>
                {renderPinDots(currentPIN)}
            </View>
            {renderNumberPad('current', currentPIN)}

            <TouchableOpacity
                style={styles.cancelModeButton}
                onPress={() => {
                    setMode('verify');
                    setCurrentPIN('');
                }}
            >
                <Text style={styles.cancelModeButtonText}>Cancel</Text>
            </TouchableOpacity>
        </View>
    );

    const renderChangeMode = () => (
        <View style={styles.modeContainer}>
            <Text style={styles.modeTitle}>Change Safety PIN</Text>
            <Text style={styles.modeSubtitle}>
                Create a new Safety PIN
            </Text>

            <Text style={styles.inputLabel}>Enter new PIN (4-6 digits)</Text>
            <View style={styles.pinDotsContainer}>
                {renderPinDots(safetyPIN)}
            </View>
            {renderNumberPad('new', safetyPIN)}

            {safetyPIN.length >= 4 && (
                <>
                    <Text style={styles.inputLabel}>Confirm new PIN</Text>
                    <View style={styles.pinDotsContainer}>
                        {renderPinDots(confirmPIN)}
                    </View>
                    {renderNumberPad('confirm', confirmPIN)}
                </>
            )}
        </View>
    );

    return (
        <GradientBackground colors={GRADIENTS.dark}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Safety PIN</Text>
                    <View style={{ width: 24 }} />
                </View>

                <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                    {/* Mode Icons */}
                    <View style={styles.iconContainer}>
                        <View style={styles.iconCircle}>
                            <Ionicons name="key" size={40} color={COLORS.primary} />
                        </View>
                    </View>

                    {/* Mode Content */}
                    {mode === 'create' && renderCreateMode()}
                    {mode === 'verify' && renderVerifyMode()}
                    {mode === 'verifyCurrent' && renderVerifyCurrentMode()}
                    {mode === 'change' && renderChangeMode()}
                </ScrollView>
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
        paddingTop: SPACING.xl,
        paddingBottom: SPACING.md,
    },
    headerTitle: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.white },
    scrollView: { flex: 1 },
    scrollContent: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
    modeContainer: { alignItems: 'center' },
    modeTitle: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.white, marginBottom: 8 },
    modeSubtitle: { fontSize: FONT_SIZES.sm, color: COLORS.white + '80', textAlign: 'center', marginBottom: 30 },
    iconContainer: { alignItems: 'center', marginBottom: 20 },
    iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
    inputLabel: { fontSize: FONT_SIZES.md, color: COLORS.white, marginBottom: 15, marginTop: 10 },
    pinDotsContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 20 },
    pinDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: COLORS.white + '50', marginHorizontal: 6 },
    pinDotFilled: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    numberPad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
    numberButton: { width: 70, height: 70, borderRadius: 35, backgroundColor: COLORS.white + '10', alignItems: 'center', justifyContent: 'center', margin: 8 },
    numberButtonEmpty: { backgroundColor: 'transparent' },
    numberText: { fontSize: 28, fontWeight: '600', color: COLORS.white },
    pinStatusIcon: { marginBottom: 20 },
    pinDisplay: { backgroundColor: COLORS.white + '10', borderRadius: 16, padding: 20, alignItems: 'center', width: '100%', marginBottom: 20 },
    pinLabel: { fontSize: FONT_SIZES.sm, color: COLORS.white + '80', marginBottom: 10 },
    pinDotsRow: { flexDirection: 'row', justifyContent: 'center' },
    changeButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white + '10', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 25, marginBottom: 12 },
    changeButtonText: { color: COLORS.primary, fontSize: FONT_SIZES.md, fontWeight: '600', marginLeft: 8 },
    removeButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 24 },
    removeButtonText: { color: COLORS.danger, fontSize: FONT_SIZES.md },
    cancelModeButton: { marginTop: 20, paddingVertical: 12, paddingHorizontal: 24 },
    cancelModeButtonText: { color: COLORS.white + '80', fontSize: FONT_SIZES.md },
});

export default SafetyPINScreen;