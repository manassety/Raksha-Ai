import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import GradientBackground from '../components/GradientBackground';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const SafetyPINScreen = ({ route }) => {
  const navigation = useNavigation();
  const { fromScreen } = route?.params || {};

  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [mode, setMode] = useState('setup'); // 'setup' or 'verify'
  const [step, setStep] = useState(1); // 1 = enter, 2 = confirm
  const [loading, setLoading] = useState(false);
  const [savedPIN, setSavedPIN] = useState(null);

  useEffect(() => {
    checkExistingPIN();
  }, []);

  const checkExistingPIN = async () => {
    try {
      const user = getAuth().currentUser;
      if (!user) {
        setMode('setup');
        return;
      }

      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const data = userDoc.data();
        const savedPin = data.safetyPIN || data.safetyPin || data.pin;

        if (savedPin) {
          setSavedPIN(savedPin);
          setMode('verify');
        } else {
          setMode('setup');
        }
      } else {
        setMode('setup');
      }
    } catch (error) {
      console.error('Error checking PIN status:', error);
      setMode('setup');
    }
  };

  const handleNumberPress = (number) => {
    if (pin.length < 6) {
      const newPin = pin + number;
      setPin(newPin);

      if (newPin.length === 6) {
        setTimeout(() => handlePINSubmit(newPin), 300);
      }
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
  };

  const handlePINSubmit = async (enteredPin) => {
    setLoading(true);

    try {
      if (mode === 'verify') {
        // Verify PIN against Firebase
        const user = getAuth().currentUser;
        if (!user) {
          Alert.alert('Error', 'User not logged in.');
          setLoading(false);
          return;
        }

        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const data = userDoc.data();
          const savedPin = data.safetyPIN || data.safetyPin || data.pin;

          if (enteredPin === savedPin) {
            // PIN is correct
            if (fromScreen === 'SOS') {
              navigation.goBack();
            } else {
              navigation.replace('MainTabs');
            }
          } else {
            Alert.alert('Wrong PIN', 'The PIN you entered is incorrect.');
            setPin('');
          }
        } else {
          Alert.alert('Error', 'User data not found.');
        }
      } else if (mode === 'setup') {
        if (step === 1) {
          // First entry - move to confirmation
          setStep(2);
          setPin('');
        } else if (step === 2) {
          // Confirmation - save PIN
          if (enteredPin !== pin) {
            Alert.alert('PINs do not match', 'Please try again.');
            setPin('');
            setConfirmPin('');
            setStep(1);
            setLoading(false);
            return;
          }

          // Save PIN to Firebase
          const user = getAuth().currentUser;
          if (!user) {
            Alert.alert('Error', 'User not logged in.');
            setLoading(false);
            return;
          }

          await setDoc(doc(db, 'users', user.uid), {
            safetyPIN: enteredPin,
            safetyPINUpdatedAt: new Date().toISOString(),
          }, { merge: true });

          setSavedPIN(enteredPin);
          setMode('verify');
          setPin('');
          setConfirmPin('');
          setStep(1);

          Alert.alert('Success', 'Safety PIN has been saved!', [
            {
              text: 'OK',
              onPress: () => {
                if (fromScreen === 'SOS') {
                  navigation.goBack();
                } else {
                  navigation.replace('MainTabs');
                }
              }
            }
          ]);
        }
      }
    } catch (error) {
      console.error('Error in PIN submission:', error);
      Alert.alert('Error', 'Failed to process PIN. Please try again.');
    }

    setLoading(false);
  };

  const handleRemovePIN = async () => {
    Alert.alert(
      'Remove Safety PIN',
      'Are you sure you want to remove your Safety PIN?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const user = getAuth().currentUser;
              if (!user) {
                Alert.alert('Error', 'User not logged in.');
                setLoading(false);
                return;
              }

              await setDoc(doc(db, 'users', user.uid), {
                safetyPIN: null,
                safetyPINUpdatedAt: new Date().toISOString(),
              }, { merge: true });

              setSavedPIN(null);
              setMode('setup');
              setPin('');
              setConfirmPin('');
              setStep(1);

              Alert.alert('Success', 'Safety PIN has been removed.');
            } catch (error) {
              console.error('Error removing PIN:', error);
              Alert.alert('Error', 'Failed to remove Safety PIN.');
            }
            setLoading(false);
          }
        }
      ]
    );
  };

  const renderPinDots = (pinValue) => {
    const dots = [];
    for (let i = 0; i < 6; i++) {
      dots.push(
        <View
          key={i}
          style={[
            styles.pinDot,
            i < pinValue.length && styles.pinDotFilled
          ]}
        />
      );
    }
    return dots;
  };

  const renderNumberPad = () => {
    const numbers = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['', '0', 'back']
    ];

    return numbers.map((row, rowIndex) => (
      <View key={rowIndex} style={styles.numberRow}>
        {row.map((item, index) => {
          if (item === '') {
            return <View key={index} style={styles.numberButton} />;
          }
          if (item === 'back') {
            return (
              <TouchableOpacity
                key={index}
                style={styles.numberButton}
                onPress={handleBackspace}
              >
                <Ionicons name="backspace" size={24} color={COLORS.white} />
              </TouchableOpacity>
            );
          }
          return (
            <TouchableOpacity
              key={index}
              style={styles.numberButton}
              onPress={() => handleNumberPress(item)}
            >
              <Text style={styles.numberText}>{item}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    ));
  };

  const getTitle = () => {
    if (mode === 'verify') {
      return '🔒 Enter Safety PIN';
    }
    if (mode === 'setup') {
      if (step === 1) {
        return '🔐 Create Safety PIN';
      } else {
        return '✅ Confirm Your PIN';
      }
    }
    return 'Safety PIN';
  };

  const getSubtitle = () => {
    if (mode === 'verify') {
      return 'Enter your 6-digit PIN to continue';
    }
    if (mode === 'setup') {
      if (step === 1) {
        return 'Create a 6-digit PIN for emergencies';
      } else {
        return 'Re-enter your PIN to confirm';
      }
    }
    return '';
  };

  return (
    <GradientBackground colors={GRADIENTS.dark}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Safety PIN</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="lock-closed" size={50} color={COLORS.white} />
            </View>
          </View>

          <Text style={styles.title}>{getTitle()}</Text>
          <Text style={styles.subtitle}>{getSubtitle()}</Text>

          <View style={styles.pinContainer}>
            {renderPinDots(pin)}
          </View>

          <View style={styles.numberPad}>
            {renderNumberPad()}
          </View>

          {mode === 'verify' && savedPIN && (
            <View style={styles.verifyActions}>
              <TouchableOpacity
                style={styles.changeButton}
                onPress={() => {
                  setPin('');
                  setStep(1);
                  setMode('setup');
                }}
              >
                <Ionicons name="create" size={20} color={COLORS.primary} />
                <Text style={styles.changeButtonText}>Change PIN</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.removeButton}
                onPress={handleRemovePIN}
              >
                <Ionicons name="trash" size={20} color={COLORS.danger} />
                <Text style={styles.removeButtonText}>Remove PIN</Text>
              </TouchableOpacity>
            </View>
          )}

          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={COLORS.white} />
              <Text style={styles.loadingText}>
                {mode === 'verify' ? 'Verifying...' : 'Saving PIN...'}
              </Text>
            </View>
          )}
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
    paddingBottom: SPACING.md,
  },
  headerTitle: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.white },
  content: { flex: 1, padding: SPACING.lg, alignItems: 'center', justifyContent: 'center' },
  iconContainer: { marginBottom: SPACING.xl, marginTop: SPACING.xxl },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.white + '20',
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.white, marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: FONT_SIZES.md, color: COLORS.white + '80', marginBottom: SPACING.xl, textAlign: 'center' },
  pinContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: SPACING.xl },
  pinDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.white + '50',
    marginHorizontal: 8
  },
  pinDotFilled: { backgroundColor: COLORS.white, borderColor: COLORS.white },
  numberPad: { width: '100%', maxWidth: 280 },
  numberRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  numberButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: COLORS.white + '20',
    alignItems: 'center',
    justifyContent: 'center'
  },
  numberText: { fontSize: 28, fontWeight: '600', color: COLORS.white },
  verifyActions: { marginTop: SPACING.lg, width: '100%' },
  changeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white + '10',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    marginBottom: 12
  },
  changeButtonText: { color: COLORS.primary, fontSize: FONT_SIZES.md, fontWeight: '600', marginLeft: 8 },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24
  },
  removeButtonText: { color: COLORS.danger, fontSize: FONT_SIZES.md },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: { color: COLORS.white, marginTop: SPACING.md, fontSize: FONT_SIZES.md },
});

export default SafetyPINScreen;