/**
 * The owner's statistics page: a single self-contained HTML document. It asks for the statistics key,
 * keeps it only for the browser session, and reads /api/stats with it. Labels are English: this is an admin tool.
 */
export const STATS_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Moodle Deadlines · stats</title>
<style>
:root{color-scheme:light dark;--bg:#EDF0F4;--card:#fff;--ink:#172033;--muted:#5A6478;--line:#D6DCE5;--bar:#2F49C4}
@media (prefers-color-scheme:dark){:root{--bg:#10141C;--card:#1A202B;--ink:#E7EBF3;--muted:#9AA4B6;--line:#2E3747;--bar:#8EA2FF}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,sans-serif}
main{max-width:860px;margin:0 auto;padding:20px 14px 48px}h1{font-size:1.4rem;margin:0 0 4px}h2{font-size:1rem;margin:24px 0 8px}
.muted{color:var(--muted);font-size:.88rem}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px}.big{font-size:1.9rem;font-weight:700;line-height:1.1}
.bars{display:flex;align-items:flex-end;gap:3px;height:120px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px}
.bar{flex:1;background:var(--bar);border-radius:3px 3px 0 0;min-height:2px;position:relative}.bar:hover::after{content:attr(data-tip);position:absolute;bottom:100%;left:50%;transform:translateX(-50%);background:var(--ink);color:var(--bg);padding:2px 6px;border-radius:5px;white-space:nowrap;font-size:.75rem;z-index:2}
.axis{display:flex;justify-content:space-between;color:var(--muted);font-size:.75rem;margin-top:4px}
table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line)}td:last-child,th:last-child{text-align:right}
form{display:flex;gap:8px;margin:40px 0}input{flex:1;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink);font-size:16px}
button{padding:10px 16px;border:0;border-radius:8px;background:var(--bar);color:var(--bg);font-weight:600;font-size:16px;cursor:pointer}.err{color:#C81E3A}
</style>
</head>
<body><main id="app"></main>
<script>
const app = document.getElementById('app');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0) + '%';

const askKey = (message) => {
  app.innerHTML = '<h1>Stats</h1><form id="f"><input id="k" type="password" placeholder="Statistics key" autocomplete="current-password" autofocus><button>Open</button></form><p class="err">' + esc(message || '') + '</p>';
  document.getElementById('f').onsubmit = (e) => { e.preventDefault(); sessionStorage.setItem('statsKey', document.getElementById('k').value); load(); };
};

const bars = (items, label) => '<div class="bars">' + items.map((i) => '<div class="bar" data-tip="' + esc(i.tip) + '" style="height:' + Math.max(2, Math.round((i.value / (Math.max(...items.map((x) => x.value)) || 1)) * 100)) + '%"></div>').join('') + '</div><div class="axis"><span>' + esc(label[0]) + '</span><span>' + esc(label[1]) + '</span></div>';

const render = (s) => {
  const ev = (name, scope) => s.events[scope][name] || 0;
  const rows = [['Opened the site', 'visit'], ['Logged in', 'login'], ['Opened reminders', 'reminders_open'], ['Clicked donate', 'donate_click'], ['Reminders linked', 'reminders_linked'], ['Reminders unlinked', 'reminders_unlinked'], ['Reminders sent', 'reminder_sent']];
  app.innerHTML =
    '<h1>Stats</h1><p class="muted">Days and hours in ' + esc(s.timeZone) + '. Today is ' + esc(s.today) + '. Anonymous counters only: no IPs, no accounts.</p>' +
    '<h2>Unique visitors</h2><div class="grid">' + [['Today', s.visitors.today], ['Last 3 days', s.visitors.last3], ['Last 7 days', s.visitors.last7], ['Last 30 days', s.visitors.last30]].map((c) => '<div class="card"><div class="muted">' + c[0] + '</div><div class="big">' + c[1] + '</div></div>').join('') + '</div>' +
    '<h2>Visitors per day (30 days)</h2>' + bars(s.perDay.map((d) => ({ value: d.visitors, tip: d.day + ': ' + d.visitors + ' visitors, ' + d.visits + ' opens' })), [s.perDay[0].day, s.perDay[29].day]) +
    '<h2>When they come (opens by hour, 30 days)</h2>' + bars(s.byHour.map((v, h) => ({ value: v, tip: h + ':00 · ' + v + ' opens' })), ['00:00', '23:00']) +
    '<h2>New vs returning (7 days)</h2><div class="grid"><div class="card"><div class="muted">New</div><div class="big">' + s.newVsReturning7.newVisitors + '</div></div><div class="card"><div class="muted">Returning</div><div class="big">' + s.newVsReturning7.returning + '</div></div></div>' +
    '<h2>How often they come (30 days, different days per person)</h2><div class="grid">' + [['Once', s.frequency30.once], ['Twice', s.frequency30.twice], ['3-5 days', s.frequency30.threeToFive], ['6+ days', s.frequency30.sixPlus]].map((c) => '<div class="card"><div class="muted">' + c[0] + '</div><div class="big">' + c[1] + '</div><div class="muted">' + pct(c[1], s.visitors.last30) + ' of visitors</div></div>').join('') + '</div>' +
    '<h2>Events</h2><div class="card"><table><tr><th>Event</th><th>Today</th><th>30 days</th><th>People (30d)</th></tr>' + rows.map((r) => '<tr><td>' + r[0] + '</td><td>' + ev(r[1], 'today') + '</td><td>' + ev(r[1], 'last30') + '</td><td>' + (s.people30[r[1]] || '–') + '</td></tr>').join('') + '</table></div>' +
    '<p class="muted">Donate: ' + s.donate.clickers30 + (s.donate.clickers30 === 1 ? ' person' : ' people') + ' clicked in 30 days, ' + s.donate.rate30 + '% of visitors.</p>' +
    '<p class="muted"><a href="#" id="out">Forget the key</a></p>';
  document.getElementById('out').onclick = (e) => { e.preventDefault(); sessionStorage.removeItem('statsKey'); askKey(''); };
};

const load = async () => {
  const key = sessionStorage.getItem('statsKey');
  if (!key) return askKey('');
  try {
    const r = await fetch('/api/stats', { headers: { Authorization: 'Bearer ' + key } });
    if (r.status === 401) { sessionStorage.removeItem('statsKey'); return askKey('Wrong key.'); }
    if (!r.ok) return askKey('The server answered ' + r.status + '.');
    render(await r.json());
  } catch (e) { askKey('Could not reach the server.'); }
};
load();
</script>
</body>
</html>`;
