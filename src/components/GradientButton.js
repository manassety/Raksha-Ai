import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../config/theme';
import { scale, normalize } from '../utils/responsive';

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
        style={[styles.gradient, (disabled || loading) && styles.disabledGradient]}
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
    borderRadius: scale(12),
    overflow: 'hidden',
  },
  gradient: {
    paddingVertical: scale(16),
    paddingHorizontal: scale(24),
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: COLORS.white,
    fontSize: normalize(16),
    fontWeight: '600',
  },
  disabledGradient: {
    opacity: 0.5,
  },
});


export default GradientButton;
