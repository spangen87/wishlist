import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Guard: only initialize if not already done.
// Required for Next.js HMR — without this guard, every hot-reload calls initializeApp()
// again and throws "Firebase app already exists [DEFAULT]".
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);
export const auth = getAuth(app);

// Emulator connections — only in local dev when NEXT_PUBLIC_USE_EMULATOR=true
if (process.env.NEXT_PUBLIC_USE_EMULATOR === 'true') {
  // connectAuthEmulator and connectFirestoreEmulator are idempotent only if called once.
  // The HMR guard (getApps check) ensures this file only initialises once per process,
  // but hot-reload can re-run module-level code. Guard with a flag on the auth object.
  if (!(auth as unknown as { _emulatorConfig?: unknown })._emulatorConfig) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  }
  // Firestore emulator: connectFirestoreEmulator throws if called twice on same instance.
  // Use the internal _settings check pattern.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(db as any)._settingsFrozen) {
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
}
