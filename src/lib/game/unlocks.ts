// Höchster Rang über alle eigenen Guuggen (my_best_points) für die Belohnungen auf dem Gerät:
// Bahn-Looks und Schränz-Groove. Zwischengespeichert, damit sie auch offline und vor dem Laden
// gelten; beim Abmelden gelöscht. Nur Anzeige, die Punkte rechnet der Server.

import type { AccountApi } from '../account/lazy';

export const BEST_POINTS_KEY = 'probelokal.punkte';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function loadBestPoints(storage: StorageLike | undefined): number {
	try {
		const n = Number(storage?.getItem(BEST_POINTS_KEY));
		return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
	} catch {
		return 0;
	}
}

export function saveBestPoints(storage: StorageLike | undefined, points: number): void {
	try {
		storage?.setItem(BEST_POINTS_KEY, String(points));
	} catch {
		// gilt dann nur bis zum Neuladen
	}
}

export function clearBestPoints(storage: StorageLike | undefined): void {
	try {
		storage?.removeItem(BEST_POINTS_KEY);
	} catch {
		// nichts zu tun
	}
}

/** Vom Server holen und merken; ohne Netz bleibt der gemerkte Wert. */
export async function refreshBestPoints(a: AccountApi, storage: StorageLike): Promise<number> {
	try {
		const points = await a.api.myBestPoints(a.sb);
		saveBestPoints(storage, points);
		return points;
	} catch {
		return loadBestPoints(storage);
	}
}
