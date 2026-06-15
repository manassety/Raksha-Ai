import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import GradientBackground from '../components/GradientBackground';
import GradientButton from '../components/GradientButton';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';
import { registerUser } from '../services/AuthService';

const ADMIN_CODE = 'ADMIN123';

const SignupScreen = () => {
    const navigation = useNavigation();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [userType, setUserType] = useState('user'); // 'user' or 'admin'
    const [adminCode, setAdminCode] = useState('');
    const [showAdminCodeField, setShowAdminCodeField] = useState(false);

    const validateEmail = (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    };

    const validatePhone = (phone) => {
        const re = /^[0-9]{10,15}$/;
        return re.test(phone.replace(/\s/g, ''));
    };

    const handleSignup = async () => {
        setErrors({});

        const newErrors = {};
        if (!name.trim()) newErrors.name = 'Name is required';
        if (!email) newErrors.email = 'Email is required';
        else if (!validateEmail(email)) newErrors.email = 'Please enter a valid email';
        if (!phone) newErrors.phone = 'Phone number is required';
        else if (!validatePhone(phone)) newErrors.phone = 'Please enter a valid phone number';
        if (!password) newErrors.password = 'Password is required';
        else if (password.length < 6) newErrors.password = 'Password must be at least 6 characters';
        if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match';

        // Admin code validation
        if (userType === 'admin') {
            if (!adminCode) {
                newErrors.adminCode = 'Admin code is required';
            } else if (adminCode !== ADMIN_CODE) {
                newErrors.adminCode = 'Invalid admin code';
            }
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setLoading(true);

        try {
            const result = await registerUser(email, password, name, phone, userType === 'admin');

            if (result.success) {
                Alert.alert(
                    'Account Created!',
                    `Your ${userType === 'admin' ? 'Admin' : 'User'} account has been created successfully.\n\nPlease login to continue.`,
                    [{ text: 'OK', onPress: () => navigation.goBack() }]
                );
            } else {
                Alert.alert('Registration Failed', result.error);
            }
        } catch (error) {
            Alert.alert('Error', 'An unexpected error occurred');
        }

        setLoading(false);
    };

    return (
        <GradientBackground colors={GRADIENTS.primary}>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.goBack()}>
                            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Create Account</Text>
                        <View style={{ width: 24 }} />
                    </View>

                    <View style={styles.formContainer}>
                        <Text style={styles.title}>Sign Up</Text>
                        <Text style={styles.subtitle}>Create your account to get started</Text>

                        {/* User Type Selection */}
                        <Text style={styles.sectionTitle}>Account Type</Text>
                        <View style={styles.userTypeContainer}>
                            <TouchableOpacity
                                style={[styles.userTypeButton, userType === 'user' && styles.userTypeButtonActive]}
                                onPress={() => {
                                    setUserType('user');
                                    setShowAdminCodeField(false);
                                    setAdminCode('');
                                }}
                            >
                                <Ionicons
                                    name={userType === 'user' ? 'checkmark-circle' : 'ellipse-outline'}
                                    size={20}
                                    color={userType === 'user' ? COLORS.white : COLORS.primary}
                                />
                                <Text style={[styles.userTypeText, userType === 'user' && styles.userTypeTextActive]}>
                                    Normal User
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.userTypeButton, userType === 'admin' && styles.userTypeButtonActive]}
                                onPress={() => {
                                    setUserType('admin');
                                    setShowAdminCodeField(true);
                                }}
                            >
                                <Ionicons
                                    name={userType === 'admin' ? 'checkmark-circle' : 'ellipse-outline'}
                                    size={20}
                                    color={userType === 'admin' ? COLORS.white : COLORS.warning}
                                />
                                <Text style={[styles.userTypeText, userType === 'admin' && styles.userTypeTextActive]}>
                                    Admin User
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {userType === 'admin' && (
                            <View style={styles.adminInfoCard}>
                                <Ionicons name="shield-checkmark" size={20} color={COLORS.warning} />
                                <Text style={styles.adminInfoText}>
                                    Admin users have access to additional features like user management and analytics.
                                </Text>
                            </View>
                        )}

                        <View style={styles.inputContainer}>
                            <Ionicons name="person-outline" size={20} color={COLORS.gray400} />
                            <TextInput
                                style={styles.input}
                                placeholder="Full Name"
                                placeholderTextColor={COLORS.gray400}
                                value={name}
                                onChangeText={(text) => {
                                    setName(text);
                                    if (errors.name) setErrors({ ...errors, name: '' });
                                }}
                            />
                        </View>
                        {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}

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
                                    if (errors.email) setErrors({ ...errors, email: '' });
                                }}
                            />
                        </View>
                        {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

                        <View style={styles.inputContainer}>
                            <Ionicons name="call-outline" size={20} color={COLORS.gray400} />
                            <TextInput
                                style={styles.input}
                                placeholder="Phone Number"
                                placeholderTextColor={COLORS.gray400}
                                keyboardType="phone-pad"
                                value={phone}
                                onChangeText={(text) => {
                                    setPhone(text);
                                    if (errors.phone) setErrors({ ...errors, phone: '' });
                                }}
                            />
                        </View>
                        {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}

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
                                    if (errors.password) setErrors({ ...errors, password: '' });
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
                        {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

                        <View style={styles.inputContainer}>
                            <Ionicons name="lock-closed-outline" size={20} color={COLORS.gray400} />
                            <TextInput
                                style={styles.input}
                                placeholder="Confirm Password"
                                placeholderTextColor={COLORS.gray400}
                                secureTextEntry={!showConfirmPassword}
                                value={confirmPassword}
                                onChangeText={(text) => {
                                    setConfirmPassword(text);
                                    if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: '' });
                                }}
                            />
                            <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                                <Ionicons
                                    name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                                    size={20}
                                    color={COLORS.gray400}
                                />
                            </TouchableOpacity>
                        </View>
                        {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}

                        {/* Admin Code Input */}
                        {showAdminCodeField && (
                            <View style={styles.inputContainer}>
                                <Ionicons name="key-outline" size={20} color={COLORS.warning} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter Admin Code"
                                    placeholderTextColor={COLORS.gray400}
                                    secureTextEntry={true}
                                    value={adminCode}
                                    onChangeText={(text) => {
                                        setAdminCode(text);
                                        if (errors.adminCode) setErrors({ ...errors, adminCode: '' });
                                    }}
                                />
                            </View>
                        )}
                        {errors.adminCode ? <Text style={styles.errorText}>{errors.adminCode}</Text> : null}

                        <View style={styles.termsContainer}>
                            <Ionicons name="checkbox" size={20} color={COLORS.primary} />
                            <Text style={styles.termsText}>I agree to the </Text>
                            <TouchableOpacity><Text style={styles.termsLink}>Terms of Service</Text></TouchableOpacity>
                            <Text style={styles.termsText}> and </Text>
                            <TouchableOpacity><Text style={styles.termsLink}>Privacy Policy</Text></TouchableOpacity>
                        </View>

                        <GradientButton
                            title={loading ? 'Creating Account...' : 'Create Account'}
                            onPress={handleSignup}
                            colors={GRADIENTS.primary}
                            style={styles.signupButton}
                            disabled={loading}
                        />

                        <View style={styles.loginContainer}>
                            <Text style={styles.loginText}>Already have an account? </Text>
                            <TouchableOpacity onPress={() => navigation.goBack()}>
                                <Text style={styles.loginButtonText}>Sign In</Text>
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
    scrollContent: { flexGrow: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.md,
        paddingTop: SPACING.xl,
        paddingBottom: SPACING.md
    },
    headerTitle: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.white },
    formContainer: {
        flex: 1,
        backgroundColor: COLORS.white,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: SPACING.lg,
        paddingTop: SPACING.xxl
    },
    title: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.gray800, marginBottom: 4 },
    subtitle: { fontSize: FONT_SIZES.md, color: COLORS.gray500, marginBottom: SPACING.lg },
    sectionTitle: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.gray700, marginBottom: 8 },
    userTypeContainer: { flexDirection: 'row', marginBottom: SPACING.md },
    userTypeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: COLORS.gray200,
        marginRight: 8
    },
    userTypeButtonActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary
    },
    userTypeText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.gray600,
        marginLeft: 8,
        fontWeight: '500'
    },
    userTypeTextActive: { color: COLORS.white },
    adminInfoCard: {
        flexDirection: 'row',
        backgroundColor: COLORS.warning + '15',
        borderRadius: 8,
        padding: 12,
        marginBottom: SPACING.md
    },
    adminInfoText: {
        flex: 1,
        fontSize: FONT_SIZES.sm,
        color: COLORS.gray700,
        marginLeft: 8,
        lineHeight: 18
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.gray100,
        borderRadius: 12,
        paddingHorizontal: SPACING.md,
        marginBottom: 8
    },
    input: {
        flex: 1,
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.sm,
        fontSize: FONT_SIZES.md,
        color: COLORS.gray800
    },
    errorText: { fontSize: FONT_SIZES.sm, color: COLORS.danger, marginBottom: 8, marginLeft: 4 },
    termsContainer: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: SPACING.lg },
    termsText: { fontSize: FONT_SIZES.sm, color: COLORS.gray600 },
    termsLink: { fontSize: FONT_SIZES.sm, color: COLORS.primary, fontWeight: '500' },
    signupButton: { marginBottom: SPACING.xl },
    loginContainer: { flexDirection: 'row', justifyContent: 'center' },
    loginText: { fontSize: FONT_SIZES.md, color: COLORS.gray600 },
    loginButtonText: { fontSize: FONT_SIZES.md, color: COLORS.primary, fontWeight: '600' },
});

export default SignupScreen;