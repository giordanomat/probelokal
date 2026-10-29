import { describe, expect, it } from 'vitest';
import { BAD_TOUCH, BAD_TOUCH_NOTES } from '../titles/bad-touch';
import type { RawNote, Section } from '../music/types';
import { addDays, longDate, mondayOf, shortDate, todayInZurich, weekdayOf } from './dates';
import { buildPlan, dueOf, expectedStage, sectionWeights, type PlanParams } from './plan';
import {
	nextExams,
	pauseSections,
	planStatus,
	playedSections,
	standPercent,
	statusText,
	weekGoals
} from './stand';

// Sollwerte aus prototype/v7 (difficulty, buildPlan, dueOf), mit denselben Eingaben einmal
// nebeneinander gerechnet am 29.10.2026: Gewichte, Lernwochen, Wochentexte, Fälligkeiten und
// Meilensteine stimmten in vier Fällen überein, auch über die Zeitumstellung.

const SECTIONS = BAD_TOUCH.sections;
const WEIGHTS = sectionWeights(
	SECTIONS,
	BAD_TOUCH_NOTES.parts.map((p) => p.notes)
);
const PARAMS: PlanParams = {
	start: '2026-11-02',
	perf: '2027-02-20',
	gpWeekday: 3,
	rpWeekday: 1,
	minutesPerWeek: 60
};
const PLAN = buildPlan(PARAMS, SECTIONS, WEIGHTS);

describe('Kalendertage', () => {
	it('rechnen ohne Zeitzone, auch über die Zeitumstellung', () => {
		expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
		expect(mondayOf('2026-11-08')).toBe('2026-11-02');
		expect(mondayOf('2026-11-02')).toBe('2026-11-02');
		expect(weekdayOf('2026-11-04')).toBe(3);
		expect(shortDate('2027-01-04')).toBe('4.1.');
		expect(longDate('2027-02-20')).toBe('20.2.2027');
	});

	it('heute gilt in der Schweiz, nicht in UTC', () => {
		expect(todayInZurich(new Date('2026-10-28T23:30:00Z'))).toBe('2026-10-29');
		expect(todayInZurich(new Date('2026-10-28T12:00:00Z'))).toBe('2026-10-28');
	});
});

describe('Gesamtplan', () => {
	it('Bad Touch: 16 Wochen = 9 Lernen, 3 Tempo, 2 Auswendig, 2 Feinschliff', () => {
		expect(PLAN.weeks).toHaveLength(16);
		expect([PLAN.nLearn, PLAN.nTempo, PLAN.nMemo]).toEqual([9, 3, 2]);
		expect(PLAN.weeks.map((w) => w.phase)).toEqual([
			...Array(9).fill('Lernen'),
			...Array(3).fill('Tempo'),
			...Array(2).fill('Auswendig'),
			...Array(2).fill('Feinschliff')
		]);
	});

	it('Teile nach Schwierigkeit auf die Lernwochen verteilt, in Reihenfolge', () => {
		expect(WEIGHTS[0]).toBe(0);
		expect(WEIGHTS.slice(1).every((w) => w >= 0.5)).toBe(true);
		expect(Object.values(PLAN.learnWeek)).toEqual([
			0, 1, 1, 1, 2, 2, 3, 4, 4, 4, 4, 5, 5, 5, 6, 7, 8
		]);
	});

	it('Wochentexte wie im Prototyp', () => {
		expect(PLAN.weeks[0]).toEqual({
			monday: '2026-11-02',
			sunday: '2026-11-08',
			phase: 'Lernen',
			items: [
				'Neu: Teil A – Etappen 1 und 2',
				'Registerprobe 2.11.: Teil A langsam zusammen, Einsätze',
				'Gesamtprobe 4.11.: Teil A neu, Bisheriges durchspielen',
				'Einzeln: 60 Min. pro Woche, z. B. 5 × 12 Min. mit dem Dirigenten'
			]
		});
		expect(PLAN.weeks[1].items[1]).toBe('Festigen: Teil A – Etappe 2 bis Sonntag');
		expect(PLAN.weeks[9].items[0]).toBe('Tempo: Teil A–F – Etappe 4');
		expect(PLAN.weeks[12].items[0]).toBe('Auswendig: Teil A–I – Etappe 5');
		expect(PLAN.weeks[15].items).toEqual([
			'Durchläufe, Übergänge, Dynamik der Leitung',
			'Gesamtprobe 17.2.: Auftritt simulieren, stehend und auswendig',
			'Einzeln: 60 Min. pro Woche, z. B. 5 × 12 Min. mit dem Dirigenten'
		]);
	});

	it('ohne Registerprobe und Übezeit fehlen die Zeilen', () => {
		const p = buildPlan({ ...PARAMS, rpWeekday: null, minutesPerWeek: 0 }, SECTIONS, WEIGHTS);
		expect(p.weeks[0].items).toEqual([
			'Neu: Teil A – Etappen 1 und 2',
			'Gesamtprobe 4.11.: Teil A neu, Bisheriges durchspielen'
		]);
	});

	it('Gesamtprobe am Sonntag liegt am Ende der Woche', () => {
		const p = buildPlan({ ...PARAMS, gpWeekday: 0 }, SECTIONS, WEIGHTS);
		expect(p.weeks[0].items.at(-2)).toMatch(/^Gesamtprobe 8\.11\./);
	});

	it('Meilensteine', () => {
		expect(PLAN.milestones).toEqual([
			{ text: 'Etappe 3 für alle Teile', date: '2027-01-03' },
			{ text: 'Originaltempo', date: '2027-01-24' },
			{ text: 'Auswendig', date: '2027-02-07' },
			{ text: 'Auftrittsreif', date: '2027-02-20' }
		]);
	});

	it('Auftritt in derselben Woche: eine Lernwoche, keine anderen Phasen', () => {
		const p = buildPlan({ ...PARAMS, start: '2026-11-04', perf: '2026-11-08' }, SECTIONS, WEIGHTS);
		expect(p.weeks).toHaveLength(1);
		expect([p.nLearn, p.nTempo, p.nMemo]).toEqual([1, 0, 0]);
		expect(dueOf(p, 17, 5)).toBe('2026-11-08');
	});
});

describe('Fälligkeit der Etappen', () => {
	it('Teil A und Teil Q', () => {
		expect([1, 2, 3, 4, 5].map((k) => dueOf(PLAN, 1, k))).toEqual([
			'2026-11-08',
			'2026-11-15',
			'2027-01-03',
			'2027-01-24',
			'2027-02-07'
		]);
		expect([1, 2, 3, 4, 5].map((k) => dueOf(PLAN, 17, k))).toEqual([
			'2027-01-03',
			'2027-01-03',
			'2027-01-03',
			'2027-01-24',
			'2027-02-07'
		]);
	});

	it('erwartet ist, was vor heute fällig war', () => {
		expect(expectedStage(PLAN, 1, '2026-11-08')).toBe(0);
		expect(expectedStage(PLAN, 1, '2026-11-09')).toBe(1);
		expect(expectedStage(PLAN, 1, '2027-01-04')).toBe(3);
		expect(expectedStage(PLAN, 1, '2027-03-01')).toBe(5);
	});
});

describe('Mein Plan', () => {
	const sections: Section[] = [
		{ from: 0, to: 0, name: 'Vorzähler' },
		{ from: 1, to: 2, name: 'A' },
		{ from: 3, to: 4, name: 'B' },
		{ from: 5, to: 6, name: 'C' }
	];
	const n = (bar: number): RawNote => ({
		b: bar * 4,
		d: 1,
		m: 60,
		dia: 35,
		acc: 0,
		step: 'C',
		fing: '0'
	});
	// Teil B ist Pause für diese Stimme
	const notes = [n(1), n(2), n(5)];

	it('Pause und gespielte Teile; Vorzähler zählt nie', () => {
		expect([...pauseSections(sections, notes)]).toEqual([2]);
		expect(playedSections(sections, notes)).toEqual([1, 3]);
	});

	it('Prozent bis auftrittsreif', () => {
		expect(standPercent([1, 3], { 1: 5, 3: 0 })).toBe(50);
		expect(standPercent([1, 3], {})).toBe(0);
		expect(standPercent([], {})).toBe(0);
	});

	it('Als Nächstes: nach Fälligkeit, ohne Plan nach Teil, Fertiges fällt weg', () => {
		expect(nextExams([1, 3], { 1: 5 }, null)).toEqual([{ section: 3, stage: 1, due: null }]);
		const plan = buildPlan(PARAMS, sections, [0, 1, 1, 1]);
		const next = nextExams([1, 3], { 1: 1 }, plan);
		expect(next.map((x) => [x.section, x.stage])).toEqual([
			[1, 2],
			[3, 1]
		]);
		expect(next[0].due! <= next[1].due!).toBe(true);
	});

	it('voraus, im Plan, hinterher', () => {
		const plan = buildPlan(PARAMS, sections, [0, 1, 1, 1]);
		const today = '2027-01-04';
		const exp = expectedStage(plan, 1, today) + expectedStage(plan, 3, today);
		const s = planStatus([1, 3], { 1: 2, 3: 1 }, plan, today);
		expect(s).toEqual({ sum: 3, expected: exp, max: 10, diff: 3 - exp });
		expect(statusText(s, true)).toBe(`${exp - 3} Etappen hinterher`);
		expect(statusText({ ...s, diff: 1 }, true)).toBe('1 Etappe voraus');
		expect(statusText({ ...s, diff: 0 }, true)).toBe('Genau im Plan');
		expect(statusText(s, false)).toBe('3 von 10 Etappen');
	});

	it('Wochenziele: was diese Woche fällig wird, mit Haken', () => {
		const goals = weekGoals([1], { 1: 1 }, PLAN, '2026-11-09', '2026-11-15');
		expect(goals).toEqual([{ section: 1, stage: 2, done: false }]);
		expect(weekGoals([1], { 1: 2 }, PLAN, '2026-11-09', '2026-11-15')[0].done).toBe(true);
	});
});
