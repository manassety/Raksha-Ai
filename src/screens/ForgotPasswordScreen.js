import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import GradientBackground from '../components/GradientBackground';
import GradientButton from '../components/GradientButton';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';
import { resetPassword } from '../services/AuthService';

const ForgotPasswordScreen = () => {
    const navigation = useNavigation();
    const [email, setEmail] = useState('');
    const [emailError, setEmailError] = useState('');
    const [loading, setLoading] = useState(false);
    const [emailSent, setEmailSent] = useState(false);

    const validateEmail = (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    };

    const handleResetPassword = async () => {
        setEmailError('');

        if (!email) {
            setEmailError('Email is required');
            return;
        }
        if (!validateEmail(email)) {
            setEmailError('Please enter a valid email');
            return;
        }

        setLoading(true);

        try {
            const trimmedEmail = email.trim();
            const result = await resetPassword(trimmedEmail);

            if (result.success) {
                setEmailSent(true);
            } else {
                Alert.alert('Error', result.error);
            }
        } catch (error) {
            Alert.alert('Error', 'An unexpected error occurred');
        }

        setLoading(false);
    };

    if (emailSent) {
        return (
            <GradientBackground colors={GRADIENTS.primary}>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.successContainer}>
                        <View style={styles.successIcon}>
                            <Ionicons name="checkmark-circle-outline" size={80} color={COLORS.success} />
                        </View>
                        <Text style={styles.successTitle}>Check Your Email</Text>
                        <Text style={styles.successText}>
                            We've sent password reset instructions to {email}
                        </Text>
                        <Text style={styles.successSubtext}>
                            Please check your inbox and follow the link to reset your password.
                        </Text>
                        <GradientButton
                            title="Back to Login"
                            onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Login')}
                            colors={GRADIENTS.primary}
                            style={styles.backButton}
                        />
                    </View>
                </ScrollView>
            </GradientBackground>
        );
    }

    return (
        <GradientBackground colors={GRADIENTS.primary}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Login')}>
                        <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Forgot Password</Text>
                    <View style={{ width: 24 }} />
                </View>

                <View style={styles.formContainer}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="lock-closed-outline" size={60} color={COLORS.primary} />
                    </View>

                    <Text style={styles.title}>Reset Password</Text>
                    <Text style={styles.subtitle}>
                        Enter your email address and we'll send you instructions to reset your password.
                    </Text>

                    <View style={styles.inputContainer}>
                        <Ionicons name="mail-outline" size={20} color={COLORS.gray400} />
                        <TextInput
                            style={styles.input}
                            placeholder="Email"
                            placeholderTextColor={COLORS.gray400}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            value={email}
                            onChangeText={(text) => {
                                setEmail(text);
                                setEmailError('');
                            }}
                        />
                    </View>
                    {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

                    <GradientButton
                        title={loading ? 'Sending...' : 'Send Reset Link'}
                        onPress={handleResetPassword}
                        colors={GRADIENTS.primary}
                        style={styles.resetButton}
                        disabled={loading}
                    />

                    <TouchableOpacity style={styles.backToLogin} onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Login')}>
                        <Ionicons name="arrow-back" size={16} color={COLORS.primary} />
                        <Text style={styles.backToLoginText}> Back to Login</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    scrollContent: { flexGrow: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingTop: SPACING.xl, paddingBottom: SPACING.md },
    headerTitle: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.white },
    formContainer: { flex: 1, backgroundColor: COLORS.white, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: SPACING.lg, paddingTop: SPACING.xxl, alignItems: 'center' },
    iconContainer: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.primary + '10', alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.lg },
    title: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.gray800, marginBottom: 8 },
    subtitle: { fontSize: FONT_SIZES.md, color: COLORS.gray500, textAlign: 'center', marginBottom: SPACING.xl, lineHeight: 22 },
    inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.gray100, borderRadius: 12, paddingHorizontal: SPACING.md, width: '100%', marginBottom: 8 },
    input: { flex: 1, paddingVertical: SPACING.md, paddingHorizontal: SPACING.sm, fontSize: FONT_SIZES.md, color: COLORS.gray800 },
    errorText: { fontSize: FONT_SIZES.sm, color: COLORS.danger, alignSelf: 'flex-start', marginBottom: 8 },
    resetButton: { width: '100%', marginBottom: SPACING.lg },
    backToLogin: { flexDirection: 'row', alignItems: 'center' },
    backToLoginText: { fontSize: FONT_SIZES.md, color: COLORS.primary },
    successContainer: { flex: 1, backgroundColor: COLORS.white, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: SPACING.lg, paddingTop: SPACING.xxl, alignItems: 'center', justifyContent: 'center' },
    successIcon: { marginBottom: SPACING.lg },
    successTitle: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.gray800, marginBottom: SPACING.md },
    successText: { fontSize: FONT_SIZES.md, color: COLORS.gray700, textAlign: 'center', marginBottom: 8 },
    successSubtext: { fontSize: FONT_SIZES.sm, color: COLORS.gray500, textAlign: 'center', marginBottom: SPACING.xl },
    backButton: { width: 200 },
});

export default ForgotPasswordScreen;