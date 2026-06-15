import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../config/theme';

// Import all screens
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import HomeDashboardScreen from '../screens/HomeDashboardScreen';
import SOSEmergencyScreen from '../screens/SOSEmergencyScreen';
import LiveTrackingScreen from '../screens/LiveTrackingScreen';
import NearbyAlertsScreen from '../screens/NearbyAlertsScreen';
import FakeCallScreen from '../screens/FakeCallScreen';
import ComplaintReportScreen from '../screens/ComplaintReportScreen';
import ContactsManagerScreen from '../screens/ContactsManagerScreen';
import EvidenceGalleryScreen from '../screens/EvidenceGalleryScreen';
import SafetyPINScreen from '../screens/SafetyPINScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AdminVerificationScreen from '../screens/AdminVerificationScreen';
import AdminPanel from '../screens/AdminPanelScreen'; // ✅ Corrected path
import MainAdminPanel from '../screens/MainAdminPanelScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import ReportsAnalyticsScreen from '../screens/ReportsAnalyticsScreen';
import DatabaseAnalyticsScreen from '../screens/DatabaseAnalyticsScreen';
import AppLockScreen from '../screens/AppLockScreen';
import PINSetupScreen from '../screens/PINSetupScreen';
import PINInputScreen from '../screens/PINInputScreen';
import CrimeAnalysisScreen from '../screens/CrimeAnalysisScreen';
import ChildSetupScreen from '../screens/ChildSetupScreen';
import TrackChildScreen from '../screens/TrackChildScreen';
import AuthoritiesListScreen from '../screens/AuthoritiesListScreen';
import emailVerificationScreen from '../screens/emailVerificationScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Auth Stack
const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="LoginScreen" component={LoginScreen} />
    <Stack.Screen name="SignupScreen" component={SignupScreen} />
    <Stack.Screen name="ForgotPasswordScreen" component={ForgotPasswordScreen} />
  </Stack.Navigator>
);

// Tab Navigator
const TabNavigator = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      tabBarIcon: ({ focused, color, size }) => {
        let iconName;
        if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
        else if (route.name === 'Tracking') iconName = focused ? 'location' : 'location-outline';
        else if (route.name === 'Alerts') iconName = focused ? 'notifications' : 'notifications-outline';
        else if (route.name === 'Settings') iconName = focused ? 'settings' : 'settings-outline';
        return <Ionicons name={iconName} size={size} color={color} />;
      },
      tabBarActiveTintColor: COLORS.primary,
      tabBarInactiveTintColor: COLORS.gray400,
      headerShown: false,
      tabBarStyle: { backgroundColor: COLORS.white, borderTopWidth: 0, elevation: 10, height: 60, paddingBottom: 8, paddingTop: 8 },
    })}
  >
    <Tab.Screen name="Home" component={HomeDashboardScreen} />
    <Tab.Screen name="Tracking" component={LiveTrackingScreen} />
    <Tab.Screen name="Alerts" component={NearbyAlertsScreen} />
    <Tab.Screen name="Settings" component={SettingsScreen} />
  </Tab.Navigator>
);

// Main App Stack (after login)
const MainStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="MainTabs" component={TabNavigator} />
    <Stack.Screen name="SOSEmergency" component={SOSEmergencyScreen} />
    <Stack.Screen name="FakeCall" component={FakeCallScreen} />
    <Stack.Screen name="ComplaintReport" component={ComplaintReportScreen} />
    <Stack.Screen name="ContactsManager" component={ContactsManagerScreen} />
    <Stack.Screen name="EvidenceGallery" component={EvidenceGalleryScreen} />
    <Stack.Screen name="SafetyPIN" component={SafetyPINScreen} />
    <Stack.Screen name="AdminVerification" component={AdminVerificationScreen} />
    <Stack.Screen name="AdminPanel" component={AdminPanel} /> {/* ✅ Added AdminPanel screen */}
    <Stack.Screen name="MainAdminPanel" component={MainAdminPanel} />
    <Stack.Screen name="EditProfile" component={EditProfileScreen} />
    <Stack.Screen name="ReportsAnalytics" component={ReportsAnalyticsScreen} />
    <Stack.Screen name="DatabaseAnalytics" component={DatabaseAnalyticsScreen} />
    <Stack.Screen name="CrimeAnalysis" component={CrimeAnalysisScreen} />
    <Stack.Screen name="ChildSetup" component={ChildSetupScreen} />
    <Stack.Screen name="TrackChild" component={TrackChildScreen} />
    <Stack.Screen name="AuthoritiesList" component={AuthoritiesListScreen} />
    <Stack.Screen name="emailVerification" component={emailVerificationScreen} />
  </Stack.Navigator>
);

// Root Navigator
const RootNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="AppLock" component={AppLockScreen} />
    <Stack.Screen name="PINSetupScreen" component={PINSetupScreen} />
    <Stack.Screen name="PINInput" component={PINInputScreen} />
    <Stack.Screen name="MainApp" component={MainStack} />
    <Stack.Screen name="Auth" component={AuthStack} />
  </Stack.Navigator>
);

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>
  );
}