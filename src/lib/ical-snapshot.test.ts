import { describe, expect, it } from 'vitest';
import { COURSE_COLORS, DATA_VERSION } from '../config';
import { cleanIntro, cleanName, snapshotFromIcal } from './ical-snapshot';

const ics = (...events: string[][]) =>
  ['BEGIN:VCALENDAR', 'VERSION:2.0', ...events.flatMap((e) => ['BEGIN:VEVENT', ...e, 'END:VEVENT']), 'END:VCALENDAR', ''].join('\r\n');
const utc = (y: number, mo: number, d: number, h: number, mi: number) => Date.UTC(y, mo - 1, d, h, mi) / 1000;
const NOW = utc(2026, 11, 9, 12, 0);

/** The structure of a real UBTS export, with invented content. */
const essay = [
  'UID:101@moodle.example.edu',
  'SUMMARY:Строк Есе про етику спливає',
  'DESCRIPTION:Подайте на Moodle файл ДО 23:59\\, 2 ГРУДНЯ.\\n\\n_ТЕМИ_\\n\\n\t*\\nПерша те',
  '\tма\\n\\n\t* Друга тема\\n\\nLinks:\\n------\\n[1] https://moodle.example.edu/mod/assign/view.php?id=24512\\n',
  'DTSTART:20261202T215900Z',
  'DTEND:20261202T215900Z',
  'CATEGORIES:Етика БМЛ-26\\, ПХК-26',
];
const reading = [
  'UID:102@moodle.example.edu',
  'SUMMARY:Строк Читання спливає',
  'DESCRIPTION:Прочитати розділ.\\n',
  'DTSTART:20261204T215900Z',
  'CATEGORIES:Етика БМЛ-26\\, ПХК-26',
];
const logic = [
  'UID:103@moodle.example.edu',
  'SUMMARY:Строк Звіт спливає',
  'DTSTART:20261110T215900Z',
  'CATEGORIES:Логіка',
];

describe('cleanName', () => {
  it('removes the Moodle prefix and suffix', () => {
    expect(cleanName('Строк Есе про етику спливає')).toBe('Есе про етику');
  });

  it('keeps a name that does not match', () => {
    expect(cleanName('Assignment 1 is due')).toBe('Assignment 1 is due');
  });

  it('keeps the original when stripping would leave nothing', () => {
    expect(cleanName('Строк  спливає')).toBe('Строк  спливає');
  });
});

describe('cleanIntro', () => {
  it('drops the links footer and the footnote marks', () => {
    expect(cleanIntro('Читайте [1] та [2].\n\nLinks:\n------\n[1] http://a.example/x\n[2] http://b.example/y\n')).toBe('Читайте та.');
  });

  it('removes _emphasis_ marks around phrases and at line edges', () => {
    expect(cleanIntro('_Теми_\nПерше _друге_ третє\n_ Питання:\n_(1) Так')).toBe('Теми\nПерше друге третє\nПитання:\n(1) Так');
  });

  it('keeps underscores inside words and links', () => {
    expect(cleanIntro('Дивіться snake_case_name і http://a.example/x_y_z')).toBe('Дивіться snake_case_name і http://a.example/x_y_z');
  });

  it('turns a lone star on its own line and "* " into bullets', () => {
    expect(cleanIntro('Список:\n\n\t*\nПерший\n\n\t* Другий')).toBe('Список:\n\n• Перший\n\n• Другий');
  });

  it('collapses blank lines and trims', () => {
    expect(cleanIntro('\n\nA\n\n\n\n\nB   \n\n')).toBe('A\n\nB');
  });

  it('cuts a very long description', () => {
    const out = cleanIntro('слово '.repeat(1000));
    expect(out.length).toBeLessThanOrEqual(2001);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('snapshotFromIcal', () => {
  it('builds a snapshot marked as coming from a calendar', () => {
    const s = snapshotFromIcal(ics(essay, reading, logic), NOW);
    expect(s).toMatchObject({ v: DATA_VERSION, collectedAt: NOW, source: 'ical', base: 'https://moodle.example.edu' });
    expect(s?.user).toBe('Календар · moodle.example.edu');
    expect(s?.items).toHaveLength(3);
  });

  it('maps an event to a task', () => {
    const s = snapshotFromIcal(ics(essay), NOW);
    const t = s?.items[0];
    expect(t).toMatchObject({
      key: 'ical:101@moodle.example.edu',
      kind: 'ical',
      name: 'Есе про етику',
      due: utc(2026, 12, 2, 21, 59),
      open: 0,
      cutoff: 0,
      cmid: null,
      status: 'unknown',
      url: 'https://moodle.example.edu/mod/assign/view.php?id=24512',
    });
    expect(t?.intro).toBe('Подайте на Moodle файл ДО 23:59, 2 ГРУДНЯ.\n\nТЕМИ\n\n• Перша тема\n\n• Друга тема');
  });

  it('makes one course per category text and keeps an escaped comma inside it', () => {
    const s = snapshotFromIcal(ics(essay, reading, logic), NOW);
    expect(s?.courses.map((c) => c.name)).toEqual(['Етика БМЛ-26, ПХК-26', 'Логіка']);
    const [ethics, logicCourse] = s!.courses;
    expect(s!.items.filter((i) => i.courseid === ethics.id)).toHaveLength(2);
    expect(s!.items.filter((i) => i.courseid === logicCourse.id)).toHaveLength(1);
  });

  it('gives courses distinct ids, palette colours and no dates', () => {
    const s = snapshotFromIcal(ics(essay, logic), NOW)!;
    expect(new Set(s.courses.map((c) => c.id)).size).toBe(2);
    expect(s.courses.map((c) => c.color)).toEqual([COURSE_COLORS[0], COURSE_COLORS[1]]);
    expect(s.courses.every((c) => c.start === 0 && c.end === 0)).toBe(true);
  });

  it('keeps the same course id for the same name between exports', () => {
    const a = snapshotFromIcal(ics(essay), NOW)!;
    const b = snapshotFromIcal(ics(logic, essay, reading), NOW)!;
    const idIn = (s: typeof a) => s.courses.find((c) => c.name.startsWith('Етика'))!.id;
    expect(idIn(a)).toBe(idIn(b));
  });

  it('puts an event without a category into a catch-all course', () => {
    const s = snapshotFromIcal(ics(['UID:1@x.example', 'SUMMARY:A', 'DTSTART:20261110T100000Z']), NOW)!;
    expect(s.courses.map((c) => c.name)).toEqual(['Без курсу']);
  });

  it('links to the activity when the description has a link, inline or in the footer', () => {
    const inline = ['UID:1@x.example', 'SUMMARY:A', 'DTSTART:20261110T100000Z', 'DESCRIPTION:Див. https://x.example/mod/quiz/view.php?id=5 тут'];
    expect(snapshotFromIcal(ics(inline), NOW)!.items[0].url).toBe('https://x.example/mod/quiz/view.php?id=5');
  });

  it('does not take a link to study material for the task page', () => {
    const e = ['UID:1@x.example', 'SUMMARY:A', 'DTSTART:20261110T100000Z', 'DESCRIPTION:Книга https://x.example/mod/resource/view.php?id=9 і завдання https://x.example/mod/assign/view.php?id=4'];
    expect(snapshotFromIcal(ics(e), NOW)!.items[0].url).toBe('https://x.example/mod/assign/view.php?id=4');
    const onlyBook = ['UID:2@x.example', 'SUMMARY:B', 'DTSTART:20261110T100000Z', 'DESCRIPTION:Книга https://x.example/mod/resource/view.php?id=9'];
    expect(snapshotFromIcal(ics(onlyBook), NOW)!.items[0].url).toContain('/calendar/view.php?view=day');
  });

  it('falls back to the calendar day page when there is no link', () => {
    const s = snapshotFromIcal(ics(logic), NOW)!;
    expect(s.items[0].url).toBe(`https://moodle.example.edu/calendar/view.php?view=day&time=${utc(2026, 11, 10, 21, 59)}`);
  });

  it('has no link when neither a link nor the Moodle address is known', () => {
    const s = snapshotFromIcal(ics(['UID:abc', 'SUMMARY:A', 'DTSTART:20261110T100000Z']), NOW)!;
    expect(s.base).toBe('');
    expect(s.items[0].url).toBe('');
    expect(s.user).toBe('Календар');
  });

  it('takes the Moodle address from an activity link when the uid has no domain', () => {
    const e = ['UID:abc', 'SUMMARY:A', 'DTSTART:20261110T100000Z', 'DESCRIPTION:https://lms.example.org/mod/assign/view.php?id=3'];
    expect(snapshotFromIcal(ics(e), NOW)!.base).toBe('https://lms.example.org');
  });

  it('drops a repeated uid and an event without a date', () => {
    const s = snapshotFromIcal(ics(logic, logic, ['UID:9@x.example', 'SUMMARY:No date']), NOW)!;
    expect(s.items.map((i) => i.key)).toEqual(['ical:103@moodle.example.edu']);
  });

  it('builds a key for an event without a uid', () => {
    const s = snapshotFromIcal(ics(['SUMMARY:A', 'DTSTART:20261110T100000Z']), NOW)!;
    expect(s.items[0].key).toMatch(/^ical:[0-9a-z]+$/);
  });

  it.each([['an empty text', ''], ['text that is not a calendar', '<html>Invalid authentication</html>'], ['a calendar without events', ics()]])(
    'is null for %s',
    (_, text) => {
      expect(snapshotFromIcal(text, NOW)).toBeNull();
    },
  );

  it('is null when no event has a date', () => {
    expect(snapshotFromIcal(ics(['UID:1', 'SUMMARY:A', 'DTSTART:nope']), NOW)).toBeNull();
  });
});

describe('snapshotFromIcal: hostile input stays fast', () => {
  const one = (description: string) =>
    ics(['UID:1@x.example', 'SUMMARY:A', 'DTSTART:20261110T100000Z', `DESCRIPTION:${description}`]);
  const timed = (text: string) => {
    const started = performance.now();
    const snapshot = snapshotFromIcal(text, NOW);
    return { snapshot, ms: performance.now() - started };
  };

  it.each([
    ['a long run of spaces', ' '.repeat(1_500_000) + 'x'],
    ['a long run of tabs', '\t'.repeat(1_500_000) + 'x'],
    ['spaces and brackets', '[1]' + ' '.repeat(1_500_000) + 'x'],
    ['a run of spaces before an underscore', ' '.repeat(1_500_000) + '_'],
    ['"https://" repeated', 'https://'.repeat(200_000)],
    ['an open underscore and a long tail', ' _' + 'a'.repeat(1_500_000)],
  ])('%s', (_, description) => {
    const { snapshot, ms } = timed(one(description));
    expect(snapshot?.items).toHaveLength(1);
    expect(ms).toBeLessThan(1000);
  });

  it('cuts a huge description before it is cleaned', () => {
    const { snapshot } = timed(one('слово '.repeat(1_000_000)));
    expect(snapshot!.items[0].intro.length).toBeLessThanOrEqual(2001);
  });

  it('does not look for an activity link past the size limit', () => {
    const far = 'x '.repeat(15_000) + 'https://x.example/mod/assign/view.php?id=4';
    expect(timed(one(far)).snapshot!.items[0].url).toContain('/calendar/view.php?view=day');
  });
});
