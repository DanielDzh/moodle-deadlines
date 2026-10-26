import { useEffect, useState } from 'react';
import { MINUTE_TICK_MS } from '../config';

const minuteKey = () => String(Math.floor(Date.now() / 60_000));

/** Returns the current-minute key and updates every minute so time left and days recompute on their own. */
export const useMinute = (): string => {
  const [key, setKey] = useState(minuteKey);
  useEffect(() => {
    const id = window.setInterval(() => setKey(minuteKey), MINUTE_TICK_MS);
    return () => window.clearInterval(id);
  }, []);
  return key;
};
