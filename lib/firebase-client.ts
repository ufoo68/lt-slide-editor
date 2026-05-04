import { getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
};

const authEmulatorHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
let authEmulatorConnected = false;

export function isFirebaseClientConfigured() {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.storageBucket,
  );
}

export function getFirebaseApp() {
  if (!isFirebaseClientConfigured()) {
    throw new Error("Firebase client configuration is missing");
  }

  return getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
}

export function getClientAuth() {
  const auth = getAuth(getFirebaseApp());

  if (authEmulatorHost && !authEmulatorConnected) {
    connectAuthEmulator(auth, `http://${authEmulatorHost}`, { disableWarnings: true });
    authEmulatorConnected = true;
  }

  return auth;
}

export function getGoogleProvider() {
  return new GoogleAuthProvider();
}
