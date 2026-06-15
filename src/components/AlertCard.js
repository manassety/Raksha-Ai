import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../config/theme';
import { scale, normalize } from '../utils/responsive';

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
        <Ionicons name="alert-circle" size={scale(24)} color={colors.icon} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <Text style={styles.timestamp}>{new Date(timestamp).toLocaleString()}</Text>
      </View>
      {onDismiss && (
        <TouchableOpacity onPress={onDismiss}>
          <Ionicons name="close" size={scale(20)} color={COLORS.gray400} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: scale(12),
    padding: scale(16),
    marginBottom: scale(8),
    borderLeftWidth: 4,
  },
  iconContainer: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(8),
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
  message: {
    fontSize: normalize(14),
    color: COLORS.gray600,
    marginTop: scale(4),
  },
  timestamp: {
    fontSize: normalize(12),
    color: COLORS.gray400,
    marginTop: scale(4),
  },
});

export default AlertCard;
