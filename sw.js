const CACHE_NAME = 'vitkovice-quest-v1';
const APP_SHELL = [
    './',
    './index.html',
    './lib/leaflet.css',
    './lib/leaflet.js',
    './lib/html5-qrcode.min.js',
    './lib/qrcode.js',
    './manifest.webmanifest',
    './icon-192.png',
    './icon-512.png'
];
const TILE_CACHE = 'vtq-tiles-v1';
const TILE_HOSTS = ['tile.openstreetmap.org'];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME)
            .then((c) => c.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
            .catch(() => {})
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(caches.keys().then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME && k !== TILE_CACHE).map((k) => caches.delete(k))
    )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    const isTile = TILE_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith('.' + h));

    if (isTile) {
        // Mapové dlaždice: cache-first (v terénu bez signálu použije dříve stažené)
        e.respondWith(
            caches.open(TILE_CACHE).then((cache) => cache.match(req).then((hit) => {
                const fetchPromise = fetch(req).then((res) => {
                    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
                    return res;
                }).catch(() => hit);
                return hit || fetchPromise;
            }))
        );
        return;
    }

    if (url.origin === self.location.origin) {
        // Aplikace a knihovny: cache-first s aktualizací na pozadí
        e.respondWith(
            caches.match(req).then((hit) => {
                const fetchPromise = fetch(req).then((res) => {
                    if (res && res.ok) {
                        caches.open(CACHE_NAME).then((c) => c.put(req, res.clone()));
                    }
                    return res;
                }).catch(() => hit);
                return hit || fetchPromise;
            })
        );
    }
});