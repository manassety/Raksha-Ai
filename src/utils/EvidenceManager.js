// src/utils/EvidenceManager.js
import * as FileSystem from 'expo-file-system';
import { db, storage } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import {
    collection,
    addDoc,
    getDocs,
    query,
    where,
    Timestamp,
    doc,
    deleteDoc,
    updateDoc,
    onSnapshot,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';


const EVIDENCE_BASE_DIR = FileSystem.documentDirectory + 'evidence/';

// Ensure evidence directory exists
export const ensureEvidenceDirectory = async () => {
    try {
        const dirInfo = await FileSystem.getInfoAsync(EVIDENCE_BASE_DIR);
        if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(EVIDENCE_BASE_DIR, { intermediates: true });
        }
        return true;
    } catch (error) {
        console.error('Error ensuring evidence directory:', error);
        return false;
    }
};

// Save evidence to Cloudinary and Firestore
export const saveEvidence = async (userName, fileInfo, type, location = null, category = null, source = 'manual') => {
    try {
        console.log('--- Queuing Evidence ---');
        console.log('UserName:', userName, 'File URI:', fileInfo?.uri);

        if (!fileInfo?.uri) {
            throw new Error(`Cannot save evidence: File URI is ${fileInfo?.uri}`);
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const folderName = `${userName}_SOS_${timestamp}`;
        const user = getAuth().currentUser;

        // 1. Instantly create a Firestore document with 'uploading' status and local URI so it shows in the UI instantly
        const evidenceDoc = await addDoc(collection(db, "evidence"), {
            userId: user?.uid || null,
            userName: userName,
            folderName: folderName,
            localUri: fileInfo.uri,
            status: 'uploading', // 'uploading' | 'queued' | 'success'
            type: type,
            timestamp: Timestamp.now(),
            fileName: fileInfo.name,
            size: fileInfo.size,
            location: location || null,
            category: category || null,
            source: source,
            createdAt: new Date().toISOString(),
        });

        // 2. Wrap Firebase Storage upload in a background async task. Do NOT await it! Let it run offline queue
        (async () => {
            try {
                // Convert URI to Blob (using fetch to prevent React Native UI thread hang on file:// URIs)
                const response = await fetch(fileInfo.uri);
                const blob = await response.blob();

                // Create a reference to the file in Firebase Storage
                const filePath = `evidence/${folderName}/${Date.now()}_${fileInfo.name}`;
                const storageRef = ref(storage, filePath);

                // Upload file
                const snapshot = await uploadBytes(storageRef, blob);

                // Get the download URL
                const downloadURL = await getDownloadURL(snapshot.ref);

                // If successful, update Firestore with the secure URL
                await updateDoc(doc(db, "evidence", evidenceDoc.id), {
                    status: 'success',
                    fileURL: downloadURL,
                    storagePath: filePath,
                    resourceType: type,
                });
                console.log('Background upload success! Saved to Firebase Storage.');
            } catch (err) {
                console.log('Firebase Storage upload failed (likely offline). Queuing for sync.', err.message);
                // If offline/timeout, mark as queued. Real app logic would have a sync manager to retry these.
                await updateDoc(doc(db, "evidence", evidenceDoc.id), {
                    status: 'queued',
                });
            }
        })();

        // 3. Complete and unblock UI Instantly
        return { success: true, id: evidenceDoc.id };
    } catch (error) {
        console.error('EvidenceManager Queuing Error:', error);
        return { success: false, error: error.message };
    }
};

// Retry a queued or failed upload
export const retryUploadEvidence = async (evidenceItem) => {
    if (!evidenceItem.localUri) return { success: false, error: 'No local file URI found' };

    try {
        // Mark as uploading so UI updates
        await updateDoc(doc(db, "evidence", evidenceItem.id), {
            status: 'uploading'
        });

        const response = await fetch(evidenceItem.localUri);
        const blob = await response.blob();

        const folderName = evidenceItem.folderName || `${evidenceItem.userName}_SOS_Retry`;
        const filePath = `evidence/${folderName}/${Date.now()}_${evidenceItem.fileName || 'file'}`;
        const storageRef = ref(storage, filePath);

        const snapshot = await uploadBytes(storageRef, blob);
        const downloadURL = await getDownloadURL(snapshot.ref);

        await updateDoc(doc(db, "evidence", evidenceItem.id), {
            status: 'success',
            fileURL: downloadURL,
            storagePath: filePath,
        });

        return { success: true };
    } catch (err) {
        console.log('Retry upload failed:', err.message);
        await updateDoc(doc(db, "evidence", evidenceItem.id), {
            status: 'queued'
        });
        return { success: false, error: err.message };
    }
};

// Subscribe to evidence changes (Real-time)
export const subscribeToEvidence = (onUpdate, isAdmin = false, userId = null) => {
    try {
        console.log('--- Subscribing to Evidence ---');
        let evidenceRef;

        if (isAdmin) {
            evidenceRef = collection(db, "evidence");
        } else {
            let currentUserId = userId;
            if (!currentUserId) {
                const auth = getAuth();
                currentUserId = auth.currentUser?.uid;
            }
            if (!currentUserId) return () => { };
            evidenceRef = query(collection(db, "evidence"), where("userId", "==", currentUserId));
        }

        return onSnapshot(evidenceRef, (snapshot) => {
            const evidence = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                let formattedDate = 'Unknown';

                if (data.timestamp) {
                    if (typeof data.timestamp.toDate === 'function') {
                        formattedDate = data.timestamp.toDate().toLocaleDateString();
                    } else if (data.timestamp instanceof Date) {
                        formattedDate = data.timestamp.toLocaleDateString();
                    } else {
                        formattedDate = new Date(data.timestamp).toLocaleDateString();
                    }
                } else if (data.createdAt) {
                    formattedDate = new Date(data.createdAt).toLocaleDateString();
                }

                evidence.push({
                    id: doc.id,
                    ...data,
                    date: formattedDate,
                });
            });
            onUpdate(evidence);
        }, (error) => {
            console.error('Evidence subscription error:', error);
        });
    } catch (error) {
        console.error('Error in subscribeToEvidence:', error);
        return () => { };
    }
};

// Get all evidence from Firestore
export const getAllEvidence = async (isAdmin = false, userId = null) => {
    try {
        console.log('--- Getting All Evidence ---');
        let evidenceRef;
        if (isAdmin) {
            evidenceRef = collection(db, "evidence");
        } else {
            let currentUserId = userId;
            if (!currentUserId) {
                const auth = getAuth();
                currentUserId = auth.currentUser?.uid;
            }
            if (currentUserId) {
                evidenceRef = query(collection(db, "evidence"), where("userId", "==", currentUserId));
            } else {
                return [];
            }
        }
        const snapshot = await getDocs(evidenceRef);
        const evidence = [];

        console.log('Total documents:', snapshot.size);

        snapshot.forEach((doc) => {
            const data = doc.data();
            let formattedDate = 'Unknown';

            if (data.timestamp) {
                if (typeof data.timestamp.toDate === 'function') {
                    formattedDate = data.timestamp.toDate().toLocaleDateString();
                } else if (data.timestamp instanceof Date) {
                    formattedDate = data.timestamp.toLocaleDateString();
                } else {
                    formattedDate = new Date(data.timestamp).toLocaleDateString();
                }
            } else if (data.createdAt) {
                formattedDate = new Date(data.createdAt).toLocaleDateString();
            }

            evidence.push({
                id: doc.id,
                ...data,
                date: formattedDate,
            });
        });

        console.log('Total evidence loaded:', evidence.length);
        return evidence;
    } catch (error) {
        console.error('Error getting evidence:', error);
        return [];
    }
};

// Get evidence by user
export const getEvidenceByUser = async (userName) => {
    try {
        const evidenceRef = collection(db, "evidence");
        const q = query(evidenceRef, where("userName", "==", userName));
        const snapshot = await getDocs(q);
        const evidence = [];

        snapshot.forEach((doc) => {
            evidence.push({
                id: doc.id,
                ...doc.data(),
                date: doc.data().timestamp?.toDate().toLocaleDateString() || 'Unknown',
            });
        });

        return evidence;
    } catch (error) {
        console.error('Error getting evidence by user:', error);
        return [];
    }
};

// Get evidence by type
export const getEvidenceByType = async (type) => {
    try {
        const evidenceRef = collection(db, "evidence");
        const q = query(evidenceRef, where("type", "==", type));
        const snapshot = await getDocs(q);
        const evidence = [];

        snapshot.forEach((doc) => {
            evidence.push({
                id: doc.id,
                ...doc.data(),
                date: doc.data().timestamp?.toDate().toLocaleDateString() || 'Unknown',
            });
        });

        return evidence;
    } catch (error) {
        console.error('Error getting evidence by type:', error);
        return [];
    }
};

// Get evidence statistics
export const getEvidenceStats = async (isAdmin = false, userId = null) => {
    try {
        const evidence = await getAllEvidence(isAdmin, userId);
        const stats = {
            total: evidence.length,
            images: evidence.filter(e => e.type === 'image').length,
            videos: evidence.filter(e => e.type === 'video').length,
            audio: evidence.filter(e => e.type === 'audio').length,
            documents: evidence.filter(e => e.type === 'document').length,
            users: [...new Set(evidence.map(e => e.userName))].length,
        };
        return stats;
    } catch (error) {
        console.error('Error getting evidence stats:', error);
        return { total: 0, images: 0, videos: 0, audio: 0, documents: 0, users: 0 };
    }
};

// Delete evidence (Soft delete from Gallery, Permanent from Backup)
export const deleteEvidence = async (fileURL, permanent = false) => {
    try {
        console.log(`--- ${permanent ? 'Permanently Deleting' : 'Archiving'} Evidence ---`);
        console.log('URL to find:', fileURL);

        const evidenceRef = collection(db, "evidence");
        const q = query(evidenceRef, where("fileURL", "==", fileURL));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            console.log('No matching document found in Firestore');
            return { success: false, error: 'File not found' };
        }

        const docSnapshot = snapshot.docs[0];
        const data = docSnapshot.data();
        const docId = docSnapshot.id;

        if (permanent) {
            // 1. Delete from Firebase Storage
            if (data.storagePath) {
                try {
                    const fileRef = ref(storage, data.storagePath);
                    await deleteObject(fileRef);
                    console.log('Successfully deleted from Firebase Storage');
                } catch (stError) {
                    console.warn('Could not delete from Firebase Storage:', stError.message);
                }
            }
            // 2. Delete from Firestore
            await deleteDoc(doc(db, "evidence", docId));
            console.log('Successfully deleted from Firestore (Permanent)');
        } else {
            // Soft Delete: Mark as deleted for Gallery screen
            await updateDoc(doc(db, "evidence", docId), {
                isDeleted: true,
                deletedAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            });
            console.log('Successfully archived evidence (Soft Delete)');
        }

        return { success: true };
    } catch (error) {
        console.error('Error in deleteEvidence:', error);
        return { success: false, error: error.message };
    }
};


// Get evidence by source
export const getEvidenceBySource = async (source) => {
    try {
        const evidenceRef = collection(db, "evidence");
        const q = query(evidenceRef, where("source", "==", source));
        const snapshot = await getDocs(q);
        const evidence = [];

        snapshot.forEach((doc) => {
            evidence.push({
                id: doc.id,
                ...doc.data(),
                date: doc.data().timestamp?.toDate().toLocaleDateString() || 'Unknown',
            });
        });

        return evidence;
    } catch (error) {
        console.error('Error getting evidence by source:', error);
        return [];
    }
};

// Get evidence by category
export const getEvidenceByCategory = async (category) => {
    try {
        const evidenceRef = collection(db, "evidence");
        const q = query(evidenceRef, where("category", "==", category));
        const snapshot = await getDocs(q);
        const evidence = [];

        snapshot.forEach((doc) => {
            evidence.push({
                id: doc.id,
                ...doc.data(),
                date: doc.data().timestamp?.toDate().toLocaleDateString() || 'Unknown',
            });
        });

        return evidence;
    } catch (error) {
        console.error('Error getting evidence by category:', error);
        return [];
    }
};

// Get evidence by date range
export const getEvidenceByDateRange = async (startDate, endDate) => {
    try {
        const evidenceRef = collection(db, "evidence");
        const snapshot = await getDocs(evidenceRef);
        const evidence = [];

        snapshot.forEach((doc) => {
            const date = doc.data().timestamp?.toDate();
            if (date && date >= startDate && date <= endDate) {
                evidence.push({
                    id: doc.id,
                    ...doc.data(),
                    date: date.toLocaleDateString(),
                });
            }
        });

        return evidence;
    } catch (error) {
        console.error('Error getting evidence by date range:', error);
        return [];
    }
};

/**
 * Logically remove Firestore evidence records if the hosted file is no longer available (404).
 */
export const cleanupStaleEvidence = async () => {
    try {
        console.log('--- Starting Cloud Sync Cleanup ---');
        const evidenceRef = collection(db, "evidence");
        const snapshot = await getDocs(evidenceRef);

        let removedCount = 0;

        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            const url = data.fileURL;
            const docId = docSnap.id;

            if (!url) {
                console.log(`[Sync] Removing record ${docId} (No URL)`);
                await deleteDoc(doc(db, "evidence", docId));
                removedCount++;
                continue;
            }

            try {
                // Request just first byte to verify existence
                const res = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' } });

                if (res.status === 404 || res.status === 410) {
                    console.log(`[Sync] Pruning missing asset: ${url}`);
                    await deleteDoc(doc(db, "evidence", docId));
                    removedCount++;
                }
            } catch (err) {
                console.warn(`[Sync] Skipping check for ${url}:`, err.message);
            }
        }

        console.log(`--- Sync Complete. Pruned ${removedCount} stale records. ---`);
        return { success: true, pruned: removedCount };
    } catch (error) {
        console.error('Sync Cleanup Error:', error);
        return { success: false, error: error.message };
    }
};