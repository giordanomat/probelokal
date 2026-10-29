import { describe, expect, it } from 'vitest';
import { BAD_TOUCH, BAD_TOUCH_NOTES } from '../titles/bad-touch';
import { buildTrack } from '../music/track';
import type { Section } from '../music/types';
import type { NoteVerdict } from '../pitch/classify';
import {
	encouragement,
	gripCorrect,
	gripItems,
	laneExamQuery,
	laneScore,
	parseLaneExam,
	passMark,
	quizFor,
	sectionNotes,
	sectionScore,
	shuffle
} from './exams';
import {
	examAward,
	hasUnlock,
	LEVELS,
	rewardText,
	isoWeek,
	levelOf,
	nextLevel,
	passAward,
	reachesWeekGoal
} from '../game/points';

/** Feste Zufallsfolge für die Tests */
function seeded(seed = 1) {
	let s = seed;
	return () => {
		s = (s * 16807) % 2147483647;
		return (s - 1) / 2147483646;
	};
}

const part = (id: string) => BAD_TOUCH_NOTES.parts.find((p) => p.id === id)!;
const trp = buildTrack(part('P1').notes, 'valve').notes;
const pos = buildTrack(part('P3').notes, 'slide').notes;
const A = BAD_TOUCH.sections[1];

describe('Etappe 1: Quiz', () => {
	it('vier Fragen aus den Noten von Teil A, Antwort immer unter den Optionen', () => {
		const q = quizFor(A, trp, 'valve', seeded())!;
		const own = sectionNotes(trp, A);
		expect(q.map((x) => x.q)).toEqual([
			'Mit welchem Griff beginnt Teil A?',
			'Welches ist der höchste Ton in Teil A?',
			'Wie viele Takte hat Teil A?',
			'Wie lang ist der erste Ton in Teil A?'
		]);
		expect(q[2].answer).toBe(String(A.to - A.from + 1));
		expect(q[1].answer).toBe(own.reduce((a, b) => (b.m > a.m ? b : a)).name);
		for (const x of q) {
			expect(x.options).toContain(x.answer);
			expect(new Set(x.options).size).toBe(x.options.length);
			expect(x.options.length).toBeGreaterThanOrEqual(2);
			expect(x.options.length).toBeLessThanOrEqual(4);
		}
	});

	it('Posaune fragt nach dem Zug', () => {
		const q = quizFor(A, pos, 'slide', seeded())!;
		expect(q[0].q).toBe('Mit welchem Zug beginnt Teil A?');
		expect(q[0].answer).toMatch(/^Zug [1-7]$/);
	});

	it('Pause im Teil: kein Quiz', () => {
		const empty: Section = { from: 200, to: 201, name: 'Z' };
		expect(quizFor(empty, trp, 'valve', seeded())).toBeNull();
	});

	it('mischen verliert und verdoppelt nichts', () => {
		expect(shuffle([1, 2, 3, 4, 5], seeded(7)).sort()).toEqual([1, 2, 3, 4, 5]);
	});
});

describe('Etappe 2: Griffe sitzen', () => {
	it('höchstens 10 Töne, gleiche Tonhöhe hintereinander nur einmal, alle mit Griff', () => {
		const items = gripItems(trp, A);
		expect(items.length).toBeGreaterThan(0);
		expect(items.length).toBeLessThanOrEqual(10);
		for (let i = 1; i < items.length; i++) expect(items[i].m).not.toBe(items[i - 1].m);
		expect(items.every((n) => n.fing)).toBe(true);
	});

	it('gleichwertige Griffe zählen: 3 = 1 + 2; Zug nach Position', () => {
		expect(gripCorrect('3', { fing: '12' }, 'valve')).toBe(true);
		expect(gripCorrect('0', { fing: '0' }, 'valve')).toBe(true);
		expect(gripCorrect('1', { fing: '2' }, 'valve')).toBe(false);
		expect(gripCorrect('4', { fing: '4' }, 'slide')).toBe(true);
		expect(gripCorrect('3', { fing: '4' }, 'slide')).toBe(false);
	});
});

describe('Etappen 3–5 und Bestehen', () => {
	it('getroffen 1, knapp und falsche Stufe 0,5, sonst 0', () => {
		expect(laneScore(['hit', 'near', 'partial', 'wrong', 'none', undefined])).toBeCloseTo(2 / 6);
		expect(laneScore([])).toBe(1);
	});

	it('»Fast!« nur, wenn es knapp war', () => {
		expect(encouragement(0.7, seeded())).toMatch(/^Fast!/);
		for (let i = 0; i < 20; i++) expect(encouragement(0, seeded(i + 1))).not.toMatch(/^Fast!/);
	});

	it('Etappe 1 ab 75 %, sonst ab 80 %', () => {
		expect(passMark(1)).toBe(0.75);
		expect([2, 3, 4, 5].map(passMark)).toEqual([0.8, 0.8, 0.8, 0.8]);
	});
});

describe('Punkte', () => {
	const base = {
		stage: 3,
		previous: 2,
		score: 0.85,
		passed: true,
		via: 'mic',
		onTime: false
	} as const;

	it('nur das erste Bestehen der nächsten Etappe zählt', () => {
		expect(examAward(base)).toEqual({ points: 40, reasons: ['Etappe bestanden'] });
		expect(examAward({ ...base, previous: 3 }).points).toBe(0);
		expect(examAward({ ...base, previous: 1 }).points).toBe(0);
		expect(examAward({ ...base, passed: false }).points).toBe(0);
	});

	it('Glanz und rechtzeitig, ohne Mikrofon ab Etappe 4 halbiert', () => {
		expect(examAward({ ...base, score: 0.96, onTime: true })).toEqual({
			points: 75,
			reasons: ['Etappe bestanden', 'mit Glanz', 'rechtzeitig']
		});
		expect(examAward({ ...base, stage: 4, previous: 3, via: 'rhythm' }).points).toBe(20);
		// Etappe 3 mit Rhythmus tippen zählt voll
		expect(examAward({ ...base, via: 'rhythm' }).points).toBe(40);
	});

	it('bewerteter Durchgang: ab 50 %, höchstens 15', () => {
		expect(passAward(49, 100)).toBe(0);
		expect(passAward(50, 80)).toBe(5);
		expect(passAward(84, 80)).toBe(8);
		expect(passAward(100, 100)).toBe(15);
	});

	it('Ränge und Freischaltungen', () => {
		expect(levelOf(0).name).toBe('Schnupperi');
		expect(levelOf(99).n).toBe(1);
		expect(levelOf(100).name).toBe('Lehrling');
		expect(levelOf(5000).name).toBe('Fasnachtslegende');
		expect(nextLevel(260)?.name).toBe('Gassenhauer');
		expect(nextLevel(1900)).toBeNull();
		expect(hasUnlock(249, 'groove')).toBe(false);
		expect(hasUnlock(250, 'groove')).toBe(true);
		expect(hasUnlock(900, 'fasnacht')).toBe(true);
		expect(rewardText(LEVELS[1])).toMatch(/\(kommt bald\)$/);
		expect(rewardText(LEVELS[4])).toBe('Goldener Name in der Rangliste');
	});

	it('Wochenziel: am dritten Übetag einer Woche, einmal', () => {
		expect(isoWeek('2026-10-26')).toBe('2026-44');
		expect(isoWeek('2026-11-01')).toBe('2026-44');
		expect(isoWeek('2027-01-01')).toBe('2026-53');
		const days = ['2026-10-26', '2026-10-28'];
		expect(reachesWeekGoal(days, '2026-10-30')).toBe(true);
		expect(reachesWeekGoal(days, '2026-10-28')).toBe(false);
		expect(reachesWeekGoal([...days, '2026-10-30'], '2026-10-31')).toBe(false);
		// Vorwoche zählt nicht
		expect(reachesWeekGoal(['2026-10-24', '2026-10-28'], '2026-10-30')).toBe(false);
	});
});

describe('Prüfung auf der Bahn', () => {
	const G = '0b7c1d2e-3f40-4a5b-8c6d-7e8f9a0b1c2d';

	it('Ergebnis über alle Töne des Teils; nicht bewertete zählen 0', () => {
		const idx = sectionNotes(trp, A).map((n) => trp.indexOf(n));
		const judged = new Map<number, NoteVerdict>(idx.map((i) => [i, 'hit']));
		expect(sectionScore(trp, A, judged)).toBe(1);
		judged.delete(idx[0]);
		judged.set(idx[1], 'near');
		expect(sectionScore(trp, A, judged)).toBeCloseTo((idx.length - 1.5) / idx.length);
		expect(sectionScore(trp, A, new Map())).toBe(0);
	});

	it('Angaben aus der Adresse, hin und zurück; Unsinn ergibt null', () => {
		const p = { guugge: G, section: 3, stage: 4, via: 'rhythm' } as const;
		expect(parseLaneExam(new URLSearchParams(laneExamQuery(p)), 18)).toEqual(p);
		for (const bad of [
			`?pruefung=x&teil=3&etappe=4&art=mic`,
			`?pruefung=${G}&teil=0&etappe=4&art=mic`,
			`?pruefung=${G}&teil=18&etappe=4&art=mic`,
			`?pruefung=${G}&teil=3&etappe=2&art=mic`,
			`?pruefung=${G}&teil=3&etappe=4&art=quiz`,
			''
		]) {
			expect(parseLaneExam(new URLSearchParams(bad), 18), bad).toBeNull();
		}
	});
});
