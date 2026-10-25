// Notennamen, Schreibweise und Notenwerte. Portiert aus prototype/v7 (spell, nameOf, durName,
// diaFromMidi).

import type { Step } from './types';

export const STEP_INDEX: Record<Step, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
export const PITCH_CLASS: Record<Step, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Schreibweise je Tonklasse, wenn nur die MIDI-Nummer bekannt ist (Übungen ohne MusicXML). */
const SPELLING: [Step, number][] = [
	['C', 0],
	['C', 1],
	['D', 0],
	['E', -1],
	['E', 0],
	['F', 0],
	['F', 1],
	['G', 0],
	['G', 1],
	['A', 0],
	['B', -1],
	['B', 0]
];

/** Deutsche Namen je Tonklasse des Stammtons: [ohne, ♭, ♯]. */
const GERMAN_NAMES: Record<number, [string, string, string]> = {
	0: ['C', 'Ces', 'Cis'],
	2: ['D', 'Des', 'Dis'],
	4: ['E', 'Es', 'Eis'],
	5: ['F', 'Fes', 'Fis'],
	7: ['G', 'Ges', 'Gis'],
	9: ['A', 'As', 'Ais'],
	11: ['H', 'B', 'His']
};

export interface Spelling {
	step: Step;
	acc: number;
	dia: number;
}

/** Schreibweise einer MIDI-Nummer (Kreuz für Cis, Fis, Gis; B für Es und B). */
export function spell(midi: number): Spelling {
	const octave = Math.floor(midi / 12) - 1;
	const pc = ((midi % 12) + 12) % 12;
	const [step, acc] = SPELLING[pc];
	return { step, acc, dia: octave * 7 + STEP_INDEX[step] };
}

/** Deutscher Notenname: H statt B, B für Hes, Es und As statt Ees und Aes. */
export function germanName(step: Step, acc: number): string {
	const names = GERMAN_NAMES[PITCH_CLASS[step]];
	return acc === 0 ? names[0] : acc < 0 ? names[1] : names[2];
}

/** MIDI-Nummer aus Stammton, Oktave und Vorzeichen (wie in MusicXML). */
export function midiOf(step: Step, octave: number, acc: number): number {
	return 12 * (octave + 1) + PITCH_CLASS[step] + acc;
}

/**
 * Diatonische Höhe einer (auch krummen) MIDI-Zahl, für die Spur der erkannten Tonhöhe auf der Bahn.
 * Halbtöne zwischen zwei Stammtönen landen in der Mitte.
 */
export function diaFromMidi(midi: number): number {
	const octave = Math.floor(midi / 12) - 1;
	const pc = midi - 12 * (octave + 1);
	const T = [0, 0.5, 1, 1.5, 2, 3, 3.5, 4, 4.5, 5, 5.5, 6, 7];
	const i = Math.max(0, Math.min(11, Math.floor(pc)));
	const f = pc - i;
	return octave * 7 + T[i] + (T[i + 1] - T[i]) * f;
}

const DURATION_NAMES: Record<number, string> = {
	4: 'Ganze',
	3: 'punktierte Halbe',
	2: 'Halbe',
	1.5: 'punktierte Viertel',
	1: 'Viertel',
	0.75: 'punktierte Achtel',
	0.5: 'Achtel',
	0.25: 'Sechzehntel'
};

/** Name eines Notenwerts in Schlägen; Unübliches als »2,5 Schläge (übergebunden)«. */
export function durationName(beats: number): string {
	const known = DURATION_NAMES[beats];
	if (known) return known;
	return String(Math.round(beats * 100) / 100).replace('.', ',') + ' Schläge (übergebunden)';
}

/** Die Notenwerte, die als Antwortmöglichkeiten im Quiz vorkommen. */
export const COMMON_DURATION_NAMES = Object.values(DURATION_NAMES);
