import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import GradientBackground from '../components/GradientBackground';
import EmergencyButton from '../components/EmergencyButton';
import SafeCard from '../components/SafeCard';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';

const HomeDashboardScreen = () => {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const { user, userData } = useAuth();
  const [unreadAlertsCount, setUnreadAlertsCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    // Real-time listener for unread alerts
    const alertsQuery = query(
      collection(db, 'alerts'),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(alertsQuery, (snapshot) => {
      // If no real alerts exist yet, we can optionally handle demo alerts logic here
      // but typically we only count real DB entries for the badge
      setUnreadAlertsCount(snapshot.size);
    }, (error) => {
      console.error('Error listening to unread alerts:', error);
    });

    return () => unsubscribe();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const quickActions = [
    { title: 'Live Tracking', subtitle: 'Track your location', icon: 'location', iconColor: COLORS.secondary, screen: 'Tracking' },
    { title: 'Complaint Status', subtitle: 'Track your reports', icon: 'stats-chart', iconColor: COLORS.primary, screen: 'ComplaintDashboard' },
    { title: 'Nearby Alerts', subtitle: 'Safety alerts', icon: 'notifications', iconColor: COLORS.warning, screen: 'Alerts' },
    { title: 'Report Complaint', subtitle: 'File a complaint', icon: 'document-text', iconColor: COLORS.info, screen: 'ComplaintReport' },
    { title: 'Fake Call', subtitle: 'Get a fake call', icon: 'call', iconColor: COLORS.success, screen: 'FakeCall' },
  ];

  const safetyFeatures = [
    { title: 'Emergency Contacts', subtitle: 'Manage contacts', icon: 'people', iconColor: COLORS.primary, screen: 'ContactsManager' },
    { title: 'Evidence Gallery', subtitle: 'View evidence', icon: 'images', iconColor: '#8b5cf6', screen: 'EvidenceGallery' },
    { title: 'Safety PIN', subtitle: 'Manage PIN', icon: 'lock-closed', iconColor: COLORS.gray600, screen: 'SafetyPIN' },
    { title: 'Crime Analysis', subtitle: 'View statistics', icon: 'stats-chart', iconColor: COLORS.danger, screen: 'CrimeAnalysis' },
    { title: 'Edit Profile', subtitle: 'Update profile', icon: 'person', iconColor: COLORS.info, screen: 'EditProfile' },
  ];

  return (
    <GradientBackground colors={GRADIENTS.primary}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back</Text>
            <Text style={styles.userName}>{userData?.name || user?.email?.split('@')[0] || 'Tanprix User'}</Text>
          </View>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => navigation.navigate('Alerts')}
          >
            <Ionicons name="notifications" size={24} color={COLORS.white} />
            {unreadAlertsCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadAlertsCount > 9 ? '9+' : unreadAlertsCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* SOS Emergency Button */}
          <View style={styles.sosContainer}>
            <EmergencyButton onPress={() => navigation.navigate('SOSEmergency')} />
            <Text style={styles.sosHint}>Hold for 3 seconds to activate SOS</Text>
          </View>

          {/* Quick Actions Grid */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.quickActionsGrid}>
              {quickActions.map((action, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.quickActionCard}
                  onPress={() => navigation.navigate(action.screen)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: action.iconColor + '20' }]}>
                    <Ionicons name={action.icon} size={28} color={action.iconColor} />
                  </View>
                  <Text style={styles.quickActionTitle}>{action.title}</Text>
                  <Text style={styles.quickActionSubtitle}>{action.subtitle}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Safety Features */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Safety Features</Text>
            {safetyFeatures.map((feature, index) => (
              <SafeCard
                key={index}
                title={feature.title}
                subtitle={feature.subtitle}
                icon={feature.icon}
                iconColor={feature.iconColor}
                onPress={() => navigation.navigate(feature.screen)}
              />
            ))}
          </View>

          {/* Safety Tip Card */}
          <View style={styles.tipsCard}>
            <View style={styles.tipsHeader}>
              <Ionicons name="bulb" size={20} color={COLORS.warning} />
              <Text style={styles.tipsTitle}>Safety Tip</Text>
            </View>
            <Text style={styles.tipsText}>Keep your emergency contacts updated and test your SOS feature regularly.</Text>
          </View>

          {/* Bottom Spacing */}
          <View style={styles.bottomSpacing} />
        </ScrollView>
      </View>
    </GradientBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
  },
  greeting: { fontSize: FONT_SIZES.sm, color: COLORS.white + '80' },
  userName: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.white },
  notificationButton: { position: 'relative', padding: 8 },
  notificationBadge: { position: 'absolute', top: 2, right: 2, backgroundColor: COLORS.danger, borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  notificationBadgeText: { color: COLORS.white, fontSize: 10, fontWeight: 'bold' },
  scrollView: { flex: 1, backgroundColor: COLORS.gray100, borderTopLeftRadius: 30, borderTopRightRadius: 30, marginTop: SPACING.lg },
  scrollContent: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  sosContainer: { alignItems: 'center', paddingVertical: SPACING.xl },
  sosHint: { marginTop: SPACING.md, color: COLORS.gray500, fontSize: FONT_SIZES.sm },
  section: { marginBottom: SPACING.lg },
  sectionTitle: { fontSize: FONT_SIZES.lg, fontWeight: '600', color: COLORS.gray800, marginBottom: SPACING.md },
  quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  quickActionCard: { width: '48%', backgroundColor: COLORS.white, borderRadius: 16, padding: SPACING.md, marginBottom: SPACING.md, alignItems: 'center', shadowColor: COLORS.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  quickActionIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm },
  quickActionTitle: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.gray800, textAlign: 'center' },
  quickActionSubtitle: { fontSize: FONT_SIZES.xs, color: COLORS.gray500, textAlign: 'center', marginTop: 4 },
  tipsCard: { backgroundColor: COLORS.warning + '15', borderRadius: 16, padding: SPACING.md, borderLeftWidth: 4, borderLeftColor: COLORS.warning },
  tipsHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  tipsTitle: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.gray800, marginLeft: 8 },
  tipsText: { fontSize: FONT_SIZES.sm, color: COLORS.gray600, lineHeight: 20 },
  bottomSpacing: { height: SPACING.xxl },
});

export default HomeDashboardScreen;