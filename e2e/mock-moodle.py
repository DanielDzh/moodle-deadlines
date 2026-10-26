"""
E2E-перевірка зібраного сайту проти замоканого Moodle (справжній Moodle не потрібен).

    npm run build
    pip install playwright && playwright install chromium
    TZ=Europe/Kyiv python e2e/mock-moodle.py dist docs/screenshots

Перевіряє вхід, смуги, «горить», фільтри, галочки, тему, вихід, телефонну верстку
і заодно оновлює скриншоти для README.
"""
import json, sys, time, threading, functools, http.server, datetime as dt
from urllib.parse import parse_qs
from playwright.sync_api import sync_playwright

OUT = sys.argv[1]           # папка з бандлом
SHOTS = sys.argv[2]         # куди класти скриншоти
SITE = 'https://moodle.example.edu'

# --- статичний сервер для бандла
Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=OUT)
Handler.log_message = lambda *a: None
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 8765), Handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
APP = 'http://127.0.0.1:8765/index.html'

# --- дані «Moodle» відносно сьогодні
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
        time.sleep(0.05)
        body = ws(form['wsfunction'][0], form)
    else:
        return route.fulfill(status=404, body='')
    route.fulfill(status=200, headers=hdr, body=json.dumps(body))

results = []
def check(name, cond):
    results.append((name, bool(cond)))
    print(('PASS ' if cond else 'FAIL ') + name)

with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}, device_scale_factor=2, locale='uk-UA', timezone_id='Europe/Kyiv')
    ctx.route(f'{SITE}/**', handle)
    ctx.route('https://fonts.googleapis.com/**', lambda r, q: r.abort())
    ctx.route('https://fonts.gstatic.com/**', lambda r, q: r.abort())
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)

    # 1. Вхід
    page.goto(APP + '?site=moodle.example.edu/my/courses.php')
    check('поле адреси заповнене з ?site= і нормалізоване', page.input_value('input[name=site]') == SITE)
    page.fill('#username', 'maria'); page.fill('#password', 'wrong'); page.click('button[type=submit]')
    page.wait_for_selector('.error:has-text("Неправильний")')
    check('неправильний пароль показує помилку', True)
    check('поле пароля очищене після спроби', page.input_value('#password') == '')
    page.fill('#password', 'secret'); page.click('button[type=submit]')
    page.wait_for_selector('.hero', timeout=15000)
    page.wait_for_function("!document.querySelector('.loading')")
    check('дошка завантажилася з іменем користувача', page.inner_text('.who') == 'Марія Шевченко')

    # 2. Зміст
    bands = page.eval_on_selector_all('.band-head h2', 'els => els.map(e => e.textContent)')
    check(f'смуги в правильному порядку {bands}', bands == ['Прострочено', 'Цей тиждень', 'Найближчий місяць', 'До кінця семестру', 'Пізніше', 'Без терміну'])
    names = page.eval_on_selector_all('.card h3', 'els => els.map(e => e.textContent)')
    check('подане завдання сховане за замовчуванням', 'Есе: етика праці' not in names)
    check('«Новини» не потрапили в список', 'Новини' not in names)
    check('дубль події календаря не з’явився', names.count('Переклад Ів. 1:1–18') == 1)
    check('тест із календаря є', 'Тест: дієвідміна' in names)
    check('найближчий дедлайн — сьогоднішній переклад', page.inner_text('.hero-title') == 'Переклад Ів. 1:1–18')
    burning = page.eval_on_selector_all('.card.is-burning h3', 'els => els.map(e => e.textContent)')
    check(f'горять лише 0–2 дні {burning}', sorted(burning) == sorted(['Переклад Ів. 1:1–18', 'Конспект проповіді']))
    check('зведення світиться', page.locator('.hero.burning').count() == 1)
    check('«відкриється…» для ще закритого', page.locator('.card:has-text("Проповідь на практиці") .opens').count() == 1)
    check('посилання відкриваються в новій вкладці', page.get_attribute('.card h3 a', 'target') == '_blank')
    check('відмінки у смузі', 'завдання' in page.inner_text('.band-week .cnt'))
    page.screenshot(path=f'{SHOTS}/desktop-board.png', full_page=False)

    # 3. Перемикачі й фільтри
    page.click('text=Приховати подані')
    check('«Приховати подані» вимикається й показує подане', page.locator('.card h3:has-text("Есе: етика праці")').count() == 1)
    page.click('text=Приховати подані')
    page.click('.chips-toggle')
    check('чипи розгортаються', page.locator('#courseChips').count() == 1)
    page.click('.chip:has-text("Гомілетика")')
    names = page.eval_on_selector_all('.card h3', 'els => els.map(e => e.textContent)')
    check(f'фільтр за курсом {names}', set(names) == {'Конспект проповіді', 'Проповідь на практиці'})
    page.screenshot(path=f'{SHOTS}/desktop-filter.png')
    page.click('.chip.all')
    page.click('.chips-toggle')
    check('чипи згортаються', page.locator('#courseChips').count() == 0)

    # 4. Галочка «Виконано» переживає перезавантаження
    card = page.locator('.card', has_text='Конспект проповіді')
    card.locator('input[type=checkbox]').check()
    check('виконане перестає горіти', page.locator('.card.is-burning:has-text("Конспект проповіді")').count() == 0)
    page.reload(); page.wait_for_selector('.hero')
    check('галочка збереглася після перезавантаження', page.locator('.card:has-text("Конспект проповіді") input[type=checkbox]').is_checked())
    check('після перезавантаження дані підтягуються знову', calls.count('core_webservice_get_site_info') >= 2)
    page.locator('.card:has-text("Конспект проповіді") input[type=checkbox]').uncheck()

    # 5. Тема
    page.click('text=Тема: як у системі')
    page.click('text=Тема: світла')
    check('темна тема вмикається', page.evaluate("document.documentElement.dataset.theme") == 'dark')
    page.screenshot(path=f'{SHOTS}/desktop-dark.png')
    page.click('text=Тема: темна')
    check('повернення до системної теми', page.evaluate("document.documentElement.dataset.theme") is None)

    # 6. Вихід
    page.click('text=Вийти')
    check('вікно підтвердження відкрилося', page.locator('dialog.confirm[open]').count() == 1)
    page.screenshot(path=f'{SHOTS}/desktop-logout.png')
    page.keyboard.press('Escape')
    check('Esc лише закриває', page.locator('dialog.confirm[open]').count() == 0 and page.locator('.hero').count() == 1)
    page.click('text=Вийти'); page.click('dialog .btn.danger')
    page.wait_for_selector('form.panel')
    check('після виходу токен видалено', page.evaluate("localStorage.getItem('md.token')") is None)
    check('після виходу галочки лишилися', page.evaluate("localStorage.getItem('md.done')") is not None)

    # 7. Телефон
    m = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True, locale='uk-UA', timezone_id='Europe/Kyiv')
    m.route(f'{SITE}/**', handle)
    mp = m.new_page()
    mp.on('pageerror', lambda e: errors.append(str(e)))
    mp.goto(APP + '?site=moodle.example.edu')
    mp.screenshot(path=f'{SHOTS}/phone-login.png')
    mp.fill('#username', 'maria'); mp.fill('#password', 'secret'); mp.click('button[type=submit]')
    mp.wait_for_selector('.hero'); mp.wait_for_function("!document.querySelector('.loading')")
    mp.screenshot(path=f'{SHOTS}/phone-board.png')
    no_hscroll = mp.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
    check('на телефоні немає горизонтальної прокрутки', no_hscroll)
    mp.evaluate("window.scrollTo(0, document.querySelector('.band-month').offsetTop - 10)")
    mp.screenshot(path=f'{SHOTS}/phone-month.png')

    # 7б. Поріг «горить» з адреси
    mp.goto(APP + '?burnDays=7'); mp.wait_for_selector('.hero'); mp.wait_for_function("!document.querySelector('.loading')")
    n7 = mp.locator('.card.is-burning').count()
    check(f'?burnDays=7 підпалює весь тиждень ({n7})', n7 >= 4)

    # 8. Застарілий токен → назад на вхід
    mp.evaluate("localStorage.setItem('md.token', JSON.stringify('EXPIRED'))")
    mp.reload()
    mp.wait_for_selector('.error:has-text("Доступ застарів")', timeout=15000)
    check('застарілий токен повертає на вхід із поясненням', True)

    real_errors = [e for e in errors if 'fonts.g' not in e and 'ERR_FAILED' not in e]
    check(f'немає помилок у консолі {real_errors}', not real_errors)
    check('викликалися лише функції читання', all('_get_' in c for c in calls))
    b.close()

srv.shutdown()
failed = [n for n, ok in results if not ok]
print(f'\n{len(results) - len(failed)}/{len(results)} passed')
sys.exit(1 if failed else 0)
