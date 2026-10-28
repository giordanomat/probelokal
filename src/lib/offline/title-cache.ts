// Offline für einen Titel (M1: Bad Touch). Die Seite speichert die Dateien, die sie lädt (Band,
// eigene Stimme, MusicXML), in einem eigenen Cache pro Titel und Fassung, Schlüssel ist der
// /audio/…-Pfad (die signierten Adressen dahinter wechseln). Offline spielt sie daraus als
// blob:-Adresse. Damit kann der Browser selbst springen, und der Service Worker muss keine
// Range-Anfragen beantworten (in Safari heikel).
//
// Folge: Ersetzte Dateien unter derselben Fassung sieht ein Gerät erst, wenn sein Cache leer ist.
// Neue Mischungen gehören deshalb in eine neue Fassung (docs/06).
// Ungeprüft auf iPhone/iPad: ob Safari den Cache einer Home-Bildschirm-App behält.

export const TITLE_CACHE_PREFIX = 'probelokal-titel-';

/** Was die Funktionen von CacheStorage brauchen (im Test nachgebaut). */
export interface CacheLike {
	match(key: string): Promise<Response | undefined>;
	put(key: string, res: Response): Promise<void>;
}
export interface CacheStorageLike {
	open(name: string): Promise<CacheLike>;
}

export function titleCacheName(slug: string, version: string): string {
	return TITLE_CACHE_PREFIX + slug + '-' + version.toLowerCase();
}

/** Die gespeicherte Datei, oder null (nicht gespeichert, kein Cache im Browser). */
export async function cachedFile(
	storage: CacheStorageLike | undefined,
	cacheName: string,
	path: string
): Promise<Blob | null> {
	try {
		const hit = await (await storage?.open(cacheName))?.match(path);
		return hit ? await hit.blob() : null;
	} catch {
		return null;
	}
}

/**
 * Datei laden und speichern, falls sie noch nicht gespeichert ist. Gibt true zurück, wenn sie
 * danach gespeichert ist. Fehler (offline, kein Zugang, voller Speicher) ergeben false.
 */
export async function storeFile(
	storage: CacheStorageLike | undefined,
	cacheName: string,
	path: string,
	f: typeof fetch = fetch
): Promise<boolean> {
	try {
		const cache = await storage?.open(cacheName);
		if (!cache) return false;
		if (await cache.match(path)) return true;
		const res = await f(path);
		if (!res.ok) return false;
		const body = await res.blob();
		await cache.put(
			path,
			new Response(body, {
				headers: { 'content-type': res.headers.get('content-type') ?? 'application/octet-stream' }
			})
		);
		return true;
	} catch {
		return false;
	}
}
