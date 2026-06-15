// ====================================================================
// FILE: src/hooks/useContacts.js
// ====================================================================
import { useState, useEffect, useCallback } from 'react';
import * as Contacts from 'expo-contacts';
import { useContacts as useContactsContext } from '../contexts/ContactsContext';

export const useContacts = () => {
    const {
        emergencyContacts,
        allContacts,
        hasPermission,
        loading,
        addEmergencyContact: contextAddContact,
        removeEmergencyContact: contextRemoveContact,
        updateEmergencyContact: contextUpdateContact,
        fetchDeviceContacts: contextFetchContacts,
        setPrimaryContact: contextSetPrimaryContact,
        requestContactsPermission: contextRequestPermission,
    } = useContactsContext();

    const [searchQuery, setSearchQuery] = useState('');
    const [filteredContacts, setFilteredContacts] = useState([]);

    useEffect(() => {
        if (searchQuery.trim() === '') {
            setFilteredContacts(allContacts);
        } else {
            const filtered = allContacts.filter(contact => {
                const name = contact.name?.toLowerCase() || '';
                const query = searchQuery.toLowerCase();
                return name.includes(query);
            });
            setFilteredContacts(filtered);
        }
    }, [searchQuery, allContacts]);

    const addEmergencyContact = useCallback(async (contact) => {
        const result = await contextAddContact(contact);
        return result;
    }, [contextAddContact]);

    const removeEmergencyContact = useCallback(async (contactId) => {
        const result = await contextRemoveContact(contactId);
        return result;
    }, [contextRemoveContact]);

    const updateEmergencyContact = useCallback(async (contactId, updates) => {
        const result = await contextUpdateContact(contactId, updates);
        return result;
    }, [contextUpdateContact]);

    const fetchDeviceContacts = useCallback(async () => {
        const result = await contextFetchContacts();
        return result;
    }, [contextFetchContacts]);

    const setPrimaryContact = useCallback(async (contactId) => {
        const result = await contextSetPrimaryContact(contactId);
        return result;
    }, [contextSetPrimaryContact]);

    const requestPermission = useCallback(async () => {
        const result = await contextRequestPermission();
        return result;
    }, [contextRequestPermission]);

    const getContactById = useCallback((contactId) => {
        return emergencyContacts.find(c => c.id === contactId);
    }, [emergencyContacts]);

    const getPrimaryContact = useCallback(() => {
        return emergencyContacts.find(c => c.isPrimary) || emergencyContacts[0];
    }, [emergencyContacts]);

    const hasEmergencyContacts = emergencyContacts.length > 0;

    return {
        emergencyContacts,
        allContacts: filteredContacts,
        allContactsRaw: allContacts,
        hasPermission,
        loading,
        searchQuery,
        setSearchQuery,
        addEmergencyContact,
        removeEmergencyContact,
        updateEmergencyContact,
        fetchDeviceContacts,
        setPrimaryContact,
        requestPermission,
        getContactById,
        getPrimaryContact,
        hasEmergencyContacts,
    };
};

export default useContacts;