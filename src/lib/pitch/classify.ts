// Bewertung beim Mithören, portiert aus prototype/v7 (classify, Bewertungsfenster, Auszählung
// in micFrame). Werte aus docs/04-erkenntnisse-prototyp.md.

import { isNaturalTone } from '../music/fingering';
import type { Note } from '../music/types';

/** Urteil über einen einzelnen Messpunkt (Frame) während eines Tons. */
export type FrameClass = 'hit' | 'near' | 'partial' | 'wrong';

export interface FrameVerdict {
	c: FrameClass;
	/** Abweichung in Halbtönen (gespielt − notiert), positiv = zu hoch. */
	dev: number;
	/** Nur bei 'partial': anderer Naturton oberhalb. */
	up?: boolean;
}

/** Urteil über einen ganzen Ton; 'none' = nicht gehört. */
export type NoteVerdict = FrameClass | 'none';

/** ±50 Cent gilt als getroffen. */
export const HIT_SEMITONES = 0.5;
/** Bis ±100 Cent gilt als knapp. */
export const NEAR_SEMITONES = 1;

/**
 * Einen Messpunkt gegen den erwarteten Ton bewerten.
 * `written` ist die gehörte Tonhöhe in notierter Lage (klingend − shift der Stimme).
 * Reihenfolge wie im Prototyp: getroffen, dann falsche Stufe (richtiger Griff, anderer Naturton),
 * dann knapp, sonst daneben.
 */
export function classifyFrame(written: number, note: Pick<Note, 'm' | 'lower'>): FrameVerdict {
	const dev = written - note.m;
	if (Math.abs(dev) <= HIT_SEMITONES) return { c: 'hit', dev };
	const r = Math.round(written);
	if (note.lower !== null && r !== note.m && isNaturalTone(r + note.lower)) {
		return { c: 'partial', dev, up: r > note.m };
	}
	if (Math.abs(dev) <= NEAR_SEMITONES) return { c: 'near', dev };
	return { c: 'wrong', dev };
}

/**
 * Zählt ein Messpunkt für den Ton? Ansatz und Ende bleiben aussen vor:
 * ab Tonbeginn + min(60 ms; 30 % der Dauer) bis Tonende − min(40 ms; 20 %). Alles in Wanduhr-Sekunden.
 */
export function inJudgingWindow(sinceStart: number, untilEnd: number, length: number): boolean {
	return sinceStart >= Math.min(0.06, length * 0.3) && untilEnd >= Math.min(0.04, length * 0.2);
}

export interface NoteTally {
	n: number;
	hit: number;
	near: number;
	partial: number;
	/** Wie viele der 'partial' oberhalb lagen. */
	up: number;
	wrong: number;
}

export function emptyTally(): NoteTally {
	return { n: 0, hit: 0, near: 0, partial: 0, up: 0, wrong: 0 };
}

/** Messpunkt zur Auszählung eines Tons hinzufügen (verändert `tally`). */
export function addToTally(tally: NoteTally, v: FrameVerdict): NoteTally {
	tally.n++;
	tally[v.c]++;
	if (v.c === 'partial' && v.up) tally.up++;
	return tally;
}

/**
 * Urteil über einen Ton aus seinen Messpunkten: getroffen, wenn mindestens die Hälfte trifft;
 * sonst knapp, wenn getroffen + knapp die Hälfte erreichen; sonst falsche Stufe bzw. daneben.
 */
export function noteVerdict(tally: NoteTally | undefined): NoteVerdict {
	if (!tally || !tally.n) return 'none';
	if (tally.hit / tally.n >= 0.5) return 'hit';
	if ((tally.hit + tally.near) / tally.n >= 0.5) return 'near';
	if (tally.partial / tally.n >= 0.5) return 'partial';
	return 'wrong';
}

/** Punktwert für Prüfungen: getroffen = 1, knapp oder falsche Stufe = 0,5 (docs/01-produkt.md). */
export function verdictScore(v: NoteVerdict): number {
	return v === 'hit' ? 1 : v === 'near' || v === 'partial' ? 0.5 : 0;
}
