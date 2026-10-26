const MOODLE_SECTIONS = /\/(my|login|course|mod|user|admin|calendar|grade|message|webservice|lib)(\/.*)?$/i;

/**
 * Адреса Moodle з того, що ввела людина: додає https://, прибирає шлях до сторінки
 * (…/my/courses.php, …/login/index.php), але зберігає підпапку (uni.edu/moodle).
 */
export function normSite(input: unknown): string {
  let s = String(input ?? '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try {
    const u = new URL(s);
    const path = u.pathname
      .replace(MOODLE_SECTIONS, '')
      .replace(/\/[^/]*\.php$/i, '')
      .replace(/\/+$/, '');
    return u.origin + path;
  } catch {
    return s.replace(/\/+$/, '');
  }
}

/** Посилання лише http(s). Будь-що інше (javascript:, data:…) замінюємо на адресу Moodle. */
export function safeUrl(u: unknown, base: string): string {
  try {
    const x = new URL(String(u), base || undefined);
    if (x.protocol === 'https:' || x.protocol === 'http:') return x.href;
  } catch {
    /* некоректна адреса */
  }
  return base || '#';
}

export const isLocalHost = (h: string) => h === 'localhost' || h === '127.0.0.1';

/** Пароль не можна слати відкритим текстом: дозволяємо лише https (і http для локального проксі). */
export function checkSite(site: string): string | null {
  if (!site) return 'Вкажіть адресу свого Moodle, наприклад moodle.university.edu.ua.';
  try {
    const u = new URL(site);
    if (u.protocol !== 'https:' && !isLocalHost(u.hostname)) {
      return 'Адреса має починатися з https://, інакше пароль піде мережею відкритим текстом.';
    }
    return null;
  } catch {
    return 'Перевірте адресу Moodle.';
  }
}

export function hostOf(site: string): string {
  try {
    return new URL(site).hostname;
  } catch {
    return site;
  }
}
