/* Menu-only script for student pages (Budget Simulator; Eslyn, Oct 25 2026).
   The site-wide main.js also records where a visitor came from (nyh_src, nyh_land, nyh_last,
   nyh_ref in localStorage) so a later donation can be credited. Student pages promise to save
   nothing, so they load this file instead: the menu and the nav bar behavior only.
   No storage, no cookies, no network requests. Keep it that way. */
function toggleMenu() {
    var menu = document.getElementById('mobile-menu'), btn = document.getElementById('hamburger');
    btn.classList.toggle('open');
    menu.classList.toggle('show');
    var isOpen = menu.classList.contains('show');
    btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
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

/* On phones the fixed bar slides away while scrolling down and comes back on scroll up.
   Never hidden near the top of the page or while the menu is open. */
(function () {
    var lastY = window.scrollY;
    window.addEventListener('scroll', function () {
        var nav = document.getElementById('nav');
        if (!nav) return;
        var y = window.scrollY;
        nav.classList.toggle('scrolled', y > 40);
        var menu = document.getElementById('mobile-menu');
        var menuOpen = menu && menu.classList.contains('show');
        var phone = window.matchMedia('(max-width: 899px)').matches;
        if (!phone || menuOpen || y < 120) nav.classList.remove('nav-away');
        else if (y > lastY + 6) nav.classList.add('nav-away');
        else if (y < lastY - 6) nav.classList.remove('nav-away');
        lastY = y;
    }, { passive: true });
})();

/* Scroll reveal, in case a student page uses .reveal blocks. */
document.addEventListener('DOMContentLoaded', function () {
    var els = document.querySelectorAll('.reveal');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('visible'); }); return; }
    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
        });
    }, { threshold: 0.15 });
    els.forEach(function (e) { observer.observe(e); });
});
