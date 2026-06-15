import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, Modal, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import GradientBackground from '../components/GradientBackground';
import GradientButton from '../components/GradientButton';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';
import { SCREEN_NAMES } from '../config/constants';
import { useAuth } from '../contexts/AuthContext';
import * as SecureStore from 'expo-secure-store';

const MAIN_ADMIN_CODE = 'man*dep#2005';
const ADMIN_CODE = 'Kaidoo#@2302';

const AdminVerificationScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [isMainAdmin, setIsMainAdmin] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);

  useEffect(() => {
    checkMainAdminStatus();
  }, [user]);

  const checkMainAdminStatus = async () => {
    const adminMode = await SecureStore.getItemAsync('adminMode');
    setIsMainAdmin(adminMode === 'main');
  };

  const handleVerify = async () => {
    if (code.length < 4) {
      setError('Code must be at least 4 characters');
      return;
    }

    if (code === MAIN_ADMIN_CODE) {
      await SecureStore.setItemAsync('adminMode', 'main');
      setIsMainAdmin(true);
      setIsVerified(true);
    } else if (code === ADMIN_CODE) {
      await SecureStore.setItemAsync('adminMode', 'true');
      setIsMainAdmin(false);
      setIsVerified(true);
    } else {
      setError('Invalid admin code');
      setCode('');
    }
  };

  if (isVerified) {
    return (
      <GradientBackground colors={GRADIENTS.dark}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color={COLORS.white} />
            </TouchableOpacity>
            <Text style={styles.title}>Admin Panel</Text>
            {isMainAdmin && (
              <TouchableOpacity onPress={() => setShowAdminMenu(true)}>
                <Ionicons name="ellipsis-vertical" size={24} color={COLORS.white} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.adminHeader}>
            <Ionicons name="shield-checkmark" size={60} color={COLORS.success} />
            <Text style={styles.adminTitle}>Admin Mode Active</Text>
            <Text style={styles.adminSubtitle}>You have full access to administrative features.</Text>
          </View>

          <View style={styles.adminContent}>
            <TouchableOpacity
              style={styles.adminCard}
              onPress={() => navigation.navigate(SCREEN_NAMES.USER_MANAGEMENT)}
            >
              <Ionicons name="people" size={24} color={COLORS.primary} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.adminCardTitle}>User Management</Text>
                <Text style={styles.adminCardSubtitle}>Manage all registered users</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.gray400} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.adminCard}
              onPress={() => navigation.navigate(SCREEN_NAMES.REPORTS_ANALYTICS)}
            >
              <Ionicons name="analytics" size={24} color={COLORS.secondary} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.adminCardTitle}>Reports & Analytics</Text>
                <Text style={styles.adminCardSubtitle}>View emergency reports</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.gray400} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.adminCard}
              onPress={() => Alert.alert('System Settings', 'System settings coming soon')}
            >
              <Ionicons name="settings" size={24} color={COLORS.info} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.adminCardTitle}>System Settings</Text>
                <Text style={styles.adminCardSubtitle}>Configure app settings</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.gray400} />
            </TouchableOpacity>
          </View>

          <GradientButton
            title="Exit Admin Mode"
            onPress={async () => {
              await SecureStore.deleteItemAsync('adminMode');
              setIsVerified(false);
              setCode('');
              navigation.goBack();
            }}
            colors={GRADIENTS.danger}
            style={styles.exitButton}
          />

          {/* Admin Menu Modal - Only for Main Admin */}
          <Modal visible={showAdminMenu} animationType="fade" transparent>
            <TouchableWithoutFeedback onPress={() => setShowAdminMenu(false)}>
              <View style={styles.adminMenuOverlay}>
                <TouchableWithoutFeedback>
                  <View style={styles.adminMenuContent}>
                    <View style={styles.adminMenuHeader}>
                      <Ionicons name="shield-checkmark" size={24} color={COLORS.warning} />
                      <Text style={styles.adminMenuTitle}>Admin Menu</Text>
                      <Text style={styles.adminMenuSubtitle}>Main Admin Only</Text>
                    </View>

                    <TouchableOpacity
                      style={styles.adminMenuItem}
                      onPress={() => {
                        setShowAdminMenu(false);
                        navigation.navigate(SCREEN_NAMES.EVIDENCE_BACKUP);
                      }}
                    >
                      <View style={styles.adminMenuIconContainer}>
                        <Ionicons name="cloud-upload" size={22} color={COLORS.primary} />
                      </View>
                      <View style={styles.adminMenuItemContent}>
                        <Text style={styles.adminMenuItemText}>Evidence Backup</Text>
                        <Text style={styles.adminMenuItemSubtext}>View and manage all evidence</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={COLORS.gray400} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.adminMenuItem}
                      onPress={() => {
                        setShowAdminMenu(false);
                        navigation.navigate(SCREEN_NAMES.DATABASE_ANALYTICS);
                      }}
                    >
                      <View style={styles.adminMenuIconContainer}>
                        <Ionicons name="server" size={22} color={COLORS.secondary} />
                      </View>
                      <View style={styles.adminMenuItemContent}>
                        <Text style={styles.adminMenuItemText}>Database Analytics</Text>
                        <Text style={styles.adminMenuItemSubtext}>View database statistics and changes</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={COLORS.gray400} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.adminMenuItem}
                      onPress={() => {
                        setShowAdminMenu(false);
                        Alert.alert('Logs', 'View system logs and activity.');
                      }}
                    >
                      <View style={styles.adminMenuIconContainer}>
                        <Ionicons name="list" size={22} color={COLORS.info} />
                      </View>
                      <View style={styles.adminMenuItemContent}>
                        <Text style={styles.adminMenuItemText}>System Logs</Text>
                        <Text style={styles.adminMenuItemSubtext}>View activity logs</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={COLORS.gray400} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.adminMenuItem}
                      onPress={() => {
                        setShowAdminMenu(false);
                        Alert.alert('Notifications', 'Send broadcast notifications.');
                      }}
                    >
                      <View style={styles.adminMenuIconContainer}>
                        <Ionicons name="notifications" size={22} color={COLORS.warning} />
                      </View>
                      <View style={styles.adminMenuItemContent}>
                        <Text style={styles.adminMenuItemText}>Broadcast</Text>
                        <Text style={styles.adminMenuItemSubtext}>Send notifications to users</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={COLORS.gray400} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.adminMenuItem, styles.dangerMenuItem]}
                      onPress={() => {
                        setShowAdminMenu(false);
                        Alert.alert('Reset', 'Reset system settings.');
                      }}
                    >
                      <View style={styles.adminMenuIconContainer}>
                        <Ionicons name="refresh-circle" size={22} color={COLORS.danger} />
                      </View>
                      <View style={styles.adminMenuItemContent}>
                        <Text style={[styles.adminMenuItemText, styles.dangerText]}>Reset System</Text>
                        <Text style={styles.adminMenuItemSubtext}>Reset all settings to default</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </TouchableWithoutFeedback>
              </View>
            </TouchableWithoutFeedback>
          </Modal>
        </View>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground colors={GRADIENTS.primary}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.title}>Admin Verification</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          <View style={styles.lockIcon}>
            <Ionicons name="lock-closed" size={60} color={COLORS.white} />
          </View>
          <Text style={styles.warningTitle}>Restricted Area</Text>
          <Text style={styles.warningText}>Enter the admin code to continue.</Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Enter admin code"
              placeholderTextColor={COLORS.gray400}
              value={code}
              onChangeText={(text) => {
                setCode(text);
                setError('');
              }}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
              secureTextEntry
            />
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <GradientButton
            title="Verify"
            onPress={handleVerify}
            colors={GRADIENTS.primary}
            style={styles.verifyButton}
          />

          <Text style={styles.hint}>Contact main administrator for admin code.</Text>
        </View>
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
  title: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.white },
  content: { flex: 1, paddingHorizontal: SPACING.lg, alignItems: 'center', justifyContent: 'center' },
  lockIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.white + '20', alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.xl },
  warningTitle: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.white, marginBottom: SPACING.md },
  warningText: { fontSize: FONT_SIZES.md, color: COLORS.white + '80', textAlign: 'center', marginBottom: SPACING.xl },
  inputContainer: { width: '100%', marginBottom: SPACING.md },
  textInput: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.md,
    fontSize: FONT_SIZES.lg,
    color: COLORS.gray800,
    textAlign: 'center',
  },
  errorContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  errorText: { color: COLORS.danger, marginLeft: 6, fontSize: FONT_SIZES.sm },
  verifyButton: { width: '100%', marginBottom: SPACING.xl },
  hint: { fontSize: FONT_SIZES.sm, color: COLORS.white + '60', textAlign: 'center' },
  adminHeader: { alignItems: 'center', paddingTop: SPACING.xxl, paddingBottom: SPACING.xl },
  adminTitle: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.white, marginTop: SPACING.md },
  adminSubtitle: { fontSize: FONT_SIZES.md, color: COLORS.white + '80', textAlign: 'center', marginTop: 8, paddingHorizontal: SPACING.xl },
  adminContent: { flex: 1, padding: SPACING.lg },
  adminCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: SPACING.md, marginBottom: SPACING.md, flexDirection: 'row', alignItems: 'center' },
  adminCardTitle: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.gray800 },
  adminCardSubtitle: { fontSize: FONT_SIZES.sm, color: COLORS.gray500, marginTop: 2 },
  exitButton: { margin: SPACING.lg },
  adminMenuOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  adminMenuContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40 },
  adminMenuHeader: { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.gray200 },
  adminMenuTitle: { fontSize: FONT_SIZES.lg, fontWeight: '600', color: COLORS.gray800, marginLeft: 8, flex: 1 },
  adminMenuSubtitle: { fontSize: FONT_SIZES.sm, color: COLORS.warning, fontWeight: '500' },
  adminMenuItem: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, paddingHorizontal: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.gray100 },
  adminMenuIconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.gray100, alignItems: 'center', justifyContent: 'center' },
  adminMenuItemContent: { flex: 1, marginLeft: 12 },
  adminMenuItemText: { fontSize: FONT_SIZES.md, color: COLORS.gray800, fontWeight: '500' },
  adminMenuItemSubtext: { fontSize: FONT_SIZES.xs, color: COLORS.gray500, marginTop: 2 },
  dangerMenuItem: { borderBottomWidth: 0, marginTop: SPACING.md },
  dangerText: { color: COLORS.danger },
});

export default AdminVerificationScreen;