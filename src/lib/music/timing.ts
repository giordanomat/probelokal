// Takte, Teile und Zeit im Audio. Portiert aus prototype/v7 (currentBeat, timeForBar, sectionOf).
// Annahme wie im Prototyp: durchgehend 4/4 und ein Tempo. Titel mit Taktwechsel brauchen eine
// Taktliste; tools/extract_notes.py warnt, wenn eine andere Taktart vorkommt.

import type { Section, Title } from './types';

export const BEATS_PER_BAR = 4;

/** Sekunden pro Schlag im Originaltempo. */
export function secondsPerBeat(title: Pick<Title, 'bpm'>): number {
	return 60 / title.bpm;
}

/** Schlag ab Takt 0 zu einer Zeit im Audio (Zeit läuft im Originaltempo, auch bei playbackRate ≠ 1). */
export function beatAtTime(title: Pick<Title, 'bpm' | 'stem_offset_sec'>, seconds: number): number {
	return (seconds - title.stem_offset_sec) / secondsPerBeat(title);
}

/** Zeit im Audio, an der ein Takt beginnt; nie vor dem Dateianfang. */
export function timeForBar(title: Pick<Title, 'bpm' | 'stem_offset_sec'>, bar: number): number {
	return Math.max(0, title.stem_offset_sec + bar * BEATS_PER_BAR * secondsPerBeat(title));
}

/**
 * Wanduhr-Sekunden für eine Anzahl Schläge beim gewählten Tempo (rate 0,8 = 80 %).
 * Für Toleranzen in Millisekunden, die unabhängig vom Tempo gelten sollen.
 */
export function wallSeconds(beats: number, spb: number, rate: number): number {
	return (beats * spb) / rate;
}

/** Teile aus Starttakten: Teil 0 heisst »Vorzähler«, danach A, B, C … */
export function sectionsFromStarts(starts: readonly number[], bars: number): Section[] {
	return starts.map((from, i) => ({
		from,
		to: (starts[i + 1] ?? bars) - 1,
		name: i === 0 ? 'Vorzähler' : String.fromCharCode(64 + i)
	}));
}

/** Index des Teils, in dem der (auch krumme) Takt liegt. */
export function sectionIndexOf(sections: readonly Section[], bar: number): number {
	let index = 0;
	sections.forEach((s, k) => {
		if (bar >= s.from - 0.001) index = k;
	});
	return index;
}

/** Anzeige eines Teils: »Vorzähler« oder »Teil A«. */
export function sectionLabel(section: Section): string {
	return section.name === 'Vorzähler' ? section.name : 'Teil ' + section.name;
}

/**
 * Zählzeit 1–4 beim Einzählen: Wer in einen Takt springt, startet einen Takt früher.
 * null ausserhalb des Anlauftakts oder ohne Sprungziel.
 */
export function countIn(beat: number, targetBar: number | null): number | null {
	if (targetBar === null) return null;
	const start = targetBar * BEATS_PER_BAR;
	if (beat >= start || beat < start - BEATS_PER_BAR) return null;
	return Math.floor(beat - (start - BEATS_PER_BAR)) + 1;
}
