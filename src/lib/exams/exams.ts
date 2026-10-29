// Etappenprüfungen, portiert aus prototype/v7 (quizFor, runGrip, endLaneExam, finishExam).
// 1 Gehört: Quiz, 3 von 4 richtig. 2 Griffe sitzen: bis zu 10 Töne, 80 %. 3–5 auf der Bahn
// (Mithören oder Rhythmus tippen), 80 %; getroffen = 1, knapp/falsche Stufe = 0,5 (docs/01).
// Zufall kommt von aussen (`rng`), damit Tests feste Fragen bekommen.

import { sameFingering, fingeringLabel } from '../music/fingering';
import { COMMON_DURATION_NAMES, durationName } from '../music/notation';
import { noteIndicesInBars } from '../music/track';
import type { InstrumentKind, Note, Section } from '../music/types';
import { verdictScore, type NoteVerdict } from '../pitch/classify';
import { sectionLabel } from '../music/timing';

export type Rng = () => number;

export type ExamVia = 'quiz' | 'grip' | 'mic' | 'rhythm';

/** Bestanden ab: Etappe 1 drei von vier, sonst 80 %. */
export function passMark(stage: number): number {
	return stage === 1 ? 0.75 : 0.8;
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
	const a = items.slice();
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

/** Richtige Antwort und bis zu drei andere aus dem Vorrat, gemischt. */
function options(right: string, pool: readonly string[], rng: Rng): string[] {
	const o = [right];
	for (const x of shuffle(pool, rng)) {
		if (o.length >= 4) break;
		if (!o.includes(x)) o.push(x);
	}
	return shuffle(o, rng);
}

export interface Question {
	q: string;
	answer: string;
	options: string[];
}

/** Die Töne der Stimme in einem Teil. */
export function sectionNotes<T extends Note>(notes: readonly T[], section: Section): T[] {
	return noteIndicesInBars(notes, section.from, section.to).map((i) => notes[i]);
}

/**
 * Etappe 1: vier Fragen aus den Noten – erster Griff, höchster Ton, Anzahl Takte, Länge des
 * ersten Tons. Null, wenn die Stimme im Teil Pause hat.
 */
export function quizFor(
	section: Section,
	notes: readonly Note[],
	kind: InstrumentKind,
	rng: Rng
): Question[] | null {
	const own = sectionNotes(notes, section);
	if (!own.length) return null;
	const first = own[0];
	const label = sectionLabel(section);
	const grip = kind === 'slide' ? 'Zug' : 'Griff';
	const allGrips = [...new Set(notes.map((n) => fingeringLabel(n.fing, kind)))];
	const highest = own.reduce((a, b) => (b.m > a.m ? b : a));
	const names = [...new Set(notes.map((n) => n.name))];
	const bars = section.to - section.from + 1;
	const barPool = [bars - 2, bars + 2, bars * 2, bars + 4, bars - 1]
		.filter((x) => x > 0 && x !== bars)
		.map(String);
	return [
		{
			q: `Mit welchem ${grip} beginnt ${label}?`,
			answer: fingeringLabel(first.fing, kind),
			options: options(fingeringLabel(first.fing, kind), allGrips, rng)
		},
		{
			q: `Welches ist der höchste Ton in ${label}?`,
			answer: highest.name,
			options: options(highest.name, names, rng)
		},
		{
			q: `Wie viele Takte hat ${label}?`,
			answer: String(bars),
			options: options(String(bars), barPool, rng)
		},
		{
			q: `Wie lang ist der erste Ton in ${label}?`,
			answer: durationName(first.d),
			options: options(durationName(first.d), COMMON_DURATION_NAMES, rng)
		}
	];
}

/** Etappe 2: Töne des Teils mit Griff, gleiche Tonhöhe hintereinander nur einmal, höchstens 10. */
export function gripItems<T extends Note>(notes: readonly T[], section: Section): T[] {
	const seq: T[] = [];
	for (const n of sectionNotes(notes, section)) {
		if (!n.fing) continue;
		if (!seq.length || seq[seq.length - 1].m !== n.m) seq.push(n);
	}
	return seq.slice(0, 10);
}

/** Antwort bei »Griffe sitzen«: Ventile nach Absenkung ('3' = '12'), Zug nach Position. */
export function gripCorrect(
	given: string,
	note: Pick<Note, 'fing'>,
	kind: InstrumentKind
): boolean {
	return sameFingering(given, note.fing, kind);
}

/** Etappen 3–5: Anteil aus den Bewertungen aller Töne des Teils (nicht gehört = 0). */
export function laneScore(verdicts: readonly (NoteVerdict | undefined)[]): number {
	if (!verdicts.length) return 1;
	return verdicts.reduce((s, v) => s + verdictScore(v ?? 'none'), 0) / verdicts.length;
}

export const PRAISE = [
	'Stark! Das sitzt.',
	'Sauber gemacht – weiter so.',
	'Bravo, die nächste Etappe wartet schon.',
	'Da freut sich die ganze Guugge.'
];
export const ENCOURAGE = [
	'Fast! Noch ein, zwei Durchgänge, dann sitzt es.',
	'Kein Problem – genau dafür übt man.',
	'Etwas langsamer üben, dann klappt es.'
];
