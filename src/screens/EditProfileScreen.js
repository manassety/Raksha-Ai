import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, Modal, ScrollView, ActivityIndicator, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import GradientBackground from '../components/GradientBackground';
import GradientButton from '../components/GradientButton';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getAuth, reauthenticateWithCredential, updatePassword, sendPasswordResetEmail, updateProfile, verifyBeforeUpdateEmail } from 'firebase/auth';
import { setPIN, verifyPIN, hasPIN } from '../utils/PINManager';

const EditProfileScreen = () => {
    const navigation = useNavigation();
    const { user } = useAuth();

    const [loading, setLoading] = useState(false);
    const [userData, setUserData] = useState({
        name: '',
        email: '',
        phone: '',
        emergencyContact1: '',
        emergencyContact2: '',
        address: '',
    });

    // Edit states
    const [editingField, setEditingField] = useState(null);
    const [editValue, setEditValue] = useState('');

    // PIN Change states
    const [showPINChangeModal, setShowPINChangeModal] = useState(false);
    const [currentPIN, setCurrentPIN] = useState('');
    const [newPIN, setNewPIN] = useState('');
    const [confirmNewPIN, setConfirmNewPIN] = useState('');
    const [pinStep, setPinStep] = useState(1); // 1: current PIN, 2: new PIN, 3: confirm new PIN
    const [pinError, setPinError] = useState('');

    // Password states
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');

    // Forgot PIN modal
    const [showForgotPINModal, setShowForgotPINModal] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotError, setForgotError] = useState('');

    useEffect(() => {
        loadUserData();
    }, [user]);

    const loadUserData = async () => {
        try {
            const auth = getAuth();
            const currentUser = auth.currentUser;

            if (currentUser) {
                // Get additional data from Firestore
                const userDocRef = doc(db, 'users', currentUser.uid);
                const userDoc = await getDoc(userDocRef);

                if (userDoc.exists()) {
                    const data = userDoc.data();
                    setUserData({
                        name: currentUser.displayName || data.name || '',
                        email: currentUser.email || data.email || '',
                        phone: data.phone || '',
                        emergencyContact1: data.emergencyContact1 || '',
                        emergencyContact2: data.emergencyContact2 || '',
                        address: data.address || '',
                    });
                } else {
                    setUserData({
                        name: currentUser.displayName || '',
                        email: currentUser.email || '',
                        phone: '',
                        emergencyContact1: '',
                        emergencyContact2: '',
                        address: '',
                    });
                }
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    };

    const handleSaveField = async () => {
        if (!editValue.trim()) {
            Alert.alert('Error', 'Field cannot be empty');
            return;
        }

        setLoading(true);
        try {
            const auth = getAuth();
            const currentUser = auth.currentUser;

            if (editingField === 'name') {
                await updateProfile(currentUser, { displayName: editValue });
            } else if (editingField === 'email') {
                // Send verification email first
                await verifyBeforeUpdateEmail(currentUser, editValue);
                Alert.alert(
                    'Email Verification Sent',
                    'A verification link has been sent to your new email address. Please verify to complete the change.'
                );
            }

            // Update Firestore
            const userDocRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userDocRef, {
                [editingField]: editValue,
                updatedAt: new Date().toISOString()
            });

            setUserData(prev => ({ ...prev, [editingField]: editValue }));
            setEditingField(null);
            setEditValue('');

            Alert.alert('Success', `${editingField.charAt(0).toUpperCase() + editingField.slice(1)} updated successfully!`);
        } catch (error) {
            console.error('Error saving field:', error);
            Alert.alert('Error', 'Failed to update field. Please try again.');
        }
        setLoading(false);
    };

    const handleStartPINChange = () => {
        setShowPINChangeModal(true);
        setPinStep(1);
        setCurrentPIN('');
        setNewPIN('');
        setConfirmNewPIN('');
        setPinError('');
    };

    const handlePINNumberPress = (number, setPINFunc, currentPINValue, step) => {
        if (pinError) setPinError('');

        if (currentPINValue.length < 6) {
            const newPin = currentPINValue + number;
            setPINFunc(newPin);

            if (newPin.length === 6) {
                setTimeout(() => handlePINSubmit(newPin, step), 300);
            }
        }
    };

    const handlePINSubmit = async (enteredPin, step) => {
        setLoading(true);
        setPinError('');

        try {
            if (step === 1) {
                // Verify current PIN
                const result = await verifyPIN(enteredPin);
                if (result.success && result.match) {
                    setPinStep(2);
                    setCurrentPIN('');
                } else {
                    setPinError('Incorrect PIN. Please try again.');
                    setCurrentPIN('');
                }
            } else if (step === 2) {
                // Set new PIN
                setNewPIN(enteredPin);
                setPinStep(3);
                setConfirmNewPIN('');
            } else if (step === 3) {
                // Confirm new PIN
                if (enteredPin === newPIN) {
                    // Save new PIN
                    const result = await setPIN(enteredPin);
                    if (result.success) {
                        Alert.alert(
                            '🎉 PIN Changed Successfully!',
                            'Your safety PIN has been updated.',
                            [{
                                text: 'OK', onPress: () => {
                                    setShowPINChangeModal(false);
                                }
                            }]
                        );
                    } else {
                        setPinError('Failed to save PIN. Please try again.');
                        setConfirmNewPIN('');
                    }
                } else {
                    setPinError('PINs do not match. Please try again.');
                    setConfirmNewPIN('');
                }
            }
        } catch (error) {
            console.error('Error in PIN change:', error);
            setPinError('An error occurred. Please try again.');
        }

        setLoading(false);
    };

    const handleStartPasswordChange = () => {
        setShowPasswordModal(true);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPasswordError('');
    };

    const handlePasswordSubmit = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            setPasswordError('All fields are required');
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordError('Passwords do not match');
            return;
        }

        if (newPassword.length < 6) {
            setPasswordError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        setPasswordError('');

        try {
            const auth = getAuth();
            const currentUser = auth.currentUser;

            // Reauthenticate user
            const credential = getAuth().EmailAuthProvider.credential(
                currentUser.email,
                currentPassword
            );

            await reauthenticateWithCredential(currentUser, credential);

            // Update password
            await updatePassword(currentUser, newPassword);

            // Update Firestore
            const userDocRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userDocRef, {
                password: newPassword, // Note: Firebase Auth handles password, this is for reference
                passwordUpdatedAt: new Date().toISOString()
            });

            Alert.alert(
                '✅ Password Changed Successfully!',
                'Your password has been updated.',
                [{
                    text: 'OK', onPress: () => {
                        setShowPasswordModal(false);
                    }
                }]
            );
        } catch (error) {
            console.error('Error changing password:', error);
            if (error.code === 'auth/wrong-password') {
                setPasswordError('Current password is incorrect');
            } else if (error.code === 'auth/weak-password') {
                setPasswordError('New password is too weak');
            } else {
                setPasswordError('Failed to change password. Please try again.');
            }
        }

        setLoading(false);
    };

    const handleForgotPIN = async () => {
        if (!forgotEmail) {
            setForgotError('Please enter your email');
            return;
        }

        setLoading(true);
        setForgotError('');

        try {
            await sendPasswordResetEmail(getAuth(), forgotEmail);
            Alert.alert(
                '📧 Password Reset Link Sent',
                `A password reset link has been sent to ${forgotEmail}.\n\nUse this link to reset your password, then you can create a new safety PIN.`,
                [{
                    text: 'OK', onPress: () => {
                        setShowForgotPINModal(false);
                        setForgotEmail('');
                    }
                }]
            );
        } catch (error) {
            console.error('Error sending reset email:', error);
            if (error.code === 'auth/user-not-found') {
                setForgotError('No account found with this email');
            } else if (error.code === 'auth/invalid-email') {
                setForgotError('Invalid email address');
            } else {
                setForgotError('Failed to send reset link');
            }
        }

        setLoading(false);
    };

    const renderPINCircles = (pinValue) => {
        const circles = [];
        for (let i = 0; i < 6; i++) {
            circles.push(
                <View
                    key={i}
                    style={[
                        styles.pinCircle,
                        i < pinValue.length && styles.pinCircleFilled
                    ]}
                />
            );
        }
        return circles;
    };

    const renderPINPad = (pinValue, setPinFunc, step) => {
        const numbers = [
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9'],
            ['', '0', 'back']
        ];

        return numbers.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.numberRow}>
                {row.map((item, index) => {
                    if (item === '') return <View key={index} style={styles.numberButton} />;
                    if (item === 'back') {
                        return (
                            <TouchableOpacity
                                key={index}
                                style={styles.numberButton}
                                onPress={() => setPinFunc(pinValue.slice(0, -1))}
                            >
                                <Ionicons name="backspace" size={24} color={COLORS.white} />
                            </TouchableOpacity>
                        );
                    }
                    return (
                        <TouchableOpacity
                            key={index}
                            style={styles.numberButton}
                            onPress={() => handlePINNumberPress(item, setPinFunc, pinValue, step)}
                        >
                            <Text style={styles.numberText}>{item}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        ));
    };

    const ProfileField = ({ icon, label, value, field, editable = true }) => (
        <View style={styles.profileField}>
            <View style={styles.fieldIcon}>
                <Ionicons name={icon} size={20} color={COLORS.primary} />
            </View>
            <View style={styles.fieldContent}>
                <Text style={styles.fieldLabel}>{label}</Text>
                <Text style={styles.fieldValue}>{value || 'Not set'}</Text>
            </View>
            {editable && (
                <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => {
                        setEditingField(field);
                        setEditValue(value || '');
                    }}
                >
                    <Ionicons name="create-outline" size={20} color={COLORS.primary} />
                </TouchableOpacity>
            )}
        </View>
    );

    return (
        <GradientBackground colors={GRADIENTS.dark}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Edit Profile</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                    {/* Profile Avatar */}
                    <View style={styles.avatarContainer}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>
                                {userData.name ? userData.name.charAt(0).toUpperCase() : 'U'}
                            </Text>
                        </View>
                        <Text style={styles.avatarName}>{userData.name || 'User'}</Text>
                    </View>

                    {/* Profile Fields */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Personal Information</Text>

                        <ProfileField
                            icon="person"
                            label="Full Name"
                            value={userData.name}
                            field="name"
                        />

                        <ProfileField
                            icon="mail"
                            label="Email Address"
                            value={userData.email}
                            field="email"
                        />

                        <ProfileField
                            icon="call"
                            label="Phone Number"
                            value={userData.phone}
                            field="phone"
                        />

                        <ProfileField
                            icon="location"
                            label="Address"
                            value={userData.address}
                            field="address"
                        />
                    </View>

                    {/* Emergency Contacts */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Emergency Contacts</Text>

                        <ProfileField
                            icon="people"
                            label="Emergency Contact 1"
                            value={userData.emergencyContact1}
                            field="emergencyContact1"
                        />

                        <ProfileField
                            icon="people"
                            label="Emergency Contact 2"
                            value={userData.emergencyContact2}
                            field="emergencyContact2"
                        />
                    </View>

                    {/* Security Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Security</Text>

                        <TouchableOpacity
                            style={styles.securityOption}
                            onPress={handleStartPINChange}
                        >
                            <View style={styles.securityOptionLeft}>
                                <Ionicons name="key" size={24} color={COLORS.primary} />
                                <View style={styles.securityOptionContent}>
                                    <Text style={styles.securityOptionTitle}>Change Safety PIN</Text>
                                    <Text style={styles.securityOptionSubtitle}>Update your 6-digit safety PIN</Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={24} color={COLORS.gray400} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.securityOption}
                            onPress={handleStartPasswordChange}
                        >
                            <View style={styles.securityOptionLeft}>
                                <Ionicons name="lock-closed" size={24} color={COLORS.warning} />
                                <View style={styles.securityOptionContent}>
                                    <Text style={styles.securityOptionTitle}>Change Password</Text>
                                    <Text style={styles.securityOptionSubtitle}>Update your account password</Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={24} color={COLORS.gray400} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.securityOption, styles.dangerOption]}
                            onPress={() => setShowForgotPINModal(true)}
                        >
                            <View style={styles.securityOptionLeft}>
                                <Ionicons name="help-circle" size={24} color={COLORS.danger} />
                                <View style={styles.securityOptionContent}>
                                    <Text style={[styles.securityOptionTitle, styles.dangerText]}>Forgot PIN/Password</Text>
                                    <Text style={styles.securityOptionSubtitle}>Reset via email verification</Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={24} color={COLORS.gray400} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.bottomPadding} />
                </ScrollView>

                {/* Edit Field Modal */}
                <Modal visible={!!editingField} animationType="slide" transparent>
                    <TouchableWithoutFeedback onPress={() => setEditingField(null)}>
                        <View style={styles.modalOverlay}>
                            <TouchableWithoutFeedback>
                                <View style={styles.modalContent}>
                                    <View style={styles.modalHeader}>
                                        <Text style={styles.modalTitle}>
                                            Edit {editingField?.charAt(0).toUpperCase() + editingField?.slice(1)}
                                        </Text>
                                        <View style={{ flex: 1 }} />
                                        <TouchableOpacity onPress={() => setEditingField(null)}>
                                            <Ionicons name="close" size={24} color={COLORS.gray500} />
                                        </TouchableOpacity>
                                    </View>

                                    <TextInput
                                        style={styles.editInput}
                                        value={editValue}
                                        onChangeText={setEditValue}
                                        placeholder={`Enter ${editingField}`}
                                        placeholderTextColor={COLORS.gray400}
                                        autoCapitalize={editingField === 'email' ? 'none' : 'words'}
                                        keyboardType={editingField === 'email' || editingField === 'phone' ? 'email-address' : 'default'}
                                    />

                                    <GradientButton
                                        title="Save Changes"
                                        onPress={handleSaveField}
                                        colors={GRADIENTS.primary}
                                        style={styles.modalButton}
                                        disabled={loading}
                                    />
                                </View>
                            </TouchableWithoutFeedback>
                        </View>
                    </TouchableWithoutFeedback>
                </Modal>

                {/* Change PIN Modal */}
                <Modal visible={showPINChangeModal} animationType="slide" transparent>
                    <TouchableWithoutFeedback onPress={() => setShowPINChangeModal(false)}>
                        <View style={styles.modalOverlay}>
                            <TouchableWithoutFeedback>
                                <View style={styles.pinModalContent}>
                                    <View style={styles.modalHeader}>
                                        <Ionicons name="key" size={32} color={COLORS.primary} />
                                        <Text style={styles.modalTitle}>Change Safety PIN</Text>
                                    </View>

                                    <Text style={styles.pinStepText}>
                                        {pinStep === 1 && 'Enter your current PIN'}
                                        {pinStep === 2 && 'Enter your new PIN'}
                                        {pinStep === 3 && 'Confirm your new PIN'}
                                    </Text>

                                    {pinError ? (
                                        <View style={styles.errorContainer}>
                                            <Ionicons name="alert-circle" size={20} color={COLORS.danger} />
                                            <Text style={styles.errorText}>{pinError}</Text>
                                        </View>
                                    ) : null}

                                    <View style={styles.pinCirclesContainer}>
                                        {renderPINCircles(
                                            pinStep === 1 ? currentPIN :
                                                pinStep === 2 ? newPIN : confirmNewPIN
                                        )}
                                    </View>

                                    <View style={styles.pinPadContainer}>
                                        {renderPINPad(
                                            pinStep === 1 ? currentPIN :
                                                pinStep === 2 ? newPIN : confirmNewPIN,
                                            pinStep === 1 ? setCurrentPIN :
                                                pinStep === 2 ? setNewPIN : setConfirmNewPIN,
                                            pinStep
                                        )}
                                    </View>

                                    {loading && (
                                        <ActivityIndicator size="large" color={COLORS.primary} />
                                    )}
                                </View>
                            </TouchableWithoutFeedback>
                        </View>
                    </TouchableWithoutFeedback>
                </Modal>

                {/* Change Password Modal */}
                <Modal visible={showPasswordModal} animationType="slide" transparent>
                    <TouchableWithoutFeedback onPress={() => setShowPasswordModal(false)}>
                        <View style={styles.modalOverlay}>
                            <TouchableWithoutFeedback>
                                <View style={styles.passwordModalContent}>
                                    <View style={styles.modalHeader}>
                                        <Ionicons name="lock-closed" size={32} color={COLORS.warning} />
                                        <Text style={styles.modalTitle}>Change Password</Text>
                                    </View>

                                    {passwordError ? (
                                        <View style={styles.errorContainer}>
                                            <Ionicons name="alert-circle" size={20} color={COLORS.danger} />
                                            <Text style={styles.errorText}>{passwordError}</Text>
                                        </View>
                                    ) : null}

                                    <View style={styles.passwordInputContainer}>
                                        <Ionicons name="lock-closed" size={20} color={COLORS.gray400} />
                                        <TextInput
                                            style={styles.passwordInput}
                                            placeholder="Current Password"
                                            placeholderTextColor={COLORS.gray400}
                                            secureTextEntry
                                            value={currentPassword}
                                            onChangeText={setCurrentPassword}
                                        />
                                    </View>

                                    <View style={styles.passwordInputContainer}>
                                        <Ionicons name="key" size={20} color={COLORS.gray400} />
                                        <TextInput
                                            style={styles.passwordInput}
                                            placeholder="New Password"
                                            placeholderTextColor={COLORS.gray400}
                                            secureTextEntry
                                            value={newPassword}
                                            onChangeText={setNewPassword}
                                        />
                                    </View>

                                    <View style={styles.passwordInputContainer}>
                                        <Ionicons name="key" size={20} color={COLORS.gray400} />
                                        <TextInput
                                            style={styles.passwordInput}
                                            placeholder="Confirm New Password"
                                            placeholderTextColor={COLORS.gray400}
                                            secureTextEntry
                                            value={confirmPassword}
                                            onChangeText={setConfirmPassword}
                                        />
                                    </View>

                                    <GradientButton
                                        title={loading ? 'Changing...' : 'Change Password'}
                                        onPress={handlePasswordSubmit}
                                        colors={GRADIENTS.warning}
                                        style={styles.modalButton}
                                        disabled={loading}
                                    />
                                </View>
                            </TouchableWithoutFeedback>
                        </View>
                    </TouchableWithoutFeedback>
                </Modal>

                {/* Forgot PIN Modal */}
                <Modal visible={showForgotPINModal} animationType="slide" transparent>
                    <TouchableWithoutFeedback onPress={() => setShowForgotPINModal(false)}>
                        <View style={styles.modalOverlay}>
                            <TouchableWithoutFeedback>
                                <View style={styles.forgotModalContent}>
                                    <View style={styles.modalHeader}>
                                        <Ionicons name="help-circle" size={32} color={COLORS.danger} />
                                        <Text style={styles.modalTitle}>Forgot PIN/Password?</Text>
                                    </View>

                                    <Text style={styles.forgotModalText}>
                                        Enter your email address to reset your password. After resetting your password, you can create a new safety PIN.
                                    </Text>

                                    {forgotError ? (
                                        <Text style={styles.modalErrorText}>{forgotError}</Text>
                                    ) : null}

                                    <View style={styles.emailInputContainer}>
                                        <Ionicons name="mail-outline" size={20} color={COLORS.gray400} />
                                        <TextInput
                                            style={styles.emailInput}
                                            placeholder="Enter your email"
                                            placeholderTextColor={COLORS.gray400}
                                            keyboardType="email-address"
                                            autoCapitalize="none"
                                            value={forgotEmail}
                                            onChangeText={setForgotEmail}
                                        />
                                    </View>

                                    <GradientButton
                                        title={loading ? 'Sending...' : 'Send Reset Link'}
                                        onPress={handleForgotPIN}
                                        colors={GRADIENTS.danger}
                                        style={styles.modalButton}
                                        disabled={loading}
                                    />

                                    <TouchableOpacity
                                        style={styles.cancelButton}
                                        onPress={() => setShowForgotPINModal(false)}
                                    >
                                        <Text style={styles.cancelButtonText}>Cancel</Text>
                                    </TouchableOpacity>
                                </View>
                            </TouchableWithoutFeedback>
                        </View>
                    </TouchableWithoutFeedback>
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
        paddingTop: SPACING.xl,
        paddingBottom: SPACING.md,
    },
    headerTitle: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.white },
    scrollView: { flex: 1 },
    scrollContent: { padding: SPACING.md },
    avatarContainer: { alignItems: 'center', marginBottom: SPACING.xl },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.md,
    },
    avatarText: { fontSize: 40, fontWeight: 'bold', color: COLORS.white },
    avatarName: { fontSize: FONT_SIZES.xl, fontWeight: '600', color: COLORS.white },
    section: { marginBottom: SPACING.lg },
    sectionTitle: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.white + '80', marginBottom: SPACING.md, marginLeft: 4 },
    profileField: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        borderRadius: 12,
        padding: SPACING.md,
        marginBottom: 8,
    },
    fieldIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.primary + '20',
        alignItems: 'center',
        justifyContent: 'center',
    },
    fieldContent: { flex: 1, marginLeft: 12 },
    fieldLabel: { fontSize: FONT_SIZES.xs, color: COLORS.gray500 },
    fieldValue: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.gray800 },
    editButton: { padding: 8 },
    securityOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.white,
        borderRadius: 12,
        padding: SPACING.md,
        marginBottom: 8,
    },
    securityOptionLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    securityOptionContent: { marginLeft: 12 },
    securityOptionTitle: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.gray800 },
    securityOptionSubtitle: { fontSize: FONT_SIZES.xs, color: COLORS.gray500 },
    dangerOption: { borderWidth: 1, borderColor: COLORS.danger + '30' },
    dangerText: { color: COLORS.danger },
    bottomPadding: { height: 40 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
    modalContent: { backgroundColor: COLORS.white, borderRadius: 24, padding: SPACING.xl, width: '100%', maxWidth: 400 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.lg },
    modalTitle: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.gray800, marginLeft: 12 },
    editInput: { backgroundColor: COLORS.gray100, borderRadius: 12, padding: SPACING.md, fontSize: FONT_SIZES.md, color: COLORS.gray800, marginBottom: SPACING.lg },
    modalButton: { marginTop: SPACING.md },
    pinModalContent: { backgroundColor: COLORS.white, borderRadius: 24, padding: SPACING.xl, width: '100%', maxWidth: 350, alignItems: 'center' },
    pinStepText: { fontSize: FONT_SIZES.md, color: COLORS.gray600, marginBottom: SPACING.lg, textAlign: 'center' },
    pinCirclesContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: SPACING.xl },
    pinCircle: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: COLORS.gray300, marginHorizontal: 6 },
    pinCircleFilled: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    pinPadContainer: { width: '100%' },
    numberRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    numberButton: { width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.gray100, alignItems: 'center', justifyContent: 'center' },
    numberText: { fontSize: 24, fontWeight: '600', color: COLORS.gray800 },
    passwordModalContent: { backgroundColor: COLORS.white, borderRadius: 24, padding: SPACING.xl, width: '100%', maxWidth: 400 },
    passwordInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.gray100, borderRadius: 12, paddingHorizontal: SPACING.md, marginBottom: 12 },
    passwordInput: { flex: 1, paddingVertical: SPACING.md, paddingHorizontal: SPACING.sm, fontSize: FONT_SIZES.md, color: COLORS.gray800 },
    forgotModalContent: { backgroundColor: COLORS.white, borderRadius: 24, padding: SPACING.xl, width: '100%', maxWidth: 400 },
    forgotModalText: { fontSize: FONT_SIZES.md, color: COLORS.gray600, marginBottom: SPACING.lg, lineHeight: 20 },
    emailInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.gray100, borderRadius: 12, paddingHorizontal: SPACING.md, marginBottom: 12 },
    emailInput: { flex: 1, paddingVertical: SPACING.md, paddingHorizontal: SPACING.sm, fontSize: FONT_SIZES.md, color: COLORS.gray800 },
    modalErrorText: { fontSize: FONT_SIZES.sm, color: COLORS.danger, marginBottom: SPACING.md },
    errorContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
    errorText: { color: COLORS.danger, marginLeft: 8, fontSize: FONT_SIZES.sm },
    cancelButton: { alignItems: 'center', marginTop: SPACING.md },
    cancelButtonText: { fontSize: FONT_SIZES.md, color: COLORS.gray500 },
});

export default EditProfileScreen;