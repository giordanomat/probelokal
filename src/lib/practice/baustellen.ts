// Baustellen: Takte, die wackeln. Portiert aus prototype/v7 (finishPass, renderBau).
// Nur auf dem Gerät gespeichert (docs/03-datenmodell.md, offener Punkt: bleibt so).

import type { RawNote } from '../music/types';
import type { NoteVerdict } from '../pitch/classify';

/** Pro Takt: Versuche (bewertete Töne) und davon nicht getroffen. */
export type BarStats = Record<number, { t: number; b: number }>;

export interface Baustelle {
	bar: number;
	tries: number;
	shaky: number;
	/** Anteil wackliger Töne 0–1 */
	ratio: number;
}

/** Tempo, mit dem eine Baustelle geübt wird (Prozent). */
export const BAUSTELLE_TEMPO = 70;
const MIN_TRIES = 2;
const MIN_RATIO = 0.25;

/** Ergebnis eines vollständigen Durchgangs eintragen. Gibt neue Statistik zurück. */
export function recordPass(
	stats: BarStats,
	judged: Iterable<[number, NoteVerdict]>,
	notes: readonly RawNote[]
): BarStats {
	const out: BarStats = { ...stats };
	for (const [i, verdict] of judged) {
		const bar = Math.floor(notes[i].b / 4);
		const e = { ...(out[bar] ?? { t: 0, b: 0 }) };
		e.t++;
		if (verdict !== 'hit') e.b++;
		out[bar] = e;
	}
	return out;
}

/** Die wackligsten Takte (mind. 2 Versuche, mind. 25 % daneben), höchster Anteil zuerst. */
export function topBaustellen(stats: BarStats, limit = 3): Baustelle[] {
	return Object.entries(stats)
		.map(([bar, e]) => ({ bar: Number(bar), tries: e.t, shaky: e.b, ratio: e.b / e.t }))
		.filter((x) => x.tries >= MIN_TRIES && x.ratio >= MIN_RATIO)
		.sort((a, b) => b.ratio - a.ratio || b.tries - a.tries)
		.slice(0, limit);
}

/** Speicherschlüssel pro Titel und Stimme (im Prototyp nur pro Stimme). */
export function baustellenKey(titleSlug: string, voiceId: string): string {
	return `probelokal.bau.${titleSlug}.${voiceId}`;
}

/** Gespeicherte Statistik lesen; Unlesbares ergibt leer. */
export function parseBarStats(raw: string | null): BarStats {
	if (!raw) return {};
	try {
		const data: unknown = JSON.parse(raw);
		if (!data || typeof data !== 'object') return {};
		const out: BarStats = {};
		for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
			const e = v as { t?: unknown; b?: unknown };
			if (typeof e?.t === 'number' && typeof e?.b === 'number' && e.t > 0) {
				out[Number(k)] = { t: e.t, b: e.b };
			}
		}
		return out;
	} catch {
		return {};
	}
}
