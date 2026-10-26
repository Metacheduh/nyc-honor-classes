"""Headless audit of the NYC Honor Classes app and Budget Simulator.
Needs Python Playwright (pip install playwright; playwright install chromium).
Run from the repo root with a local server going (python3 -m http.server 8000):
    python3 tests/e2e.py http://127.0.0.1:8000 no-films
"no-films" ignores 404s for the lesson films, which live on nychonor.org, not in this repo.
Prints PASS/FAIL lines; exits 1 on any FAIL."""
import sys, os, json, re
from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip('/')
fails = []
def check(ok, msg):
    print(('PASS ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 375, 'height': 812}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    errors, bad = [], []
    # The lesson films live on nychonor.org, not in the public repo, so a local copy 404s on them.
    FILM_LOCAL = len(sys.argv) > 2 and sys.argv[2] == 'no-films'
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' and not (FILM_LOCAL and '404' in m.text) else None)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('response', lambda r: bad.append(f'{r.status} {r.url}') if r.status >= 400 and not re.search(r'\.(mp4|vtt|jpg)$', r.url) else None)

    def no_hscroll(label):
        w = page.evaluate('document.documentElement.scrollWidth')
        check(w <= 375, f'{label}: no sideways scroll at 375px (scrollWidth {w})')

    page.goto(BASE + '/app/')
    page.wait_for_selector('.tiles')
    no_hscroll('home')
    txt = page.inner_text('main')
    check('Sirmium' not in txt and 'BigO' not in txt, 'home: no Sirmium/BigO')
    check('not tax, legal or investment advice' in txt, 'home: advice line present')

    # Each lesson: render, quizzes, scoring
    for n in range(1, 8):
        lid = f'{n:02d}'
        L = json.load(open(f'app/data/nil/{lid}.json'))
        page.goto(f'{BASE}/app/#/nil/{lid}')
        page.wait_for_selector('article.lesson h1')
        no_hscroll(f'lesson {lid}')
        body = page.inner_text('main')
        check(not re.search(r'coming soon|TODO|placeholder|lorem|lesson yet|video yet', body, re.I), f'lesson {lid}: no unfinished wording')
        # warm-up: answer every question with the FIRST choice
        warm = page.locator('section.quiz.warm .call')
        check(warm.count() == len(L['warmup']), f'lesson {lid}: {len(L["warmup"])} warm-up questions shown')
        for i in range(warm.count()):
            warm.nth(i).locator('button.choice').first.click()
        # film room: answer all correctly except the last one
        film = page.locator('section.quiz.film .call')
        check(film.count() == len(L['filmroom']), f'lesson {lid}: {len(L["filmroom"])} film-room questions shown')
        for i, q in enumerate(L['filmroom']):
            ids = [c['id'] for c in q['choices']]
            right = ids.index(q['answer'])
            pick = right if i < len(L['filmroom']) - 1 else (right + 1) % len(ids)
            film.nth(i).locator('button.choice').nth(pick).click()
            why = film.nth(i).locator('.why')
            check(why.count() == 1 and why.is_visible(), f'lesson {lid} Q{i+1}: explanation shown after answering')
        total = len(L['filmroom'])
        res = page.locator('section.quiz.film .result')
        check(res.is_visible() and f'{total-1} / {total}' in res.inner_text(), f'lesson {lid}: film room scores {total-1}/{total}')
        warm_right = sum(1 for q in L['warmup'] if q['choices'][0]['id'] == q['answer'])
        check(f'{warm_right} / {len(L["warmup"])}' in res.inner_text(), f'lesson {lid}: result shows warm-up score {warm_right}/{len(L["warmup"])}')
        st = page.evaluate("JSON.parse(localStorage.getItem('nyh_app_v1'))")
        rec = st['lessons'][lid]
        check(rec['best'] == total - 1 and rec['total'] == total and rec.get('warm') == warm_right, f'lesson {lid}: score saved on device')
        check('educational content only' in body.lower() and 'advice' in body.lower(), f'lesson {lid}: disclaimer present')

    page.goto(BASE + '/app/#/nil')
    page.wait_for_selector('ul.lessons')
    check(page.locator('.chip.gold').count() == 7, 'lesson list: all 7 show a saved score')

    # Money tools
    page.goto(BASE + '/app/#/money/tax')
    page.wait_for_selector('#o-total')
    no_hscroll('tax tool')
    page.fill('#cash', '500'); page.fill('#gear', '0')
    check(page.inner_text('#o-total') == '$71', 'tax tool: $500 -> $71 set aside')
    page.fill('#cash', '100'); page.fill('#gear', '200')
    left = page.inner_text('#o-left')
    check(not left.startswith('$-'), f'tax tool: negative cash shown properly ({left})')

    page.goto(BASE + '/app/#/money/budget')
    page.wait_for_selector('#income')
    no_hscroll('budget tool')
    page.fill('#income', '203')
    for k, v in [('saving', 40), ('needs', 90), ('giving', 10), ('wants', 63)]:
        page.eval_on_selector(f'#r-{k}', f'(e)=>{{e.value={v}; e.dispatchEvent(new Event("input"))}}')
    check('Every dollar has a job' in page.inner_text('#left'), 'budget tool: $203 can be fully assigned')
    page.click('#ex')
    check('Every dollar has a job' in page.inner_text('#left') and '$71' in page.inner_text('#dealout'), "budget tool: lesson's plan balances and $500 deal -> $71")

    page.goto(BASE + '/app/#/money/goal')
    page.wait_for_selector('#gform')
    page.fill('#gname', 'Shoes'); page.fill('#gtarget', '120'); page.click('#gform button[type=submit]')
    gid = page.evaluate("JSON.parse(localStorage.getItem('nyh_app_v1')).goals[0].id")
    page.fill(f'#a-{gid}', '50'); page.click(f'[data-add="{gid}"]')
    check('$50 of $120' in page.inner_text('#glist') and '$70 to go' in page.inner_text('#glist'), 'goal tool: $50 of $120, $70 to go')
    page.fill(f'#m-{gid}', '20')
    check('About 4 months' in page.inner_text(f'#mo-{gid}'), 'goal tool: $70 at $20/month = about 4 months')
    focused = page.evaluate('document.activeElement && document.activeElement.id')
    page.fill(f'#a-{gid}', '10'); page.click(f'[data-add="{gid}"]')
    focused = page.evaluate('document.activeElement && document.activeElement.id')
    check(focused == f'a-{gid}', f'goal tool: focus stays on the goal after Add (focus: {focused})')

    # Keyboard: Tab from top reaches skip link first
    page.goto(BASE + '/app/')
    page.wait_for_selector('.tiles')
    page.keyboard.press('Tab')
    check(page.evaluate('document.activeElement.className') == 'skip', 'keyboard: first Tab lands on Skip to content')
    imgs = page.evaluate("[...document.images].filter(i=>!i.hasAttribute('alt')).length")
    check(imgs == 0, 'home: every image has alt')

    # Offline: service worker serves the app once a class was opened
    page.goto(BASE + '/app/#/nil/07'); page.wait_for_selector('article.lesson h1')
    page.goto(BASE + '/app/#/money/tax'); page.wait_for_selector('#o-total')
    page.evaluate("navigator.serviceWorker.ready")
    page.wait_for_timeout(1500)
    page.reload(); page.wait_for_selector('.tiles, #o-total')
    ctx.set_offline(True)
    for route, sel in [('/app/', '.tiles'), ('/app/#/nil/07', 'article.lesson h1'), ('/app/#/money/tax', '#o-total')]:
        try:
            page.goto(BASE + route); page.wait_for_selector(sel, timeout=5000); ok = True
        except Exception as e:
            ok = False
        check(ok, f'offline: {route} opens with no connection')
    ctx.set_offline(False)

    # Manifest
    man = page.evaluate("fetch('manifest.webmanifest').then(r=>r.json())")
    check(any(i['sizes'] == '512x512' and i.get('purpose') == 'maskable' for i in man['icons']) and any(i['sizes'] == '192x192' for i in man['icons']), 'manifest: 192 + 512 maskable icons')

    check(not errors, 'app: no console errors ' + ('; '.join(errors[:5])))
    check(not bad, 'app: no failed requests ' + ('; '.join(bad[:8])))

    # Budget simulator
    errors.clear(); bad.clear()
    sim = ctx.new_page()
    sim.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    sim.on('pageerror', lambda e: errors.append(str(e)))
    sim.goto(BASE + os.environ.get('NYH_SIM_PATH', '/budget-simulator/'))
    sim.wait_for_selector('#p-net')
    w = sim.evaluate('document.documentElement.scrollWidth')
    check(w <= 375, f'simulator: no sideways scroll at 375px ({w})')
    check(sim.eval_on_selector('#wage', 'e=>e.min') == '17', 'simulator: NYC wage slider starts at the $17 minimum')
    check(sim.inner_text('#p-gross') == '$255.00', 'simulator: 15h x $17 = $255.00 gross')
    for sel in ['#p-net', '#b-income', '#ef-msg', '#cc-msg', '#g-16', '#sum-list']:
        check(sim.inner_text(sel).strip() != '', f'simulator: {sel} filled')
    check(sim.locator('#sum-list li').count() == 5, 'simulator: summary has all 5 steps')
    sim.select_option('#region', 'upstate')
    check(sim.eval_on_selector('#wage', 'e=>e.min') == '16', 'simulator: rest-of-state wage minimum $16')
    sim.fill('#ef-goal', '1000'); sim.fill('#ef-start', '400'); sim.fill('#ef-month', '0'); sim.dispatch_event('#ef-month', 'input')
    check('$25 a month' in sim.inner_text('#ef-msg'), 'simulator: emergency hint uses what is left ($600 over 24 months = $25)')
    check(not errors, 'simulator: no console errors ' + ('; '.join(errors[:5])))
    b.close()

print(f'\n{len(fails)} failed')
sys.exit(1 if fails else 0)
