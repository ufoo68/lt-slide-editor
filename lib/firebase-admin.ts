import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function privateKey() {
  return process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
}

export function getAdminAuth() {
  const app = getApps()[0] ?? initializeAdminApp();

  return getAuth(app);
}

export function getAdminFirestore() {
  const app = getApps()[0] ?? initializeAdminApp();

  return getFirestore(app);
}

function initializeAdminApp() {
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    return initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
  }

  const key = privateKey();
  if (!process.env.FIREBASE_CLIENT_EMAIL || !key) {
    return initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
  }

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: key,
    }),
  });
}
