// Einstellungen der Bahn pro Gerät (wie im Prototyp in localStorage). Unbekanntes oder Kaputtes
// fällt auf den Standard zurück; Speicher kann fehlen oder werfen (privates Fenster).

import type { HelpLevel } from '../lane/geometry';
import { ZOOM_STEPS } from '../lane/geometry';
import { LANE_LOOKS, type LaneLook } from '../lane/looks';

export interface LanePrefs {
	voice: string;
	help: HelpLevel;
	names: boolean;
	staff: boolean;
	zoom: number;
	/** Lautstärke meiner Stimme im Kopfhörer (wie im Prototyp: Aus, Leise, Laut). */
	own: number;
	/** Bahn-Look (Belohnung); gilt nur, solange er freigeschaltet ist (activeLook) */
	look: LaneLook;
}

export const OWN_LEVELS = [
	{ value: 0, label: 'Aus' },
	{ value: 0.35, label: 'Leise' },
	{ value: 1, label: 'Laut' }
] as const;

export const PREFS_KEY = 'probelokal.bahn';

export const DEFAULT_PREFS: LanePrefs = {
	voice: 'trp1',
	help: 'all',
	names: false,
	staff: false,
	zoom: 1,
	own: 1,
	look: 'std'
};

const HELP: readonly HelpLevel[] = ['all', 'nogrip', 'rhythm', 'memo'];

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export function parsePrefs(raw: string | null | undefined, voiceIds: readonly string[]): LanePrefs {
	let data: Partial<Record<keyof LanePrefs, unknown>> = {};
	try {
		const parsed: unknown = raw ? JSON.parse(raw) : {};
		if (parsed && typeof parsed === 'object') data = parsed as typeof data;
	} catch {
		// Standard
	}
	const d = DEFAULT_PREFS;
	return {
		voice:
			typeof data.voice === 'string' && voiceIds.includes(data.voice)
				? data.voice
				: (voiceIds[0] ?? d.voice),
		help: HELP.includes(data.help as HelpLevel) ? (data.help as HelpLevel) : d.help,
		names: typeof data.names === 'boolean' ? data.names : d.names,
		staff: typeof data.staff === 'boolean' ? data.staff : d.staff,
		zoom: (ZOOM_STEPS as readonly number[]).includes(data.zoom as number)
			? (data.zoom as number)
			: d.zoom,
		own: OWN_LEVELS.some((l) => l.value === data.own) ? (data.own as number) : d.own,
		look: LANE_LOOKS.some((l) => l.id === data.look) ? (data.look as LaneLook) : d.look
	};
}

export function loadPrefs(
	storage: StorageLike | undefined,
	voiceIds: readonly string[]
): LanePrefs {
	try {
		return parsePrefs(storage?.getItem(PREFS_KEY), voiceIds);
	} catch {
		return parsePrefs(null, voiceIds);
	}
}

export function savePrefs(storage: StorageLike | undefined, prefs: LanePrefs): void {
	try {
		storage?.setItem(PREFS_KEY, JSON.stringify(prefs));
	} catch {
		// absichtlich leer: gilt dann nur bis zum Neuladen
	}
}
