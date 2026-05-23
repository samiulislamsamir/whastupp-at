import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

// This will be updated once firebase-applet-config.json is available
import firebaseConfig from '../firebase-applet-config.json';

const config: any = firebaseConfig;

const app = initializeApp(config);
export const db = config.firestoreDatabaseId ? getFirestore(app, config.firestoreDatabaseId) : getFirestore(app);
export const auth = getAuth(app);

// Analytics is optional and might fail in some environments
let analytics = null;
try {
  if (typeof window !== 'undefined' && firebaseConfig.measurementId) {
    analytics = getAnalytics(app);
  }
} catch (e) {
  console.warn("Analytics initialization failed:", e);
}
export { analytics };
