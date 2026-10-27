import { describe, expect, it } from 'vitest';
import { collectTasks } from './collect-tasks';
import { MoodleApiError, type MoodleCall } from './moodle-client';

const NOW = 1_800_000_000;
const DAY = 86_400;
const SITE = 'https://m.edu';

/** A fake Moodle: each function name maps to a response or a function. */
const fake = (responses: Record<string, unknown>, calls: string[] = []): MoodleCall =>
  (async (fn: string, args?: Record<string, unknown>) => {
    calls.push(fn);
    const value = responses[fn];
    if (value instanceof Error) throw value;
    if (typeof value === 'function') return (value as (a?: Record<string, unknown>) => unknown)(args);
    if (value === undefined) throw new MoodleApiError('invalidfunction');
    return value;
  }) as MoodleCall;

const base = {
  core_course_get_enrolled_courses_by_timeline_classification: { courses: [{ id: 10, fullname: 'Data<b>bases</b>' }, { id: 11, fullname: 'History' }] },
  mod_assign_get_assignments: { courses: [{ id: 10, assignments: [
    { id: 100, cmid: 1000, name: 'Lab &amp; essay', duedate: NOW + DAY },
    { id: 101, cmid: 1001, name: 'Far project', duedate: NOW + 30 * DAY },
    { id: 102, cmid: 1002, name: 'Old one', duedate: NOW - DAY },
    { id: 103, cmid: 1003, name: 'No date', duedate: 0 },
  ] }] },
  mod_forum_get_forums_by_courses: [
    { cmid: 2000, course: 11, name: 'News', type: 'news', duedate: NOW + DAY },
    { cmid: 2001, course: 11, name: 'Discussion', type: 'general', duedate: NOW + 2 * DAY },
  ],
  core_calendar_get_action_events_by_courses: { groupedbycourse: [{ courseid: 10, events: [
    { id: 9, name: 'Quiz 1', modulename: 'quiz', url: 'https://m.edu/mod/quiz/view.php?id=3000', timesort: NOW + 3 * DAY },
    { id: 10, name: 'Lab again', modulename: 'assign', url: 'https://m.edu/mod/assign/view.php?id=1000', timesort: NOW + DAY },
  ] }] },
  mod_assign_get_submission_status: (args?: Record<string, unknown>) => (args?.assignid === 100 ? { lastattempt: { submission: { status: 'submitted' } } } : { lastattempt: { submission: { status: 'new' } } }),
};

describe('collectTasks', () => {
  it('uses the same keys as the site and keeps only upcoming dated tasks, soonest first', async () => {
    const { tasks, complete } = await collectTasks(fake(base), SITE, NOW);
    expect(complete).toBe(true);
    expect(tasks.map((t) => t.key)).toEqual(['assign-1000', 'forum-2001', 'quiz-3000', 'assign-1001']);
    expect(tasks[0]).toEqual({ key: 'assign-1000', name: 'Lab & essay', course: 'Databases', url: 'https://m.edu/mod/assign/view.php?id=1000', due: NOW + DAY, submitted: true });
    expect(tasks[2]).toMatchObject({ name: 'Quiz 1', course: 'Databases', url: 'https://m.edu/mod/quiz/view.php?id=3000' });
  });

  it('asks for submission status only for assignments due within the window', async () => {
    const calls: string[] = [];
    const { tasks } = await collectTasks(fake(base, calls), SITE, NOW);
    expect(calls.filter((c) => c === 'mod_assign_get_submission_status')).toHaveLength(1);
    expect(tasks.find((t) => t.key === 'assign-1001')?.submitted).toBeNull();
    expect(tasks.find((t) => t.key === 'forum-2001')?.submitted).toBeNull();
  });

  it('caps the number of status calls', async () => {
    const many = { courses: [{ id: 10, assignments: Array.from({ length: 40 }, (_, i) => ({ id: i + 1, cmid: 5000 + i, name: `A${i}`, duedate: NOW + DAY + i })) }] };
    const calls: string[] = [];
    await collectTasks(fake({ ...base, mod_assign_get_assignments: many }, calls), SITE, NOW);
    expect(calls.filter((c) => c === 'mod_assign_get_submission_status')).toHaveLength(15);
  });

  it('marks the result incomplete when an optional source fails', async () => {
    const { tasks, complete } = await collectTasks(fake({ ...base, core_calendar_get_action_events_by_courses: new MoodleApiError('network') }), SITE, NOW);
    expect(complete).toBe(false);
    expect(tasks.some((t) => t.key === 'assign-1000')).toBe(true);
  });

  it('leaves submitted unknown when a status call fails', async () => {
    const { tasks } = await collectTasks(fake({ ...base, mod_assign_get_submission_status: new MoodleApiError('network') }), SITE, NOW);
    expect(tasks.find((t) => t.key === 'assign-1000')?.submitted).toBeNull();
  });

  it('lets authentication errors through, from any call', async () => {
    const stale = new MoodleApiError('invalidtoken');
    await expect(collectTasks(fake({ ...base, mod_assign_get_assignments: stale }), SITE, NOW)).rejects.toBe(stale);
    await expect(collectTasks(fake({ ...base, core_course_get_enrolled_courses_by_timeline_classification: stale }), SITE, NOW)).rejects.toBe(stale);
  });

  it('falls back to the enrolment list when the timeline call is unavailable', async () => {
    const responses = {
      ...base,
      core_course_get_enrolled_courses_by_timeline_classification: new MoodleApiError('invalidfunction'),
      core_webservice_get_site_info: { userid: 7 },
      core_enrol_get_users_courses: [{ id: 10, fullname: 'Databases', startdate: 1, enddate: 0 }, { id: 11, fullname: 'Finished', startdate: 1, enddate: 2 }],
    };
    const { tasks } = await collectTasks(fake(responses), SITE, NOW);
    expect(tasks[0].course).toBe('Databases');
  });

  it('returns nothing for a user without current courses', async () => {
    const empty = { ...base, core_course_get_enrolled_courses_by_timeline_classification: { courses: [] } };
    expect(await collectTasks(fake(empty), SITE, NOW)).toEqual({ tasks: [], complete: true });
  });
});
