import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import GradientBackground from '../components/GradientBackground';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const EmailVerificationScreen = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [resendTimer, setResendTimer] = useState(0);
    const [isVerified, setIsVerified] = useState(false);

    useEffect(() => {
        if (resendTimer > 0) {
            const timer = setInterval(() => {
                setResendTimer(prev => prev - 1);
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [resendTimer]);

    const handleOtpChange = (index, value) => {
        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        // Auto-focus next input
        if (value && index < 5) {
            // Focus next input (you can implement this with refs)
        }
    };

    const verifyOTP = async () => {
        const enteredOtp = otp.join('');

        if (enteredOtp.length !== 6) {
            Alert.alert('Error', 'Please enter the complete 6-digit OTP.');
            return;
        }

        setLoading(true);
        try {
            if (user && user.uid) {
                const userDocRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userDocRef);

                if (userDoc.exists()) {
                    const data = userDoc.data();
                    const storedOtp = data.emailVerificationOTP;
                    const otpTimestamp = data.emailVerificationOTPTimestamp;

                    // Check if OTP exists and is not expired (5 minutes)
                    if (storedOtp === enteredOtp && otpTimestamp) {
                        const otpAge = Date.now() - new Date(otpTimestamp).getTime();
                        const otpExpiry = 5 * 60 * 1000; // 5 minutes

                        if (otpAge <= otpExpiry) {
                            // OTP is valid, verify email
                            await updateDoc(userDocRef, {
                                emailVerified: true,
                                emailVerificationOTP: null,
                                emailVerificationOTPTimestamp: null,
                                emailVerifiedAt: new Date().toISOString(),
                            });

                            setIsVerified(true);
                            Alert.alert(
                                '✅ Email Verified!',
                                'Your email has been successfully verified.',
                                [
                                    {
                                        text: 'OK',
                                        onPress: () => navigation.goBack()
                                    }
                                ]
                            );
                        } else {
                            Alert.alert('OTP Expired', 'The OTP has expired. Please request a new one.');
                        }
                    } else {
                        Alert.alert('Invalid OTP', 'The OTP you entered is incorrect. Please try again.');
                    }
                } else {
                    Alert.alert('Error', 'User data not found.');
                }
            } else {
                Alert.alert('Error', 'User not logged in.');
            }
        } catch (error) {
            console.error('Error verifying OTP:', error);
            Alert.alert('Error', 'Failed to verify email. Please try again.');
        }
        setLoading(false);
    };

    const resendOTP = async () => {
        if (resendTimer > 0) return;

        setLoading(true);
        try {
            if (user && user.email) {
                // Generate random 6-digit OTP
                const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
                const otpTimestamp = new Date().toISOString();

                // Save OTP to Firestore
                const userDocRef = doc(db, 'users', user.uid);
                await updateDoc(userDocRef, {
                    emailVerificationOTP: newOtp,
                    emailVerificationOTPTimestamp: otpTimestamp,
                });

                // TODO: Send email with OTP (implement your email service)
                // For now, show OTP in alert (remove in production)
                Alert.alert(
                    '📧 OTP Sent',
                    `Your verification OTP is: ${newOtp}\n\n(This is for testing. In production, this will be sent via email.)`,
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                setResendTimer(300); // 5 minutes
                                setOtp(['', '', '', '', '', '']);
                            }
                        }
                    ]
                );
            }
        } catch (error) {
            console.error('Error resending OTP:', error);
            Alert.alert('Error', 'Failed to resend OTP. Please try again.');
        }
        setLoading(false);
    };

    if (isVerified) {
        return (
            <GradientBackground colors={GRADIENTS.dark}>
                <View style={styles.verifiedContainer}>
                    <Ionicons name="checkmark-circle" size={80} color={COLORS.success} />
                    <Text style={styles.verifiedTitle}>Email Verified!</Text>
                    <Text style={styles.verifiedSubtitle}>
                        Your email has been successfully verified.
                    </Text>
                    <TouchableOpacity
                        style={styles.doneButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Text style={styles.doneButtonText}>Done</Text>
                    </TouchableOpacity>
                </View>
            </GradientBackground>
        );
    }

    return (
        <GradientBackground colors={GRADIENTS.dark}>
            <View style={styles.container}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                </TouchableOpacity>

                <View style={styles.content}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="mail" size={50} color={COLORS.primary} />
                    </View>

                    <Text style={styles.title}>Verify Your Email</Text>
                    <Text style={styles.subtitle}>
                        Enter the 6-digit OTP sent to your email address
                    </Text>

                    <View style={styles.otpContainer}>
                        {otp.map((digit, index) => (
                            <TextInput
                                key={index}
                                style={[styles.otpInput, digit.length > 0 && styles.otpInputFilled]}
                                value={digit}
                                maxLength={1}
                                keyboardType="number-pad"
                                onChangeText={(value) => handleOtpChange(index, value)}
                                autoFocus={index === 0}
                            />
                        ))}
                    </View>

                    <TouchableOpacity
                        style={styles.verifyButton}
                        onPress={verifyOTP}
                        disabled={loading || otp.some(d => d === '')}
                    >
                        {loading ? (
                            <ActivityIndicator size="small" color={COLORS.white} />
                        ) : (
                            <>
                                <Ionicons name="checkmark-circle" size={20} color={COLORS.white} />
                                <Text style={styles.verifyButtonText}>Verify Email</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.resendButton}
                        onPress={resendOTP}
                        disabled={resendTimer > 0 || loading}
                    >
                        {resendTimer > 0 ? (
                            <Text style={styles.resendText}>
                                Resend in {resendTimer}s
                            </Text>
                        ) : (
                            <>
                                <Ionicons name="refresh" size={16} color={COLORS.primary} />
                                <Text style={styles.resendButtonText}>Resend OTP</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, paddingHorizontal: SPACING.lg },
    content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    iconContainer: { marginBottom: SPACING.xl, marginTop: SPACING.xxl },
    title: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.white, marginBottom: 8, textAlign: 'center' },
    subtitle: { fontSize: FONT_SIZES.md, color: COLORS.white + '80', textAlign: 'center', marginBottom: SPACING.xl },
    otpContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: SPACING.xl },
    otpInput: {
        width: 50,
        height: 60,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: COLORS.white + '50',
        marginHorizontal: 8,
        textAlign: 'center',
        fontSize: FONT_SIZES.xl,
        fontWeight: '600',
        color: COLORS.white,
        backgroundColor: COLORS.white + '10',
    },
    otpInputFilled: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.primary + '20',
    },
    verifyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.primary,
        paddingVertical: 16,
        paddingHorizontal: 40,
        borderRadius: 30,
        marginBottom: SPACING.md,
    },
    verifyButtonText: { color: COLORS.white, fontSize: FONT_SIZES.md, fontWeight: '600', marginLeft: 8 },
    resendButton: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.md },
    resendText: { color: COLORS.gray400, fontSize: FONT_SIZES.sm },
    resendButtonText: { color: COLORS.primary, fontSize: FONT_SIZES.sm, fontWeight: '600', marginLeft: 8 },
    verifiedContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
    verifiedTitle: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.white, marginTop: SPACING.lg, marginBottom: 8 },
    verifiedSubtitle: { fontSize: FONT_SIZES.md, color: COLORS.white + '80', textAlign: 'center', marginBottom: SPACING.xl },
    doneButton: {
        backgroundColor: COLORS.success,
        paddingHorizontal: 40,
        paddingVertical: 16,
        borderRadius: 30,
    },
    doneButtonText: { color: COLORS.white, fontSize: FONT_SIZES.md, fontWeight: '600' },
});

export default EmailVerificationScreen;