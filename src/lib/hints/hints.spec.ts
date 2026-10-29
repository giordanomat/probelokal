import { describe, expect, it } from 'vitest';
import { BAD_TOUCH_VOICES } from '../titles/bad-touch-voices';
import { barsLabel, bodyRequired, hintLong, hintShort, hintsFor, targetLabel } from './hints';

describe('Hinweise der Leitung', () => {
	it('kurz für die Bahn, lang für die Liste', () => {
		expect(hintShort({ kind: 'dyn', dyn: 'pp', body: null })).toBe('pp');
		expect(hintShort({ kind: 'atem', dyn: null, body: null })).toBe('Atmen');
		expect(hintShort({ kind: 'artik', dyn: null, body: 'kurz' })).toBe('Artik.');
		expect(hintShort({ kind: 'text', dyn: null, body: 'Posaunen führen, Trompeten zurück' })).toBe(
			'! Posaunen führen, T…'
		);
		expect(hintLong({ kind: 'dyn', dyn: 'cresc.', body: 'bis T. 12' })).toBe(
			'cresc. – lauter werden. bis T. 12'
		);
		expect(hintLong({ kind: 'atem', dyn: null, body: null })).toBe('Hier atmen');
		expect(hintLong({ kind: 'text', dyn: null, body: 'Solo' })).toBe('Solo');
	});

	it('für wen, Takte, Pflichttext', () => {
		expect(targetLabel('alle', BAD_TOUCH_VOICES)).toBe('Alle');
		expect(targetLabel('tief', BAD_TOUCH_VOICES)).toBe('Tiefes Blech');
		expect(targetLabel('pos2', BAD_TOUCH_VOICES)).toBe('Posaune 2');
		expect(barsLabel({ bar_from: 9, bar_to: 12 })).toBe('T. 9–12');
		expect(barsLabel({ bar_from: 13, bar_to: 13 })).toBe('T. 13');
		expect(['dyn', 'artik', 'atem', 'text'].map((k) => bodyRequired(k as never))).toEqual([
			false,
			true,
			false,
			true
		]);
	});

	it('für eine Stimme: an alle, ihr Register oder sie selbst', () => {
		const hints = ['alle', 'trp', 'trp1', 'trp2', 'pos', 'tief'].map((target) => ({ target }));
		expect(hintsFor(hints, { id: 'trp1', register: 'trp' }).map((h) => h.target)).toEqual([
			'alle',
			'trp',
			'trp1'
		]);
		expect(hintsFor(hints, { id: 'sous', register: 'tief' }).map((h) => h.target)).toEqual([
			'alle',
			'tief'
		]);
		expect(hintsFor(hints, null)).toHaveLength(6);
	});
});
