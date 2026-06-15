import app, { auth, db } from '../config/firebase';
import { getStorage } from 'firebase/storage';

export const firestore = db;
export const storage = getStorage(app);
export { auth };

export default app;