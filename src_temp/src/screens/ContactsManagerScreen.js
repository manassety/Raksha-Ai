import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Contacts from 'expo-contacts';
import GradientBackground from '../components/GradientBackground';
import GradientButton from '../components/GradientButton';
import ContactItem from '../components/ContactItem';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';
import { saveContactsToFirebase, loadContactsFromFirebase } from '../services/contactsService';
import { saveContactsLocally, loadContactsLocally } from '../services/LocalStorageService';

const ContactsManagerScreen = () => {
  const navigation = useNavigation();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '', relation: '' });

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    setLoading(true);
    try {
      // Try Firebase first
      const firebaseResult = await loadContactsFromFirebase();

      if (firebaseResult.success && firebaseResult.contacts.length > 0) {
        setContacts(firebaseResult.contacts);
      } else {
        // Fallback to local storage
        const localResult = await loadContactsLocally();
        if (localResult.success) {
          setContacts(localResult.contacts);
        }
      }
    } catch (error) {
      // Fallback to local storage
      const localResult = await loadContactsLocally();
      if (localResult.success) {
        setContacts(localResult.contacts);
      }
    }
    setLoading(false);
  };

  const saveContacts = async (updatedContacts) => {
    setSaving(true);
    try {
      // Save to Firebase
      const firebaseResult = await saveContactsToFirebase(updatedContacts);

      // Always save locally as backup
      await saveContactsLocally(updatedContacts);

      setContacts(updatedContacts);

      if (!firebaseResult.success) {
        console.log('Saved locally, Firebase sync failed');
      }
    } catch (error) {
      // Save locally anyway
      await saveContactsLocally(updatedContacts);
      setContacts(updatedContacts);
    }
    setSaving(false);
  };

  const pickContactFromPhone = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === 'granted') {
        const contact = await Contacts.presentContactPickerAsync();

        if (contact) {
          const name = contact.name || '';
          const phone = contact.phoneNumbers && contact.phoneNumbers.length > 0
            ? contact.phoneNumbers[0].number
            : '';

          if (!phone) {
            Alert.alert('No Phone Number', 'This contact does not have a phone number.');
            return;
          }

          setNewContact({
            ...newContact,
            name: name,
            phone: phone.replace(/\s/g, '') // Remove spaces for consistency
          });
        }
      } else {
        Alert.alert('Permission Denied', 'Please allow contact access to use this feature.');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not access contacts list.');
      console.error(error);
    }
  };

  const handleAddContact = () => {
    if (!newContact.name || !newContact.phone) {
      Alert.alert('Error', 'Please fill in name and phone.');
      return;
    }

    const contact = {
      ...newContact,
      id: Date.now().toString(),
      isPrimary: contacts.length === 0,
      createdAt: new Date().toISOString()
    };

    const updatedContacts = [...contacts, contact];
    saveContacts(updatedContacts);

    setShowAddModal(false);
    setNewContact({ name: '', phone: '', relation: '' });
    Alert.alert('Success', 'Contact added and saved!');
  };

  const handleRemoveContact = (contactId) => {
    Alert.alert('Remove Contact', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          const updatedContacts = contacts.filter(c => c.id !== contactId);
          saveContacts(updatedContacts);
        }
      }
    ]);
  };

  const handleSetPrimary = (contactId) => {
    const updatedContacts = contacts.map(c => ({
      ...c,
      isPrimary: c.id === contactId
    }));
    saveContacts(updatedContacts);
  };

  if (loading) {
    return (
      <GradientBackground colors={GRADIENTS.primary}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Emergency Contacts</Text>
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.white} />
            <Text style={styles.loadingText}>Loading contacts...</Text>
          </View>
        </View>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground colors={GRADIENTS.primary}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Emergency Contacts</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddModal(true)}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Ionicons name="add" size={28} color={COLORS.primary} />
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{contacts.length}</Text>
              <Text style={styles.statLabel}>Contacts</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{contacts.filter(c => c.isPrimary).length}</Text>
              <Text style={styles.statLabel}>Primary</Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Ionicons name="cloud-done" size={20} color={COLORS.success} />
            <Text style={styles.infoText}>
              {saving ? 'Syncing...' : 'Contacts synced with cloud'}
            </Text>
          </View>

          {contacts.length > 0 ? (
            contacts.map((contact) => (
              <ContactItem
                key={contact.id}
                contact={contact}
                isEmergencyContact
                onDelete={handleRemoveContact}
                onSetPrimary={handleSetPrimary}
              />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={60} color={COLORS.gray400} />
              <Text style={styles.emptyTitle}>No Contacts</Text>
              <Text style={styles.emptyText}>Add emergency contacts.</Text>
              <GradientButton
                title="Add Contact"
                onPress={() => setShowAddModal(true)}
                colors={GRADIENTS.primary}
                style={styles.emptyButton}
              />
            </View>
          )}
        </ScrollView>

        <Modal visible={showAddModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Contact</Text>
                <TouchableOpacity onPress={() => setShowAddModal(false)}>
                  <Ionicons name="close" size={24} color={COLORS.gray500} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScroll}>
                <TouchableOpacity style={styles.importButton} onPress={pickContactFromPhone}>
                  <Ionicons name="people" size={20} color={COLORS.primary} />
                  <Text style={styles.importButtonText}>Import from Phone Contacts</Text>
                </TouchableOpacity>

                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OR ENTER MANUALLY</Text>
                  <View style={styles.dividerLine} />
                </View>

                <Text style={styles.label}>Name *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Contact name"
                  placeholderTextColor={COLORS.gray400}
                  value={newContact.name}
                  onChangeText={(text) => setNewContact({ ...newContact, name: text })}
                />
                <Text style={styles.label}>Phone *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Phone number"
                  placeholderTextColor={COLORS.gray400}
                  keyboardType="phone-pad"
                  value={newContact.phone}
                  onChangeText={(text) => setNewContact({ ...newContact, phone: text })}
                />
                <Text style={styles.label}>Relationship</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g., Mom, Dad, Friend"
                  placeholderTextColor={COLORS.gray400}
                  value={newContact.relation}
                  onChangeText={(text) => setNewContact({ ...newContact, relation: text })}
                />
                <GradientButton
                  title="Add Contact"
                  onPress={handleAddContact}
                  colors={GRADIENTS.primary}
                  style={styles.modalButton}
                />
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </GradientBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md
  },
  title: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.white },
  addButton: {
    backgroundColor: COLORS.white,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    color: COLORS.white,
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.md
  },
  scrollView: {
    flex: 1,
    backgroundColor: COLORS.gray100,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30
  },
  scrollContent: { padding: SPACING.lg },
  statsRow: { flexDirection: 'row', marginBottom: SPACING.lg },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.md,
    alignItems: 'center',
    marginHorizontal: 4
  },
  statNumber: { fontSize: FONT_SIZES.xxxl, fontWeight: 'bold', color: COLORS.primary },
  statLabel: { fontSize: FONT_SIZES.xs, color: COLORS.gray500 },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.success + '20',
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.lg
  },
  infoText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.success,
    marginLeft: 8
  },
  emptyState: { alignItems: 'center', paddingVertical: SPACING.xxl },
  emptyTitle: { fontSize: FONT_SIZES.xl, fontWeight: '600', color: COLORS.gray800, marginTop: SPACING.md },
  emptyText: { fontSize: FONT_SIZES.md, color: COLORS.gray500, marginBottom: SPACING.lg },
  emptyButton: { width: 200 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '80%'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200
  },
  modalTitle: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.gray800 },
  modalScroll: { padding: SPACING.lg },
  label: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.gray700, marginBottom: 8 },
  textInput: {
    backgroundColor: COLORS.gray100,
    borderRadius: 8,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.gray800,
    marginBottom: SPACING.md
  },
  modalButton: { marginTop: SPACING.md },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary + '10',
    padding: SPACING.md,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.primary,
    marginBottom: SPACING.lg
  },
  importButtonText: {
    marginLeft: 8,
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: '600'
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.gray300
  },
  dividerText: {
    marginHorizontal: 10,
    fontSize: 10,
    color: COLORS.gray500,
    fontWeight: '700'
  },
});

export default ContactsManagerScreen;