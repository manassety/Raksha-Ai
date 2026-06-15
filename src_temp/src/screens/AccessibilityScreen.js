import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import GradientBackground from '../components/GradientBackground';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';

const AccessibilityScreen = () => {
  const navigation = useNavigation();
  const [settings, setSettings] = useState({ largeText: false, highContrast: false, voiceFeedback: true, hapticFeedback: true });

  const toggleSetting = (key) => setSettings(prev => ({ ...prev, [key]: !prev[key] }));

  const accessibilityOptions = [
    { title: 'Display', items: [
      { key: 'largeText', title: 'Large Text', subtitle: 'Increase text size', icon: 'text', iconColor: COLORS.primary },
      { key: 'highContrast', title: 'High Contrast', subtitle: 'Better visibility', icon: 'contrast', iconColor: COLORS.warning },
    ]},
    { title: 'Feedback', items: [
      { key: 'voiceFeedback', title: 'Voice Feedback', subtitle: 'Audio announcements', icon: 'volume-high', iconColor: COLORS.info },
      { key: 'hapticFeedback', title: 'Haptic Feedback', subtitle: 'Vibration feedback', icon: 'phone-portrait', iconColor: COLORS.success },
    ]},
  ];

  return (
    <GradientBackground colors={GRADIENTS.primary}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.title}>Accessibility</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.previewCard}>
            <Text style={[styles.previewText, settings.largeText && styles.previewTextLarge]}>Preview Text</Text>
            <Text style={styles.previewSubtext}>{settings.largeText ? 'Text size is increased' : 'Normal text size'}</Text>
          </View>

          {accessibilityOptions.map((section, idx) => (
            <View key={idx} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.items.map((item, i) => (
                <View key={i} style={styles.settingItem}>
                  <View style={styles.settingInfo}>
                    <View style={[styles.settingIcon, { backgroundColor: item.iconColor + '20' }]}>
                      <Ionicons name={item.icon} size={20} color={item.iconColor} />
                    </View>
                    <View style={styles.settingText}>
                      <Text style={styles.settingTitle}>{item.title}</Text>
                      <Text style={styles.settingSubtitle}>{item.subtitle}</Text>
                    </View>
                  </View>
                  <Switch value={settings[item.key]} onValueChange={() => toggleSetting(item.key)} trackColor={{ false: COLORS.gray300, true: COLORS.primary }} thumbColor={COLORS.white} />
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      </View>
    </GradientBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingTop: SPACING.xl, paddingBottom: SPACING.md },
  title: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.white },
  scrollView: { flex: 1, backgroundColor: COLORS.gray100, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  scrollContent: { padding: SPACING.lg },
  previewCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: SPACING.lg, alignItems: 'center', marginBottom: SPACING.lg },
  previewText: { fontSize: 24, fontWeight: 'bold', color: COLORS.gray800 },
  previewTextLarge: { fontSize: 32 },
  previewSubtext: { fontSize: 14, color: COLORS.gray500, marginTop: 4 },
  section: { marginBottom: SPACING.lg },
  sectionTitle: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.gray500, marginBottom: SPACING.sm, marginLeft: 4 },
  settingItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.white, borderRadius: 12, padding: SPACING.md, marginBottom: 8 },
  settingInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 16 },
  settingIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  settingText: { flex: 1, marginLeft: 12 },
  settingTitle: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.gray800 },
  settingSubtitle: { fontSize: FONT_SIZES.sm, color: COLORS.gray500 },
});

export default AccessibilityScreen;
