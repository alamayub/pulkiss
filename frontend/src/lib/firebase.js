import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

function getFirebaseApp() {
  if (!getApps().length) {
    if (!config.apiKey || !config.projectId) {
      throw new Error("Missing VITE_FIREBASE_* in .env — see .env.example");
    }
    return initializeApp(config);
  }
  return getApp();
}

export function getFirebaseAuth() {
  return getAuth(getFirebaseApp());
}
