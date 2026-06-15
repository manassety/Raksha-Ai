// ====================================================================
// FILE: src/contexts/ContactsContext.js
// ====================================================================
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as Contacts from 'expo-contacts';
import { StorageService } from '../services/StorageService';
import { STORAGE_KEYS } from '../config/constants';
import { useAuth } from './AuthContext';
import { firestore } from '../services/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';

const ContactsContext = createContext();

export const ContactsProvider = ({ children }) => {
    const { user } = useAuth();
    const [emergencyContacts, setEmergencyContacts] = useState([]);
    const [allContacts, setAllContacts] = useState([]);
    const [hasPermission, setHasPermission] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadEmergencyContacts();
        checkContactsPermission();
    }, [user]);

    const checkContactsPermission = async () => {
        try {
            const { status } = await Contacts.getPermissionsAsync();
            setHasPermission(status === 'granted');
        } catch (error) {
            console.log('Error checking contacts permission:', error);
        }
    };

    const requestContactsPermission = async () => {
        try {
            const { status } = await Contacts.requestPermissionsAsync();
            setHasPermission(status === 'granted');
            return { success: status === 'granted' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const loadEmergencyContacts = async () => {
        try {
            setLoading(true);

            // Load from local storage first
            const localContacts = await StorageService.get(STORAGE_KEYS.EMERGENCY_CONTACTS);
            if (localContacts) {
                setEmergencyContacts(localContacts);
            }

            // Also try to load from Firestore
            if (user) {
                const userDoc = await getDoc(doc(firestore, 'users', user.uid));
                if (userDoc.exists() && userDoc.data().emergencyContacts) {
                    const firestoreContacts = userDoc.data().emergencyContacts;
                    setEmergencyContacts(firestoreContacts);
                    await StorageService.set(STORAGE_KEYS.EMERGENCY_CONTACTS, firestoreContacts);
                }
            }
        } catch (error) {
            console.log('Error loading emergency contacts:', error);
        } finally {
            setLoading(false);
        }
    };

    const addEmergencyContact = async (contact) => {
        try {
            setLoading(true);
            const newContact = {
                id: Date.now().toString(),
                name: contact.name,
                phone: contact.phone,
                relation: contact.relation || 'Emergency Contact',
                isPrimary: contact.isPrimary || false,
                createdAt: new Date().toISOString(),
            };

            // If this is marked as primary, remove primary from others
            if (newContact.isPrimary) {
                const updatedContacts = emergencyContacts.map(c => ({
                    ...c,
                    isPrimary: false,
                }));
                updatedContacts.push(newContact);
                setEmergencyContacts(updatedContacts);
            } else {
                const updatedContacts = [...emergencyContacts, newContact];
                setEmergencyContacts(updatedContacts);
            }

            // Save to storage
            await StorageService.set(STORAGE_KEYS.EMERGENCY_CONTACTS, updatedContacts);

            // Save to Firestore
            if (user) {
                await updateDoc(doc(firestore, 'users', user.uid), {
                    emergencyContacts: updatedContacts,
                });
            }

            return { success: true, contact: newContact };
        } catch (error) {
            console.log('Error adding emergency contact:', error);
            return { success: false, error: error.message };
        } finally {
            setLoading(false);
        }
    };

    const removeEmergencyContact = async (contactId) => {
        try {
            setLoading(true);
            const contactToRemove = emergencyContacts.find(c => c.id === contactId);
            const updatedContacts = emergencyContacts.filter(c => c.id !== contactId);

            setEmergencyContacts(updatedContacts);
            await StorageService.set(STORAGE_KEYS.EMERGENCY_CONTACTS, updatedContacts);

            if (user && contactToRemove) {
                await updateDoc(doc(firestore, 'users', user.uid), {
                    emergencyContacts: updatedContacts,
                });
            }

            return { success: true };
        } catch (error) {
            console.log('Error removing emergency contact:', error);
            return { success: false, error: error.message };
        } finally {
            setLoading(false);
        }
    };

    const updateEmergencyContact = async (contactId, updates) => {
        try {
            setLoading(true);
            const updatedContacts = emergencyContacts.map(c =>
                c.id === contactId ? { ...c, ...updates } : c
            );

            setEmergencyContacts(updatedContacts);
            await StorageService.set(STORAGE_KEYS.EMERGENCY_CONTACTS, updatedContacts);

            if (user) {
                await updateDoc(doc(firestore, 'users', user.uid), {
                    emergencyContacts: updatedContacts,
                });
            }

            return { success: true };
        } catch (error) {
            console.log('Error updating emergency contact:', error);
            return { success: false, error: error.message };
        } finally {
            setLoading(false);
        }
    };

    const fetchDeviceContacts = async () => {
        try {
            if (!hasPermission) {
                await requestContactsPermission();
            }

            setLoading(true);
            const { data } = await Contacts.getContactsAsync({
                fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
            });

            if (data.length > 0) {
                setAllContacts(data);
                return { success: true, contacts: data };
            }

            return { success: true, contacts: [] };
        } catch (error) {
            console.log('Error fetching device contacts:', error);
            return { success: false, error: error.message };
        } finally {
            setLoading(false);
        }
    };

    const setPrimaryContact = async (contactId) => {
        try {
            const updatedContacts = emergencyContacts.map(c => ({
                ...c,
                isPrimary: c.id === contactId,
            }));

            setEmergencyContacts(updatedContacts);
            await StorageService.set(STORAGE_KEYS.EMERGENCY_CONTACTS, updatedContacts);

            if (user) {
                await updateDoc(doc(firestore, 'users', user.uid), {
                    emergencyContacts: updatedContacts,
                });
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const value = {
        emergencyContacts,
        allContacts,
        hasPermission,
        loading,
        addEmergencyContact,
        removeEmergencyContact,
        updateEmergencyContact,
        fetchDeviceContacts,
        setPrimaryContact,
        requestContactsPermission,
    };

    return (
        <ContactsContext.Provider value={value}>
            {children}
        </ContactsContext.Provider>
    );
};

export const useContacts = () => {
    const context = useContext(ContactsContext);
    if (!context) {
        throw new Error('useContacts must be used within a ContactsProvider');
    }
    return context;
};

export default ContactsContext;