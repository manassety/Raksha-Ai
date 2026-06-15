# Create components folder
New-Item -ItemType Directory -Force -Path "C:\RakshaAi\src\components"

# Create GradientBackground.js
@"
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const GradientBackground = ({ children, colors = ['#7c3aed', '#3b82f6'], style }) => {
  return (
    <LinearGradient colors={colors} style={[styles.container, style]}>
      {children}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default GradientBackground;
"@ | Out-File -Encoding UTF8 "C:\RakshaAi\src\components\GradientBackground.js"

# Create GradientButton.js
@"
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../config/theme';

const GradientButton = ({ title, onPress, colors, style, disabled, loading }) => {
  return (
    <TouchableOpacity 
      style={[styles.button, style]} 
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      <LinearGradient 
        colors={colors || COLORS.primary} 
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.white} />
        ) : (
          <Text style={styles.text}>{title}</Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  gradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default GradientButton;
"@ | Out-File -Encoding UTF8 "C:\RakshaAi\src\components\GradientButton.js"

# Create EmergencyButton.js
@"
import React, { useState, useRef, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../config/theme';

const EmergencyButton = ({ onPress, onLongPress, size = 180, isActive }) => {
  const [isPressed, setIsPressed] = useState(false);
  const [progress, setProgress] = useState(0);
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isActive) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isActive]);

  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });
  const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });

  const handlePressIn = () => {
    setIsPressed(true);
    let startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min(elapsed / 3000, 1);
      setProgress(newProgress);
      if (newProgress >= 1) {
        clearInterval(interval);
        onLongPress && onLongPress();
        setProgress(0);
        setIsPressed(false);
      }
    }, 50);
  };

  const handlePressOut = () => {
    if (progress < 1) {
      setIsPressed(false);
      setProgress(0);
    }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      onLongPress={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      <Animated.View style={[
        styles.buttonOuter,
        { transform: [{ scale: isActive ? pulseScale : 1 }] }
      ]}>
        <Animated.View style={[styles.pulseCircle, { opacity: isActive ? pulseOpacity : 0 }]} />
        <Animated.View style={[styles.buttonInner, { backgroundColor: isActive ? COLORS.danger : COLORS.primary }]}>
          <Ionicons name="warning" size={size * 0.3} color={COLORS.white} />
          <Text style={styles.buttonText}>{isActive ? 'ACTIVE' : 'SOS'}</Text>
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonOuter: {
    width: 180,
    height: 180,
    borderRadius: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseCircle: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: COLORS.danger,
  },
  buttonInner: {
    width: 150,
    height: 150,
    borderRadius: 75,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: COLORS.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
  },
});

export default EmergencyButton;
"@ | Out-File -Encoding UTF8 "C:\RakshaAi\src\components\EmergencyButton.js"

# Create LoadingOverlay.js
@"
import React from 'react';
import { View, Text, Modal, ActivityIndicator, StyleSheet } from 'react-native';
import { COLORS } from '../config/theme';

const LoadingOverlay = ({ visible, text = 'Loading...' }) => {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.text}>{text}</Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    minWidth: 150,
  },
  text: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.gray600,
  },
});

export default LoadingOverlay;
"@ | Out-File -Encoding UTF8 "C:\RakshaAi\src\components\LoadingOverlay.js"

# Create SafeCard.js
@"
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../config/theme';

const SafeCard = ({ title, subtitle, icon, iconColor, onPress, rightComponent }) => {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.iconContainer, { backgroundColor: iconColor + '20' }]}>
        <Ionicons name={icon} size={24} color={iconColor} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {rightComponent || <Ionicons name="chevron-forward" size={20} color={COLORS.gray400} />}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.gray800,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.gray500,
    marginTop: 2,
  },
});

export default SafeCard;
"@ | Out-File -Encoding UTF8 "C:\RakshaAi\src\components\SafeCard.js"

# Create AlertCard.js
@"
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../config/theme';

const AlertCard = ({ title, message, timestamp, type, onDismiss, onPress }) => {
  const getColors = () => {
    switch (type) {
      case 'danger': return { bg: COLORS.danger + '20', border: COLORS.danger, icon: COLORS.danger };
      case 'warning': return { bg: COLORS.warning + '20', border: COLORS.warning, icon: COLORS.warning };
      case 'success': return { bg: COLORS.success + '20', border: COLORS.success, icon: COLORS.success };
      default: return { bg: COLORS.info + '20', border: COLORS.info, icon: COLORS.info };
    }
  };

  const colors = getColors();

  return (
    <TouchableOpacity style={[styles.card, { borderLeftColor: colors.border }]} onPress={onPress}>
      <View style={[styles.iconContainer, { backgroundColor: colors.bg }]}>
        <Ionicons name="alert-circle" size={24} color={colors.icon} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <Text style={styles.timestamp}>{new Date(timestamp).toLocaleString()}</Text>
      </View>
      {onDismiss && (
        <TouchableOpacity onPress={onDismiss}>
          <Ionicons name="close" size={20} color={COLORS.gray400} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.gray800,
  },
  message: {
    fontSize: 14,
    color: COLORS.gray600,
    marginTop: 4,
  },
  timestamp: {
    fontSize: 12,
    color: COLORS.gray400,
    marginTop: 4,
  },
});

export default AlertCard;
"@ | Out-File -Encoding UTF8 "C:\RakshaAi\src\components\AlertCard.js"

# Create ContactItem.js
@"
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../config/theme';

const ContactItem = ({ contact, isEmergencyContact, onEdit, onDelete, onSetPrimary }) => {
  return (
    <View style={styles.container}>
      <View style={styles.info}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{contact.name?.charAt(0) || '?'}</Text>
        </View>
        <View style={styles.details}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{contact.name}</Text>
            {contact.isPrimary && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Primary</Text>
              </View>
            )}
          </View>
          <Text style={styles.phone}>{contact.phone}</Text>
          {contact.relation && <Text style={styles.relation}>{contact.relation}</Text>}
        </View>
      </View>
      <View style={styles.actions}>
        {isEmergencyContact && onSetPrimary && (
          <TouchableOpacity style={styles.actionButton} onPress={() => onSetPrimary(contact.id)}>
            <Ionicons name="star" size={20} color={COLORS.warning} />
          </TouchableOpacity>
        )}
        {isEmergencyContact && onEdit && (
          <TouchableOpacity style={styles.actionButton} onPress={() => onEdit(contact)}>
            <Ionicons name="create" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        )}
        {isEmergencyContact && onDelete && (
          <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={() => onDelete(contact.id)}>
            <Ionicons name="trash" size={20} color={COLORS.danger} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: 'bold',
  },
  details: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.gray800,
  },
  badge: {
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 10,
    color: COLORS.primary,
    fontWeight: '600',
  },
  phone: {
    fontSize: 14,
    color: COLORS.gray600,
    marginTop: 2,
  },
  relation: {
    fontSize: 12,
    color: COLORS.gray400,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
  },
  deleteButton: {
    marginLeft: 8,
  },
});

export default ContactItem;
"@ | Out-File -Encoding UTF8 "C:\RakshaAi\src\components\ContactItem.js"
@"
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT_SIZES, BORDER_RADIUS } from '../config/theme';

const PINInput = ({ length = 4, onComplete, onChangeText, value, error, title = 'Enter PIN', showForgotOption = false, onForgotPress }) => {
  const [pin, setPin] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    setPin(value || '');
  }, [value]);

const handleTextChange = (text) => {
    const cleaned = text.replace(/\D/g, '').slice(0, length);
    setPin(cleaned);
    
    if (onChangeText) {
      onChangeText(cleaned);
    }

    if (cleaned.length === length && onComplete) {
      onComplete(cleaned);
    }
  };

  const renderDots = () => {
    const dots = [];
    for (let i = 0; i < length; i++) {
      const isFilled = i < pin.length;
      const isFocused = i === pin.length && pin.length < length;
      
      dots.push(
        <TouchableWithoutFeedback key={i} onPress={() => inputRef.current?.focus()}>
          <View style={[styles.dot, isFilled && styles.dotFilled, isFocused && styles.dotFocused, error && styles.dotError]}>
            {isFilled && <View style={styles.dotInner} />}
          </View>
        </TouchableWithoutFeedback>
      );
    }
    return dots;
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        
        <View style={styles.dotsContainer}>
          {renderDots()}
        </View>

        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          keyboardType="numeric"
          maxLength={length}
          value={pin}
          onChangeText={handleTextChange}
          blurOnSubmit={false}
          caretHidden={true}
        />

        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {showForgotOption && (
          <TouchableOpacity style={styles.forgotButton} onPress={onForgotPress}>
            <Text style={styles.forgotText}>Forgot PIN?</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.gray800,
    marginBottom: 32,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
  },
  dot: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 2,
    borderColor: COLORS.gray300,
    marginHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  dotFilled: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  dotFocused: {
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  dotError: {
    borderColor: COLORS.danger,
    backgroundColor: COLORS.danger + '10',
  },
  dotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  errorText: {
    color: COLORS.danger,
    marginLeft: 6,
    fontSize: FONT_SIZES.sm,
  },
  forgotButton: {
    marginTop: 16,
  },
  forgotText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
  },
});

export default PINInput;
# Create all screens
@"
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import GradientBackground from '../components/GradientBackground';
import EmergencyButton from '../components/EmergencyButton';
import SafeCard from '../components/SafeCard';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';
import { SCREEN_NAMES } from '../config/constants';

const HomeDashboardScreen = () => {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const quickActions = [
    { title: 'Live Tracking', subtitle: 'Track your location', icon: 'location', iconColor: COLORS.secondary, screen: SCREEN_NAMES.LIVE_TRACKING },
    { title: 'Nearby Alerts', subtitle: 'Safety alerts', icon: 'notifications', iconColor: COLORS.warning, screen: SCREEN_NAMES.NEARBY_ALERTS },
    { title: 'Fake Call', subtitle: 'Get a fake call', icon: 'call', iconColor: COLORS.success, screen: SCREEN_NAMES.FAKE_CALL },
    { title: 'Report Complaint', subtitle: 'File a complaint', icon: 'document-text', iconColor: COLORS.info, screen: SCREEN_NAMES.COMPLAINT_REPORT },
  ];

  const safetyFeatures = [
    { title: 'Emergency Contacts', subtitle: 'Manage contacts', icon: 'people', iconColor: COLORS.primary, screen: SCREEN_NAMES.CONTACTS_MANAGER },
    { title: 'Evidence Gallery', subtitle: 'View evidence', icon: 'images', iconColor: '#8b5cf6', screen: SCREEN_NAMES.EVIDENCE_GALLERY },
    { title: 'Safety PIN', subtitle: 'Manage PIN', icon: 'lock-closed', iconColor: COLORS.gray600, screen: SCREEN_NAMES.SAFETY_PIN },
    { title: 'Settings', subtitle: 'App settings', icon: 'settings', iconColor: COLORS.gray600, screen: SCREEN_NAMES.SETTINGS },
  ];

  return (
    <GradientBackground colors={GRADIENTS.primary}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back</Text>
            <Text style={styles.userName}>RakshaAi User</Text>
          </View>
          <TouchableOpacity style={styles.notificationButton}>
            <Ionicons name=\"notifications\" size={24} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          <View style={styles.sosContainer}>
            <EmergencyButton onPress={() => navigation.navigate(SCREEN_NAMES.SOS_EMERGENCY)} />
            <Text style={styles.sosHint}>Hold for 3 seconds to activate</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.quickActionsGrid}>
              {quickActions.map((action, index) => (
                <TouchableOpacity key={index} style={styles.quickActionCard} onPress={() => navigation.navigate(action.screen)} activeOpacity={0.7}>
                  <View style={[styles.quickActionIcon, { backgroundColor: action.iconColor + '20' }]}>
                    <Ionicons name={action.icon} size={28} color={action.iconColor} />
                  </View>
                  <Text style={styles.quickActionTitle}>{action.title}</Text>
                  <Text style={styles.quickActionSubtitle}>{action.subtitle}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Safety Features</Text>
            {safetyFeatures.map((feature, index) => (
              <SafeCard key={index} title={feature.title} subtitle={feature.subtitle} icon={feature.icon} iconColor={feature.iconColor} onPress={() => navigation.navigate(feature.screen)} />
            ))}
          </View>

          <View style={styles.tipsCard}>
            <Text style={styles.tipsTitle}>Safety Tip</Text>
            <Text style={styles.tipsText}>Keep your emergency contacts updated and test your SOS feature regularly.</Text>
          </View>
        </ScrollView>
      </View>
    </GradientBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingTop: SPACING.xl, paddingBottom: SPACING.md },
  greeting: { fontSize: FONT_SIZES.sm, color: COLORS.white + '80' },
  userName: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.white },
  notificationButton: { position: 'relative', padding: 8 },
  scrollView: { flex: 1, backgroundColor: COLORS.gray100, borderTopLeftRadius: 30, borderTopRightRadius: 30, marginTop: SPACING.lg },
  scrollContent: { padding: SPACING.lg },
  sosContainer: { alignItems: 'center', paddingVertical: SPACING.xl },
  sosHint: { marginTop: SPACING.md, color: COLORS.gray500, fontSize: FONT_SIZES.sm },
  section: { marginBottom: SPACING.lg },
  sectionTitle: { fontSize: FONT_SIZES.lg, fontWeight: '600', color: COLORS.gray800, marginBottom: SPACING.md },
  quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  quickActionCard: { width: '48%', backgroundColor: COLORS.white, borderRadius: 16, padding: SPACING.md, marginBottom: SPACING.md, alignItems: 'center' },
  quickActionIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm },
  quickActionTitle: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.gray800, textAlign: 'center' },
  quickActionSubtitle: { fontSize: FONT_SIZES.xs, color: COLORS.gray500, textAlign: 'center', marginTop: 4 },
  tipsCard: { backgroundColor: COLORS.warning + '15', borderRadius: 16, padding: SPACING.md, borderLeftWidth: 4, borderLeftColor: COLORS.warning },
  tipsTitle: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.gray800, marginBottom: 4 },
  tipsText: { fontSize: FONT_SIZES.sm, color: COLORS.gray600, lineHeight: 20 },
});

export default HomeDashboardScreen;
"@ | Out-File -Encoding UTF8 "C:\RakshaAi\src\screens\HomeDashboardScreen.js"

@"
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import GradientBackground from '../components/GradientBackground';
import GradientButton from '../components/GradientButton';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';
import { SCREEN_NAMES } from '../config/constants';

const SOSEmergencyScreen = () => {
  const navigation = useNavigation();
  const [countdown, setCountdown] = useState(3);
  const [showCountdown, setShowCountdown] = useState(false);

  const handleActivate = () => {
    setShowCountdown(true);
    let count = 3;
    const interval = setInterval(() => {
      count--;
      setCountdown(count);
      if (count <= 0) {
        clearInterval(interval);
        setShowCountdown(false);
        setCountdown(3);
        navigation.navigate(SCREEN_NAMES.SAFETY_PIN);
      }
    }, 1000);
  };

  return (
    <GradientBackground colors={GRADIENTS.danger}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name=\"arrow-back\" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.title}>SOS Emergency</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          {showCountdown ? (
            <View style={styles.countdownContainer}>
              <Text style={styles.countdownText}>{countdown}</Text>
              <Text style={styles.countdownLabel}>Activating emergency...</Text>
            </View>
          ) : (
            <>
              <View style={styles.warningIcon}>
                <Ionicons name=\"warning\" size={100} color={COLORS.white} />
              </View>
              
              <Text style={styles.warningTitle}>Are you in an emergency?</Text>
              <Text style={styles.warningDescription}>This will alert your emergency contacts and authorities.</Text>

              <View style={styles.featuresList}>
                <View style={styles.featureItem}>
                  <Ionicons name=\"checkmark-circle\" size={24} color={COLORS.success} />
                  <Text style={styles.featureText}>Alert emergency contacts</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name=\"checkmark-circle\" size={24} color={COLORS.success} />
                  <Text style={styles.featureText}>Record audio evidence</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name=\"checkmark-circle\" size={24} color={COLORS.success} />
                  <Text style={styles.featureText}>Send location to authorities</Text>
                </View>
              </View>

              <GradientButton title=\"ACTIVATE SOS\" onPress={handleActivate} colors={GRADIENTS.danger} style={styles.activateButton} />
            </>
          )}
        </View>
      </View>
    </GradientBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingTop: SPACING.xl, paddingBottom: SPACING.md },
  title: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.white },
  content: { flex: 1, paddingHorizontal: SPACING.lg, paddingTop: SPACING.xl },
  warningIcon: { alignItems: 'center', marginBottom: SPACING.xl },
  warningTitle: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.white, textAlign: 'center', marginBottom: SPACING.md },
  warningDescription: { fontSize: FONT_SIZES.md, color: COLORS.white + '90', textAlign: 'center', lineHeight: 24, marginBottom: SPACING.xl },
  featuresList: { backgroundColor: COLORS.white + '15', borderRadius: 16, padding: SPACING.md, marginBottom: SPACING.xl },
  featureItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  featureText: { fontSize: FONT_SIZES.md, color: COLORS.white, marginLeft: 12 },
  activateButton: { marginBottom: SPACING.md },
  countdownContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  countdownText: { fontSize: 120, fontWeight: 'bold', color: COLORS.white },
  countdownLabel: { fontSize: FONT_SIZES.xl, color: COLORS.white, marginTop: SPACING.md },
});

export default SOSEmergencyScreen;
"@ | Out-File -Encoding UTF8 "C:\RakshaAi\src\screens\SOSEmergencyScreen.js"

@"
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import GradientBackground from '../components/GradientBackground';
import SafeCard from '../components/SafeCard';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';
import { SCREEN_NAMES } from '../config/constants';

const LiveTrackingScreen = () => {
  const navigation = useNavigation();
  const [isTracking, setIsTracking] = useState(false);

  return (
    <GradientBackground colors={GRADIENTS.primary}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name=\"arrow-back\" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.title}>Live Tracking</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          <View style={styles.statusCard}>
            <View style={[styles.statusIndicator, { backgroundColor: isTracking ? COLORS.success : COLORS.gray400 }]}>
              <Ionicons name={isTracking ? \"location\" : \"location-outline\"} size={40} color={COLORS.white} />
            </View>
            <Text style={styles.statusTitle}>{isTracking ? 'Tracking Active' : 'Tracking Inactive'}</Text>
            <Text style={styles.statusSubtitle}>{isTracking ? 'Your location is being monitored' : 'Enable tracking to monitor your location'}</Text>
          </View>

          <SafeCard title="Background Tracking" subtitle={isTracking ? 'Enabled' : 'Disabled'} icon={isTracking ? 'cloud-done' : 'cloud-offline'} iconColor={isTracking ? COLORS.success : COLORS.gray400} onPress={() => setIsTracking(!isTracking)} />

          <SafeCard title="Get Current Location" subtitle="Update your location" icon="refresh" iconColor={COLORS.secondary} onPress={() => {}} />

          <View style={styles.infoCard}>
            <Ionicons name=\"information-circle\" size={24} color={COLORS.info} />
            <Text style={styles.infoText}>Location tracking is automatically enabled during emergencies.</Text>
          </View>
        </View>
      </View>
    </GradientBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingTop: SPACING.xl, paddingBottom: SPACING.md },
  title: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.white },
  content: { flex: 1, backgroundColor: COLORS.gray100, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: SPACING.lg },
  statusCard: { backgroundColor: COLORS.white, borderRadius: 20, padding: SPACING.xl, alignItems: 'center', marginBottom: SPACING.lg },
  statusIndicator: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md },
  statusTitle: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.gray800, marginBottom: 4 },
  statusSubtitle: { fontSize: FONT_SIZES.sm, color: COLORS.gray500 },
  infoCard: { flexDirection: 'row', backgroundColor: COLORS.info + '10', borderRadius: 12, padding: SPACING.md, marginTop: SPACING.lg },
  infoText: { flex: 1, fontSize: FONT_SIZES.sm, color: COLORS.gray600, marginLeft: 8, lineHeight: 20 },
});

export default LiveTrackingScreen;
"@ | Out-File -Encoding UTF8 "C:\RakshaAi\src\screens\LiveTrackingScreen.js"

@"
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import GradientBackground from '../components/GradientBackground';
import AlertCard from '../components/AlertCard';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/constants';

const NearbyAlertsScreen = () => {
  const navigation = useNavigation();
  const [alerts, setAlerts] = useState([
    { id: '1', type: 'danger', title: 'Emergency Alert Nearby', message: 'A user has triggered an emergency alert within 2km.', timestamp: new Date().toISOString() },
    { id: '2', type: 'warning', title: 'Safety Advisory', message: 'Multiple incidents reported in the area.', timestamp: new Date(Date.now() - 3600000).toISOString() },
  ]);

  const dismissAlert = (alertId) => {
    setAlerts(alerts.filter(a => a.id !== alertId));
  };

  return (
    <GradientBackground colors={GRADIENTS.primary}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Nearby Alerts</Text>
          <TouchableOpacity style={styles.filterButton}>
            <Ionicons name=\"filter\" size={24} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{alerts.length}</Text>
            <Text style={styles.statLabel}>Active Alerts</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>2km</Text>
            <Text style={styles.statLabel}>Radius</Text>
          </View>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {alerts.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Recent Alerts</Text>
              {alerts.map((alert) => (
                <AlertCard key={alert.id} title={alert.title} message={alert.message} timestamp={alert.timestamp} type={alert.type} onDismiss={() => dismissAlert(alert.id)} showDismiss />
              ))}
            </>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name=\"checkmark-circle\" size={80} color={COLORS.success} />
              <Text style={styles.emptyTitle}>All Clear!</Text>
              <Text style={styles.emptyText}>No active alerts in your area.</Text>
            </View>
          )}

          <TouchableOpacity style={styles.reportButton}>
            <Ionicons name=\"warning\" size={24} color={COLORS.white} />
            <Text style={styles.reportButtonText}>Report an Incident</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </GradientBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingTop: SPACING.xl, paddingBottom: SPACING.md },
  title: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.white },
  filterButton: { padding: 8, backgroundColor: COLORS.white + '20', borderRadius: 12 },
  statsContainer: { flexDirection: 'row', paddingHorizontal: SPACING.lg, marginBottom: SPACING.lg },
  statCard: { flex: 1, backgroundColor: COLORS.white + '20', borderRadius: 12, padding: SPACING.md, marginHorizontal: 4, alignItems: 'center' },
  statNumber: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.white },
  statLabel: { fontSize: FONT_SIZES.xs, color: COLORS.white + '80', marginTop: 2 },
  scrollView: { flex: 1, backgroundColor: COLORS.gray100, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  scrollContent: { padding: SPACING.lg },
  sectionTitle: { fontSize: FONT_SIZES.lg, fontWeight: '600', color: COLORS.gray800, marginBottom: SPACING.md },
  emptyState: { alignItems: 'center', paddingVertical: SPACING.xxl },
  emptyTitle: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.gray800, marginTop: SPACING.md },
  emptyText: { fontSize: FONT_SIZES.md, color: COLORS.gray500, textAlign: 'center', marginTop: 8 },
  reportButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.danger, borderRadius: 12, padding: SPACING.md, marginBottom: SPACING.lg },
  reportButtonText: { color: COLORS.white, fontSize: FONT_SIZES.md, fontWeight: '600', marginLeft: 8 },
});

export default NearbyAlertsScreen;
"@ | Out-File -Encoding UTF8 "C:\RakshaAi\src\screens\NearbyAlertsScreen.js"

@"
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import GradientBackground from '../components/GradientBackground';
import GradientButton from '../components/GradientButton';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';
import { FAKE_CALLERS } from '../config/constants';

const FakeCallScreen = () => {
  const navigation = useNavigation();
  const [selectedCaller, setSelectedCaller] = useState(null);
  const [isCalling, setIsCalling] = useState(false);

  const handleStartCall = () => {
    if (!selectedCaller) {
      Alert.alert('Select Caller', 'Please select a caller first.');
      return;
    }
    setIsCalling(true);
    setTimeout(() => {
      setIsCalling(false);
      Alert.alert('Call Ended', 'The fake call has ended.');
    }, 5000);
  };

  return (
    <GradientBackground colors={GRADIENTS.primary}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name=\"arrow-back\" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.title}>Fake Call</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          {isCalling ? (
            <View style={styles.callingScreen}>
              <View style={styles.callerAvatar}>
                <Text style={styles.callerAvatarText}>{selectedCaller?.avatar || '?'}</Text>
              </View>
              <Text style={styles.callerName}>{selectedCaller?.name || 'Unknown'}</Text>
              <Text style={styles.callingStatus}>Incoming call...</Text>
              <Text style={styles.timer}>Auto-end in 5s</Text>
              <View style={styles.callActions}>
                <TouchableOpacity style={styles.callButton} onPress={() => setIsCalling(false)}>
                  <Ionicons name=\"call\" size={32} color={COLORS.success} />
                  <Text style={styles.callButtonText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.callButton, styles.declineButton]} onPress={() => setIsCalling(false)}>
                  <Ionicons name=\"call\" size={32} color={COLORS.danger} />
                  <Text style={[styles.callButtonText, styles.declineText]}>Decline</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.infoCard}>
                <Ionicons name=\"information-circle\" size={24} color={COLORS.info} />
                <Text style={styles.infoText}>Get a fake incoming call to excuse yourself from uncomfortable situations.</Text>
              </View>

              <Text style={styles.sectionTitle}>Select Caller</Text>
              <View style={styles.callersList}>
                {FAKE_CALLERS.map((caller) => (
                  <TouchableOpacity key={caller.id} style={[styles.callerCard, selectedCaller?.id === caller.id && styles.callerCardActive]} onPress={() => setSelectedCaller(caller)}>
                    <View style={styles.callerInfo}>
                      <Text style={styles.callerAvatarSmall}>{caller.avatar}</Text>
                      <View style={styles.callerDetails}>
                        <Text style={styles.callerNameSmall}>{caller.name}</Text>
                      </View>
                    </View>
                    {selectedCaller?.id === caller.id && <Ionicons name=\"checkmark-circle\" size={24} color={COLORS.success} />}
                  </TouchableOpacity>
                ))}
              </View>

              <GradientButton title=\"Start Fake Call\" onPress={handleStartCall} colors={GRADIENTS.success} style={styles.startButton} disabled={!selectedCaller} />
            </>
          )}
        </View>
      </View>
    </GradientBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingTop: SPACING.xl, paddingBottom: SPACING.md },
  title: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.white },
  content: { flex: 1, backgroundColor: COLORS.gray100, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: SPACING.lg },
  infoCard: { flexDirection: 'row', backgroundColor: COLORS.info + '10', borderRadius: 12, padding: SPACING.md, marginBottom: SPACING.lg },
  infoText: { flex: 1, fontSize: FONT_SIZES.sm, color: COLORS.gray700, marginLeft: 12, lineHeight: 20 },
  sectionTitle: { fontSize: FONT_SIZES.lg, fontWeight: '600', color: COLORS.gray800, marginBottom: SPACING.md },
  callersList: { marginBottom: SPACING.lg },
  callerCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.white, borderRadius: 12, padding: SPACING.md, marginBottom: 8, borderWidth: 2, borderColor: 'transparent' },
  callerCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '10' },
  callerInfo: { flexDirection: 'row', alignItems: 'center' },
  callerAvatarSmall: { fontSize: 32 },
  callerDetails: { marginLeft: 12 },
  callerNameSmall: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.gray800 },
  startButton: { marginBottom: SPACING.md },
  callingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  callerAvatar: { width: 120, height: 120, borderRadius: 60, backgroundColor: COLORS.primary + '20', alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.lg },
  callerAvatarText: { fontSize: 60 },
  callerName: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.gray800, marginBottom: 4 },
  callingStatus: { fontSize: FONT_SIZES.md, color: COLORS.gray500, marginBottom: 8 },
  timer: { fontSize: FONT_SIZES.sm, color: COLORS.warning, marginBottom: SPACING.xl },
  callActions: { flexDirection: 'row', justifyContent: 'center' },
  callButton: { alignItems: 'center', marginHorizontal: SPACING.xl },
  callButtonText: { fontSize: FONT_SIZES.sm, color: COLORS.success, marginTop: 8 },
  declineButton: { transform: [{ scaleX: -1 }] },
  declineText: { color: COLORS.danger },
});

export default FakeCallScreen;
"@ | Out-File -Encoding UTF8 "C:\RakshaAi\src\screens\FakeCallScreen.js"

@"
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import GradientBackground from '../components/GradientBackground';
import GradientButton from '../components/GradientButton';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';
import { COMPLAINT_CATEGORIES } from '../config/constants';

const ComplaintReportScreen = () => {
  const navigation = useNavigation();
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = () => {
    if (!category || description.length < 10) {
      Alert.alert('Error', 'Please fill in all required fields.');
      return;
    }
    Alert.alert('Success', 'Your complaint has been submitted.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
  };

  return (
    <GradientBackground colors={GRADIENTS.primary}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name=\"arrow-back\" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.title}>Report Complaint</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.infoCard}>
            <Ionicons name=\"shield-checkmark\" size={24} color={COLORS.primary} />
            <Text style={styles.infoText}>Your complaint will be reviewed. In case of emergency, please call 100 immediately.</Text>
          </View>

          <Text style={styles.label}>Category *</Text>
          <View style={styles.categoryGrid}>
            {COMPLAINT_CATEGORIES.map((cat) => (
              <TouchableOpacity key={cat.id} style={[styles.categoryButton, category === cat.id && styles.categoryButtonActive]} onPress={() => setCategory(cat.id)}>
                <Text style={styles.categoryIcon}>{cat.icon}</Text>
                <Text style={[styles.categoryText, category === cat.id && styles.categoryTextActive]}
                                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Description *</Text>
        <TextInput style={styles.textInput} placeholder="Describe the incident in detail..." placeholderTextColor={COLORS.gray400} value={description} onChangeText={setDescription} multiline numberOfLines={4} textAlignVertical="top" />

        <TouchableOpacity style={styles.checkboxRow} onPress={() => {}}>
          <View style={styles.checkbox}><Ionicons name="checkmark" size={16} color={COLORS.white} /></View>
          <Text style={styles.checkboxLabel}>Submit anonymously</Text>
        </TouchableOpacity>

        <GradientButton title="Submit Complaint" onPress={handleSubmit} colors={GRADIENTS.primary} style={styles.submitButton} disabled={!category || description.length < 10} />

        <TouchableOpacity style={styles.emergencyButton}>
          <Ionicons name="call" size={20} color={COLORS.white} />
          <Text style={styles.emergencyButtonText}>Call Emergency (100)</Text>
        </TouchableOpacity>
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
  infoCard: { flexDirection: 'row', backgroundColor: COLORS.primary + '10', borderRadius: 12, padding: SPACING.md, marginBottom: SPACING.lg },
  infoText: { flex: 1, fontSize: FONT_SIZES.sm, color: COLORS.gray700, marginLeft: 12, lineHeight: 20 },
  label: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.gray700, marginBottom: SPACING.sm },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: SPACING.lg },
  categoryButton: { width: '48%', backgroundColor: COLORS.white, borderRadius: 8, padding: SPACING.md, alignItems: 'center', marginBottom: 8, borderWidth: 2, borderColor: 'transparent' },
  categoryButtonActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '10' },
  categoryIcon: { fontSize: 24, marginBottom: 4 },
  categoryText: { fontSize: FONT_SIZES.sm, color: COLORS.gray600, textAlign: 'center' },
  categoryTextActive: { color: COLORS.primary, fontWeight: '600' },
  textInput: { backgroundColor: COLORS.white, borderRadius: 8, padding: SPACING.md, fontSize: FONT_SIZES.md, color: COLORS.gray800, minHeight: 100, marginBottom: SPACING.lg },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.xl },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary },
  checkboxLabel: { fontSize: FONT_SIZES.md, color: COLORS.gray600, marginLeft: 12 },
  submitButton: { marginBottom: SPACING.md },
  emergencyButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.danger, borderRadius: 8, padding: SPACING.md },
  emergencyButtonText: { color: COLORS.white, fontSize: FONT_SIZES.md, fontWeight: '600', marginLeft: 8 },
});

export default ComplaintReportScreen;
"@ | Out-File -Encoding UTF8 "C:\RakshaAi\src\screens\ComplaintReportScreen.js"

@"
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import GradientBackground from '../components/GradientBackground';
import GradientButton from '../components/GradientButton';
import ContactItem from '../components/ContactItem';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';
import { SCREEN_NAMES } from '../config/constants';

const ContactsManagerScreen = () => {
  const navigation = useNavigation();
  const [contacts, setContacts] = useState([
    { id: '1', name: 'Mom', phone: '+1234567890', relation: 'Family', isPrimary: true },
    { id: '2', name: 'Dad', phone: '+1234567891', relation: 'Family', isPrimary: false },
    { id: '3', name: 'Best Friend', phone: '+1234567892', relation: 'Friend', isPrimary: false },
  ]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '', relation: '' });

  const handleAddContact = () => {
    if (!newContact.name || !newContact.phone) {
      Alert.alert('Error', 'Please fill in name and phone.');
      return;
    }
    const contact = { ...newContact, id: Date.now().toString(), isPrimary: contacts.length === 0 };
    setContacts([...contacts, contact]);
    setShowAddModal(false);
    setNewContact({ name: '', phone: '', relation: '' });
    Alert.alert('Success', 'Contact added.');
  };

  const handleRemoveContact = (contactId) => {
    Alert.alert('Remove Contact', 'Are you sure?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => setContacts(contacts.filter(c => c.id !== contactId)) }]);
  };

  const handleSetPrimary = (contactId) => {
    setContacts(contacts.map(c => ({ ...c, isPrimary: c.id === contactId })));
  };

  return (
    <GradientBackground colors={GRADIENTS.primary}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Emergency Contacts</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
            <Ionicons name=\"add\" size={28} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.statsRow}>
            <View style={styles.statCard}><Text style={styles.statNumber}>{contacts.length}</Text><Text style={styles.statLabel}>Contacts</Text></View>
            <View style={styles.statCard}><Text style={styles.statNumber}>{contacts.filter(c => c.isPrimary).length}</Text><Text style={styles.statLabel}>Primary</Text></View>
          </View>

          <View style={styles.infoCard}>
            <Ionicons name=\"information-circle\" size={20} color={COLORS.info} />
            <Text style={styles.infoText}>These contacts will be notified when you activate SOS.</Text>
          </View>

          {contacts.length > 0 ? (
            contacts.map((contact) => (
              <ContactItem key={contact.id} contact={contact} isEmergencyContact onDelete={handleRemoveContact} onSetPrimary={handleSetPrimary} />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name=\"people-outline\" size={60} color={COLORS.gray400} />
              <Text style={styles.emptyTitle}>No Contacts</Text>
              <Text style={styles.emptyText}>Add emergency contacts.</Text>
              <GradientButton title=\"Add Contact\" onPress={() => setShowAddModal(true)} colors={GRADIENTS.primary} style={styles.emptyButton} />
            </View>
          )}
        </ScrollView>

        <Modal visible={showAddModal} animationType=\"slide\" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Contact</Text>
                <TouchableOpacity onPress={() => setShowAddModal(false)}><Ionicons name=\"close\" size={24} color={COLORS.gray500} /></TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScroll}>
                <Text style={styles.label}>Name *</Text>
                <TextInput style={styles.textInput} placeholder=\"Contact name\" placeholderTextColor={COLORS.gray400} value={newContact.name} onChangeText={(text) => setNewContact({ ...newContact, name: text })} />
                <Text style={styles.label}>Phone *</Text>
                <TextInput style={styles.textInput} placeholder=\"Phone number\" placeholderTextColor={COLORS.gray400} keyboardType=\"phone-pad\" value={newContact.phone} onChangeText={(text) => setNewContact({ ...newContact, phone: text })} />
                <Text style={styles.label}>Relationship</Text>
                <TextInput style={styles.textInput} placeholder=\"e.g., Mom, Dad, Friend\" placeholderTextColor={COLORS.gray400} value={newContact.relation} onChangeText={(text) => setNewContact({ ...newContact, relation: text })} />
                <GradientButton title=\"Add Contact\" onPress={handleAddContact} colors={GRADIENTS.primary} style={styles.modalButton} />
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </GradientBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingTop: SPACING.xl, paddingBottom: SPACING.md },
  title: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.white },
  addButton: { backgroundColor: COLORS.white, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  scrollView: { flex: 1, backgroundColor: COLORS.gray100, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  scrollContent: { padding: SPACING.lg },
  statsRow: { flexDirection: 'row', marginBottom: SPACING.lg },
  statCard: { flex: 1, backgroundColor: COLORS.white, borderRadius: 12, padding: SPACING.md, alignItems: 'center', marginHorizontal: 4 },
  statNumber: { fontSize: FONT_SIZES.xxxl, fontWeight: 'bold', color: COLORS.primary },
  statLabel: { fontSize: FONT_SIZES.xs, color: COLORS.gray500 },
  infoCard: { flexDirection: 'row', backgroundColor: COLORS.info + '10', borderRadius: 12, padding: SPACING.md, marginBottom: SPACING.lg },
  infoText: { flex: 1, fontSize: FONT_SIZES.sm, color: COLORS.gray700, marginLeft: 8, lineHeight: 20 },
  emptyState: { alignItems: 'center', paddingVertical: SPACING.xxl },
  emptyTitle: { fontSize: FONT_SIZES.xl, fontWeight: '600', color: COLORS.gray800, marginTop: SPACING.md },
  emptyText: { fontSize: FONT_SIZES.md, color: COLORS.gray500, marginBottom: SPACING.lg },
  emptyButton: { width: 200 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.gray200 },
  modalTitle: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.gray800 },
  modalScroll: { padding: SPACING.lg },
  label: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.gray700, marginBottom: 8 },
  textInput: { backgroundColor: COLORS.gray100, borderRadius: 8, padding: SPACING.md, fontSize: FONT_SIZES.md, color: COLORS.gray800, marginBottom: SPACING.md },
  modalButton: { marginTop: SPACING.md },
});

export default ContactsManagerScreen;
"@ | Out-File -Encoding UTF8 "C:\RakshaAi\src\screens\ContactsManagerScreen.js"

@"
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import GradientBackground from '../components/GradientBackground';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';
import { EVIDENCE_TYPES } from '../config/constants';

const EvidenceGalleryScreen = () => {
  const navigation = useNavigation();
  const [evidence, setEvidence] = useState([
    { id: '1', type: EVIDENCE_TYPES.PHOTO, timestamp: Date.now() - 3600000 },
    { id: '2', type: EVIDENCE_TYPES.AUDIO, timestamp: Date.now() - 7200000 },
  ]);

  const formatDate = (timestamp) => new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const getTypeIcon = (type) => {
    switch (type) {
      case EVIDENCE_TYPES.PHOTO: return 'image';
      case EVIDENCE_TYPES.VIDEO: return 'videocam';
      case EVIDENCE_TYPES.AUDIO: return 'mic';
      default: return 'document';
    }
  };

  const handleDelete = (id) => {
    Alert.alert('Delete', 'Delete this evidence?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => setEvidence(evidence.filter(e => e.id !== id)) }]);
  };

  return (
    <GradientBackground colors={GRADIENTS.primary}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name=\"arrow-back\" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.title}>Evidence Gallery</Text>
          <TouchableOpacity onPress={() => {}}><Ionicons name=\"trash\" size={24} color={COLORS.white} /></TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {evidence.length > 0 ? (
            <View style={styles.evidenceGrid}>
              {evidence.map((item) => (
                <TouchableOpacity key={item.id} style={styles.evidenceCard}>
                  <View style={styles.evidenceThumbnail}>
                    <Ionicons name={getTypeIcon(item.type)} size={40} color={COLORS.white} />
                  </View>
                  <View style={styles.evidenceInfo}>
                    <Ionicons name={getTypeIcon(item.type)} size={14} color={COLORS.gray500} />
                    <Text style={styles.evidenceDate}>{formatDate(item.timestamp)}</Text>
                  </View>
                  <View style={styles.evidenceActions}>
                    <TouchableOpacity style={styles.actionButton} onPress={() => {}}><Ionicons name=\"download\" size={16} color={COLORS.primary} /></TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(item.id)}><Ionicons name=\"trash\" size={16} color={COLORS.danger} /></TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name=\"images-outline\" size={60} color={COLORS.gray400} />
              <Text style={styles.emptyTitle}>No Evidence</Text>
              <Text style={styles.emptyText}>Evidence captured during emergencies will appear here.</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </GradientBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md,   Top: SPACING.xl, paddingBottom: SPACING.md },
  title: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.white },
  scrollView: { flex: 1, backgroundColor: COLORS.gray100, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  scrollContent: { padding: SPACING.md },
  evidenceGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  evidenceCard: { width: '48%', backgroundColor: COLORS.white, borderRadius: 12, marginBottom: SPACING.md, overflow: 'hidden' },
  evidenceThumbnail: { width: '100%', height: 100, backgroundColor: COLORS.gray200, alignItems: 'center', justifyContent: 'center' },
  evidenceInfo: { flexDirection: 'row', alignItems: 'center', padding: 8, borderBottomWidth: 1, borderBottomColor: COLORS.gray100 },
  evidenceDate: { fontSize: FONT_SIZES.xs, color: COLORS.gray500, marginLeft: 4 },
  evidenceActions: { flexDirection: 'row', justifyContent: 'space-around', padding: 8 },
  actionButton: { padding: 8 },
  emptyState: { alignItems: 'center', paddingVertical: SPACING.xxl },
  emptyTitle: { fontSize: FONT_SIZES.xl, fontWeight: '600', color: COLORS.gray800, marginTop: SPACING.md },
  emptyText: { fontSize: FONT_SIZES.md, color: COLORS.gray500, textAlign: 'center', marginTop: 4, paddingHorizontal: SPACING.xl },
});

export default EvidenceGalleryScreen;
"@ | Out-File -Encoding UTF8 "C:\RakshaAi\src\screens\EvidenceGalleryScreen.js"

@"
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import GradientBackground from '../components/GradientBackground';
import PINInput from '../components/PINInput';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';
import * as SecureStore from 'expo-secure-store';

const SafetyPINScreen = () => {
  const navigation = useNavigation();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState('setup');
  const [pinSet, setPinSet] = useState(false);

  const handlePINComplete = async (enteredPin) => {
    if (mode === 'setup') {
      setPin(enteredPin);
      setMode('confirm');
      setError('');
    } else if (mode === 'confirm') {
      if (enteredPin !== pin) {
        setError('PINs do not match. Try again.');
        setPin('');
        setMode('setup');
        return;
      }
      await SecureStore.setItemAsync('safetyPin', enteredPin);
      setPinSet(true);
      setTimeout(() => navigation.goBack(), 1500);
    }
  };

  if (pinSet) {
    return (
      <GradientBackground colors={GRADIENTS.success}>
        <View style={styles.container}>
          <View style={styles.successContent}>
            <Ionicons name=\"checkmark-circle\" size={80} color={COLORS.white} />
            <Text style={styles.successTitle}>Success!</Text>
            <Text style={styles.successText}>Your PIN has been set.</Text>
          </View>
        </View>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground colors={GRADIENTS.primary}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name=\"close\" size={28} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name=\"lock-closed\" size={48} color={COLORS.white} />
          </View>
          <Text style={styles.title}>{mode === 'setup' ? 'Set Up PIN' : 'Confirm PIN'}</Text>
          <Text style={styles.subtitle}>{mode === 'setup' ? 'Create a 4-6 digit PIN' : 'Re-enter your PIN'}</Text>
          <PINInput value={pin} onChangeText={setPin} onComplete={handlePINComplete} error={error} length={6} />
        </View>
      </View>
    </GradientBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: SPACING.md, paddingTop: SPACING.xl },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: SPACING.lg, paddingTop: SPACING.xl },
  iconContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.white + '20', alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.lg },
  title: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.white, textAlign: 'center', marginBottom: SPACING.sm },
  subtitle: { fontSize: FONT_SIZES.md, color: COLORS.white + '80', textAlign: 'center', marginBottom: SPACING.xl },
  successContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.lg },
  successTitle: { fontSize: FONT_SIZES.xxxl, fontWeight: 'bold', color: COLORS.white, marginBottom: SPACING.md },
  successText: { fontSize: FONT_SIZES.lg, color: COLORS.white + '80', textAlign: 'center' },
});

export default SafetyPINScreen;
"@ | Out-File -Encoding UTF8 "C:\RakshaAi\src\screens\SafetyPINScreen.js"

@"
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import GradientBackground from '../components/GradientBackground';
import SafeCard from '../components/SafeCard';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';
import { SCREEN_NAMES } from '../config/constants';

const SettingsScreen = () => {
  const navigation = useNavigation();
  const [settings, setSettings] = useState({ voiceFeedback: true, hapticFeedback: true });

  const toggleSetting = (key) => setSettings(prev => ({ ...prev, [key]: !prev[key] }));

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Logout', style: 'destructive', onPress: () => {} }]);
  };

  const settingsSections = [
    { title: 'Safety', items: [
      { key: 'voiceFeedback', title: 'Voice Feedback', subtitle: 'Audio announcements', icon: 'volume-high', iconColor: COLORS.secondary, hasSwitch: true },
      { key: 'hapticFeedback', title: 'Haptic Feedback', subtitle: 'Vibration feedback', icon: 'phone-portrait', iconColor: COLORS.success, hasSwitch: true },
    ]},
    { title: 'Account', items: [
      { title: 'Edit Profile', subtitle: 'Update your information', icon: 'person', iconColor: COLORS.primary, onPress: () => {} },
      { title: 'Privacy Policy', subtitle: 'Read privacy policy', icon: 'document-text', iconColor: COLORS.info, onPress: () => {} },
      { title: 'Terms of Service', subtitle: 'Read terms', icon: 'document', iconColor: COLORS.gray500, onPress: () => {} },
    ]},
  ];

  return (
    <GradientBackground colors={GRADIENTS.primary}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <TouchableOpacity><Ionicons name=\"person-circle\" size={40} color={COLORS.white} /></TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.userCard}>
            <View style={styles.userAvatar}><Text style={styles.userAvatarText}>T</Text></View>
            <View style={styles.userInfo}><Text style={styles.userName}>RakshaAi User</Text><Text style={styles.userEmail}>user@rakshaai.com</Text></View>
            <TouchableOpacity onPress={handleLogout}><Ionicons name=\"log-out\" size={24} color={COLORS.danger} /></TouchableOpacity>
          </View>

          {settingsSections.map((section, idx) => (
            <View key={idx} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.items.map((item, i) => (
                <SafeCard key={i} title={item.title} subtitle={item.subtitle} icon={item.icon} iconColor={item.iconColor} onPress={item.onPress} rightComponent={item.hasSwitch ? <Switch value={settings[item.key]} onValueChange={() => toggleSetting(item.key)} trackColor={{ false: COLORS.gray300, true: COLORS.primary }} thumbColor={COLORS.white} /> : <Ionicons name=\"chevron-forward\" size={20} color={COLORS.gray400} />} />
              ))}
            </View>
          ))}

          <TouchableOpacity style={styles.adminButton} onPress={() => navigation.navigate(SCREEN_NAMES.ADMIN_VERIFICATION)}>
            <Ionicons name=\"shield\" size={20} color={COLORS.gray500} /><Text style={styles.adminButtonText}>Admin Access</Text>
          </TouchableOpacity>
          <Text style={styles.versionText}>RakshaAi v1.0.0</Text>
        </ScrollView>
      </View>
    </GradientBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingTop: SPACING.xl, paddingBottom: SPACING.md },
  title: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.white },
  scrollView: { flex: 1, backgroundColor: COLORS.gray100, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  scrollContent: { padding: SPACING.lg },
  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 16, padding: SPACING.md, marginBottom: SPACING.lg },
  userAvatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  userAvatarText: { fontSize: 24, fontWeight: 'bold', color: COLORS.white },
  userInfo: { flex: 1, marginLeft: 12 },
  userName: { fontSize: FONT_SIZES.lg, fontWeight: '600', color: COLORS.gray800 },
  userEmail: { fontSize: FONT_SIZES.sm, color: COLORS.gray500 },
  section: { marginBottom: SPACING.lg },
  sectionTitle: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.gray500, marginBottom: SPACING.sm, marginLeft: 4 },
  adminButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: SPACING.md },
  adminButtonText: { color: COLORS.gray500, fontSize: FONT_SIZES.md, marginLeft: 8 },
  versionText: { textAlign: 'center', fontSize: FONT_SIZES.sm, color: COLORS.gray400, marginTop: SPACING.md },
});

export default SettingsScreen;
"@ | Out-File -Encoding UTF8 "C:\RakshaAi\src\screens\SettingsScreen.js"

@"
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
            <Ionicons name=\"arrow-back\" size={24} color={COLORS.white} />
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
  settingTitle: { fontSize: FONT_SIZES.md, fontWeight: '600', COLORS.gray800 },
  settingSubtitle: { fontSize: FONT_SIZES.sm, color: COLORS.gray500 },
});

export default AccessibilityScreen;
"@ | Out-File -Encoding UTF8 "C:\RakshaAi\src\screens\AccessibilityScreen.js"

@"
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import GradientBackground from '../components/GradientBackground';
import GradientButton from '../components/GradientButton';
import PINInput from '../components/PINInput';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';
import * as SecureStore from 'expo-secure-store';

const ADMIN_CODE = 'ADMIN123';

const AdminVerificationScreen = () => {
  const navigation = useNavigation();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isVerified, setIsVerified] = useState(false);

  const handleVerify = async (enteredPin) => {
    if (enteredPin === ADMIN_CODE) {
      await SecureStore.setItemAsync('adminMode', 'true');
      setIsVerified(true);
    } else {
      setError('Invalid admin code');
      setPin('');
    }
  };

  const handleExitAdmin = async () => {
    await SecureStore.deleteItemAsync('adminMode');
    setIsVerified(false);
    navigation.goBack();
  };

  if (isVerified) {
    return (
      <GradientBackground colors={GRADIENTS.dark}>
        <View style={styles.container}>
          <View style={styles.adminHeader}>
            <Ionicons name=\"shield-checkmark\" size={60} color={COLORS.success} />
            <Text style={styles.adminTitle}>Admin Mode Active</Text>
            <Text style={styles.adminSubtitle}>You have full access to administrative features.</Text>
          </View>

          <View style={styles.adminContent}>
            <TouchableOpacity style={styles.adminCard} onPress={() => {}}>
              <Ionicons name=\"people\" size={24} color={COLORS.primary} />
              <Text style={styles.adminCardTitle}>User Management</Text>
              <Text style={styles.adminCardSubtitle}>Manage all registered users</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.adminCard} onPress={() => {}}>
              <Ionicons name=\"analytics\" size={24} color={COLORS.secondary} />
              <Text style={styles.adminCardTitle}>Reports & Analytics</Text>
              <Text style={styles.adminCardSubtitle}>View emergency reports</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.adminCard} onPress={() => {}}>
              <Ionicons name=\"settings\" size={24} color={COLORS.warning} />
              <Text style={styles.adminCardTitle}>System Settings</Text>
              <Text style={styles.adminCardSubtitle}>Configure app settings</Text>
            </TouchableOpacity>
          </View>

          <GradientButton title=\"Exit Admin Mode\" onPress={handleExitAdmin} colors={GRADIENTS.danger} style={styles.exitButton} />
        </View>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground colors={GRADIENTS.primary}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name=\"arrow-back\" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.title}>Admin Verification</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          <View style={styles.lockIcon}>
            <Ionicons name=\"lock-closed\" size={60} color={COLORS.white} />
          </View>
          <Text style={styles.warningTitle}>Restricted Area</Text>
          <Text style={styles.warningText}>Enter the admin code to continue.</Text>
          <PINInput value={pin} onChangeText={setPin} onComplete={handleVerify} error={error} length={7} />
          <Text style={styles.hint}>Contact support if you need the admin code.</Text>
        </View>
      </View>
    </GradientBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingTop: SPACING.xl, paddingBottom: SPACING.md },
  title: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.white },
  content: { flex: 1, paddingHorizontal: SPACING.lg, alignItems: 'center', justifyContent: 'center' },
  lockIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.white + '20', alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.xl },
  warningTitle: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.white, marginBottom: SPACING.md },
  warningText: { fontSize: FONT_SIZES.md, color: COLORS.white + '80', textAlign: 'center', marginBottom: SPACING.xl },
  hint: { fontSize: FONT_SIZES.sm, color: COLORS.white + '60', marginTop: SPACING.xl },
  adminHeader: { alignItems: 'center', paddingTop: SPACING.xxl, paddingBottom: SPACING.xl },
  adminTitle: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.white, marginTop: SPACING.md },
  adminSubtitle: { fontSize: FONT_SIZES.md, color: COLORS.white + '80', textAlign: 'center', marginTop: 8, paddingHorizontal: SPACING.xl },
  adminContent: { flex: 1, padding: SPACING.lg },
  adminCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: SPACING.md, marginBottom: SPACING.md, flexDirection: 'row', alignItems: 'center' },
  adminCardTitle: { flex: 1, fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.gray800, marginLeft: 12 },
  adminCardSubtitle: { fontSize: FONT_SIZES.sm, color: COLORS.gray500, marginLeft: 12 },
  exitButton: { margin: SPACING.lg },
});

export default AdminVerificationScreen;
"@ | Out-File -Encoding UTF8 "C:\RakshaAi\src\screens\AdminVerificationScreen.js"

Write-Host "All files created successfully!"
Write-Host ""
Write-Host "Now run: npx expo start"
Write-Host "Then scan the QR code with Expo Go app!"