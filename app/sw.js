// Offline support: cache the app on first visit so students can use it without internet.
const CACHE = 'ccbb-v3';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon.svg', './ui/style.css', './ui/main.js', './ui/catalog.js', './ui/info.js', './ui/custom-parts.js',
  './engine/solver.js', './engine/circuit.js', './engine/arduino.js', './engine/boards.js', './engine/environment.js', './engine/analysis.js', './lab.html', './ui/lab.js', './ui/lab.css', './ui/lab-templates.js', './ui/assistant.js', '../vendor/wokwi-elements.bundle.js'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
// network first (always get updates when online), cache as fallback when offline
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
