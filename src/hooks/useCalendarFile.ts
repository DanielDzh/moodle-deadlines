import { useCallback, useState } from 'react';
import { CALENDAR, CALENDAR_TEXTS } from '../config';
import { snapshotFromIcal } from '../lib/ical-snapshot';
import type { Snapshot } from '../types';

/** Reads a calendar export file in the browser and hands the resulting snapshot over. Nothing is sent anywhere. */
export const useCalendarFile = (remember: boolean, onLoaded: (snapshot: Snapshot, remember: boolean) => void) => {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (file: File) => {
      setError('');
      if (file.size > CALENDAR.maxFileBytes) return setError(CALENDAR_TEXTS.errors.tooBig);
      setBusy(true);
      let text: string;
      try {
        text = await file.text();
      } catch {
        setBusy(false);
        return setError(CALENDAR_TEXTS.errors.read);
      }
      if (!/BEGIN:VCALENDAR/i.test(text)) {
        setBusy(false);
        return setError(CALENDAR_TEXTS.errors.notCalendar);
      }
      const snapshot = snapshotFromIcal(text);
      if (!snapshot) {
        setBusy(false);
        return setError(CALENDAR_TEXTS.errors.empty);
      }
      setBusy(false);
      onLoaded(snapshot, remember);
    },
    [remember, onLoaded],
  );

  return { error, busy, load };
};
