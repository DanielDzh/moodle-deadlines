// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { collectSnapshot, flatten, getToken, isAuthError } from './moodle';
import { shortText, toText } from './text';

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('flatten', () => {
  it('expands arrays the way Moodle expects', () => {
    expect(flatten({ courseids: [3, 7], flag: true, skip: undefined }).toString()).toBe(
      'courseids%5B0%5D=3&courseids%5B1%5D=7&flag=1',
    );
  });
});

describe('toText / shortText', () => {
  it('strips tags and does not run scripts', () => {
    expect(toText('<p>Есе <b>на 2 сторінки</b></p><p>Здати у PDF</p><script>window.x=1</script>')).toBe(
      'Есе на 2 сторінки\nЗдати у PDF',
    );
    expect((window as unknown as { x?: number }).x).toBeUndefined();
  });

  it('cuts at a word boundary', () => {
    const s = shortText('слово '.repeat(60), 30);
    expect(s.endsWith('…')).toBe(true);
    expect(s.length).toBeLessThanOrEqual(31);
  });
});

describe('getToken', () => {
  it('returns a token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ token: 'abc' })));
    await expect(getToken('https://m.edu', 'u', 'p')).resolves.toBe('abc');
  });

  it('explains a wrong password and a disabled mobile service', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ errorcode: 'invalidlogin' })));
    await expect(getToken('https://m.edu', 'u', 'p')).rejects.toThrow('Неправильний логін або пароль.');
    vi.stubGlobal('fetch', vi.fn(async () => json({ errorcode: 'enablewsdescription' })));
    await expect(getToken('https://m.edu', 'u', 'p')).rejects.toThrow(/вимкнено доступ/);
  });
});

describe('collectSnapshot', () => {
  const responses: Record<string, unknown> = {
    core_webservice_get_site_info: { siteurl: 'https://m.edu', userid: 5, fullname: 'Олена Коваль' },
    core_course_get_enrolled_courses_by_timeline_classification: {
      courses: [{ id: 10, fullname: 'Історія <b>Церкви</b>', shortname: 'IC', startdate: 1, enddate: 0 }],
    },
    mod_assign_get_assignments: {
      courses: [
        { id: 10, assignments: [{ id: 100, cmid: 1000, name: 'Есе', duedate: 2000000000, intro: '<p>Текст</p>' }] },
      ],
    },
    mod_forum_get_forums_by_courses: [
      { id: 1, cmid: 2000, course: 10, name: 'Новини', type: 'news' },
      { id: 2, cmid: 2001, course: 10, name: 'Обговорення', type: 'general', duedate: 0 },
    ],
    core_calendar_get_action_events_by_courses: {
      groupedbycourse: [
        {
          courseid: 10,
          events: [
            { id: 1, name: 'Есе', modulename: 'assign', url: 'https://m.edu/mod/assign/view.php?id=1000', timesort: 2000000000 },
            { id: 2, name: 'Тест 1', modulename: 'quiz', url: 'https://m.edu/mod/quiz/view.php?id=3000', timesort: 2000100000 },
          ],
        },
      ],
    },
    mod_assign_get_submission_status: { lastattempt: { submission: { status: 'submitted' }, gradingstatus: 'notgraded' } },
  };

  it('collects courses, assignments, forums and quizzes without duplicates and without "News"', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        const fn = new URLSearchParams(String(init.body)).get('wsfunction')!;
        calls.push(fn);
        return json(responses[fn]);
      }),
    );
    const snap = await collectSnapshot('https://m.edu', 'tok');
    expect(snap.user).toBe('Олена Коваль');
    expect(snap.courses).toMatchObject([{ id: 10, name: 'Історія Церкви' }]);
    expect(snap.items.map((i) => i.key).sort()).toEqual(['assign-1000', 'forum-2001', 'quiz-3000']);
    expect(snap.items.find((i) => i.key === 'assign-1000')).toMatchObject({ status: 'submitted', intro: 'Текст' });
    // Read functions only.
    expect(calls.every((fn) => /_get_/.test(fn))).toBe(true);
  });

  it('reports loading stages in order, without repeats', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => json(responses[new URLSearchParams(String(init.body)).get('wsfunction')!])),
    );
    const stages: string[] = [];
    await collectSnapshot('https://m.edu', 'tok', (p) => {
      if (stages[stages.length - 1] !== p.stage) stages.push(p.stage);
    });
    expect(stages).toEqual(['courses', 'tasks', 'statuses']);
  });

  it('recognises a stale token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ exception: 'x', errorcode: 'invalidtoken', message: 'Invalid token' })));
    const err = await collectSnapshot('https://m.edu', 'old').catch((e) => e);
    expect(isAuthError(err)).toBe(true);
  });
});
