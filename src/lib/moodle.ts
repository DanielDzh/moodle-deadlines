import { COURSE_COLORS, DATA_VERSION } from '../config';
import type { Course, Snapshot, Task } from '../types';
import { toText } from './text';
import { normSite, safeUrl } from './url';

/**
 * Клієнт Moodle Web Services — того самого API, яким користується мобільний застосунок Moodle.
 * Сайт викликає лише функції читання: у Moodle нічого не змінюється.
 */

export class MoodleError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
    this.name = 'MoodleError';
  }
}

/** Токен застарів або відкликаний: треба увійти ще раз. */
export const isAuthError = (e: unknown) =>
  e instanceof MoodleError && (e.code === 'invalidtoken' || e.code === 'accessexception');

const netError = () =>
  new MoodleError(
    'Браузер не отримав відповіді від Moodle. Перевірте інтернет і адресу сайту. Якщо все правильно, відкрийте консоль (F12): помилка CORS означає, що цей Moodle не дозволяє запити з інших сайтів.',
  );

/** { courseids: [1, 2] } → courseids[0]=1&courseids[1]=2 — так Moodle чекає масиви й об'єкти. */
export function flatten(obj: Record<string, unknown>, prefix = '', out = new URLSearchParams()): URLSearchParams {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v !== null && typeof v === 'object') flatten(v as Record<string, unknown>, key, out);
    else if (v !== undefined) out.append(key, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
  }
  return out;
}

/** Обмін логіна й пароля на токен мобільного застосунку. Пароль ніде не зберігається. */
export async function getToken(site: string, username: string, password: string): Promise<string> {
  const body = new URLSearchParams({ username, password, service: 'moodle_mobile_app' });
  let r: Response;
  try {
    r = await fetch(`${site}/login/token.php`, { method: 'POST', body });
  } catch {
    throw netError();
  }
  let j: { token?: string; errorcode?: string; error?: string };
  try {
    j = await r.json();
  } catch {
    throw new MoodleError(`Moodle відповів не так, як очікувалося (HTTP ${r.status}). Перевірте адресу сайту.`);
  }
  if (j.token) return j.token;
  const code = j.errorcode || '';
  if (code === 'invalidlogin') throw new MoodleError('Неправильний логін або пароль.', code);
  if (/enablews|servicenotavailable|servicerequireslogin/.test(code)) {
    throw new MoodleError(
      'На цьому Moodle вимкнено доступ для мобільного застосунку, тож увійти так не вийде. Спробуйте токен з профілю Moodle (Налаштування → Ключі безпеки).',
      code,
    );
  }
  throw new MoodleError(j.error || 'Не вдалося увійти.', code);
}

export function createClient(site: string, token: string) {
  return async function call<T = any>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
    const body = flatten(args);
    body.append('wstoken', token);
    body.append('wsfunction', fn);
    body.append('moodlewsrestformat', 'json');
    let r: Response;
    try {
      r = await fetch(`${site}/webservice/rest/server.php`, { method: 'POST', body });
    } catch {
      throw netError();
    }
    let j: any;
    try {
      j = await r.json();
    } catch {
      throw new MoodleError(`Moodle повернув незрозумілу відповідь на ${fn} (HTTP ${r.status}).`);
    }
    if (j && j.exception) throw new MoodleError(j.message || j.errorcode || 'Помилка Moodle', j.errorcode);
    return j as T;
  };
}

/** Виконує fn для кожного елемента, не більше n одночасно. */
async function pool<T>(list: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, list.length) }, async () => {
      while (i < list.length) await fn(list[i++]);
    }),
  );
}

const nowSec = () => Math.floor(Date.now() / 1000);

/** Збирає курси, завдання, форуми, події календаря й статуси подань в один зліпок. */
export async function collectSnapshot(
  site: string,
  token: string,
  onProgress: (text: string) => void = () => {},
): Promise<Snapshot> {
  const ws = createClient(site, token);

  onProgress('Перевіряю вхід…');
  const info = await ws<{ siteurl?: string; userid: number; fullname: string }>('core_webservice_get_site_info');
  const base = safeUrl(normSite(info.siteurl || site), site).replace(/\/+$/, '');

  onProgress('Завантажую поточні курси…');
  const now = nowSec();
  const isCurrent = (c: any) =>
    (!c.startdate || c.startdate <= now) && (!c.enddate || c.enddate > now) && !c.completed && !c.hidden;
  let rawCourses: any[];
  try {
    // Та сама вибірка, що й вкладка «Поточні» на сторінці «Мої курси».
    const res = await ws<{ courses?: any[] }>('core_course_get_enrolled_courses_by_timeline_classification', {
      classification: 'inprogress',
      limit: 0,
      offset: 0,
      sort: 'fullname',
    });
    rawCourses = res.courses || [];
  } catch {
    rawCourses = (await ws<any[]>('core_enrol_get_users_courses', { userid: info.userid })).filter(isCurrent);
  }

  const courses: Course[] = rawCourses.map((c, i) => ({
    id: Number(c.id),
    name: toText(c.fullname),
    short: toText(c.shortname),
    start: c.startdate || 0,
    end: c.enddate || 0,
    color: COURSE_COLORS[i % COURSE_COLORS.length],
  }));
  const ids = courses.map((c) => c.id);
  const snapshot = (items: Task[]): Snapshot => ({
    v: DATA_VERSION,
    collectedAt: nowSec(),
    base,
    user: info.fullname,
    courses,
    items,
  });
  if (!ids.length) return snapshot([]);

  onProgress('Завантажую завдання, форуми й події календаря…');
  const [asg, forums, evs] = await Promise.all([
    ws<{ courses?: any[] }>('mod_assign_get_assignments', { courseids: ids }).catch(() => ({ courses: [] as any[] })),
    ws<any[]>('mod_forum_get_forums_by_courses', { courseids: ids }).catch(() => [] as any[]),
    ws<{ groupedbycourse?: any[] }>('core_calendar_get_action_events_by_courses', {
      courseids: ids,
      timesortfrom: 0,
      limitnum: 50,
    }).catch(() => ({ groupedbycourse: [] as any[] })),
  ]);

  const items: Task[] = [];
  const seen = new Set<number>();

  for (const c of asg.courses || []) {
    for (const a of c.assignments || []) {
      const cmid = Number(a.cmid);
      seen.add(cmid);
      items.push({
        key: `assign-${cmid}`,
        kind: 'assign',
        courseid: Number(c.id),
        cmid,
        assignid: Number(a.id),
        name: toText(a.name),
        due: a.duedate || 0,
        open: a.allowsubmissionsfromdate || 0,
        cutoff: a.cutoffdate || 0,
        intro: toText(a.intro),
        url: `${base}/mod/assign/view.php?id=${cmid}`,
        status: '',
      });
    }
  }

  for (const f of Array.isArray(forums) ? forums : []) {
    const cmid = Number(f.cmid);
    if (f.type === 'news' || seen.has(cmid)) continue; // «Новини» — це оголошення, не завдання
    seen.add(cmid);
    items.push({
      key: `forum-${cmid}`,
      kind: 'forum',
      courseid: Number(f.course),
      cmid,
      name: toText(f.name),
      due: f.duedate || 0,
      open: 0,
      cutoff: f.cutoffdate || 0,
      intro: toText(f.intro),
      url: `${base}/mod/forum/view.php?id=${cmid}`,
      status: '',
    });
  }

  // Тести, семінари та інше, що має подію в календарі.
  for (const g of evs.groupedbycourse || []) {
    for (const e of g.events || []) {
      let cmid: number | null = null;
      try {
        cmid = Number(new URL(e.url).searchParams.get('id')) || null;
      } catch {
        /* подія без посилання */
      }
      if (cmid && seen.has(cmid)) continue;
      const key = `${String(e.modulename || 'event').replace(/[^a-z0-9_]/gi, '')}-${cmid || Number(e.id)}`;
      if (items.some((i) => i.key === key)) continue;
      if (cmid) seen.add(cmid);
      items.push({
        key,
        kind: e.modulename || 'event',
        courseid: Number(g.courseid || e.course?.id),
        cmid,
        name: toText(e.activityname || e.name),
        due: e.timesort || e.timestart || 0,
        open: 0,
        cutoff: 0,
        intro: toText(e.description),
        url: safeUrl(e.url, base),
        status: '',
      });
    }
  }

  const assigns = items.filter((i) => i.kind === 'assign');
  let n = 0;
  onProgress(`Статуси подань: 0 з ${assigns.length}`);
  await pool(assigns, 4, async (it) => {
    try {
      const s = await ws<any>('mod_assign_get_submission_status', { assignid: it.assignid });
      const la = s.lastattempt || {};
      const sub = la.submission || la.teamsubmission;
      it.status = la.gradingstatus === 'graded' ? 'graded' : sub ? sub.status : 'new';
      const grade = s.feedback?.gradefordisplay;
      if (grade) it.grade = toText(grade).slice(0, 40);
    } catch {
      it.status = 'unknown';
    }
    onProgress(`Статуси подань: ${++n} з ${assigns.length}`);
  });

  return snapshot(items);
}

/**
 * Дані з кешу браузера могли бути змінені вручну: приводимо типи, кольори беремо з власної палітри,
 * посилання пропускаємо лише http(s).
 */
export function sanitizeSnapshot(d: Snapshot): Snapshot {
  return {
    ...d,
    courses: d.courses.map((c, i) => ({ ...c, id: Number(c.id), color: COURSE_COLORS[i % COURSE_COLORS.length] })),
    items: d.items.map((it) => ({ ...it, courseid: Number(it.courseid), url: safeUrl(it.url, d.base) })),
  };
}
