import crypto from 'crypto';
import { env } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const ENCODING = 'hex';

/**
 * Returns the 32-byte encryption key derived from the configured env var.
 * Falls back to JWT_SECRET so existing deployments don't break before
 * a dedicated key is provisioned.
 */
function getKey(): Buffer {
  const raw = env.GITHUB_TOKEN_ENCRYPTION_KEY || env.JWT_SECRET;
  // SHA-256 guarantees exactly 32 bytes regardless of input length
  return crypto.createHash('sha256').update(raw).digest();
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a hex-encoded string: IV + AuthTag + Ciphertext.
 */
export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Pack as: IV (16) + AuthTag (16) + Ciphertext (variable)
  return Buffer.concat([iv, authTag, encrypted]).toString(ENCODING);
}

/**
 * Decrypt an AES-256-GCM encrypted hex string back to plaintext.
 * Returns null if decryption fails (e.g. corrupted data, wrong key).
 */
export function decryptToken(encryptedHex: string): string | null {
  try {
    const key = getKey();
    const data = Buffer.from(encryptedHex, ENCODING);

    if (data.length < IV_LENGTH + AUTH_TAG_LENGTH) {
      return null;
    }

    const iv = data.subarray(0, IV_LENGTH);
    const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    // Decryption failed — likely wrong key, corrupted data, or a plaintext token
    return null;
  }
}

/**
 * Determines whether a stored token string looks like it was AES-GCM-encrypted
 * by this module (hex-encoded, minimum length for IV + AuthTag).
 */
export function isEncryptedToken(value: string): boolean {
  // Minimum hex length: (16 + 16 + 1) * 2 = 66 hex chars
  if (value.length < 66) return false;
  // GitHub tokens start with "gho_" or "ghu_" — encrypted tokens are pure hex
  return /^[0-9a-f]+$/i.test(value);
}

/**
 * Smart getter: decrypt if encrypted, return as-is if plaintext (legacy data).
 * Returns null if the value is null/undefined.
 */
export function getPlaintextToken(storedValue: string | null | undefined): string | null {
  if (!storedValue) return null;

  if (isEncryptedToken(storedValue)) {
    return decryptToken(storedValue);
  }

  // Legacy plaintext token — return as-is
  return storedValue;
}
