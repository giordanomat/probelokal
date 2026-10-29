import { describe, expect, it } from 'vitest';
import { isNaturalTone, loweringOf } from '../music/fingering';
import { buildTrack } from '../music/track';
import {
	beatEvents,
	buildExercise,
	COUNT_IN_BEATS,
	EXERCISES,
	PHRASE_BEATS,
	type ExerciseLevel
} from './exercises';

const ex = (id: string) => EXERCISES.find((e) => e.id === id)!;

describe('Einblasen: Übungen', () => {
	it('Lange Töne Einstieg: acht Runden, je vorspielen und nachspielen, drei Schläge lang', () => {
		const { notes, total } = buildExercise(ex('lang'), 0, 'valve');
		expect(notes).toHaveLength(16);
		expect(total).toBe(COUNT_IN_BEATS + 8 * 2 * PHRASE_BEATS);
		expect(notes[0]).toMatchObject({ b: 4, d: 3, m: 67, call: true, fing: '0' });
		expect(notes[1]).toMatchObject({ b: 8, d: 3, m: 67, call: false, fing: '0' });
		expect(notes.map((n) => n.m).filter((_, i) => i % 2)).toEqual([67, 65, 64, 62, 60, 62, 64, 67]);
	});

	it('jede Übung passt in die Takte und hat für jedes Instrument einen Griff auf der Naturtonreihe', () => {
		for (const e of EXERCISES) {
			for (const lvl of [0, 1] as ExerciseLevel[]) {
				for (const round of e.rounds(lvl)) {
					expect(
						round.notes.reduce((s, [, d]) => s + d, 0),
						`${e.id} ${lvl}`
					).toBeLessThanOrEqual(PHRASE_BEATS);
				}
				for (const kind of ['valve', 'slide'] as const) {
					const track = buildTrack(buildExercise(e, lvl, kind).notes, kind);
					for (const n of track.notes) {
						expect(n.fing, `${e.id} ${lvl} ${kind} ${n.m}`).not.toBe('');
						expect(isNaturalTone(n.m + (n.lower ?? 99)), `${e.id} ${kind} ${n.m}`).toBe(true);
					}
				}
			}
		}
	});

	it('Schränz-Groove: Belohnung ab Level 3, Synkopen auf G und C', () => {
		expect(ex('groove').unlock).toBe('groove');
		expect(EXERCISES.filter((e) => e.unlock).map((e) => e.id)).toEqual(['groove']);
		const { notes, total } = buildExercise(ex('groove'), 0, 'valve');
		expect(total).toBe(COUNT_IN_BEATS + 3 * 2 * PHRASE_BEATS);
		expect(notes.slice(0, 5).map((n) => [n.b, n.d])).toEqual([
			[4, 0.5],
			[4.5, 1],
			[5.5, 0.5],
			[6, 1],
			[7, 1]
		]);
		expect(new Set(buildExercise(ex('groove'), 1, 'valve').notes.map((n) => n.m))).toEqual(
			new Set([67, 72])
		);
	});

	it('Lippenbindungen: ein Griff pro Runde, bei der Posaune Zugposition statt Ventil', () => {
		const valve = buildExercise(ex('bind'), 1, 'valve').notes;
		expect(valve.slice(0, 4).map((n) => n.fing)).toEqual(['0', '0', '0', '0']);
		expect(valve[8].fing).toBe('2'); // Absenkung 1 Halbton
		const slide = buildExercise(ex('bind'), 1, 'slide').notes;
		expect(slide[8].fing).toBe('2'); // Zug 2
		expect(loweringOf(slide[8].fing, 'slide')).toBe(1);
	});

	it('Taktplan: Klick beim Einzählen immer, danach nur auf Wunsch; nur vorgespielte Töne klingen', () => {
		const { notes } = buildExercise(ex('leiter'), 0, 'valve');
		expect(beatEvents(0, notes, false).click).toEqual({ accent: true });
		expect(beatEvents(3, notes, false).click).toEqual({ accent: false });
		expect(beatEvents(4, notes, false).click).toBeNull();
		expect(beatEvents(4, notes, true).click).toEqual({ accent: true });
		expect(beatEvents(4, notes, true).tones).toEqual([{ b: 4, d: 1, m: 60 }]);
		// Takt 3 (Schlag 8) spielst du: kein Ton vom Dirigenten
		expect(beatEvents(8, notes, true).tones).toEqual([]);
	});
});
