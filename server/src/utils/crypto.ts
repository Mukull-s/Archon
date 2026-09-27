import crypto from 'crypto';
import { env } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const ENCODING = 'hex';



function getKey(): Buffer {
  const raw = env.GITHUB_TOKEN_ENCRYPTION_KEY || env.JWT_SECRET;
  // SHA-256 guarantees exactly 32 bytes regardless of input length
  return crypto.createHash('sha256').update(raw).digest();
}

export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString(ENCODING);
}


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
    return null;
  }
}


export function isEncryptedToken(value: string): boolean {
  if (value.length < 66) return false;
  return /^[0-9a-f]+$/i.test(value);
}


export function getPlaintextToken(storedValue: string | null | undefined): string | null {
  if (!storedValue) return null;

  if (isEncryptedToken(storedValue)) {
    return decryptToken(storedValue);
  }

  // Legacy plaintext token — return as-is
  return storedValue;
}
