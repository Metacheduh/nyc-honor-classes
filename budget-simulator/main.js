/* ── Mobile Menu ── */
function toggleMenu() {
    document.getElementById('hamburger').classList.toggle('open');
    document.getElementById('mobile-menu').classList.toggle('show');
    var isOpen = document.getElementById('mobile-menu').classList.contains('show');
    document.getElementById('hamburger').setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    document.body.style.overflow = isOpen ? 'hidden' : '';
}

function closeMenu() {
    document.getElementById('hamburger').classList.remove('open');
    document.getElementById('mobile-menu').classList.remove('show');
    document.getElementById('hamburger').setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
}

/* Tell screen readers the menu button opens the mobile menu, and that it starts closed. */
(function () {
    var btn = document.getElementById('hamburger');
    if (!btn || !document.getElementById('mobile-menu')) return;
    btn.setAttribute('aria-controls', 'mobile-menu');
    btn.setAttribute('aria-expanded', 'false');
})();

/* ── Nav Scroll Effect ──
   On phones the fixed bar slides away while the visitor scrolls down, so it never sits over the
   text being read, and comes back the moment they scroll up. Never hidden near the top of the
   page or while the menu is open. */
(function () {
    let lastY = window.scrollY;
    window.addEventListener('scroll', () => {
        const nav = document.getElementById('nav');
        if (!nav) return;
        const y = window.scrollY;
        nav.classList.toggle('scrolled', y > 40);
        const menu = document.getElementById('mobile-menu');
        const menuOpen = menu && menu.classList.contains('show');
        const phone = window.matchMedia('(max-width: 899px)').matches;
        if (!phone || menuOpen || y < 120) nav.classList.remove('nav-away');
        else if (y > lastY + 6) nav.classList.add('nav-away');
        else if (y < lastY - 6) nav.classList.remove('nav-away');
        lastY = y;
    }, { passive: true });
})();

/* ── Scroll Reveal ── */
document.addEventListener('DOMContentLoaded', () => {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    
    /* ── GSAP Animations ── */
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
        gsap.registerPlugin(ScrollTrigger);
        
        // Stats Counter Animation
        const stats = document.querySelectorAll('.gsap-stat');
        if (stats.length > 0) {
            ScrollTrigger.create({
                trigger: '.stats-bar',
                start: 'top 80%',
                once: true,
                onEnter: () => {
                    stats.forEach(stat => {
                        const target = parseInt(stat.getAttribute('data-target'));
                        gsap.to(stat, {
                            innerHTML: target,
                            duration: 2,
                            ease: 'power3.out',
                            snap: { innerHTML: 1 },
                            onUpdate: function() {
                                stat.innerHTML = Math.ceil(this.targets()[0].innerHTML);
                            }
                        });
                    });
                }
            });
        }
        

    }
});

/* Attribution, sitewide. Four keys, because one was never enough.

   nyh_src / nyh_land  FIRST touch. Written once and never overwritten, so a gift still
                       credits the search engine or link that originally found us.
   nyh_last            LAST touch. Overwritten on every page carrying ?src= or utm_source,
                       so the internal hop from the calculator to the donate page survives.
   nyh_ref             the same-site page they came from, which attributes the nav donate
                       links that carry no tag at all.

   Why nyh_last exists: every ?src= on this site used to be discarded. This block ran on the
   calculator first and set nyh_src there, so by the time the visitor clicked through to
   /donate?src=calc the guard below returned early and the tag was thrown away. Every
   calculator gift was filed as "direct". The last-touch write therefore has to happen
   BEFORE that guard, not after it.

   create-checkout.js copies all four into the Stripe session metadata; stripe-webhook.js
   writes them to Airtable. */
(function () {
    try {
        var q = new URLSearchParams(location.search);
        var s = q.get('utm_source'), m = q.get('utm_medium'), c = q.get('utm_campaign'),
            g = q.get('src'), src;

        /* ---- last touch: always overwrite, and it must precede the first-touch guard ---- */
        var last = s ? (s + (m ? ' / ' + m : '') + (c ? ' / ' + c : '')) : (g || '');
        if (last) localStorage.setItem('nyh_last', last.slice(0, 120));

        try {
            if (document.referrer) {
                var r = new URL(document.referrer);
                if (r.hostname === location.hostname) {
                    localStorage.setItem('nyh_ref', (r.pathname || '/').slice(0, 80));
                }
            }
        } catch (e) { /* malformed referrer: skip the referring-page key only */ }

        /* ---- first touch: unchanged, still write-once ---- */
        if (localStorage.getItem('nyh_src')) return;
        if (s) {
            src = s + (m ? ' / ' + m : '') + (c ? ' / ' + c : '');
        } else if (document.referrer) {
            var h = new URL(document.referrer).hostname.replace(/^www\./, '');
            src = (h === location.hostname) ? (g ? 'site / ' + g : 'direct') : h + ' / referral';
        } else if (g) {
            src = 'site / ' + g;
        } else {
            src = 'direct';
        }
        localStorage.setItem('nyh_src', src.slice(0, 120));
        localStorage.setItem('nyh_land', (location.pathname || '/').slice(0, 80));
    } catch (e) { /* private mode: checkout falls back to 'direct' */ }
})();

/* Last touch for untagged donate links. A /donate link with no ?src= used to leave nyh_last
   holding whatever tag an earlier page set, so a nav click could be credited to a calculator
   visited days ago. On click, an untagged donate link now records the page it was clicked
   on (e.g. "/players"). Tagged links are left alone: the donate page writes their src above. */
document.addEventListener('click', function (e) {
    try {
        var a = e.target && e.target.closest && e.target.closest('a[href]');
        if (!a) return;
        var u = new URL(a.href, location.href);
        if (u.hostname !== location.hostname || !/^\/donate(\.html)?\/?$/.test(u.pathname)) return;
        if (u.searchParams.get('src') || u.searchParams.get('utm_source')) return;
        if (/^\/donate(\.html)?\/?$/.test(location.pathname)) return;   /* already on it */
        localStorage.setItem('nyh_last', (location.pathname || '/').slice(0, 120));
    } catch (err) { /* private mode or old browser: keep the previous value */ }
});

/* Read an attribution key. Defined here rather than in each page so the donate page and
   every other page share one implementation. */
function nyhAttr(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }
