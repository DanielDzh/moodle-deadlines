import { CALENDAR, CALENDAR_KIND, CALENDAR_SOURCE, CALENDAR_TEXTS, COURSE_COLORS, DATA_VERSION } from '../config';
import type { Course, IcalEvent, Snapshot, Task } from '../types';
import { parseIcal } from './ical';

/**
 * Moodle's activity pages: /mod/assign/view.php?id=24512.
 * Pages of study material (a book, a file, a folder, an external link) are not the task itself and are skipped.
 */
const MODULE_LINK = new RegExp(
  `https?://[^\\s)\\]"'<>]{1,${CALENDAR.maxLinkChars}}/mod/(?!(?:resource|url|folder|page|book|imscp|label)/)[a-z0-9_]+/view\\.php\\?id=\\d+`,
  'i',
);
const UID_HOST = /@([a-z0-9-]+(?:\.[a-z0-9-]+)+)$/i;
/** The footer Moodle adds under a description: "Links:\n------\n[1] https://…" */
const LINKS_FOOTER = /\n?Links:\n-{3,}\n/;

/** FNV-1a: a small stable hash, used to give a course without an id a stable one. */
const hash32 = (text: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

/** "Строк Есе спливає" → "Есе". A name that does not match is kept as it is. */
export const cleanName = (summary: string): string => {
  const original = summary.trim();
  let name = original;
  const prefix = CALENDAR.namePrefixes.find((p) => name.startsWith(p));
  if (prefix) name = name.slice(prefix.length);
  const suffix = CALENDAR.nameSuffixes.find((s) => name.endsWith(s));
  if (suffix) name = name.slice(0, name.length - suffix.length);
  return name.trim() || original;
};

/** Moodle's plain-text description → readable text: no links footer, no footnote marks, no _emphasis_ marks, tidy bullets. */
export const cleanIntro = (description: string): string => {
  // Runs of spaces and tabs first: the patterns below are only linear when no long run is left.
  let text = description.replace(/\r/g, '').replace(/[ \t]{2,}/g, ' ');
  const footer = text.search(LINKS_FOOTER);
  if (footer >= 0) text = text.slice(0, footer);
  text = text
    .replace(/[ \t]*\[\d+\]/g, '')
    .replace(/(^|[\s(])_(?=\S)([^_\n]+?)(?<=\S)_(?=[\s.,;:!?)]|$)/gm, '$1$2')
    .replace(/^[ \t]*_+[ \t]*/gm, '')
    .replace(/[ \t]*_+$/gm, '')
    .replace(/^[ \t]*\*[ \t]*(?:\n+|$)/gm, '• ')
    .replace(/^[ \t]*\*[ \t]+/gm, '• ')
    .replace(/\t/g, ' ')
    .replace(/ +\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text.length > CALENDAR.introMaxChars ? `${text.slice(0, CALENDAR.introMaxChars).trimEnd()}…` : text;
};

/** Address of the Moodle the events come from: the domain in their UIDs, else the origin of an activity link. */
const findBase = (events: IcalEvent[]): string => {
  for (const e of events) {
    const host = UID_HOST.exec(e.uid)?.[1];
    if (host) return `https://${host.toLowerCase()}`;
  }
  for (const e of events) {
    const link = MODULE_LINK.exec(e.description)?.[0] ?? MODULE_LINK.exec(e.url)?.[0];
    if (link) {
      try {
        return new URL(link).origin;
      } catch {
        /* a broken link: look at the next event */
      }
    }
  }
  return '';
};

/** The task's own page when the description links to it; otherwise the calendar day of the deadline. */
const taskUrl = (event: IcalEvent, due: number, base: string): string => {
  const link = MODULE_LINK.exec(event.description)?.[0] ?? (MODULE_LINK.test(event.url) ? event.url : '');
  if (link) return link;
  if (event.url) return event.url;
  return base ? `${base}${CALENDAR.dayViewPath}${due}` : '';
};

/**
 * Builds the site's data from the text of a calendar export file.
 * Null when the text holds no event with a date (not a calendar, an empty export, or a wrong period).
 */
export const snapshotFromIcal = (text: string, nowSec = Math.floor(Date.now() / 1000)): Snapshot | null => {
  const seen = new Set<string>();
  const events = parseIcal(text)
    .map((e) => ({ ...e, description: e.description.slice(0, CALENDAR.maxDescriptionChars) }))
    .filter((e) => {
      if (e.start === null) return false;
      const id = e.uid || `${e.summary}|${e.start}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  if (!events.length) return null;

  const base = findBase(events);

  const names = [...new Set(events.map((e) => e.categories[0] || CALENDAR_TEXTS.noCourse))].sort((a, b) => a.localeCompare(b, 'uk'));
  const used = new Set<number>();
  const courses: Course[] = names.map((name, i) => {
    let id = (hash32(name) % 1_000_000_000) + 1;
    while (used.has(id)) id++;
    used.add(id);
    return { id, name, short: name, start: 0, end: 0, color: COURSE_COLORS[i % COURSE_COLORS.length] };
  });
  const courseId = new Map(courses.map((c) => [c.name, c.id]));

  const items: Task[] = events.map((e) => {
    const due = e.start as number;
    return {
      key: `ical:${e.uid || hash32(`${e.summary}|${due}`).toString(36)}`,
      kind: CALENDAR_KIND,
      courseid: courseId.get(e.categories[0] || CALENDAR_TEXTS.noCourse) as number,
      cmid: null,
      name: cleanName(e.summary),
      due,
      open: 0,
      cutoff: 0,
      intro: cleanIntro(e.description),
      url: taskUrl(e, due, base),
      status: 'unknown',
    };
  });

  const host = base ? new URL(base).host : '';
  return {
    v: DATA_VERSION,
    collectedAt: nowSec,
    base,
    user: host ? `${CALENDAR_TEXTS.userLabel} · ${host}` : CALENDAR_TEXTS.userLabel,
    courses,
    items,
    source: CALENDAR_SOURCE,
  };
};
