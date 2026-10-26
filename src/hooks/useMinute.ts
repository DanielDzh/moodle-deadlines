import { useEffect, useState } from 'react';
import { MINUTE_TICK_MS } from '../config';

const minuteKey = () => String(Math.floor(Date.now() / 60_000));

/** Повертає ключ поточної хвилини й оновлюється щохвилини, щоб залишок годин і дні перерахувалися самі. */
export const useMinute = (): string => {
  const [key, setKey] = useState(minuteKey);
  useEffect(() => {
    const id = window.setInterval(() => setKey(minuteKey), MINUTE_TICK_MS);
    return () => window.clearInterval(id);
  }, []);
  return key;
};
