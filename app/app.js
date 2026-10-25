/* NYC Honor Classes: app shell.

   PRIVACY (the audience is high-school players, many under 18):
   - Progress, quiz scores and the money tools' numbers live in localStorage on the device ONLY (key nyh_app_v1).
   - No accounts. No analytics. No third-party requests. The only network traffic is same-origin
     requests for this app's own static files (and a lesson video, if the player taps play).
   - Nothing a kid types is ever sent anywhere. There is no code in this app that could send it.

   STRUCTURE: data/classes.json is the library. Each class has a kind ('lessons', 'tools', 'soon').
   To add a class, add an entry there plus its data files; add a renderer here only for a new kind.
   Opening a class saves its listed files for offline use (Cache API, cache 'nyh-class-v1'). */
(function () {
    'use strict';

    var STORE_KEY = 'nyh_app_v1';
    var CLASS_CACHE = 'nyh-class-v1';
    var main = document.getElementById('main');
    var barTitle = document.getElementById('bar-title');
    var backBtn = document.getElementById('back');
    var catalog = null;
    var deferredInstall = null;

    /* ---------- tiny helpers ---------- */
    function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function el(tag, attrs, html) {
        var n = document.createElement(tag);
        if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
        if (html != null) n.innerHTML = html;
        return n;
    }
    function toast(msg) {
        var t = document.getElementById('toast');
        t.textContent = msg; t.classList.add('show');
        clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 2600);
    }

    /* ---------- storage: never throws, works without it ---------- */
    var memory = null;
    function load() {
        if (memory) return memory;
        var s = null;
        try { s = JSON.parse(window.localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { s = null; }
        if (!s || typeof s !== 'object' || s.v !== 1) s = { v: 1 };
        s.lessons = s.lessons || {}; s.cached = s.cached || {};
        memory = s; return s;
    }
    function save() {
        try { window.localStorage.setItem(STORE_KEY, JSON.stringify(memory)); return true; } catch (e) { return false; }
    }
    window.HonorStore = { load: load, save: save };

    /* ---------- offline: save a class's files the first time it is opened ---------- */
    function saveClassOffline(cls) {
        if (!('caches' in window) || !cls.cache) return Promise.resolve(false);
        var urls = cls.cache.map(function (p) { return new URL(p, document.baseURI).href; });
        return caches.open(CLASS_CACHE).then(function (c) {
            return Promise.all(urls.map(function (u) {
                return c.match(u).then(function (hit) { return hit || c.add(u); });
            }));
        }).then(function () {
            var s = load();
            if (!s.cached[cls.id]) { s.cached[cls.id] = Date.now(); save(); toast('Saved for offline: ' + cls.title); }
            return true;
        }).catch(function () { return false; });
    }

    function getJSON(path) { return fetch(path).then(function (r) { if (!r.ok) throw new Error(path); return r.json(); }); }
    function classById(id) { return (catalog.classes || []).filter(function (c) { return c.id === id; })[0]; }

    /* ---------- chrome ---------- */
    var homeTitle = document.title; // the search title in index.html; the home screen keeps it
    function setChrome(title, showBack, backHref) {
        barTitle.textContent = title || 'Honor Classes';
        document.title = (title && title !== 'Honor Classes') ? title + ' | NYC Honor Classes' : homeTitle;
        backBtn.hidden = !showBack;
        backBtn.onclick = function () { location.hash = backHref || '#/'; };
    }
    function done(node) {
        main.innerHTML = ''; main.appendChild(node);
        window.scrollTo(0, 0);
        main.focus({ preventScroll: true });
    }

    /* ---------- home ---------- */
    function pct(cls) {
        if (cls.kind !== 'lessons') return null;
        var s = load(), n = 0;
        Object.keys(s.lessons).forEach(function (k) { if (s.lessons[k].done) n++; });
        return n;
    }
    function installBox() {
        var box = el('div', { 'class': 'install', id: 'install-box' });
        var standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
        if (standalone) return null;
        var ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        box.innerHTML = '<p><b>Put it on your home screen.</b> It opens like an app and works with no signal once a class has been opened.</p>' +
            '<button type="button" class="btn" id="install-btn" hidden>Install the app</button>';
        if (ios) {
            box.innerHTML = '<p><b>On iPhone:</b> tap the Share button <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="vertical-align:-3px"><path d="M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 00-1 1v8a1 1 0 001 1h14a1 1 0 001-1v-8a1 1 0 00-1-1h-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> in Safari, then <b>Add to Home Screen</b>.</p>';
        }
        var btn = box.querySelector('#install-btn');
        if (btn) {
            btn.addEventListener('click', function () {
                if (!deferredInstall) return;
                deferredInstall.prompt();
                deferredInstall.userChoice.then(function () { deferredInstall = null; btn.hidden = true; });
            });
            if (deferredInstall) btn.hidden = false;
        }
        if (!ios && !deferredInstall) box.hidden = true; // desktop browser with no install offer: say nothing
        return box;
    }

    function renderHome() {
        setChrome('Honor Classes', false);
        var wrap = el('div');
        wrap.innerHTML = '<div class="hello"><h1>Free classes.<br><span>Keep what you earn.</span></h1>' +
            '<p class="lede">Short lessons from NYC Honor Foundation for high-school athletes. Tap a class to open it.</p></div>';
        // Course trailer: the same 33-second film as /academy. Network only (sw.js skips mp4), so it never fills the phone.
        wrap.appendChild(el('div', { 'class': 'video trailer' },
            '<video controls playsinline preload="none" poster="../assets/film/posters/nil-course-trailer-v2.jpg" aria-label="Secure the Bag course trailer">' +
            '<source src="../assets/film/nil-course-trailer.mp4" type="video/mp4">' +
            '<track kind="captions" src="../assets/film/nil-course-trailer.vtt" srclang="en" label="English" default></video>' +
            '<p class="vn">33-second look at the course. Needs a connection.</p>'));
        var ib = installBox(); if (ib) wrap.appendChild(ib);

        var tiles = el('div', { 'class': 'tiles' });
        var soon = el('div', { 'class': 'soon-row' });
        var n = 0;
        catalog.classes.forEach(function (c) {
            if (c.kind === 'soon') {
                soon.appendChild(el('div', { 'class': 'soon' }, '<b>' + esc(c.title) + '</b><span>' + esc(c.sub) + '</span><em>Coming soon</em>'));
                return;
            }
            n++;
            var a = el('a', { 'class': 'tile ' + c.tone, href: '#/' + c.id });
            var p = pct(c), total = 7;
            var state = c.kind === 'lessons' ? (p ? p + ' of ' + total + ' lessons done' : (load().cached[c.id] ? 'Saved offline' : 'Start here'))
                : (load().cached[c.id] ? 'Saved offline' : 'Open it');
            a.innerHTML = '<span class="tn" aria-hidden="true">' + (c.kind === 'lessons' ? '7' : '3') + '</span>' +
                '<h2>' + esc(c.title) + '</h2><p class="sub">' + esc(c.sub) + '</p><p class="blurb">' + esc(c.blurb) + '</p>' +
                '<span class="state">' + esc(state) + '</span>' +
                (c.kind === 'lessons' ? '<span class="meter" aria-hidden="true"><i style="width:' + Math.round((p || 0) / total * 100) + '%"></i></span>' : '');
            a.setAttribute('aria-label', c.title + '. ' + c.sub + '. ' + state);
            tiles.appendChild(a);
        });
        wrap.appendChild(tiles);
        wrap.appendChild(el('h2', null, 'More classes on the way'));
        wrap.appendChild(soon);

        // Sponsors spot: the ask only. No sponsor is named anywhere in the app (Eslyn, Oct 24 2026);
        // sponsor credits live on nychonor.org. Lessons never show a sponsor (the course hub promises
        // "No sponsor's name appears on a lesson").
        var sp = catalog.sponsors, mail = 'mailto:' + sp.ask.email + '?subject=' + encodeURIComponent(sp.ask.subject);
        var box = el('section', { 'class': 'sponsors', 'aria-labelledby': 'sp-h' });
        box.innerHTML = '<h2 id="sp-h">Sponsors</h2>' +
            '<div class="ask"><h3>' + esc(sp.ask.title) + ': ' + esc(sp.ask.line.toLowerCase()) + '</h3><p>' + esc(sp.ask.detail) + '</p>' +
            (sp.ask.detail2 ? '<p>' + esc(sp.ask.detail2) + '</p>' : '') +
            '<a class="btn" href="' + esc(mail) + '">Ask about sponsoring</a></div>';
        wrap.appendChild(box);
        wrap.appendChild(el('p', { 'class': 'foot' }, 'Built by NYC Honor Foundation volunteers. Educational content only, not tax, legal or investment advice. Your progress and answers stay on this phone. This app has no accounts and sends nothing about you anywhere.'));
        done(wrap);
    }

    /* ---------- NIL course ---------- */
    function renderNilList(cls) {
        setChrome(cls.title, true, '#/');
        saveClassOffline(cls);
        getJSON(cls.index).then(function (idx) {
            var s = load();
            var wrap = el('div');
            wrap.innerHTML = '<p class="crumb">NYC Honor Academy</p><h1>' + esc(cls.title) + '</h1><p class="lede">' + esc(cls.blurb) + ' Each lesson is about ten minutes, with a short video and a quiz at the end.</p>';
            var ul = el('ul', { 'class': 'lessons' });
            idx.lessons.forEach(function (L) {
                var st = s.lessons[L.id] || {};
                var chip = st.done ? '<span class="chip gold">' + st.best + '/' + st.total + '</span>' : '<span class="chip">' + (L.minutes || '10') + ' min</span>';
                var li = el('li');
                li.innerHTML = '<a class="lrow" href="#/nil/' + L.id + '"><span class="num" aria-hidden="true">' + L.id + '</span>' +
                    '<span><b>' + esc(L.title) + '</b><span class="m">' + esc(L.tagline) + '</span></span>' + chip + '</a>';
                ul.appendChild(li);
            });
            wrap.appendChild(ul);
            wrap.appendChild(el('p', { 'class': 'foot' }, 'These are the same lessons as nychonor.org/academy, copied from the published pages. The lessons are free to copy and adapt for class under CC BY-NC-SA 4.0.'));
            done(wrap);
        }).catch(function () { done(offlineMsg()); });
    }

    function offlineMsg() {
        return el('div', { 'class': 'pad' }, '<h2>Not saved yet</h2><p>This class needs a connection the first time you open it. Once it loads, it works with no signal.</p><a class="btn" href="#/">Back to classes</a>');
    }

    function renderBlock(b) {
        switch (b.t) {
            case 'h2': return '<h2>' + b.html + '</h2>';
            case 'h3': return '<h3>' + b.html + '</h3>';
            case 'lead': return '<p class="lead">' + b.html + '</p>';
            case 'note': return '<p class="note">' + b.html + '</p>';
            case 'math': return '<p class="math">' + b.html + '</p>';
            case 'p': return '<p>' + b.html + '</p>';
            case 'list': return '<' + (b.ordered ? 'ol' : 'ul') + (b.flags ? ' class="flags"' : '') + '>' + b.items.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</' + (b.ordered ? 'ol' : 'ul') + '>';
            case 'quote': return '<blockquote class="q">' + b.html + (b.cite ? '<cite>' + b.cite + '</cite>' : '') + '</blockquote>';
            case 'keys': return '<div class="keys"><h3>' + esc(b.title) + '</h3><dl>' + b.pairs.map(function (p) { return '<dt>' + p[0] + '</dt><dd>' + p[1] + '</dd>'; }).join('') + '</dl></div>';
            case 'table': return '<div class="twrap" tabindex="0" role="region" aria-label="' + esc(b.caption || 'Table') + '"><table><caption class="sr">' + esc(b.caption) + '</caption><thead><tr>' +
                b.head.map(function (h) { return '<th scope="col">' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
                b.rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
        }
        return '';
    }

    function quizEl(L, qs, mode) {
        var graded = mode === 'film';
        var sec = el('section', { 'class': 'quiz ' + (graded ? 'film' : 'warm'), 'aria-labelledby': 'qh-' + mode });
        var total = qs.length, answered = 0, right = 0;
        sec.innerHTML = (graded ? '<span class="qscore" id="qs" aria-live="polite">0 / ' + total + '</span>' : '') +
            '<h2 id="qh-' + mode + '">' + (graded ? 'Film Room' : 'Warm-up: 3 quick questions') + '</h2>' +
            '<p class="small">' + (graded ? 'Three calls and one in overtime. Make the call, then see why.' : 'Optional. Take your best guess before the lesson. You will find out in the lesson.') + '</p>';
        var result = el('div', { 'class': 'result', tabindex: '-1', hidden: '' });
        qs.forEach(function (q, qi) {
            var c = el('div', { 'class': 'call' });
            c.innerHTML = '<p class="ql">' + esc(q.label) + '</p><p class="qq">' + q.q + '</p>';
            var ch = el('div', { 'class': 'choices', role: 'group', 'aria-label': q.label });
            q.choices.forEach(function (o) {
                var b = el('button', { type: 'button', 'class': 'choice' });
                b.textContent = o.text;
                b.addEventListener('click', function () {
                    if (c._done) return; c._done = true; answered++;
                    var ok = o.id === q.answer;
                    Array.prototype.forEach.call(ch.children, function (x, i) {
                        x.disabled = true;
                        if (graded) {
                            if (q.choices[i].id === q.answer) x.classList.add('right');
                            else if (x === b) x.classList.add('wrong');
                        } else if (x === b) x.classList.add('picked');
                    });
                    var v = c.querySelector('.verdict');
                    if (graded) {
                        if (ok) right++;
                        v.className = 'verdict ' + (ok ? 'good' : 'bad');
                        v.textContent = ok ? (q.overtime ? 'Buzzer beater.' : 'Good call.') : (q.overtime ? 'Blocked.' : 'Not this one.');
                        if (q.why) c.querySelector('.why').hidden = false;
                        sec.querySelector('#qs').textContent = right + ' / ' + total;
                    } else {
                        v.textContent = 'Got it. You will see the answer in the lesson.';
                    }
                    if (answered === total) finish();
                });
                ch.appendChild(b);
            });
            c.appendChild(ch);
            c.appendChild(el('p', { 'class': 'verdict', 'aria-live': 'polite' }));
            if (q.why && graded) { var w = el('p', { 'class': 'why' }, q.why); w.hidden = true; c.appendChild(w); }
            sec.appendChild(c);
        });
        sec.appendChild(result);
        function finish() {
            if (!graded) return;
            var s = load(), prev = s.lessons[L.id] || {};
            s.lessons[L.id] = { done: 1, best: Math.max(prev.best || 0, right), total: total, last: right, at: Date.now() };
            var saved = save();
            var line = right === total ? 'Perfect game. You ran the film clean.' : right >= total - 1 ? 'Good game. Reread the one you missed and run it back.' : 'Run it back. Reread the lesson above, then try the calls again.';
            result.innerHTML = '<b class="big">' + right + ' / ' + total + '</b><p>' + line + '</p>' +
                (saved ? '<p class="small">Saved on this phone.</p>' : '<p class="small">This browser is not saving progress (private mode or blocked storage).</p>') +
                '<div class="mark"><button type="button" class="btn ghost" id="again">Run it back</button><a class="btn" href="#/nil">All lessons</a></div>';
            result.hidden = false; result.focus();
            result.querySelector('#again').addEventListener('click', function () { renderLesson(L.id, true); });
        }
        return sec;
    }

    function renderLesson(id) {
        var cls = classById('nil');
        setChrome('Lesson ' + id, true, '#/nil');
        saveClassOffline(cls);
        getJSON('data/nil/' + id + '.json').then(function (L) {
            setChrome(L.title, true, '#/nil');
            var wrap = el('article', { 'class': 'lesson' });
            var head = el('header', { 'class': 'lhead' });
            head.innerHTML = '<p class="kick">Lesson ' + esc(L.id) + ' of 7 &middot; about ' + esc(L.minutes) + ' minutes</p><h1>' + esc(L.title) + '</h1>' +
                '<p class="tag">' + esc(L.tagline) + '</p><p class="lede">' + L.intro + '</p><p class="stamp">' + esc(L.updated) + '</p>';
            wrap.appendChild(head);

            var v = el('div', { 'class': 'video' });
            if (L.video) {
                var base = '../';
                v.innerHTML = '<h2>' + esc(L.video.title) + '</h2>' +
                    '<video controls playsinline preload="none" poster="' + base + esc(L.video.poster) + '" aria-label="' + esc(L.video.caption) + '">' +
                    '<source src="' + base + esc(L.video.file) + '" type="video/mp4">' +
                    (L.video.vtt ? '<track kind="captions" src="' + base + esc(L.video.vtt) + '" srclang="en" label="English" default>' : '') + '</video>' +
                    '<p class="vn">' + L.video.note + ' <span class="small">Videos need a connection; the lesson text below works offline.</span></p>' +
                    (L.youtube ? '<p class="vlinks"><a href="https://www.youtube.com/watch?v=' + esc(L.youtube) + '" target="_blank" rel="noopener">Watch on YouTube</a></p>' : '');
            } else {
                v.innerHTML = '<p class="novid">No video for this lesson yet. The lesson is written out below.</p>';
            }
            wrap.appendChild(v);

            if (L.warmup && L.warmup.length) wrap.appendChild(quizEl(L, L.warmup, 'warm'));
            var prose = el('div', { 'class': 'prose' }, L.blocks.map(renderBlock).join(''));
            wrap.appendChild(prose);
            if (L.filmroom && L.filmroom.length) wrap.appendChild(quizEl(L, L.filmroom, 'film'));
            if (L.hasTryItOnSite) {
                wrap.appendChild(el('p', { 'class': 'small' }, 'This lesson also has a hands-on "Try it" on the website: <a href="' + esc(L.onSite) + '#try-it" target="_blank" rel="noopener">open it on nychonor.org</a>.' +
                    (L.id === '03' ? ' In this app, the Money Tools class has the same tax math.' : '')));
            }
            wrap.appendChild(el('p', { 'class': 'disc' }, L.disclaimer));
            var nxt = parseInt(L.id, 10) + 1;
            var nav = el('div', { 'class': 'mark' });
            nav.innerHTML = '<a class="btn ghost" href="#/nil">All lessons</a>' + (nxt <= 7 ? '<a class="btn" href="#/nil/0' + nxt + '">Next lesson</a>' : '');
            wrap.appendChild(nav);
            done(wrap);
            var h1 = wrap.querySelector('h1'); if (h1) { h1.setAttribute('tabindex', '-1'); }
        }).catch(function () { done(offlineMsg()); });
    }

    /* ---------- Money Tools: logic lives in money.js, loaded when the class opens ---------- */
    function loadScript(src) {
        return new Promise(function (res, rej) {
            if (document.querySelector('script[data-src="' + src + '"]')) return res();
            var s = document.createElement('script');
            s.src = src; s.setAttribute('data-src', src); s.onload = res; s.onerror = rej; document.head.appendChild(s);
        });
    }
    function renderTools(cls, tool) {
        setChrome(cls.title, true, '#/');
        saveClassOffline(cls);
        Promise.all([loadScript('../nil-tax-engine.js'), loadScript(cls.script)]).then(function () {
            var wrap = el('div');
            wrap.innerHTML = '<p class="crumb">NYC Honor Academy</p><h1>' + esc(cls.title) + '</h1><p class="lede">' + esc(cls.blurb) + '</p>';
            var tabs = el('nav', { 'class': 'tabs', 'aria-label': 'Tools' });
            [['tax', 'Tax set-aside'], ['budget', 'Monthly split'], ['goal', 'Savings goal']].forEach(function (t) {
                var a = el('a', { 'class': 'tab', href: '#/money/' + t[0] }); a.textContent = t[1];
                if (t[0] === tool) a.setAttribute('aria-current', 'page');
                tabs.appendChild(a);
            });
            wrap.appendChild(tabs);
            var host = el('div');
            wrap.appendChild(host);
            window.HonorMoney.render(host, tool, { load: load, save: save, esc: esc, el: el, toast: toast });
            done(wrap);
        }).catch(function () { done(offlineMsg()); });
    }

    /* ---------- router ---------- */
    function route() {
        if (!catalog) return;
        var parts = (location.hash || '#/').replace(/^#\/?/, '').split('/').filter(Boolean);
        var id = parts[0];
        if (!id) return renderHome();
        var cls = classById(id);
        if (!cls || cls.kind === 'soon') return renderHome();
        if (cls.kind === 'lessons') return parts[1] && /^0[1-7]$/.test(parts[1]) ? renderLesson(parts[1]) : renderNilList(cls);
        if (cls.kind === 'tools') return renderTools(cls, ['tax', 'budget', 'goal'].indexOf(parts[1]) >= 0 ? parts[1] : 'tax');
        renderHome();
    }

    /* ---------- install + offline + service worker ---------- */
    window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault(); deferredInstall = e;
        var box = document.getElementById('install-box'), b = document.getElementById('install-btn');
        if (box) box.hidden = false; if (b) b.hidden = false;
    });
    window.addEventListener('appinstalled', function () { deferredInstall = null; var b = document.getElementById('install-box'); if (b) b.hidden = true; toast('Installed'); });
    function net() { document.getElementById('net').hidden = navigator.onLine; }
    window.addEventListener('online', net); window.addEventListener('offline', net);

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
            navigator.serviceWorker.register('sw.js', { scope: './' }).catch(function () {});
        });
    }

    window.addEventListener('hashchange', route);
    getJSON('data/classes.json').then(function (c) { catalog = c; net(); route(); })
        .catch(function () { main.innerHTML = ''; main.appendChild(offlineMsg()); });
})();
