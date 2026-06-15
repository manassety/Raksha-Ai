import { auth, db } from '../config/firebase';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

export const registerUser = async (email, password, name, phone, isAdmin = false) => {
    try {
        // Create user with email and password
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Update user profile with name
        await updateProfile(user, {
            displayName: name
        });

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
        await sendPasswordResetEmail(auth, email);
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
        default:
            return 'An error occurred. Please try again.';
    }
};

export default {
    registerUser,
    loginUser,
    logoutUser,
    resetPassword,
    updateUserProfile
};