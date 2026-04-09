import 'server-only';

import { initializeApp, getApps, getApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const useEmulator = process.env.NEXT_PUBLIC_USE_EMULATOR === 'true';

function createAdminApp() {
  if (useEmulator) {
    // Emulator mode: no real credentials needed — admin SDK uses emulator hosts
    return initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'wishlist-dev' });
  }
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (privateKey) {
    return initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
  }
  return initializeApp({ credential: applicationDefault() });
}

const adminApp = getApps().length === 0 ? createAdminApp() : getApp();

export const adminDb = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);
