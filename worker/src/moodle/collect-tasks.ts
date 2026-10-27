import { LIMITS, MOODLE } from '../config';
import type { MoodleCall } from './moodle-client';
import { isAuthError } from './moodle-client';
import { cleanText } from './text';

export interface CollectedTask {
  key: string;
  name: string;
  course: string;
  url: string;
  due: number;
  /** true / false when Moodle told us, null when we did not ask or the call failed (keep what we knew). */
  submitted: boolean | null;
}

export interface Collected {
  tasks: CollectedTask[];
  /** False when an optional source failed: do not delete tasks that are merely missing from this partial result. */
  complete: boolean;
}

type Row = Record<string, any>;

/** Runs fn for each item, at most n at a time. */
const pool = async <T>(list: readonly T[], n: number, fn: (item: T) => Promise<void>): Promise<void> => {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, list.length) }, async () => {
      while (next < list.length) await fn(list[next++]);
    }),
  );
};

const courseList = async (call: MoodleCall, now: number): Promise<Row[]> => {
  try {
    // The same selection as the "In progress" tab on the Moodle "My courses" page.
    const res = await call<{ courses?: Row[] }>('core_course_get_enrolled_courses_by_timeline_classification', {
      classification: 'inprogress', limit: 0, offset: 0, sort: 'fullname',
    });
    return res.courses ?? [];
  } catch (error) {
    if (isAuthError(error)) throw error;
    const info = await call<{ userid: number }>('core_webservice_get_site_info');
    const all = await call<Row[]>('core_enrol_get_users_courses', { userid: info.userid });
    return all.filter((c) => (!c.startdate || c.startdate <= now) && (!c.enddate || c.enddate > now) && !c.completed && !c.hidden);
  }
};

/** Parses a Moodle URL's ?id= (the course-module id) or null. */
const cmidOf = (url: unknown): number | null => {
  try {
    return Number(new URL(String(url)).searchParams.get('id')) || null;
  } catch {
    return null;
  }
};

/**
 * Collects upcoming tasks (assignments, forums with a due date, quizzes and other calendar activities) for one user.
 * Keys and the course selection mirror the site's collector, so a task is the same task on the site and on the server.
 * Auth errors propagate; failures of optional sources only make the result incomplete.
 */
export const collectTasks = async (call: MoodleCall, site: string, now: number): Promise<Collected> => {
  const courses = await courseList(call, now);
  const ids = courses.map((c) => Number(c.id));
  if (!ids.length) return { tasks: [], complete: true };
  const courseName = new Map(courses.map((c) => [Number(c.id), cleanText(c.fullname, LIMITS.maxCourseLength)]));

  let complete = true;
  const optional = async <T>(promise: Promise<T>, fallback: T): Promise<T> => {
    try {
      return await promise;
    } catch (error) {
      if (isAuthError(error)) throw error;
      complete = false;
      return fallback;
    }
  };
  const [assignments, forums, events] = await Promise.all([
    optional(call<{ courses?: Row[] }>('mod_assign_get_assignments', { courseids: ids }), { courses: [] }),
    optional(call<Row[]>('mod_forum_get_forums_by_courses', { courseids: ids }), []),
    optional(call<{ groupedbycourse?: Row[] }>('core_calendar_get_action_events_by_courses', { courseids: ids, timesortfrom: 0, limitnum: 50 }), { groupedbycourse: [] }),
  ]);

  const tasks: (CollectedTask & { assignId?: number })[] = [];
  const seen = new Set<number>();

  for (const c of assignments.courses ?? []) {
    for (const a of c.assignments ?? []) {
      const cmid = Number(a.cmid);
      seen.add(cmid);
      tasks.push({
        key: `assign-${cmid}`, name: cleanText(a.name, LIMITS.maxNameLength), course: courseName.get(Number(c.id)) ?? '',
        url: `${site}/mod/assign/view.php?id=${cmid}`, due: a.duedate || 0, submitted: null, assignId: Number(a.id),
      });
    }
  }

  for (const f of Array.isArray(forums) ? forums : []) {
    const cmid = Number(f.cmid);
    if (f.type === 'news' || seen.has(cmid)) continue; // "News" is an announcement forum, not an assignment
    seen.add(cmid);
    tasks.push({
      key: `forum-${cmid}`, name: cleanText(f.name, LIMITS.maxNameLength), course: courseName.get(Number(f.course)) ?? '',
      url: `${site}/mod/forum/view.php?id=${cmid}`, due: f.duedate || 0, submitted: null,
    });
  }

  for (const g of events.groupedbycourse ?? []) {
    for (const e of g.events ?? []) {
      const cmid = cmidOf(e.url);
      if (cmid && seen.has(cmid)) continue;
      const key = `${String(e.modulename || 'event').replace(/[^a-z0-9_]/gi, '')}-${cmid || Number(e.id)}`;
      if (tasks.some((t) => t.key === key)) continue;
      if (cmid) seen.add(cmid);
      tasks.push({
        key, name: cleanText(e.activityname || e.name, LIMITS.maxNameLength), course: courseName.get(Number(g.courseid ?? e.course?.id)) ?? '',
        url: cmid ? `${site}/mod/${String(e.modulename || 'activity').replace(/[^a-z0-9_]/gi, '')}/view.php?id=${cmid}` : site,
        due: e.timesort || e.timestart || 0, submitted: null,
      });
    }
  }

  const upcoming = tasks.filter((t) => t.due > now);

  // Submission status only for assignments due soon, with a hard cap on calls.
  const needStatus = upcoming
    .filter((t) => t.assignId && t.due - now <= MOODLE.statusWindowSec)
    .sort((a, b) => a.due - b.due)
    .slice(0, MOODLE.maxStatusCalls);
  await pool(needStatus, MOODLE.statusConcurrency, async (task) => {
    try {
      const status = await call<Row>('mod_assign_get_submission_status', { assignid: task.assignId });
      const last = status.lastattempt ?? {};
      const submission = last.submission ?? last.teamsubmission;
      task.submitted = last.gradingstatus === 'graded' || submission?.status === 'submitted';
    } catch (error) {
      if (isAuthError(error)) throw error;
      // unknown: leave null so the previous value stays
    }
  });

  return {
    tasks: upcoming.sort((a, b) => a.due - b.due).slice(0, LIMITS.maxTasks).map(({ assignId: _assignId, ...task }) => task),
    complete,
  };
};
