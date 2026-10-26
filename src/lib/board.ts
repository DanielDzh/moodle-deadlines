import { BAND_ORDER } from '../config';
import type { BandId, Course, DecoratedTask, Snapshot, Task } from '../types';
import { dayKey, daysUntil } from './dates';

/**
 * Кінець семестру: найчастіша дата завершення серед поточних курсів.
 * Якщо в курсах її немає — 31 січня або 30 червня, залежно від пори року.
 */
export function semesterEnd(courses: Course[], now = new Date()): number {
  const t = now.getTime() / 1000;
  const ends = courses.map((c) => c.end).filter((e) => e && e > t && e < t + 300 * 86400);
  if (ends.length) {
    const freq = new Map<string, { n: number; ts: number }>();
    for (const e of ends) {
      const k = dayKey(e);
      const f = freq.get(k) ?? { n: 0, ts: e };
      f.n++;
      f.ts = Math.max(f.ts, e);
      freq.set(k, f);
    }
    return [...freq.values()].sort((a, b) => b.n - a.n || a.ts - b.ts)[0].ts;
  }
  const m = now.getMonth();
  const y = now.getFullYear();
  const end =
    m >= 7 ? new Date(y + 1, 0, 31, 23, 59) : m === 0 ? new Date(y, 0, 31, 23, 59) : new Date(y, 5, 30, 23, 59);
  return Math.floor(end.getTime() / 1000);
}

/** Смуга й терміновість завдання відносно сьогодні. */
export function decorate(task: Task, semEnd: number, now = new Date()): DecoratedTask {
  if (!task.due) return { ...task, band: 'none', days: null, overdue: false, urg: 'u-none' };
  const days = daysUntil(task.due, now);
  const overdue = task.due < now.getTime() / 1000;
  const band: BandId = overdue
    ? 'overdue'
    : days <= 7
      ? 'week'
      : days <= 31
        ? 'month'
        : task.due <= semEnd
          ? 'semester'
          : 'later';
  const urg = overdue ? 'u-over' : days <= 2 ? 'u-hot' : days <= 7 ? 'u-warm' : days <= 31 ? 'u-mild' : 'u-calm';
  return { ...task, band, days, overdue, urg };
}

/** Найтерміновіше зверху; серед прострочених — нещодавно прострочені першими; без терміну — у кінці. */
export function compareTasks(a: DecoratedTask, b: DecoratedTask): number {
  if (!a.due && !b.due) return a.name.localeCompare(b.name, 'uk');
  if (!a.due) return 1;
  if (!b.due) return -1;
  if (a.overdue && b.overdue) return b.due - a.due;
  return a.due - b.due || a.name.localeCompare(b.name, 'uk');
}

export const isSubmitted = (t: Task) => t.status === 'submitted' || t.status === 'graded';

export interface BoardOptions {
  done: Record<string, boolean>;
  filter: number[];
  hideDone: boolean;
  hideSubmitted: boolean;
  burnDays: number;
  now?: Date;
}

export interface DayGroup {
  key: string;
  items: DecoratedTask[];
}

export interface BandView {
  id: BandId;
  items: DecoratedTask[];
  groups: DayGroup[];
}

/** Усе, що потрібно для відмальовування дошки, обчислене з одного зліпка даних. */
export function buildBoard(snapshot: Snapshot, opts: BoardOptions) {
  const now = opts.now ?? new Date();
  const courseIds = new Set(snapshot.courses.map((c) => c.id));
  const filter = new Set(opts.filter.filter((id) => courseIds.has(id)));
  const semEnd = semesterEnd(snapshot.courses, now);

  const isFinished = (t: Task) => !!opts.done[t.key] || isSubmitted(t);
  const isBurning = (t: DecoratedTask) =>
    !!t.due && !t.overdue && t.days !== null && t.days <= opts.burnDays && !isFinished(t);
  const isShown = (t: Task) => !(opts.hideDone && opts.done[t.key]) && !(opts.hideSubmitted && isSubmitted(t));

  const all = snapshot.items.map((t) => decorate(t, semEnd, now)).sort(compareTasks);
  const scoped = all.filter((t) => filter.size === 0 || filter.has(t.courseid));
  const visible = scoped.filter(isShown);

  // Зведення не залежить від перемикачів: рахує лише те, що ще треба зробити.
  const pending = scoped.filter((t) => !isFinished(t));
  const upcoming = pending.filter((t) => t.due && !t.overdue);
  const summary = {
    next: upcoming[0] as DecoratedTask | undefined,
    in7: upcoming.filter((t) => (t.days ?? Infinity) <= 7).length,
    in31: upcoming.filter((t) => (t.days ?? Infinity) <= 31).length,
    overdue: pending.filter((t) => t.overdue).length,
    total: scoped.length,
  };

  // Лічильники на чипах — скільки завдань курсу зараз видно.
  const counts = new Map<number, number>();
  const shownAll = all.filter(isShown);
  for (const t of shownAll) counts.set(t.courseid, (counts.get(t.courseid) ?? 0) + 1);

  const bands: BandView[] = BAND_ORDER.map((id) => {
    const items = visible.filter((t) => t.band === id);
    const groups: DayGroup[] = [];
    for (const t of items) {
      const key = t.due ? dayKey(t.due) : 'none';
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.items.push(t);
      else groups.push({ key, items: [t] });
    }
    return { id, items, groups };
  }).filter((b) => b.items.length > 0);

  return {
    all,
    semEnd,
    filter,
    summary,
    counts,
    shownTotal: shownAll.length,
    bands,
    isFinished,
    isBurning,
  };
}

export type Board = ReturnType<typeof buildBoard>;
