import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../config/theme';
import { scale, normalize } from '../utils/responsive';

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
            <Ionicons name="star" size={scale(20)} color={COLORS.warning} />
          </TouchableOpacity>
        )}
        {isEmergencyContact && onEdit && (
          <TouchableOpacity style={styles.actionButton} onPress={() => onEdit(contact)}>
            <Ionicons name="create" size={scale(20)} color={COLORS.primary} />
          </TouchableOpacity>
        )}
        {isEmergencyContact && onDelete && (
          <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={() => onDelete(contact.id)}>
            <Ionicons name="trash" size={scale(20)} color={COLORS.danger} />
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
    borderRadius: scale(12),
    padding: scale(16),
    marginBottom: scale(8),
  },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: COLORS.white,
    fontSize: normalize(20),
    fontWeight: 'bold',
  },
  details: {
    flex: 1,
    marginLeft: scale(12),
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontSize: normalize(16),
    fontWeight: '600',
    color: COLORS.gray800,
  },
  badge: {
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: scale(8),
    paddingVertical: scale(2),
    borderRadius: scale(4),
    marginLeft: scale(8),
  },
  badgeText: {
    fontSize: normalize(10),
    color: COLORS.primary,
    fontWeight: '600',
  },
  phone: {
    fontSize: normalize(14),
    color: COLORS.gray600,
    marginTop: scale(2),
  },
  relation: {
    fontSize: normalize(12),
    color: COLORS.gray400,
    marginTop: scale(2),
  },
  actions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: scale(8),
    marginLeft: scale(4),
  },
  deleteButton: {
    marginLeft: scale(8),
  },
});

export default ContactItem;
