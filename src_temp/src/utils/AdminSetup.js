import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

export const setYouAsMainAdmin = async () => {
    // Your user details
    const yourEmail = 'setymanas4@gmail.com';

    try {
        // First, let's find your user document by querying
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', yourEmail));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            console.log('User not found with email:', yourEmail);
            return { success: false, error: 'User not found' };
        }

        // Get your user ID
        let yourUserId = null;
        querySnapshot.forEach((doc) => {
            if (doc.data().email === yourEmail) {
                yourUserId = doc.id;
            }
        });

        if (!yourUserId) {
            return { success: false, error: 'Could not find user ID' };
        }

        // Set you as main admin
        const userRef = doc(db, 'users', yourUserId);
        await setDoc(userRef, {
            isAdmin: true,
            isMainAdmin: true,
            adminPrivileges: ['all'],  // Full access to everything
            name: 'Manas Sety',
            email: 'setymanas4@gmail.com',
            phone: '9411596016',
            updatedAt: new Date().toISOString()
        }, { merge: true });

        console.log('✅ Successfully set Manas Sety as MAIN ADMIN');
        console.log('User ID:', yourUserId);

        return {
            success: true,
            message: 'You are now the MAIN ADMIN with all privileges!',
            userId: yourUserId
        };

    } catch (error) {
        console.error('Error setting main admin:', error);
        return { success: false, error: error.message };
    }
};

export default { setYouAsMainAdmin };