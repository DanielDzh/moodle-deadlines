import { KEYS } from '../config';

/**
 * Обгортка над Web Storage. Сховище може бути недоступне (приватний режим, заборонені cookies),
 * тож кожне звернення в try/catch, а сайт працює й без нього.
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
        /* сховище недоступне */
      }
    },
    del(key: string) {
      try {
        get().removeItem(key);
      } catch {
        /* сховище недоступне */
      }
    },
  };
}

export const local = makeStore(() => window.localStorage);
export const session = makeStore(() => window.sessionStorage);

/**
 * Токен і кеш завдань: з «Запам'ятати» — у localStorage, без нього — лише до закриття вкладки.
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
