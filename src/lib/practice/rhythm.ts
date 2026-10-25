// Rhythmus tippen, portiert aus prototype/v7 (doTap, rhythmMisses). Toleranzen aus
// docs/04-erkenntnisse-prototyp.md: ≤ 70 ms getroffen, ≤ 140 ms knapp, > 250 ms kein Ton.
// Echte Finger auf echten Handys sind ungeprüft.

import type { RawNote } from '../music/types';
import type { Tone } from '../pitch/coach';

export const TAP_HIT_SEC = 0.07;
export const TAP_NEAR_SEC = 0.14;
/** Weiter weg von jedem Ton zählt ein Tipp nicht, und ein nicht getippter Ton gilt danach als verpasst. */
export const TAP_MAX_SEC = 0.25;
/** Zusätzlich zur Ausgabe-Latenz des Geräts (Bildschirm, Touch). */
export const TAP_EXTRA_LATENCY_SEC = 0.015;
/** Nur Töne bis so viele Schläge nach dem Tipp kommen in Frage. */
const LOOKAHEAD_BEATS = 2;
const EPS = 0.01;

export type TapVerdict = 'hit' | 'near' | 'wrong';

export interface TapContext {
	notes: readonly RawNote[];
	/** Ab diesem Schlag zählt der Durchgang. */
	passFrom: number;
	/** Bereits bewertete Töne (Index). */
	judged: ReadonlySet<number>;
	/** Sekunden pro Schlag im Originaltempo. */
	spb: number;
	/** Tempo, 1 = 100 %. */
	rate: number;
}

export type TapResult =
	| { kind: 'judged'; index: number; verdict: TapVerdict; deviationSec: number }
	/** Kein offener Ton in der Nähe – still ignorieren. */
	| { kind: 'ignored' }
	/** Nächster offener Ton zu weit weg. */
	| { kind: 'no-note' };

/** Schlag, an dem der Tipp gemeint war: Zeit des Tipps minus Ausgabe- und Touch-Latenz. */
export function tapBeat(beatNow: number, outputLatencySec: number, spb: number, rate: number) {
	return beatNow - ((outputLatencySec + TAP_EXTRA_LATENCY_SEC) * rate) / spb;
}

/** Tipp dem nächsten offenen Ton zuordnen und bewerten. */
export function judgeTap(ctx: TapContext, beat: number): TapResult {
	const { notes, passFrom, judged, spb, rate } = ctx;
	let best = -1;
	let bestDist = Infinity;
	for (let i = 0; i < notes.length; i++) {
		const n = notes[i];
		if (n.b < passFrom - EPS || judged.has(i)) continue;
		const dist = Math.abs(n.b - beat);
		if (dist < bestDist) {
			bestDist = dist;
			best = i;
		}
		if (n.b > beat + LOOKAHEAD_BEATS) break;
	}
	if (best < 0) return { kind: 'ignored' };
	const deviationSec = ((beat - notes[best].b) * spb) / rate;
	const abs = Math.abs(deviationSec);
	if (abs > TAP_MAX_SEC) return { kind: 'no-note' };
	const verdict: TapVerdict = abs <= TAP_HIT_SEC ? 'hit' : abs <= TAP_NEAR_SEC ? 'near' : 'wrong';
	return { kind: 'judged', index: best, verdict, deviationSec };
}

/** Rückmeldung zu einem Tipp; null, wenn nichts zu sagen ist. */
export function tapFeedback(r: TapResult): { text: string; tone: Tone } | null {
	if (r.kind === 'ignored') return null;
	if (r.kind === 'no-note') return { text: 'Da kommt kein Ton.', tone: 'warn' };
	if (r.verdict === 'hit') return { text: 'Genau.', tone: 'ok' };
	const ms = Math.round(Math.abs(r.deviationSec) * 1000);
	const text = r.deviationSec < 0 ? `Etwas zu früh (${ms} ms).` : `Etwas zu spät (${ms} ms).`;
	return { text, tone: r.verdict === 'near' ? 'warn' : 'bad' };
}

/**
 * Töne, die inzwischen ohne Tipp vorbei sind (mehr als 250 ms nach ihrem Beginn, Latenz eingerechnet).
 * Der Aufrufer markiert sie als 'none'.
 */
export function missedNotes(ctx: TapContext, beatNow: number, outputLatencySec: number): number[] {
	const { notes, passFrom, judged, spb, rate } = ctx;
	const limit = beatNow - ((outputLatencySec + TAP_MAX_SEC) * rate) / spb;
	const out: number[] = [];
	for (let i = 0; i < notes.length; i++) {
		const n = notes[i];
		if (n.b < passFrom - EPS) continue;
		if (n.b > limit) break;
		if (!judged.has(i)) out.push(i);
	}
	return out;
}
