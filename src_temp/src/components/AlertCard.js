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
