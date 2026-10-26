import { TOKEN_FORMAT_VERSION } from '../config';

const IV_BYTES = 12;
const KEY_BYTES = 32;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toBase64 = (bytes: Uint8Array): string => {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};

const fromBase64 = (text: string): Uint8Array => {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const importKey = async (keyBase64: string): Promise<CryptoKey> => {
  const raw = fromBase64(keyBase64);
  if (raw.length !== KEY_BYTES) throw new Error('TOKEN_KEY must be 32 bytes in base64.');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
};

/**
 * Encrypts a Moodle token (AES-256-GCM). The user id goes into the AAD, so one user's ciphertext
 * does not decrypt under another user even with the right key.
 * Format: v1.<iv>.<ciphertext>, both in base64.
 */
export const encryptToken = async (plain: string, keyBase64: string, userId: string): Promise<string> => {
  const key = await importKey(keyBase64);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(userId) },
    key,
    encoder.encode(plain),
  );
  return `${TOKEN_FORMAT_VERSION}.${toBase64(iv)}.${toBase64(new Uint8Array(cipher))}`;
};

/** Decrypts a token. Throws if the key, the user or the data do not match. */
export const decryptToken = async (payload: string, keyBase64: string, userId: string): Promise<string> => {
  const [version, ivPart, cipherPart] = payload.split('.');
  if (version !== TOKEN_FORMAT_VERSION || !ivPart || !cipherPart) throw new Error('Unknown token format.');
  const key = await importKey(keyBase64);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(ivPart), additionalData: encoder.encode(userId) },
    key,
    fromBase64(cipherPart),
  );
  return decoder.decode(plain);
};

/** A new encryption key (for `wrangler secret put TOKEN_KEY`). */
export const generateTokenKey = (): string => toBase64(crypto.getRandomValues(new Uint8Array(KEY_BYTES)));

/** SHA-256 in hex. The browser sync key is stored only in this form. */
export const sha256Hex = async (text: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
};
