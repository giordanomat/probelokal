// Stimme aus dem Noten-JSON aufbereiten und Noten zu einem Zeitpunkt finden.
// Portiert aus prototype/v7 (finish, noteIdxAt, nextIdx, secNoteIdx, isPauseSec).

import { loweringOf } from './fingering';
import { germanName } from './notation';
import type { InstrumentKind, Note, RawNote, Track } from './types';

/** Ab dieser Pause (Schläge) zeigt die Bahn ein Atemzeichen. */
export const BREATH_REST_BEATS = 0.75;
/** Ab dieser Pause (Schläge) gilt der nächste Ton als Einsatz. */
export const ENTRY_REST_BEATS = 1;
/** Toleranz, damit ein Ton schon knapp vor seinem Beginn als »jetzt« gilt (Schläge). */
const EARLY = 0.02;
const EPS = 0.001;

/** Noten einer Stimme mit Namen, Absenkung, Atemzeichen, Einsätzen und Tonumfang. */
export function buildTrack(raw: readonly RawNote[], kind: InstrumentKind): Track {
	const notes: Note[] = raw.map((n) => ({
		...n,
		name: germanName(n.step, n.acc),
		lower: loweringOf(n.fing, kind)
	}));
	const rests: number[] = [];
	const entries: number[] = [];
	notes.forEach((n, i) => {
		if (i === 0) {
			entries.push(n.b);
			return;
		}
		const prevEnd = notes[i - 1].b + notes[i - 1].d;
		const gap = n.b - prevEnd;
		if (gap >= BREATH_REST_BEATS) rests.push(prevEnd);
		if (gap >= ENTRY_REST_BEATS) entries.push(n.b);
	});
	const dias = notes.map((n) => n.dia);
	return {
		notes,
		rests,
		entries,
		diaMin: dias.length ? Math.min(...dias) : 0,
		diaMax: dias.length ? Math.max(...dias) : 0
	};
}

/** Index des Tons, der beim Schlag klingt, sonst −1. Noten müssen nach Beginn sortiert sein. */
export function noteIndexAt(notes: readonly RawNote[], beat: number): number {
	for (let i = 0; i < notes.length; i++) {
		const n = notes[i];
		if (beat >= n.b - EARLY && beat < n.b + n.d) return i;
		if (n.b > beat) return -1;
	}
	return -1;
}

/** Index des nächsten Tons, der nach dem Schlag beginnt, sonst −1. */
export function nextNoteIndex(notes: readonly RawNote[], beat: number): number {
	for (let i = 0; i < notes.length; i++) if (notes[i].b > beat + EARLY) return i;
	return -1;
}

/** Indizes der Töne, die in den Takten from–to (einschliesslich, 4/4) beginnen. */
export function noteIndicesInBars(notes: readonly RawNote[], from: number, to: number): number[] {
	const start = from * 4 - EPS;
	const end = (to + 1) * 4 - EPS;
	const out: number[] = [];
	notes.forEach((n, i) => {
		if (n.b >= start && n.b < end) out.push(i);
	});
	return out;
}

/** Hat die Stimme in den Takten from–to keinen Ton? Dann ist der Teil »Pause für dich«. */
export function isRestInBars(notes: readonly RawNote[], from: number, to: number): boolean {
	return noteIndicesInBars(notes, from, to).length === 0;
}
