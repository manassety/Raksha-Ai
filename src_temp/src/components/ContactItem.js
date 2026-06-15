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
