const CACHE_NAME = 'vitkovice-quest-v5';
// Knihovny (Leaflet, QR) jsou zabaleny přímo v index.html – cache je jen app shell + ikony.
const APP_SHELL = [
    './',
    './index.html',
    './manifest.webmanifest',
    './icon-192.png',
    './icon-512.png'
];
const TILE_CACHE = 'vtq-tiles-v1';
const TILE_HOSTS = ['tile.openstreetmap.org'];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME)
            .then((c) =>
                // Každý soubor přidáváme zvlášť – chybějící soubor (404) nerozbije celou offline cache.
                Promise.allSettled(APP_SHELL.map((u) => c.add(u)))
            )
            .then(() => self.skipWaiting())
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