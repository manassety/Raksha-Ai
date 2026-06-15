import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView, Dimensions, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import GradientBackground from '../components/GradientBackground';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';
import { getAuth } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const PINSetupScreen = () => {
    const navigation = useNavigation();
    const [createdPin, setCreatedPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
        }).start();
    }, [step]);

    const handleNumberPress = (num) => {
        const pin = step === 1 ? createdPin : confirmPin;
        if (pin.length < 6) {
            if (step === 1) setCreatedPin(prev => prev + num);
            else setConfirmPin(prev => prev + num);
        }
    };

    const handleDelete = () => {
        if (step === 1) setCreatedPin(prev => prev.slice(0, -1));
        else setConfirmPin(prev => prev.slice(0, -1));
    };

    const savePIN = async () => {
        setLoading(true);
        try {
            const auth = getAuth();
            const user = auth.currentUser;
            if (!user) {
                Alert.alert("Error", "User not logged in.");
                return;
            }

            const userDocRef = doc(db, 'users', user.uid);
            await setDoc(userDocRef, {
                safetyPIN: createdPin,
                appLockEnabled: true,
                updatedAt: new Date().toISOString(),
            }, { merge: true });

            await SecureStore.setItemAsync('appPIN', createdPin);
            await SecureStore.setItemAsync('appLockEnabled', 'true');

            Alert.alert("Success", "Security PIN registered.", [
                { text: "Continue", onPress: () => navigation.replace('MainTabs') }
            ]);
        } catch (err) {
            Alert.alert("Error", "Failed to secure PIN.");
        } finally {
            setLoading(false);
        }
    };

    const handleNext = () => {
        if (step === 1) {
            if (createdPin.length !== 6) return;
            setStep(2);
        } else {
            if (createdPin !== confirmPin) {
                Alert.alert("Error", "PINs mismatch.");
                setConfirmPin('');
                return;
            }
            savePIN();
        }
    };

    const currentPin = step === 1 ? createdPin : confirmPin;

    const NumberButton = ({ val, onPress }) => {
        const scale = useRef(new Animated.Value(1)).current;
        
        const handlePressIn = () => {
            Animated.spring(scale, { toValue: 0.85, useNativeDriver: true }).start();
        };
        const handlePressOut = () => {
            Animated.spring(scale, { toValue: 1, friction: 5, tension: 40, useNativeDriver: true }).start();
        };

        if (val === null) return <View style={styles.buttonWrapper} />;

        return (
            <TouchableOpacity
                activeOpacity={0.8}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={() => onPress(val)}
                style={styles.buttonWrapper}
                disabled={loading}
            >
                <Animated.View style={[styles.numberButton, { transform: [{ scale }] }]}>
                    {val === 'del' ? (
                        <Ionicons name="backspace-outline" size={28} color={COLORS.white} />
                    ) : (
                        <Text style={styles.numberText}>{val}</Text>
                    )}
                </Animated.View>
            </TouchableOpacity>
        );
    };

    return (
        <GradientBackground colors={GRADIENTS.dark}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => step === 2 ? setStep(1) : (navigation.canGoBack() ? navigation.goBack() : navigation.replace('MainTabs'))}
                >
                    <Ionicons name="arrow-back" size={26} color={COLORS.white} />
                </TouchableOpacity>

                <Animated.View style={[styles.titleContainer, { opacity: fadeAnim }]}>
                    <View style={styles.lockIconOuter}>
                        <View style={styles.lockIcon}>
                            <Ionicons name="key" size={30} color={COLORS.primary} />
                        </View>
                    </View>
                    <Text style={styles.title}>{step === 1 ? "Create Safety PIN" : "Confirm Safety PIN"}</Text>
                    <Text style={styles.subtitle}>
                        {step === 1 ? "Set a 6-digit PIN to secure your app." : "Re-enter the PIN to verify."}
                    </Text>
                </Animated.View>

                <View style={styles.pinDotsContainer}>
                    {[0, 1, 2, 3, 4, 5].map(i => (
                        <View key={i} style={[styles.pinDot, i < currentPin.length && styles.pinDotFilled]} />
                    ))}
                </View>

                <View style={styles.keypadContainer}>
                    {/* Explicit 3-column / 4-row layout */}
                    <View style={styles.numberRow}>
                        {["1", "2", "3"].map(n => <NumberButton key={n} val={n} onPress={handleNumberPress} />)}
                    </View>
                    <View style={styles.numberRow}>
                        {["4", "5", "6"].map(n => <NumberButton key={n} val={n} onPress={handleNumberPress} />)}
                    </View>
                    <View style={styles.numberRow}>
                        {["7", "8", "9"].map(n => <NumberButton key={n} val={n} onPress={handleNumberPress} />)}
                    </View>
                    <View style={styles.numberRow}>
                        <NumberButton val={null} />
                        <NumberButton val="0" onPress={handleNumberPress} />
                        <NumberButton val="del" onPress={handleDelete} />
                    </View>
                </View>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.nextButton, currentPin.length !== 6 && styles.nextButtonDisabled]}
                        onPress={handleNext}
                        disabled={currentPin.length !== 6 || loading}
                    >
                        {loading ? <ActivityIndicator color={COLORS.white} /> : (
                            <Text style={styles.nextButtonText}>{step === 1 ? "Next" : "Save PIN"}</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </GradientBackground>
    );
};

const { width } = Dimensions.get('window');
const buttonSize = width * 0.22;

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl, flexGrow: 1, justifyContent: 'center' },
    backButton: { position: 'absolute', top: SPACING.xl, left: 0, zIndex: 10, padding: 10 },
    
    titleContainer: { alignItems: "center", marginTop: 40, marginBottom: 30 },
    lockIconOuter: { padding: 4, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 15 },
    lockIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center", elevation: 5 },
    title: { fontSize: FONT_SIZES.xxl, fontWeight: "bold", color: COLORS.white, marginBottom: 8 },
    subtitle: { fontSize: FONT_SIZES.sm, color: COLORS.white + "80", textAlign: "center", paddingHorizontal: 30 },
    
    pinDotsContainer: { flexDirection: "row", justifyContent: "center", marginBottom: 40 },
    pinDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: COLORS.white + "30", marginHorizontal: 8 },
    pinDotFilled: { backgroundColor: COLORS.white, borderColor: COLORS.white },
    
    keypadContainer: { paddingHorizontal: 15 },
    numberRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    buttonWrapper: { width: buttonSize, height: buttonSize },
    numberButton: { 
        width: '100%', 
        height: '100%', 
        borderRadius: buttonSize / 2, 
        backgroundColor: "rgba(255,255,255,0.1)", 
        alignItems: "center", 
        justifyContent: "center",
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)'
    },
    numberText: { fontSize: 30, fontWeight: "300", color: COLORS.white },
    
    footer: { marginTop: 30, paddingHorizontal: 10 },
    nextButton: { 
        backgroundColor: '#4361ee', 
        height: 60, 
        borderRadius: 30, 
        justifyContent: 'center', 
        alignItems: 'center',
        elevation: 5,
    },
    nextButtonDisabled: { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
    nextButtonText: { color: COLORS.white, fontSize: 18, fontWeight: "bold" }
});

export default PINSetupScreen;