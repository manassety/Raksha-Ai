import { auth, db } from '../config/firebase';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { registerFaceWithPython } from './PythonAIApi';

export const registerUser = async (email, password, name, phone, isAdmin = false, faceBase64 = null) => {
    try {
        // Ensure any previous session is cleared to avoid token conflicts in Firestore
        if (auth.currentUser) {
            await signOut(auth);
        }

        // Create user with email and password
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Update user profile with name
        await updateProfile(user, {
            displayName: name
        });

        // Small delay to allow Firestore to sync with the new Auth state
        // This prevents "Missing or insufficient permissions" errors in React Native
        await new Promise(resolve => setTimeout(resolve, 500));

        // Create user document in Firestore
        await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            name: name,
            email: email,
            phone: phone || '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            profileComplete: false,
            isAdmin: isAdmin,
            emergencyContacts: [],
            settings: {
                notifications: true,
                locationTracking: true,
                voiceFeedback: true,
                hapticFeedback: true
            }
        });

        // Wait for face registration if provided
        if (faceBase64) {
            try {
                const faceResponse = await registerFaceWithPython(user.uid, faceBase64);
                if (faceResponse && faceResponse.success && faceResponse.encoding) {
                    await updateDoc(doc(db, 'users', user.uid), {
                        faceRegistered: true,
                        faceEncoding: faceResponse.encoding,
                        faceRegisteredAt: serverTimestamp()
                    });
                }
            } catch (err) {
                console.error('Face registration during signup failed:', err);
            }
        }

        return {
            success: true,
            user: {
                uid: user.uid,
                email: user.email,
                name: name,
                isAdmin: isAdmin
            }
        };
    } catch (error) {
        console.error('Registration error:', error);
        return {
            success: false,
            error: getErrorMessage(error.code)
        };
    }
};

export const loginUser = async (email, password) => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Get user data from Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));

        if (userDoc.exists()) {
            return {
                success: true,
                user: {
                    uid: user.uid,
                    email: user.email,
                    name: user.displayName || userDoc.data().name,
                    ...userDoc.data()
                }
            };
        } else {
            return {
                success: true,
                user: {
                    uid: user.uid,
                    email: user.email,
                    name: user.displayName
                }
            };
        }
    } catch (error) {
        console.error('Login error:', error);
        return {
            success: false,
            error: getErrorMessage(error.code)
        };
    }
};

export const logoutUser = async () => {
    try {
        await signOut(auth);
        return { success: true };
    } catch (error) {
        console.error('Logout error:', error);
        return {
            success: false,
            error: getErrorMessage(error.code)
        };
    }
};

export const resetPassword = async (email) => {
    try {
        const trimmedEmail = email.trim();
        await sendPasswordResetEmail(auth, trimmedEmail);
        console.log('[Auth] Password reset email sent successfully to:', trimmedEmail);
        return { success: true };
    } catch (error) {
        console.error('Password reset error:', error);
        return {
            success: false,
            error: getErrorMessage(error.code)
        };
    }
};

export const updateUserProfile = async (userId, data) => {
    try {
        await setDoc(doc(db, 'users', userId), {
            ...data,
            updatedAt: serverTimestamp()
        }, { merge: true });

        return { success: true };
    } catch (error) {
        console.error('Update profile error:', error);
        return {
            success: false,
            error: getErrorMessage(error.code)
        };
    }
};

const getErrorMessage = (errorCode) => {
    switch (errorCode) {
        case 'auth/email-already-in-use':
            return 'This email is already registered. Please login instead.';
        case 'auth/invalid-email':
            return 'Invalid email address format.';
        case 'auth/weak-password':
            return 'Password should be at least 6 characters.';
        case 'auth/user-not-found':
            return 'No account found with this email.';
        case 'auth/wrong-password':
            return 'Incorrect password.';
        case 'auth/too-many-requests':
            return 'Too many failed attempts. Please try again later.';
        case 'auth/network-request-failed':
            return 'Network error. Please check your connection.';
        case 'auth/user-disabled':
            return 'This account has been disabled.';
        case 'permission-denied':
            return 'Permission denied. Please try again or check your account settings.';
        default:
            return errorCode?.includes('permission')
                ? 'Permission error. If you just logged out, please wait a moment and try again.'
                : 'An error occurred. Please try again.';
    }
};

export default {
    registerUser,
    loginUser,
    logoutUser,
    resetPassword,
    updateUserProfile
};