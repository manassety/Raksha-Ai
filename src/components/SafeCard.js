import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../config/theme';
import { scale, normalize } from '../utils/responsive';

const SafeCard = ({ title, subtitle, icon, iconColor, onPress, rightComponent }) => {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.iconContainer, { backgroundColor: iconColor + '20' }]}>
        <Ionicons name={icon} size={scale(24)} color={iconColor} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {rightComponent || <Ionicons name="chevron-forward" size={scale(20)} color={COLORS.gray400} />}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: scale(12),
    padding: scale(16),
    marginBottom: scale(8),
  },
  iconContainer: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    marginLeft: scale(12),
  },
  title: {
    fontSize: normalize(16),
    fontWeight: '600',
    color: COLORS.gray800,
  },
  subtitle: {
    fontSize: normalize(12),
    color: COLORS.gray500,
    marginTop: scale(2),
  },
});

export default SafeCard;
