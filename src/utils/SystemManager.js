// src/utils/SystemManager.js
import { db } from '../config/firebase';
import {
    collection,
    getDocs,
    deleteDoc,
    doc,
    writeBatch
} from 'firebase/firestore';

/**
 * Resets application transactional data for a fresh production state.
 * This clears complaints, SOS alerts, evidence records, and contacts.
 * It DOES NOT delete user accounts.
 */
export const resetApplicationData = async () => {
    try {
        console.log('--- SYSTEM RESET INITIATED ---');

        const collectionsToReset = [
            'complaints',
            'sos_alerts',
            'evidence',
            'contacts',
            'sos_signals', // Add if exists
            'locations'    // Add if exists
        ];

        let totalDeleted = 0;

        for (const collName of collectionsToReset) {
            console.log(`Resetting collection: ${collName}`);
            const snapshot = await getDocs(collection(db, collName));

            if (snapshot.empty) {
                console.log(`Collection ${collName} is already empty.`);
                continue;
            }

            // Use batches for efficiency (Firestore limit is 500 per batch)
            const docs = snapshot.docs;
            for (let i = 0; i < docs.length; i += 500) {
                const batch = writeBatch(db);
                const chunk = docs.slice(i, i + 500);

                chunk.forEach((d) => {
                    batch.delete(d.ref);
                });

                await batch.commit();
                totalDeleted += chunk.length;
            }
            console.log(`Successfully cleared ${collName}.`);
        }

        console.log(`--- RESET COMPLETE: ${totalDeleted} documents removed ---`);
        return { success: true, count: totalDeleted };
    } catch (error) {
        console.error('System Reset Error:', error);
        return { success: false, error: error.message };
    }
};

export default {
    resetApplicationData
};
