import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert, ActivityIndicator, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import GradientBackground from '../components/GradientBackground';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';
import { useAuth } from '../contexts/AuthContext';
import { getAuth, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import * as ImagePicker from 'expo-image-picker';
import { registerFaceWithPython } from '../services/PythonAIApi';
import { sendVerificationEmail } from '@/config/email';

const SettingsScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [locationTracking, setLocationTracking] = useState(true);
  const [autoSOS, setAutoSOS] = useState(false);
  const [appLockEnabled, setAppLockEnabled] = useState(false);
  const [hasPIN, setHasPIN] = useState(false); // Track if PIN is actually set
  const [voiceSOS, setVoiceSOS] = useState(false);
  const [userData, setUserData] = useState({ name: '', email: '' });
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMainAdmin, setIsMainAdmin] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [isFaceRegistered, setIsFaceRegistered] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      loadUserData();
      loadUserPreferences();
      checkAdminStatus();
    }, [user])
  );

  const checkAdminStatus = async () => {
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const data = userDoc.data();
          setIsAdmin(data.isAdmin || data.isMainAdmin || false);
          setIsMainAdmin(data.isMainAdmin || false);
        }
      }
    } catch (error) {
      console.log("Error checking admin status:", error);
      setIsAdmin(false);
    }
  };

  const loadUserData = async () => {
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (currentUser) {
        setUserData({
          name: currentUser.displayName || 'User',
          email: currentUser.email || '',
        });
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadUserPreferences = async () => {
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const data = userDoc.data();
          setNotifications(data.notifications !== false);
          setLocationTracking(data.locationTracking !== false);
          setAutoSOS(data.autoSOS || false);
          setVoiceSOS(data.voiceSOS || false);
          setIsEmailVerified(data.emailVerified === true);
          setIsFaceRegistered(data.faceRegistered === true);

          // Check if PIN exists
          const pinExists = !!(data.safetyPIN || data.safetyPin || data.pin);
          setHasPIN(pinExists);

          // Only enable lock if PIN exists AND setting is true
          const lockSetting = data.appLockEnabled === true;
          setAppLockEnabled(lockSetting && pinExists);
        } else {
          setAppLockEnabled(false);
          setHasPIN(false);
        }
      }
    } catch (error) {
      console.log("Error loading preferences:", error);
    }
  };

  const saveUserPreferences = async (key, value) => {
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (currentUser) {
        await updateDoc(doc(db, 'users', currentUser.uid), {
          [key]: value,
          preferencesUpdatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  };

  const toggleNotifications = async (value) => {
    setNotifications(value);
    await saveUserPreferences('notifications', value);
  };

  const toggleLocationTracking = async (value) => {
    setLocationTracking(value);
    await saveUserPreferences('locationTracking', value);
  };

  const toggleAutoSOS = async (value) => {
    setAutoSOS(value);
    await saveUserPreferences('autoSOS', value);
  };

  const toggleAppLock = async () => {
    if (appLockEnabled) {
      // Disable Lock
      Alert.alert('Disable App Lock', 'Are you sure you want to disable app lock?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable',
          style: 'destructive',
          onPress: async () => {
            const auth = getAuth();
            const currentUser = auth.currentUser;
            if (currentUser) {
              await updateDoc(doc(db, 'users', currentUser.uid), {
                safetyPIN: null, // Clear PIN for security
                appLockEnabled: false,
              });
            }
            setAppLockEnabled(false);
            setHasPIN(false);
            await saveUserPreferences('appLockEnabled', false);
          },
        },
      ]);
    } else {
      // Enable Lock
      if (!hasPIN) {
        // New user or no PIN set - Navigate to Setup
        Alert.alert(
          'Setup Safety PIN',
          'To enable App Lock, you must first set a 6-digit Safety PIN.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Setup Now',
              onPress: () => {
                navigation.navigate('PINSetupScreen');
              }
            }
          ]
        );
      } else {
        // PIN exists, enable lock
        const auth = getAuth();
        const currentUser = auth.currentUser;
        if (currentUser) {
          await updateDoc(doc(db, 'users', currentUser.uid), {
            appLockEnabled: true,
          });
        }
        setAppLockEnabled(true);
        await saveUserPreferences('appLockEnabled', true);
      }
    }
  };

  const toggleVoiceSOS = async (value) => {
    setVoiceSOS(value);
    await saveUserPreferences('voiceSOS', value);
    if (value) {
      Alert.alert('Voice SOS Enabled', 'Voice SOS is now enabled. The microphone will listen for "Help" command in the background.', [{ text: 'OK' }]);
    }
  };

  const handleVerifyEmail = async () => {
    if (user?.emailVerified || isEmailVerified) {
      Alert.alert('Already Verified', 'Your email is already verified.');
      return;
    }
    setLoading(true);
    try {
      if (user && user.email) {
        const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpTimestamp = new Date().toISOString();
        const userDocRef = doc(db, 'users', user.uid);
        await updateDoc(userDocRef, {
          emailVerificationOTP: newOtp,
          emailVerificationOTPTimestamp: otpTimestamp,
        });

        //send email here with node js 
        await sendVerificationEmail(user.email, newOtp);

        Alert.alert('📧 OTP Sent', `Your verification OTP is: ${newOtp}\n\n(This is for testing. In production, this will be sent via email.)`, [
          { text: 'OK', onPress: () => { navigation.navigate('EmailVerification'); } }
        ]);
      }
    } catch (error) {
      console.error('Error sending OTP:', error);
      Alert.alert('Error', 'Failed to send verification OTP. Please try again.');
    }
    setLoading(false);
  };

  const handleFaceRegistration = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required to register Face ID.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
        cameraType: ImagePicker.CameraType.front,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setLoading(true);
        const base64Image = result.assets[0].base64;

        if (user && user.uid) {
          const response = await registerFaceWithPython(user.uid, base64Image);
          if (response && response.success && response.encoding) {

            // Save the returned encoding data back to Firebase
            await updateDoc(doc(db, 'users', user.uid), {
              faceRegistered: true,
              faceEncoding: response.encoding,
              faceRegisteredAt: new Date().toISOString()
            });

            setIsFaceRegistered(true); // Update UI
            Alert.alert('Success', 'Your Face ID has been registered and secured in Firebase successfully!');
          } else {
            Alert.alert('Error', response?.error || 'Could not register face. Please ensure your face is clearly visible.');
          }
        } else {
          Alert.alert('Error', 'User not authenticated.');
        }
      }
    } catch (error) {
      console.error('Face registration error:', error);
      Alert.alert('Error', 'Failed to complete Face ID registration.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            await signOut(getAuth());
          } catch (error) {
            console.error('Logout error:', error);
          }
          setLoading(false);
        }
      }
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert('Delete Account', 'Are you sure you want to delete your account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            const auth = getAuth();
            const currentUser = auth.currentUser;
            if (currentUser) {
              const userDocRef = doc(db, 'users', currentUser.uid);
              await updateDoc(userDocRef, {
                accountDeleted: true,
                deletedAt: new Date().toISOString()
              });
              await currentUser.delete();
            }
          } catch (error) {
            console.error('Delete account error:', error);
            Alert.alert('Error', 'Failed to delete account.');
          }
          setLoading(false);
        }
      }
    ]);
  };

  const handleAdminPanel = () => {
    if (isAdmin) {
      navigation.navigate('AdminPanel');
    } else {
      Alert.alert('Access Denied', 'You do not have permission to access the Admin Panel.');
    }
  };

  const getIconColor = (icon) => {
    const colors = {
      'person': COLORS.primary, 'notifications': COLORS.warning, 'location': COLORS.success,
      'shield-checkmark': COLORS.info, 'lock-closed': COLORS.secondary, 'finger-print': COLORS.primary,
      'help-circle': COLORS.danger, 'log-out': COLORS.danger, 'trash': COLORS.danger,
      'mail': COLORS.primary, 'create-outline': COLORS.primary, 'stats-chart': COLORS.danger,
      'key': COLORS.warning, 'mic': COLORS.danger, 'settings': COLORS.primary, 'shield': COLORS.danger,
    };
    return colors[icon] || COLORS.gray500;
  };

  const SettingsItem = ({ icon, title, subtitle, onPress, showChevron = true, rightComponent }) => (
    <TouchableOpacity style={styles.settingsItem} onPress={onPress} disabled={!onPress} activeOpacity={0.7}>
      <View style={styles.settingsItemLeft}>
        <View style={[styles.settingsItemIcon, { backgroundColor: getIconColor(icon) + '20' }]}>
          <Ionicons name={icon} size={22} color={getIconColor(icon)} />
        </View>
        <View style={styles.settingsItemContent}>
          <Text style={styles.settingsItemTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingsItemSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {showChevron && !rightComponent && <Ionicons name="chevron-forward" size={20} color={COLORS.gray400} />}
      {rightComponent}
    </TouchableOpacity>
  );

  const SectionHeader = ({ title }) => <Text style={styles.sectionHeader}>{title}</Text>;

  return (
    <GradientBackground colors={GRADIENTS.dark}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Settings</Text>
          </View>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <SectionHeader title="Profile" />
            <View style={styles.profileCard}>
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>{userData.name ? userData.name.charAt(0).toUpperCase() : 'U'}</Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{userData.name || 'User'}</Text>
                <Text style={styles.profileEmail}>{userData.email || ''}</Text>
              </View>
              <TouchableOpacity style={styles.editProfileButton} onPress={() => navigation.navigate('EditProfile')}>
                <Ionicons name="create-outline" size={18} color={COLORS.white} />
                <Text style={styles.editProfileButtonText}>Edit Profile</Text>
              </TouchableOpacity>
            </View>

            <SectionHeader title="Preferences" />
            <View style={styles.settingsGroup}>
              <SettingsItem icon="notifications" title="Push Notifications" subtitle={notifications ? 'Enabled' : 'Disabled'} rightComponent={<Switch value={notifications} onValueChange={toggleNotifications} trackColor={{ false: COLORS.gray300, true: COLORS.primary }} thumbColor={COLORS.white} />} />
              <SettingsItem icon="location" title="Location Tracking" subtitle={locationTracking ? 'Enabled' : 'Disabled'} rightComponent={<Switch value={locationTracking} onValueChange={toggleLocationTracking} trackColor={{ false: COLORS.gray300, true: COLORS.success }} thumbColor={COLORS.white} />} />
              <SettingsItem icon="shield-checkmark" title="Auto SOS" subtitle={autoSOS ? 'Enabled' : 'Disabled'} rightComponent={<Switch value={autoSOS} onValueChange={toggleAutoSOS} trackColor={{ false: COLORS.gray300, true: COLORS.danger }} thumbColor={COLORS.white} />} />
              <SettingsItem icon="mic" title="Voice SOS" subtitle={voiceSOS ? 'Enabled' : 'Disabled'} rightComponent={<Switch value={voiceSOS} onValueChange={toggleVoiceSOS} trackColor={{ false: COLORS.gray300, true: COLORS.danger }} thumbColor={COLORS.white} />} />
            </View>

            <SectionHeader title="Security" />
            <View style={styles.settingsGroup}>
              <SettingsItem
                icon="person"
                title="Face Registration"
                subtitle={isFaceRegistered ? 'Secured and verified' : 'Setup facial authentication'}
                onPress={handleFaceRegistration}
              />
              <SettingsItem icon="finger-print" title="App Lock" subtitle={appLockEnabled ? 'Enabled' : 'Disabled'} rightComponent={<Switch value={appLockEnabled} onValueChange={toggleAppLock} trackColor={{ false: COLORS.gray300, true: COLORS.primary }} thumbColor={COLORS.white} />} />
              <SettingsItem icon="key" title="Change Password" subtitle="Update your safety PIN" onPress={() => navigation.navigate('PINSetupScreen')} />
              <SettingsItem icon="mail" title="Verify Email" subtitle={(user?.emailVerified || isEmailVerified) ? 'Verified' : 'Not verified'} onPress={handleVerifyEmail} />
            </View>

            {isAdmin && (
              <>
                <SectionHeader title="Admin" />
                <View style={styles.settingsGroup}>
                  <SettingsItem icon="settings" title="Admin Panel" subtitle="Manage users, evidence, and system settings" onPress={() => navigation.navigate('AdminPanel')} />
                  {isMainAdmin && <SettingsItem icon="shield-checkmark" title="Main Admin Panel" subtitle="Full system control and database tools" onPress={() => navigation.navigate('MainAdminPanel')} />}
                </View>
              </>
            )}

            <SectionHeader title="Help & Support" />
            <View style={styles.settingsGroup}>
              <SettingsItem icon="help-circle" title="Help Center" onPress={() => Alert.alert('Help Center', 'Feature coming soon')} />
              <SettingsItem icon="document-text" title="Privacy Policy" onPress={() => Alert.alert('Privacy Policy', 'Feature coming soon')} />
              <SettingsItem icon="information-circle" title="About" subtitle="v1.0.0" onPress={() => Alert.alert('About', 'SafeHer v1.0.0\n\nA comprehensive safety application.')} />
            </View>

            <SectionHeader title="Danger Zone" />
            <View style={styles.settingsGroup}>
              <SettingsItem icon="log-out" title="Logout" onPress={handleLogout} />
              <SettingsItem icon="trash" title="Delete Account" onPress={handleDeleteAccount} />
            </View>
            <View style={styles.bottomPadding} />
          </ScrollView>
          {loading && <View style={styles.loadingOverlay}><ActivityIndicator size="large" color={COLORS.white} /></View>}
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  header: { paddingHorizontal: SPACING.md, paddingTop: SPACING.xl, paddingBottom: SPACING.md, alignItems: 'center' },
  headerTitle: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.white },
  scrollView: { flex: 1 },
  scrollContent: { padding: SPACING.md, paddingBottom: SPACING.xxl },
  sectionHeader: {
    fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.white + '70', marginTop: 4,
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  profileCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  profileAvatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  profileInfo: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  profileName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '600',
    color: COLORS.gray800,
  },
  profileEmail: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray500,
    marginTop: 4,
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  editProfileButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    marginLeft: 8,
  },
  settingsGroup: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingsItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsItemContent: {
    flex: 1,
    marginLeft: 12,
  },
  settingsItemTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.gray800,
  },
  settingsItemSubtitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray500,
    marginTop: 2,
  },
  bottomPadding: {
    height: SPACING.xxl,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SettingsScreen;