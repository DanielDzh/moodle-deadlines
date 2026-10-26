/** 32 characters without the look-alikes I, O, 0, 1: a code can be read aloud or retyped. 32 divides 256, so no modulo bias. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 10;

/** A one-time code for linking a browser to a Telegram chat (about 50 bits of randomness). */
export const generateLinkCode = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return [...bytes].map((b) => ALPHABET[b & 31]).join('');
};

/** A random user id. */
export const generateUserId = (): string => crypto.randomUUID();
