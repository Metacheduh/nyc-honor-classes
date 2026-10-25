/* NYC Honor Classes: service worker.
   - Install: saves the app shell (page, styles, script, icons, the site's own fonts, the class list).
   - Fetch: same-origin GETs answer from the cache first and refresh in the background, so the app opens
     with no signal. Lesson text and tool code are added to cache 'nyh-class-v1' by app.js the first time a
     class is opened. Videos and other range requests are never cached (too big; they need a connection).
   - Nothing here reads or sends anything a kid types; it only handles static files.
   Bump VERSION to push a new shell to everyone. */
const VERSION = 'v3';
const SHELL = 'nyh-shell-' + VERSION;
const CLASS_CACHE = 'nyh-class-v1';
const SHELL_FILES = [
  './', 'index.html', 'app.css', 'app.js', 'manifest.webmanifest',
  'data/classes.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  '../fonts/fonts.css', '../fonts/inter-latin.woff2', '../fonts/inter-latin-ext.woff2',
  '../fonts/jetbrains-mono-latin.woff2', '../fonts/jetbrains-mono-latin-ext.woff2',
  '../assets/nyc-honor-crest-nav.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k.startsWith('nyh-shell-') && k !== SHELL).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;           // never touch third-party requests
  if (req.headers.has('range') || /\.(mp4|vtt)$/i.test(url.pathname)) return; // video: network only
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    const refresh = fetch(req).then(async (res) => {
      if (res && res.ok && res.type === 'basic') {
        const inClass = url.pathname.includes('/app/data/') || url.pathname.endsWith('/app/money.js') || url.pathname.endsWith('nil-tax-engine.js');
        const c = await caches.open(inClass ? CLASS_CACHE : SHELL);
        c.put(req, res.clone());
      }
      return res;
    }).catch(() => null);
    if (hit) { e.waitUntil(refresh); return hit; }
    const res = await refresh;
    if (res) return res;
    if (req.mode === 'navigate') {
      const shell = await caches.match('index.html');
      if (shell) return shell;
    }
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  })());
});
