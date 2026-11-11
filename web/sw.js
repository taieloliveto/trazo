/* Service worker de Sprinty: la app abre sin conexión. Siempre intenta primero la red para correr el código más nuevo. */
const V = 'sprinty-v1';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'merge.js', 'config.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // la API nunca se guarda
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(V).then(c => c.put('index.html', copy)); return r; }).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.open(V).then(async c => {
    try { const r = await fetch(req); if (r && r.ok) c.put(req, r.clone()); return r; }
    catch (err) { const hit = await c.match(req); if (hit) return hit; throw err; }
  }));
});
