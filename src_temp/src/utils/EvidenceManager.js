// src/utils/EvidenceManager.js
import * as FileSystem from 'expo-file-system';
import { uploadToCloudinary } from './cloudinaryService';
import { db } from '../config/firebase';
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
        console.log('--- Saving Evidence ---');
        console.log('UserName:', userName);
        console.log('File:', fileInfo.name);
        console.log('Type:', type);
        console.log('Source:', source);

        const timestamp = new Date()
            .toISOString()
            .replace(/[:.]/g, "-");

        const folderName = `${userName}_SOS_${timestamp}`;
        const ext = type === 'video' ? 'mp4' : type === 'audio' ? 'm4a' : type === 'image' ? 'jpg' : 'pdf';

        const storagePath = `evidence/${userName}/${folderName}/${type}_${Date.now()}.${ext}`;

        // Upload to Cloudinary
        const cloudinaryResult = await uploadToCloudinary({
            uri: fileInfo.uri,
            name: fileInfo.name,
            type: type,
            size: fileInfo.size,
        });

        console.log('Cloudinary Result:', cloudinaryResult);

        // Save to Firestore
        const user = getAuth().currentUser;
        const evidenceDoc = await addDoc(collection(db, "evidence"), {
            userId: user?.uid || null,
            userName: userName,
            folderName: folderName,
            fileURL: cloudinaryResult.secure_url,
            cloudinaryId: cloudinaryResult.public_id,
            resourceType: cloudinaryResult.resource_type,
            type: type,
            timestamp: Timestamp.now(),
            fileName: fileInfo.name,
            size: fileInfo.size,
            location: location || null,
            category: category || null,
            source: source, // manual, sos, complaint, collaborative
            createdAt: new Date().toISOString(),
        });

        console.log('Evidence saved to Firestore with ID:', evidenceDoc.id);

        return { success: true, id: evidenceDoc.id, url: cloudinaryResult.secure_url };
    } catch (error) {
        console.error('Error saving evidence:', error);
        return { success: false, error: error.message };
    }
};

// Get all evidence from Firestore
export const getAllEvidence = async () => {
    try {
        console.log('--- Getting All Evidence ---');
        const evidenceRef = collection(db, "evidence");
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
export const getEvidenceStats = async () => {
    try {
        const evidence = await getAllEvidence();
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

// Delete evidence from Firestore and Cloudinary
export const deleteEvidence = async (fileURL) => {
    try {
        console.log('--- Deleting Evidence ---');
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

        // 1. Delete from Cloudinary if metadata exists
        if (data.cloudinaryId) {
            try {
                const { deleteFromCloudinary } = require('./cloudinaryService');
                await deleteFromCloudinary(data.cloudinaryId, data.resourceType || 'image');
                console.log('Successfully deleted from Cloudinary');
            } catch (clError) {
                console.warn('Could not delete from Cloudinary:', clError.message);
                // We'll continue deleting from Firestore even if Cloudinary fails
            }
        }

        // 2. Delete from Firestore
        await deleteDoc(doc(db, "evidence", docId));
        console.log('Successfully deleted from Firestore');

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