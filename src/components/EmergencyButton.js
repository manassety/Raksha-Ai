import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, Text, Animated, Easing, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { scale, normalize } from '../utils/responsive';
import { COLORS } from '../config/theme';

const EmergencyButton = ({ onPress, size = scale(180), isActive }) => {
  const [isPressed, setIsPressed] = useState(false);
  const pulseAnim = useRef(new Animated.Value(0)).current;

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

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      activeOpacity={0.9}
    >
      <Animated.View style={[
        styles.buttonOuter,
        { transform: [{ scale: isActive ? pulseScale : 1 }] }
      ]}>
        <Animated.View style={[styles.pulseCircle, { opacity: isActive ? pulseOpacity : 0 }]} />
        <Animated.View style={[
          styles.buttonInner,
          {
            backgroundColor: isActive ? COLORS.danger : COLORS.primary,
            transform: [{ scale: isPressed && !isActive ? 0.95 : 1 }]
          }
        ]}>
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
    width: scale(180),
    height: scale(180),
    borderRadius: scale(90),
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRing: {
    position: 'absolute',
    width: scale(150),
    height: scale(150),
    borderRadius: scale(75),
    borderColor: COLORS.danger,
    borderWidth: 0,
    zIndex: -1,
  },
  pulseCircle: {
    position: 'absolute',
    width: scale(180),
    height: scale(180),
    borderRadius: scale(90),
    backgroundColor: COLORS.danger,
  },
  buttonInner: {
    width: scale(150),
    height: scale(150),
    borderRadius: scale(75),
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
    fontSize: normalize(24),
    fontWeight: 'bold',
    marginTop: scale(8),
  },
  holdText: {
    color: COLORS.white,
    fontSize: normalize(12),
    fontWeight: 'bold',
    position: 'absolute',
    bottom: scale(15),
    opacity: 0.8,
  }
});

export default EmergencyButton;
