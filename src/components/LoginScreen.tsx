import { useState, type FormEvent } from 'react';
import { getToken } from '../lib/moodle';
import { checkSite, hostOf, normSite } from '../lib/url';

interface Props {
  site: string;
  remember: boolean;
  message?: string;
  onLoggedIn: (session: { site: string; token: string; remember: boolean }) => void;
}

type PasswordCredentialCtor = new (data: { id: string; password: string; name?: string }) => Credential;

/** Просимо браузер запам'ятати пароль для цього сайту (Chrome, Edge, Opera). */
async function offerToSavePassword(user: string, pass: string) {
  const PC = (globalThis as unknown as { PasswordCredential?: PasswordCredentialCtor }).PasswordCredential;
  if (!PC || !navigator.credentials) return;
  try {
    await navigator.credentials.store(new PC({ id: user, password: pass, name: user }));
  } catch {
    /* браузер відмовився — нічого страшного */
  }
}

export function LoginScreen({ site, remember: rememberInitial, message = '', onLoggedIn }: Props) {
  const [error, setError] = useState(message);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
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
      // Пароль не лишається у формі після спроби входу.
      const pw = form.elements.namedItem('password');
      if (pw instanceof HTMLInputElement) pw.value = '';
    }
  }

  return (
    <main className="login">
      <h1 className="brand">Дедлайни</h1>
      <p className="lead">Усі завдання з вашого Moodle на одній сторінці, від найтерміновішого до найдальшого.</p>
      <form className="panel" method="post" action="#" autoComplete="on" noValidate onSubmit={onSubmit}>
        <label>
          Адреса вашого Moodle
          <input
            name="site"
            defaultValue={site}
            placeholder="moodle.university.edu.ua"
            inputMode="url"
            autoComplete="url"
            autoCapitalize="off"
            spellCheck={false}
          />
        </label>
        <p className="hint">
          Скопіюйте з адресного рядка, коли відкриваєте Moodle свого навчального закладу. Можна вставити посилання на
          будь-яку його сторінку.
        </p>
        <p className="warn-note">
          Логін і пароль підуть саме на цю адресу, тож вводьте лише Moodle, де справді навчаєтесь.
        </p>
        <label>
          Логін Moodle
          <input name="username" id="username" autoComplete="username" autoCapitalize="off" spellCheck={false} />
        </label>
        <label>
          Пароль
          <input name="password" id="password" type="password" autoComplete="current-password" />
        </label>
        <label className="remember">
          <input type="checkbox" name="remember" defaultChecked={rememberInitial} />
          Запам’ятати на цьому пристрої
        </label>
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? 'Входжу…' : 'Увійти й завантажити завдання'}
        </button>
        <p className="hint">
          Пароль іде напряму в Moodle і ніде не зберігається. На пристрої лишається тільки токен доступу, як у
          мобільного застосунку Moodle. На чужому комп’ютері зніміть «Запам’ятати»: тоді токен зникне, щойно ви
          закриєте вкладку.
        </p>
        <details>
          <summary>Інші налаштування</summary>
          <label>
            Токен (якщо входите через Google чи інший зовнішній сервіс)
            <input name="token" autoComplete="off" spellCheck={false} />
          </label>
        </details>
        <div className="error" role="alert">
          {error}
        </div>
      </form>
      {site && (
        <p className="hint" style={{ marginTop: 16 }}>
          <a href={`${site}/my/courses.php`} target="_blank" rel="noopener noreferrer">
            Відкрити {hostOf(site)}
          </a>
        </p>
      )}
    </main>
  );
}
