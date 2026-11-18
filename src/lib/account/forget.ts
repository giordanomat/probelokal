// Nach dem Löschen des Kontos: alles von Probelokal auf diesem Gerät vergessen (Entscheid Matthias
// 18.11.2026). Einstellungen, Baustellen, Belohnungen und eine offene Einladung liegen in
// localStorage unter »probelokal.…«, gespeicherte Aufnahmen und Noten in den Caches der Titel.
// Das Gerüst der App (Service Worker) enthält nichts Persönliches und bleibt.

import { TITLE_CACHE_PREFIX } from '../offline/title-cache.ts';

export const LOCAL_PREFIX = 'probelokal.';

export type StorageLike = Pick<Storage, 'length' | 'key' | 'removeItem'>;
export type CachesLike = Pick<CacheStorage, 'keys' | 'delete'>;

/** Entfernt die Daten von Probelokal; gibt die Anzahl entfernter Einträge zurück. Fehler schlucken. */
export async function forgetDevice(
	storage: StorageLike | undefined,
	caches: CachesLike | undefined
): Promise<number> {
	let n = 0;
	try {
		if (storage) {
			const keys: string[] = [];
			for (let i = 0; i < storage.length; i++) {
				const k = storage.key(i);
				if (k?.startsWith(LOCAL_PREFIX)) keys.push(k);
			}
			for (const k of keys) {
				storage.removeItem(k);
				n++;
			}
		}
	} catch {
		// Speicher gesperrt (privates Fenster): nichts zu tun
	}
	try {
		for (const name of (await caches?.keys()) ?? []) {
			if (name.startsWith(TITLE_CACHE_PREFIX) && (await caches!.delete(name))) n++;
		}
	} catch {
		// kein Cache im Browser
	}
	return n;
}
