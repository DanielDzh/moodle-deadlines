import { KEYS } from '../config';

/**
 * Web Storage wrapper. Storage may be unavailable (private mode, blocked cookies),
 * so every access is in try/catch and the site works without it too.
 */
function makeStore(get: () => Storage) {
  return {
    get<T>(key: string, fallback: T): T {
      try {
        const v = get().getItem(key);
        return v === null ? fallback : (JSON.parse(v) as T);
      } catch {
        return fallback;
      }
    },
    set(key: string, value: unknown) {
      try {
        get().setItem(key, JSON.stringify(value));
      } catch {
        /* storage unavailable */
      }
    },
    del(key: string) {
      try {
        get().removeItem(key);
      } catch {
        /* storage unavailable */
      }
    },
  };
}

export const local = makeStore(() => window.localStorage);
export const session = makeStore(() => window.sessionStorage);

/**
 * Token and task cache: with "Remember" — in localStorage, without it — only until the tab is closed.
 */
export function saveSecret(key: string, value: unknown, remember: boolean) {
  if (remember) {
    local.set(key, value);
    session.del(key);
  } else {
    session.set(key, value);
    local.del(key);
  }
}

export function readSecret<T>(key: string, fallback: T): T {
  return local.get<T | null>(key, null) ?? session.get<T>(key, fallback);
}

export function wipeSecrets() {
  for (const k of [KEYS.token, KEYS.data]) {
    local.del(k);
    session.del(k);
  }
}
