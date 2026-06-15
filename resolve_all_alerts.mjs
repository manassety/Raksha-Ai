import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBzfBhpdOw7bwt_PMykOP0icdGK7wkcaM4",
    authDomain: "tanprix-52683.firebaseapp.com",
    projectId: "tanprix-52683",
    storageBucket: "tanprix-52683.firebasestorage.app",
    messagingSenderId: "179060902521",
    appId: "1:179060902521:web:b717f47e67f304ff36e2a8",
    measurementId: "G-55HCRBEWNF"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function resolveAllAlerts() {
    try {
        const querySnapshot = await getDocs(collection(db, 'alerts'));
        const updatePromises = [];
        querySnapshot.forEach((document) => {
            if (document.exists()) {
                const data = document.data();
                if (data.status !== 'resolved') {
                    const alertRef = doc(db, 'alerts', document.id);
                    updatePromises.push(updateDoc(alertRef, { status: 'resolved' }));
                }
            }
        });

        if (updatePromises.length === 0) {
            console.log("No ongoing alerts found to resolve.");
        } else {
            await Promise.all(updatePromises);
            console.log(`Successfully resolved ${updatePromises.length} alerts.`);
        }
        process.exit(0);
    } catch (e) {
        console.error("Error resolving alerts: ", e);
        process.exit(1);
    }
}

resolveAllAlerts();
