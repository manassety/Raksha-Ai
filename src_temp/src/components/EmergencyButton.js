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
