// Auswertung eines Durchgangs und Tempoleiter, portiert aus prototype/v7 (finishPass).
// Tempoleiter laut docs/01-produkt.md: ab 80 % Treffern +5 % Tempo vorschlagen, unter 50 % langsamer.

import type { NoteVerdict } from '../pitch/classify';

/** Weniger bewertete Töne ergeben kein Ergebnis (zu kurz, um etwas zu sagen). */
export const MIN_JUDGED = 3;
export const TEMPO_MIN = 50;
export const TEMPO_MAX = 100;

export interface PassSummary {
	total: number;
	hit: number;
	/** knapp oder falsche Stufe */
	half: number;
	/** Anteil getroffen in ganzen Prozent */
	pct: number;
}

export function summarizePass(verdicts: readonly NoteVerdict[]): PassSummary | null {
	if (verdicts.length < MIN_JUDGED) return null;
	const hit = verdicts.filter((v) => v === 'hit').length;
	const half = verdicts.filter((v) => v === 'near' || v === 'partial').length;
	return { total: verdicts.length, hit, half, pct: Math.round((hit / verdicts.length) * 100) };
}

export type TempoAdvice =
	{ kind: 'faster'; tempo: number } | { kind: 'slower'; tempo: number } | { kind: 'done' } | null;

/** Vorschlag nach einem vollständigen Durchgang. Tempo in Prozent (50–100). */
export function tempoAdvice(pct: number, tempo: number): TempoAdvice {
	if (pct >= 80 && tempo < TEMPO_MAX) {
		return { kind: 'faster', tempo: Math.min(TEMPO_MAX, tempo + 5) };
	}
	if (pct >= 80) return { kind: 'done' };
	if (pct < 50 && tempo > TEMPO_MIN) {
		return { kind: 'slower', tempo: Math.max(TEMPO_MIN, tempo - 10) };
	}
	return null;
}

/** Mittlere Abweichung beim Tippen als Satzteil, z. B. »im Schnitt 40 ms zu früh«. */
export function meanDeviationText(deviationsSec: readonly number[]): string | null {
	if (!deviationsSec.length) return null;
	const avgMs = (deviationsSec.reduce((s, x) => s + x, 0) / deviationsSec.length) * 1000;
	if (Math.abs(avgMs) < 25) return 'im Schnitt genau';
	return avgMs < 0
		? `im Schnitt ${Math.round(-avgMs)} ms zu früh`
		: `im Schnitt ${Math.round(avgMs)} ms zu spät`;
}

/** Überschrift des Ergebnisses: »Durchgang 3: 14 von 16 Tönen getroffen (88 %)«. */
export function passHeadline(
	s: PassSummary,
	opts: { final: boolean; number: number; rhythm: boolean }
): string {
	const prefix = opts.final ? `Durchgang ${opts.number}: ` : 'Bisher: ';
	const what = opts.rhythm ? 'Einsätzen genau' : 'Tönen getroffen';
	return `${prefix}${s.hit} von ${s.total} ${what} (${s.pct} %)`;
}
