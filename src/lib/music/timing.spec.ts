import { describe, expect, it } from 'vitest';
import { BAD_TOUCH } from '#lib/titles/bad-touch.ts';
import {
	beatAtTime,
	countIn,
	sectionIndexOf,
	sectionLabel,
	secondsPerBeat,
	timeForBar,
	wallSeconds
} from './timing';

describe('Takt und Zeit (Bad Touch, ♩ 115, Versatz 3 Takte)', () => {
	it('Versatz ist genau drei Takte (am ersten Einsatz gemessen, docs/04)', () => {
		expect(BAD_TOUCH.stem_offset_sec).toBeCloseTo(6.261, 3);
		expect(BAD_TOUCH.stem_offset_sec / (4 * secondsPerBeat(BAD_TOUCH))).toBeCloseTo(3, 9);
	});

	it('rechnet Takt ↔ Zeit hin und zurück', () => {
		expect(timeForBar(BAD_TOUCH, 0)).toBeCloseTo(6.261, 3);
		const t = timeForBar(BAD_TOUCH, 9);
		expect(beatAtTime(BAD_TOUCH, t)).toBeCloseTo(36);
		expect(timeForBar(BAD_TOUCH, -10)).toBe(0);
	});

	it('Wanduhr-Zeit hängt vom Tempo ab', () => {
		expect(wallSeconds(1, 0.5, 1)).toBe(0.5);
		expect(wallSeconds(1, 0.5, 0.5)).toBe(1);
	});
});

describe('Teile', () => {
	it('Vorzähler und A–Q mit lückenlosen Grenzen', () => {
		const s = BAD_TOUCH.sections;
		expect(s).toHaveLength(18);
		expect(s[0]).toEqual({ from: 0, to: 0, name: 'Vorzähler' });
		expect(s[1]).toEqual({ from: 1, to: 8, name: 'A' });
		expect(s[17]).toEqual({ from: 88, to: 92, name: 'Q' });
		s.slice(1).forEach((x, i) => expect(x.from).toBe(s[i].to + 1));
		expect(sectionLabel(s[0])).toBe('Vorzähler');
		expect(sectionLabel(s[3])).toBe('Teil C');
	});

	it('findet den Teil zu einem Takt', () => {
		const s = BAD_TOUCH.sections;
		expect(sectionIndexOf(s, 0.5)).toBe(0);
		expect(sectionIndexOf(s, 8.99)).toBe(1);
		expect(sectionIndexOf(s, 9)).toBe(2);
		expect(sectionIndexOf(s, 92.5)).toBe(17);
	});
});

describe('Einzählen', () => {
	it('zählt im Takt vor dem Sprungziel 1–4', () => {
		expect(countIn(32, 9)).toBe(1);
		expect(countIn(33.5, 9)).toBe(2);
		expect(countIn(35.99, 9)).toBe(4);
		expect(countIn(36, 9)).toBeNull();
		expect(countIn(31.9, 9)).toBeNull();
		expect(countIn(33, null)).toBeNull();
	});
});
