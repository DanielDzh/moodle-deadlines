import { describe, expect, it } from 'vitest';
import { parseIcal } from './ical';

/** A calendar text with CRLF line ends, like the files Moodle exports. */
const ics = (...lines: string[]) => ['BEGIN:VCALENDAR', 'VERSION:2.0', ...lines, 'END:VCALENDAR', ''].join('\r\n');
const utc = (y: number, mo: number, d: number, h: number, mi: number) => Date.UTC(y, mo - 1, d, h, mi) / 1000;

const event = (...lines: string[]) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT'];

describe('parseIcal: basics', () => {
  it('reads uid, summary, start, categories and description', () => {
    const [e] = parseIcal(
      ics(
        ...event(
          'UID:101@moodle.example.edu',
          'SUMMARY:Строк Есе спливає',
          'DESCRIPTION:Подайте файл до п’ятниці.',
          'DTSTART:20261105T215900Z',
          'DTEND:20261105T215900Z',
          'CATEGORIES:Історія',
        ),
      ),
    );
    expect(e).toEqual({
      uid: '101@moodle.example.edu',
      summary: 'Строк Есе спливає',
      description: 'Подайте файл до п’ятниці.',
      start: utc(2026, 11, 5, 21, 59),
      categories: ['Історія'],
      url: '',
    });
  });

  it('reads several events in order', () => {
    const events = parseIcal(
      ics(...event('UID:1', 'SUMMARY:A', 'DTSTART:20261105T100000Z'), ...event('UID:2', 'SUMMARY:B', 'DTSTART:20261106T100000Z')),
    );
    expect(events.map((e) => e.uid)).toEqual(['1', '2']);
  });

  it('understands LF-only line ends', () => {
    const text = 'BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:1\nSUMMARY:A\nDTSTART:20261105T100000Z\nEND:VEVENT\nEND:VCALENDAR\n';
    expect(parseIcal(text)).toHaveLength(1);
  });

  it('gives a null start when the date cannot be read, and keeps the event', () => {
    const [e] = parseIcal(ics(...event('UID:1', 'SUMMARY:A', 'DTSTART:not-a-date')));
    expect(e.start).toBeNull();
    expect(e.summary).toBe('A');
  });

  it('reads the URL property', () => {
    const [e] = parseIcal(ics(...event('UID:1', 'SUMMARY:A', 'URL:https://moodle.example.edu/mod/assign/view.php?id=7')));
    expect(e.url).toBe('https://moodle.example.edu/mod/assign/view.php?id=7');
  });
});

describe('parseIcal: folded lines and escapes', () => {
  it('joins lines folded with a tab, including a tab-only line', () => {
    const [e] = parseIcal(
      ics(
        'BEGIN:VEVENT',
        'UID:1',
        'SUMMARY:Строк СЕМІНАР Аналіз текстів через призму вимог до логічної аргумен',
        '\tтації спливає',
        '\t',
        'DTSTART:20261105T215900Z',
        'END:VEVENT',
      ),
    );
    expect(e.summary).toBe('Строк СЕМІНАР Аналіз текстів через призму вимог до логічної аргументації спливає');
    expect(e.start).toBe(utc(2026, 11, 5, 21, 59));
  });

  it('joins lines folded with a space', () => {
    const [e] = parseIcal(ics('BEGIN:VEVENT', 'UID:1', 'SUMMARY:Hello', ' World', 'END:VEVENT'));
    expect(e.summary).toBe('HelloWorld');
  });

  it('undoes the text escapes', () => {
    const [e] = parseIcal(ics(...event('UID:1', 'SUMMARY:A\\, B\\; C', 'DESCRIPTION:line one\\nline two\\n\\nback\\\\slash')));
    expect(e.summary).toBe('A, B; C');
    expect(e.description).toBe('line one\nline two\n\nback\\slash');
  });

  it('keeps a literal tab inside a line', () => {
    const [e] = parseIcal(ics(...event('UID:1', 'SUMMARY:A', 'DESCRIPTION:one\\n\\n\t* two')));
    expect(e.description).toBe('one\n\n\t* two');
  });
});

describe('parseIcal: categories', () => {
  it('treats an escaped comma as part of one category', () => {
    const [e] = parseIcal(ics(...event('UID:1', 'SUMMARY:A', 'CATEGORIES:Логіка БМЛ-26\\, ПХК-26')));
    expect(e.categories).toEqual(['Логіка БМЛ-26, ПХК-26']);
  });

  it('splits on a plain comma', () => {
    const [e] = parseIcal(ics(...event('UID:1', 'SUMMARY:A', 'CATEGORIES:Math,Physics')));
    expect(e.categories).toEqual(['Math', 'Physics']);
  });

  it('collects several CATEGORIES lines', () => {
    const [e] = parseIcal(ics(...event('UID:1', 'SUMMARY:A', 'CATEGORIES:Math', 'CATEGORIES:Physics')));
    expect(e.categories).toEqual(['Math', 'Physics']);
  });
});

describe('parseIcal: dates', () => {
  it('converts a named zone, winter and summer', () => {
    const [winter, summer] = parseIcal(
      ics(
        ...event('UID:1', 'SUMMARY:A', 'DTSTART;TZID=Europe/Kyiv:20261105T235900'),
        ...event('UID:2', 'SUMMARY:B', 'DTSTART;TZID=Europe/Kyiv:20270517T235900'),
      ),
    );
    expect(winter.start).toBe(utc(2026, 11, 5, 21, 59)); // UTC+2
    expect(summer.start).toBe(utc(2027, 5, 17, 20, 59)); // UTC+3
  });

  it('reads a floating time in the browser zone', () => {
    const [e] = parseIcal(ics(...event('UID:1', 'SUMMARY:A', 'DTSTART:20261105T120000')));
    expect(e.start).toBe(Math.floor(new Date(2026, 10, 5, 12, 0, 0).getTime() / 1000));
  });

  it('reads a date without time as the end of that day', () => {
    const [e] = parseIcal(ics(...event('UID:1', 'SUMMARY:A', 'DTSTART;VALUE=DATE:20261105')));
    expect(e.start).toBe(Math.floor(new Date(2026, 10, 5, 23, 59, 0).getTime() / 1000));
  });

  it('falls back to local time for an unknown zone instead of failing', () => {
    const [e] = parseIcal(ics(...event('UID:1', 'SUMMARY:A', 'DTSTART;TZID=Nowhere/Land:20261105T120000')));
    expect(e.start).toBe(Math.floor(new Date(2026, 10, 5, 12, 0, 0).getTime() / 1000));
  });
});

describe('parseIcal: robustness', () => {
  it('ignores properties inside a VALARM', () => {
    const [e] = parseIcal(
      ics(
        'BEGIN:VEVENT',
        'UID:1',
        'SUMMARY:Real',
        'DESCRIPTION:real description',
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        'DESCRIPTION:alarm text',
        'END:VALARM',
        'DTSTART:20261105T100000Z',
        'END:VEVENT',
      ),
    );
    expect(e.description).toBe('real description');
    expect(e.start).toBe(utc(2026, 11, 5, 10, 0));
  });

  it('returns nothing for an empty text', () => {
    expect(parseIcal('')).toEqual([]);
  });

  it('returns nothing for text that is not a calendar', () => {
    expect(parseIcal('<html><body>Invalid authentication</body></html>')).toEqual([]);
  });

  it('survives a truncated file (no END:VEVENT)', () => {
    expect(parseIcal('BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:1\r\nSUMMARY:A\r\n')).toEqual([]);
  });

  it('skips an event that has neither uid nor summary', () => {
    expect(parseIcal(ics(...event('DTSTART:20261105T100000Z')))).toEqual([]);
  });
});

describe('parseIcal: values that must not be mis-dated', () => {
  it.each([
    ['a day that does not exist', '20250230T100000Z'],
    ['a month 13', '20261301T100000Z'],
    ['hour 24', '20261105T240000Z'],
    ['minute 60', '20261105T106000Z'],
    ['a year before 1970', '00500105T100000Z'],
  ])('refuses %s instead of rolling it over', (_, value) => {
    const [e] = parseIcal(ics(...event('UID:1', 'SUMMARY:A', `DTSTART:${value}`)));
    expect(e.start).toBeNull();
  });

  it('accepts a leap day and a lowercase t and z', () => {
    const [leap, lower] = parseIcal(
      ics(...event('UID:1', 'SUMMARY:A', 'DTSTART:20280229T100000Z'), ...event('UID:2', 'SUMMARY:B', 'DTSTART:20261105t215900z')),
    );
    expect(leap.start).toBe(utc(2028, 2, 29, 10, 0));
    expect(lower.start).toBe(utc(2026, 11, 5, 21, 59));
  });
});
