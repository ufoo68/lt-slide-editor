import { getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from "firebase/auth";

type FirebaseRuntimeConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
};

type FirebaseConfigResponse = {
  authEmulatorHost?: string;
  config: FirebaseRuntimeConfig | null;
  configured: boolean;
};

let authEmulatorConnected = false;
let configPromise: Promise<FirebaseConfigResponse> | null = null;

async function loadFirebaseConfig() {
  configPromise ??= fetch("/api/config/firebase", { cache: "no-store" }).then(async (response) => {
    if (!response.ok) {
      throw new Error("Firebase設定を読み込めませんでした");
    }

    return (await response.json()) as FirebaseConfigResponse;
  });

  return configPromise;
}

export async function isFirebaseClientConfigured() {
  return (await loadFirebaseConfig()).configured;
}

export async function getFirebaseApp() {
  const { config } = await loadFirebaseConfig();
  if (!config) {
    throw new Error("Firebase client configuration is missing");
  }

  return getApps().length ? getApps()[0] : initializeApp(config);
}

export async function getClientAuth() {
  const { authEmulatorHost } = await loadFirebaseConfig();
  const auth = getAuth(await getFirebaseApp());

  if (authEmulatorHost && !authEmulatorConnected) {
    connectAuthEmulator(auth, `http://${authEmulatorHost}`, { disableWarnings: true });
    authEmulatorConnected = true;
  }

  return auth;
}

export function getGoogleProvider() {
  return new GoogleAuthProvider();
}
