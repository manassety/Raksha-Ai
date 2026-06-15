import { db, ensureUserAuthenticated } from '../config/firebase';
import { collection, doc, setDoc, getDocs, deleteDoc, updateDoc, query, where } from 'firebase/firestore';

const CONTACTS_COLLECTION = 'contacts';

export const saveContactsToFirebase = async (contacts) => {
    try {
        const userId = await ensureUserAuthenticated();

        // Save each contact as a document in the top-level collection
        for (const contact of contacts) {
            const contactRef = doc(db, CONTACTS_COLLECTION, contact.id);
            await setDoc(contactRef, {
                ...contact,
                userId: userId,
                updatedAt: new Date().toISOString()
            });
        }

        return { success: true };
    } catch (error) {
        console.error('Error saving contacts:', error);
        return { success: false, error: error.message };
    }
};

export const loadContactsFromFirebase = async () => {
    try {
        const userId = await ensureUserAuthenticated();

        // Filter the query by userId to satisfy security rules
        const q = query(
            collection(db, CONTACTS_COLLECTION),
            where('userId', '==', userId)
        );

        const snapshot = await getDocs(q);

        const contacts = [];
        snapshot.forEach((doc) => {
            contacts.push({ id: doc.id, ...doc.data() });
        });

        return { success: true, contacts };
    } catch (error) {
        console.error('Error loading contacts:', error);
        return { success: false, error: error.message, contacts: [] };
    }
};

export const deleteContactFromFirebase = async (contactId) => {
    try {
        await ensureUserAuthenticated();
        const contactRef = doc(db, CONTACTS_COLLECTION, contactId);
        await deleteDoc(contactRef);

        return { success: true };
    } catch (error) {
        console.error('Error deleting contact:', error);
        return { success: false, error: error.message };
    }
};

export const updateContactInFirebase = async (contactId, updatedData) => {
    try {
        await ensureUserAuthenticated();
        const contactRef = doc(db, CONTACTS_COLLECTION, contactId);
        await updateDoc(contactRef, {
            ...updatedData,
            updatedAt: new Date().toISOString()
        });

        return { success: true };
    } catch (error) {
        console.error('Error updating contact:', error);
        return { success: false, error: error.message };
    }
};

export default {
    saveContactsToFirebase,
    loadContactsFromFirebase,
    deleteContactFromFirebase,
    updateContactInFirebase
};