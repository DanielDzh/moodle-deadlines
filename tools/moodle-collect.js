// Moodle → JSON. Read-only: changes and submits nothing in Moodle.
// Paste into the console (F12 → Console) on your Moodle "My courses" page (/my/courses.php) after logging in.
(async () => {
  const sesskey = M.cfg.sesskey;
  const root = M.cfg.wwwroot;
  const clean = s => (s || '').replace(/\s+/g, ' ').trim();

  const call = async (methodname, args) => {
    const r = await fetch(`${root}/lib/ajax/service.php?sesskey=${sesskey}&info=${methodname}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ index: 0, methodname, args }]),
    });
    const [res] = await r.json();
    if (res.error) throw new Error(`${methodname}: ${res.exception?.message || 'error'}`);
    return res.data;
  };

  console.log('1/4 Courses…');
  const { courses } = await call('core_course_get_enrolled_courses_by_timeline_classification',
    { classification: 'all', limit: 0, offset: 0, sort: 'fullname' });
  const courseids = courses.map(c => c.id);

  console.log('2/4 Tasks with deadlines…');
  const ev = await call('core_calendar_get_action_events_by_courses',
    { courseids, timesortfrom: 0, limitnum: 50 });
  const events = (ev.groupedbycourse || []).flatMap(g => g.events.map(e => ({
    courseid: g.courseid,
    name: e.name,
    modulename: e.modulename,
    eventtype: e.eventtype,
    timesort: e.timesort,
    timestart: e.timestart,
    url: e.url,
    cmid: Number(new URL(e.url, location.href).searchParams.get('id')) || null,
  })));

  console.log('3/4 Course activities…');
  const activities = [];
  for (const c of courses) {
    try {
      const raw = await call('core_courseformat_get_state', { courseid: c.id });
      const state = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const sections = Object.fromEntries((state.section || []).map(s => [s.id, s.title]));
      for (const cm of state.cm || []) {
        if (['assign', 'forum', 'quiz'].includes(cm.module)) {
          activities.push({
            courseid: c.id, cmid: Number(cm.id), name: cm.name, module: cm.module,
            url: cm.url, section: sections[cm.sectionid] || '', uservisible: cm.uservisible,
          });
        }
      }
    } catch (e) { console.warn('Could not fetch course', c.fullname, e.message); }
  }

  console.log('4/4 Assignment pages…');
  const parser = new DOMParser();
  const assigns = activities.filter(x => x.module === 'assign');
  for (const [i, act] of assigns.entries()) {
    try {
      const html = await (await fetch(`${root}/mod/assign/view.php?id=${act.cmid}`, { credentials: 'same-origin' })).text();
      const doc = parser.parseFromString(html, 'text/html');
      act.dates = [...doc.querySelectorAll('.activity-dates div, [data-region="activity-dates"] div')]
        .filter(d => d.querySelector('strong') && !d.querySelector('div'))
        .map(d => clean(d.textContent));
      act.dates = [...new Set(act.dates)];
      act.description = clean(doc.querySelector('.activity-description, #intro')?.textContent).slice(0, 2000);
      act.status = {};
      doc.querySelectorAll('.submissionstatustable tr').forEach(tr => {
        const th = tr.querySelector('th'), td = tr.querySelector('td');
        if (th && td) act.status[clean(th.textContent)] = clean(td.textContent).slice(0, 300);
      });
    } catch (e) { act.error = e.message; }
    console.log(`   ${i + 1}/${assigns.length} ${act.name}`);
    await new Promise(r => setTimeout(r, 150));
  }

  const data = {
    collectedAt: new Date().toISOString(),
    site: root,
    courses: courses.map(c => ({
      id: c.id, fullname: c.fullname, shortname: c.shortname,
      startdate: c.startdate, enddate: c.enddate, viewurl: c.viewurl,
    })),
    events,
    activities,
  };
  const json = JSON.stringify(data, null, 1);

  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  link.download = 'moodle-data.json';
  link.click();
  try { await navigator.clipboard.writeText(json); } catch {}

  console.log(`Done: ${courses.length} courses, ${events.length} events, ${activities.length} activities. moodle-data.json downloaded.`);
})();
