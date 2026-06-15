import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import GradientBackground from '../components/GradientBackground';
import GradientButton from '../components/GradientButton';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';
import { doc, getDoc, setDoc, getDocs, query, where, collection } from 'firebase/firestore';
import { db } from '../config/firebase';

const AdminSetupScreen = () => {
    const navigation = useNavigation();
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const setYouAsMainAdmin = async () => {
        const yourEmail = 'setymanas4@gmail.com';

        setLoading(true);
        setResult(null);

        try {
            // Find your user document
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('email', '==', yourEmail));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                setResult({ success: false, error: 'User not found with email: ' + yourEmail });
                setLoading(false);
                return;
            }

            // Get your user ID
            let yourUserId = null;
            querySnapshot.forEach((docSnapshot) => {
                if (docSnapshot.data().email === yourEmail) {
                    yourUserId = docSnapshot.id;
                }
            });

            if (!yourUserId) {
                setResult({ success: false, error: 'Could not find user ID' });
                setLoading(false);
                return;
            }

            // Set you as main admin
            const userRef = doc(db, 'users', yourUserId);
            await setDoc(userRef, {
                isAdmin: true,
                isMainAdmin: true,
                adminPrivileges: ['all'],
                name: 'Manas Sety',
                email: 'setymanas4@gmail.com',
                phone: '9411596016',
                updatedAt: new Date().toISOString()
            }, { merge: true });

            setResult({
                success: true,
                message: 'You are now the MAIN ADMIN with all privileges!',
                userId: yourUserId
            });

            Alert.alert(
                '🎉 Success!',
                'You are now the MAIN ADMIN with all privileges!\n\nYou can:\n• Grant admin access to other users\n• Remove admin access from any user\n• Access all admin features\n• Manage all users',
                [{ text: 'OK', onPress: () => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Settings') }]
            );

        } catch (error) {
            setResult({ success: false, error: error.message });
            Alert.alert('Error', error.message || 'An unexpected error occurred');
        }

        setLoading(false);
    };

    return (
        <GradientBackground colors={GRADIENTS.primary}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Settings')}>
                        <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Admin Setup</Text>
                    <View style={{ width: 24 }} />
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.setupCard}>
                        <View style={styles.iconContainer}>
                            <Ionicons name="shield-checkmark" size={80} color={COLORS.success} />
                        </View>

                        <Text style={styles.title}>Setup Main Admin</Text>
                        <Text style={styles.subtitle}>
                            This will set your account as the MAIN ADMIN with full privileges.
                        </Text>

                        <View style={styles.userInfo}>
                            <Text style={styles.userInfoTitle}>Account Details:</Text>
                            <Text style={styles.userInfoText}>Name: Manas Sety</Text>
                            <Text style={styles.userInfoText}>Email: setymanas4@gmail.com</Text>
                            <Text style={styles.userInfoText}>Phone: 9411596016</Text>
                        </View>

                        <View style={styles.permissionsCard}>
                            <Text style={styles.permissionsTitle}>You will have:</Text>
                            <View style={styles.permissionItem}>
                                <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                                <Text style={styles.permissionText}>Full Admin Access</Text>
                            </View>
                            <View style={styles.permissionItem}>
                                <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                                <Text style={styles.permissionText}>User Management</Text>
                            </View>
                            <View style={styles.permissionItem}>
                                <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                                <Text style={styles.permissionText}>Grant/Remove Admin Rights</Text>
                            </View>
                            <View style={styles.permissionItem}>
                                <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                                <Text style={styles.permissionText}>Access All Features</Text>
                            </View>
                        </View>

                        {loading ? (
                            <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
                        ) : (
                            <GradientButton
                                title="SET ME AS MAIN ADMIN"
                                onPress={setYouAsMainAdmin}
                                colors={GRADIENTS.success}
                                style={styles.setupButton}
                            />
                        )}
                    </View>
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
        paddingBottom: SPACING.md
    },
    headerTitle: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.white },
    scrollContent: { flexGrow: 1, justifyContent: 'center', padding: SPACING.lg },
    setupCard: { backgroundColor: COLORS.white, borderRadius: 24, padding: SPACING.xl, alignItems: 'center' },
    iconContainer: { marginBottom: SPACING.lg },
    title: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.gray800, marginBottom: 8 },
    subtitle: { fontSize: FONT_SIZES.md, color: COLORS.gray500, textAlign: 'center', marginBottom: SPACING.lg },
    userInfo: { backgroundColor: COLORS.gray100, borderRadius: 12, padding: SPACING.md, width: '100%', marginBottom: SPACING.lg },
    userInfoTitle: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.gray700, marginBottom: 8 },
    userInfoText: { fontSize: FONT_SIZES.sm, color: COLORS.gray600, marginBottom: 4 },
    permissionsCard: { backgroundColor: COLORS.success + '10', borderRadius: 12, padding: SPACING.md, width: '100%', marginBottom: SPACING.lg },
    permissionsTitle: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.gray700, marginBottom: 8 },
    permissionItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    permissionText: { fontSize: FONT_SIZES.sm, color: COLORS.gray600, marginLeft: 8 },
    loader: { marginVertical: SPACING.lg },
    setupButton: { width: '100%' },
});

export default AdminSetupScreen;