import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

import { initializeAuth, getReactNativePersistence, getAuth, signInAnonymously } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

// Your Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBzfBhpdOw7bwt_PMykOP0icdGK7wkcaM4",
    authDomain: "tanprix-52683.firebaseapp.com",
    projectId: "tanprix-52683",
    storageBucket: "tanprix-52683.firebasestorage.app",
    messagingSenderId: "179060902521",
    appId: "1:179060902521:web:b717f47e67f304ff36e2a8",
    measurementId: "G-55HCRBEWNF"
};

// Initialize Firebase App safely
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Auth with persistence safely
let firebaseAuth;
try {
    firebaseAuth = initializeAuth(app, {
        persistence: getReactNativePersistence(ReactNativeAsyncStorage)
    });
} catch (e) {
    // If Auth is already initialized (e.g. during Hot Reload), get the existing instance
    firebaseAuth = getAuth(app);
}

const auth = firebaseAuth;
let firestoreDb;
try {
    firestoreDb = initializeFirestore(app, {
        experimentalForceLongPolling: true,
        useFetchStreams: false
    });
} catch (e) {
    firestoreDb = getFirestore(app);
}
const db = firestoreDb;
const storage = getStorage(app);


// Helper to ensure user is authenticated
export const ensureUserAuthenticated = async () => {
    try {
        if (!auth.currentUser) {
            const result = await signInAnonymously(auth);
            return result.user.uid;
        }
        return auth.currentUser.uid;
    } catch (error) {
        console.error('Auth error:', error);
        // Return a temporary ID for offline mode
        return 'temp-user-' + Date.now();
    }
};

export { auth, db, storage };

export default app;