// Service Worker für das App-Gerüst: Build-Dateien und statische Dateien offline verfügbar.
// Audio und Noten eines Titels speichert die Seite selbst (src/lib/offline/title-cache.ts) und
// spielt sie offline als blob:-Adresse; der Service Worker muss so keine Range-Anfragen beantworten.
// Seiten selbst: zuerst Netz, bei Ausfall die zuletzt geladene Fassung.
// Ungeprüft auf iPhone/iPad (Safari räumt Speicher von Home-Bildschirm-Apps eigenmächtig auf).
import { self } from '$app/service-worker';
import { version } from '$app/env';
import { assets, immutable } from '$app/manifest';
import { asset } from '$app/paths';

const PREFIX = 'probelokal-shell-';
const CACHE = PREFIX + version;
const ASSETS = [
	...immutable.map((f) => new URL(f.path, self.registration.scope).pathname),
	...assets.map((f) => asset(f.path))
];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(ASSETS))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))
				)
			)
			.then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return;
	const url = new URL(req.url);
	if (url.origin !== self.location.origin) return;
	// Audio (Weiterleitung auf signierte Storage-Adressen, Range-Anfragen) und Testzugang nie
	// über den Service Worker: Das Gerüst-Cache ist dafür nicht gedacht, Safari ist bei Range heikel.
	if (url.pathname.startsWith('/audio/') || url.pathname === '/zugang') return;

	if (ASSETS.includes(url.pathname)) {
		event.respondWith(caches.match(url.pathname).then((hit) => hit ?? fetch(req)));
		return;
	}

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);
			try {
				const res = await fetch(req);
				const noStore = res.headers.get('cache-control')?.includes('no-store');
				if (res.ok && res.type === 'basic' && !noStore) cache.put(req, res.clone());
				return res;
			} catch (err) {
				const hit = await cache.match(req);
				if (hit) return hit;
				throw err;
			}
		})()
	);
});
