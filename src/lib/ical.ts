import type { IcalEvent } from '../types';

/**
 * A small reader of iCalendar files (RFC 5545), enough for the events Moodle exports.
 * It never throws: an event it cannot understand is skipped.
 */

interface Property {
  name: string;
  params: Record<string, string>;
  value: string;
}

/** Joins folded lines: a physical line that starts with a space or a tab continues the previous one. */
const unfold = (text: string): string[] => {
  const out: string[] = [];
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length) out[out.length - 1] += line.slice(1);
    else if (line) out.push(line);
  }
  return out;
};

/** Splits "NAME;PARAM=x:value" at the first colon that is not inside quotes. */
const parseProperty = (line: string): Property | null => {
  let quoted = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') quoted = !quoted;
    else if (ch === ':' && !quoted) {
      colon = i;
      break;
    }
  }
  if (colon < 1) return null;
  const [name, ...rawParams] = splitOutsideQuotes(line.slice(0, colon), ';');
  const params: Record<string, string> = {};
  for (const raw of rawParams) {
    const eq = raw.indexOf('=');
    if (eq > 0) params[raw.slice(0, eq).toUpperCase()] = raw.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
};

const splitOutsideQuotes = (text: string, separator: string): string[] => {
  const parts: string[] = [];
  let quoted = false;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '"') quoted = !quoted;
    else if (text[i] === separator && !quoted) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
};

/** Undoes the TEXT escapes: \n, \N, \, \; and \\. */
const unescapeText = (value: string): string =>
  value.replace(/\\([\\nN,;])/g, (_, ch: string) => (ch === 'n' || ch === 'N' ? '\n' : ch));

/** Splits a list at commas that are not escaped, then unescapes every part. */
const splitList = (value: string): string[] => {
  const parts: string[] = [];
  let current = '';
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === '\\' && i + 1 < value.length) {
      current += ch + value[++i];
    } else if (ch === ',') {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.map((p) => unescapeText(p).trim()).filter(Boolean);
};

/** Offset of a time zone from UTC at the given instant, ms. */
const zoneOffsetMs = (instantMs: number, timeZone: string): number => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(new Date(instantMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(instantMs / 1000) * 1000;
};

/** A wall-clock time in a named zone → Unix seconds. Null when the zone is unknown. */
const zonedToUnix = (y: number, mo: number, d: number, h: number, mi: number, s: number, timeZone: string): number | null => {
  try {
    const guess = Date.UTC(y, mo - 1, d, h, mi, s);
    // Twice, because the offset at the guessed instant can differ from the offset at the real one (daylight saving).
    const first = guess - zoneOffsetMs(guess, timeZone);
    return Math.floor((guess - zoneOffsetMs(first, timeZone)) / 1000);
  } catch {
    return null;
  }
};

/**
 * DTSTART → Unix seconds.
 * UTC ("…Z"), a named zone (TZID), a floating time (the browser's zone) and a date without time (end of that day) are understood.
 */
const parseDateTime = (value: string, params: Record<string, string>): number | null => {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/i.exec(value.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const hasTime = m[4] !== undefined;
  const [h, mi, s] = hasTime ? [Number(m[4]), Number(m[5]), Number(m[6] ?? 0)] : [23, 59, 0];
  // 20250230 would silently become 2 March: refuse parts that are out of range.
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  if (y < 1970 || mo < 1 || mo > 12 || d < 1 || d > daysInMonth || h > 23 || mi > 59 || s > 60) return null;
  let unix: number | null;
  if (hasTime && m[7]) unix = Math.floor(Date.UTC(y, mo - 1, d, h, mi, s) / 1000);
  else if (hasTime && params.TZID) unix = zonedToUnix(y, mo, d, h, mi, s, params.TZID) ?? Math.floor(new Date(y, mo - 1, d, h, mi, s).getTime() / 1000);
  else unix = Math.floor(new Date(y, mo - 1, d, h, mi, s).getTime() / 1000);
  return Number.isFinite(unix) ? unix : null;
};

/** Reads all events of an iCalendar text. A text that is not a calendar gives an empty list. */
export const parseIcal = (text: string): IcalEvent[] => {
  const events: IcalEvent[] = [];
  let current: IcalEvent | null = null;
  let nested = 0;
  for (const line of unfold(text)) {
    const upper = line.toUpperCase();
    if (upper === 'BEGIN:VEVENT') {
      current = { uid: '', summary: '', description: '', start: null, categories: [], url: '' };
      nested = 0;
    } else if (upper === 'END:VEVENT') {
      if (current && (current.uid || current.summary)) events.push(current);
      current = null;
    } else if (current && upper.startsWith('BEGIN:')) {
      nested++;
    } else if (current && upper.startsWith('END:')) {
      nested = Math.max(0, nested - 1);
    } else if (current && nested === 0) {
      const prop = parseProperty(line);
      if (!prop) continue;
      if (prop.name === 'UID') current.uid = prop.value.trim();
      else if (prop.name === 'SUMMARY') current.summary = unescapeText(prop.value).trim();
      else if (prop.name === 'DESCRIPTION') current.description = unescapeText(prop.value);
      else if (prop.name === 'DTSTART') current.start = parseDateTime(prop.value, prop.params);
      else if (prop.name === 'CATEGORIES') current.categories.push(...splitList(prop.value));
      else if (prop.name === 'URL') current.url = prop.value.trim();
    }
  }
  return events;
};
