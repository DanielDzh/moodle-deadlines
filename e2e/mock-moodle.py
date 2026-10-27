"""
E2E check of the built site against a mocked Moodle (no real Moodle needed).

    npm run build
    pip install playwright && playwright install chromium
    TZ=Europe/Kyiv python e2e/mock-moodle.py dist docs/screenshots

Checks login, the loader, bands, "burning", filters, ticks, theme, logout, the reminders dialog, anonymous
statistics events, the phone layout, and refreshes the README screenshots along the way.
The reminders Worker is mocked inside the test: nothing here talks to the real service.
"""
import json, sys, time, threading, functools, http.server, datetime as dt
from urllib.parse import parse_qs
from playwright.sync_api import sync_playwright

OUT = sys.argv[1]           # folder with the bundle
SHOTS = sys.argv[2]         # where to put screenshots
SITE = 'https://moodle.example.edu'

# --- static server for the bundle
Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=OUT)
Handler.log_message = lambda *a: None
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 8765), Handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
APP = 'http://127.0.0.1:8765/index.html'

# --- "Moodle" data relative to today
now = dt.datetime.now()
def at(days, h=23, m=59):
    d = (now + dt.timedelta(days=days)).replace(hour=h, minute=m, second=0, microsecond=0)
    return int(d.timestamp())

sem_end = at(80)
courses = [
    (11, 'Історія Церкви'), (12, 'Біблійна грецька мова'), (13, 'Гомілетика'),
    (14, 'Християнська етика'), (15, 'Англійська мова'),
]
assigns = [
    # course, cmid, name, due, open, status, intro
    (11, 101, 'Реферат: Нікейський собор', at(-2, 18, 0), 0, 'new', '<p>Обсяг 6–8 сторінок. Використайте щонайменше три першоджерела й оформіть посилання за ДСТУ.</p>'),
    (12, 102, 'Переклад Ів. 1:1–18', at(0), 0, 'new', '<p>Перекладіть уривок з грецької, позначте всі дієслівні форми й поясніть вибір часу.</p>'),
    (13, 103, 'Конспект проповіді', at(1, 20, 0), 0, 'draft', '<p>Підготуйте план проповіді на 10 хвилин: тема, головна думка, три пункти, застосування.</p>'),
    (14, 104, 'Есе: етика праці', at(3), 0, 'submitted', '<p>Есе на 2 сторінки.</p>'),
    (15, 105, 'Essay: My calling', at(10), 0, 'new', '<p>Write 300–400 words about your calling. Use at least five words from Unit 4.</p>'),
    (11, 106, 'Хронологічна таблиця', at(24), 0, 'new', '<p>Таблиця ключових подій IV–V століть з короткими поясненнями.</p>'),
    (13, 107, 'Проповідь на практиці', at(46), at(30, 9, 0), 'new', '<p>Запис проповіді на 8–10 хвилин. Завантажте відео або посилання на нього.</p>'),
    (12, 108, 'Підсумкова робота', at(95), 0, 'new', '<p>Переклад і граматичний розбір обраного уривку.</p>'),
]
forums = [
    {'id': 1, 'cmid': 201, 'course': 14, 'name': 'Обговорення: совість і вибір', 'type': 'general', 'duedate': at(6), 'intro': '<p>Напишіть допис і дайте відповідь двом одногрупникам.</p>'},
    {'id': 2, 'cmid': 202, 'course': 15, 'name': 'Speaking club', 'type': 'general', 'duedate': 0, 'intro': '<p>Діліться записами розмовних вправ.</p>'},
    {'id': 3, 'cmid': 203, 'course': 11, 'name': 'Новини', 'type': 'news'},
]
events = {'groupedbycourse': [{'courseid': 12, 'events': [
    {'id': 9, 'name': 'Тест: дієвідміна', 'activityname': 'Тест: дієвідміна', 'modulename': 'quiz', 'url': f'{SITE}/mod/quiz/view.php?id=301', 'timesort': at(4, 12, 0), 'description': '<p>20 питань, 30 хвилин, одна спроба.</p>'},
    {'id': 10, 'name': 'Переклад Ів. 1:1–18', 'modulename': 'assign', 'url': f'{SITE}/mod/assign/view.php?id=102', 'timesort': at(0)},
]}]}

calls = []
def ws(fn, form):
    calls.append(fn)
    if form.get('wstoken', [''])[0] != 'TOKEN123':
        return {'exception': 'moodle_exception', 'errorcode': 'invalidtoken', 'message': 'Invalid token'}
    if fn == 'core_webservice_get_site_info':
        return {'siteurl': SITE, 'userid': 7, 'fullname': 'Марія Шевченко'}
    if fn == 'core_course_get_enrolled_courses_by_timeline_classification':
        assert form['classification'] == ['inprogress']
        return {'courses': [{'id': i, 'fullname': n, 'shortname': n[:3], 'startdate': at(-50), 'enddate': sem_end} for i, n in courses]}
    if fn == 'mod_assign_get_assignments':
        by = {}
        for c, cm, n, due, op, st, intro in assigns:
            by.setdefault(c, []).append({'id': cm + 1000, 'cmid': cm, 'name': n, 'duedate': due, 'allowsubmissionsfromdate': op, 'cutoffdate': 0, 'intro': intro})
        return {'courses': [{'id': c, 'assignments': a} for c, a in by.items()]}
    if fn == 'mod_forum_get_forums_by_courses':
        return forums
    if fn == 'core_calendar_get_action_events_by_courses':
        return events
    if fn == 'mod_assign_get_submission_status':
        aid = int(form['assignid'][0]); st = next(a[5] for a in assigns if a[1] + 1000 == aid)
        return {'lastattempt': {'submission': {'status': st}, 'gradingstatus': 'notgraded'}}
    return {'exception': 'x', 'errorcode': 'invalidfunction', 'message': fn}

def handle(route, request):
    url = request.url
    hdr = {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}
    form = parse_qs(request.post_data or '')
    if url.endswith('/login/token.php'):
        ok = form.get('username') == ['maria'] and form.get('password') == ['secret']
        body = {'token': 'TOKEN123'} if ok else {'error': 'Invalid login', 'errorcode': 'invalidlogin'}
    elif url.endswith('/webservice/rest/server.php'):
        time.sleep(0.15)
        body = ws(form['wsfunction'][0], form)
    else:
        return route.fulfill(status=404, body='')
    route.fulfill(status=200, headers=hdr, body=json.dumps(body))

# --- mocked reminders Worker (the real one must never see test traffic)
WORKER = 'https://moodle-deadlines-bot.tinyapp.workers.dev'
hits = []                     # anonymous statistics events the site sent
worker_calls = []             # (method, path) of every other call
reminders = {'state': 'none'}
CORS = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'}

def worker(route, request):
    path = request.url.replace(WORKER, '')
    if request.method == 'OPTIONS':
        return route.fulfill(status=204, headers=CORS)
    if path == '/api/hit':
        hits.append(json.loads(request.post_data or '{}'))
        return route.fulfill(status=204, headers=CORS)
    worker_calls.append((request.method, path))
    body = {'ok': True}
    if path == '/api/link/start':
        reminders['state'] = 'pending'
        body = {'code': 'ABCDEFGH23', 'expiresAt': int(time.time()) + 600, 'botUrl': 'https://t.me/moodle_deadlines_bot?start=ABCDEFGH23'}
    elif path == '/api/link/status':
        body = {'state': reminders['state'], 'done': []}
    elif path == '/api/unlink':
        reminders['state'] = 'none'
    route.fulfill(status=200, headers={**CORS, 'Content-Type': 'application/json'}, body=json.dumps(body))

results = []
def check(name, cond):
    results.append((name, bool(cond)))
    print(('PASS ' if cond else 'FAIL ') + name)

with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}, device_scale_factor=2, locale='uk-UA', timezone_id='Europe/Kyiv')
    ctx.route(f'{SITE}/**', handle)
    ctx.route(f'{WORKER}/**', worker)
    ctx.route('https://fonts.googleapis.com/**', lambda r, q: r.abort())
    ctx.route('https://fonts.gstatic.com/**', lambda r, q: r.abort())
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)

    # 1. Login
    page.goto(APP + '?site=moodle.example.edu/my/courses.php')
    check('address field is pre-filled from ?site= and normalised', page.input_value('input[name=site]') == SITE)
    check('the login hints keep their plain style', page.evaluate("(() => { const s = getComputedStyle(document.querySelector('p.hint')); return s.position === 'static' && s.backgroundColor === 'rgba(0, 0, 0, 0)'; })()"))
    page.fill('#username', 'maria'); page.fill('#password', 'wrong'); page.click('button[type=submit]')
    page.wait_for_selector('.error:has-text("Неправильний")')
    check('a wrong password shows an error', True)
    check('the password field is cleared after an attempt', page.input_value('#password') == '')
    page.fill('#password', 'secret'); page.click('button[type=submit]')
    page.wait_for_selector('.loading .step')
    check('the loader shows its three steps', page.locator('.loading .step').count() == 3)
    page.wait_for_selector('.hero', timeout=15000)
    page.wait_for_function("!document.querySelector('.loading')")
    check('the board loaded with the user name', page.inner_text('.who') == 'Марія Шевченко')

    # 2. Content
    bands = page.eval_on_selector_all('.band-head h2', 'els => els.map(e => e.textContent)')
    check(f'bands in the right order {bands}', bands == ['Прострочено', 'Цей тиждень', 'Найближчий місяць', 'До кінця семестру', 'Пізніше', 'Без терміну'])
    names = page.eval_on_selector_all('.card h3', 'els => els.map(e => e.textContent)')
    check('a submitted task is hidden by default', 'Есе: етика праці' not in names)
    check('"News" did not get into the list', 'Новини' not in names)
    check('no duplicate calendar event appeared', names.count('Переклад Ів. 1:1–18') == 1)
    check('the quiz from the calendar is present', 'Тест: дієвідміна' in names)
    check('the nearest deadline is today\'s translation', page.inner_text('.hero-title') == 'Переклад Ів. 1:1–18')
    burning = page.eval_on_selector_all('.card.is-burning h3', 'els => els.map(e => e.textContent)')
    check(f'only 0–2 day tasks burn {burning}', sorted(burning) == sorted(['Переклад Ів. 1:1–18', 'Конспект проповіді']))
    check('the summary glows', page.locator('.hero.burning').count() == 1)
    check('"opens…" for a not yet open task', page.locator('.card:has-text("Проповідь на практиці") .opens').count() == 1)
    check('links open in a new tab', page.get_attribute('.card h3 a', 'target') == '_blank')
    check('noun forms in the band header', 'завдання' in page.inner_text('.band-week .cnt'))
    page.screenshot(path=f'{SHOTS}/desktop-board.png', full_page=False)

    check('every card uses the styled checkbox', page.locator('.card .cbx').count() == page.locator('.card').count() > 0)

    # 2a. First-visit hint: shown once, closing it is remembered
    check('the reminders hint is shown to a new user', page.locator('.rem-hint-anchor aside.rem-hint').count() == 1)
    page.screenshot(path=f'{SHOTS}/desktop-hint.png', full_page=False)
    page.click('aside.rem-hint .rem-hint-close')
    check('closing the hint hides it and remembers it', page.locator('aside.rem-hint').count() == 0 and page.evaluate("localStorage.getItem('md.hintReminders')") == 'true')
    page.reload()
    page.wait_for_selector('.hero')
    check('the closed hint stays closed after a reload', page.locator('aside.rem-hint').count() == 0)

    # 2b. Reminders dialog, donate link and statistics events
    page.click('header .btn:has-text("Нагадування")')
    page.wait_for_selector('dialog.reminders[open]')
    page.click('dialog.reminders >> text=Підключити Telegram')
    check('connecting without consent asks for it and calls nothing', page.locator('dialog.reminders .error').count() == 1 and ('POST', '/api/link/start') not in worker_calls)
    page.locator('dialog.reminders .cbx input').check()
    page.click('dialog.reminders >> text=Підключити Telegram')
    page.wait_for_selector('dialog.reminders .pending-steps')
    check('linking shows the two steps and the bot link', page.locator('dialog.reminders .pending-steps li').count() == 2 and page.get_attribute('dialog.reminders a.open-bot', 'href').startswith('https://t.me/moodle_deadlines_bot?start='))
    page.screenshot(path=f'{SHOTS}/desktop-reminders.png')
    page.click('dialog.reminders >> text=Скасувати')
    page.wait_for_selector('dialog.reminders', state='detached')
    check('cancelling removes the link on the server', ('POST', '/api/unlink') in worker_calls and reminders['state'] == 'none')
    page.evaluate("document.querySelector('.donate.icon').addEventListener('click', (e) => e.preventDefault(), true)")
    page.click('.donate.icon')
    page.wait_for_function('true')
    check('the donate link opens in a new tab', page.get_attribute('.donate.icon', 'target') == '_blank')
    page.wait_for_timeout(300)
    kinds = [h.get('event') for h in hits]
    check(f'statistics events so far {kinds}', {'visit', 'login', 'reminders_open', 'donate_click'} <= set(kinds) and len({h.get('id') for h in hits}) == 1)

    # 3. Toggles and filters
    page.click('text=Приховати подані')
    check('"Приховати подані" turns off and shows submitted', page.locator('.card h3:has-text("Есе: етика праці")').count() == 1)
    page.click('text=Приховати подані')
    page.click('.chips-toggle')
    check('chips expand', page.locator('#courseChips').count() == 1)
    page.click('.chip:has-text("Гомілетика")')
    names = page.eval_on_selector_all('.card h3', 'els => els.map(e => e.textContent)')
    check(f'course filter {names}', set(names) == {'Конспект проповіді', 'Проповідь на практиці'})
    page.screenshot(path=f'{SHOTS}/desktop-filter.png')
    page.click('.chip.all')
    page.click('.chips-toggle')
    check('chips collapse', page.locator('#courseChips').count() == 0)

    # 4. The "Виконано" tick survives a reload
    card = page.locator('.card', has_text='Конспект проповіді')
    card.locator('input[type=checkbox]').check()
    check('a done task stops burning', page.locator('.card.is-burning:has-text("Конспект проповіді")').count() == 0)
    page.reload(); page.wait_for_selector('.hero')
    check('the tick survived a reload', page.locator('.card:has-text("Конспект проповіді") input[type=checkbox]').is_checked())
    check('data is fetched again after a reload', calls.count('core_webservice_get_site_info') >= 2)
    page.locator('.card:has-text("Конспект проповіді") input[type=checkbox]').uncheck()

    # 5. Theme
    page.click('text=Тема: як у системі')
    page.click('text=Тема: світла')
    check('dark theme turns on', page.evaluate("document.documentElement.dataset.theme") == 'dark')
    page.screenshot(path=f'{SHOTS}/desktop-dark.png')
    page.click('text=Тема: темна')
    check('back to the system theme', page.evaluate("document.documentElement.dataset.theme") is None)

    # 6. Logout
    page.click('text=Вийти')
    check('the confirmation dialog opened', page.locator('dialog.confirm[open]').count() == 1)
    page.screenshot(path=f'{SHOTS}/desktop-logout.png')
    page.keyboard.press('Escape')
    check('Esc only closes it', page.locator('dialog.confirm[open]').count() == 0 and page.locator('.hero').count() == 1)
    page.click('text=Вийти'); page.click('dialog .btn.danger')
    page.wait_for_selector('form.panel')
    check('the privacy page is linked from the login screen', page.locator('a[href$="privacy.html"]').count() == 1)
    check('the token is removed after logout', page.evaluate("localStorage.getItem('md.token')") is None)
    check('ticks remain after logout', page.evaluate("localStorage.getItem('md.done')") is not None)

    # 7. Phone
    m = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True, locale='uk-UA', timezone_id='Europe/Kyiv')
    m.route(f'{SITE}/**', handle)
    m.route(f'{WORKER}/**', worker)
    mp = m.new_page()
    mp.on('pageerror', lambda e: errors.append(str(e)))
    mp.goto(APP + '?site=moodle.example.edu')
    mp.screenshot(path=f'{SHOTS}/phone-login.png')
    mp.fill('#username', 'maria'); mp.fill('#password', 'secret'); mp.click('button[type=submit]')
    mp.wait_for_selector('.loading .step.done')
    mp.screenshot(path=f'{SHOTS}/phone-loading.png')
    mp.wait_for_selector('.hero'); mp.wait_for_function("!document.querySelector('.loading')")
    mp.screenshot(path=f'{SHOTS}/phone-board.png')
    no_hscroll = mp.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
    check('no horizontal scroll on the phone', no_hscroll)
    mp.evaluate("window.scrollTo(0, document.querySelector('.band-month').offsetTop - 10)")
    mp.screenshot(path=f'{SHOTS}/phone-month.png')

    mp.evaluate('window.scrollTo(0, 0)')
    mp.click('header .btn:has-text("Нагадування")')
    mp.wait_for_selector('dialog.reminders[open]')
    mp.wait_for_timeout(400)
    mp.screenshot(path=f'{SHOTS}/phone-reminders.png')
    mp.keyboard.press('Escape')

    # 7b. The "burning" threshold from the URL
    mp.goto(APP + '?burnDays=7'); mp.wait_for_selector('.hero'); mp.wait_for_function("!document.querySelector('.loading')")
    n7 = mp.locator('.card.is-burning').count()
    check(f'?burnDays=7 sets the whole week on fire ({n7})', n7 >= 4)

    # 8. Stale token → back to login
    mp.evaluate("localStorage.setItem('md.token', JSON.stringify('EXPIRED'))")
    mp.reload()
    mp.wait_for_selector('.error:has-text("Доступ застарів")', timeout=15000)
    check('a stale token returns to login with an explanation', True)

    check('the Worker was only asked for known routes', {p for _, p in worker_calls} <= {'/api/link/start', '/api/link/status', '/api/unlink', '/api/sync'})
    real_errors = [e for e in errors if 'fonts.g' not in e and 'ERR_FAILED' not in e]
    check(f'no console errors {real_errors}', not real_errors)
    check('only read functions were called', all('_get_' in c for c in calls))
    b.close()

srv.shutdown()
failed = [n for n, ok in results if not ok]
print(f'\n{len(results) - len(failed)}/{len(results)} passed')
sys.exit(1 if failed else 0)
