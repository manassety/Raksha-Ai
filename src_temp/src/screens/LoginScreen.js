import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import GradientBackground from '../components/GradientBackground';
import GradientButton from '../components/GradientButton';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';
import { loginUser } from '../services/AuthService';

const LoginScreen = () => {
    const navigation = useNavigation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');

    const validateEmail = (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    };

    const handleLogin = async () => {
        // Reset errors
        setEmailError('');
        setPasswordError('');

        // Validate
        if (!email) {
            setEmailError('Email is required');
            return;
        }
        if (!validateEmail(email)) {
            setEmailError('Please enter a valid email');
            return;
        }
        if (!password) {
            setPasswordError('Password is required');
            return;
        }

        setLoading(true);

        try {
            const result = await loginUser(email, password);

            if (result.success) {
                Alert.alert(
                    'Welcome Back!',
                    `Logged in successfully as ${result.user.name || result.user.email}`,
                    [{ text: 'OK' }]
                );
                // Navigation will be handled by auth state listener
            } else {
                Alert.alert('Login Failed', result.error);
            }
        } catch (error) {
            Alert.alert('Error', 'An unexpected error occurred');
        }

        setLoading(false);
    };

    const handleForgotPassword = () => {
        navigation.navigate('ForgotPassword');
    };

    return (
        <GradientBackground colors={GRADIENTS.primary}>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.logoContainer}>
                        <View style={styles.logoCircle}>
                            <Ionicons name="shield-checkmark" size={60} color={COLORS.white} />
                        </View>
                        <Text style={styles.appName}>Tanprix</Text>
                        <Text style={styles.tagline}>Safety App</Text>
                    </View>

                    <View style={styles.formContainer}>
                        <Text style={styles.title}>Welcome Back</Text>
                        <Text style={styles.subtitle}>Sign in to continue</Text>

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

                        <View style={styles.inputContainer}>
                            <Ionicons name="lock-closed-outline" size={20} color={COLORS.gray400} />
                            <TextInput
                                style={styles.input}
                                placeholder="Password"
                                placeholderTextColor={COLORS.gray400}
                                secureTextEntry={!showPassword}
                                value={password}
                                onChangeText={(text) => {
                                    setPassword(text);
                                    setPasswordError('');
                                }}
                            />
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                <Ionicons
                                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                    size={20}
                                    color={COLORS.gray400}
                                />
                            </TouchableOpacity>
                        </View>
                        {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

                        <TouchableOpacity style={styles.forgotPasswordButton} onPress={handleForgotPassword}>
                            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                        </TouchableOpacity>

                        <GradientButton
                            title={loading ? 'Signing in...' : 'Sign In'}
                            onPress={handleLogin}
                            colors={GRADIENTS.primary}
                            style={styles.loginButton}
                            disabled={loading}
                        />

                        {loading && (
                            <ActivityIndicator size="small" color={COLORS.primary} style={styles.loader} />
                        )}

                        <View style={styles.divider}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>or continue with</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        <View style={styles.socialButtons}>
                            <TouchableOpacity style={styles.socialButton}>
                                <Ionicons name="logo-google" size={24} color={COLORS.danger} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.socialButton}>
                                <Ionicons name="logo-apple" size={24} color={COLORS.gray800} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.socialButton}>
                                <Ionicons name="logo-facebook" size={24} color={COLORS.info} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.signupContainer}>
                            <Text style={styles.signupText}>Don't have an account? </Text>
                            <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                                <Text style={styles.signupButtonText}>Sign Up</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: SPACING.lg },
    logoContainer: { alignItems: 'center', marginBottom: SPACING.xxl },
    logoCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.white + '20', alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md },
    appName: { fontSize: FONT_SIZES.xxxl, fontWeight: 'bold', color: COLORS.white },
    tagline: { fontSize: FONT_SIZES.lg, color: COLORS.white + '80' },
    formContainer: { backgroundColor: COLORS.white, borderRadius: 24, padding: SPACING.lg },
    title: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.gray800, marginBottom: 4 },
    subtitle: { fontSize: FONT_SIZES.md, color: COLORS.gray500, marginBottom: SPACING.xl },
    inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.gray100, borderRadius: 12, paddingHorizontal: SPACING.md, marginBottom: 8 },
    input: { flex: 1, paddingVertical: SPACING.md, paddingHorizontal: SPACING.sm, fontSize: FONT_SIZES.md, color: COLORS.gray800 },
    errorText: { fontSize: FONT_SIZES.sm, color: COLORS.danger, marginBottom: 8, marginLeft: 4 },
    forgotPasswordButton: { alignSelf: 'flex-end', marginBottom: SPACING.lg },
    forgotPasswordText: { fontSize: FONT_SIZES.sm, color: COLORS.primary },
    loginButton: { marginBottom: SPACING.lg },
    loader: { marginBottom: SPACING.lg },
    divider: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.lg },
    dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.gray200 },
    dividerText: { marginHorizontal: SPACING.md, fontSize: FONT_SIZES.sm, color: COLORS.gray500 },
    socialButtons: { flexDirection: 'row', justifyContent: 'center', marginBottom: SPACING.lg },
    socialButton: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.gray100, alignItems: 'center', justifyContent: 'center', marginHorizontal: 8 },
    signupContainer: { flexDirection: 'row', justifyContent: 'center' },
    signupText: { fontSize: FONT_SIZES.md, color: COLORS.gray600 },
    signupButtonText: { fontSize: FONT_SIZES.md, color: COLORS.primary, fontWeight: '600' },
});

export default LoginScreen;