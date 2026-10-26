const MOODLE_SECTIONS = /\/(my|login|course|mod|user|admin|calendar|grade|message|webservice|lib)(\/.*)?$/i;

/**
 * Moodle address from what a person typed: adds https://, strips the page path
 * (…/my/courses.php, …/login/index.php) but keeps a subfolder (uni.edu/moodle).
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

/** Only http(s) links. Anything else (javascript:, data:…) is replaced with the Moodle address. */
export function safeUrl(u: unknown, base: string): string {
  try {
    const x = new URL(String(u), base || undefined);
    if (x.protocol === 'https:' || x.protocol === 'http:') return x.href;
  } catch {
    /* malformed address */
  }
  return base || '#';
}

export const isLocalHost = (h: string) => h === 'localhost' || h === '127.0.0.1';

/** The password must not travel in plain text: only https is allowed (and http for a local proxy). */
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
