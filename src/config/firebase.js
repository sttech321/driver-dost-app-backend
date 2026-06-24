import { readFileSync, existsSync } from 'node:fs';
import admin from 'firebase-admin';
import { env } from './env.js';

let firebaseApp = null;

/**
 * Lazily initialise the Firebase Admin SDK.
 * Supports either a service-account JSON file path or inline credentials.
 * Returns null if Firebase is not configured (the backend then falls back
 * to its own OTP store for phone verification).
 */
export function getFirebaseApp() {
  if (firebaseApp) return firebaseApp;
  if (admin.apps.length) {
    firebaseApp = admin.app();
    return firebaseApp;
  }

  try {
    let credential;

    if (env.firebase.serviceAccountPath && existsSync(env.firebase.serviceAccountPath)) {
      const json = JSON.parse(readFileSync(env.firebase.serviceAccountPath, 'utf-8'));
      credential = admin.credential.cert(json);
    } else if (
      env.firebase.projectId &&
      env.firebase.clientEmail &&
      env.firebase.privateKey
    ) {
      credential = admin.credential.cert({
        projectId: env.firebase.projectId,
        clientEmail: env.firebase.clientEmail,
        // .env stores the key with literal "\n" sequences.
        privateKey: env.firebase.privateKey.replace(/\\n/g, '\n'),
      });
    } else {
      console.warn('[firebase] Not configured — using fallback OTP store.');
      return null;
    }

    firebaseApp = admin.initializeApp({ credential });
    console.log('[firebase] Admin SDK initialised.');
    return firebaseApp;
  } catch (err) {
    console.error('[firebase] Failed to initialise:', err.message);
    return null;
  }
}

export function isFirebaseEnabled() {
  return getFirebaseApp() !== null;
}

/**
 * Verify a Firebase ID token (phone-auth or Google sign-in).
 * @returns decoded token { uid, phone_number, email, name, picture, ... }
 */
export async function verifyFirebaseIdToken(idToken) {
  const app = getFirebaseApp();
  if (!app) throw new Error('Firebase not configured');
  return admin.auth(app).verifyIdToken(idToken);
}
