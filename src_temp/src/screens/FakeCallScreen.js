import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Modal, TextInput, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import GradientBackground from '../components/GradientBackground';
import GradientButton from '../components/GradientButton';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';
import { FAKE_CALLERS, FAKE_CALL_TIMERS } from '../config/constants';

const FakeCallScreen = () => {
  const navigation = useNavigation();
  const [selectedCaller, setSelectedCaller] = useState(FAKE_CALLERS[0]); // Default to first caller
  const [selectedTimer, setSelectedTimer] = useState(10);
  const [callStatus, setCallStatus] = useState('idle'); // 'idle', 'scheduled', 'ringing', 'active'
  const [remainingTime, setRemainingTime] = useState(0);
  const [callDuration, setCallDuration] = useState(0);
  const [showAddCallerModal, setShowAddCallerModal] = useState(false);
  const [newCaller, setNewCaller] = useState({ name: '', number: '', avatar: '👤' });
  const [callers, setCallers] = useState(FAKE_CALLERS);
  const [customTime, setCustomTime] = useState('');
  const [showCustomTime, setShowCustomTime] = useState(false);

  const countdownTimerRef = useRef(null);
  const callDurationTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      stopAllTimers();
    };
  }, []);

  const stopAllTimers = () => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (callDurationTimerRef.current) clearInterval(callDurationTimerRef.current);
  };

  const startFakeCall = () => {
    if (!selectedCaller) {
      Alert.alert('Select Caller', 'Please select a caller first.');
      return;
    }

    const duration = showCustomTime && customTime ? parseInt(customTime) : selectedTimer;
    if (isNaN(duration) || duration <= 0) {
      Alert.alert('Invalid Time', 'Please enter a valid time duration.');
      return;
    }

    setRemainingTime(duration);
    setCallStatus('scheduled');

    countdownTimerRef.current = setInterval(() => {
      setRemainingTime(prev => {
        if (prev <= 1) {
          clearInterval(countdownTimerRef.current);
          setCallStatus('ringing');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const acceptCall = () => {
    setCallStatus('active');
    setCallDuration(0);
    callDurationTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const handleDecline = () => {
    stopAllTimers();
    setCallStatus('idle');
  };

  const endCall = () => {
    stopAllTimers();
    const finalDuration = callDuration;
    setCallStatus('idle');
    setCallDuration(0);

    Alert.alert(
      'Call Ended',
      `The fake call with ${selectedCaller.name} has ended.\nDuration: ${formatDuration(finalDuration)}`,
      [{ text: 'OK' }]
    );
  };

  const cancelScheduledCall = () => {
    stopAllTimers();
    setCallStatus('idle');
    setRemainingTime(0);
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAddCaller = () => {
    if (!newCaller.name) {
      Alert.alert('Error', 'Please enter a name.');
      return;
    }

    const caller = {
      id: Date.now().toString(),
      name: newCaller.name,
      number: newCaller.number || '+1 234 567 8900',
      avatar: newCaller.avatar
    };

    setCallers([...callers, caller]);
    setShowAddCallerModal(false);
    setNewCaller({ name: '', number: '', avatar: '👤' });
    Alert.alert('Success', 'Caller added!');
  };

  const handleDeleteCaller = (callerId) => {
    Alert.alert('Delete Caller', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setCallers(callers.filter(c => c.id !== callerId));
          if (selectedCaller?.id === callerId) {
            setSelectedCaller(callers[0]);
          }
        }
      }
    ]);
  };

  // --- RENDERING LOGIC ---

  if (callStatus === 'scheduled') {
    return (
      <GradientBackground colors={GRADIENTS.dark}>
        <View style={styles.fullscreenOverlay}>
          <SafeAreaView style={styles.centerContent}>
            <View style={styles.scheduledCard}>
              <Ionicons name="time" size={80} color={COLORS.primary} style={styles.pulseIcon} />
              <Text style={styles.scheduledTitle}>Fake Call Scheduled</Text>
              <Text style={styles.scheduledSubtitle}>Calling from {selectedCaller?.name}</Text>

              <View style={styles.countdownBox}>
                <Text style={styles.countdownNumber}>{remainingTime}</Text>
                <Text style={styles.countdownLabel}>seconds remaining</Text>
              </View>

              <TouchableOpacity style={styles.cancelBtn} onPress={cancelScheduledCall}>
                <Text style={styles.cancelBtnText}>CANCEL</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </GradientBackground>
    );
  }

  if (callStatus === 'ringing') {
    return (
      <View style={styles.ringingScreen}>
        <SafeAreaView style={styles.ringingContent}>
          <View style={styles.callerInfoTop}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarLargeText}>{selectedCaller?.avatar}</Text>
            </View>
            <Text style={styles.ringingName}>{selectedCaller?.name}</Text>
            <Text style={styles.ringingNumber}>{selectedCaller?.number || 'Unknown'}</Text>
            <Text style={styles.incomingText}>Incoming Call...</Text>
          </View>

          <View style={styles.incomingActions}>
            <View style={styles.actionItem}>
              <TouchableOpacity style={[styles.roundAction, styles.declineBg]} onPress={handleDecline}>
                <Ionicons name="call" size={32} color={COLORS.white} style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
              <Text style={styles.actionLabel}>Decline</Text>
            </View>

            <View style={styles.actionItem}>
              <TouchableOpacity style={[styles.roundAction, styles.acceptBg]} onPress={acceptCall}>
                <Ionicons name="call" size={32} color={COLORS.white} />
              </TouchableOpacity>
              <Text style={styles.actionLabel}>Accept</Text>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (callStatus === 'active') {
    return (
      <View style={styles.activeCallScreen}>
        <SafeAreaView style={styles.activeCallContent}>
          <View style={styles.callerInfoTop}>
            <Text style={styles.activeCallName}>{selectedCaller?.name}</Text>
            <Text style={styles.activeCallDuration}>{formatDuration(callDuration)}</Text>
          </View>

          <View style={styles.callFeaturesGrid}>
            {[
              { icon: 'mic-off', label: 'mute' },
              { icon: 'keypad', label: 'keypad' },
              { icon: 'volume-high', label: 'speaker' },
              { icon: 'add', label: 'add call' },
              { icon: 'videocam', label: 'FaceTime' },
              { icon: 'person', label: 'contacts' },
            ].map((feature, i) => (
              <View key={i} style={styles.featureItem}>
                <View style={styles.featureIconBox}>
                  <Ionicons name={feature.icon} size={24} color={COLORS.white} />
                </View>
                <Text style={styles.featureLabel}>{feature.label}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={[styles.roundAction, styles.endCallBg, styles.endCallBtn]} onPress={endCall}>
            <Ionicons name="call" size={32} color={COLORS.white} style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <GradientBackground colors={GRADIENTS.primary}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.title}>Fake Call</Text>
          <TouchableOpacity onPress={() => setShowAddCallerModal(true)}>
            <Ionicons name="person-add" size={24} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={24} color={COLORS.info} />
            <Text style={styles.infoText}>
              Schedule a fake call to escape uncomfortable situations. Select a caller and set the timer.
            </Text>
          </View>

          <Text style={styles.sectionTitle}>1. Select Caller</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.callersScroll}>
            <View style={styles.callersRow}>
              {callers.map((caller) => (
                <TouchableOpacity
                  key={caller.id}
                  style={[styles.callerCard, selectedCaller?.id === caller.id && styles.callerCardActive]}
                  onPress={() => {
                    if (caller.id === '5') {
                      setShowAddCallerModal(true);
                    } else {
                      setSelectedCaller(caller);
                    }
                  }}
                >
                  <View style={styles.callerAvatarSmall}>
                    <Text style={styles.callerAvatarSmallText}>{caller.avatar}</Text>
                  </View>
                  <Text style={styles.callerNameSmall} numberOfLines={1}>{caller.name}</Text>
                  {selectedCaller?.id === caller.id && (
                    <View style={styles.selectedBadge}>
                      <Ionicons name="checkmark" size={10} color={COLORS.white} />
                    </View>
                  )}
                  {caller.id !== '1' && caller.id !== '2' && caller.id !== '3' && caller.id !== '4' && caller.id !== '5' && (
                    <TouchableOpacity
                      style={styles.deleteBtnSmall}
                      onPress={() => handleDeleteCaller(caller.id)}
                    >
                      <Ionicons name="close-circle" size={16} color={COLORS.danger} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>


          <Text style={styles.sectionTitle}>2. Set Wait Time</Text>
          <View style={styles.timerGrid}>
            {FAKE_CALL_TIMERS.map((timer) => (
              <TouchableOpacity
                key={timer.id}
                style={[styles.timerButton, !showCustomTime && selectedTimer === timer.value && styles.timerButtonActive]}
                onPress={() => {
                  setSelectedTimer(timer.value);
                  setShowCustomTime(false);
                }}
              >
                <Text style={[styles.timerText, !showCustomTime && selectedTimer === timer.value && styles.timerTextActive]}>
                  {timer.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.customTimerBtn, showCustomTime && styles.timerButtonActive]}
            onPress={() => setShowCustomTime(!showCustomTime)}
          >
            <Ionicons name="create" size={18} color={showCustomTime ? COLORS.white : COLORS.primary} />
            <Text style={[styles.customTimerBtnText, showCustomTime && styles.timerTextActive]}>
              {showCustomTime ? 'Using Custom Time' : 'Set Custom Seconds'}
            </Text>
          </TouchableOpacity>

          {
            showCustomTime && (
              <View style={styles.customTimeContainer}>
                <TextInput
                  style={styles.customTimeInput}
                  placeholder="Enter seconds (e.g. 15)"
                  placeholderTextColor={COLORS.gray400}
                  keyboardType="numeric"
                  value={customTime}
                  onChangeText={setCustomTime}
                  maxLength={4}
                />
              </View>
            )
          }

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Call Details</Text>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Caller:</Text>
              <Text style={styles.summaryValue}>{selectedCaller?.name || 'None'}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Starts in:</Text>
              <Text style={styles.summaryValue}>
                {showCustomTime ? `${customTime || 0} seconds` : `${selectedTimer} seconds`}
              </Text>
            </View>
          </View>

          <GradientButton
            title="START FAKE CALL"
            onPress={startFakeCall}
            colors={GRADIENTS.success}
            style={styles.startButton}
          />

          <View style={styles.tipsCard}>
            <Ionicons name="bulb" size={20} color={COLORS.warning} />
            <Text style={styles.tipsText}>
              Once started, stay on this screen. The call will arrive after the countdown.
            </Text>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView >

        <Modal visible={showAddCallerModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add New Caller</Text>
                <TouchableOpacity onPress={() => setShowAddCallerModal(false)}>
                  <Ionicons name="close" size={24} color={COLORS.gray500} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScroll}>
                <Text style={styles.inputLabel}>Name *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Mom, Boss, Friend..."
                  placeholderTextColor={COLORS.gray400}
                  value={newCaller.name}
                  onChangeText={(text) => setNewCaller({ ...newCaller, name: text })}
                />

                <Text style={styles.inputLabel}>Display Number</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="+1 234 567 890"
                  placeholderTextColor={COLORS.gray400}
                  keyboardType="phone-pad"
                  value={newCaller.number}
                  onChangeText={(text) => setNewCaller({ ...newCaller, number: text })}
                />

                <Text style={styles.inputLabel}>Choose Icon</Text>
                <View style={styles.avatarSelector}>
                  {['👩', '👨', '👔', '👥', '🧑', '👴', '👵', '👨‍💼', '👩‍💼'].map((avatar) => (
                    <TouchableOpacity
                      key={avatar}
                      style={[styles.avatarOption, newCaller.avatar === avatar && styles.avatarOptionSelected]}
                      onPress={() => setNewCaller({ ...newCaller, avatar })}
                    >
                      <Text style={styles.avatarOptionText}>{avatar}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <GradientButton
                  title="Add Caller"
                  onPress={handleAddCaller}
                  colors={GRADIENTS.primary}
                  style={styles.modalButton}
                />
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
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
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
  },
  title: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.white },
  scrollView: { flex: 1, backgroundColor: COLORS.gray100, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  scrollContent: { padding: SPACING.lg },
  infoCard: { flexDirection: 'row', backgroundColor: COLORS.info + '10', borderRadius: 12, padding: SPACING.md, marginBottom: SPACING.lg },
  infoText: { flex: 1, fontSize: FONT_SIZES.sm, color: COLORS.gray700, marginLeft: 12, lineHeight: 20 },
  sectionTitle: { fontSize: FONT_SIZES.md, fontWeight: '700', color: COLORS.gray800, marginBottom: SPACING.md },
  callersScroll: { marginBottom: SPACING.md },
  callersRow: { flexDirection: 'row', paddingRight: SPACING.lg },
  callerCard: { alignItems: 'center', marginRight: SPACING.md, padding: SPACING.sm, borderRadius: 12, backgroundColor: COLORS.white, width: 80, height: 100, justifyContent: 'center', elevation: 2 },
  callerCardActive: { backgroundColor: COLORS.primary + '10', borderWidth: 2, borderColor: COLORS.primary },
  callerAvatarSmall: { width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.gray200, alignItems: 'center', justifyContent: 'center' },
  callerAvatarSmallText: { fontSize: 24 },
  callerNameSmall: { fontSize: 10, color: COLORS.gray600, marginTop: 8, fontWeight: '600', textAlign: 'center' },
  selectedBadge: { position: 'absolute', top: 5, right: 5, width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.success, alignItems: 'center', justifyContent: 'center' },
  timerGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: SPACING.sm },
  timerButton: { width: '31%', backgroundColor: COLORS.white, borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 8, elevation: 1 },
  timerButtonActive: { backgroundColor: COLORS.primary },
  timerText: { fontSize: FONT_SIZES.sm, color: COLORS.primary, fontWeight: '600' },
  timerTextActive: { color: COLORS.white },
  customTimerBtn: { backgroundColor: COLORS.white, borderRadius: 8, padding: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: COLORS.primary },
  customTimerBtnText: { marginLeft: 8, fontSize: FONT_SIZES.sm, color: COLORS.primary, fontWeight: '600' },
  customTimeContainer: { marginTop: SPACING.md, marginBottom: SPACING.sm },
  customTimeInput: { backgroundColor: COLORS.white, borderRadius: 8, padding: 12, fontSize: FONT_SIZES.md, color: COLORS.gray800, borderWidth: 1, borderColor: COLORS.gray300 },
  summaryCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: SPACING.lg, marginBottom: SPACING.xl, elevation: 2 },
  summaryTitle: { fontSize: FONT_SIZES.md, fontWeight: '700', color: COLORS.gray800, marginBottom: 10 },
  summaryDivider: { height: 1, backgroundColor: COLORS.gray200, marginBottom: 15 },
  summaryItem: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel: { fontSize: FONT_SIZES.sm, color: COLORS.gray500 },
  summaryValue: { fontSize: FONT_SIZES.sm, color: COLORS.gray800, fontWeight: '600' },
  startButton: { marginBottom: SPACING.lg, height: 56 },
  tipsCard: { flexDirection: 'row', backgroundColor: COLORS.warning + '15', borderRadius: 12, padding: SPACING.md },
  tipsText: { flex: 1, fontSize: FONT_SIZES.xs, color: COLORS.gray700, marginLeft: 8, lineHeight: 18 },

  // Call States UI
  fullscreenOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, justifyContent: 'center', alignItems: 'center' },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%', padding: 20 },
  scheduledCard: { backgroundColor: COLORS.white, borderRadius: 25, padding: 30, alignItems: 'center', width: '100%', elevation: 10 },
  scheduledTitle: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.gray900, marginTop: 20 },
  scheduledSubtitle: { fontSize: FONT_SIZES.md, color: COLORS.gray600, marginTop: 5 },
  countdownBox: { marginVertical: 40, alignItems: 'center' },
  countdownNumber: { fontSize: 80, fontWeight: 'bold', color: COLORS.primary },
  countdownLabel: { fontSize: FONT_SIZES.sm, color: COLORS.gray400, marginTop: -5 },
  cancelBtn: { paddingVertical: 15, paddingHorizontal: 40, borderRadius: 30, backgroundColor: COLORS.gray200 },
  cancelBtnText: { fontWeight: 'bold', color: COLORS.gray700 },

  ringingScreen: { flex: 1, backgroundColor: '#1c1c1e' },
  ringingContent: { flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingVertical: 60 },
  callerInfoTop: { alignItems: 'center' },
  avatarLarge: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#3a3a3c', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  avatarLargeText: { fontSize: 60 },
  ringingName: { fontSize: 32, fontWeight: '600', color: COLORS.white },
  ringingNumber: { fontSize: 18, color: COLORS.gray400, marginTop: 4 },
  incomingText: { fontSize: 16, color: COLORS.primary, marginTop: 20, fontWeight: '500' },
  incomingActions: { flexDirection: 'row', width: '100%', justifyContent: 'space-around', paddingHorizontal: 40 },
  actionItem: { alignItems: 'center' },
  roundAction: { width: 75, height: 75, borderRadius: 37.5, alignItems: 'center', justifyContent: 'center' },
  declineBg: { backgroundColor: '#ff3b30' },
  acceptBg: { backgroundColor: '#4cd964' },
  actionLabel: { color: COLORS.white, marginTop: 10, fontSize: 14 },

  activeCallScreen: { flex: 1, backgroundColor: '#000' },
  activeCallContent: { flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingVertical: 60 },
  activeCallName: { fontSize: 36, color: COLORS.white, fontWeight: '300' },
  activeCallDuration: { fontSize: 18, color: COLORS.white, marginTop: 10 },
  callFeaturesGrid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', paddingHorizontal: 40 },
  featureItem: { width: '33.33%', alignItems: 'center', marginBottom: 30 },
  featureIconBox: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#1c1c1e', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  featureLabel: { color: COLORS.white, fontSize: 12 },
  endCallBg: { backgroundColor: '#ff3b30' },
  endCallBtn: { marginBottom: 20 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.gray200 },
  modalTitle: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.gray800 },
  modalScroll: { padding: SPACING.lg },
  inputLabel: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.gray700, marginBottom: 8 },
  textInput: { backgroundColor: COLORS.gray100, borderRadius: 8, padding: 12, fontSize: FONT_SIZES.md, color: COLORS.gray800, marginBottom: SPACING.md },
  avatarSelector: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: SPACING.lg, justifyContent: 'center' },
  avatarOption: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: COLORS.gray200, alignItems: 'center', justifyContent: 'center', margin: 5 },
  avatarOptionSelected: { backgroundColor: COLORS.primary, borderWidth: 2, borderColor: COLORS.white },
  avatarOptionText: { fontSize: 20 },
  modalButton: { marginTop: 10 },
  pulseIcon: { opacity: 0.8 },
  deleteBtnSmall: { position: 'absolute', top: -5, right: -5, zIndex: 1 },
});

export default FakeCallScreen;