import { useState, type ChangeEvent, type FormEvent } from 'react';
import { DEFAULT_SITE } from '../config';
import { getToken } from '../lib/moodle';
import { checkSite, hostOf, normSite } from '../lib/url';
import type { LoginScreenProps } from '../types';
import { Checkbox } from './Checkbox';
import { Disclosure } from './Disclosure';

type PasswordCredentialCtor = new (data: { id: string; password: string; name?: string }) => Credential;

/** Ask the browser to remember the password for this site (Chrome, Edge, Opera). */
const offerToSavePassword = async (user: string, pass: string) => {
  const PC = (globalThis as unknown as { PasswordCredential?: PasswordCredentialCtor }).PasswordCredential;
  if (!PC || !navigator.credentials) return;
  try {
    await navigator.credentials.store(new PC({ id: user, password: pass, name: user }));
  } catch {
    /* the browser declined — no harm done */
  }
};

export const LoginScreen = ({ site, remember: rememberInitial, message = '', onLoggedIn }: LoginScreenProps) => {
  const [error, setError] = useState(message);
  const [busy, setBusy] = useState(false);
  const [siteInput, setSiteInput] = useState(site);
  const currentSite = normSite(siteInput);

  const handleSiteChange = (e: ChangeEvent<HTMLInputElement>) => setSiteInput(e.target.value);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const siteValue = normSite(f.get('site'));
    const token = String(f.get('token') || '').trim();
    const user = String(f.get('username') || '').trim();
    const pass = String(f.get('password') || '');
    const remember = f.get('remember') === 'on';

    const siteProblem = checkSite(siteValue);
    if (siteProblem) return setError(siteProblem);
    if (!token && (!user || !pass)) return setError('Введіть логін і пароль або токен.');

    setBusy(true);
    setError('');
    try {
      const t = token || (await getToken(siteValue, user, pass));
      if (!token && remember) await offerToSavePassword(user, pass);
      onLoggedIn({ site: siteValue, token: t, remember });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не вдалося увійти.');
      setBusy(false);
    } finally {
      // The password does not stay in the form after a login attempt.
      const pw = form.elements.namedItem('password');
      if (pw instanceof HTMLInputElement) pw.value = '';
    }
  };

  return (
    <main className="login">
      <h1 className="brand">Дедлайни</h1>
      <p className="lead">Усі завдання з вашого Moodle на одній сторінці, від найтерміновішого до найдальшого.</p>
      <form className="panel" method="post" action="#" autoComplete="on" noValidate onSubmit={handleSubmit}>
        <p className="warn-note">
          Логін і пароль підуть на {currentSite ? hostOf(currentSite) : 'вказаний нижче Moodle'}. Вводьте лише дані
          Moodle, де справді навчаєтесь.
        </p>
        <label>
          Логін Moodle
          <input name="username" id="username" autoComplete="username" autoCapitalize="off" spellCheck={false} />
        </label>
        <label>
          Пароль
          <input name="password" id="password" type="password" autoComplete="current-password" />
        </label>
        <Checkbox name="remember" defaultChecked={rememberInitial} label="Запам’ятати на цьому пристрої" />
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? 'Входжу…' : 'Увійти й завантажити завдання'}
        </button>
        <p className="hint">
          Пароль іде напряму в Moodle і ніде не зберігається. На пристрої лишається тільки токен доступу, як у
          мобільного застосунку Moodle. На чужому комп’ютері зніміть «Запам’ятати»: тоді токен зникне, щойно ви
          закриєте вкладку.
        </p>
        <Disclosure summary="Інший Moodle або вхід через Google" defaultOpen={normSite(site) !== DEFAULT_SITE}>
          <label>
            Адреса вашого Moodle
            <input
              name="site"
              value={siteInput}
              onChange={handleSiteChange}
              placeholder="moodle.university.edu.ua"
              inputMode="url"
              autoComplete="url"
              autoCapitalize="off"
              spellCheck={false}
            />
          </label>
          <p className="hint">
            Скопіюйте з адресного рядка, коли відкриваєте Moodle свого навчального закладу. Можна вставити посилання
            на будь-яку його сторінку.
          </p>
          <label>
            Токен (якщо входите через Google чи інший зовнішній сервіс)
            <input name="token" autoComplete="off" spellCheck={false} />
          </label>
        </Disclosure>
        <div className="error" role="alert">
          {error}
        </div>
      </form>
      {currentSite && (
        <p className="hint" style={{ marginTop: 16 }}>
          <a href={`${currentSite}/my/courses.php`} target="_blank" rel="noopener noreferrer">
            Відкрити {hostOf(currentSite)}
          </a>
        </p>
      )}
    </main>
  );
};
