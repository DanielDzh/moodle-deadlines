import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { DATA_VERSION, DEFAULT_SITE, KEYS, LOADER } from './config';
import { BoardView } from './components/BoardView';
import { LoginScreen } from './components/LoginScreen';
import { LogoutDialog } from './components/LogoutDialog';
import { ErrorScreen, LoadingScreen } from './components/StatusScreens';
import { useReminders } from './hooks/useReminders';
import { useStoredState } from './hooks/useStoredState';
import { collectSnapshot, isAuthError, sanitizeSnapshot } from './lib/moodle';
import { local, readSecret, saveSecret, wipeSecrets } from './lib/storage';
import { normSite } from './lib/url';
import type { LoadProgress, Snapshot, Theme } from './types';

/** Moodle address: from the ?site=… link (to hand out a ready link) or saved earlier. */
function initialSite(): string {
  try {
    const q = new URLSearchParams(window.location.search).get('site');
    if (q) return normSite(q);
  } catch {
    /* no access to the address */
  }
  return local.get<string>(KEYS.site, '') || DEFAULT_SITE;
}

function initialSnapshot(): Snapshot | null {
  const d = readSecret<Snapshot | null>(KEYS.data, null);
  return d && d.v === DATA_VERSION ? sanitizeSnapshot(d) : null;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function App() {
  const [site, setSite] = useState(initialSite);
  const [token, setToken] = useState(() => readSecret<string>(KEYS.token, ''));
  const [remember, setRemember] = useState(() => local.get<boolean>(KEYS.remember, true) !== false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(initialSnapshot);
  const [progress, setProgress] = useState<LoadProgress | null>(null);
  const [loader, setLoader] = useState(true);
  const [error, setError] = useState('');
  const [loginMessage, setLoginMessage] = useState('');
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [theme, setTheme] = useStoredState<Theme>(KEYS.theme, 'auto');
  const reminders = useReminders({ site, token });
  const busy = useRef(false);
  const [leaving, setLeaving] = useState(false);
  const loaderRef = useRef(true);

  const setLoaderOn = useCallback((on: boolean) => {
    loaderRef.current = on;
    setLoader(on);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'auto') delete root.dataset.theme;
    else root.dataset.theme = theme;
  }, [theme]);

  const logout = useCallback(() => {
    wipeSecrets();
    setToken('');
    setSnapshot(null);
    setError('');
    setConfirmingLogout(false);
  }, []);

  /** Pulls fresh data from Moodle. While it runs, the data saved last time stays on screen. */
  const refresh = useCallback(async () => {
    if (!token || busy.current) return;
    busy.current = true;
    const started = Date.now();
    try {
      const data = await collectSnapshot(site, token, setProgress);
      saveSecret(KEYS.data, data, remember);
      setSnapshot(data);
      setError('');
      if (loaderRef.current) {
        // All ticks have time to appear, and the loader does not flicker if Moodle answered instantly.
        setProgress({ stage: 'done' });
        await sleep(Math.max(0, LOADER.minShowMs - (Date.now() - started)) + LOADER.doneHoldMs);
        setLeaving(true);
        await sleep(LOADER.fadeMs);
      }
    } catch (e) {
      if (isAuthError(e)) {
        wipeSecrets();
        setToken('');
        setSnapshot(null);
        setLoginMessage('Доступ застарів. Увійдіть ще раз.');
      } else {
        setError(e instanceof Error ? e.message : 'Невідома помилка.');
      }
    } finally {
      busy.current = false;
      setProgress(null);
      setLeaving(false);
      setLoaderOn(false);
    }
  }, [site, token, remember, setLoaderOn]);

  // Data refreshes every time the page is opened or reloaded, and right after login.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onLoggedIn = useCallback((s: { site: string; token: string; remember: boolean }) => {
    local.set(KEYS.site, s.site);
    local.set(KEYS.remember, s.remember);
    saveSecret(KEYS.token, s.token, s.remember);
    setSite(s.site);
    setRemember(s.remember);
    setSnapshot(null);
    setError('');
    setLoginMessage('');
    setLoaderOn(true);
    setToken(s.token);
  }, [setLoaderOn]);

  const nextTheme = useCallback(
    () => setTheme((t) => (t === 'auto' ? 'light' : t === 'light' ? 'dark' : 'auto')),
    [setTheme],
  );

  if (!token) {
    return <LoginScreen site={site} remember={remember} message={loginMessage} onLoggedIn={onLoggedIn} />;
  }

  const remindersOn = reminders.state === 'active' || reminders.state === 'pending';
  const handleLogoutConfirm = async () => {
    // Reminders keep the Moodle token on the server, so turn them off first (best effort: logout never blocks on the network).
    if (remindersOn) await reminders.disable();
    logout();
  };
  const openLogout = () => setConfirmingLogout(true);
  const closeLogout = () => setConfirmingLogout(false);
  const handleRetry = () => {
    setError('');
    setLoaderOn(true);
    void refresh();
  };
  let screen: ReactNode;
  if (loader) {
    screen = <LoadingScreen progress={progress} leaving={leaving} />;
  } else if (snapshot) {
    screen = (
      <BoardView
        snapshot={snapshot}
        error={error}
        theme={theme}
        onNextTheme={nextTheme}
        onLogout={openLogout}
        reminders={reminders}
      />
    );
  } else if (error) {
    screen = (
      <ErrorScreen
        error={error}
        onRetry={handleRetry}
        onLogout={openLogout}
      />
    );
  } else {
    screen = <LoadingScreen progress={progress} leaving={leaving} />;
  }

  return (
    <>
      {screen}
      {confirmingLogout && <LogoutDialog remindersOn={remindersOn} onConfirm={handleLogoutConfirm} onClose={closeLogout} />}
    </>
  );
}
