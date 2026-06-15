const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc } = require('firebase/firestore');

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

async function cleanup() {
    console.log("--- Starting Database Purge (Keeping 'Theft' only) ---");
    try {
        const evidenceRef = collection(db, "evidence");
        const snapshot = await getDocs(evidenceRef);
        console.log(`Found ${snapshot.size} records in database.`);

        let deletedCount = 0;
        let keptCount = 0;

        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            const fileName = (data.fileName || "").toLowerCase();
            const category = (data.category || "").toLowerCase();
            const folderName = (data.folderName || "").toLowerCase();
            
            const isTheft = fileName.includes("theft") || 
                            category.includes("theft") || 
                            folderName.includes("theft");

            if (!isTheft) {
                console.log(`[DELETE] ${docSnap.id} - ${data.fileName || 'Unnamed'}`);
                await deleteDoc(doc(db, "evidence", docSnap.id));
                deletedCount++;
            } else {
                console.log(`[KEEP] ${docSnap.id} - ${data.fileName || 'Unnamed'}`);
                keptCount++;
            }
        }

        console.log(`--- Done! Deleted: ${deletedCount}, Kept: ${keptCount} ---`);
        process.exit(0);
    } catch (err) {
        console.error("Cleanup failed:", err);
        process.exit(1);
    }
}

cleanup();
