// Einblasen mit dem giordanomat-Dirigenten, portiert aus prototype/v7 (EXERCISES, exBuild).
// Pro Runde spielt der Dirigent einen Takt vor (»Hör zu«), dann spielst du denselben Takt nach
// (»Jetzt du«). Vorne ein Takt Einzählen. Alle Töne notiert im Violinschlüssel in B wie die
// Stimmen von Bad Touch; klingend = notiert + shift der Stimme.
//
// Der »Schränz-Groove« des Prototyps fehlt bewusst: Er wird dort erst ab Level 3 freigeschaltet,
// Levels kommen mit M2 (docs/05-roadmap.md).

import { standardFingering, VALVE_BY_LOWERING } from '../music/fingering';
import { spell } from '../music/notation';
import type { InstrumentKind, RawNote } from '../music/types';

export const COUNT_IN_BEATS = 4;
/** Ein Takt vorspielen, ein Takt nachspielen */
export const PHRASE_BEATS = 4;

export type ExerciseLevel = 0 | 1;
export const LEVEL_LABELS = ['Einstieg', 'Weiter'] as const;

interface Round {
	/** [notiert MIDI, Dauer in Schlägen] */
	notes: [number, number][];
	/** Lippenbindungen: gleicher Griff mit dieser Absenkung (Halbtöne) */
	lowering?: number;
}

export interface Exercise {
	id: string;
	name: string;
	intro: string;
	tips: string[];
	rounds(level: ExerciseLevel): Round[];
}

const rep = (m: number, d: number, n: number): [number, number][] =>
	Array.from({ length: n }, () => [m, d]);

export const EXERCISES: Exercise[] = [
	{
		id: 'lang',
		name: 'Lange Töne',
		intro:
			'Ich spiele einen Ton vor, du hältst ihn gleich lang. Ziel ist ein ruhiger, gerader Ton – nicht ein lauter.',
		tips: [
			'Tief durch den Bauch einatmen, die Schultern bleiben unten.',
			'Die Lautstärke bis zum Ende des Tons gleich halten.',
			'Lieber leise und ruhig als laut und wackelig.'
		],
		rounds: (lvl) =>
			(lvl
				? [67, 66, 65, 64, 63, 62, 61, 60, 62, 64, 65, 67, 69, 71, 72]
				: [67, 65, 64, 62, 60, 62, 64, 67]
			).map((m) => ({ notes: [[m, 3]] }))
	},
	{
		id: 'bind',
		name: 'Lippenbindungen',
		intro:
			'Gleicher Griff, verschiedene Töne: Nur Lippenspannung und Luft ändern sich. Bei der Posaune bleibt der Zug stehen.',
		tips: [
			'Nach oben: Luft schneller, nicht mehr Druck aufs Mundstück.',
			'Nicht stossen – die Töne gleiten ineinander.',
			'Wenn ein Ton nicht kommt: langsamer, und denselben Griff ruhig nochmals.'
		],
		rounds: (lvl) =>
			(lvl ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3]).map((L) => ({
				lowering: L,
				notes: lvl
					? [
							[60 - L, 1],
							[67 - L, 1],
							[72 - L, 1],
							[67 - L, 1]
						]
					: [
							[60 - L, 2],
							[67 - L, 2]
						]
			}))
	},
	{
		id: 'zunge',
		name: 'Zungenstoss',
		intro:
			'Jeder Ton beginnt mit einem leichten »ta« der Zunge. Die Luft fliesst durch, die Zunge unterbricht nur kurz.',
		tips: [
			'Kurz heisst nicht hart: weich ansetzen.',
			'Erst langsam sauber, dann schneller.',
			'Die Zunge tippt hinter die oberen Zähne, der Kiefer bleibt ruhig.'
		],
		rounds: (lvl) => {
			const p = 67;
			const q = 72;
			const r: Round[] = [
				{ notes: rep(p, 1, 4) },
				{ notes: rep(p, 0.5, 8) },
				{
					notes: [
						[p, 1],
						[p, 0.5],
						[p, 0.5],
						[p, 1],
						[p, 0.5],
						[p, 0.5]
					]
				}
			];
			if (lvl) {
				r.push(
					{ notes: [...rep(q, 0.5, 4), [q, 1], [q, 1]] },
					{ notes: [...rep(p, 0.25, 4), [p, 1], ...rep(p, 0.25, 4), [p, 1]] }
				);
			}
			return r;
		}
	},
	{
		id: 'leiter',
		name: 'Tonleiter-Häppchen',
		intro:
			'Ein paar Töne auf, ein paar ab – die Bausteine für fast jedes Stück. Erst die Griffe, dann der Klang.',
		tips: [
			'Die Griffe vorher einmal stumm durchdrücken.',
			'Gleichmässig: jeder Ton gleich lang.',
			'Bei der Posaune den Zug zügig und genau setzen.'
		],
		rounds: (lvl) =>
			lvl
				? [
						{ notes: [60, 62, 64, 65, 67, 69, 71, 72].map((m) => [m, 0.5]) },
						{ notes: [72, 71, 69, 67, 65, 64, 62, 60].map((m) => [m, 0.5]) },
						{ notes: [60, 64, 67, 72].map((m) => [m, 1]) },
						{ notes: [72, 67, 64, 60].map((m) => [m, 1]) }
					]
				: [
						{ notes: [60, 62, 64, 65].map((m) => [m, 1]) },
						{ notes: [67, 65, 64, 62].map((m) => [m, 1]) },
						{ notes: [60, 62, 64, 62].map((m) => [m, 1]) },
						{ notes: [[60, 4]] }
					]
	}
];

/** Ton einer Übung; `call` = spielt der Dirigent vor, wird nicht bewertet. */
export type ExerciseNote = RawNote & { call: boolean };

/** Griff für einen Übungston: bei Lippenbindungen fest, sonst aus der Standardtabelle. */
function fingeringFor(m: number, kind: InstrumentKind, lowering: number | undefined): string {
	if (lowering === undefined) return standardFingering(m, kind);
	return kind === 'slide' ? String(lowering + 1) : VALVE_BY_LOWERING[lowering];
}

/** Alle Töne einer Übung mit Vorspielen und Nachspielen; total = Schläge bis zum Ende. */
export function buildExercise(
	ex: Exercise,
	level: ExerciseLevel,
	kind: InstrumentKind
): { notes: ExerciseNote[]; total: number } {
	const notes: ExerciseNote[] = [];
	let b = COUNT_IN_BEATS;
	for (const round of ex.rounds(level)) {
		for (const call of [true, false]) {
			let t = b;
			for (const [m, d] of round.notes) {
				const s = spell(m);
				notes.push({
					b: t,
					d,
					m,
					dia: s.dia,
					acc: s.acc,
					step: s.step,
					fing: fingeringFor(m, kind, round.lowering),
					call
				});
				t += d;
			}
			b += PHRASE_BEATS;
		}
	}
	return { notes, total: b };
}

export interface ScheduledBeat {
	/** Klick auf diesem Schlag (beim Einzählen immer), betont auf der Eins */
	click: { accent: boolean } | null;
	/** Vorgespielte Töne, die in diesem Schlag beginnen */
	tones: { b: number; d: number; m: number }[];
}

/** Was auf einem ganzen Schlag zu planen ist (Taktplan für das Vorausplanen in Web Audio). */
export function beatEvents(
	beat: number,
	notes: readonly ExerciseNote[],
	clickOn: boolean
): ScheduledBeat {
	return {
		click: clickOn || beat < COUNT_IN_BEATS ? { accent: beat % 4 === 0 } : null,
		tones: notes
			.filter((n) => n.call && n.b >= beat && n.b < beat + 1)
			.map(({ b, d, m }) => ({ b, d, m }))
	};
}
