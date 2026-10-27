import { useCallback, useEffect, useRef, useState } from 'react';
import { KEYS, REMINDERS, REMINDER_TEXTS } from '../config';
import { fetchLinkStatus, hasSyncKey, linkStart, pushItems, RemindersError, unlink } from '../lib/reminders-api';
import { buildReminderItems, sameKeys } from '../lib/reminders-sync';
import { local } from '../lib/storage';
import type { LinkStatus, ReminderState, RemindersApi, Snapshot } from '../types';

const errorText = (error: unknown): string => {
  const code = error instanceof RemindersError ? error.code : 'network';
  const known = REMINDER_TEXTS.errors as Record<string, string>;
  return known[code] ?? REMINDER_TEXTS.errors.default;
};

/** Telegram reminders: link state, linking, unlinking and pushing tasks to the service. */
export const useReminders = ({ site, token }: { site: string; token: string }): RemindersApi => {
  const [state, setState] = useState<ReminderState>('unknown');
  const [remoteDone, setRemoteDone] = useState<readonly string[]>([]);
  const [botUrl, setBotUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const expiresAt = useRef(0);
  const debounce = useRef<number | undefined>(undefined);
  const stateRef = useRef(state);
  stateRef.current = state;
  /** Set once the server's list of done tasks has been read, so a stale local list never overwrites the bot's presses. */
  const pulled = useRef(false);

  const applyStatus = useCallback((status: LinkStatus) => {
    if (status.state === 'active') {
      setRemoteDone((previous) => (sameKeys(previous, status.done) ? previous : status.done));
      pulled.current = true;
    }
    setState(status.state);
  }, []);

  // On start: ask the service, but only if this browser has ever linked (otherwise there is nothing to ask).
  useEffect(() => {
    if (!token) return;
    if (!hasSyncKey()) {
      setState('none');
      return;
    }
    fetchLinkStatus().then(applyStatus, () => setState('unavailable'));
  }, [token, applyStatus]);

  // Back on the tab after pressing a button in Telegram: read the server's list again.
  useEffect(() => {
    if (state !== 'active') return;
    const refresh = () => {
      if (document.visibilityState === 'visible') fetchLinkStatus().then(applyStatus, () => undefined);
    };
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, [state, applyStatus]);

  // While a link is pending, wait for the student to press Start in the bot.
  useEffect(() => {
    if (state !== 'pending') return;
    const id = window.setInterval(async () => {
      if (Date.now() / 1000 > expiresAt.current && expiresAt.current > 0) {
        setState('none');
        return;
      }
      try {
        const next = await fetchLinkStatus();
        if (next.state !== 'pending') applyStatus(next);
      } catch {
        /* a temporary network problem: try again on the next tick */
      }
    }, REMINDERS.pollMs);
    return () => window.clearInterval(id);
  }, [state, applyStatus]);

  const start = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const result = await linkStart(site, token);
      expiresAt.current = result.expiresAt;
      setBotUrl(result.botUrl);
      setState('pending');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }, [site, token]);

  const disable = useCallback(async () => {
    if (!hasSyncKey()) {
      setState('none');
      return true;
    }
    setBusy(true);
    setError('');
    try {
      await unlink();
      setBotUrl('');
      setState('none');
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const syncSoon = useCallback((snapshot: Snapshot, done: Record<string, boolean>) => {
    if (stateRef.current !== 'active' || !pulled.current) return;
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => {
      // Read the done ticks at send time (localStorage is the source of truth) so a late tick is not lost.
      const latest = local.get<Record<string, boolean>>(KEYS.done, done);
      pushItems(buildReminderItems(snapshot, latest, Math.floor(Date.now() / 1000))).catch((e) => {
        if (e instanceof RemindersError && e.code === 'not_active') fetchLinkStatus().then(applyStatus, () => undefined);
      });
    }, REMINDERS.syncDebounceMs);
  }, [applyStatus]);

  const clearError = useCallback(() => setError(''), []);

  return { state, remoteDone, botUrl, error, busy, start, disable, syncSoon, clearError };
};
