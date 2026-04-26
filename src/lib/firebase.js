import { getApp, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { doc, getFirestore } from 'firebase/firestore';

let app;
let auth;
let db;
let getRoomRef;

try {
  if (typeof __firebase_config !== 'undefined') {
    const firebaseConfig = JSON.parse(__firebase_config);
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    getRoomRef = () => doc(db, 'artifacts', appId, 'public', 'data', 'rooms', 'shared-room');
  } else {
    const firebaseConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    getRoomRef = () => doc(db, 'rooms', 'shared-room');
  }
} catch (e) {
  console.error('Firebase Init Error:', e);
}

/** Firestore REST v1 PATCH URL（不含 query）；供 keepalive 寫入。 */
export function getFirestoreRestPatchUrl() {
  if (!app || !getRoomRef) return null;
  try {
    const projectId = getApp().options?.projectId;
    if (!projectId) return null;
    const ref = getRoomRef();
    const escaped = ref.path.split('/').join('%2F');
    return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${escaped}`;
  } catch {
    return null;
  }
}

export { app, auth, db, getRoomRef };
