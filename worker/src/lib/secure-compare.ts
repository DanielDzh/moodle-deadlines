import { sha256Hex } from './token-crypto';

/** Compares two secrets without leaking where they differ: both are hashed first, then compared in constant time. */
export const secretsMatch = async (a: string, b: string): Promise<boolean> => {
  const [ha, hb] = await Promise.all([sha256Hex(a), sha256Hex(b)]);
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha.charCodeAt(i) ^ hb.charCodeAt(i);
  return diff === 0;
};
