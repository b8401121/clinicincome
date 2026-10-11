import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User,
  Auth,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  Firestore,
} from "firebase/firestore";
import { VaultChallenge, EncryptedEnvelope } from "./crypto";

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

const STORAGE_KEY_FIREBASE_CONFIG = "clinic_income_firebase_config_v1";

// Load config from LocalStorage or Vite Env
export function getFirebaseConfig(): FirebaseConfig | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_FIREBASE_CONFIG);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.apiKey && parsed.projectId) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("Failed to parse stored Firebase config:", err);
  }

  // Fallback to environment variables if provided during build
  const envKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const envProject = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  if (envKey && envProject) {
    return {
      apiKey: envKey,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${envProject}.firebaseapp.com`,
      projectId: envProject,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
    };
  }

  return null;
}

export function saveFirebaseConfig(config: FirebaseConfig): void {
  localStorage.setItem(STORAGE_KEY_FIREBASE_CONFIG, JSON.stringify(config));
  // Reload app to re-initialize Firebase
  window.location.reload();
}

export function clearFirebaseConfig(): void {
  localStorage.removeItem(STORAGE_KEY_FIREBASE_CONFIG);
  window.location.reload();
}

// Global Firebase instance
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let firestore: Firestore | null = null;

export function initFirebase(): { app: FirebaseApp; auth: Auth; firestore: Firestore } | null {
  const config = getFirebaseConfig();
  if (!config) return null;

  try {
    if (!getApps().length) {
      app = initializeApp(config);
    } else {
      app = getApp();
    }
    auth = getAuth(app);
    firestore = getFirestore(app);
    return { app, auth, firestore };
  } catch (err) {
    console.error("Firebase initialization failed:", err);
    return null;
  }
}

// Initialize on module load
initFirebase();

// Authentication API
export async function loginWithGoogle(): Promise<User> {
  if (!auth) {
    throw new Error("尚未設定 Firebase Config，請先完成 Firebase 雲端連線設定");
  }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function logoutUser(): Promise<void> {
  if (auth) {
    await signOut(auth);
  }
}

export function subscribeAuth(callback: (user: User | null) => void): () => void {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

// Firestore E2EE API (All data stored in Firestore is 100% encrypted ciphertext)
export async function fetchVaultChallenge(uid: string): Promise<VaultChallenge | null> {
  if (!firestore) return null;
  const docRef = doc(firestore, `users/${uid}/meta/vault_challenge`);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    return snap.data() as VaultChallenge;
  }
  return null;
}

export async function saveVaultChallenge(uid: string, challenge: VaultChallenge): Promise<void> {
  if (!firestore) throw new Error("Firestore 未初始化");
  const docRef = doc(firestore, `users/${uid}/meta/vault_challenge`);
  await setDoc(docRef, challenge);
}

export async function uploadEncryptedRecord(
  uid: string,
  recordId: number,
  envelope: EncryptedEnvelope
): Promise<void> {
  if (!firestore) throw new Error("Firestore 未初始化");
  const docRef = doc(firestore, `users/${uid}/encrypted_records/${recordId}`);
  await setDoc(docRef, envelope);
}

export async function fetchAllEncryptedRecords(
  uid: string
): Promise<{ id: number; envelope: EncryptedEnvelope }[]> {
  if (!firestore) return [];
  const colRef = collection(firestore, `users/${uid}/encrypted_records`);
  const snap = await getDocs(colRef);
  return snap.docs.map((d) => ({
    id: parseInt(d.id, 10),
    envelope: d.data() as EncryptedEnvelope,
  }));
}

export async function removeEncryptedRecord(uid: string, recordId: number): Promise<void> {
  if (!firestore) throw new Error("Firestore 未初始化");
  const docRef = doc(firestore, `users/${uid}/encrypted_records/${recordId}`);
  await deleteDoc(docRef);
}
