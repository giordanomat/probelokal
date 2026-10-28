import { describe, expect, it } from 'vitest';
import {
	cachedFile,
	storeFile,
	titleCacheName,
	type CacheLike,
	type CacheStorageLike
} from './title-cache';

/** Nachgebautes CacheStorage im Speicher */
function fakeCaches(failPut = false) {
	const stores = new Map<string, Map<string, Response>>();
	const storage: CacheStorageLike = {
		async open(name) {
			let m = stores.get(name);
			if (!m) stores.set(name, (m = new Map()));
			const store = m;
			const cache: CacheLike = {
				async match(key) {
					return store.get(key)?.clone();
				},
				async put(key, res) {
					if (failPut) throw new DOMException('voll', 'QuotaExceededError');
					store.set(key, res);
				}
			};
			return cache;
		}
	};
	return { storage, stores };
}

const PATH = '/audio/bad-touch-2-0/schuegu27/minus_trp1.mp3';

describe('Offline-Speicher pro Titel', () => {
	it('ein Cache pro Titel und Fassung', () => {
		expect(titleCacheName('bad-touch-2-0', 'Schuegu27')).toBe(
			'probelokal-titel-bad-touch-2-0-schuegu27'
		);
	});

	it('speichert unter dem /audio/-Pfad und lädt nur einmal', async () => {
		const { storage } = fakeCaches();
		let calls = 0;
		const f = (async () => {
			calls++;
			return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'audio/mpeg' } });
		}) as typeof fetch;
		expect(await cachedFile(storage, 'c', PATH)).toBeNull();
		expect(await storeFile(storage, 'c', PATH, f)).toBe(true);
		expect(await storeFile(storage, 'c', PATH, f)).toBe(true);
		expect(calls).toBe(1);
		const blob = await cachedFile(storage, 'c', PATH);
		expect(blob?.size).toBe(3);
		expect(blob?.type).toBe('audio/mpeg');
	});

	it('kein Zugang, offline oder voller Speicher: nichts gespeichert, kein Fehler', async () => {
		const locked = (async () => new Response('nein', { status: 401 })) as typeof fetch;
		const offline = (async () => {
			throw new TypeError('offline');
		}) as typeof fetch;
		const ok = (async () => new Response('x')) as typeof fetch;
		const { storage } = fakeCaches();
		expect(await storeFile(storage, 'c', PATH, locked)).toBe(false);
		expect(await storeFile(storage, 'c', PATH, offline)).toBe(false);
		expect(await cachedFile(storage, 'c', PATH)).toBeNull();
		expect(await storeFile(fakeCaches(true).storage, 'c', PATH, ok)).toBe(false);
		// Browser ohne CacheStorage
		expect(await storeFile(undefined, 'c', PATH, ok)).toBe(false);
		expect(await cachedFile(undefined, 'c', PATH)).toBeNull();
	});
});
