import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { DATA_VERSION, KEYS } from './config';
import { BoardView } from './components/BoardView';
import { LoginScreen } from './components/LoginScreen';
import { LogoutDialog } from './components/LogoutDialog';
import { ErrorScreen, LoadingScreen } from './components/StatusScreens';
import { useStoredState } from './hooks/useStoredState';
import { collectSnapshot, isAuthError, sanitizeSnapshot } from './lib/moodle';
import { local, readSecret, saveSecret, wipeSecrets } from './lib/storage';
import { normSite } from './lib/url';
import type { Snapshot, Theme } from './types';

/** Адреса Moodle: з посилання ?site=… (щоб роздати готове посилання) або збережена раніше. */
function initialSite(): string {
  try {
    const q = new URLSearchParams(window.location.search).get('site');
    if (q) return normSite(q);
  } catch {
    /* немає доступу до адреси */
  }
  return local.get<string>(KEYS.site, '') || '';
}

function initialSnapshot(): Snapshot | null {
  const d = readSecret<Snapshot | null>(KEYS.data, null);
  return d && d.v === DATA_VERSION ? sanitizeSnapshot(d) : null;
}

export function App() {
  const [site, setSite] = useState(initialSite);
  const [token, setToken] = useState(() => readSecret<string>(KEYS.token, ''));
  const [remember, setRemember] = useState(() => local.get<boolean>(KEYS.remember, true) !== false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(initialSnapshot);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [loginMessage, setLoginMessage] = useState('');
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [theme, setTheme] = useStoredState<Theme>(KEYS.theme, 'auto');
  const busy = useRef(false);

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

  /** Тягне свіжі дані з Moodle. Поки триває, на екрані лишаються збережені з минулого разу. */
  const refresh = useCallback(async () => {
    if (!token || busy.current) return;
    busy.current = true;
    try {
      const data = await collectSnapshot(site, token, setProgress);
      saveSecret(KEYS.data, data, remember);
      setSnapshot(data);
      setError('');
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
      setProgress('');
    }
  }, [site, token, remember]);

  // Дані оновлюються щоразу, коли сторінку відкривають або перезавантажують, і одразу після входу.
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
    setToken(s.token);
  }, []);

  const nextTheme = useCallback(
    () => setTheme((t) => (t === 'auto' ? 'light' : t === 'light' ? 'dark' : 'auto')),
    [setTheme],
  );

  if (!token) {
    return <LoginScreen site={site} remember={remember} message={loginMessage} onLoggedIn={onLoggedIn} />;
  }

  const openLogout = () => setConfirmingLogout(true);
  let screen: ReactNode;
  if (snapshot) {
    screen = (
      <BoardView
        snapshot={snapshot}
        progress={progress ? 'Оновлюю дані…' : ''}
        error={error}
        theme={theme}
        onNextTheme={nextTheme}
        onLogout={openLogout}
      />
    );
  } else if (error) {
    screen = (
      <ErrorScreen
        error={error}
        onRetry={() => {
          setError('');
          void refresh();
        }}
        onLogout={openLogout}
      />
    );
  } else {
    screen = <LoadingScreen progress={progress} />;
  }

  return (
    <>
      {screen}
      {confirmingLogout && <LogoutDialog onConfirm={logout} onClose={() => setConfirmingLogout(false)} />}
    </>
  );
}
