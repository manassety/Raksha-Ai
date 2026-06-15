import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import GradientBackground from '../components/GradientBackground';
import GradientButton from '../components/GradientButton';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';
import { getAuth } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const PINSetupScreen = () => {
    const navigation = useNavigation();
    const [confirmPin, setConfirmPin] = useState('');
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Store PIN in a regular variable (not state) for Step 1
    let createdPin = '';
    const createdPinRef = useRef('');

    const handleNumberPress = (num) => {
        if (step === 1) {
            if (createdPin.length < 6) {
                createdPin = createdPin + num;
                createdPinRef.current = createdPin;
            }
        } else if (step === 2 && confirmPin.length < 6) {
            setConfirmPin(prev => prev + num);
        }
    };

    const handleDelete = () => {
        if (step === 1) {
            createdPin = createdPin.slice(0, -1);
            createdPinRef.current = createdPin;
        } else {
            setConfirmPin(prev => prev.slice(0, -1));
        }
    };

    const savePIN = async () => {
        setLoading(true);
        try {
            const auth = getAuth();
            const user = auth.currentUser;

            if (!user) {
                Alert.alert("Error", "User not logged in.");
                setLoading(false);
                return;
            }

            // Save to Firebase Firestore
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);

            await setDoc(userDocRef, {
                safetyPIN: createdPinRef.current,
                appLockEnabled: true,
                createdAt: userDoc.exists() ? userDoc.data().createdAt : new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                ...(userDoc.exists() ? userDoc.data() : {})
            }, { merge: true });

            // Also save to SecureStore
            await SecureStore.setItemAsync('appPIN', createdPinRef.current);
            await SecureStore.setItemAsync('appLockEnabled', 'true');

            Alert.alert("Success", "PIN set successfully!", [
                {
                    text: "OK",
                    onPress: () => {
                        navigation.replace('MainTabs');
                    }
                }
            ]);
        } catch (err) {
            console.error("Error saving PIN:", err);
            Alert.alert("Error", "Failed to update PIN. Please try again.");
        }
        setLoading(false);
    };

    const handleNext = () => {
        if (step === 1) {
            if (createdPin.length !== 6) {
                Alert.alert("Error", "PIN must be 6 digits.");
                return;
            }
            setStep(2);
        } else {
            // Compare the stored PIN with confirmPin
            console.log("Created PIN:", createdPinRef.current);
            console.log("Confirm PIN:", confirmPin);
            console.log("Match:", createdPinRef.current === confirmPin);

            if (createdPinRef.current !== confirmPin) {
                Alert.alert("Error", "PINs do not match. Please try again.");
                setConfirmPin('');
                return;
            }
            savePIN();
        }
    };

    const currentPin = step === 1 ? createdPin : confirmPin;

    return (
        <GradientBackground colors={GRADIENTS.dark}>
            <View style={styles.container}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                </TouchableOpacity>

                <View style={styles.titleContainer}>
                    <View style={styles.lockIcon}>
                        <Ionicons name="key" size={30} color={COLORS.primary} />
                    </View>
                    <Text style={styles.title}>
                        {step === 1 ? "Create New PIN" : "Confirm New PIN"}
                    </Text>
                    <Text style={styles.subtitle}>
                        {step === 1 ? "Enter a 6-digit PIN" : "Re-enter your PIN"}
                    </Text>
                </View>

                <View style={styles.pinDotsContainer}>
                    {[0, 1, 2, 3, 4, 5].map(i => (
                        <View key={i} style={[styles.pinDot, i < currentPin.length && styles.pinDotFilled]} />
                    ))}
                </View>

                <View style={styles.numberPad}>
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((num, i) => (
                        <TouchableOpacity
                            key={i}
                            style={[styles.numberButton, num === "" && styles.numberButtonEmpty]}
                            onPress={() => num === "del" ? handleDelete() : handleNumberPress(num)}
                            disabled={num === "" || loading}
                        >
                            {num === "del" ? (
                                <Ionicons name="backspace" size={28} color={COLORS.white} />
                            ) : (
                                <Text style={styles.numberText}>{num}</Text>
                            )}
                        </TouchableOpacity>
                    ))}
                </View>

                <GradientButton
                    title={step === 1 ? "Next" : "Save PIN"}
                    onPress={handleNext}
                    colors={GRADIENTS.primary}
                    loading={loading}
                    style={styles.nextButton}
                    disabled={currentPin.length !== 6 || loading}
                />
            </View>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, paddingHorizontal: SPACING.lg },
    backButton: { marginTop: SPACING.xl, marginBottom: SPACING.md },
    titleContainer: { alignItems: "center", marginBottom: 40 },
    lockIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center", marginBottom: 15 },
    title: { fontSize: FONT_SIZES.xxl, fontWeight: "bold", color: COLORS.white, marginBottom: 8 },
    subtitle: { fontSize: FONT_SIZES.md, color: COLORS.white + "80", textAlign: "center" },
    pinDotsContainer: { flexDirection: "row", justifyContent: "center", marginBottom: 40 },
    pinDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: COLORS.white + "50", marginHorizontal: 8 },
    pinDotFilled: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    numberPad: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginBottom: 30 },
    numberButton: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.white + "10", alignItems: "center", justifyContent: "center", margin: 10 },
    numberButtonEmpty: { backgroundColor: "transparent" },
    numberText: { fontSize: 32, fontWeight: "600", color: COLORS.white },
    nextButton: { marginTop: 10 }
});

export default PINSetupScreen;