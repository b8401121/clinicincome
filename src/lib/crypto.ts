// Client-side Zero-Knowledge End-to-End Encryption (E2EE)
// Using native Web Cryptography API (PBKDF2 + AES-GCM-256)

export interface EncryptedEnvelope {
  version: number;
  salt: string;       // base64
  iv: string;         // base64 (12 bytes)
  ciphertext: string; // base64
  updated_at: string; // ISO string
}

export interface VaultChallenge {
  salt: string;       // base64
  iv: string;         // base64
  ciphertext: string; // base64 of "VAULT_HEALTHY_VALID_TOKEN"
  created_at: string;
}

const VAULT_CHALLENGE_TEXT = "CLINIC_MD_VAULT_AUTHORIZED_OK";
const PBKDF2_ITERATIONS = 100000;

// In-memory session key (never persisted to disk or cloud)
let activeKey: CryptoKey | null = null;
let activeSalt: Uint8Array | null = null;

// Utility functions for base64 and binary conversions
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Derive a 256-bit AES-GCM key from password and salt
async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },

    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// Setup a new vault challenge with the given master password
export async function createVaultChallenge(password: string): Promise<VaultChallenge> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKeyFromPassword(password, salt);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const encoder = new TextEncoder();
  const encryptedBuf = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(VAULT_CHALLENGE_TEXT)
  );

  // Set active session
  activeKey = key;
  activeSalt = salt;

  return {
    salt: arrayBufferToBase64(salt),
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(encryptedBuf),
    created_at: new Date().toISOString(),
  };
}

// Verify password against challenge and unlock session
export async function unlockVaultWithChallenge(
  password: string,
  challenge: VaultChallenge
): Promise<boolean> {
  try {
    const salt = base64ToArrayBuffer(challenge.salt);
    const iv = base64ToArrayBuffer(challenge.iv);
    const ciphertext = base64ToArrayBuffer(challenge.ciphertext);

    const key = await deriveKeyFromPassword(password, salt);
    const decryptedBuf = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as unknown as BufferSource },
      key,
      ciphertext as unknown as BufferSource
    );


    const decoder = new TextDecoder();
    const result = decoder.decode(decryptedBuf);

    if (result === VAULT_CHALLENGE_TEXT) {
      activeKey = key;
      activeSalt = salt;
      return true;
    }
    return false;
  } catch (err) {
    console.warn("Vault decryption failed (invalid password or corrupted data):", err);
    return false;
  }
}

// Lock vault and clear session key
export function lockVault(): void {
  activeKey = null;
  activeSalt = null;
}

// Check if currently unlocked
export function isVaultUnlocked(): boolean {
  return activeKey !== null;
}

// Encrypt any JavaScript object into an EncryptedEnvelope
export async function encryptPayload<T>(payload: T): Promise<EncryptedEnvelope> {
  if (!activeKey) {
    throw new Error("金鑰庫尚未解鎖，無法執行加密操作");
  }

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const jsonStr = JSON.stringify(payload);

  const encryptedBuf = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    activeKey,
    encoder.encode(jsonStr)
  );

  return {
    version: 1,
    salt: activeSalt ? arrayBufferToBase64(activeSalt) : "",
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(encryptedBuf),
    updated_at: new Date().toISOString(),
  };
}

// Decrypt an EncryptedEnvelope back into original object
export async function decryptPayload<T>(envelope: EncryptedEnvelope): Promise<T> {
  if (!activeKey) {
    throw new Error("金鑰庫尚未解鎖，無法執行解密操作");
  }

  const iv = base64ToArrayBuffer(envelope.iv);
  const ciphertext = base64ToArrayBuffer(envelope.ciphertext);

  const decryptedBuf = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    activeKey,
    ciphertext as unknown as BufferSource
  );


  const decoder = new TextDecoder();
  const jsonStr = decoder.decode(decryptedBuf);
  return JSON.parse(jsonStr) as T;
}
