import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar, ActivityIndicator } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useGlobalVoiceSOS } from './src/hooks/useGlobalVoiceSOS';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { COLORS } from './src/config/theme';

import { db } from './src/config/firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import NotificationService from './src/services/NotificationService';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';

// --- ENFORCE GLOBAL NOTIFICATION POPUPS ---
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Import all screens
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import HomeDashboardScreen from './src/screens/HomeDashboardScreen';
import AppLockScreen from './src/screens/AppLockScreen';
import SafetyPINScreen from './src/screens/SafetyPINScreen';
import SOSEmergencyScreen from './src/screens/SOSEmergencyScreen';
import LiveTrackingScreen from './src/screens/LiveTrackingScreen';
import NearbyAlertsScreen from './src/screens/NearbyAlertsScreen';
import FakeCallScreen from './src/screens/FakeCallScreen';
import ComplaintReportScreen from './src/screens/ComplaintReportScreen';
import ContactsManagerScreen from './src/screens/ContactsManagerScreen';
import EvidenceGalleryScreen from './src/screens/EvidenceGalleryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import CrimeAnalysisScreen from './src/screens/CrimeAnalysisScreen';
import AdminVerificationScreen from './src/screens/AdminVerificationScreen';
import ReportsAnalyticsScreen from './src/screens/ReportsAnalyticsScreen';
import UserManagementScreen from './src/screens/UserManagementScreen';
import DatabaseAnalyticsScreen from './src/screens/DatabaseAnalyticsScreen';
import EvidenceBackupScreen from './src/screens/EvidenceBackupScreen';
import TrackChildScreen from './src/screens/TrackChildScreen';
import ChildSetupScreen from './src/screens/ChildSetupScreen';
import AuthoritiesListScreen from './src/screens/AuthoritiesListScreen';
import PINSetupScreen from './src/screens/PINSetupScreen';
import PINInputScreen from './src/screens/PINInputScreen';
import EmailVerificationScreen from './src/screens/emailVerificationScreen';
import AccessibilityScreen from './src/screens/AccessibilityScreen';
import SOSRecordingScreen from './src/screens/SOSRecordingScreen';
import AdminSetupScreen from './src/screens/AdminSetupScreen';
import AdminPanel from './src/screens/AdminPanelScreen';
import MainAdminPanel from './src/screens/MainAdminPanelScreen';
import ComplaintDashboard from './src/screens/ComplaintDashboardScreen';
import LiveSOSMonitorScreen from './src/screens/LiveSOSMonitorScreen';




const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Bottom Tab Navigator
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Tracking') {
            iconName = focused ? 'location' : 'location-outline';
          } else if (route.name === 'Alerts') {
            iconName = focused ? 'notifications' : 'notifications-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.gray400,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopWidth: 0,
          elevation: 10,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeDashboardScreen} />
      <Tab.Screen name="Tracking" component={LiveTrackingScreen} />
      <Tab.Screen name="Alerts" component={NearbyAlertsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function AppContent() {
  const { user, loading: authLoading } = useAuth();
  const [appLoading, setAppLoading] = useState(true);
  const navigationRef = useNavigationContainerRef();

  // Enable global background microphone listening
  useGlobalVoiceSOS(user, navigationRef);

  useEffect(() => {
    if (!authLoading) {
      setAppLoading(false);
    }
  }, [authLoading]);

  // --- GLOBAL SOS LISTENER ---
  useEffect(() => {
    if (!user) return;

    // Initialize notification service
    NotificationService.initialize();

    // Listen for ongoing alerts (Single-field query to avoid composite index errors)
    const q = query(
      collection(db, 'alerts'),
      where('status', '==', 'ongoing')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const alertData = change.doc.data();

          // Filter for SOS type and target users in JS to stay index-friendly
          const isTarget = alertData.broadcastToAll === true || (alertData.targetUsers && alertData.targetUsers.includes(user.uid));

          if (alertData.type === 'sos' && isTarget && alertData.triggeredBy !== user.uid) {
            NotificationService.sendEmergencyAlert({
              title: '🚨 EMERGENCY NEARBY',
              body: alertData.message || 'Someone nearby needs help immediately!',
              data: { alertId: change.doc.id, ...alertData }
            });
          }
        }
      });
    });

    return () => unsubscribe();
  }, [user]);

  if (authLoading || appLoading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading SafeHer...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="AppLock" component={AppLockScreen} />
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="SafetyPIN" component={SafetyPINScreen} />
            <Stack.Screen name="SOSEmergency" component={SOSEmergencyScreen} />
            <Stack.Screen name="FakeCall" component={FakeCallScreen} />
            <Stack.Screen name="ComplaintReport" component={ComplaintReportScreen} />
            <Stack.Screen name="ContactsManager" component={ContactsManagerScreen} />
            <Stack.Screen name="EvidenceGallery" component={EvidenceGalleryScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen name="CrimeAnalysis" component={CrimeAnalysisScreen} />
            <Stack.Screen name="AdminVerification" component={AdminVerificationScreen} />
            <Stack.Screen name="ReportsAnalytics" component={ReportsAnalyticsScreen} />
            <Stack.Screen name="UserManagement" component={UserManagementScreen} />
            <Stack.Screen name="DatabaseAnalytics" component={DatabaseAnalyticsScreen} />
            <Stack.Screen name="EvidenceBackup" component={EvidenceBackupScreen} />
            <Stack.Screen name="TrackChild" component={TrackChildScreen} />
            <Stack.Screen name="ChildSetup" component={ChildSetupScreen} />
            <Stack.Screen name="AuthoritiesList" component={AuthoritiesListScreen} />
            <Stack.Screen name="PINSetupScreen" component={PINSetupScreen} />
            <Stack.Screen name="PINInput" component={PINInputScreen} />
            <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} />
            <Stack.Screen name="Accessibility" component={AccessibilityScreen} />
            <Stack.Screen name="SOSRecording" component={SOSRecordingScreen} />
            <Stack.Screen name="AdminSetup" component={AdminSetupScreen} />
            <Stack.Screen name="AdminPanel" component={AdminPanel} />
            <Stack.Screen name="MainAdminPanel" component={MainAdminPanel} />
            <Stack.Screen name="ComplaintDashboard" component={ComplaintDashboard} />
            <Stack.Screen name="LiveSOSMonitor" component={LiveSOSMonitorScreen} />

          </>


        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.gray900,
  },
  loadingText: {
    color: COLORS.white,
    fontSize: 16,
    marginTop: 16,
    fontWeight: '500',
  },
});