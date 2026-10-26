import { useCallback, useState } from 'react';
import { local } from '../lib/storage';

/** useState, значення якого переживає перезавантаження сторінки (localStorage). */
export function useStoredState<T>(key: string, initial: T | (() => T)) {
  const [value, setValue] = useState<T>(() => {
    const fallback = typeof initial === 'function' ? (initial as () => T)() : initial;
    return local.get<T>(key, fallback);
  });
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const v = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        local.set(key, v);
        return v;
      });
    },
    [key],
  );
  return [value, set] as const;
}
